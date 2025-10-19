import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import initWasm, { openai_request_convert, TargetType } from '../pkg/converter_wasm'

await initWasm();

const app = new Hono();

app.post("/v1/chat/completions", async (c) => {
  const body = await c.req.json();
  const model = body.model;
  console.log(body);
  const openai_request = openai_request_convert(body, TargetType.GeminiCli);
  console.log(JSON.stringify(openai_request));
  let id = 0;
  return streamSSE(c, async (stream) => {
    while (true) {
      const message = `It is ${new Date().toISOString()}`
      await stream.writeSSE({
        data: message,
        event: 'time-update',
        id: String(id++),
      })
      await stream.sleep(1000)
    }
  })
})

app.post("/v1/messages", async (c) => {
  const body = await c.req.json();
  const model = body.model;
  console.log(body);
  let id = 0;
  return streamSSE(c, async (stream) => {
    while (true) {
      const message = `It is ${new Date().toISOString()}`
      await stream.writeSSE({
        data: message,
        event: 'time-update',
        id: String(id++),
      })
      await stream.sleep(1000)
    }
  })
})

app.post("/v1beta/models/:modelName:streamGenerateContent", async (c) => {
  const modelName = c.req.param("modelName");
  const body = await c.req.json();
  console.log(body);
  let id = 0;
  return streamSSE(c, async (stream) => {
    while (true) {
      const message = `It is ${new Date().toISOString()}`
      await stream.writeSSE({
        data: message,
        event: 'time-update',
        id: String(id++),
      })
      await stream.sleep(1000)
    }
  })
})

export default app