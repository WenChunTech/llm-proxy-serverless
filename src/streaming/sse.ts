import {
  claudeStreamWrapperConvertTo,
  geminiCliResponseConvertToGeminiResponse,
  geminiCliStreamWrapperConvertTo,
  geminiStreamWrapperConvertTo,
  newStreamState,
  openAIResponsesStreamWrapperConvertTo,
  openaiChatStreamWrapperConvertTo,
  ProviderType,
} from "../../pkg/converter_wasm.js";
import { logger, RequestLogger } from "../utils/logger";
import { saveErrorLog } from "../services/errorLog";

const responseConvert = (
  wrapper: any,
  sourceType: ProviderType,
  targetType: ProviderType,
) => {
  if (sourceType === ProviderType.GeminiCli) {
    return geminiCliStreamWrapperConvertTo(wrapper, targetType);
  }
  if (sourceType === ProviderType.Gemini) {
    return geminiStreamWrapperConvertTo(wrapper, targetType);
  }
  if (sourceType === ProviderType.Chat) {
    return openaiChatStreamWrapperConvertTo(wrapper, targetType);
  }
  if (sourceType === ProviderType.Responses) {
    return openAIResponsesStreamWrapperConvertTo(wrapper, targetType);
  }
  if (sourceType === ProviderType.Claude) {
    return claudeStreamWrapperConvertTo(wrapper, targetType);
  }
  throw new Error(`Unsupported source type for stream conversion: ${sourceType}`);
};

function writeChunks(stream: any, chunks: any[]) {
  for (const chunk of chunks) {
    stream.writeSSE({
      event: chunk.type,
      data: JSON.stringify(chunk),
    });
  }
}

export const StreamEvent = async (
  stream: any,
  response: Response,
  sourceType: ProviderType,
  targetType: ProviderType,
  requestLogger?: RequestLogger,
) => {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let state = newStreamState(sourceType, targetType);
  let buffer = "";

  const handleData = (data: string) => {
    if (!data || data === "[DONE]") return;
    const wrapper = {
      chunk: JSON.parse(data),
      state,
    };
    const streamsWrapper = responseConvert(wrapper, sourceType, targetType);
    state = streamsWrapper.state;
    writeChunks(stream, streamsWrapper.chunks || []);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      const lastLine = lines.pop();
      if (lastLine !== undefined) {
        buffer = lastLine;
      }

      for (const line of lines) {
        if (line.startsWith("data:")) {
          handleData(line.substring(5).trim());
        }
      }
    }

    if (buffer.startsWith("data:")) {
      handleData(buffer.substring(5).trim());
    }
  } catch (error) {
    logger.error("[WASM] Stream conversion failed", error);
    saveErrorLog({
      type: "stream_conversion",
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      request: {
        sourceType: ProviderType[sourceType],
        targetType: ProviderType[targetType],
      },
    }).catch(() => {});
    throw error;
  }
};

export const geminiCliStreamResponseConvertToGeminiStreamResponse = async (
  stream: any,
  response: Response,
) => {
  if (!response.body) {
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleData = (data: string) => {
    if (!data || data === "[DONE]") return;
    const responseData = geminiCliResponseConvertToGeminiResponse(JSON.parse(data));
    stream.writeSSE({
      data: JSON.stringify(responseData),
    });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    const lastLine = lines.pop();
    if (lastLine !== undefined) {
      buffer = lastLine;
    }
    for (const line of lines) {
      if (line.startsWith("data:")) {
        handleData(line.substring(5).trim());
      }
    }
  }

  if (buffer.startsWith("data:")) {
    handleData(buffer.substring(5).trim());
  }
};
