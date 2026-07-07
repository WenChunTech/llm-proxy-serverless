import { Context } from "hono";
import { appConfig } from "../config";
import {
  getProviderDescriptor,
  getProviderDescriptors,
  normalizeModelPriority,
  type ProviderConfig,
} from "../providers/registry";
import { isProviderConfigEnabled } from "../types/config";

export interface ModelInfo {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

export function getModelsResponse(c: Context): Response {
  const allModels = collectAllModels();
  const response = {
    object: "list",
    data: allModels,
  };
  return c.json(response, 200);
}

export function collectAllModels(): ModelInfo[] {
  const created = Math.floor(Date.now() / 1000);
  const models = new Map<string, ModelInfo>();
  const orderedDescriptors = normalizeModelPriority(appConfig.model_priority)
    .map((providerId) => getProviderDescriptor(providerId))
    .filter((descriptor): descriptor is NonNullable<typeof descriptor> =>
      Boolean(descriptor)
    );
  const remainingDescriptors = getProviderDescriptors().filter((descriptor) =>
    !orderedDescriptors.some((ordered) => ordered.id === descriptor.id)
  );

  for (const descriptor of [...orderedDescriptors, ...remainingDescriptors]) {
    const configs = (appConfig[descriptor.configKey] || []) as ProviderConfig[];
    for (const config of configs) {
      if (!isProviderConfigEnabled(config)) continue;
      for (const model of config.models) {
        const normalizedModel = model.trim();
        if (!normalizedModel || models.has(normalizedModel)) continue;
        models.set(normalizedModel, {
          id: normalizedModel,
          object: "model",
          created,
          owned_by: descriptor.ownedBy,
        });
      }
    }
  }

  return Array.from(models.values());
}
