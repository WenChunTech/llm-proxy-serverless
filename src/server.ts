import { Hono } from 'hono';
import { streamSSE } from "hono/streaming";
import { serveStatic } from 'hono/bun';
import { TargetType } from '../pkg/converter_wasm.js';
import { getProvider } from './providers/factory.js';

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
  const body = await c.req.json();
  const is_streaming = body.stream;
  const model = body.model;
  const provider = getProvider(model);
  const req: any = await provider.convertRequest(body, TargetType.OpenAI);
  const resp = await provider.fetchResponse(is_streaming, req);
  if (is_streaming) {
    return streamSSE(c, async (stream) => {
      return provider.convertStreamResponse(stream, resp, TargetType.OpenAI);
    });
  }
  return provider.convertResponse(c, resp, TargetType.OpenAI);

});

app.post("/v1beta/models/:modelName", async (c) => {
  const path = c.req.param("modelName");
  const model = path.split(":")[0];
  const is_streaming = path.split(":")[1] === "streamGenerateContent";
  const body = await c.req.json();
  body.model = model;
  const provider = getProvider(model);
  const req: any = await provider.convertRequest(body, TargetType.Gemini);
  const resp = await provider.fetchResponse(is_streaming, req);
  if (is_streaming) {
    return streamSSE(c, async (stream) => {
      return provider.convertStreamResponse(stream, resp, TargetType.Gemini);
    });
  }
  return provider.convertResponse(c, resp, TargetType.Gemini);
});

app.post("/v1/messages", async (c) => {
  const body = await c.req.json();
  const model = body.model;
  const is_streaming = body.stream;
  const provider = getProvider(model);
  const req: any = await provider.convertRequest(body, TargetType.Claude);
  const resp = await provider.fetchResponse(is_streaming, req);
  if (is_streaming) {
    return streamSSE(c, async (stream) => {
      return provider.convertStreamResponse(stream, resp, TargetType.Claude);
    });
  }
  return provider.convertResponse(c, resp, TargetType.Claude);
});

export default app;