const BACKEND_URL = "https://chat-ia-backend-sow2.onrender.com/chat";

const chat = document.getElementById("chat");
const input = document.getElementById("input");

let messages = JSON.parse(localStorage.getItem("history")) || [];

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
  messages.push({ role: "user", content: text });
  input.value = "";

  const botDiv = add("", "bot");

  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let botText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;

      const data = line.replace("data:", "").trim();
      if (data === "end") break;

      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          botText += delta;
          botDiv.innerText = botText;
          chat.scrollTop = chat.scrollHeight;
        }
      } catch {}
    }
  }

  messages.push({ role: "assistant", content: botText });
  localStorage.setItem("history", JSON.stringify(messages));
}
