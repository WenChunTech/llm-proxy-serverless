import { PROVIDERS } from "./_base/index.ts";
import type { Provider } from "./_base/interface.ts";
import {
  getProviderDescriptor,
  getProviderDescriptors,
  getProviderConfigsById,
  getProvidersForModel,
  type ProviderId,
} from "./registry.ts";

const providerInstances: Record<string, Provider> = {};

let modelToProvidersMap: Map<string, ProviderId[]> | null = null;

function createProviderInstance(providerId: ProviderId, model: string): Provider {
  const descriptor = getProviderDescriptor(providerId);
  if (!descriptor) {
    throw new Error(`Provider descriptor not found for provider: ${providerId}`);
  }

  return descriptor.create(model) as Provider;
}

function buildModelToProvidersMap() {
  if (modelToProvidersMap) {
    return;
  }

  modelToProvidersMap = new Map<string, ProviderId[]>();

  for (const descriptor of getProviderDescriptors()) {
    const configs = getProviderConfigsById(descriptor.id);
    for (const config of configs) {
      for (const modelName of config.models) {
        if (!modelToProvidersMap.has(modelName)) {
          modelToProvidersMap.set(modelName, []);
        }

        const providers = modelToProvidersMap.get(modelName)!;
        if (!providers.includes(descriptor.id)) {
          providers.push(descriptor.id);
        }
      }
    }
  }
}

export function invalidateModelMap() {
  modelToProvidersMap = null;
  Object.keys(providerInstances).forEach((key) => delete providerInstances[key]);
}

export function getProvider(model: string): Provider {
  buildModelToProvidersMap();

  const providers = modelToProvidersMap!.get(model);
  const providerId = providers && providers.length > 0
    ? getProvidersForModel(model)[0]
    : PROVIDERS.OPENAI_CHAT;

  return getProviderInstance(providerId, model);
}

export function getProvidersListForModel(model: string): ProviderId[] {
  buildModelToProvidersMap();
  const providers = modelToProvidersMap!.get(model);
  if (!providers || providers.length === 0) {
    return [PROVIDERS.OPENAI_CHAT];
  }

  return getProvidersForModel(model);
}

export function getProviderConfigs(providerId: string) {
  return getProviderConfigsById(providerId);
}

export function getConfigForProvider(providerId: string, model: string) {
  return getProviderConfigsById(providerId).find((config) => config.models.includes(model));
}

export function isProviderGeminiCli(providerId: string): boolean {
  return providerId === PROVIDERS.GEMINI_CLI;
}

export function getProviderInstance(providerId: string, model: string): Provider {
  const descriptor = getProviderDescriptor(providerId);
  if (!descriptor) {
    throw new Error(`Provider descriptor not found for provider: ${providerId}`);
  }

  const cacheKey = `${descriptor.id}:${model}`;
  if (!providerInstances[cacheKey]) {
    providerInstances[cacheKey] = createProviderInstance(descriptor.id, model);
  }

  return providerInstances[cacheKey];
}
