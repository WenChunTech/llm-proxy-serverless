import { Hono } from 'hono';
import { streamSSE } from "hono/streaming";
import initWasm, { TargetType } from '../pkg/converter_wasm.js';
import { getProvider } from './providers/index.js';
import { initConfig } from './init.js';

const app = new Hono();

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

export default {
  async fetch(request, env, ctx) {
    await initWasm();
    await initConfig(env);
    return app.fetch(request, env, ctx);
  },
};