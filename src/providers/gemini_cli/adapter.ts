import {
  claudeRequestConvertTo,
  geminiCliResponseConvertTo,
  geminiRequestConvertToGeminiCliRequest,
  openAIResponsesRequestConvertTo,
  openaiChatRequestConvertTo,
  ProviderType,
} from "../../../pkg/converter_wasm";
import { StreamEvent, geminiCliStreamResponseConvertToGeminiStreamResponse } from '../../streaming/sse';
import { RequestLogger } from '../../utils/logger';

export function convertToGeminiCliRequestTo(body: any, source: any) {
  switch (source) {
    case ProviderType.Chat:
      return openaiChatRequestConvertTo(body, ProviderType.GeminiCli);
    case ProviderType.Responses:
      return openAIResponsesRequestConvertTo(body, ProviderType.GeminiCli);
    case ProviderType.Claude:
      return claudeRequestConvertTo(body, ProviderType.GeminiCli);
    case ProviderType.Gemini:
      return geminiRequestConvertToGeminiCliRequest(body);
    default:
      throw new Error(`Unsupported source type for Gemini provider: ${source}`);
  }
}

export async function convertGeminiCliResponseTo(c: any, response: Response, target: any) {
    const data = await response.json();
    const resp = geminiCliResponseConvertTo(data, target);
    return c.json(resp)
}

export async function convertGeminiStreamResponseTo(stream: any, response: Response, target: any, requestLogger?: RequestLogger) {
    if (target === ProviderType.Gemini) {
        return geminiCliStreamResponseConvertToGeminiStreamResponse(stream, response, requestLogger);
    }
    return StreamEvent(stream, response, ProviderType.GeminiCli, target, requestLogger);
}
