import { ProviderType } from "../../pkg/converter_wasm.js";
import { getProvider, getProviderInstance } from "../providers/factory.ts";
import type { Provider } from "../providers/_base/interface.ts";
import { logger, RequestLogger } from "../utils/logger.ts";
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
  const converted = await provider.convertRequestTo(body, targetType);
  return withStreamingFlag(provider, converted, isStreaming);
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
  const details = {
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
  logger.info("[provider-attempt]", details);
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

  // 构建提供商配置表
  interface ProviderSlot {
    name: string;
    configs: Array<{
      configIndex: number;
      projectIndices?: number[];
      config: unknown;
    }>;
  }

  const providerSlots: ProviderSlot[] = providers.map((providerName) => ({
    name: providerName,
    configs: [],
  }));

  // 初始化每个提供商的所有可用配置
  for (let pIdx = 0; pIdx < providers.length; pIdx++) {
    const providerName = providers[pIdx];
    const configs = getProviderConfigs(providerName);
    for (let cIdx = 0; cIdx < configs.length; cIdx++) {
      const config = configs[cIdx];
      if (config.models.includes(model)) {
        if (isGeminiCliProvider(providerName) && supportsProjects(config)) {
          const geminiCliConfig = config as { projects?: string[] };
          const projectCount = geminiCliConfig.projects?.length || 0;
          providerSlots[pIdx].configs.push({
            configIndex: cIdx,
            projectIndices: Array.from({ length: projectCount }, (_, i) => i),
            config,
          });
        } else {
          providerSlots[pIdx].configs.push({
            configIndex: cIdx,
            config,
          });
        }
      }
    }
  }

  let lastResult: ExecuteModelRequestResult | null = null;
  let lastError: Error | undefined;

  // 最多尝试 MAX_RETRIES 次（循环处理所有提供商/配置）
  for (let globalAttempt = 1; globalAttempt <= MAX_RETRIES; globalAttempt++) {
    let foundValidProvider = false;

    // 遍历所有提供商及其配置
    for (let pIdx = 0; pIdx < providerSlots.length; pIdx++) {
      const slot = providerSlots[pIdx];
      const providerName = slot.name;
      const currentProvider = getProviderInstance(
        providerName,
        model,
      ) as Provider;

      // 遍历该提供商的所有配置
      for (let configEntry of slot.configs) {
        const config = configEntry.config as any;

        // 如果是 GeminiCli，遍历项目
        if (isGeminiCliProvider(providerName) && configEntry.projectIndices) {
          const geminiCliConfig = config as { projects?: string[] };
          const projects = geminiCliConfig.projects || [];

          for (let projectIdx of configEntry.projectIndices) {
            const project = projects[projectIdx];
            const baseUrl = (config as any).base_url || "unknown";

            foundValidProvider = true;
            logProviderAttempt(
              requestId,
              model,
              providerName,
              globalAttempt,
              pIdx,
              baseUrl,
              projectIdx,
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
              lastError = error as Error;
              logger.error("[provider-attempt-failed]", {
                requestId,
                model,
                provider: providerName,
                attempt: globalAttempt,
                provider_slot: `${pIdx + 1}`,
                base_url: baseUrl,
                project_slot: `${projectIdx + 1}`,
                project,
                error: lastError.message,
              });
              continue;
            }

            if (resp.ok) {
              logger.info("[provider-attempt-succeeded]", {
                requestId,
                model,
                provider: providerName,
                attempt: globalAttempt,
                provider_slot: `${pIdx + 1}`,
                base_url: baseUrl,
                project_slot: `${projectIdx + 1}`,
                project,
                status: resp.status,
              });
              return { response: resp, provider: currentProvider };
            }

            lastResult = { response: resp, provider: currentProvider };

            let errorMsg = "";
            try {
              const cloned = resp.clone();
              const body = await cloned.json();
              errorMsg = body?.error?.message || body?.message ||
                JSON.stringify(body);
            } catch {
              try {
                errorMsg = await resp.clone().text();
              } catch {
                errorMsg = "(unable to read response body)";
              }
            }

            logger.warn("[provider-attempt-response]", {
              requestId,
              model,
              provider: providerName,
              attempt: globalAttempt,
              provider_slot: `${pIdx + 1}`,
              base_url: baseUrl,
              project_slot: `${projectIdx + 1}`,
              project,
              status: resp.status,
              error_msg: errorMsg,
            });

            // 4xx 错误跳过该项目
            if (resp.status >= 400 && resp.status < 500) {
              continue;
            }
          }
        } else {
          // 非 GeminiCli 提供商
          const baseUrl = (config as any).base_url || "unknown";
          foundValidProvider = true;
          logProviderAttempt(
            requestId,
            model,
            providerName,
            globalAttempt,
            pIdx,
            baseUrl,
          );

          let resp: Response;
          try {
            resp = await currentProvider.fetchResponse(
              isStreaming,
              reqData,
              config,
              undefined,
              forwardedHeaders,
            );
          } catch (error) {
            lastError = error as Error;
            logger.error("[provider-attempt-failed]", {
              requestId,
              model,
              provider: providerName,
              attempt: globalAttempt,
              provider_slot: `${pIdx + 1}`,
              base_url: baseUrl,
              error: lastError.message,
            });
            continue;
          }

          if (resp.ok) {
            logger.info("[provider-attempt-succeeded]", {
              requestId,
              model,
              provider: providerName,
              attempt: globalAttempt,
              provider_slot: `${pIdx + 1}`,
              base_url: baseUrl,
              status: resp.status,
            });
            return { response: resp, provider: currentProvider };
          }

          lastResult = { response: resp, provider: currentProvider };

          let errorMsg = "";
          try {
            const cloned = resp.clone();
            const body = await cloned.json();
            errorMsg = body?.error?.message || body?.message ||
              JSON.stringify(body);
          } catch {
            try {
              errorMsg = await resp.clone().text();
            } catch {
              errorMsg = "(unable to read response body)";
            }
          }

          logger.warn("[provider-attempt-response]", {
            requestId,
            model,
            provider: providerName,
            attempt: globalAttempt,
            provider_slot: `${pIdx + 1}`,
            base_url: baseUrl,
            status: resp.status,
            error_msg: errorMsg,
          });

          // 4xx 错误跳过该配置
          if (resp.status >= 400 && resp.status < 500) {
            continue;
          }
        }
      }
    }

    // 如果这一轮没有有效的提供商/配置，或已达最大重试次数
    if (!foundValidProvider || globalAttempt >= MAX_RETRIES) {
      break;
    }

    // 计算退避延迟并 sleep
    const delayMs = calculateBackoffDelay(globalAttempt);
    logger.info("[retry-backoff]", {
      requestId,
      model,
      attempt: globalAttempt,
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
