const BACKEND_URL = "https://chat-ia-backend-pfmu.onrender.com/chat";

const chat = document.getElementById("chat");
const input = document.getElementById("input");

function add(text, cls) {
  const div = document.createElement("div");
  div.className = "msg " + cls;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

async function send() {
  const text = input.value.trim();
  if (!text) return;

  add(text, "user");
  input.value = "";

  const bot = add("", "bot");

  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      bot.innerText += decoder.decode(value);
      chat.scrollTop = chat.scrollHeight;
    }

  } catch {
    bot.innerText = "Erro ao responder ❌";
  }
}

input.addEventListener("keydown", e => {
  if (e.key === "Enter") send();
});
