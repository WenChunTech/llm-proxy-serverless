import {
  claudeRequestConvertTo,
  geminiCliResponseConvertTo,
  geminiRequestConvertToGeminiCliRequest,
  openaiChatRequestConvertTo,
  openAIResponsesRequestConvertTo,
  ProviderType,
} from "../../../pkg/converter_wasm.js";
import {
  geminiCliStreamResponseConvertToGeminiStreamResponse,
  StreamEvent,
} from "../../streaming/sse.ts";
import { RequestLogger } from "../../utils/logger.ts";

export function convertToGeminiCliRequestTo(body: any, source: any) {
  switch (source) {
    case ProviderType.Chat:
      return openaiChatRequestConvertTo(body, ProviderType.GeminiCli);
    case ProviderType.Claude:
      return claudeRequestConvertTo(body, ProviderType.GeminiCli);
    case ProviderType.Gemini:
      return geminiRequestConvertToGeminiCliRequest(body);
    case ProviderType.Responses:
      return openAIResponsesRequestConvertTo(body, ProviderType.GeminiCli);
    default:
      throw new Error(
        `Unsupported source type for Gemini providerType: ${source}`,
      );
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
  if (target === ProviderType.Gemini) {
    return geminiCliStreamResponseConvertToGeminiStreamResponse(
      stream,
      response,
      requestLogger,
    );
  }
  return StreamEvent(
    stream,
    response,
    ProviderType.GeminiCli,
    target,
    requestLogger,
  );
}
