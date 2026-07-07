import { appConfig } from "../config";
import {
  ClaudeConfig,
  CodexConfig,
  Config,
  GeminiCliConfig,
  GeminiConfig,
  IFlowConfig,
  isProviderConfigEnabled,
  OpenAIChatConfig,
  OpenAIResponsesConfig,
  QwenConfig,
} from "../types/config";
import { PROVIDERS } from "./_base/index";
import { GeminiCliProvider } from "./gemini_cli/index";
import { GeminiProvider } from "./gemini/index";
import { OpenAIProvider } from "./openai_chat/index";
import { OpenAIResponsesProvider } from "./openai_responses/index";
import { ClaudeProvider } from "./claude/index";
import { QwenProvider } from "./qwen/index";
import { IflowProvider } from "./iflow/index";
import { CodexProvider } from "./codex/index";

export type ProviderId =
  | typeof PROVIDERS.GEMINI_CLI
  | typeof PROVIDERS.GEMINI
  | typeof PROVIDERS.OPENAI_CHAT
  | typeof PROVIDERS.OPENAI_RESPONSES
  | typeof PROVIDERS.CLAUDE
  | typeof PROVIDERS.QWEN
  | typeof PROVIDERS.IFLOW
  | typeof PROVIDERS.CODEX;

export type ProviderConfig =
  | GeminiCliConfig
  | GeminiConfig
  | OpenAIChatConfig
  | OpenAIResponsesConfig
  | ClaudeConfig
  | QwenConfig
  | IFlowConfig
  | CodexConfig;

export function supportsProjects(
  config: ProviderConfig,
): config is GeminiCliConfig {
  return "projects" in config;
}

export interface ProviderDescriptor<
  TConfig extends ProviderConfig = ProviderConfig,
> {
  id: ProviderId;
  configKey: keyof Pick<
    Config,
    | "gemini_cli"
    | "gemini"
    | "openai_chat"
    | "openai_responses"
    | "claude"
    | "qwen"
    | "iflow"
    | "codex"
  >;
  ownedBy: string;
  supportsProjects: boolean;
  create(model: string): unknown;
}

const DEFAULT_MODEL_PRIORITY: ProviderId[] = [
  PROVIDERS.GEMINI_CLI,
  PROVIDERS.IFLOW,
  PROVIDERS.OPENAI_CHAT,
  PROVIDERS.OPENAI_RESPONSES,
  PROVIDERS.QWEN,
  PROVIDERS.CLAUDE,
  PROVIDERS.GEMINI,
  PROVIDERS.CODEX,
];

const PROVIDER_DESCRIPTORS: ProviderDescriptor[] = [
  {
    id: PROVIDERS.GEMINI_CLI,
    configKey: "gemini_cli",
    ownedBy: "gemini-cli",
    supportsProjects: true,
    create: (model: string) => new GeminiCliProvider(model),
  },
  {
    id: PROVIDERS.GEMINI,
    configKey: "gemini",
    ownedBy: "gemini",
    supportsProjects: false,
    create: (model: string) => new GeminiProvider(model),
  },
  {
    id: PROVIDERS.OPENAI_CHAT,
    configKey: "openai_chat",
    ownedBy: "openai_chat",
    supportsProjects: false,
    create: (model: string) => new OpenAIProvider(model),
  },
  {
    id: PROVIDERS.OPENAI_RESPONSES,
    configKey: "openai_responses",
    ownedBy: "openai_responses",
    supportsProjects: false,
    create: (model: string) => new OpenAIResponsesProvider(model),
  },
  {
    id: PROVIDERS.CLAUDE,
    configKey: "claude",
    ownedBy: "claude",
    supportsProjects: false,
    create: (model: string) => new ClaudeProvider(model),
  },
  {
    id: PROVIDERS.QWEN,
    configKey: "qwen",
    ownedBy: "qwen",
    supportsProjects: false,
    create: (model: string) => new QwenProvider(model),
  },
  {
    id: PROVIDERS.IFLOW,
    configKey: "iflow",
    ownedBy: "iflow",
    supportsProjects: false,
    create: (model: string) => new IflowProvider(model),
  },
  {
    id: PROVIDERS.CODEX,
    configKey: "codex",
    ownedBy: "codex",
    supportsProjects: false,
    create: (model: string) => new CodexProvider(model),
  },
];

