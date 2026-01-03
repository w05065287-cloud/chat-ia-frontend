const BACKEND_URL = "https://chat-ia-backend-vpk9.onrender.com/chat";

const chat = document.getElementById("chat");
const input = document.getElementById("input");

function add(text, cls) {
  const div = document.createElement("div");
  div.className = "msg " + cls;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function send() {
  const text = input.value.trim();
  if (!text) return;

  add(text, "user");
  input.value = "";

  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    if (data.reply) {
      add(data.reply, "bot");
    } else {
      add("Erro ao gerar resposta", "bot");
    }

  } catch {
    add("Erro de conexão com o servidor", "bot");
  }
}
