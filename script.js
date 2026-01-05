const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const chat = document.getElementById("chat");

function addMessage(text, className) {
  const div = document.createElement("div");
  div.className = `message ${className}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function showTyping() {
  const div = document.createElement("div");
  div.className = "message bot typing";
  div.innerHTML = `
    <span></span>
    <span></span>
    <span></span>
  `;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function typeText(element, text, speed = 20) {
  element.textContent = "";
  let i = 0;

  const interval = setInterval(() => {
    element.textContent += text.charAt(i);
    i++;
    chat.scrollTop = chat.scrollHeight;

    if (i >= text.length) {
      clearInterval(interval);
    }
  }, speed);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  addMessage(userMessage, "user");
  input.value = "";

  const typing = showTyping();

  try {
    const response = await fetch("https://chat-ia-backend-6jgj.onrender.com/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: userMessage })
    });

    const data = await response.json();

    typing.remove();

    const botMsg = addMessage("", "bot");
    typeText(botMsg, data.reply || "Erro ao responder.");

  } catch (err) {
    typing.remove();
    addMessage("Erro ao conectar ao servidor.", "bot");
  }
});
