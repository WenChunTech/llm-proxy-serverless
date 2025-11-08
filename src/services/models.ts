import { Context } from 'hono';
import { appConfig } from '@/config.js';

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
    data: allModels
  };
  const cache_control = c.req.header("Cache-Control") ?? "no-store,no-cache,must-revalidate,max-age=0";
  return c.json(response, 200, {
    "Cache-Control": cache_control
  });
}

export function collectAllModels(): ModelInfo[] {
  const models: ModelInfo[] = [];

  if (appConfig.gemini_cli) {
    appConfig.gemini_cli.forEach(config => {
      config.models.forEach(model => {
        models.push({
          id: model,
          object: "model",
          created: Date.now(),
          owned_by: "gemini-cli"
        });
      });
    });
  }

  if (appConfig.qwen) {
    appConfig.qwen.forEach(config => {
      config.models.forEach(model => {
        models.push({
          id: model,
          object: "model",
          created: Date.now(),
          owned_by: "qwen"
        });
      });
    });
  }

  if (appConfig.openai) {
    appConfig.openai.forEach(config => {
      config.models.forEach(model => {
        models.push({
          id: model,
          object: "model",
          created: Date.now(),
          owned_by: "openai"
        });
      });
    });
  }

  if (appConfig.claude) {
    appConfig.claude.forEach(config => {
      config.models.forEach(model => {
        models.push({
          id: model,
          object: "model",
          created: Date.now(),
          owned_by: "claude"
        });
      });
    });
  }

  return models;
}