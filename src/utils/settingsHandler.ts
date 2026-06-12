import { Context } from "hono";
import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { appConfig, updateConfig } from "../config.ts";
import { Config } from "../types/config.ts";
import { logger } from "./logger.ts";
import {
  getProviderDescriptors,
  normalizeModelPriority,
  type ProviderConfig,
  type ProviderId,
} from "../providers/registry.ts";

const VALID_PROVIDERS = getProviderDescriptors().map((descriptor) => descriptor.id);

function cloneConfig(config: Config): Config {
  return JSON.parse(JSON.stringify(config));
}

function normalizeFallbackConfig(
  fallbackModels?: string[],
): string[] {
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

function hasOwnProperty(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function providerConfigFingerprint(config: ProviderConfig): string {
  const normalized = JSON.stringify(sortObjectKeys(config));
  return normalized;
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}

function mergeUniqueProviderConfigs(
  existing: ProviderConfig[],
  incoming: ProviderConfig[],
): ProviderConfig[] {
  const fingerprints = new Set(existing.map(providerConfigFingerprint));
  const merged = [...existing];

  for (const config of incoming) {
    const fingerprint = providerConfigFingerprint(config);
    if (fingerprints.has(fingerprint)) {
      continue;
    }
    fingerprints.add(fingerprint);
    merged.push(config);
  }

  return merged;
}

function getRequestApiKey(c: Context): string {
  const authorization = c.req.header("Authorization");
  if (authorization) {
    const [scheme, token] = authorization.trim().split(/\s+/, 2);
    if (scheme?.toLowerCase() === "bearer" && token) {
      return token;
    }
  }
  return c.req.header("x-api-key") || "";
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}

function checkAuth(c: Context): { ok: boolean; response?: Response } {
  const configuredApiKey = appConfig.api_key?.trim();
  if (!configuredApiKey) {
    return { ok: true };
  }
  const requestApiKey = getRequestApiKey(c);
  if (!timingSafeCompare(requestApiKey, configuredApiKey)) {
    return {
      ok: false,
      response: c.json({
        success: false,
        error: "Unauthorized: Invalid API key",
      }, 401),
    };
  }
  return { ok: true };
}

function buildProviderModelsEndpoint(baseUrl: string, providerType?: string): string {
  const url = new URL(baseUrl);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/models")) {
    url.pathname = pathname || "/models";
  } else {
    const isOpenAI = providerType === "openai_chat" || providerType === "openai_responses";
    const hasVersionPath = /\/v\d+$/.test(pathname);

    if (!isOpenAI && !hasVersionPath) {
      url.pathname = `${pathname}/v1/models`;
    } else {
      url.pathname = `${pathname}/models`;
    }
  }

  return url.toString();
}

// Check if auth is required (no response means no api_key configured)
export async function handleSettingsVerify(c: Context) {
  const configuredApiKey = appConfig.api_key?.trim();
  if (configuredApiKey) {
    const auth = checkAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
  }
  return c.json({
    success: true,
    data: appConfig,
  });
}

export async function handleSettingsGet(c: Context) {
  try {
    const auth = checkAuth(c);
    if (!auth.ok) return auth.response;

    return c.json({
      success: true,
      data: appConfig,
    });
  } catch (error) {
    logger.error("Failed to get settings:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get settings",
      },
      500,
    );
  }
}

export async function handleSettingsPost(c: Context) {
  try {
    const auth = checkAuth(c);
    if (!auth.ok) return auth.response;

    const body = await c.req.json();
    const newConfig: Config = body.config;

    // Validate config structure
    if (!newConfig) {
      return c.json(
        {
          success: false,
          error: "Config is required",
        },
        400,
      );
    }

    if (
      hasOwnProperty(body.config, "fallback_models") &&
      !Array.isArray(body.config.fallback_models)
    ) {
      return c.json(
        {
          success: false,
          error: "fallback_models must be an array",
        },
        400,
      );
    }

    const normalizedConfig = cloneConfig(newConfig);
    normalizedConfig.model_priority = normalizeModelPriority(
      normalizedConfig.model_priority,
    ) as Config["model_priority"];
    normalizedConfig.fallback_models = normalizeFallbackConfig(
      normalizedConfig.fallback_models,
    );

    await updateConfig(normalizedConfig);

    return c.json({
      success: true,
      message: "Settings updated successfully",
      data: appConfig,
    });
  } catch (error) {
    logger.error("Failed to update settings:", error);
    return c.json(
      {
        success: false,
        error: "Failed to update settings: " + String(error),
      },
      500,
    );
  }
}

