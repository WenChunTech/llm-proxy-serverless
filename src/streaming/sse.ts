import {
  claudeStreamWrapperConvertTo,
  geminiCliResponseConvertToGeminiResponse,
  geminiCliStreamWrapperConvertTo,
  geminiStreamWrapperConvertTo,
  newStreamState,
  openaiChatStreamWrapperConvertTo,
  openAIResponsesStreamWrapperConvertTo,
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
  } else if (sourceType === ProviderType.Gemini) {
    return geminiStreamWrapperConvertTo(wrapper, targetType);
  } else if (sourceType === ProviderType.Chat) {
    return openaiChatStreamWrapperConvertTo(wrapper, targetType);
  } else if (sourceType === ProviderType.Claude) {
    return claudeStreamWrapperConvertTo(wrapper, targetType);
  } else if (sourceType === ProviderType.Responses) {
    return openAIResponsesStreamWrapperConvertTo(wrapper, targetType);
  }
};

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
  console.log(
    `StreamEvent sourceType: ${ProviderType[sourceType]}, targetType: ${
      ProviderType[targetType]
    }`,
  );
  let state = newStreamState(sourceType, targetType);
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
        if (data && data !== "[DONE]") {
          let wrapper = {
            chunk: JSON.parse(data),
            state: state,
          };
          try {
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
          } catch (error) {
            logger.error(
              `[WASM] Stream response conversion failed (source=${
                ProviderType[sourceType]
              }, target=${ProviderType[targetType]}):`,
              error,
              `\nOriginal SSE chunk:`,
              data,
            );
            saveErrorLog({
              type: "response_conversion",
              error: {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
              },
              request: {
                sourceType: String(sourceType),
                targetType: String(targetType),
              },
              response: { body: data },
            }).catch(() => {});
            throw error;
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
        state: state,
      };
      try {
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
      } catch (error) {
        logger.error(
          `[WASM] Stream response conversion failed (source=${sourceType}, target=${targetType}):`,
          error,
          `\nOriginal SSE chunk:`,
          data,
        );
        saveErrorLog({
          type: "response_conversion",
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          request: {
            sourceType: ProviderType[sourceType],
            targetType: ProviderType[targetType],
          },
          response: { body: data },
        }).catch(() => {});
        throw error;
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
          try {
            const responseData = geminiCliResponseConvertToGeminiResponse(
              JSON.parse(data),
            );
            stream.writeSSE({
              data: JSON.stringify(responseData),
            });
          } catch (error) {
            logger.error(
              `[WASM] GeminiCli stream response conversion failed (source=GeminiCli, target=Gemini):`,
              error,
              `\nOriginal SSE chunk:`,
              data,
            );
            saveErrorLog({
              type: "response_conversion",
              error: {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
              },
              request: {
                sourceType: "GeminiCli",
                targetType: "Gemini",
              },
              response: { body: data },
            }).catch(() => {});
            throw error;
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
      try {
        const responseData = geminiCliResponseConvertToGeminiResponse(
          JSON.parse(data),
        );
        stream.writeSSE({
          data: JSON.stringify(responseData),
        });
      } catch (error) {
        logger.error(
          `[WASM] GeminiCli stream response conversion failed (source=GeminiCli, target=Gemini):`,
          error,
          `\nOriginal SSE chunk:`,
          data,
        );
        saveErrorLog({
          type: "response_conversion",
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          request: {
            sourceType: "GeminiCli",
            targetType: "Gemini",
          },
          response: { body: data },
        }).catch(() => {});
        throw error;
      }
    }
  }
};
