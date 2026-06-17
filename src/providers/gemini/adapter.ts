import {
  claudeRequestConvertTo,
  geminiCliResponseConvertTo,
  geminiResponseConvertTo,
  openaiChatRequestConvertTo,
  openAIResponsesRequestConvertTo,
  ProviderType,
} from "../../../pkg/converter_wasm.js";
import { StreamEvent } from "../../streaming/sse.ts";
import { logger, RequestLogger } from "../../utils/logger.ts";

export function convertToGeminiRequestTo(body: any, source: any) {
  try {
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
  } catch (error) {
    logger.error(
      `[WASM] Request conversion failed (source=${source}, target=Gemini):`,
      error,
      `\nOriginal request body:`,
      JSON.stringify(body, null, 2),
    );
    throw error;
  }
}

export async function convertGeminiResponseTo(
  c: any,
  response: Response,
  target: any,
) {
  const data = await response.json();
  try {
    const resp = geminiResponseConvertTo(data, target);
    return c.json(resp);
  } catch (error) {
    logger.error(
      `[WASM] Response conversion failed (source=Gemini, target=${target}):`,
      error,
      `\nOriginal response body:`,
      JSON.stringify(data, null, 2),
    );
    throw error;
  }
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
