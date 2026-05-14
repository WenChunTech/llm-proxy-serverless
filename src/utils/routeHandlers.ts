import { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { TargetType } from "../../pkg/converter_wasm.js";
import { getProvider, getProviderInstance } from "../providers/factory.ts";
import type { Provider } from "../providers/_base/interface.ts";
import { logger, RequestLogger } from "./logger.ts";
import {
  getAllProvidersForModel,
  getFallbackModel,
  getProviderConfigs,
  isGeminiCliProvider,
  MAX_RETRIES,
} from "./retryStrategy.ts";

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

type RetryResult = {
  response: Response;
  provider: Provider;
};

function logProviderAttempt(
  requestId: string,
  model: string,
  providerName: string,
  attempt: number,
  providerIndex: number,
  configIndex: number,
  projectIndex?: number,
  project?: string,
) {
  logger.info("[provider-attempt]", {
    requestId,
    model,
    providerName,
    attempt,
    providerIndex,
    configIndex,
    ...(projectIndex !== undefined ? { projectIndex } : {}),
    ...(project !== undefined ? { project } : {}),
  });
}

export async function handleModelRequest(
  c: Context,
  targetType: TargetType,
) {
  const body = await c.req.json();

  const requestLogger = new RequestLogger();
  requestLogger.saveRequestBody(body);

  let is_streaming = body.stream;
  let model = body.model;
  if (targetType === TargetType.Gemini) {
    model = c.req.param("modelName").split(":")[0];
    is_streaming =
      c.req.param("modelName").split(":")[1] === "streamGenerateContent";
    body.model = model;
  }

  logger.info("[request-entry]", {
    requestId: requestLogger.getRequestId(),
    method: c.req.method,
    path: c.req.path,
    targetType,
    model,
    isStreaming: Boolean(is_streaming),
  });

  const provider = getProvider(model);
  const req: any = await provider.convertRequestTo(body, targetType);
  if (
    provider.getProviderType() != TargetType.Gemini &&
    provider.getProviderType() != TargetType.GeminiCli
  ) {
    req.stream = is_streaming;
  }

  const { response: resp, provider: actualProvider } = await retryWithSwitch(
    model,
    targetType,
    is_streaming,
    req,
    requestLogger,
    provider,
  );

  if (!resp.ok) {
    return proxyResponse(resp);
  }

  if (targetType == actualProvider.getProviderType()) {
    if (is_streaming) {
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
  if (is_streaming) {
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

async function prepareFallbackRequest(
  model: string,
  targetType: TargetType,
  isStreaming: boolean,
  reqData: Record<string, unknown>,
) {
  const fallbackModel = getFallbackModel(model);
  if (!fallbackModel) return null;

  const fallbackProvider = getProvider(fallbackModel);
  const fallbackReq = await fallbackProvider.convertRequestTo(
    { ...reqData, model: fallbackModel },
    targetType,
  );
  if (
    fallbackProvider.getProviderType() != TargetType.Gemini &&
    fallbackProvider.getProviderType() != TargetType.GeminiCli
  ) {
    fallbackReq.stream = isStreaming;
  }
  return { fallbackModel, fallbackProvider, fallbackReq };
}

async function retryWithSwitch(
  model: string,
  targetType: TargetType,
  isStreaming: boolean,
  reqData: any,
  requestLogger: RequestLogger,
  provider: Provider,
): Promise<RetryResult> {
  const requestId = requestLogger.getRequestId();
  const providers = getAllProvidersForModel(model);
  if (providers.length === 0) {
    const response = await provider.fetchResponse(isStreaming, reqData);
    return { response, provider };
  }

  const state = {
    providerIndex: 0,
    configIndices: new Map<string, number>(),
    projectIndices: new Map<string, number>(),
    attempt: 0,
    lastError: undefined as Error | undefined,
    lastResponse: undefined as Response | undefined,
    lastProvider: undefined as Provider | undefined,
  };

  for (const p of providers) {
    state.configIndices.set(p, 0);
    state.projectIndices.set(p, 0);
  }

  while (state.attempt < MAX_RETRIES) {
    if (state.providerIndex >= providers.length) {
      const fallback = await prepareFallbackRequest(model, targetType, isStreaming, reqData);
      if (fallback) {
        const { fallbackModel, fallbackProvider, fallbackReq } = fallback;
        logger.info("[fallback-model]", {
          requestId,
          model,
          fallbackModel,
        });
        const fallbackResp = await retryWithSwitch(
          fallbackModel,
          targetType,
          isStreaming,
          fallbackReq,
          requestLogger,
          fallbackProvider,
        );
        if (fallbackResp.response.ok) {
          return fallbackResp;
        }
      }
      if (state.lastResponse && state.lastProvider) {
        return { response: state.lastResponse, provider: state.lastProvider };
      }
      throw state.lastError || new Error("All providers exhausted");
    }

    const providerName = providers[state.providerIndex];
    const currentProvider = getProviderInstance(providerName, model) as Provider;
    const configs = getProviderConfigs(providerName);
    const configIndex = state.configIndices.get(providerName) || 0;
    const projectIndex = state.projectIndices.get(providerName) || 0;

    const config = configs[configIndex];
    if (!config || !config.models.includes(model)) {
      state.providerIndex++;
      continue;
    }

    let project: string | undefined;
    if (isGeminiCliProvider(providerName)) {
      if (projectIndex >= config.projects.length) {
        state.configIndices.set(providerName, configIndex + 1);
        state.projectIndices.set(providerName, 0);
        continue;
      }
      project = config.projects[projectIndex];
    }

    logProviderAttempt(
      requestId,
      model,
      providerName,
      state.attempt + 1,
      state.providerIndex,
      configIndex,
      isGeminiCliProvider(providerName) ? projectIndex : undefined,
      project,
    );

    let resp: Response;
    try {
      resp = await currentProvider.fetchResponse(
        isStreaming,
        reqData,
        config,
        project,
      );
    } catch (error) {
      state.lastError = error as Error;
      state.attempt++;
      logger.error("[provider-attempt-failed]", {
        requestId,
        model,
        providerName,
        attempt: state.attempt,
        providerIndex: state.providerIndex,
        configIndex,
        ...(isGeminiCliProvider(providerName) ? { projectIndex, project } : {}),
        error: state.lastError.message,
      });
      if (isGeminiCliProvider(providerName)) {
        state.projectIndices.set(providerName, projectIndex + 1);
      } else {
        state.configIndices.set(providerName, configIndex + 1);
      }
      continue;
    }

    if (resp.ok) {
      logger.info("[provider-attempt-succeeded]", {
        requestId,
        model,
        providerName,
        attempt: state.attempt + 1,
        providerIndex: state.providerIndex,
        configIndex,
        ...(isGeminiCliProvider(providerName) ? { projectIndex, project } : {}),
        status: resp.status,
      });
      return { response: resp, provider: currentProvider };
    }

    state.lastResponse = resp;
    state.lastProvider = currentProvider;
    state.attempt++;

    logger.warn("[provider-attempt-response]", {
      requestId,
      model,
      providerName,
      attempt: state.attempt,
      providerIndex: state.providerIndex,
      configIndex,
      ...(isGeminiCliProvider(providerName) ? { projectIndex, project } : {}),
      status: resp.status,
      statusText: resp.statusText,
    });

    if (resp.status >= 400 && resp.status < 500) {
      state.providerIndex++;
      continue;
    }

    if (isGeminiCliProvider(providerName)) {
      state.projectIndices.set(providerName, projectIndex + 1);
    } else {
      state.configIndices.set(providerName, configIndex + 1);
    }
  }

  const fallback = await prepareFallbackRequest(model, targetType, isStreaming, reqData);
  if (fallback) {
    const { fallbackModel, fallbackProvider, fallbackReq } = fallback;
    logger.info("[fallback-model]", {
      requestId,
      model,
      fallbackModel,
    });
    return retryWithSwitch(
      fallbackModel,
      targetType,
      isStreaming,
      fallbackReq,
      requestLogger,
      fallbackProvider,
    );
  }

  if (state.lastResponse && state.lastProvider) {
    return { response: state.lastResponse, provider: state.lastProvider };
  }
  throw state.lastError || new Error("Max retries exceeded");
}
