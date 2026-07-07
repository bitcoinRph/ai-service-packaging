#!/usr/bin/env node
/**
 * OpenWhispr STT Server shim.
 *
 * Fronts whisper.cpp's `whisper-server` (loopback child process) with:
 *   - bearer-token auth (timing-safe, mirrors OpenWhispr's cliBridge)
 *   - OpenAI-compatible POST /v1/audio/transcriptions (+ /audio/transcriptions)
 *   - raw whisper.cpp POST /inference passthrough (OpenWhispr desktop LAN mode)
 *   - GET /health (unauthenticated readiness/status)
 *   - a mobile PWA recorder served from /app/web
 *   - GGML model download into MODELS_DIR on startup
 *
 * Zero npm dependencies: node:http, node:child_process, node:crypto only.
 */

"use strict";

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

// --- Configuration ---

const TOKEN = process.env.OW_TOKEN || "";
const MODEL = (process.env.OW_MODEL || "small").trim();
const PORT = parseInt(process.env.PORT, 10) || 8081;
const WHISPER_PORT = parseInt(process.env.WHISPER_PORT, 10) || 8178;
const MODELS_DIR = process.env.MODELS_DIR || "/data/models";
const LANGUAGE = process.env.OW_LANGUAGE || "auto";
const THREADS = process.env.WHISPER_THREADS || "";
const WHISPER_BIN = process.env.WHISPER_SERVER_BIN || "whisper-server";
const MODEL_BASE_URL =
  process.env.MODEL_BASE_URL ||
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";
const WEB_DIR = process.env.WEB_DIR || "/app/web";

const MAX_BODY_BYTES = 100 * 1024 * 1024; // 413 above this
const INFERENCE_TIMEOUT_MS = 300000;
const DOWNLOAD_PROGRESS_EVERY_BYTES = 50 * 1024 * 1024;

if (!TOKEN) {
  console.error("FATAL: OW_TOKEN is required");
  process.exit(1);
}
if (!/^[A-Za-z0-9._-]+$/.test(MODEL)) {
  console.error(`FATAL: invalid OW_MODEL "${MODEL}"`);
  process.exit(1);
}

// --- State ---

// status: downloading_model -> starting_whisper -> ok (or download_failed)
const state = {
  status: "downloading_model",
  model: MODEL,
  ready: false,
};

let whisperChild = null;
let shuttingDown = false;

