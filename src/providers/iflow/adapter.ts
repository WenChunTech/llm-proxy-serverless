import {
  claudeRequestConvertTo,
  geminiRequestConvertTo,
  openaiChatResponseConvertTo,
  openAIResponsesRequestConvertTo,
  ProviderType,
} from "../../../pkg/converter_wasm.js";
import { StreamEvent } from "../../streaming/sse.ts";
import { RequestLogger } from "../../utils/logger.ts";

export function convertToIFlowRequestTo(body: any, source: any) {
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
        `Unsupported source type for IFlow providerType: ${source}`,
      );
  }
}

export async function convertIFlowResponseTo(
  c: any,
  response: Response,
  target: any,
) {
  const data = await response.json();
  const resp = openaiChatResponseConvertTo(data, target);
  return c.json(resp);
}

export async function convertIFlowStreamResponseTo(
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
