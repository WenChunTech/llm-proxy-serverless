import { PROVIDERS } from "../providers/_base/index.ts";
import { appConfig } from "../config.ts";
import { FallbackModelMap } from "../types/config.ts";
import {
  ClaudeConfig,
  CodexConfig,
  GeminiCliConfig,
  GeminiConfig,
  IFlowConfig,
  OpenAIChatConfig,
  OpenAIResponsesConfig,
  QwenConfig,
} from "../types/config.ts";

export interface RetryState {
  providerIndex: number;
  configIndex: number;
  projectIndex: number;
  attempt: number;
  lastError?: Error;
  lastResponse?: Response;
}

export const MAX_RETRIES = 15;

export function getFallbackModel(model: string): string | undefined {
  const fallbackModels = appConfig.fallback_models as
    | FallbackModelMap
    | undefined;
  return fallbackModels?.[model];
}

export function getAllProvidersForModel(model: string): string[] {
  const priority = appConfig.model_priority || [
    "gemini_cli",
    "iflow",
    "openai_chat",
    "openai_responses",
    "qwen",
    "claude",
  ];

  const providerConfigs: {
    [key: string]: (
      | GeminiCliConfig
      | GeminiConfig
      | QwenConfig
      | OpenAIChatConfig
      | OpenAIResponsesConfig
      | ClaudeConfig
      | IFlowConfig
      | CodexConfig
    )[];
  } = {
    gemini_cli: appConfig.gemini_cli,
    gemini: appConfig.gemini,
    qwen: appConfig.qwen,
    openai_chat: appConfig.openai_chat,
    openai_responses: appConfig.openai_responses,
    claude: appConfig.claude,
    iflow: appConfig.iflow,
    codex: appConfig.codex,
  };

  const providerNameMap: { [key: string]: string } = {
    gemini_cli: PROVIDERS.GEMINI_CLI,
    gemini: PROVIDERS.GEMINI,
    openai: PROVIDERS.OPENAI_CHAT,
    openai_responses: PROVIDERS.OPENAI_RESPONSES,
    claude: PROVIDERS.CLAUDE,
    qwen: PROVIDERS.QWEN,
    iflow: PROVIDERS.IFLOW,
    codex: PROVIDERS.CODEX,
  };

  const result: string[] = [];

  for (const p of priority) {
    const configKey = p;
    const configs = providerConfigs[configKey];
    if (!configs || configs.length === 0) continue;

    const matchingConfigs = configs.filter((c) => c.models.includes(model));
    if (matchingConfigs.length === 0) continue;

    const providerName = providerNameMap[configKey];

    result.push(providerName);
  }

  return result;
}

export function getProviderConfigs(providerName: string): any[] {
  const configKeyMap: { [key: string]: string } = {
    [PROVIDERS.GEMINI_CLI]: "gemini_cli",
    [PROVIDERS.GEMINI]: "gemini",
    [PROVIDERS.QWEN]: "qwen",
    [PROVIDERS.OPENAI_CHAT]: "openai_chat",
    [PROVIDERS.OPENAI_RESPONSES]: "openai_responses",
    [PROVIDERS.CLAUDE]: "claude",
    [PROVIDERS.IFLOW]: "iflow",
    [PROVIDERS.CODEX]: "codex",
  };

  const configKey = configKeyMap[providerName];
  if (!configKey) return [];

  const providerConfigs: {
    [key: string]: any[];
  } = {
    gemini_cli: appConfig.gemini_cli,
    gemini: appConfig.gemini,
    qwen: appConfig.qwen,
    openai_chat: appConfig.openai_chat,
    openai_responses: appConfig.openai_responses,
    claude: appConfig.claude,
    iflow: appConfig.iflow,
    codex: appConfig.codex,
  };

  return providerConfigs[configKey] || [];
}

export function isGeminiCliProvider(providerName: string): boolean {
  return providerName === PROVIDERS.GEMINI_CLI;
}
