import { getCredentials, updateCredentials } from './services/credentials';
import { hasRedisRuntimeConfig } from "./services/redis";
import { getEnv, isDeploymentRuntime } from "./utils/runtime";
import { logger } from "./utils/logger";
import {
  BaseProviderConfig,
  ClaudeConfig,
  CodexConfig,
  Config,
  GeminiCliConfig,
  GeminiConfig,
  IFlowConfig,
  OpenAIChatConfig,
  OpenAIResponsesConfig,
  QwenConfig,
  isProviderConfigEnabled,
} from "./types/config";
import { invalidateModelIndex } from "./providers/registry";
import Poller from "./services/polling";

export let appConfig: Config = {
  gemini_cli: [],
  gemini: [],
  qwen: [],
  openai_chat: [],
  openai_responses: [],
  claude: [],
  iflow: [],
  codex: [],
  model_priority: [],
};
export const APP_CONFIG = "APP_CONFIG";
const CONFIG_FILE = "config.json";

type BunLike = {
  file(path: string): {
    exists(): Promise<boolean>;
    text(): Promise<string>;
  };
  write(path: string, data: string): Promise<number>;
};

function getBun(): BunLike | undefined {
  return (globalThis as typeof globalThis & { Bun?: BunLike }).Bun;
}

async function hasConfigFile(): Promise<boolean> {
  const bun = getBun();
  if (!bun || isDeploymentRuntime()) return false;
  return bun.file(CONFIG_FILE).exists();
}

async function readConfigFile(): Promise<Config | undefined> {
  const bun = getBun();
  if (!bun || !(await hasConfigFile())) return undefined;
  return JSON.parse(await bun.file(CONFIG_FILE).text());
}

async function writeConfigFile(config: Config): Promise<boolean> {
  const bun = getBun();
  if (!bun || !(await hasConfigFile())) return false;
  await bun.write(CONFIG_FILE, JSON.stringify(config));
  return true;
}

function readConfigFromEnv(): Config | undefined {
  const rawConfig = getEnv("APP_CONFIG_JSON") ?? getEnv(APP_CONFIG);
  if (!rawConfig) return undefined;
  return JSON.parse(rawConfig);
}

export let geminiCliPoller: Poller<GeminiCliConfig>;
export let geminiPoller: Poller<GeminiConfig>;
export let qwenPoller: Poller<QwenConfig>;
export let openAIPoller: Poller<OpenAIChatConfig>;
export let openAIResponsesPoller: Poller<OpenAIResponsesConfig>;
export let claudePoller: Poller<ClaudeConfig>;
export let iflowPoller: Poller<IFlowConfig>;
export let codexPoller: Poller<CodexConfig>;

function filterEnabled<T extends BaseProviderConfig>(items: T[]): T[] {
  return items.filter(isProviderConfigEnabled);
}

export const initConfig = async () => {
  let loadedConfig: Config | null | undefined;

  if (hasRedisRuntimeConfig()) {
    try {
      loadedConfig = await getCredentials<Config>(APP_CONFIG);
      if (loadedConfig) {
        logger.info("Load config from shared Redis Successfully");
      }
    } catch (error) {
      if (isDeploymentRuntime()) {
        throw error;
      }
      logger.warn(
        "Failed to load shared Redis; falling back to local config.",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (!loadedConfig && !isDeploymentRuntime()) {
    loadedConfig = await readConfigFile();
    if (loadedConfig) {
      logger.info("Load config from config.json Successfully");
    }
  }

  if (!loadedConfig) {
    loadedConfig = readConfigFromEnv();
    if (loadedConfig) {
      logger.info("Load config from environment Successfully");
    }
  }

  if (!loadedConfig) {
    logger.warn("No external config loaded; using built-in empty config.");
  }

  if (loadedConfig) {
    appConfig = loadedConfig;
  }
  geminiCliPoller = new Poller(filterEnabled(appConfig.gemini_cli || []));
  geminiPoller = new Poller(filterEnabled(appConfig.gemini || []));
  qwenPoller = new Poller(filterEnabled(appConfig.qwen || []));
  openAIPoller = new Poller(filterEnabled(appConfig.openai_chat || []));
  openAIResponsesPoller = new Poller(filterEnabled(appConfig.openai_responses || []));
  claudePoller = new Poller(filterEnabled(appConfig.claude || []));
  iflowPoller = new Poller(filterEnabled(appConfig.iflow || []));
  codexPoller = new Poller(filterEnabled(appConfig.codex || []));
};

export const updateConfig = async (config: Config) => {
  if (hasRedisRuntimeConfig()) {
    await updateCredentials(APP_CONFIG, config);
    logger.info("Saved new config to shared Redis Successfully");
  } else if (!isDeploymentRuntime() && await writeConfigFile(config)) {
    logger.info("Saved new config to config.json Successfully");
  } else {
    throw new Error(
      "No writable config store is configured. Set Vercel Redis env vars: KV_REST_API_URL/KV_REST_API_TOKEN.",
    );
  }
  appConfig = config;
  invalidateModelIndex();
}
