import { PROVIDERS } from "./_base/index.ts";
import { GeminiCliProvider } from "./gemini_cli/index.ts";
import { GeminiProvider } from "./gemini/index.ts";
import { OpenAIProvider } from "./openai_chat/index.ts";
import { OpenAIResponsesProvider } from "./openai_responses/index.ts";
import { ClaudeProvider } from "./claude/index.ts";
import { QwenProvider } from "./qwen/index.ts";
import { IflowProvider } from "./iflow/index.ts";
import { appConfig } from "../config.ts";
import {
  ClaudeConfig,
  GeminiCliConfig,
  GeminiConfig,
  IFlowConfig,
  OpenAIChatConfig,
  OpenAIResponsesConfig,
  QwenConfig,
} from "../types/config.ts";

const providerClasses = {
  [PROVIDERS.GEMINI_CLI]: (model: string) => new GeminiCliProvider(model),
  [PROVIDERS.GEMINI]: (model: string) => new GeminiProvider(model),
  [PROVIDERS.OPENAI_CHAT]: (model: string) => new OpenAIProvider(model),
  [PROVIDERS.OPENAI_RESPONSES]: (model: string) =>
    new OpenAIResponsesProvider(model),
  [PROVIDERS.CLAUDE]: (model: string) => new ClaudeProvider(model),
  [PROVIDERS.QWEN]: (model: string) => new QwenProvider(model),
  [PROVIDERS.IFLOW]: (model: string) => new IflowProvider(model),
};

const providerInstances: { [key: string]: any } = {};

let modelToProvidersMap: Map<string, string[]>;

const configKeyMap: { [key: string]: string } = {
  [PROVIDERS.GEMINI_CLI]: "gemini_cli",
  [PROVIDERS.QWEN]: "qwen",
  [PROVIDERS.IFLOW]: "iflow",
  [PROVIDERS.GEMINI]: "gemini",
  [PROVIDERS.OPENAI_CHAT]: "openai_chat",
  [PROVIDERS.OPENAI_RESPONSES]: "openai_responses",
  [PROVIDERS.CLAUDE]: "claude",
};

const providerNameMap: { [key: string]: string } = {
  gemini_cli: PROVIDERS.GEMINI_CLI,
  gemini: PROVIDERS.GEMINI,
  openai: PROVIDERS.OPENAI_CHAT,
  openai_responses: PROVIDERS.OPENAI_RESPONSES,
  claude: PROVIDERS.CLAUDE,
  qwen: PROVIDERS.QWEN,
  iflow: PROVIDERS.IFLOW,
};

function buildModelToProvidersMap() {
  if (modelToProvidersMap) {
    return;
  }
  modelToProvidersMap = new Map<string, string[]>();
  const config = appConfig;

  const providerConfigs: {
    [key: string]: (
      | GeminiCliConfig
      | GeminiConfig
      | QwenConfig
      | OpenAIChatConfig
      | OpenAIResponsesConfig
      | ClaudeConfig
      | IFlowConfig
    )[];
  } = {
    gemini_cli: config.gemini_cli,
    gemini: config.gemini,
    qwen: config.qwen,
    openai_chat: config.openai_chat,
    openai_responses: config.openai_responses,
    claude: config.claude,
    iflow: config.iflow,
  };

  for (const configKey of Object.keys(providerNameMap)) {
    const providerName = providerNameMap[configKey];
    const configs = providerConfigs[configKey];

    if (configs && Array.isArray(configs)) {
      for (const providerConfig of configs) {
        if (providerConfig.models && Array.isArray(providerConfig.models)) {
          for (const modelName of providerConfig.models) {
            if (!modelToProvidersMap.has(modelName)) {
              modelToProvidersMap.set(modelName, []);
            }
            const providers = modelToProvidersMap.get(modelName)!;
            if (!providers.includes(providerName)) {
              providers.push(providerName);
            }
          }
        }
      }
    }
  }
}

