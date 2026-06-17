import {
  claudeRequestConvertTo,
  geminiRequestConvertTo,
  openaiChatResponseConvertTo,
  openAIResponsesRequestConvertTo,
  ProviderType,
} from "../../../pkg/converter_wasm.js";
import { StreamEvent } from "../../streaming/sse.ts";
import { logger, RequestLogger } from "../../utils/logger.ts";

export function convertToQwenRequestTo(body: any, source: any) {
  try {
    switch (source) {
      case ProviderType.Claude:
        return claudeRequestConvertTo(body, ProviderType.Chat);
      case ProviderType.Gemini:
        return geminiRequestConvertTo(body, ProviderType.Chat);
      case ProviderType.Chat:
        return body;
      case ProviderType.Responses:
        return openAIResponsesRequestConvertTo(body, ProviderType.Chat);
      default:
        throw new Error(
          `Unsupported source type for OpenAI providerType: ${source}`,
        );
    }
  } catch (error) {
    logger.error(
      `[WASM] Request conversion failed (source=${source}, target=Chat/Qwen):`,
      error,
      `\nOriginal request body:`,
      JSON.stringify(body, null, 2),
    );
    throw error;
  }
}

export async function convertQwenResponseTo(
  c: any,
  response: Response,
  target: any,
) {
  const data = await response.json();
  try {
    const resp = openaiChatResponseConvertTo(data, target);
    return c.json(resp);
  } catch (error) {
    logger.error(
      `[WASM] Response conversion failed (source=Chat/Qwen, target=${target}):`,
      error,
      `\nOriginal response body:`,
      JSON.stringify(data, null, 2),
    );
    throw error;
  }
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
    ProviderType.Chat,
    target,
    requestLogger,
  );
}
