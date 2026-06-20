import { ProviderType } from "../../pkg/converter_wasm.js";
import { getProvider, getProviderInstance } from "../providers/factory.ts";
import type { Provider } from "../providers/_base/interface.ts";
import { logger, RequestLogger } from "../utils/logger.ts";
import { saveErrorLog } from "../services/errorLog.ts";
import {
  calculateBackoffDelay,
  getAllProvidersForModel,
  getFallbackChain,
  getProviderConfigs,
  isGeminiCliProvider,
  MAX_RETRIES,
} from "../utils/retryStrategy.ts";
import { supportsProjects } from "../providers/registry.ts";
import type { HeaderMap } from "../utils/httpHeaders.ts";

export interface ExecuteModelRequestParams {
  model: string;
  targetType: ProviderType;
  isStreaming: boolean;
  body: Record<string, unknown>;
  requestLogger: RequestLogger;
  forwardedHeaders?: HeaderMap;
}

export interface ExecuteModelRequestResult {
  response: Response;
  provider: Provider;
}

interface AttemptTarget {
  providerName: string;
  providerIndex: number;
  config: unknown;
  baseUrl: string;
  project?: string;
  projectIndex?: number;
}

type AttemptOutcome =
  | { kind: "success"; result: ExecuteModelRequestResult }
  | {
    kind: "failure";
    result?: ExecuteModelRequestResult;
    error?: Error;
  };

function withStreamingFlag(
  provider: Provider,
  req: Record<string, unknown>,
  isStreaming: boolean,
): Record<string, unknown> {
  if (
    provider.getProviderType() !== ProviderType.Gemini &&
    provider.getProviderType() !== ProviderType.GeminiCli
  ) {
    return { ...req, stream: isStreaming };
  }

  return req;
}

async function buildProviderRequest(
  provider: Provider,
  body: Record<string, unknown>,
  targetType: ProviderType,
  isStreaming: boolean,
) {
  try {
    const converted = await provider.convertRequestTo(body, targetType);
    return withStreamingFlag(provider, converted, isStreaming);
  } catch (error) {
    const providerType = provider.getProviderType();
    logger.error(
      `[WASM] Request conversion failed (source=${
        ProviderType[targetType]
      }, target=${ProviderType[providerType]}):`,
      error,
      `\nOriginal request body:`,
      JSON.stringify(body, null, 2),
    );
    saveErrorLog({
      type: "request_conversion",
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      request: {
        body,
        sourceType: ProviderType[targetType],
        targetType: ProviderType[provider.getProviderType()],
      },
    }).catch(() => {});
    throw error;
  }
}

function buildAttemptLogDetails(
  requestId: string,
  model: string,
  providerName: string,
  attempt: number,
  providerIndex: number,
  baseUrl: string,
  projectIndex?: number,
  project?: string,
) {
  return {
    requestId,
    model,
    provider: providerName,
    // attempt 是全局重试次数（1-5）
    attempt,
    // provider_slot 表示提供商序号
    provider_slot: `${providerIndex + 1}`,
    // base_url 表示实际使用的配置地址
    base_url: baseUrl,
    ...(projectIndex !== undefined
      ? { project_slot: `${projectIndex + 1}` }
      : {}),
    ...(project !== undefined ? { project } : {}),
  };
}

function logProviderAttempt(
  requestId: string,
  model: string,
  providerName: string,
  attempt: number,
  providerIndex: number,
  baseUrl: string,
  projectIndex?: number,
  project?: string,
) {
  logger.info(
    "[provider-attempt]",
    buildAttemptLogDetails(
      requestId,
      model,
      providerName,
      attempt,
      providerIndex,
      baseUrl,
      projectIndex,
      project,
    ),
  );
}

async function extractErrorMessage(resp: Response): Promise<string> {
  try {
    const cloned = resp.clone();
    const body = await cloned.json();
    return body?.error?.message || body?.message || JSON.stringify(body);
  } catch {
    try {
      return await resp.clone().text();
    } catch {
      return "(unable to read response body)";
    }
  }
}

function buildAttemptTargets(
  providers: string[],
  model: string,
): AttemptTarget[] {
  const targets: AttemptTarget[] = [];

  for (let pIdx = 0; pIdx < providers.length; pIdx++) {
    const providerName = providers[pIdx];
    const configs = getProviderConfigs(providerName);
    const isGeminiCli = isGeminiCliProvider(providerName);

    for (const config of configs) {
      if (!config.models.includes(model)) continue;

      const baseUrl = (config as any).base_url || "unknown";

      if (isGeminiCli && supportsProjects(config)) {
        const projects = (config as { projects?: string[] }).projects || [];
        for (let projectIdx = 0; projectIdx < projects.length; projectIdx++) {
          targets.push({
            providerName,
            providerIndex: pIdx,
            config,
            baseUrl,
            project: projects[projectIdx],
            projectIndex: projectIdx,
          });
        }
      } else {
        targets.push({
          providerName,
          providerIndex: pIdx,
          config,
          baseUrl,
        });
      }
    }
  }

  return targets;
}

