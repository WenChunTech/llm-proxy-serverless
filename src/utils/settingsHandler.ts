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
