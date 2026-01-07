/* Frontend completo: modal + sidebar + chats + streaming parse + stop + theme
   - Troque BACKEND_URL para a URL do seu backend se necessário
   - Histórico salvo em localStorage
*/

const BACKEND_URL = "https://chat-ia-backend-sow2.onrender.com/chat"; // <--- editar se necessário

/* DOM */
const sidebarList = document.getElementById("sidebarList");
const btnNewChat = document.getElementById("btnNewChat");
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");
const typingEl = document.getElementById("typing");
const openModal = document.getElementById("openModal");
const chatModal = document.getElementById("chatModal");
const modalList = document.getElementById("modalList");
const modalNew = document.getElementById("modalNew");
const closeModal = document.getElementById("closeModal");
const themeToggle = document.getElementById("themeToggle");
const exportBtn = document.getElementById("exportBtn");

/* State */
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

/* ensure there is a conv */
function ensureConversation() {
  if (!conversations || conversations.length === 0) {
    const id = uid();
    const conv = { id, title: "Nova conversa", createdAt: Date.now(), messages: [] };
    conversations.unshift(conv);
    activeId = id;
    save();
  }
}

/* find active conv */
function activeConv() {
  return conversations.find(c => c.id === activeId) || conversations[0];
}

/* render sidebar */
function renderSidebar() {
  sidebarList.innerHTML = "";
  conversations.forEach(conv => {
    const el = document.createElement("div");
    el.className = "conv-item" + (conv.id === activeId ? " active" : "");
    el.innerText = conv.title || (conv.messages[0] ? conv.messages[0].content.slice(0,30) : "Nova conversa");
    el.onclick = () => { activeId = conv.id; save(); renderSidebar(); renderChat(); };
    sidebarList.appendChild(el);
  });
}

/* render chat */
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
      navigator.clipboard.writeText(m.content).then(()=> copyBtn.innerText = "Copiado").finally(()=> setTimeout(()=>copyBtn.innerText="Copiar",1000));
    };
    const delBtn = document.createElement("button");
    delBtn.className = "btn tiny del";
    delBtn.innerText = "Excluir";
    delBtn.onclick = () => {
      conv.messages.splice(idx,1);
      save();
      renderChat();
    };
    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);
    node.appendChild(actions);

    chatEl.appendChild(node);
  });
  chatEl.scrollTop = chatEl.scrollHeight;
}

/* show/hide typing */
function showTyping(){ typingEl.classList.remove("hidden"); typingEl.style.display = "flex"; chatEl.scrollTop = chatEl.scrollHeight; }
function hideTyping(){ typingEl.classList.add("hidden"); typingEl.style.display = "none"; }

/* toggle streaming UI */
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

/* parse SSE-like stream chunks and return token array */
function parseChunk(raw) {
  const tokens = [];
  const lines = raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const payload = line.replace(/^data:\s*/, "");
    if (payload === "[DONE]") { tokens.push("[DONE]"); continue; }
    try {
      const obj = JSON.parse(payload);
      const delta = obj?.choices?.[0]?.delta?.content;
      const text = obj?.choices?.[0]?.text;
      const alt = obj?.output_text;
      if (delta) tokens.push(delta);
      else if (text) tokens.push(text);
      else if (alt) tokens.push(alt);
    } catch (e) {
      // ignore
    }
  }
  return tokens;
}

/* SEND with streaming */
async function sendMessage(text) {
  if (!text || streaming) return;
  const conv = activeConv();
  if (!conv) return;

  // add user message
  conv.messages.push({ role: "user", content: text, ts: Date.now() });
  if (!conv.title || conv.title === "Nova conversa") conv.title = text.slice(0, 40);
  save();
  renderSidebar();
  renderChat();

  // placeholder assistant
  conv.messages.push({ role: "assistant", content: "", ts: Date.now() });
  const assistantIndex = conv.messages.length - 1;
  save();
  renderChat();

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
      const txt = await res.text().catch(()=>res.statusText);
      conv.messages[assistantIndex].content = `Erro do servidor: ${res.status} ${txt}`;
      save(); renderChat(); setStreaming(false); hideTyping();
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let accum = conv.messages[assistantIndex].content || "";

    while (!done) {
      const { value, done: d } = await reader.read();
      if (d) { done = true; break; }
      const chunk = decoder.decode(value, { stream: true });
      const tokens = parseChunk(chunk);
      for (const t of tokens) {
        if (t === "[DONE]") { done = true; break; }
        accum += t;
        conv.messages[assistantIndex].content = accum;
        save();
        // Update last message only for performance — here we re-render for simplicity
        renderChat();
        showTyping();
      }
    }

    setStreaming(false);
    hideTyping();
    save();
    renderChat();

  } catch (err) {
    if (err.name === "AbortError") {
      conv.messages[assistantIndex].content += "\n\n(geração interrompida)";
    } else {
      conv.messages[assistantIndex].content = "Erro de conexão com o servidor.";
    }
    save();
    renderChat();
    setStreaming(false);
    hideTyping();
  }
}

/* UI: open modal */
openModal && openModal.addEventListener("click", ()=> {
  populateModal();
  chatModal.classList.remove("hidden");
});
closeModal && closeModal.addEventListener("click", ()=> chatModal.classList.add("hidden"));

/* modal list population */
function populateModal() {
  modalList.innerHTML = "";
  conversations.forEach(conv => {
    const item = document.createElement("div");
    item.className = "modal-item";
    item.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div>${conv.title || 'Nova conversa'}</div><div class="small">${new Date(conv.createdAt).toLocaleDateString()}</div></div>`;
    item.onclick = () => { activeId = conv.id; save(); chatModal.classList.add("hidden"); renderSidebar(); renderChat(); };
    modalList.appendChild(item);
  });
}

/* create new conv both modal and sidebar */
function createNewConversation() {
  const id = uid();
  const conv = { id, title: "Nova conversa", createdAt: Date.now(), messages: [] };
  conversations.unshift(conv);
  activeId = id;
  save();
  renderSidebar();
  renderChat();
}

/* events */
btnNewChat.addEventListener("click", createNewConversation);
modalNew && modalNew.addEventListener("click", createNewConversation);
document.getElementById("modalRefresh")?.addEventListener("click", populateModal);

/* send/stop handlers */
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

/* enter key */
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
renderSidebar();
if (!activeId) activeId = conversations[0].id;
renderSidebar();
renderChat();
