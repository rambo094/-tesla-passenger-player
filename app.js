const setup = document.getElementById("setup");
const player = document.getElementById("player");
const canvas = document.getElementById("videoCanvas");
const audio = document.getElementById("audio");
const status = document.getElementById("status");
let ws, playerObj;

document.getElementById("start").onclick = async () => {
  const url = document.getElementById("url").value.trim();
  const quality = document.getElementById("quality").value;
  if (!url) return;

  setup.hidden = true;
  player.hidden = false;
  status.textContent = "Risoluzione video…";

  try {
    const r = await fetch(`/resolve?url=${encodeURIComponent(url)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Errore");

    audio.src = data.audio;
    audio.play().catch(() => {});
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}/ws/mpeg1?url=${encodeURIComponent(url)}&quality=${quality}`);
    ws.binaryType = "arraybuffer";

    playerObj = new JSMpeg.Player(ws, {
      canvas, autoplay: true, audio: false,
      videoBufferSize: 512 * 1024
    });
    ws.onopen = () => status.textContent = "Video attivo";
    ws.onerror = () => status.textContent = "Errore WebSocket";
    ws.onclose = () => status.textContent = "Connessione chiusa";
  } catch (e) {
    status.textContent = e.message;
  }
};

document.getElementById("fs").onclick = async () => {
  try {
    if (player.requestFullscreen) await player.requestFullscreen();
  } catch {}
};

document.getElementById("stop").onclick = () => location.reload();