const PROVIDER_DESCRIPTOR_MAP = new Map(
  PROVIDER_DESCRIPTORS.map((descriptor) => [descriptor.id, descriptor]),
);

const PROVIDER_ALIASES: Record<string, ProviderId> = {
  openai_chat: PROVIDERS.OPENAI_CHAT,
  openai_responses: PROVIDERS.OPENAI_RESPONSES,
  gemini_cli: PROVIDERS.GEMINI_CLI,
  gemini: PROVIDERS.GEMINI,
  claude: PROVIDERS.CLAUDE,
  qwen: PROVIDERS.QWEN,
  iflow: PROVIDERS.IFLOW,
  codex: PROVIDERS.CODEX,
};

let modelProviderIndex: Map<string, ProviderId[]> | null = null;

function buildModelProviderIndex(): Map<string, ProviderId[]> {
  const index = new Map<string, ProviderId[]>();
  for (const descriptor of PROVIDER_DESCRIPTORS) {
    const configs = (appConfig[descriptor.configKey] || []) as ProviderConfig[];
    for (const config of configs) {
      if (!isProviderConfigEnabled(config)) continue;
      for (const model of config.models) {
        let providers = index.get(model);
        if (!providers) {
          providers = [];
          index.set(model, providers);
        }
        if (!providers.includes(descriptor.id)) {
          providers.push(descriptor.id);
        }
      }
    }
  }
  return index;
}

export function getConfiguredProvidersForModel(model: string): ProviderId[] {
  if (!modelProviderIndex) {
    modelProviderIndex = buildModelProviderIndex();
  }
  return modelProviderIndex.get(model) || [];
}

export function invalidateModelIndex(): void {
  modelProviderIndex = null;
}

export function normalizeProviderId(
  providerId: string,
): ProviderId | undefined {
  return PROVIDER_ALIASES[providerId];
}

export function getProviderDescriptor(
  providerId: string,
): ProviderDescriptor | undefined {
  const normalized = normalizeProviderId(providerId);
  return normalized ? PROVIDER_DESCRIPTOR_MAP.get(normalized) : undefined;
}

export function getProviderDescriptors(): ProviderDescriptor[] {
  return PROVIDER_DESCRIPTORS;
}

export function normalizeModelPriority(priority?: string[]): ProviderId[] {
  const normalized = (priority || []).map((providerId) =>
    normalizeProviderId(providerId)
  )
    .filter((providerId): providerId is ProviderId => Boolean(providerId));

  if (normalized.length === 0) {
    return [...DEFAULT_MODEL_PRIORITY];
  }

  const seen = new Set<ProviderId>();
  const result: ProviderId[] = [];

  for (const providerId of normalized) {
    if (!seen.has(providerId)) {
      seen.add(providerId);
      result.push(providerId);
    }
  }

  for (const providerId of DEFAULT_MODEL_PRIORITY) {
    if (!seen.has(providerId)) {
      result.push(providerId);
    }
  }

  return result;
}

export function getProviderConfigsById(providerId: string): ProviderConfig[] {
  const descriptor = getProviderDescriptor(providerId);
  if (!descriptor) return [];
  return ((appConfig[descriptor.configKey] || []) as ProviderConfig[])
    .filter(isProviderConfigEnabled);
}

export function getProviderConfigsByModel(
  providerId: string,
  model: string,
): ProviderConfig[] {
  return getProviderConfigsById(providerId).filter((config) =>
    config.models.includes(model)
  );
}

export function getProvidersForModel(model: string): ProviderId[] {
  const configuredProviders = getConfiguredProvidersForModel(model);
  const priority = normalizeModelPriority(appConfig.model_priority);
  const remaining = new Set(configuredProviders);
  const ordered: ProviderId[] = [];

  for (const providerId of priority) {
    if (remaining.has(providerId)) {
      ordered.push(providerId);
      remaining.delete(providerId);
    }
  }

  for (const providerId of configuredProviders) {
    if (remaining.has(providerId)) {
      ordered.push(providerId);
      remaining.delete(providerId);
    }
  }

  return ordered;
}