export async function handleAddProvider(c: Context) {
  try {
    const auth = checkAuth(c);
    if (!auth.ok) return auth.response;

    const body = await c.req.json();
    const { provider, config } = body;

    if (!VALID_PROVIDERS.includes(provider as ProviderId)) {
      return c.json(
        {
          success: false,
          error: `Invalid provider: ${provider}`,
        },
        400,
      );
    }

    const updatedConfig = { ...appConfig };
    const providerArray = updatedConfig[provider as keyof Config] as any[];

    if (!Array.isArray(providerArray)) {
      return c.json(
        {
          success: false,
          error: `Provider array not found for: ${provider}`,
        },
        400,
      );
    }

    providerArray.push(config);
    await updateConfig(updatedConfig);

    return c.json({
      success: true,
      message: "Provider added successfully",
      data: appConfig,
    });
  } catch (error) {
    logger.error("Failed to add provider:", error);
    return c.json(
      {
        success: false,
        error: "Failed to add provider: " + String(error),
      },
      500,
    );
  }
}

export async function handleRemoveProvider(c: Context) {
  try {
    const auth = checkAuth(c);
    if (!auth.ok) return auth.response;

    const body = await c.req.json();
    const { provider, index } = body;

    if (!VALID_PROVIDERS.includes(provider as ProviderId)) {
      return c.json(
        {
          success: false,
          error: `Invalid provider: ${provider}`,
        },
        400,
      );
    }

    const updatedConfig = { ...appConfig };
    const providerArray = updatedConfig[provider as keyof Config] as any[];

    if (
      !Array.isArray(providerArray) ||
      index < 0 ||
      index >= providerArray.length
    ) {
      return c.json(
        {
          success: false,
          error: `Invalid index for provider: ${provider}`,
        },
        400,
      );
    }

    providerArray.splice(index, 1);
    await updateConfig(updatedConfig);

    return c.json({
      success: true,
      message: "Provider removed successfully",
      data: appConfig,
    });
  } catch (error) {
    logger.error("Failed to remove provider:", error);
    return c.json(
      {
        success: false,
        error: "Failed to remove provider: " + String(error),
      },
      500,
    );
  }
}

export async function handleFetchProviderModels(c: Context) {
  try {
    const auth = checkAuth(c);
    if (!auth.ok) return auth.response;

    const body = await c.req.json();
    const baseUrl = body?.baseUrl?.trim();
    const apiKey = body?.apiKey?.trim() || "";
    const providerType = body?.providerType?.trim() || "";

    if (!baseUrl) {
      return c.json(
        {
          success: false,
          error: "Base URL is required",
        },
        400,
      );
    }

    let endpoint: string;
    try {
      endpoint = buildProviderModelsEndpoint(baseUrl, providerType);
    } catch {
      return c.json(
        {
          success: false,
          error: "Invalid Base URL",
        },
        400,
      );
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(apiKey
          ? {
            Authorization: `Bearer ${apiKey}`,
            "x-api-key": apiKey,
          }
          : {}),
      },
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: payload?.error?.message || payload?.message || response.statusText,
          data: payload,
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    return c.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    logger.error("Failed to fetch provider models:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch provider models: " + String(error),
      },
      502,
    );
  }
}

export async function handleUpdateModelPriority(c: Context) {
  try {
    const auth = checkAuth(c);
    if (!auth.ok) return auth.response;

    const body = await c.req.json();
    const { priority } = body;

    if (!Array.isArray(priority)) {
      return c.json(
        {
          success: false,
          error: "Priority must be an array",
        },
        400,
      );
    }

    const updatedConfig = cloneConfig(appConfig);
    updatedConfig.model_priority = normalizeModelPriority(priority) as
      Config["model_priority"];
    await updateConfig(updatedConfig);

    return c.json({
      success: true,
      message: "Model priority updated successfully",
      data: appConfig,
    });
  } catch (error) {
    logger.error("Failed to update model priority:", error);
    return c.json(
      {
        success: false,
        error: "Failed to update model priority: " + String(error),
      },
      500,
    );
  }
}