function log(msg, extra) {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[openwhispr] ${msg}${suffix}`);
}

// --- Auth (timing-safe bearer compare, per OpenWhispr cliBridge.js) ---

const expectedAuth = Buffer.from(`Bearer ${TOKEN}`);

function isAuthorized(req) {
  const header = req.headers["authorization"] || "";
  const provided = Buffer.from(header);
  if (provided.length !== expectedAuth.length) return false;
  return crypto.timingSafeEqual(provided, expectedAuth);
}

function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

// --- Model download ---

function modelPath() {
  return path.join(MODELS_DIR, `ggml-${MODEL}.bin`);
}

async function downloadModel() {
  const dest = modelPath();
  if (fs.existsSync(dest)) {
    log(`model already present: ${dest}`);
    return;
  }
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  const url = `${MODEL_BASE_URL}/ggml-${MODEL}.bin`;
  const partial = `${dest}.partial`;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      log(`downloading model (attempt ${attempt}/5): ${url}`);
      const response = await fetch(url);
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }
      const out = fs.createWriteStream(partial);
      let written = 0;
      let nextProgress = DOWNLOAD_PROGRESS_EVERY_BYTES;
      for await (const chunk of response.body) {
        written += chunk.length;
        if (written >= nextProgress) {
          log(`model download progress: ${Math.round(written / 1048576)} MB`);
          nextProgress += DOWNLOAD_PROGRESS_EVERY_BYTES;
        }
        if (!out.write(chunk)) {
          await new Promise((resolve) => out.once("drain", resolve));
        }
      }
      await new Promise((resolve, reject) => {
        out.end((err) => (err ? reject(err) : resolve()));
      });
      fs.renameSync(partial, dest);
      log(`model downloaded: ${dest} (${Math.round(written / 1048576)} MB)`);
      return;
    } catch (err) {
      try {
        fs.unlinkSync(partial);
      } catch {}
      if (attempt === 5) throw err;
      const delay = 2000 * 2 ** (attempt - 1);
      log(`model download failed (${err.message}), retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// --- whisper-server child process ---

function whisperArgs() {
  const args = [
    "--model",
    modelPath(),
    "--host",
    "127.0.0.1",
    "--port",
    String(WHISPER_PORT),
    "--language",
    LANGUAGE,
  ];
  if (THREADS) args.push("--threads", String(THREADS));
  return args;
}

function spawnWhisper(restartDelayMs = 2000) {
  if (shuttingDown) return;
  state.status = "starting_whisper";
  state.ready = false;
  log(`starting whisper-server: ${WHISPER_BIN} ${whisperArgs().join(" ")}`);
  whisperChild = spawn(WHISPER_BIN, whisperArgs(), {
    stdio: ["ignore", "inherit", "inherit"],
  });
  whisperChild.on("error", (err) => {
    log(`whisper-server spawn error: ${err.message}`);
  });
  whisperChild.on("exit", (code, signal) => {
    whisperChild = null;
    state.ready = false;
    if (shuttingDown) return;
    state.status = "starting_whisper";
    const delay = Math.min(restartDelayMs, 30000);
    log(`whisper-server exited (code=${code} signal=${signal}), respawning in ${delay}ms`);
    setTimeout(() => spawnWhisper(delay * 2), delay);
  });
  pollWhisperReady();
}

function pollWhisperReady() {
  if (shuttingDown || !whisperChild) return;
  const req = http.request(
    { hostname: "127.0.0.1", port: WHISPER_PORT, path: "/", method: "GET", timeout: 3000 },
    (res) => {
      res.resume();
      if (!state.ready) {
        state.ready = true;
        state.status = "ok";
        log("whisper-server is ready");
      }
    },
  );
  req.on("error", () => setTimeout(pollWhisperReady, 1000));
  req.on("timeout", () => {
    req.destroy();
    setTimeout(pollWhisperReady, 1000);
  });
  req.end();
}

// --- Multipart parsing (strict, buffered) ---

function parseMultipart(body, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!match) return null;
  const boundary = `--${(match[1] || match[2]).trim()}`;
  const delimiter = Buffer.from(`\r\n${boundary}`);
  // Normalize: ensure body starts with CRLF so every part is CRLF-delimited
  const data = Buffer.concat([Buffer.from("\r\n"), body]);

  const fields = {};
  let file = null;
  let offset = data.indexOf(delimiter);
  while (offset !== -1) {
    const partStart = offset + delimiter.length;
    // End marker: "--" right after the boundary
    if (data.slice(partStart, partStart + 2).toString() === "--") break;
    // Skip the CRLF that terminates the boundary line
    const headerStart = partStart + 2;
    const headerEnd = data.indexOf("\r\n\r\n", headerStart);
    if (headerEnd === -1) break;
    const headers = data.slice(headerStart, headerEnd).toString("utf8");
    const next = data.indexOf(delimiter, headerEnd + 4);
    const contentEnd = next === -1 ? data.length : next;
    const content = data.slice(headerEnd + 4, contentEnd);

    const dispositionLine = headers
      .split("\r\n")
      .find((h) => /^content-disposition:/i.test(h));
    if (dispositionLine) {
      const nameMatch = /;\s*name="([^"]*)"/i.exec(dispositionLine);
      const filenameMatch = /;\s*filename="([^"]*)"/i.exec(dispositionLine);
      const name = nameMatch ? nameMatch[1] : "";
      const filename = filenameMatch ? filenameMatch[1] : undefined;
      if (filename !== undefined || name === "file") {
        file = { name, filename: filename || "audio", content };
      } else if (content.length <= 65536) {
        fields[name] = content.toString("utf8").trim();
      }
    }
    offset = next;
  }
  return { fields, file };
}

// --- Audio conversion ---

function isWhisperReadyWav(buf) {
  // RIFF/WAVE, PCM (fmt tag 1), mono, 16 kHz, 16-bit — whisper.cpp's required input
  if (buf.length < 44) return false;
  if (buf.toString("ascii", 0, 4) !== "RIFF") return false;
  if (buf.toString("ascii", 8, 12) !== "WAVE") return false;
  if (buf.toString("ascii", 12, 16) !== "fmt ") return false;
  const audioFormat = buf.readUInt16LE(20);
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  return audioFormat === 1 && channels === 1 && sampleRate === 16000 && bitsPerSample === 16;
}

