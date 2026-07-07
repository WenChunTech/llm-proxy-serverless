import { Context } from 'hono';
import { streamSSE } from "hono/streaming";
import { ProviderType } from "../../pkg/converter_wasm";
import { logger, RequestLogger } from "./logger";
import { saveErrorLog } from "../services/errorLog";
import {
  executeModelRequest,
  ModelNotConfiguredError,
} from "../services/requestExecution";
import {
  getForwardableRequestHeaders,
  getProxyResponseHeaders,
  withUpstreamResponseHeaders,
} from "./httpHeaders";

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
  const originalBody = structuredClone(body) as Record<string, unknown>;

  const requestLogger = new RequestLogger();
  requestLogger.saveRequestBody(body);

  const { model, isStreaming } = parseModelRequest(c, targetType, body);

  logger.info("[request-entry]", {
    requestId: requestLogger.getRequestId(),
    method: c.req.method,
    path: c.req.path,
    targetType: ProviderType[targetType],
    model,
    isStreaming,
  });

  let resp: Response;
  let actualProvider;
  try {
    ({ response: resp, provider: actualProvider } = await executeModelRequest({
      model,
      targetType,
      isStreaming,
      body,
      originalBody,
      requestLogger,
      forwardedHeaders: getForwardableRequestHeaders(c.req.raw.headers),
    }));
  } catch (error) {
    if (error instanceof ModelNotConfiguredError) {
      return c.json({
        error: {
          message: `Model '${model}' not found in any provider configuration`,
          type: "invalid_request_error",
          code: "model_not_found",
        },
      }, 400);
    }
    throw error;
  }

  if (!resp.ok) return proxyResponse(resp);

  if (targetType === actualProvider.getProviderType()) {
    if (isStreaming) {
      applyUpstreamHeaders(c, resp);
      return streamSSE(c, async (stream) => {
        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        stream.onAbort(() => { reader.cancel().catch(() => {}); });
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            requestLogger.saveSSEDataLine(text);
            await stream.write(text);
          }
        } catch (error) {
          logger.error("[stream-passthrough-error]", {
            requestId: requestLogger.getRequestId(),
            error: error instanceof Error ? error.message : String(error),
          });
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
      stream.onAbort(() => { resp.body?.getReader().cancel().catch(() => {}); });
      try {
        await actualProvider.convertStreamResponseTo(
          stream,
          resp,
          targetType,
          requestLogger,
        );
      } catch (error) {
        logger.error("[stream-conversion-error]", {
          requestId: requestLogger.getRequestId(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  const clonedResp = resp.clone();
  const responseText = await clonedResp.text();
  requestLogger.saveRawResponse(responseText);

  try {
    const convertedResponse = await actualProvider.convertResponseTo(
      c,
      resp,
      targetType,
    );
    return withUpstreamResponseHeaders(convertedResponse, resp);
  } catch (error) {
    const providerType = actualProvider.getProviderType();
    logger.error(
      `[WASM] Response conversion failed (source=${
        ProviderType[providerType]
      }, target=${ProviderType[targetType]}):`,
      error,
      `\nOriginal response body:`,
      responseText,
    );
    saveErrorLog({
      type: "response_conversion",
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      request: {
        sourceType: ProviderType[actualProvider.getProviderType()],
        targetType: ProviderType[targetType],
      },
      response: { body: responseText },
    }).catch((err) => {
      logger.error("[saveErrorLog-failed]", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
    throw error;
  }
}
