import {
  claudeRequestConvertTo,
  geminiRequestConvertTo,
  openaiChatRequestConvertTo,
  openAIResponsesResponseConvertTo,
  TargetType,
} from "../../../pkg/converter_wasm.js";
import { StreamEvent } from "../../streaming/sse.ts";
import { RequestLogger } from "../../utils/logger.ts";

export function convertToOpenAIResponsesRequestTo(body: any, source: any) {
  switch (source) {
    case TargetType.Claude:
      return claudeRequestConvertTo(body, TargetType.OpenAIResponses);
    case TargetType.Gemini:
      return geminiRequestConvertTo(body, TargetType.OpenAIResponses);
    case TargetType.OpenAIChat:
      return openaiChatRequestConvertTo(body, TargetType.OpenAIResponses);
    case TargetType.OpenAIResponses:
      return body;
    default:
      throw new Error(
        `Unsupported source type for OpenAI Responses provider: ${source}`,
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
    TargetType.OpenAIResponses,
    target,
    requestLogger,
  );
}