async function convertToWav(inputBuffer) {
  if (isWhisperReadyWav(inputBuffer)) return inputBuffer;
  const stamp = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const inputPath = path.join(os.tmpdir(), `ow-in-${stamp}`);
  const outputPath = path.join(os.tmpdir(), `ow-out-${stamp}.wav`);
  try {
    fs.writeFileSync(inputPath, inputBuffer);
    await new Promise((resolve, reject) => {
      const proc = spawn("ffmpeg", [
        "-i",
        inputPath,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        "-y",
        outputPath,
      ]);
      let stderr = "";
      proc.stderr.on("data", (chunk) => {
        stderr += chunk;
        if (stderr.length > 8192) stderr = stderr.slice(-8192);
      });
      proc.on("error", reject);
      proc.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with ${code}: ${stderr.slice(-500)}`));
      });
    });
    return fs.readFileSync(outputPath);
  } finally {
    for (const f of [inputPath, outputPath]) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
  }
}

// --- whisper-server /inference client (multipart shape mirrors OpenWhispr) ---

function inferenceRequest(wavBuffer, { language, prompt, responseFormat }) {
  const boundary = `----OpenWhisprBoundary${crypto.randomBytes(8).toString("hex")}`;
  const parts = [];
  parts.push(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n` +
      `Content-Type: audio/wav\r\n\r\n`,
  );
  parts.push(wavBuffer);
  parts.push("\r\n");
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language || LANGUAGE}\r\n`,
  );
  if (prompt) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${prompt}\r\n`,
    );
  }
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\n${responseFormat}\r\n`,
  );
  parts.push(`--${boundary}--\r\n`);
  const body = Buffer.concat(parts.map((p) => (typeof p === "string" ? Buffer.from(p) : p)));

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: WHISPER_PORT,
        path: "/inference",
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
        timeout: INFERENCE_TIMEOUT_MS,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", (err) => reject(new Error(`whisper-server request failed: ${err.message}`)));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("whisper-server request timed out"));
    });
    req.write(body);
    req.end();
  });
}

// --- Request body collection ---

function readBody(req, res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;
    req.on("data", (chunk) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        sendJson(res, 413, { error: "request body too large" });
        req.destroy();
        reject(new Error("body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// --- Handlers ---

async function handleTranscription(req, res) {
  if (!state.ready) {
    sendJson(res, 503, {
      error: `transcription unavailable: ${state.status} (model "${MODEL}" may still be downloading)`,
    });
    return;
  }
  let body;
  try {
    body = await readBody(req, res);
  } catch {
    return; // response already sent or connection gone
  }
  const parsed = parseMultipart(body, req.headers["content-type"]);
  if (!parsed || !parsed.file || parsed.file.content.length === 0) {
    sendJson(res, 400, { error: "multipart form-data with a 'file' field is required" });
    return;
  }
  const requestedFormat = (parsed.fields["response_format"] || "json").toLowerCase();
  if (!["json", "verbose_json", "text"].includes(requestedFormat)) {
    sendJson(res, 400, {
      error: `response_format '${requestedFormat}' not supported; use json, verbose_json, or text`,
    });
    return;
  }
  try {
    const wav = await convertToWav(parsed.file.content);
    const result = await inferenceRequest(wav, {
      language: parsed.fields["language"],
      prompt: parsed.fields["prompt"],
      responseFormat: requestedFormat,
    });
    if (result.statusCode !== 200) {
      sendJson(res, 502, { error: `whisper-server returned ${result.statusCode}: ${result.body}` });
      return;
    }
    if (requestedFormat === "text") {
      const text = result.body;
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": Buffer.byteLength(text),
      });
      res.end(text);
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(result.body),
    });
    res.end(result.body);
  } catch (err) {
    log(`transcription failed: ${err.message}`);
    sendJson(res, 500, { error: err.message });
  }
}

function handleInferencePassthrough(req, res) {
  if (!state.ready) {
    sendJson(res, 503, {
      error: `transcription unavailable: ${state.status} (model "${MODEL}" may still be downloading)`,
    });
    return;
  }
  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: WHISPER_PORT,
      path: "/inference",
      method: "POST",
      headers: {
        "content-type": req.headers["content-type"] || "",
        ...(req.headers["content-length"]
          ? { "content-length": req.headers["content-length"] }
          : {}),
      },
      timeout: INFERENCE_TIMEOUT_MS,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        "Content-Type": proxyRes.headers["content-type"] || "application/json",
      });
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", (err) => {
    if (!res.headersSent) sendJson(res, 502, { error: `whisper-server unreachable: ${err.message}` });
    else res.destroy();
  });
  proxyReq.on("timeout", () => {
    proxyReq.destroy();
    if (!res.headersSent) sendJson(res, 504, { error: "whisper-server request timed out" });
  });
  req.pipe(proxyReq);
}

const STATIC_FILES = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/manifest.webmanifest": { file: "manifest.webmanifest", type: "application/manifest+json" },
  "/icon-256.png": { file: "icon-256.png", type: "image/png" },
  "/icon.svg": { file: "icon.svg", type: "image/svg+xml" },
};

function handleStatic(pathname, res) {
  const entry = STATIC_FILES[pathname];
  const filePath = path.join(WEB_DIR, entry.file);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    res.writeHead(200, { "Content-Type": entry.type, "Content-Length": content.length });
    res.end(content);
  });
}

// --- HTTP server ---

const server = http.createServer((req, res) => {
  const pathname = (req.url || "/").split("?")[0];

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, state);
    return;
  }
  if (req.method === "GET" && Object.prototype.hasOwnProperty.call(STATIC_FILES, pathname)) {
    handleStatic(pathname, res);
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "unauthorized: send 'Authorization: Bearer <token>'" });
    return;
  }

  if (
    req.method === "POST" &&
    (pathname === "/v1/audio/transcriptions" || pathname === "/audio/transcriptions")
  ) {
    handleTranscription(req, res);
    return;
  }
  if (req.method === "POST" && pathname === "/inference") {
    handleInferencePassthrough(req, res);
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

server.requestTimeout = INFERENCE_TIMEOUT_MS + 30000;
server.headersTimeout = 60000;

// --- Startup / shutdown ---

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`received ${signal}, shutting down`);
  if (whisperChild) {
    try {
      whisperChild.kill("SIGTERM");
    } catch {}
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, () => {
  log(`listening on :${PORT} (model=${MODEL}, whisper port=${WHISPER_PORT})`);
  downloadModel()
    .then(() => spawnWhisper())
    .catch((err) => {
      state.status = "download_failed";
      log(`FATAL: model download failed permanently: ${err.message}`);
    });
});
