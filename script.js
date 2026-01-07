const BACKEND_URL = "https://chat-ia-backend-sow2.onrender.com/chat";

const chatEl = document.getElementById("chat");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const historyEl = document.getElementById("history");
const typingEl = document.getElementById("typing");

let chats = JSON.parse(localStorage.getItem("chats") || "[]");
let currentChat = null;

/* 🔁 SALVAR */
function save(){
  localStorage.setItem("chats", JSON.stringify(chats));
}

/* 🆕 NOVO CHAT */
function newChat(){
  const chat = {
    id: Date.now(),
    title: "Nova conversa",
    messages: []
  };
  chats.unshift(chat);
  currentChat = chat;
  save();
  render();
}

/* 🧾 RENDER */
function render(){
  historyEl.innerHTML = "";
  chats.forEach(c=>{
    const div = document.createElement("div");
    div.className = "chat-item" + (c===currentChat?" active":"");
    div.innerText = c.title;
    div.onclick = ()=>{ currentChat=c; render(); };
    historyEl.appendChild(div);
  });

  chatEl.innerHTML = "";
  if(!currentChat) return;

  currentChat.messages.forEach(m=>{
    const d = document.createElement("div");
    d.className = "msg " + m.role;
    d.innerText = m.text;
    chatEl.appendChild(d);
  });
}

/* ✉️ ENVIAR */
async function send(){
  if(!currentChat) newChat();
  const text = input.value.trim();
  if(!text) return;

  currentChat.messages.push({role:"user", text});
  if(currentChat.messages.length===1)
    currentChat.title = text.slice(0,20);

  input.value="";
  render();

  typingEl.classList.remove("hidden");

  try{
    const res = await fetch(BACKEND_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message:text})
    });
    const data = await res.json();

    typingEl.classList.add("hidden");

    currentChat.messages.push({role:"bot", text:data.reply || "Erro"});
    save();
    render();
  }catch{
    typingEl.classList.add("hidden");
  }
}

/* 🌗 TEMA */
function toggleTheme(){
  document.body.classList.toggle("light");
  localStorage.setItem("theme",
    document.body.classList.contains("light")?"light":"dark"
  );
}

if(localStorage.getItem("theme")==="light")
  document.body.classList.add("light");

sendBtn.onclick = send;
input.addEventListener("keydown",e=>{
  if(e.key==="Enter" && !e.shiftKey){
    e.preventDefault();
    send();
  }
});

if(!chats.length) newChat();
else { currentChat = chats[0]; render(); }
