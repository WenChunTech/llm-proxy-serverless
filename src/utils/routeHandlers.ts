import { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { ProviderType } from "../../pkg/converter_wasm.js";
import { logger, RequestLogger } from "./logger.ts";
import { executeModelRequest } from "../services/requestExecution.ts";
import {
  getForwardableRequestHeaders,
  getProxyResponseHeaders,
  withUpstreamResponseHeaders,
} from "./httpHeaders.ts";

function proxyResponse(response: Response) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: getProxyResponseHeaders(response.headers),
  });
}

function applyUpstreamHeaders(c: Context, response: Response) {
  getProxyResponseHeaders(response.headers).forEach((value, name) => {
    c.header(name, value);
  });
}

function parseModelRequest(
  c: Context,
  targetType: ProviderType,
  body: Record<string, unknown>,
) {
  let isStreaming = body.stream;
  let model = body.model;

  if (targetType === ProviderType.Gemini) {
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
  targetType: ProviderType,
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

  const { response: resp, provider: actualProvider } =
    await executeModelRequest({
      model,
      targetType,
      isStreaming,
      body,
      requestLogger,
      forwardedHeaders: getForwardableRequestHeaders(c.req.raw.headers),
    });

  if (!resp.ok) {
    return proxyResponse(resp);
  }

  if (targetType === actualProvider.getProviderType()) {
    if (isStreaming) {
      applyUpstreamHeaders(c, resp);
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
    applyUpstreamHeaders(c, resp);
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

  const convertedResponse = await actualProvider.convertResponseTo(
    c,
    resp,
    targetType,
  );
  return withUpstreamResponseHeaders(convertedResponse, resp);
}
