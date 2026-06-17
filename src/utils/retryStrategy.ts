import { appConfig } from "../config.ts";
import {
  getProviderConfigsById,
  getProviderDescriptor,
  getProvidersForModel,
} from "../providers/registry.ts";

export interface RetryState {
  providerIndex: number;
  configIndex: number;
  projectIndex: number;
  attempt: number;
  lastError?: Error;
  lastResponse?: Response;
}

export const MAX_RETRIES = 5;

// 计算线性递增 sleep 时间（毫秒）
export function calculateBackoffDelay(attempt: number): number {
  // attempt 从 1 开始，每次增加 5 秒：5000ms, 10000ms, 15000ms, 20000ms, 25000ms
  return attempt * 5000;
}

export function getNormalizedFallbackList(fallbackModels?: string[]): string[] {
  if (!Array.isArray(fallbackModels)) {
    return [];
  }

  const seen = new Set<string>();
  return fallbackModels
    .map((model) => model.trim())
    .filter((model) => {
      if (!model || seen.has(model)) {
        return false;
      }
      seen.add(model);
      return true;
    });
}

export function getFallbackModel(model: string): string | undefined {
  const fallbackModels = getNormalizedFallbackList(appConfig.fallback_models);
  const currentIndex = fallbackModels.indexOf(model);
  if (currentIndex < 0 || currentIndex >= fallbackModels.length - 1) {
    return undefined;
  }
  return fallbackModels[currentIndex + 1];
}

export function getFallbackChain(model: string): string[] {
  const chain: string[] = [];
  const visited = new Set<string>([model]);
  let currentModel = model;

  while (true) {
    const fallbackModel = getFallbackModel(currentModel);
    if (!fallbackModel) {
      return chain;
    }

    if (visited.has(fallbackModel)) {
      throw new Error(
        `Fallback cycle detected: ${[...chain, fallbackModel].join(" -> ")}`,
      );
    }

    chain.push(fallbackModel);
    visited.add(fallbackModel);
    currentModel = fallbackModel;
  }
}

export function getAllProvidersForModel(model: string) {
  return getProvidersForModel(model);
}

export function getProviderConfigs(providerId: string) {
  return getProviderConfigsById(providerId);
}

export function isGeminiCliProvider(providerId: string): boolean {
  return Boolean(getProviderDescriptor(providerId)?.supportsProjects);
}
