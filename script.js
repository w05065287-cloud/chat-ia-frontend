/* Frontend robusto: streaming & fallback + long-press delete on conversations
   - Ajuste BACKEND_URL para seu backend se necessário
   - Histórico salvo em localStorage
*/

const BACKEND_URL = "https://chat-ia-backend-sow2.onrender.com/chat"; // <-- ajuste se necessário

/* DOM */
const sidebarList = document.getElementById("sidebarList");
const btnNewChat = document.getElementById("btnNewChat");
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");
const typingEl = document.getElementById("typing");
const themeToggle = document.getElementById("themeToggle");
const exportBtn = document.getElementById("exportBtn");

/* State */
let conversations = JSON.parse(localStorage.getItem("chats") || "[]");
let activeId = localStorage.getItem("activeId") || null;
let controller = null;
let streaming = false;

/* utils */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
const now = ts => new Date(ts || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});

function save() {
  localStorage.setItem("chats", JSON.stringify(conversations));
  if (activeId) localStorage.setItem("activeId", activeId);
}

/* ensure conversation exists */
function ensureConversation() {
  if (!conversations || conversations.length === 0) {
    const id = uid();
    const conv = { id, title: "Nova conversa", createdAt: Date.now(), messages: [] };
    conversations.unshift(conv);
    activeId = id;
    save();
  }
}

/* active conv helper */
function activeConv() {
  return conversations.find(c => c.id === activeId) || conversations[0];
}

/* render sidebar with long-press to delete */
function renderSidebar() {
  sidebarList.innerHTML = "";
  conversations.forEach(conv => {
    const el = document.createElement("div");
    el.className = "conv-item" + (conv.id === activeId ? " active" : "");
    el.innerText = conv.title || (conv.messages[0] ? conv.messages[0].content.slice(0,30) : "Nova conversa");

    // click to open
    el.addEventListener("click", () => { activeId = conv.id; save(); renderSidebar(); renderChat(); });

    // long-press / right-click to delete (works on touch and mouse)
    let pressTimer = null;
    const startPress = (e) => {
      e.preventDefault?.();
      pressTimer = setTimeout(() => {
        // confirm deletion
        const ok = confirm(`Excluir conversa "${conv.title || 'Nova conversa'}"?`);
        if (ok) {
          conversations = conversations.filter(c => c.id !== conv.id);
          if (activeId === conv.id) activeId = conversations[0] ? conversations[0].id : null;
          save();
          renderSidebar();
          renderChat();
        }
      }, 700);
    };
    const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; };

    el.addEventListener("touchstart", startPress);
    el.addEventListener("touchend", cancelPress);
    el.addEventListener("mousedown", startPress);
    el.addEventListener("mouseup", cancelPress);
    el.addEventListener("mouseleave", cancelPress);
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      // fallback: open confirm
      const ok = confirm(`Excluir conversa "${conv.title || 'Nova conversa'}"?`);
      if (ok) {
        conversations = conversations.filter(c => c.id !== conv.id);
        if (activeId === conv.id) activeId = conversations[0] ? conversations[0].id : null;
        save();
        renderSidebar();
        renderChat();
      }
    });

    sidebarList.appendChild(el);
  });
}

