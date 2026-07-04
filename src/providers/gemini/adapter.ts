import {
  claudeRequestConvertTo,
  geminiCliResponseConvertTo,
  geminiResponseConvertTo,
  openAIResponsesRequestConvertTo,
  openaiChatRequestConvertTo,
  ProviderType,
} from "../../../pkg/converter_wasm";
import { StreamEvent } from "../../streaming/sse";
import { RequestLogger } from "../../utils/logger";

export function convertToGeminiRequestTo(body: any, source: any) {
  switch (source) {
    case ProviderType.Chat:
      return openaiChatRequestConvertTo(body, ProviderType.Gemini);
    case ProviderType.Responses:
      return openAIResponsesRequestConvertTo(body, ProviderType.Gemini);
    case ProviderType.Claude:
      return claudeRequestConvertTo(body, ProviderType.Gemini);
    case ProviderType.GeminiCli:
      return geminiCliResponseConvertTo(body, ProviderType.Gemini);
    case ProviderType.Gemini:
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
  requestLogger?: RequestLogger,
) {
  return StreamEvent(stream, response, ProviderType.Gemini, target, requestLogger);
}
