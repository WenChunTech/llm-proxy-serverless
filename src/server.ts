import path from 'path';

import { Hono } from 'hono';
import { TargetType } from 'converter-wasm';
import { serveStatic } from '@hono/node-server/serve-static'


import { handleModelRequest } from './utils/routeHandlers.js';
import { getModelsResponse } from './services/models.js';

const app = new Hono();

// cors
app.use(async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");
  await next();
});

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

app.use('/*', serveStatic({
  root: path.join(__dirname, '../public')
}))

app.post("/v1/chat/completions", async (c) => {
  return handleModelRequest(c, TargetType.OpenAI);
});

app.post("/v1beta/models/:modelName", async (c) => {
  return handleModelRequest(c, TargetType.Gemini);
});

app.post("/v1/messages", async (c) => {
  return handleModelRequest(c, TargetType.Claude);
});

app.get("/v1/models", async (c) => {
  return getModelsResponse(c);
});

export default app;