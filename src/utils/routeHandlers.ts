import { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { TargetType } from "../../pkg/converter_wasm.js";
import { getProvider } from "../providers/factory.ts";
import { RequestLogger } from "./logger.ts";
import {
  getAllProvidersForModel,
  getProviderConfigs,
  isGeminiCliProvider,
  getFallbackModel,
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

export async function handleModelRequest(
  c: Context,
  targetType: TargetType,
) {
  const body = await c.req.json();

  const requestLogger = new RequestLogger();

  requestLogger.saveRequestBody(JSON.parse(JSON.stringify(body)));

  let is_streaming = body.stream;
  let model = body.model;
  if (targetType === TargetType.Gemini) {
    model = c.req.param("modelName").split(":")[0];
    is_streaming =
      c.req.param("modelName").split(":")[1] === "streamGenerateContent";
    body.model = model;
  }

  const provider = getProvider(model);
  const req: any = await provider.convertRequestTo(body, targetType);
  if (
    provider.getProviderType() != TargetType.Gemini &&
    provider.getProviderType() != TargetType.GeminiCli
  ) {
    req.stream = is_streaming;
  }

  const resp = await retryWithSwitch(
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

  if (targetType == provider.getProviderType()) {
    const clonedResp = resp.clone();
    const responseText = await clonedResp.text();
    requestLogger.saveRawResponse(responseText);
    return proxyResponse(resp);
  }
  if (is_streaming) {
    return streamSSE(c, async (stream) => {
      return provider.convertStreamResponseTo(
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

  return provider.convertResponseTo(c, resp, targetType);
}

async function retryWithSwitch(
  model: string,
  targetType: TargetType,
  isStreaming: boolean,
  reqData: any,
  requestLogger: RequestLogger,
  provider: any,
): Promise<Response> {
  const providers = getAllProvidersForModel(model);
  if (providers.length === 0) {
    return provider.fetchResponse(isStreaming, reqData);
  }

  const state = {
    providerIndex: 0,
    configIndices: new Map<string, number>(),
    projectIndices: new Map<string, number>(),
    attempt: 0,
    lastError: undefined as Error | undefined,
    lastResponse: undefined as Response | undefined,
  };

  for (const p of providers) {
    state.configIndices.set(p, 0);
    state.projectIndices.set(p, 0);
  }

  while (state.attempt < MAX_RETRIES) {
    if (state.providerIndex >= providers.length) {
      const fallbackModel = getFallbackModel(model);
      if (fallbackModel) {
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
        const fallbackResp = await retryWithSwitch(
          fallbackModel,
          targetType,
          isStreaming,
          fallbackReq,
          requestLogger,
          fallbackProvider,
        );
        if (fallbackResp.ok) {
          return fallbackResp;
        }
      }
      if (state.lastResponse) {
        return state.lastResponse;
      }
      throw state.lastError || new Error("All providers exhausted");
    }

    const providerName = providers[state.providerIndex];
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

    let resp: Response;
    try {
      resp = await provider.fetchResponse(isStreaming, reqData, config, project);
    } catch (error) {
      state.lastError = error as Error;
      state.attempt++;
      if (isGeminiCliProvider(providerName)) {
        state.projectIndices.set(providerName, projectIndex + 1);
      } else {
        state.configIndices.set(providerName, configIndex + 1);
      }
      continue;
    }

    if (resp.ok) {
      return resp;
    }

    state.lastResponse = resp;
    state.attempt++;

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

  if (state.providerIndex >= providers.length) {
    const fallbackModel = getFallbackModel(model);
    if (fallbackModel) {
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
      return retryWithSwitch(
        fallbackModel,
        targetType,
        isStreaming,
        fallbackReq,
        requestLogger,
        fallbackProvider,
      );
    }
  }

  if (state.lastResponse) {
    return state.lastResponse;
  }
  throw state.lastError || new Error("Max retries exceeded");
}