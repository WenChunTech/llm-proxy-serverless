import {
  claudeResponseConvertTo,
  geminiRequestConvertTo,
  openaiChatRequestConvertTo,
  openAIResponsesRequestConvertTo,
  ProviderType,
} from "../../../pkg/converter_wasm.js";
import { StreamEvent } from "../../streaming/sse.ts";
import { logger, RequestLogger } from "../../utils/logger.ts";

export function convertToClaudeRequestTo(body: any, source: any) {
  try {
    switch (source) {
      case ProviderType.Gemini:
        return geminiRequestConvertTo(body, ProviderType.Claude);
      case ProviderType.Chat:
        return openaiChatRequestConvertTo(body, ProviderType.Claude);
      case ProviderType.Claude:
        return body;
      case ProviderType.Responses:
        return openAIResponsesRequestConvertTo(body, ProviderType.Claude);
      default:
        throw new Error(
          `Unsupported source type for Claude providerType: ${source}`,
        );
    }
  } catch (error) {
    logger.error(
      `[WASM] Request conversion failed (source=${source}, target=Claude):`,
      error,
      `\nOriginal request body:`,
      JSON.stringify(body, null, 2),
    );
    throw error;
  }
}

export async function convertClaudeResponseTo(
  c: any,
  response: Response,
  target: any,
) {
  const data = await response.json();
  try {
    const resp = claudeResponseConvertTo(data, target);
    return c.json(resp);
  } catch (error) {
    logger.error(
      `[WASM] Response conversion failed (source=Claude, target=${target}):`,
      error,
      `\nOriginal response body:`,
      JSON.stringify(data, null, 2),
    );
    throw error;
  }
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
