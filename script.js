const BACKEND_URL = "https://chat-ia-backend-vk9r.onrender.com/chat";

const chat = document.getElementById("chat");
const input = document.getElementById("input");

function adicionarMensagem(texto, classe) {
  const div = document.createElement("div");
  div.className = `msg ${classe}`;
  div.innerText = texto;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function enviar() {
  const pergunta = input.value.trim();
  if (!pergunta) return;

  adicionarMensagem(pergunta, "user");
  input.value = "";

  fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: pergunta })
  })
    .then(res => res.json())
    .then(data => {
      if (data.reply) {
        adicionarMensagem(data.reply, "bot");
      } else {
        adicionarMensagem("Erro ao gerar resposta", "bot");
      }
    })
    .catch(() => {
      adicionarMensagem("Erro de conexão com o servidor", "bot");
    });
}
