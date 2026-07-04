import {
  claudeRequestConvertTo,
  geminiRequestConvertTo,
  openaiChatResponseConvertTo,
  openAIResponsesRequestConvertTo,
  ProviderType,
} from "../../../pkg/converter_wasm";
import { StreamEvent } from "../../streaming/sse";
import { RequestLogger } from "../../utils/logger";

export function convertToQwenRequestTo(body: any, source: any) {
  switch (source) {
    case ProviderType.Claude:
      return claudeRequestConvertTo(body, ProviderType.Chat);
    case ProviderType.Gemini:
      return geminiRequestConvertTo(body, ProviderType.Chat);
    case ProviderType.Responses:
      return openAIResponsesRequestConvertTo(body, ProviderType.Chat);
    case ProviderType.Chat:
      return body;
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
  return StreamEvent(stream, response, ProviderType.Chat, target, requestLogger);
}
