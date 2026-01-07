const BACKEND_URL = "https://chat-ia-backend-sow2.onrender.com/chat";

const input = document.getElementById("input");
const messages = document.getElementById("messages");
const sendBtn = document.getElementById("sendBtn");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");

menuToggle.onclick = () => {
  sidebar.classList.toggle("open");
};

function addMessage(text, cls) {
  const div = document.createElement("div");
  div.className = `msg ${cls}`;
  div.innerText = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();
    addMessage(data.reply || "Erro ao responder.", "bot");
  } catch {
    addMessage("Erro de conexão.", "bot");
  }
}

sendBtn.onclick = sendMessage;

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
