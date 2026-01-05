// script.js
const BACKEND_URL = "https://chat-ia-backend-6jgj.onrender.com/chat"; // substitua com seu backend se diferente

const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const form = document.getElementById("form");

function addMessage(text, cls="bot", opts={typing:false}) {
  const d = document.createElement("div");
  d.className = "msg " + cls + (opts.typing ? " typing" : "");
  d.innerText = text;
  chatEl.appendChild(d);
  chatEl.scrollTop = chatEl.scrollHeight;
  return d;
}

async function sendMessage(text) {
  // add user message
  addMessage(text, "user");
  // add typing placeholder
  const placeholder = addMessage("Digitando...", "bot", {typing: true});

  // try streaming
  try {
    const res = await fetch(BACKEND_URL + "?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "text/plain" },
      body: JSON.stringify({ message: text })
    });

    if (!res.ok) {
      // try fallback to non-stream JSON path
      const json = await res.json().catch(()=>null);
      placeholder.remove();
      if (json?.error) {
        addMessage("❌ " + json.error, "bot");
      } else if (json?.reply) {
        addMessage(json.reply, "bot");
      } else {
        addMessage("❌ Erro ao gerar resposta", "bot");
      }
      return;
    }

    // Read stream from response
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    placeholder.innerText = ""; // clear placeholder text while streaming
    placeholder.classList.remove("typing");

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // append chunk to placeholder
      accumulated += chunk;
      placeholder.innerText = accumulated;
      chatEl.scrollTop = chatEl.scrollHeight;
    }
    // finalize
    placeholder.classList.remove("typing");
  } catch (err) {
    placeholder.remove();
    console.error("sendMessage error:", err);
    addMessage("❌ Erro de conexão com o servidor", "bot");
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = "";
  sendMessage(text);
});

// Enter to send
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});
