import { Context } from "hono";
import { appConfig, updateConfig } from "../config";
import { Config } from "../types/config";
import { timingSafeCompare } from "./runtime";
import { logger } from "./logger";
import {
  getProviderDescriptors,
  normalizeModelPriority,
  type ProviderConfig,
  type ProviderId,
} from "../providers/registry";

const VALID_PROVIDERS = getProviderDescriptors().map((descriptor) => descriptor.id);
const PROVIDER_TEST_DEFAULT_PROMPT = "你是什么大模型？";
const TESTABLE_PROVIDERS = new Set([
  "gemini",
  "openai_chat",
  "openai_responses",
  "claude",
]);

interface ProviderTestConfigInput {
  base_url?: unknown;
  api_key?: unknown;
  models?: unknown;
}

interface ProviderTestFetchRequest {
  endpoint: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

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

function normalizeModelList(models: string[]): string[] {
  const seen = new Set<string>();
  return models
    .map((model) => model.trim())
    .filter((model) => {
      if (!model || seen.has(model)) {
        return false;
      }
      seen.add(model);
      return true;
    });
}

function getProviderMergeKey(config: ProviderConfig): string | null {
  if ("base_url" in config && "api_key" in config) {
    const baseUrl = typeof config.base_url === "string"
      ? config.base_url.trim()
      : "";
    const apiKey = typeof config.api_key === "string"
      ? config.api_key.trim()
      : "";
    return `${baseUrl}::${apiKey}`;
  }

  return null;
}

function mergeProviderConfig(
  existing: ProviderConfig,
  incoming: ProviderConfig,
): ProviderConfig {
  return {
    ...existing,
    ...incoming,
    models: normalizeModelList([
      ...(Array.isArray(existing.models) ? existing.models : []),
      ...(Array.isArray(incoming.models) ? incoming.models : []),
    ]),
  } as ProviderConfig;
}

function mergeProviderConfigsByConnection(
  existing: ProviderConfig[],
  incoming: ProviderConfig[],
): ProviderConfig[] {
  const merged = [...existing];
  const keyedIndex = new Map<string, number>();

  merged.forEach((config, index) => {
    const key = getProviderMergeKey(config);
    if (key) {
      keyedIndex.set(key, index);
    }
  });

  for (const config of incoming) {
    const mergeKey = getProviderMergeKey(config);
    if (!mergeKey) {
      merged.push({
        ...config,
        models: normalizeModelList(config.models || []),
      } as ProviderConfig);
      continue;
    }

    const existingIndex = keyedIndex.get(mergeKey);
    if (existingIndex === undefined) {
      merged.push({
        ...config,
        models: normalizeModelList(config.models || []),
      } as ProviderConfig);
      keyedIndex.set(mergeKey, merged.length - 1);
      continue;
    }

    merged[existingIndex] = mergeProviderConfig(
      merged[existingIndex],
      config,
    );
  }

  return merged;
}

function normalizeAllProviderConfigs(config: Config): Config {
  const normalizedConfig = cloneConfig(config);

  for (const providerId of VALID_PROVIDERS) {
    const providerConfigs = Array.isArray(
        normalizedConfig[providerId as keyof Config],
      )
      ? normalizedConfig[providerId as keyof Config] as ProviderConfig[]
      : [];

    (normalizedConfig as unknown as Record<string, unknown>)[providerId] =
      mergeProviderConfigsByConnection([], providerConfigs);
  }

  return normalizedConfig;
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

function getTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getFirstModel(models: unknown): string {
  if (!Array.isArray(models)) {
    return "";
  }

  for (const model of models) {
    const normalizedModel = getTrimmedString(model);
    if (normalizedModel) {
      return normalizedModel;
    }
  }

  return "";
}

function appendPathToBaseUrl(baseUrl: string, path: string): string {
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/+$/, "");
  const nextPath = path.replace(/^\/+/, "");
  url.pathname = `${basePath}/${nextPath}`.replace(/\/+/g, "/");
  return url.toString();
}

function withJsonHeaders(
  headers: Record<string, string> = {},
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...headers,
  };
}

