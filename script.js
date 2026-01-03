const BACKEND_URL = "https://chat-ia-backend-vk9r.onrender.com/chat";

const chat = document.getElementById("chat");
const input = document.getElementById("input");

function addMsg(text, type) {
  const div = document.createElement("div");
  div.className = `msg ${type}`;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function enviar() {
  const msg = input.value.trim();
  if (!msg) return;

  addMsg(msg, "user");
  input.value = "";

  fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg })
  })
    .then(r => r.json())
    .then(d => addMsg(d.reply || "Erro", "bot"))
    .catch(() => addMsg("Erro de conexão", "bot"));
}
