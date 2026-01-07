/* Frontend robusto (streaming SSE ou JSON fallback) + UI melhorada
   Altere BACKEND_URL se precisar.
*/

const BACKEND_URL = "https://chat-ia-backend-sow2.onrender.com/chat"; // <- ajuste se seu backend for outro

/* DOM */
const convListEl = document.getElementById("conversations");
const btnAdd = document.getElementById("btnAdd");
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");
const typingEl = document.getElementById("typing");
const themeToggle = document.getElementById("themeToggle");
const exportBtn = document.getElementById("exportBtn");
const toggleSidebar = document.getElementById("toggleSidebar");

let conversations = JSON.parse(localStorage.getItem("chats") || "[]");
let activeId = localStorage.getItem("activeId") || null;
let controller = null;
let streaming = false;

/* helpers */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
const now = ts => new Date(ts || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});

function save() {
  localStorage.setItem("chats", JSON.stringify(conversations));
  if (activeId) localStorage.setItem("activeId", activeId);
}

/* ensure a conversation exists */
function ensureConversation() {
  if (!conversations || conversations.length === 0) {
    const id = uid();
    const conv = { id, title: "Nova conversa", createdAt: Date.now(), messages: [] };
    conversations.unshift(conv);
    activeId = id;
    save();
  }
}

/* UI: render sidebar */
function renderSidebar() {
  convListEl.innerHTML = "";
  conversations.forEach(conv => {
    const el = document.createElement("div");
    el.className = "conv" + (conv.id === activeId ? " active" : "");
    el.innerText = conv.title || (conv.messages[0]?.content?.slice(0,30) || "Nova conversa");

    // click -> open
    el.addEventListener("click", () => {
      activeId = conv.id; save(); renderSidebar(); renderChat();
      // on small screens hide sidebar
      if (window.innerWidth <= 900) document.querySelector('.sidebar').style.display = 'none';
    });

    // long press / right click to delete
    let timer = null;
    const start = (e) => {
      e.preventDefault?.();
      timer = setTimeout(() => {
        if (confirm(`Excluir conversa "${conv.title || 'Nova conversa'}"?`)) {
          conversations = conversations.filter(c => c.id !== conv.id);
          if (activeId === conv.id) activeId = conversations[0]?.id || null;
          save(); renderSidebar(); renderChat();
        }
      }, 700);
    };
    const cancel = () => { clearTimeout(timer); timer = null; };
    el.addEventListener("touchstart", start);
    el.addEventListener("touchend", cancel);
    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", cancel);
    el.addEventListener("mouseleave", cancel);
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (confirm(`Excluir conversa "${conv.title||'Nova conversa'}"?`)) {
        conversations = conversations.filter(c => c.id !== conv.id);
        if (activeId === conv.id) activeId = conversations[0]?.id || null;
        save(); renderSidebar(); renderChat();
      }
    });

    convListEl.appendChild(el);
  });
}

/* UI: render chat */
function renderChat() {
  chatEl.innerHTML = "";
  const conv = conversations.find(c => c.id === activeId);
  if (!conv) return;
  conv.messages.forEach(m => {
    const node = document.createElement("div");
    node.className = "message " + (m.role === "user" ? "user" : "ai");
    // optional meta (timestamp)
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerText = `${m.role === "user" ? "Você" : "Assistente"} • ${m.ts ? now(m.ts) : ""}`;
    const content = document.createElement("div");
    content.className = "content";
    content.innerText = m.content;
    node.appendChild(meta);
    node.appendChild(content);
    chatEl.appendChild(node);
  });

  if (!conv.messages.length) {
    const p = document.createElement("div");
    p.className = "message ai";
    p.style.opacity = 0.6;
    p.innerText = "Comece a conversar — escreva algo no campo abaixo.";
    chatEl.appendChild(p);
  }

  chatEl.scrollTop = chatEl.scrollHeight;
}

/* typing UI */
function showTyping(){ typingEl.classList.remove("hidden"); typingEl.classList.remove("hidden"); typingEl.style.display='flex'; chatEl.scrollTop = chatEl.scrollHeight; }
function hideTyping(){ typingEl.classList.add("hidden"); typingEl.style.display='none'; }

/* streaming UI */
function setStreaming(on) {
  streaming = !!on;
  if (on) { stopBtn.classList.remove("hidden"); sendBtn.disabled = true; }
  else { stopBtn.classList.add("hidden"); sendBtn.disabled = false; controller = null; }
}

/* parse SSE-like chunks */
function parseChunk(raw) {
  const tokens = [];
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const payload = line.replace(/^data:\s*/, "");
    if (payload === "[DONE]") { tokens.push("[DONE]"); continue; }
    try {
      const obj = JSON.parse(payload);
      const delta = obj?.choices?.[0]?.delta?.content;
      const text = obj?.choices?.[0]?.text;
      const alt = obj?.output_text || obj?.content || null;
      if (delta) tokens.push(delta);
      else if (text) tokens.push(text);
      else if (alt) tokens.push(alt);
    } catch(e){ /* ignore */ }
  }
  return tokens;
}

