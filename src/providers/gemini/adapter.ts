import {
  claudeRequestConvertTo,
  geminiCliResponseConvertTo,
  geminiResponseConvertTo,
  openaiRequestConvertTo,
  TargetType,
} from "../../../pkg/converter_wasm.js";
import { StreamEvent } from "../../streaming/sse.ts";

export function convertToGeminiRequestTo(body: any, source: any) {
  switch (source) {
    case TargetType.OpenAI:
      return openaiRequestConvertTo(body, TargetType.Gemini);
    case TargetType.Claude:
      return claudeRequestConvertTo(body, TargetType.Gemini);
    case TargetType.GeminiCli:
      return geminiCliResponseConvertTo(body, TargetType.Gemini);
    case TargetType.Gemini:
      return body;
    default:
      throw new Error(`Unsupported source type for Gemini provider: ${source}`);
  }
}

export async function convertGeminiResponseTo(
  c: any,
  response: Response,
  target: any,
) {
  const data = await response.json();
  const resp = geminiResponseConvertTo(data, target);
  return c.json(resp);
}

export async function convertGeminiStreamResponseTo(
  stream: any,
  response: Response,
  target: any,
) {
  return StreamEvent(stream, response, TargetType.Gemini, target);
}
