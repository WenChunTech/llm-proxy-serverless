import { appConfig } from "../config.ts";
import {
  ClaudeConfig,
  CodexConfig,
  Config,
  GeminiCliConfig,
  GeminiConfig,
  IFlowConfig,
  OpenAIChatConfig,
  OpenAIResponsesConfig,
  QwenConfig,
} from "../types/config.ts";
import { PROVIDERS } from "./_base/index.ts";
import { GeminiCliProvider } from "./gemini_cli/index.ts";
import { GeminiProvider } from "./gemini/index.ts";
import { OpenAIProvider } from "./openai_chat/index.ts";
import { OpenAIResponsesProvider } from "./openai_responses/index.ts";
import { ClaudeProvider } from "./claude/index.ts";
import { QwenProvider } from "./qwen/index.ts";
import { IflowProvider } from "./iflow/index.ts";
import { CodexProvider } from "./codex/index.ts";

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

export interface ProviderDescriptor<TConfig extends ProviderConfig = ProviderConfig> {
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
    ownedBy: "openai",
    supportsProjects: false,
    create: (model: string) => new OpenAIProvider(model),
  },
  {
    id: PROVIDERS.OPENAI_RESPONSES,
    configKey: "openai_responses",
    ownedBy: "openai",
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
  openai: PROVIDERS.OPENAI_CHAT,
  openai_chat: PROVIDERS.OPENAI_CHAT,
  openai_responses: PROVIDERS.OPENAI_RESPONSES,
  gemini_cli: PROVIDERS.GEMINI_CLI,
  gemini: PROVIDERS.GEMINI,
  claude: PROVIDERS.CLAUDE,
  qwen: PROVIDERS.QWEN,
  iflow: PROVIDERS.IFLOW,
  codex: PROVIDERS.CODEX,
};

export function normalizeProviderId(providerId: string): ProviderId | undefined {
  return PROVIDER_ALIASES[providerId];
}

export function getProviderDescriptor(providerId: string): ProviderDescriptor | undefined {
  const normalized = normalizeProviderId(providerId);
  return normalized ? PROVIDER_DESCRIPTOR_MAP.get(normalized) : undefined;
}

export function getProviderDescriptors(): ProviderDescriptor[] {
  return PROVIDER_DESCRIPTORS;
}

export function normalizeModelPriority(priority?: string[]): ProviderId[] {
  const normalized = (priority || []).map((providerId) => normalizeProviderId(providerId))
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
  return (appConfig[descriptor.configKey] || []) as ProviderConfig[];
}

export function getProviderConfigsByModel(providerId: string, model: string): ProviderConfig[] {
  return getProviderConfigsById(providerId).filter((config) => config.models.includes(model));
}

export function getProvidersForModel(model: string): ProviderId[] {
  const configuredProviders = PROVIDER_DESCRIPTORS
    .filter((descriptor) => getProviderConfigsByModel(descriptor.id, model).length > 0)
    .map((descriptor) => descriptor.id);

  if (configuredProviders.length === 0) {
    return [PROVIDERS.OPENAI_CHAT];
  }

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
