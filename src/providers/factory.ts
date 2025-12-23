import { PROVIDERS } from "./_base/index.ts  ";
import { GeminiCliProvider } from "./gemini_cli/index.ts";
import { OpenAIProvider } from "./openai/index.ts";
import { ClaudeProvider } from "./claude/index.ts";
import { QwenProvider } from "./qwen/index.ts";
import { IflowProvider } from "./iflow/index.ts";
import { appConfig } from "../config.ts";
import {
  ClaudeConfig,
  GeminiCliConfig,
  IFlowConfig,
  OpenAIConfig,
  QwenConfig,
} from "../types/config.ts";

const providerClasses = {
  [PROVIDERS.GEMINICLI]: (model: string) => new GeminiCliProvider(model),
  [PROVIDERS.OPENAI]: (model: string) => new OpenAIProvider(model),
  [PROVIDERS.CLAUDE]: (model: string) => new ClaudeProvider(model),
  [PROVIDERS.QWEN]: (model: string) => new QwenProvider(model),
  [PROVIDERS.IFLOW]: (model: string) => new IflowProvider(model),
};

const providerInstances: { [key: string]: any } = {};

let modelToProvidersMap: Map<string, string[]>;

const configKeyMap: { [key: string]: string } = {
  [PROVIDERS.GEMINICLI]: "gemini_cli",
  [PROVIDERS.OPENAI]: "openai",
  [PROVIDERS.CLAUDE]: "claude",
  [PROVIDERS.QWEN]: "qwen",
};

const providerNameMap: { [key: string]: string } = {
  gemini_cli: PROVIDERS.GEMINICLI,
  openai: PROVIDERS.OPENAI,
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
      | QwenConfig
      | OpenAIConfig
      | ClaudeConfig
      | IFlowConfig
    )[];
  } = {
    gemini_cli: config.gemini_cli,
    qwen: config.qwen,
    openai: config.openai,
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
    const providerName = PROVIDERS.OPENAI;
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
