import { Context } from "hono";
import { appConfig, updateConfig } from "../config";
import { CodexAuth, CodexConfig, Config } from "../types/config";
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
const DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
const CODEX_USER_AGENT =
  "codex-tui/0.135.0 (Mac OS 26.5.0; arm64) iTerm.app/3.6.10 (codex-tui; 0.135.0)";
const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CODEX_VALIDATION_MODEL = "gpt-5.4-mini";
const CODEX_VALIDATION_CONCURRENCY = 5;
const CODEX_VALIDATION_TIMEOUT_MS = 30_000;
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

interface CodexValidationFetchResponse {
  statusCode: number;
  body: unknown;
  rawBody: string;
}

interface CodexValidationClassification {
  valid: boolean;
  reason: string;
  errType: string;
  errCode: string;
  errMsg: string;
  statusCode: number;
}

interface CodexValidationTask {
  providerIndex: number;
  config: CodexConfig;
  auth: CodexAuth;
  authIndex: number;
  authCount: number;
  isAuthArray: boolean;
  model: string;
}

interface CodexValidationResult {
  providerIndex: number;
  authIndex: number;
  authCount: number;
  isAuthArray: boolean;
  label: string;
  email: string;
  accountId: string;
  planType: string;
  disabled: boolean;
  skipped: boolean;
  valid: boolean;
  reason: string;
  statusCode: number;
  errorMessage: string;
  refreshed: boolean;
  auth?: CodexAuth;
}