export async function handleImportSettings(c: Context) {
  try {
    const auth = checkAuth(c);
    if (!auth.ok) return auth.response;

    const body = await c.req.json();
    const incomingConfig = body?.config as Partial<Config> | undefined;
    const selectedProviders = Array.isArray(body?.providers)
      ? body.providers
      : [];
    const importGlobalApiKey = body?.importGlobalApiKey === true;
    const importModelPriority = body?.importModelPriority === true;
    const importFallbackModels = body?.importFallbackModels === true;

    if (!incomingConfig || typeof incomingConfig !== "object") {
      return c.json(
        {
          success: false,
          error: "Config is required",
        },
        400,
      );
    }

    if (
      hasOwnProperty(incomingConfig, "fallback_models") &&
      !Array.isArray(incomingConfig.fallback_models)
    ) {
      return c.json(
        {
          success: false,
          error: "fallback_models must be an array",
        },
        400,
      );
    }

    const updatedConfig = cloneConfig(appConfig);

    if (importGlobalApiKey && typeof incomingConfig.api_key === "string") {
      updatedConfig.api_key = incomingConfig.api_key;
    }

    if (importModelPriority && Array.isArray(incomingConfig.model_priority)) {
      updatedConfig.model_priority = normalizeModelPriority(
        incomingConfig.model_priority,
      ) as Config["model_priority"];
    }

    if (importFallbackModels) {
      updatedConfig.fallback_models = normalizeFallbackConfig(
        incomingConfig.fallback_models,
      );
    }

    for (const selection of selectedProviders) {
      const providerId = selection?.provider;
      const indices = Array.isArray(selection?.indices)
        ? selection.indices.filter((index: unknown) =>
          Number.isInteger(index) && Number(index) >= 0
        ).map(Number)
        : [];

      if (!VALID_PROVIDERS.includes(providerId)) {
        continue;
      }

      const importedProviderConfigs = Array.isArray(
          incomingConfig[providerId as keyof Config],
        )
        ? incomingConfig[providerId as keyof Config] as ProviderConfig[]
        : [];

      const selectedConfigs = importedProviderConfigs.filter((_, index) =>
        indices.includes(index)
      );

      const existingProviderConfigs = Array.isArray(
          updatedConfig[providerId as keyof Config],
        )
        ? updatedConfig[providerId as keyof Config] as ProviderConfig[]
        : [];

      (updatedConfig as unknown as Record<string, unknown>)[providerId] =
        mergeUniqueProviderConfigs(
          existingProviderConfigs,
          selectedConfigs,
        );
    }

    await updateConfig(updatedConfig);

    return c.json({
      success: true,
      message: "Settings imported successfully",
      data: appConfig,
    });
  } catch (error) {
    logger.error("Failed to import settings:", error);
    return c.json(
      {
        success: false,
        error: "Failed to import settings: " + String(error),
      },
      500,
    );
  }
}

export async function handleSetFallbackModel(c: Context) {
  try {
    const auth = checkAuth(c);
    if (!auth.ok) return auth.response;

    const body = await c.req.json();
    const { model, fallbackModel } = body;

    const updatedConfig = cloneConfig(appConfig);
    const fallbackList = normalizeFallbackConfig(updatedConfig.fallback_models);
    const currentIndex = fallbackList.indexOf(model);

    if (fallbackModel === null || fallbackModel === undefined) {
      if (currentIndex >= 0) {
        fallbackList.splice(currentIndex, 1);
      }
    } else {
      const nextModel = String(fallbackModel).trim();
      if (!nextModel) {
        return c.json(
          {
            success: false,
            error: "fallbackModel must not be empty",
          },
          400,
        );
      }

      const deduped = fallbackList.filter((item) =>
        item !== model && item !== nextModel
      );
      const insertIndex = currentIndex >= 0
        ? Math.min(currentIndex, deduped.length)
        : deduped.length;
      deduped.splice(insertIndex, 0, model, nextModel);
      updatedConfig.fallback_models = deduped;
      await updateConfig(updatedConfig);

      return c.json({
        success: true,
        message: "Fallback model updated successfully",
        data: appConfig,
      });
    }

    updatedConfig.fallback_models = fallbackList;

    await updateConfig(updatedConfig);

    return c.json({
      success: true,
      message: "Fallback model updated successfully",
      data: appConfig,
    });
  } catch (error) {
    logger.error("Failed to set fallback model:", error);
    return c.json(
      {
        success: false,
        error: "Failed to set fallback model: " + String(error),
      },
      500,
    );
  }
}
