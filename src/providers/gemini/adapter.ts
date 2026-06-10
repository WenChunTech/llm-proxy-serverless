import {
  claudeRequestConvertTo,
  geminiCliResponseConvertTo,
  geminiResponseConvertTo,
  openaiChatRequestConvertTo,
  openAIResponsesRequestConvertTo,
  ProviderType,
} from "../../../pkg/converter_wasm.js";
import { StreamEvent } from "../../streaming/sse.ts";
import { RequestLogger } from "../../utils/logger.ts";

export function convertToGeminiRequestTo(body: any, source: any) {
  switch (source) {
    case ProviderType.Chat:
      return openaiChatRequestConvertTo(body, ProviderType.Gemini);
    case ProviderType.Claude:
      return claudeRequestConvertTo(body, ProviderType.Gemini);
    case ProviderType.GeminiCli:
      return geminiCliResponseConvertTo(body, ProviderType.Gemini);
    case ProviderType.Gemini:
      return body;
    case ProviderType.Responses:
      return openAIResponsesRequestConvertTo(body, ProviderType.Gemini);
    default:
      throw new Error(
        `Unsupported source type for Gemini providerTypeProviderType: ${source}`,
      );
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
  return StreamEvent(
    stream,
    response,
    ProviderType.Gemini,
    target,
    requestLogger,
  );
}
