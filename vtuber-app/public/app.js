const $ = (id) => document.getElementById(id);
const log = $("log"), form = $("form"), input = $("text"), mic = $("mic");
const avatar = $("avatar"), mouth = $("mouth"), statusEl = $("status"), voiceOn = $("voiceOn");

let history = [];
try { history = JSON.parse(localStorage.getItem("hist") || "[]"); } catch {}
const save = () => { try { localStorage.setItem("hist", JSON.stringify(history.slice(-20))); } catch {} };

function setState(state, text) {
  avatar.classList.remove("idle", "listening", "thinking", "speaking");
  avatar.classList.add(state);
  statusEl.textContent = text;
}
const idle = () => setState("idle", "Lista para platicar");

function addMsg(role, text) {
  const d = document.createElement("div");
  d.className = `msg ${role}`;
  d.textContent = text;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}
history.forEach((m) => addMsg(m.role === "user" ? "user" : "bot", m.content));

fetch("/api/config").then((r) => r.json()).then((c) => {
  $("name").textContent = c.name; document.title = c.name;
  if (!history.length) addMsg("bot", `¡Hola! Soy ${c.name}. Escríbeme o toca el micrófono para platicar.`);
}).catch(() => {});

// ---------- Voz: salida ----------
let mouthTimer = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => /es[-_]MX/i.test(v.lang)) || voices.find((v) => /^es/i.test(v.lang)) || null;
}
function speak(text) {
  return new Promise((resolve) => {
    if (!voiceOn.checked || !("speechSynthesis" in window)) return resolve();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang || "es-MX";
    u.pitch = 1.15; u.rate = 1.02;
    const stop = () => { clearInterval(mouthTimer); mouth.setAttribute("ry", 3); resolve(); };
    u.onstart = () => {
      setState("speaking", "Hablando…");
      mouthTimer = setInterval(() => mouth.setAttribute("ry", 3 + Math.random() * 9), 110);
    };
    u.onend = stop; u.onerror = stop;
    speechSynthesis.speak(u);
  });
}
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => {};

// ---------- Chat ----------
let busy = false;
async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  busy = true;
  speechSynthesis?.cancel();
  addMsg("user", text);
  history.push({ role: "user", content: text });
  setState("thinking", "Pensando…");
  try {
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-20) }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Error");
    addMsg("bot", data.reply);
    history.push({ role: "assistant", content: data.reply });
    save();
    await speak(data.reply);
  } catch (e) {
    history.pop();
    addMsg("err", navigator.onLine ? e.message : "Sin internet. Necesito conexión para platicar.");
  } finally {
    busy = false; idle();
  }
}
form.addEventListener("submit", (e) => { e.preventDefault(); const t = input.value; input.value = ""; send(t); });

// ---------- Voz: entrada ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
if (!SR) { mic.hidden = true; } else {
  rec = new SR();
  rec.lang = "es-MX"; rec.interimResults = true; rec.continuous = false;
  let finalText = "";
  rec.onstart = () => { listening = true; mic.classList.add("rec"); setState("listening", "Te escucho…"); finalText = ""; };
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t; else interim += t;
    }
    input.value = finalText + interim;
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed") addMsg("err", "Permite el micrófono en el navegador para poder hablar.");
  };
  rec.onend = () => {
    listening = false; mic.classList.remove("rec");
    const t = (finalText || input.value).trim(); input.value = "";
    if (t) send(t); else if (!busy) idle();
  };
  mic.addEventListener("click", () => {
    if (listening) { rec.stop(); return; }
    speechSynthesis?.cancel();
    try { rec.start(); } catch {}
  });
}

// ---------- PWA ----------
if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(console.error));
}
let deferred = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); deferred = e; $("install").hidden = false;
});
$("install").addEventListener("click", async () => {
  if (!deferred) return;
  deferred.prompt(); await deferred.userChoice; deferred = null; $("install").hidden = true;
});
addEventListener("appinstalled", () => { $("install").hidden = true; });
