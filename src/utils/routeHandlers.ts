import { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { TargetType } from "../../pkg/converter_wasm.js";
import { logger, RequestLogger } from "./logger.ts";
import { executeModelRequest } from "../services/requestExecution.ts";

function proxyResponse(response: Response) {
  const newHeaders = new Headers(response.headers);
  newHeaders.delete("content-encoding");
  newHeaders.delete("content-length");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

function parseModelRequest(
  c: Context,
  targetType: TargetType,
  body: Record<string, unknown>,
) {
  let isStreaming = body.stream;
  let model = body.model;

  if (targetType === TargetType.Gemini) {
    model = c.req.param("modelName").split(":")[0];
    isStreaming =
      c.req.param("modelName").split(":")[1] === "streamGenerateContent";
    body.model = model;
  }

  return {
    model: String(model),
    isStreaming: Boolean(isStreaming),
  };
}

export async function handleModelRequest(
  c: Context,
  targetType: TargetType,
) {
  const body = await c.req.json();

  const requestLogger = new RequestLogger();
  requestLogger.saveRequestBody(body);

  const { model, isStreaming } = parseModelRequest(c, targetType, body);

  logger.info("[request-entry]", {
    requestId: requestLogger.getRequestId(),
    method: c.req.method,
    path: c.req.path,
    targetType,
    model,
    isStreaming,
  });

  const { response: resp, provider: actualProvider } = await executeModelRequest({
    model,
    targetType,
    isStreaming,
    body,
    requestLogger,
  });

  if (!resp.ok) {
    return proxyResponse(resp);
  }

  if (targetType === actualProvider.getProviderType()) {
    if (isStreaming) {
      return streamSSE(c, async (stream) => {
        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            requestLogger.saveSSEDataLine(text);
            await stream.write(text);
          }
        } finally {
          reader.releaseLock();
        }
      });
    }
    const responseText = await resp.clone().text();
    requestLogger.saveRawResponse(responseText);
    return proxyResponse(resp);
  }

  if (isStreaming) {
    return streamSSE(c, async (stream) => {
      return actualProvider.convertStreamResponseTo(
        stream,
        resp,
        targetType,
        requestLogger,
      );
    });
  }

  const clonedResp = resp.clone();
  const responseText = await clonedResp.text();
  requestLogger.saveRawResponse(responseText);

  return actualProvider.convertResponseTo(c, resp, targetType);
}
