// Servidor sin dependencias externas (solo Node 18+).
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SYSTEM_PROMPT, NAME } from "./persona.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MOCK = process.env.MOCK === "1";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json",
};

// Límite simple por IP (memoria). Sustituir por límite por usuario cuando haya login/pagos.
const hits = new Map();
const WINDOW_MS = 60_000, MAX_PER_WINDOW = 12;
function limited(req) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now); hits.set(ip, recent);
  return false;
}

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return [];
  const msgs = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-20);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

const send = (res, status, obj) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
};

function readBody(req, max = 50_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > max) { reject(new Error("too big")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

async function chat(req, res) {
  if (limited(req)) return send(res, 429, { error: "Vas muy rápido, dame un momentito." });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: "Solicitud inválida." }); }
  const messages = cleanMessages(body?.messages);
  if (!messages.length || messages.at(-1).role !== "user") return send(res, 400, { error: "Mensaje inválido." });

  if (MOCK) {
    return send(res, 200, { reply: `Modo de prueba: te escuché decir "${messages.at(-1).content.slice(0, 80)}". Cuando pongas tu llave de API, responderé de verdad.` });
  }
  if (!API_KEY) return send(res, 500, { error: "Falta configurar ANTHROPIC_API_KEY en el servidor." });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system: SYSTEM_PROMPT, messages }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("Error de la API:", r.status, JSON.stringify(data));
      const detail = `${r.status} ${data?.error?.type || ""}: ${data?.error?.message || "sin detalle"}`.slice(0, 200);
      return send(res, 502, { error: "No pude pensar en este momento, intenta de nuevo.", detail });
    }
    const reply = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    send(res, 200, { reply });
  } catch (e) {
    console.error(e);
    send(res, 502, { error: "Problema de conexión con el cerebro de la asistente." });
  }
}

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  try {
    const data = await fs.readFile(file);
    const headers = { "content-type": TYPES[path.extname(file)] || "application/octet-stream" };
    if (rel === "/sw.js") headers["cache-control"] = "no-cache"; // el SW nunca se cachea
    res.writeHead(200, headers); res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); res.end("No encontrado");
  }
}

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://x");
  if (req.method === "POST" && pathname === "/api/chat") return chat(req, res);
  if (req.method === "GET" && pathname === "/api/config") return send(res, 200, { name: NAME });
  if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res, pathname);
  res.writeHead(405); res.end();
}).listen(PORT, () => console.log(`Asistente en http://localhost:${PORT} (${MOCK ? "modo prueba" : MODEL})`));
