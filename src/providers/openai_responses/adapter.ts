import {
  claudeRequestConvertTo,
  geminiRequestConvertTo,
  openaiChatRequestConvertTo,
  openAIResponsesResponseConvertTo,
  ProviderType,
} from "../../../pkg/converter_wasm.js";
import { StreamEvent } from "../../streaming/sse.ts";
import { RequestLogger } from "../../utils/logger.ts";

export function convertToOpenAIResponsesRequestTo(body: any, source: any) {
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
}

export async function convertOpenAIResponsesResponseTo(
  c: any,
  response: Response,
  target: any,
) {
  const data = await response.json();
  const resp = openAIResponsesResponseConvertTo(data, target);
  return c.json(resp);
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