async function tryAttemptTarget(
  target: AttemptTarget,
  model: string,
  isStreaming: boolean,
  reqData: Record<string, unknown>,
  requestId: string,
  attempt: number,
  forwardedHeaders?: HeaderMap,
): Promise<AttemptOutcome> {
  const {
    providerName,
    providerIndex,
    config,
    baseUrl,
    project,
    projectIndex,
  } = target;
  const currentProvider = getProviderInstance(providerName, model) as Provider;

  logProviderAttempt(
    requestId,
    model,
    providerName,
    attempt,
    providerIndex,
    baseUrl,
    projectIndex,
    project,
  );

  const baseDetails = buildAttemptLogDetails(
    requestId,
    model,
    providerName,
    attempt,
    providerIndex,
    baseUrl,
    projectIndex,
    project,
  );

  let resp: Response;
  try {
    resp = await currentProvider.fetchResponse(
      isStreaming,
      reqData,
      config,
      project,
      forwardedHeaders,
    );
  } catch (error) {
    const err = error as Error;
    logger.error("[provider-attempt-failed]", {
      ...baseDetails,
      error: err.message,
    });
    return { kind: "failure", error: err };
  }

  if (resp.ok) {
    logger.info("[provider-attempt-succeeded]", {
      ...baseDetails,
      status: resp.status,
    });
    return {
      kind: "success",
      result: { response: resp, provider: currentProvider },
    };
  }

  const errorMsg = await extractErrorMessage(resp);
  logger.warn("[provider-attempt-response]", {
    ...baseDetails,
    status: resp.status,
    error_msg: errorMsg,
  });

  if (resp.status === 500) {
    try {
      await saveErrorLog({
        type: "response_500",
        error: { message: `Provider returned status ${resp.status}` },
        request: {
          body: reqData,
          targetType: ProviderType[currentProvider.getProviderType()],
          model,
          requestId,
          provider: providerName,
          baseUrl,
          attempt,
          providerSlot: `${providerIndex + 1}`,
          project,
          ...(projectIndex !== undefined
            ? { projectSlot: `${projectIndex + 1}` }
            : {}),
        },
        response: { status: resp.status, body: errorMsg },
      });
    } catch (error) {
      logger.error("[provider-response-500-log-failed]", {
        ...baseDetails,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    kind: "failure",
    result: { response: resp, provider: currentProvider },
  };
}

async function executeSingleModelRequest(
  model: string,
  targetType: ProviderType,
  isStreaming: boolean,
  reqData: Record<string, unknown>,
  requestLogger: RequestLogger,
  forwardedHeaders?: HeaderMap,
): Promise<ExecuteModelRequestResult | null> {
  const requestId = requestLogger.getRequestId();
  const providers = getAllProvidersForModel(model);
  const fallbackProvider = getProvider(model);

  if (providers.length === 0) {
    const response = await fallbackProvider.fetchResponse(
      isStreaming,
      reqData,
      undefined,
      undefined,
      forwardedHeaders,
    );
    return { response, provider: fallbackProvider };
  }

  const targets = buildAttemptTargets(providers, model);

  let lastResult: ExecuteModelRequestResult | null = null;
  let lastError: Error | undefined;

  // 最多尝试 MAX_RETRIES 次（每轮遍历所有提供商/配置/项目）
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let foundValidProvider = false;

    for (const target of targets) {
      foundValidProvider = true;

      const outcome = await tryAttemptTarget(
        target,
        model,
        isStreaming,
        reqData,
        requestId,
        attempt,
        forwardedHeaders,
      );

      if (outcome.kind === "success") {
        return outcome.result;
      }

      if (outcome.error) {
        lastError = outcome.error;
      }
      if (outcome.result) {
        lastResult = outcome.result;
      }
    }

    // 如果这一轮没有有效的提供商/配置，或已达最大重试次数
    if (!foundValidProvider || attempt >= MAX_RETRIES) {
      break;
    }

    // 计算退避延迟并 sleep
    const delayMs = calculateBackoffDelay(attempt);
    logger.info("[retry-backoff]", {
      requestId,
      model,
      attempt,
      nextAttemptAfterMs: delayMs,
    });
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  if (lastResult) {
    return lastResult;
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

export async function executeModelRequest(
  params: ExecuteModelRequestParams,
): Promise<ExecuteModelRequestResult> {
  const {
    model,
    targetType,
    isStreaming,
    body,
    requestLogger,
    forwardedHeaders,
  } = params;
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
      forwardedHeaders,
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
