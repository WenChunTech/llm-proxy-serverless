import { Context } from "hono";
import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { appConfig, updateConfig } from "../config.ts";
import { Config } from "../types/config.ts";
import { logger } from "./logger.ts";

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

    // Update config
    await updateConfig(newConfig);

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

    const validProviders = [
      "gemini_cli",
      "gemini",
      "qwen",
      "openai_chat",
      "openai_responses",
      "claude",
      "iflow",
      "codex",
    ];

    if (!validProviders.includes(provider)) {
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

    const validProviders = [
      "gemini_cli",
      "gemini",
      "qwen",
      "openai_chat",
      "openai_responses",
      "claude",
      "iflow",
      "codex",
    ];

    if (!validProviders.includes(provider)) {
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

    const updatedConfig = { ...appConfig };
    updatedConfig.model_priority = priority;
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

export async function handleSetFallbackModel(c: Context) {
  try {
    const auth = checkAuth(c);
    if (!auth.ok) return auth.response;

    const body = await c.req.json();
    const { model, fallbackModel } = body;

    const updatedConfig = { ...appConfig };
    if (!updatedConfig.fallback_models) {
      updatedConfig.fallback_models = {};
    }

    if (fallbackModel === null || fallbackModel === undefined) {
      delete updatedConfig.fallback_models[model];
    } else {
      updatedConfig.fallback_models[model] = fallbackModel;
    }

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
