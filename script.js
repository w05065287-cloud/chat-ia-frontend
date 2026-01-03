const BACKEND = "https://chat-ia-backend-vk9r.onrender.com/chat";

const messages = document.getElementById("messages");
const input = document.getElementById("input");

function add(text, type) {
  const div = document.createElement("div");
  div.className = "msg " + type;
  div.innerText = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function enviar() {
  const msg = input.value.trim();
  if (!msg) return;

  add(msg, "user");
  input.value = "";

  fetch(BACKEND, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg })
  })
  .then(r => r.json())
  .then(d => add(d.reply, "bot"))
  .catch(() => add("❌ Erro ao conectar no backend", "bot"));
}