function cloneConfig(config: Config): Config {
  return JSON.parse(JSON.stringify(config));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getRecordString(
  value: Record<string, unknown>,
  key: string,
): string {
  const item = value[key];
  return typeof item === "string" ? item : "";
}

function parseCodexJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function getCodexAuthAccountId(auth: CodexAuth): string {
  return auth.account_id || auth.chatgpt_account_id || "";
}

function getCodexAuthPlanType(auth: CodexAuth): string {
  return auth.plan_type || auth.chatgpt_plan_type || "";
}

function getCodexAuthLabel(
  providerIndex: number,
  authIndex: number,
  auth: CodexAuth,
): string {
  return auth.email || auth.name || getCodexAuthAccountId(auth) ||
    `Codex #${providerIndex + 1} Auth #${authIndex + 1}`;
}

function getCodexBaseUrl(config: CodexConfig, auth: CodexAuth): string {
  return auth.base_url || config.base_url || DEFAULT_CODEX_BASE_URL;
}

function buildCodexRequestHeaders(
  auth: CodexAuth,
  stream: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${auth.access_token}`,
    "User-Agent": CODEX_USER_AGENT,
    "Originator": "codex-tui",
    "Connection": "Keep-Alive",
    "Accept": stream ? "text/event-stream" : "application/json",
  };
  const accountId = getCodexAuthAccountId(auth);
  if (accountId) {
    headers["chatgpt-account-id"] = accountId;
  }
  return headers;
}

function buildCodexProbeBody(
  model: string,
  stream: boolean,
): Record<string, unknown> {
  return {
    model,
    input: [
      {
        content: "hello",
        role: "user",
      },
    ],
    instructions: "",
    store: false,
    stream,
  };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function makeCodexValidationRequest(
  baseUrl: string,
  auth: CodexAuth,
  model: string,
): Promise<CodexValidationFetchResponse> {
  const url = `${baseUrl.replace(/\/+$/, "")}/responses`;
  const stream = true;

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: buildCodexRequestHeaders(auth, stream),
      body: JSON.stringify(buildCodexProbeBody(model, stream)),
    },
    CODEX_VALIDATION_TIMEOUT_MS,
  );

  const rawBody = await response.text();
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }

  return {
    statusCode: response.status,
    body,
    rawBody,
  };
}

async function refreshCodexAuthForValidation(
  auth: CodexAuth,
): Promise<{ ok: true; auth: CodexAuth } | { ok: false; error: string }> {
  if (!auth.refresh_token) {
    return {
      ok: false,
      error: "No refresh token available",
    };
  }

  const response = await fetchWithTimeout(
    CODEX_TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        client_id: CODEX_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: auth.refresh_token,
        scope: "openid profile email",
      }).toString(),
    },
    CODEX_VALIDATION_TIMEOUT_MS,
  );

  let tokenData: Record<string, unknown> | null = null;
  let rawBody = "";
  try {
    rawBody = await response.text();
    tokenData = JSON.parse(rawBody);
  } catch {
    tokenData = null;
  }

  const accessToken = tokenData ? getRecordString(tokenData, "access_token") : "";
  if (!response.ok || !tokenData || !accessToken) {
    return {
      ok: false,
      error: getRecordString(tokenData || {}, "error_description") ||
        getRecordString(tokenData || {}, "error") ||
        rawBody ||
        `HTTP ${response.status}`,
    };
  }

  let accountId = getCodexAuthAccountId(auth);
  let email = auth.email || "";
  let planType = getCodexAuthPlanType(auth);

  const idToken = typeof tokenData.id_token === "string"
    ? tokenData.id_token
    : auth.id_token;
  if (idToken) {
    const claims = parseCodexJwtClaims(idToken);
    if (claims) {
      email = getRecordString(claims, "email") || email;
      const authInfo = claims["https://api.openai.com/auth"];
      if (isRecord(authInfo)) {
        accountId = getRecordString(authInfo, "chatgpt_account_id") ||
          accountId;
        planType = getRecordString(authInfo, "chatgpt_plan_type") ||
          planType;
      }
    }
  }

  const expiresIn = typeof tokenData.expires_in === "number"
    ? tokenData.expires_in
    : 3600;
  const expiryDate = Date.now() + expiresIn * 1000;

  return {
    ok: true,
    auth: {
      ...auth,
      id_token: idToken || auth.id_token,
      access_token: accessToken,
      refresh_token: typeof tokenData.refresh_token === "string"
        ? tokenData.refresh_token
        : auth.refresh_token,
      account_id: accountId,
      email,
      plan_type: planType,
      expiry_date: expiryDate,
      expired: new Date(expiryDate).toISOString(),
      last_refresh: new Date().toISOString(),
    },
  };
}

function classifyCodexValidationResponse(
  response: CodexValidationFetchResponse,
): CodexValidationClassification {
  const { statusCode, body, rawBody } = response;
  const bodyRecord = isRecord(body) ? body : {};
  const errorRecord = isRecord(bodyRecord.error) ? bodyRecord.error : {};
  const errType = getRecordString(errorRecord, "type").toLowerCase();
  const errCode = getRecordString(errorRecord, "code").toLowerCase();
  const errMsg = getRecordString(errorRecord, "message") ||
    (typeof bodyRecord.error === "string" ? bodyRecord.error : "");
  const lower = rawBody.toLowerCase();

  if (
    statusCode === 401 ||
    errType === "authentication_error" ||
    errCode === "invalid_api_key" ||
    lower.includes("invalid or expired token")
  ) {
    return {
      valid: false,
      reason: "invalid_auth",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }

  if (statusCode === 200 || statusCode === 201) {
    return { valid: true, reason: "ok", errType, errCode, errMsg, statusCode };
  }

  if (statusCode === 402) {
    return {
      valid: false,
      reason: "payment_required",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }

  if (statusCode === 403) {
    return {
      valid: false,
      reason: "forbidden",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }

  if (statusCode === 429) {
    return {
      valid: true,
      reason: "rate_limited",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }

  if (statusCode >= 400 && statusCode < 500) {
    return {
      valid: true,
      reason: "request_error",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }

  if (statusCode >= 500) {
    return {
      valid: true,
      reason: "server_error",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }

  return {
    valid: false,
    reason: "unexpected",
    errType,
    errCode,
    errMsg,
    statusCode,
  };
}

function buildCodexValidationResult(
  task: CodexValidationTask,
  classification: CodexValidationClassification,
  auth: CodexAuth,
  options: { skipped?: boolean; refreshed?: boolean } = {},
): CodexValidationResult {
  const validatedAuth: CodexAuth = {
    ...auth,
    _validated_at: new Date().toISOString(),
    _validation_status: classification.reason,
  };

  return {
    providerIndex: task.providerIndex,
    authIndex: task.authIndex,
    authCount: task.authCount,
    isAuthArray: task.isAuthArray,
    label: getCodexAuthLabel(task.providerIndex, task.authIndex, auth),
    email: auth.email || "",
    accountId: getCodexAuthAccountId(auth),
    planType: getCodexAuthPlanType(auth),
    disabled: task.config.enabled === false || auth.disabled === true,
    skipped: options.skipped === true,
    valid: classification.valid,
    reason: classification.reason,
    statusCode: classification.statusCode,
    errorMessage: classification.errMsg,
    refreshed: options.refreshed === true,
    auth: options.skipped ? undefined : validatedAuth,
  };
}

async function validateCodexAuthTask(
  task: CodexValidationTask,
): Promise<CodexValidationResult> {
  if (task.config.enabled === false || task.auth.disabled === true) {
    return buildCodexValidationResult(
      task,
      {
        valid: false,
        reason: "disabled",
        errType: "",
        errCode: "",
        errMsg: "",
        statusCode: 0,
      },
      task.auth,
      { skipped: true },
    );
  }

  if (!task.auth.access_token) {
    return buildCodexValidationResult(
      task,
      {
        valid: false,
        reason: "missing_access_token",
        errType: "",
        errCode: "",
        errMsg: "Missing access_token",
        statusCode: 0,
      },
      task.auth,
      { skipped: true },
    );
  }

  const baseUrl = getCodexBaseUrl(task.config, task.auth);

  try {
    const response = await makeCodexValidationRequest(
      baseUrl,
      task.auth,
      task.model,
    );
    let classification = classifyCodexValidationResponse(response);
    let auth = task.auth;
    let refreshed = false;

    if (
      !classification.valid &&
      classification.reason === "invalid_auth" &&
      task.auth.refresh_token
    ) {
      const refreshResult = await refreshCodexAuthForValidation(task.auth);
      if (refreshResult.ok) {
        auth = refreshResult.auth;
        refreshed = true;
        const retry = await makeCodexValidationRequest(
          getCodexBaseUrl(task.config, auth),
          auth,
          task.model,
        );
        classification = classifyCodexValidationResponse(retry);
      } else {
        classification = {
          valid: false,
          reason: "refresh_failed",
          errType: "",
          errCode: "",
          errMsg: refreshResult.error,
          statusCode: 0,
        };
      }
    }

    return buildCodexValidationResult(task, classification, auth, {
      refreshed,
    });
  } catch (error) {
    return buildCodexValidationResult(
      task,
      {
        valid: false,
        reason: "request_failed",
        errType: "",
        errCode: "",
        errMsg: error instanceof Error ? error.message : String(error),
        statusCode: 0,
      },
      task.auth,
    );
  }
}

function getCodexValidationTasks(
  codexConfigs: CodexConfig[],
  model: string,
): CodexValidationTask[] {
  const tasks: CodexValidationTask[] = [];

  codexConfigs.forEach((config, providerIndex) => {
    const authList = Array.isArray(config.auth) ? config.auth : [config.auth];
    authList.forEach((auth, authIndex) => {
      if (!auth || typeof auth !== "object") {
        return;
      }
      tasks.push({
        providerIndex,
        config,
        auth,
        authIndex,
        authCount: authList.length,
        isAuthArray: Array.isArray(config.auth),
        model,
      });
    });
  });

  return tasks;
}

async function runCodexValidationTasks(
  tasks: CodexValidationTask[],
): Promise<CodexValidationResult[]> {
  const results: CodexValidationResult[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      results.push(await validateCodexAuthTask(task));
    }
  }

  const workers = Array.from(
    { length: Math.min(CODEX_VALIDATION_CONCURRENCY, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results.sort((a, b) =>
    a.providerIndex - b.providerIndex || a.authIndex - b.authIndex
  );
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

function normalizeCodexBaseUrl(baseUrl?: string): string {
  const normalized = typeof baseUrl === "string" && baseUrl.trim()
    ? baseUrl.trim()
    : DEFAULT_CODEX_BASE_URL;
  return normalized.replace(/\/+$/, "");
}

function getNormalizedCodexAuthList(
  auth: CodexAuth | CodexAuth[],
): CodexAuth[] {
  return (Array.isArray(auth) ? auth : [auth]).filter((item): item is CodexAuth =>
    !!item && typeof item === "object"
  );
}

function getCodexAuthMergeIdentity(auth: CodexAuth): string {
  const accountId = getCodexAuthAccountId(auth).trim();
  if (accountId) {
    return `account:${accountId}`;
  }

  const refreshToken = typeof auth.refresh_token === "string"
    ? auth.refresh_token.trim()
    : "";
  if (refreshToken) {
    return `refresh:${refreshToken}`;
  }

  const email = typeof auth.email === "string"
    ? auth.email.trim().toLowerCase()
    : "";
  if (email) {
    return `email:${email}`;
  }

  const name = typeof auth.name === "string" ? auth.name.trim() : "";
  if (name) {
    return `name:${name}`;
  }

  const idToken = typeof auth.id_token === "string" ? auth.id_token.trim() : "";
  if (idToken) {
    return `id_token:${idToken}`;
  }

  const accessToken = typeof auth.access_token === "string"
    ? auth.access_token.trim()
    : "";
  if (accessToken) {
    return `access_token:${accessToken}`;
  }

  return "unknown";
}

function getCodexAuthMergeKey(
  auth: CodexAuth,
  providerBaseUrl?: string,
): string {
  return `${
    normalizeCodexBaseUrl(auth.base_url || providerBaseUrl)
  }::${getCodexAuthMergeIdentity(auth)}`;
}

function normalizeCodexAuthValue(
  auth: CodexAuth | CodexAuth[],
): CodexAuth | CodexAuth[] {
  const authIsArray = Array.isArray(auth);
  const deduped: CodexAuth[] = [];
  const seen = new Set<string>();

  for (const item of getNormalizedCodexAuthList(auth)) {
    const key = getCodexAuthMergeKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  if (authIsArray) {
    return deduped;
  }

  return deduped[0] || auth;
}

function normalizeProviderConfigForMerge(
  providerId: ProviderId,
  config: ProviderConfig,
): ProviderConfig {
  const normalizedModels = normalizeModelList(
    Array.isArray(config.models) ? config.models : [],
  );

  if (providerId === "codex") {
    return {
      ...(config as CodexConfig),
      models: normalizedModels,
      auth: normalizeCodexAuthValue((config as CodexConfig).auth),
    } as ProviderConfig;
  }

  return {
    ...config,
    models: normalizedModels,
  } as ProviderConfig;
}

function getProviderMergeKey(
  providerId: ProviderId,
  config: ProviderConfig,
): string | null {
  if (providerId === "codex") {
    const codexConfig = config as CodexConfig;
    const authKeys = Array.from(
      new Set(
        getNormalizedCodexAuthList(codexConfig.auth)
          .map((auth) => getCodexAuthMergeKey(auth, codexConfig.base_url)),
      ),
    ).sort();

    if (authKeys.length === 0) {
      return null;
    }

    return `codex::${
      normalizeCodexBaseUrl(codexConfig.base_url)
    }::${authKeys.join("|")}`;
  }

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
  providerId: ProviderId,
  existing: ProviderConfig,
  incoming: ProviderConfig,
): ProviderConfig {
  const merged = {
    ...existing,
    ...incoming,
    models: normalizeModelList([
      ...(Array.isArray(existing.models) ? existing.models : []),
      ...(Array.isArray(incoming.models) ? incoming.models : []),
    ]),
  } as ProviderConfig;

  return normalizeProviderConfigForMerge(providerId, merged);
}

function mergeProviderConfigsByConnection(
  providerId: ProviderId,
  existing: ProviderConfig[],
  incoming: ProviderConfig[],
): ProviderConfig[] {
  const merged = existing.map((config) =>
    normalizeProviderConfigForMerge(providerId, config)
  );
  const keyedIndex = new Map<string, number>();

  merged.forEach((config, index) => {
    const key = getProviderMergeKey(providerId, config);
    if (key) {
      keyedIndex.set(key, index);
    }
  });

  for (const config of incoming) {
    const normalizedConfig = normalizeProviderConfigForMerge(providerId, config);
    const mergeKey = getProviderMergeKey(providerId, normalizedConfig);
    if (!mergeKey) {
      merged.push(normalizedConfig);
      continue;
    }

    const existingIndex = keyedIndex.get(mergeKey);
    if (existingIndex === undefined) {
      merged.push(normalizedConfig);
      keyedIndex.set(mergeKey, merged.length - 1);
      continue;
    }

    merged[existingIndex] = mergeProviderConfig(
      providerId,
      merged[existingIndex],
      normalizedConfig,
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
      mergeProviderConfigsByConnection(providerId, [], providerConfigs);
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

export async function handleValidateCodexAuths(c: Context) {
  try {
    const auth = checkAuth(c);
    if (!auth.ok) return auth.response;

    const body = await c.req.json().catch(() => ({}));
    const sourceConfig = body?.config && typeof body.config === "object"
      ? body.config as Partial<Config>
      : appConfig;
    const model = getTrimmedString(body?.model) || CODEX_VALIDATION_MODEL;
    const codexConfigs = Array.isArray(sourceConfig.codex)
      ? sourceConfig.codex as CodexConfig[]
      : [];
    const tasks = getCodexValidationTasks(codexConfigs, model);
    const results = await runCodexValidationTasks(tasks);
    const checkedResults = results.filter((result) => !result.skipped);

    return c.json({
      success: true,
      data: {
        model,
        total: results.length,
        checked: checkedResults.length,
        valid: checkedResults.filter((result) => result.valid).length,
        invalid: checkedResults.filter((result) => !result.valid).length,
        skipped: results.filter((result) => result.skipped).length,
        rateLimited: checkedResults.filter((result) =>
          result.reason === "rate_limited"
        ).length,
        refreshed: checkedResults.filter((result) => result.refreshed).length,
        results,
      },
    });
  } catch (error) {
    logger.error("Failed to validate Codex auths:", error);
    return c.json(
      {
        success: false,
        error: "Failed to validate Codex auths: " + String(error),
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
          providerId as ProviderId,
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
