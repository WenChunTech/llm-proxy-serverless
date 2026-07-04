import {
  claudeResponseConvertTo,
  geminiRequestConvertTo,
  openAIResponsesRequestConvertTo,
  openaiChatRequestConvertTo,
  ProviderType,
} from "../../../pkg/converter_wasm";
import { StreamEvent } from "../../streaming/sse";
import { RequestLogger } from "../../utils/logger";

export function convertToClaudeRequestTo(body: any, source: any) {
  switch (source) {
    case ProviderType.Gemini:
      return geminiRequestConvertTo(body, ProviderType.Claude);
    case ProviderType.Chat:
      return openaiChatRequestConvertTo(body, ProviderType.Claude);
    case ProviderType.Responses:
      return openAIResponsesRequestConvertTo(body, ProviderType.Claude);
    case ProviderType.Claude:
      return body;
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
  const resp = claudeResponseConvertTo(data, target);
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
    ProviderType.Claude,
    target,
    requestLogger,
  );
}
