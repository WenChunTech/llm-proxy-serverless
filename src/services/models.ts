import { Context } from "hono";
import { getProviderDescriptors, getProviderConfigsById } from "../providers/registry.ts";

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
  const models: ModelInfo[] = [];

  for (const descriptor of getProviderDescriptors()) {
    const providerConfigs = getProviderConfigsById(descriptor.id);
    for (const config of providerConfigs) {
      for (const model of config.models) {
        models.push({
          id: model,
          object: "model",
          created: Date.now(),
          owned_by: descriptor.ownedBy,
        });
      }
    }
  }

  return models;
}
