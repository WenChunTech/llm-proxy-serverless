import { TargetType } from "../../pkg/converter_wasm.js";
import { getProvider, getProviderInstance } from "../providers/factory.ts";
import type { Provider } from "../providers/_base/interface.ts";
import { logger, RequestLogger } from "../utils/logger.ts";
import {
  getAllProvidersForModel,
  getFallbackChain,
  getProviderConfigs,
  isGeminiCliProvider,
  MAX_RETRIES,
} from "../utils/retryStrategy.ts";
import { supportsProjects } from "../providers/registry.ts";

export interface ExecuteModelRequestParams {
  model: string;
  targetType: TargetType;
  isStreaming: boolean;
  body: Record<string, unknown>;
  requestLogger: RequestLogger;
}

export interface ExecuteModelRequestResult {
  response: Response;
  provider: Provider;
}

function withStreamingFlag(
  provider: Provider,
  req: Record<string, unknown>,
  isStreaming: boolean,
): Record<string, unknown> {
  if (
    provider.getProviderType() !== TargetType.Gemini &&
    provider.getProviderType() !== TargetType.GeminiCli
  ) {
    return { ...req, stream: isStreaming };
  }

  return req;
}

async function buildProviderRequest(
  provider: Provider,
  body: Record<string, unknown>,
  targetType: TargetType,
  isStreaming: boolean,
) {
  const converted = await provider.convertRequestTo(body, targetType);
  return withStreamingFlag(provider, converted, isStreaming);
}

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

async function executeSingleModelRequest(
  model: string,
  targetType: TargetType,
  isStreaming: boolean,
  reqData: Record<string, unknown>,
  requestLogger: RequestLogger,
): Promise<ExecuteModelRequestResult | null> {
  const requestId = requestLogger.getRequestId();
  const providers = getAllProvidersForModel(model);
  const fallbackProvider = getProvider(model);

  if (providers.length === 0) {
    const response = await fallbackProvider.fetchResponse(isStreaming, reqData);
    return { response, provider: fallbackProvider };
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

  for (const providerName of providers) {
    state.configIndices.set(providerName, 0);
    state.projectIndices.set(providerName, 0);
  }

  while (
    state.attempt < MAX_RETRIES && state.providerIndex < providers.length
  ) {
    const providerName = providers[state.providerIndex];
    const currentProvider = getProviderInstance(
      providerName,
      model,
    ) as Provider;
    const configs = getProviderConfigs(providerName);
    const configIndex = state.configIndices.get(providerName) || 0;
    const projectIndex = state.projectIndices.get(providerName) || 0;

    const config = configs[configIndex];
    if (!config || !config.models.includes(model)) {
      state.providerIndex++;
      continue;
    }

    let project: string | undefined;
    if (isGeminiCliProvider(providerName) && supportsProjects(config)) {
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

  if (state.lastResponse && state.lastProvider) {
    return { response: state.lastResponse, provider: state.lastProvider };
  }

  if (state.lastError) {
    throw state.lastError;
  }

  return null;
}

export async function executeModelRequest(
  params: ExecuteModelRequestParams,
): Promise<ExecuteModelRequestResult> {
  const { model, targetType, isStreaming, body, requestLogger } = params;
  const modelsToTry = [model, ...getFallbackChain(model)];

  let lastResult: ExecuteModelRequestResult | null = null;

  for (let index = 0; index < modelsToTry.length; index++) {
    const currentModel = modelsToTry[index];
    if (index > 0) {
      logger.info("[fallback-model]", {
        requestId: requestLogger.getRequestId(),
        model: modelsToTry[index - 1],
        fallbackModel: currentModel,
      });
    }

    const provider = getProvider(currentModel);
    const request = await buildProviderRequest(
      provider,
      { ...body, model: currentModel },
      targetType,
      isStreaming,
    );

    const result = await executeSingleModelRequest(
      currentModel,
      targetType,
      isStreaming,
      request,
      requestLogger,
    );

    if (!result) {
      continue;
    }

    if (result.response.ok) {
      return result;
    }

    lastResult = result;
  }

  if (lastResult) {
    return lastResult;
  }

  throw new Error("All providers exhausted");
}
