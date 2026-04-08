import {
  geminiRequestConvertTo,
  openaiChatRequestConvertTo,
  openaiChatResponseConvertTo,
  openAIResponsesRequestConvertTo,
  TargetType,
} from "../../../pkg/converter_wasm.js";
import { StreamEvent } from "../../streaming/sse.ts";
import { RequestLogger } from "../../utils/logger.ts";

export function convertToClaudeRequestTo(body: any, source: any) {
  switch (source) {
    case TargetType.Gemini:
      return geminiRequestConvertTo(body, TargetType.Claude);
    case TargetType.OpenAIChat:
      return openaiChatRequestConvertTo(body, TargetType.Claude);
    case TargetType.Claude:
      return body;
    case TargetType.OpenAIResponses:
      return openAIResponsesRequestConvertTo(body, TargetType.Claude);
    default:
      throw new Error(`Unsupported source type for Claude provider: ${source}`);
  }
}

export async function convertClaudeResponseTo(
  c: any,
  response: Response,
  target: any,
) {
  const data = await response.json();
  const resp = openaiChatResponseConvertTo(data, target);
  return c.json(resp);
}

export async function convertClaudeStreamResponseTo(
  stream: any,
  response: Response,
  target: any,
  requestLogger?: RequestLogger,
) {
  return StreamEvent(
    stream,
    response,
    TargetType.Claude,
    target,
    requestLogger,
  );
}
