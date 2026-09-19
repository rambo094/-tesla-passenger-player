import express from "express";
import { WebSocketServer } from "ws";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

function ytAllowed(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

function resolveMedia(url) {
  return new Promise((resolve, reject) => {
    if (!ytAllowed(url)) {
      return reject(new Error("Only YouTube URLs are allowed"));
    }

    // Current yt-dlp YouTube extraction requires yt-dlp-ejs plus a JS
    // runtime. The image contains Node 22 and yt-dlp[default].
    const args = [
      "--no-warnings",
      "--no-playlist",
      "--js-runtimes", "node",
      "--extractor-args", "youtube:player_client=web",
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "-g",
      url
    ];

    const p = spawn("yt-dlp", args);
    let out = "";
    let err = "";

    p.stdout.on("data", d => { out += d; });
    p.stderr.on("data", d => { err += d; });

    p.on("error", e => reject(e));

    p.on("close", code => {
      if (code !== 0 || !out.trim()) {
        return reject(new Error(
          err.trim() ||
          `yt-dlp failed with exit code ${code}`
        ));
      }

      const parts = out.trim().split(/\r?\n/).filter(Boolean);

      if (!parts[0]) {
        return reject(new Error("No media URL returned by YouTube"));
      }

      resolve({
        video: parts[0],
        audio: parts[1] || parts[0]
      });
    });
  });
}

app.get("/resolve", async (req, res) => {
  try {
    const m = await resolveMedia(req.query.url);
    res.json({
      audio: `/audio?src=${encodeURIComponent(m.audio)}`
    });
  } catch (e) {
    console.error("Resolve error:", e.message);
    res.status(400).json({ error: e.message });
  }
});

app.get("/audio", (req, res) => {
  try {
    const src = new URL(req.query.src);
    if (!["http:", "https:"].includes(src.protocol)) throw new Error();

    const ff = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error",
      "-i", src.toString(),
      "-vn",
      "-c:a", "libmp3lame",
      "-b:a", "96k",
      "-f", "mp3",
      "pipe:1"
    ]);

    res.setHeader("Content-Type", "audio/mpeg");
    ff.stdout.pipe(res);

    ff.stderr.on("data", d => {
      console.error("ffmpeg audio:", d.toString());
    });

    req.on("close", () => ff.kill("SIGTERM"));
  } catch {
    res.status(400).end();
  }
});

const server = app.listen(process.env.PORT || 8080, () => {
  console.log(`Listening on ${process.env.PORT || 8080}`);
});

const wss = new WebSocketServer({
  server,
  path: "/ws/mpeg1"
});

wss.on("connection", (ws, req) => {
  const q = new URL(req.url, "http://localhost").searchParams;
  const url = q.get("url");
  const quality = q.get("quality") || "720";

  const scales = {
    360: "640:360",
    480: "854:480",
    720: "1280:720",
    1080: "1920:1080"
  };

  const scale = scales[quality] || scales[720];

  resolveMedia(url).then(m => {
    const bitrate =
      quality === "1080" ? "3000k" :
      quality === "720" ? "1800k" :
      "900k";

    const ff = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error",
      "-re",
      "-i", m.video,
      "-vf", `scale=${scale}`,
      "-an",
      "-c:v", "mpeg1video",
      "-b:v", bitrate,
      "-r", "30",
      "-f", "mpeg1video",
      "pipe:1"
    ]);

    ff.stdout.on("data", chunk => {
      if (ws.readyState === ws.OPEN) {
        ws.send(chunk);
      }
    });

    ff.stderr.on("data", d => {
      console.error("ffmpeg video:", d.toString());
    });

    ff.on("close", () => {
      if (ws.readyState === ws.OPEN) ws.close();
    });

    ws.on("close", () => {
      ff.kill("SIGTERM");
    });
  }).catch(err => {
    console.error("Video resolve error:", err.message);
    if (ws.readyState === ws.OPEN) {
      ws.close(1011, "Could not resolve YouTube media");
    }
  });
});
