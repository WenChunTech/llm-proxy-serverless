import { Hono } from 'hono';
import { streamSSE } from "hono/streaming";
import initWasm, { TargetType } from '../pkg/converter_wasm.js';
import { getProvider } from './providers/index.js';
import { initConfig } from './init.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from 'process'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wasmPath = path.join(__dirname, '..', 'pkg', 'converter_wasm_bg.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);
await initWasm(wasmBuffer);
const app = new Hono();

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
  return streamSSE(c, async (stream) => {
    const body = await c.req.json();
    const model = body.model;
    const provider = getProvider(model);
    const response = await provider.execute(c.env, stream, body, TargetType.OpenAI, TargetType.OpenAI);
    if (response) {
      return response;
    }
  });
});

app.post("/v1beta/models/:modelName:streamGenerateContent", async (c) => {
  const model = c.req.param("modelName");
  return streamSSE(c, async (stream) => {
    const body = await c.req.json();
    body.model = model;
    const provider = getProvider(model);
    await provider.execute(c.env, stream, body, TargetType.Gemini, TargetType.Gemini);
  });
});

app.post("/v1/messages", (c) => {
  return streamSSE(c, async (stream) => {
    const body = await c.req.json();
    const model = body.model;
    const provider = getProvider(model);
    await provider.execute(c.env, stream, body, TargetType.Claude, TargetType.Claude);
  });
});

await initConfig(env);
export default app;