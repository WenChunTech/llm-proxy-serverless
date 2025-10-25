import { Hono } from 'hono'
import initWasm, { gemini_req_convert_to_gemini_cli_req } from '../pkg/converter_wasm.js'
import { streamSSE } from "hono/streaming";
import { getAccessToken } from './auth/gemini_cli.js'
import { fetchGeminiCLiResponse, fetchWithRetry } from './provider/gemini_cli.js'
import { StreamEvent, geminiCliResponseConvert } from './eventstream.js'
import { claude_request_convert, TargetType } from '../pkg/converter_wasm.js'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.5-flash-image'];
await initWasm();
const app = new Hono();

app.post("/v1/chat/completions", async (c) => {
  return streamSSE(c, async (stream) => {
    const body = await c.req.json();
    const gemini_cli_request = openai_request_convert(body, TargetType.GeminiCli);
    gemini_cli_request.project = "574981810628"
    const token = await getAccessToken();
    const response = await fetchWithRetry(fetchGeminiCLiResponse, { token, data: gemini_cli_request });
    if (!response.ok) {
      console.log(await response.text());
    }
    StreamEvent(stream, response, TargetType.GeminiCli, TargetType.Claude);
  });
})

app.post("/v1beta/models/:modelName:streamGenerateContent", async (c) => {
  const model = c.req.param("modelName");
  const body = await c.req.json();
  body.model = model;
  return streamSSE(c, async (stream) => {
    const body = await c.req.json();
    let gemini_cli_request = gemini_req_convert_to_gemini_cli_req(body, TargetType.GeminiCli);
    gemini_cli_request.project = "574981810628"
    const token = await getAccessToken();
    const response = await fetchWithRetry(fetchGeminiCLiResponse, { token, data: gemini_cli_request });
    if (!response.ok) {
      console.log(await response.text());
    }
    geminiCliResponseConvert(stream, response)
  });
})

app.post("/v1/messages", (c) => {
  return streamSSE(c, async (stream) => {
    const body = await c.req.json();
    let gemini_cli_request = claude_request_convert(body, TargetType.GeminiCli);
    gemini_cli_request.project = "574981810628"
    const token = await getAccessToken();
    const response = await fetchWithRetry(fetchGeminiCLiResponse, { token, data: gemini_cli_request });
    if (!response.ok) {
      console.log(await response.text());
    }
    StreamEvent(stream, response, TargetType.GeminiCli, TargetType.Claude);
  });
})

export default app