/* fallback JSON handler */
async function handleJsonResponse(res, conv, aiIndex) {
  let data;
  try { data = await res.json(); }
  catch (e) {
    const txt = await res.text().catch(()=>null);
    conv.messages[aiIndex].content = `Resposta inválida do servidor: ${txt || 'sem conteúdo'}`;
    save(); renderChat(); return;
  }

  let reply = null;
  if (data.reply) reply = data.reply;
  else if (data.choices && data.choices[0]?.message?.content) reply = data.choices[0].message.content;
  else if (data.choices && data.choices[0]?.text) reply = data.choices[0].text;
  else if (typeof data === "string") reply = data;

  if (reply === null) {
    conv.messages[aiIndex].content = "Servidor respondeu sem texto esperado.";
    save(); renderChat(); return;
  }

  // typewriter fallback to feel like streaming and ensure completion
  await typeWrite(conv, aiIndex, reply);
}

/* typewriter effect used for fallback JSON */
function typeWrite(conv, aiIndex, full, speed = 12) {
  return new Promise(resolve => {
    let i = 0;
    conv.messages[aiIndex].content = "";
    save(); renderChat();
    const interval = setInterval(()=> {
      conv.messages[aiIndex].content += full[i] || "";
      i++;
      save(); renderChat(); chatEl.scrollTop = chatEl.scrollHeight;
      if (i >= full.length) { clearInterval(interval); resolve(); }
    }, speed);
  });
}

/* send message (attempt streaming, fallback to JSON) */
async function sendMessage(text) {
  if (!text || streaming) return;
  const conv = conversations.find(c => c.id === activeId);
  if (!conv) return;

  // push user message
  conv.messages.push({ role: "user", content: text, ts: Date.now() });
  if (!conv.title || conv.title === "Nova conversa") conv.title = text.slice(0,40);
  save(); renderSidebar(); renderChat();

  // placeholder assistant
  conv.messages.push({ role: "assistant", content: "", ts: Date.now() });
  const aiIndex = conv.messages.length - 1;
  save(); renderChat();

  controller = new AbortController();
  setStreaming(true);
  showTyping();

  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conv.messages.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })) }),
      signal: controller.signal
    });

    if (!res.ok) {
      // show detailed error
      const text = await res.text().catch(()=>res.statusText);
      console.error("Erro do backend:", res.status, text);
      conv.messages[aiIndex].content = `Erro ao responder: ${res.status} — ${text}`;
      save(); renderChat(); setStreaming(false); hideTyping();
      return;
    }

    const type = (res.headers.get("content-type") || "").toLowerCase();
    // if server returns event-stream or has a readable body -> attempt streaming read
    if (type.includes("text/event-stream") || res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let done = false;
      let acc = conv.messages[aiIndex].content || "";

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) { done = true; break; }
        const chunk = dec.decode(value, { stream: true });
        const tokens = parseChunk(chunk);
        for (const t of tokens) {
          if (t === "[DONE]") { done = true; break; }
          acc += t;
          conv.messages[aiIndex].content = acc;
          save();
          renderChat();
          chatEl.scrollTop = chatEl.scrollHeight;
        }
      }

      setStreaming(false);
      hideTyping();
      save();
      renderChat();
      return;
    } else {
      // fallback: server returned JSON with full text
      await handleJsonResponse(res, conv, aiIndex);
      setStreaming(false);
      hideTyping();
      save();
      renderChat();
      return;
    }
  } catch (err) {
    // network / abort
    console.error("Erro fetch/send:", err);
    if (err.name === "AbortError") conv.messages[aiIndex].content += "\n\n(geração interrompida)";
    else conv.messages[aiIndex].content = "Erro de conexão com o servidor.";
    save(); renderChat(); setStreaming(false); hideTyping();
  }
}

/* UI handlers */
btnAdd.addEventListener("click", () => {
  const id = uid();
  const conv = { id, title: "Nova conversa", createdAt: Date.now(), messages: [] };
  conversations.unshift(conv);
  activeId = id;
  save(); renderSidebar(); renderChat();
});

sendBtn.addEventListener("click", ()=> {
  const t = inputEl.value.trim();
  if (!t) return;
  inputEl.value = "";
  sendMessage(t);
});

stopBtn.addEventListener("click", ()=> {
  if (controller) controller.abort();
  setStreaming(false);
  hideTyping();
});

inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    sendMessage(text);
  }
});

themeToggle && themeToggle.addEventListener("click", ()=> {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
});
if (localStorage.getItem("theme")==="light") document.body.classList.add("light");

exportBtn && exportBtn.addEventListener("click", ()=> {
  const conv = conversations.find(c => c.id === activeId);
  if (!conv) return alert("Nenhuma conversa ativa");
  const blob = new Blob([JSON.stringify(conv, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${(conv.title||'conversa').replace(/\s+/g,'_')}.json`; a.click(); a.remove();
});

toggleSidebar && toggleSidebar.addEventListener("click", ()=> {
  const sb = document.querySelector('.sidebar');
  sb.style.display = (sb.style.display==='none' || getComputedStyle(sb).display==='none') ? 'flex' : 'none';
});

/* init */
ensureConversation();
if (!activeId) activeId = conversations[0].id;
renderSidebar();
renderChat();
