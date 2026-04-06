import {
  claudeRequestConvertTo,
  geminiRequestConvertTo,
  openaiChatResponseConvertTo,
  TargetType,
} from "../../../pkg/converter_wasm.js";
import { StreamEvent } from "../../streaming/sse.ts";
import { RequestLogger } from "../../utils/logger.ts";

export function convertToOpenAIRequestTo(body: any, source: any) {
  switch (source) {
    case TargetType.Claude:
      return claudeRequestConvertTo(body, TargetType.OpenAIChat);
    case TargetType.Gemini:
      return geminiRequestConvertTo(body, TargetType.OpenAIChat);
    case TargetType.OpenAIChat:
      return body;
    default:
      throw new Error(`Unsupported source type for OpenAI provider: ${source}`);
  }
}

export async function convertOpenAIResponseTo(
  c: any,
  response: Response,
  target: any,
) {
  const data = await response.json();
  const resp = openaiChatResponseConvertTo(data, target);
  return c.json(resp);
}

export async function convertOpenAIStreamResponseTo(
  stream: any,
  response: Response,
  target: any,
  requestLogger?: RequestLogger,
) {
  return StreamEvent(
    stream,
    response,
    TargetType.OpenAIChat,
    target,
    requestLogger,
  );
}
