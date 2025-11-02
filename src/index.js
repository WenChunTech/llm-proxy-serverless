import { Hono } from 'hono';
import { streamSSE } from "hono/streaming";
import initWasm, { TargetType } from '../pkg/converter_wasm.js';
import { getProvider } from './providers/index.js';
import { initConfig } from './init.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAccessToken } from './creds/gemini_cli.js';
import { fetchWithRetry, fetchGeminiCLiResponse, fetchGeminiCLiStreamResponse } from './provider/gemini_cli.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wasmPath = path.join(__dirname, '..', 'pkg', 'converter_wasm_bg.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);
await initWasm({ module_or_path: wasmBuffer });
await initConfig();

const app = new Hono();

// cors
app.use(async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");
  await next();
});

app.get("/", (c) => {
  return c.html(`
    <html>
      <head>
        <title>LLM Proxy</title>
      </head>
      <body>
        <h1>LLM Proxy</h1>
      </body>
    </html>
  `)
})

app.post("/v1/chat/completions", async (c) => {
  const body = await c.req.json();
  const is_streaming = body.stream;
  const model = body.model;
  const provider = getProvider(model);
  const req = await provider.convertRequest(body, TargetType.OpenAI);
  req.project = provider.project;
  const token = await getAccessToken();
  if (is_streaming) {
    return streamSSE(c, async (stream) => {
      const resp = await fetchWithRetry(fetchGeminiCLiStreamResponse, { token, data: req });
      return provider.convertStreamResponse(stream, resp, TargetType.OpenAI);
    });
  } else {
    const resp = await fetchWithRetry(fetchGeminiCLiResponse, { token, data: req });
    return provider.convertResponse(c, resp, TargetType.OpenAI);
  }
});

app.post("/v1beta/models/:modelName", async (c) => {
  const path = c.req.param("modelName");
  const model = path.split(":")[0];
  const is_streaming = path.split(":")[1] === "streamGenerateContent";
  const body = await c.req.json();
  body.model = model;
  const provider = getProvider(model);
  const req = await provider.convertRequest(body, TargetType.Gemini);
  req.project = provider.project;
  const token = await getAccessToken();

  if (is_streaming) {
    const resp = await fetchWithRetry(fetchGeminiCLiStreamResponse, { token, data: req });
    return streamSSE(c, async (stream) => {
      return provider.convertStreamResponse(stream, resp, TargetType.Gemini);
    });
  } else {
    const resp = await fetchWithRetry(fetchGeminiCLiResponse, { token, data: req });
    return provider.convertResponse(c, resp, TargetType.Gemini);
  }
});

app.post("/v1/messages", async (c) => {
  const body = await c.req.json();
  const model = body.model;
  const is_streaming = body.stream;
  const provider = getProvider(model);
  const req = await provider.convertRequest(body, TargetType.Claude);
  req.project = provider.project;
  const token = await getAccessToken();
  if (is_streaming) {
    const resp = await fetchWithRetry(fetchGeminiCLiStreamResponse, { token, data: req });
    return streamSSE(c, async (stream) => {
      return provider.convertStreamResponse(stream, resp, TargetType.Claude);
    });
  } else {
    const resp = await fetchWithRetry(fetchGeminiCLiResponse, { token, data: req });
    return provider.convertResponse(c, resp, TargetType.Claude);
  }
});

// export default app;
export default {
  hostname: "0.0.0.0",
  port: 3000,
  fetch: app.fetch,
}