/* render chat messages */
function renderChat() {
  chatEl.innerHTML = "";
  const conv = activeConv();
  if (!conv) return;
  conv.messages.forEach((m, idx) => {
    const node = document.createElement("div");
    node.className = "message " + (m.role === "user" ? "user" : "");
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<div>${m.role === "user" ? "Você" : "Assistente"}</div><div class="small">${m.ts ? now(m.ts) : ""}</div>`;

    const content = document.createElement("div");
    content.className = "content";
    content.innerText = m.content;

    node.appendChild(meta);
    node.appendChild(content);

    // actions
    const actions = document.createElement("div");
    actions.className = "actions";
    const copyBtn = document.createElement("button");
    copyBtn.className = "btn tiny copy";
    copyBtn.innerText = "Copiar";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(m.content).then(()=> {
        const old = copyBtn.innerText;
        copyBtn.innerText = "Copiado";
        setTimeout(()=> copyBtn.innerText = old, 1000);
      });
    };

    const delBtn = document.createElement("button");
    delBtn.className = "btn tiny del";
    delBtn.innerText = "Excluir";
    delBtn.onclick = () => {
      conv.messages.splice(idx, 1);
      save();
      renderChat();
    };

    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);
    node.appendChild(actions);

    chatEl.appendChild(node);
  });

  // if no messages show placeholder big (make UI not look empty)
  if (conv.messages.length === 0) {
    const p = document.createElement("div");
    p.className = "message";
    p.style.opacity = "0.6";
    p.innerText = "Comece a conversa — escreva algo no campo abaixo.";
    chatEl.appendChild(p);
  }

  chatEl.scrollTop = chatEl.scrollHeight;
}

/* typing UI */
function showTyping(){ typingEl.classList.remove("hidden"); typingEl.style.display = "flex"; chatEl.scrollTop = chatEl.scrollHeight; }
function hideTyping(){ typingEl.classList.add("hidden"); typingEl.style.display = "none"; }

/* streaming UI toggle */
function setStreaming(on) {
  streaming = !!on;
  if (on) {
    stopBtn && stopBtn.classList.remove("hidden");
    sendBtn && (sendBtn.disabled = true);
  } else {
    stopBtn && stopBtn.classList.add("hidden");
    sendBtn && (sendBtn.disabled = false);
    controller = null;
  }
}

/* parse stream chunk: handles OpenAI-style SSE lines and returns tokens */
function parseChunk(raw) {
  const tokens = [];
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const payload = line.replace(/^data:\s*/, "");
    if (payload === "[DONE]") { tokens.push("[DONE]"); continue; }
    try {
      const obj = JSON.parse(payload);
      // prefer delta.content (chat completions)
      const delta = obj?.choices?.[0]?.delta?.content;
      const text = obj?.choices?.[0]?.text;
      const alt = obj?.output_text || obj?.content || null;
      if (delta) tokens.push(delta);
      else if (text) tokens.push(text);
      else if (alt) tokens.push(alt);
    } catch (e) {
      // ignore invalid JSON lines
    }
  }
  return tokens;
}

/* helper: fallback to parse JSON-responses (non-streaming backends) */
async function handleJsonResponse(res, conv, assistantIndex) {
  // try to read as json
  let data;
  try { data = await res.json(); } catch (e) { 
    const txt = await res.text().catch(()=>null);
    conv.messages[assistantIndex].content = `Resposta inválida do servidor: ${txt || 'sem conteúdo'}`;
    save(); renderChat();
    return;
  }

  // try different fields
  let reply = null;
  if (data.reply) reply = data.reply;
  else if (data.choices && Array.isArray(data.choices) && data.choices[0]?.message?.content) reply = data.choices[0].message.content;
  else if (data.choices && Array.isArray(data.choices) && data.choices[0]?.text) reply = data.choices[0].text;
  else if (typeof data === "string") reply = data;

  if (reply === null) {
    conv.messages[assistantIndex].content = "Resposta do servidor sem campo de texto esperado.";
    save(); renderChat();
    return;
  }

  // show with typing effect so it feels natural & ensures completion
  await typeWriteAssistant(conv, assistantIndex, reply);
}

/* Typewriter for fallback (ensures full sentence displayed) */
function typeWriteAssistant(conv, assistantIndex, fullText, speed = 12) {
  return new Promise(resolve => {
    let i = 0;
    conv.messages[assistantIndex].content = "";
    save(); renderChat();
    const interval = setInterval(()=> {
      conv.messages[assistantIndex].content += fullText[i] || "";
      i++;
      // update UI (lightweight: full render)
      save(); renderChat();
      chatEl.scrollTop = chatEl.scrollHeight;
      if (i >= fullText.length) {
        clearInterval(interval);
        resolve();
      }
    }, speed);
  });
}

/* SEND MESSAGE with streaming & fallback support */
async function sendMessage(text) {
  if (!text || streaming) return;
  const conv = activeConv();
  if (!conv) return;

  // add user message
  conv.messages.push({ role: "user", content: text, ts: Date.now() });
  if (!conv.title || conv.title === "Nova conversa") conv.title = text.slice(0, 40);
  save(); renderSidebar(); renderChat();

  // add placeholder assistant
  conv.messages.push({ role: "assistant", content: "", ts: Date.now() });
  const assistantIndex = conv.messages.length - 1;
  save(); renderChat();

  // start streaming attempt
  controller = new AbortController();
  setStreaming(true);
  showTyping();

  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conv.messages.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }))
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const txt = await res.text().catch(()=>res.statusText);
      conv.messages[assistantIndex].content = `Erro do servidor: ${res.status} ${txt}`;
      save(); renderChat(); setStreaming(false); hideTyping();
      return;
    }

    const contentType = res.headers.get("content-type") || "";
    // if server returns SSE or chunked text, use streaming parsing
    if (contentType.includes("text/event-stream") || res.body) {
      // try streaming reader
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = conv.messages[assistantIndex].content || "";

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) { done = true; break; }
        const chunk = decoder.decode(value, { stream: true });
        // parse chunk into tokens (handles data: JSON lines)
        const tokens = parseChunk(chunk);
        for (const t of tokens) {
          if (t === "[DONE]") { done = true; break; }
          accumulated += t;
          conv.messages[assistantIndex].content = accumulated;
          save();
          // update UI
          renderChat();
          chatEl.scrollTop = chatEl.scrollHeight;
        }
      }

      // finalize: if stream ended but we still have result, done.
      setStreaming(false);
      hideTyping();
      save();
      renderChat();
      return;
    } else {
      // fallback: server returned JSON but maybe not stream
      await handleJsonResponse(res, conv, assistantIndex);
      setStreaming(false);
      hideTyping();
      save();
      renderChat();
      return;
    }

  } catch (err) {
    // abort vs other error
    if (err.name === "AbortError") {
      conv.messages[assistantIndex].content += "\n\n(geração interrompida)";
    } else {
      conv.messages[assistantIndex].content = "Erro de conexão com o servidor.";
    }
    save(); renderChat();
    setStreaming(false);
    hideTyping();
  }
}

/* UI event bindings */
btnNewChat.addEventListener("click", ()=> {
  const id = uid();
  const conv = { id, title: "Nova conversa", createdAt: Date.now(), messages: [] };
  conversations.unshift(conv);
  activeId = id;
  save();
  renderSidebar();
  renderChat();
});

sendBtn.addEventListener("click", ()=> {
  const t = inputEl.value.trim();
  if (!t) return;
  inputEl.value = "";
  sendMessage(t);
});

stopBtn && stopBtn.addEventListener("click", ()=> {
  if (controller) controller.abort();
  setStreaming(false);
  hideTyping();
});

inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const t = inputEl.value.trim();
    if (!t) return;
    inputEl.value = "";
    sendMessage(t);
  }
});

/* export conv */
exportBtn && exportBtn.addEventListener("click", ()=> {
  const conv = activeConv();
  if (!conv) return alert("Nenhuma conversa ativa");
  const blob = new Blob([JSON.stringify(conv, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${(conv.title||'conversa').replace(/\s+/g,'_')}.json`; a.click(); a.remove();
});

/* theme toggle */
themeToggle && themeToggle.addEventListener("click", ()=> {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
});
if (localStorage.getItem("theme")==="light") document.body.classList.add("light");

/* init */
ensureConversation();
if (!activeId) activeId = conversations[0].id;
renderSidebar();
renderChat();
