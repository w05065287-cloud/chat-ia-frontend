const API_URL = "https://chat-ia-backend-sow2.onrender.com/chat";

let chats = JSON.parse(localStorage.getItem("chats")) || [];
let chatAtual = null;

const chatList = document.getElementById("chatList");
const messages = document.getElementById("messages");
const input = document.getElementById("input");
const typing = document.getElementById("typing");

function salvar() {
  localStorage.setItem("chats", JSON.stringify(chats));
}

function novoChat() {
  const chat = {
    id: Date.now(),
    titulo: "Nova conversa",
    mensagens: []
  };
  chats.unshift(chat);
  chatAtual = chat.id;
  salvar();
  renderChats();
  renderMensagens();
}

function renderChats() {
  chatList.innerHTML = "";
  chats.forEach(chat => {
    const li = document.createElement("li");
    li.textContent = chat.titulo;
    if (chat.id === chatAtual) li.classList.add("active");

    li.onclick = () => {
      chatAtual = chat.id;
      renderChats();
      renderMensagens();
    };

    // segurar para excluir (mobile)
    li.addEventListener("contextmenu", e => {
      e.preventDefault();
      if (confirm("Excluir este chat?")) {
        chats = chats.filter(c => c.id !== chat.id);
        salvar();
        chatAtual = chats[0]?.id || null;
        renderChats();
        renderMensagens();
      }
    });

    chatList.appendChild(li);
  });
}

function renderMensagens() {
  messages.innerHTML = "";
  const chat = chats.find(c => c.id === chatAtual);
  if (!chat) return;

  chat.mensagens.forEach(m => {
    const div = document.createElement("div");
    div.className = `message ${m.autor}`;
    div.textContent = m.texto;
    messages.appendChild(div);
  });

  messages.scrollTop = messages.scrollHeight;
}

async function enviar() {
  const texto = input.value.trim();
  if (!texto || !chatAtual) return;

  input.value = "";

  const chat = chats.find(c => c.id === chatAtual);

  chat.mensagens.push({ autor: "user", texto });

  if (chat.titulo === "Nova conversa") {
    chat.titulo = texto.slice(0, 30);
  }

  renderChats();
  renderMensagens();
  salvar();

  typing.style.display = "block";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: texto })
    });

    const data = await res.json();

    chat.mensagens.push({
      autor: "ai",
      texto: data.response || "Erro ao responder."
    });

  } catch {
    chat.mensagens.push({
      autor: "ai",
      texto: "Erro de conexão com o servidor."
    });
  }

  typing.style.display = "none";
  salvar();
  renderMensagens();
}

// iniciar
if (chats.length === 0) {
  novoChat();
} else {
  chatAtual = chats[0].id;
  renderChats();
  renderMensagens();
}
