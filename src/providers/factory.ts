import type { Provider } from "./_base/interface";
import {
  getProviderDescriptor,
  getProvidersForModel,
  normalizeProviderId,
} from "./registry";

const providerInstances = new Map<string, Provider>();

function getProviderCacheKey(providerId: string, model: string): string {
  return `${providerId}:${model}`;
}

export function getProviderInstance(providerId: string, model: string): Provider {
  const normalizedProviderId = normalizeProviderId(providerId);
  if (!normalizedProviderId) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  const cacheKey = getProviderCacheKey(normalizedProviderId, model);
  const cachedProvider = providerInstances.get(cacheKey);
  if (cachedProvider) {
    return cachedProvider;
  }

  const descriptor = getProviderDescriptor(normalizedProviderId);
  if (!descriptor) {
    throw new Error(`Provider descriptor not found for provider: ${providerId}`);
  }

  const provider = descriptor.create(model) as Provider;
  providerInstances.set(cacheKey, provider);
  return provider;
}

export function getProvider(model: string): Provider {
  const [providerId] = getProvidersForModel(model);
  if (!providerId) {
    throw new Error(`No provider found for model: ${model}`);
  }
  return getProviderInstance(providerId, model);
}

export function invalidateModelMap(): void {
  providerInstances.clear();
}
