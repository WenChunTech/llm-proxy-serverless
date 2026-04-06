import {
  claudeRequestConvertTo,
  geminiCliResponseConvertTo,
  geminiRequestConvertToGeminiCliRequest,
  openaiChatRequestConvertTo,
  TargetType,
} from "../../../pkg/converter_wasm.js";
import {
  geminiCliStreamResponseConvertToGeminiStreamResponse,
  StreamEvent,
} from "../../streaming/sse.ts";
import { RequestLogger } from "../../utils/logger.ts";

export function convertToGeminiCliRequestTo(body: any, source: any) {
  switch (source) {
    case TargetType.OpenAIChat:
      return openaiChatRequestConvertTo(body, TargetType.GeminiCli);
    case TargetType.Claude:
      return claudeRequestConvertTo(body, TargetType.GeminiCli);
    case TargetType.Gemini:
      return geminiRequestConvertToGeminiCliRequest(body);
    default:
      throw new Error(`Unsupported source type for Gemini provider: ${source}`);
  }
}

export async function convertGeminiCliResponseTo(
  c: any,
  response: Response,
  target: any,
) {
  const data = await response.json();
  const resp = geminiCliResponseConvertTo(data, target);
  return c.json(resp);
}

export async function convertGeminiStreamResponseTo(
  stream: any,
  response: Response,
  target: any,
  requestLogger?: RequestLogger,
) {
  if (target === TargetType.Gemini) {
    return geminiCliStreamResponseConvertToGeminiStreamResponse(
      stream,
      response,
      requestLogger,
    );
  }
  return StreamEvent(
    stream,
    response,
    TargetType.GeminiCli,
    target,
    requestLogger,
  );
}