function buildProviderTestRequest(
  providerType: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  stream: boolean,
): ProviderTestFetchRequest {
  switch (providerType) {
    case "openai_chat": {
      const headers = withJsonHeaders();
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      return {
        endpoint: appendPathToBaseUrl(baseUrl, "chat/completions"),
        headers,
        body: {
          model,
          messages: [{ role: "user", content: prompt }],
          stream,
        },
      };
    }
    case "openai_responses": {
      const headers = withJsonHeaders();
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      return {
        endpoint: appendPathToBaseUrl(baseUrl, "responses"),
        headers,
        body: {
          model,
          input: prompt,
          stream,
        },
      };
    }
    case "claude": {
      const headers = withJsonHeaders({
        "anthropic-version": "2023-06-01",
      });
      if (apiKey) {
        headers["x-api-key"] = apiKey;
      }

      return {
        endpoint: appendPathToBaseUrl(baseUrl, "v1/messages"),
        headers,
        body: {
          model,
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
          stream,
        },
      };
    }
    case "gemini": {
      const headers = withJsonHeaders();
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
        headers["x-goog-api-key"] = apiKey;
      }

      const action = stream ? "streamGenerateContent" : "generateContent";
      const endpoint = appendPathToBaseUrl(
        baseUrl,
        `v1beta/models/${encodeURIComponent(model)}:${action}`,
      );
      const url = new URL(endpoint);
      if (stream) {
        url.searchParams.set("alt", "sse");
      }

      return {
        endpoint: url.toString(),
        headers,
        body: {
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        },
      };
    }
    default:
      throw new Error(`Unsupported provider: ${providerType}`);
  }
}

function buildProviderTestResponseHeaders(
  response: Response,
  stream: boolean,
): Headers {
  const headers = new Headers();
  headers.set(
    "Content-Type",
    response.headers.get("content-type") ||
      (stream
        ? "text/event-stream; charset=utf-8"
        : "text/plain; charset=utf-8"),
  );
  headers.set("Cache-Control", "no-cache");
  headers.set("X-Provider-Test-Status", String(response.status));
  headers.set("X-Provider-Test-Status-Text", response.statusText);
  return headers;
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

    const normalizedConfig = normalizeAllProviderConfigs(newConfig);
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

export async function handleTestProvider(c: Context) {
  try {
    const auth = checkAuth(c);
    if (!auth.ok) return auth.response;

    const body = await c.req.json() as {
      providerType?: unknown;
      config?: unknown;
      model?: unknown;
      prompt?: unknown;
      stream?: unknown;
    };
    const providerType = getTrimmedString(body.providerType);

    if (!TESTABLE_PROVIDERS.has(providerType)) {
      return c.json(
        {
          success: false,
          error: `Unsupported provider: ${providerType}`,
        },
        400,
      );
    }

    const providerConfig = body.config && typeof body.config === "object"
      ? body.config as ProviderTestConfigInput
      : {};
    const baseUrl = getTrimmedString(providerConfig.base_url);
    const apiKey = getTrimmedString(providerConfig.api_key);
    const model = getTrimmedString(body.model) ||
      getFirstModel(providerConfig.models);
    const prompt = getTrimmedString(body.prompt) || PROVIDER_TEST_DEFAULT_PROMPT;
    const stream = body.stream === true;

    if (!baseUrl) {
      return c.json(
        {
          success: false,
          error: "Base URL is required",
        },
        400,
      );
    }

    if (!model) {
      return c.json(
        {
          success: false,
          error: "At least one model is required",
        },
        400,
      );
    }

    let providerRequest: ProviderTestFetchRequest;
    try {
      providerRequest = buildProviderTestRequest(
        providerType,
        baseUrl,
        apiKey,
        model,
        prompt,
        stream,
      );
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error
            ? error.message
            : "Invalid provider test request",
        },
        400,
      );
    }

    const response = await fetch(providerRequest.endpoint, {
      method: "POST",
      headers: providerRequest.headers,
      body: JSON.stringify(providerRequest.body),
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: buildProviderTestResponseHeaders(response, stream),
    });
  } catch (error) {
    logger.error("Failed to test provider:", error);
    return c.json(
      {
        success: false,
        error: "Failed to test provider: " + String(error),
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
        mergeProviderConfigsByConnection(
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
