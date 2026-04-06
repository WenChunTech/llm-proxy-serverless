import {
  claudeStreamWrapperConvertTo,
  geminiCliResponseConvertToGeminiResponse,
  geminiCliStreamWrapperConvertTo,
  geminiStreamWrapperConvertTo,
  getDefaultStreamState,
  openaiStreamWrapperConvertTo,
  TargetType,
} from "../../pkg/converter_wasm.js";
import { RequestLogger } from "../utils/logger.ts";

const responseConvert = (
  wrapper: any,
  sourceType: TargetType,
  targetType: TargetType,
) => {
  if (sourceType === TargetType.GeminiCli) {
    return geminiCliStreamWrapperConvertTo(wrapper, targetType);
  } else if (sourceType === TargetType.Gemini) {
    return geminiStreamWrapperConvertTo(wrapper, targetType);
  } else if (sourceType === TargetType.OpenAI) {
    return openaiStreamWrapperConvertTo(wrapper, targetType);
  } else if (sourceType === TargetType.Claude) {
    return claudeStreamWrapperConvertTo(wrapper, targetType);
  }
};

export const StreamEvent = async (
  stream: any,
  response: Response,
  sourceType: TargetType,
  targetType: TargetType,
  requestLogger?: RequestLogger,
) => {
  if (!response.body) {
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let state = getDefaultStreamState();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunkText = decoder.decode(value, { stream: true });
    buffer += chunkText;
    const lines = buffer.split("\n");
    const lastLine = lines.pop();
    if (lastLine !== undefined) {
      buffer = lastLine;
    }
    for (const line of lines) {
      if (line.startsWith("data:")) {
        if (requestLogger) {
          requestLogger.saveSSEDataLine(line);
        }
        const data = line.substring(5).trim();
        if (data) {
          let wrapper = {
            chunk: JSON.parse(data),
            state: state,
          };
          const streams_wrapper = responseConvert(
            wrapper,
            sourceType,
            targetType,
          );
          state = streams_wrapper.state;
          let chunks = streams_wrapper.chunks;
          for (const chunk of chunks) {
            stream.writeSSE({
              event: chunk.type,
              data: JSON.stringify(chunk),
            });
          }
        }
      }
    }
  }

  if (buffer.startsWith("data:")) {
    if (requestLogger) {
      requestLogger.saveSSEDataLine(buffer);
    }
    const data = buffer.substring(5).trim();
    if (data) {
      let wrapper = {
        chunk: JSON.parse(data),
        inner: state,
      };
      const streams_wrapper = responseConvert(wrapper, sourceType, targetType);
      state = streams_wrapper.inner;
      let chunks = streams_wrapper.chunks;
      for (const chunk of chunks) {
        stream.writeSSE({
          event: chunk.type,
          data: JSON.stringify(chunk),
        });
      }
    }
  }
};

export const geminiCliStreamResponseConvertToGeminiStreamResponse = async (
  stream: any,
  response: Response,
  requestLogger?: RequestLogger,
) => {
  if (!response.body) {
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunkText = decoder.decode(value, { stream: true });
    buffer += chunkText;
    const lines = buffer.split("\n");
    const lastLine = lines.pop();
    if (lastLine !== undefined) {
      buffer = lastLine;
    }
    for (const line of lines) {
      if (line.startsWith("data:")) {
        if (requestLogger) {
          requestLogger.saveSSEDataLine(line);
        }
        const data = line.substring(5).trim();
        if (data) {
          const responseData = geminiCliResponseConvertToGeminiResponse(
            JSON.parse(data),
          );
          stream.writeSSE({
            data: JSON.stringify(responseData),
          });
        }
      }
    }
  }

  if (buffer.startsWith("data:")) {
    if (requestLogger) {
      requestLogger.saveSSEDataLine(buffer);
    }
    const data = buffer.substring(5).trim();
    if (data) {
      const responseData = geminiCliResponseConvertToGeminiResponse(
        JSON.parse(data),
      );
      stream.writeSSE({
        data: JSON.stringify(responseData),
      });
    }
  }
};
