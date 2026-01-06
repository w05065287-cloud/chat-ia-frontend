const BACKEND_URL = "https://chat-ia-backend-sow2.onrender.com/chat";

const chat = document.getElementById("chat");
const input = document.getElementById("input");

let messages = JSON.parse(localStorage.getItem("messages")) || [];

function save() {
  localStorage.setItem("messages", JSON.stringify(messages));
}

function add(text, cls) {
  const div = document.createElement("div");
  div.className = "msg " + cls;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function load() {
  messages.forEach(m => add(m.content, m.role === "user" ? "user" : "bot"));
}
load();

async function send() {
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  add(text, "user");
  messages.push({ role: "user", content: text });
  save();

  const botDiv = add("", "bot");
  messages.push({ role: "assistant", content: "" });

  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    botDiv.textContent += chunk;
    messages[messages.length - 1].content += chunk;
    chat.scrollTop = chat.scrollHeight;
    save();
  }
}

function clearChat() {
  if (confirm("Apagar conversa?")) {
    messages = [];
    save();
    chat.innerHTML = "";
  }
}