export function getProvider(model: string) {
  buildModelToProvidersMap();

  const providers = modelToProvidersMap.get(model);

  if (!providers || providers.length === 0) {
    const providerName = PROVIDERS.OPENAI_CHAT;
    if (!providerInstances[providerName]) {
      const ProviderClass = providerClasses[providerName];
      if (ProviderClass) {
        providerInstances[providerName] = ProviderClass(model);
      } else {
        throw new Error(
          `Default provider class not found for provider: ${providerName}`,
        );
      }
    }
    return providerInstances[providerName];
  }

  let providerName: string;

  if (providers.length === 1) {
    providerName = providers[0];
  } else {
    const priority = appConfig.model_priority ||
      ["gemini_cli", "iflow", "openai", "qwen", "claude"];
    let bestProvider: string | null = null;
    let bestPriority = Infinity;

    for (const p of providers) {
      const configKey = configKeyMap[p];
      const pPriority = priority.indexOf(configKey);
      if (pPriority !== -1 && pPriority < bestPriority) {
        bestPriority = pPriority;
        bestProvider = p;
      }
    }

    if (bestProvider) {
      providerName = bestProvider;
    } else {
      providerName = providers[0];
    }
  }

  if (!providerInstances[providerName]) {
    const ProviderClass = providerClasses[providerName];
    if (ProviderClass) {
      providerInstances[providerName] = ProviderClass(model);
    } else {
      throw new Error(`Provider class not found for provider: ${providerName}`);
    }
  }
  console.log(`Selected provider for model ${model}: ${providerName}`);
  return providerInstances[providerName];
}

export function getProvidersListForModel(model: string): string[] {
  buildModelToProvidersMap();
  const providers = modelToProvidersMap.get(model);
  if (!providers || providers.length === 0) {
    return [PROVIDERS.OPENAI_CHAT];
  }

  const priority = appConfig.model_priority ||
    ["gemini_cli", "iflow", "openai", "qwen", "claude"];

  const sortedProviders: string[] = [];
  const remainingProviders = [...providers];

  for (const p of priority) {
    const configKey = configKeyMap[p];
    const idx = remainingProviders.findIndex(
      (rp) => providerNameMap[configKey] === rp,
    );
    if (idx !== -1) {
      sortedProviders.push(remainingProviders[idx]);
      remainingProviders.splice(idx, 1);
    }
  }

  if (remainingProviders.length > 0) {
    sortedProviders.push(...remainingProviders);
  }

  return sortedProviders;
}

export function getProviderConfigs(
  providerName: string,
): (
  | GeminiCliConfig
  | GeminiConfig
  | QwenConfig
  | OpenAIChatConfig
  | OpenAIResponsesConfig
  | ClaudeConfig
  | IFlowConfig
)[] {
  const configKey = configKeyMap[providerName];
  if (!configKey) return [];

  const providerConfigs: {
    [key: string]: (
      | GeminiCliConfig
      | GeminiConfig
      | QwenConfig
      | OpenAIChatConfig
      | OpenAIResponsesConfig
      | ClaudeConfig
      | IFlowConfig
    )[];
  } = {
    gemini_cli: appConfig.gemini_cli,
    gemini: appConfig.gemini,
    qwen: appConfig.qwen,
    openai_chat: appConfig.openai_chat,
    openai_responses: appConfig.openai_responses,
    claude: appConfig.claude,
    iflow: appConfig.iflow,
  };

  return providerConfigs[configKey] || [];
}

export function getConfigForProvider(
  providerName: string,
  model: string,
): any {
  const configs = getProviderConfigs(providerName);
  return configs.find((c) => c.models.includes(model));
}

export function isProviderGeminiCli(providerName: string): boolean {
  return providerName === PROVIDERS.GEMINI_CLI;
}

export function getProviderInstance(
  providerName: string,
  model: string,
): any {
  if (!providerInstances[providerName]) {
    const ProviderClass = providerClasses[providerName];
    if (ProviderClass) {
      providerInstances[providerName] = ProviderClass(model);
    }
  }
  return providerInstances[providerName];
}
