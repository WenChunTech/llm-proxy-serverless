import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { TargetType } from 'converter-wasm';
import { handleModelRequest } from '@/utils/routeHandlers.js';
import { getModelsResponse } from '@/services/models.js';

const app = new Hono();

// cors
app.use(async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");
  await next();
});

app.use('/*', serveStatic({ root: './public' }))

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