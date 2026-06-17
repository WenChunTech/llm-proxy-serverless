import {
  claudeRequestConvertTo,
  geminiRequestConvertTo,
  openaiChatRequestConvertTo,
  openAIResponsesResponseConvertTo,
  ProviderType,
} from "../../../pkg/converter_wasm.js";
import { StreamEvent } from "../../streaming/sse.ts";
import { logger, RequestLogger } from "../../utils/logger.ts";

export function convertToOpenAIResponsesRequestTo(body: any, source: any) {
  try {
    switch (source) {
      case ProviderType.Claude:
        return claudeRequestConvertTo(body, ProviderType.Responses);
      case ProviderType.Gemini:
        return geminiRequestConvertTo(body, ProviderType.Responses);
      case ProviderType.Chat:
        return openaiChatRequestConvertTo(body, ProviderType.Responses);
      case ProviderType.Responses:
        return body;
      default:
        throw new Error(
          `Unsupported source type for OpenAI Responses providerType: ${source}`,
        );
    }
  } catch (error) {
    logger.error(
      `[WASM] Request conversion failed (source=${source}, target=Responses):`,
      error,
      `\nOriginal request body:`,
      JSON.stringify(body, null, 2),
    );
    throw error;
  }
}

export async function convertOpenAIResponsesResponseTo(
  c: any,
  response: Response,
  target: any,
) {
  const data = await response.json();
  try {
    const resp = openAIResponsesResponseConvertTo(data, target);
    return c.json(resp);
  } catch (error) {
    logger.error(
      `[WASM] Response conversion failed (source=Responses, target=${target}):`,
      error,
      `\nOriginal response body:`,
      JSON.stringify(data, null, 2),
    );
    throw error;
  }
}

export async function convertOpenAIResponsesStreamResponseTo(
  stream: any,
  response: Response,
  target: any,
  requestLogger?: RequestLogger,
) {
  return StreamEvent(
    stream,
    response,
    ProviderType.Responses,
    target,
    requestLogger,
  );
}
