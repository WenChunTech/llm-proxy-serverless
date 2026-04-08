import {
  claudeRequestConvertTo,
  geminiRequestConvertTo,
  openAIResponsesRequestConvertTo,
  openaiChatResponseConvertTo,
  TargetType,
} from "../../../pkg/converter_wasm.js";
import { StreamEvent } from "../../streaming/sse.ts";
import { RequestLogger } from "../../utils/logger.ts";

export function convertToQwenRequestTo(body: any, source: any) {
  switch (source) {
    case TargetType.Claude:
      return claudeRequestConvertTo(body, TargetType.OpenAIChat);
    case TargetType.Gemini:
      return geminiRequestConvertTo(body, TargetType.OpenAIChat);
    case TargetType.OpenAIChat:
      return body;
    case TargetType.OpenAIResponses:
      return openAIResponsesRequestConvertTo(body, TargetType.OpenAIChat);
    default:
      throw new Error(`Unsupported source type for OpenAI provider: ${source}`);
  }
}

export async function convertQwenResponseTo(
  c: any,
  response: Response,
  target: any,
) {
  const data = await response.json();
  const resp = openaiChatResponseConvertTo(data, target);
  return c.json(resp);
}

export async function convertQwenStreamResponseTo(
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
