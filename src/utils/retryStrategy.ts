import { appConfig } from "../config.ts";
import { FallbackModelMap } from "../types/config.ts";
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

export const MAX_RETRIES = 15;

export function getFallbackModel(model: string): string | undefined {
  const fallbackModels = appConfig.fallback_models as
    | FallbackModelMap
    | undefined;
  return fallbackModels?.[model];
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
