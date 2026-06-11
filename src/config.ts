import fs from "node:fs";
import { getCredentials, updateCredentials } from "./services/credentials.ts";
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
} from "./types/config.ts";
import Poller from "./services/polling.ts";
import { invalidateModelMap } from "./providers/factory.ts";
import { logger } from "./utils/logger.ts";

export let appConfig: Config = {
  api_key: "",
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

export let geminiCliPoller: Poller<GeminiCliConfig>;
export let geminiPoller: Poller<GeminiConfig>;
export let qwenPoller: Poller<QwenConfig>;
export let openAIPoller: Poller<OpenAIChatConfig>;
export let openAIResponsesPoller: Poller<OpenAIResponsesConfig>;
export let claudePoller: Poller<ClaudeConfig>;
export let iflowPoller: Poller<IFlowConfig>;
export let codexPoller: Poller<CodexConfig>;

function rebuildPollers(config: Config) {
  geminiCliPoller = new Poller(
    (config.gemini_cli || []).filter(isProviderConfigEnabled),
  );
  geminiPoller = new Poller(
    (config.gemini || []).filter(isProviderConfigEnabled),
  );
  qwenPoller = new Poller((config.qwen || []).filter(isProviderConfigEnabled));
  openAIPoller = new Poller(
    (config.openai_chat || []).filter(isProviderConfigEnabled),
  );
  openAIResponsesPoller = new Poller(
    (config.openai_responses || []).filter(isProviderConfigEnabled),
  );
  claudePoller = new Poller(
    (config.claude || []).filter(isProviderConfigEnabled),
  );
  iflowPoller = new Poller(
    (config.iflow || []).filter(isProviderConfigEnabled),
  );
  codexPoller = new Poller(
    (config.codex || []).filter(isProviderConfigEnabled),
  );
}

function applyRuntimeConfig(config: Config) {
  appConfig = config;
  rebuildPollers(config);
  invalidateModelMap();
}

export const initConfig = async () => {
  let loadedConfig: any;
  if (fs.existsSync(CONFIG_FILE)) {
    const fileContent = fs.readFileSync(CONFIG_FILE, "utf-8");
    loadedConfig = JSON.parse(fileContent);
    logger.info("Load config from config.json Successfully");
  } else {
    loadedConfig = await getCredentials(APP_CONFIG);
    if (typeof loadedConfig === "string") {
      loadedConfig = JSON.parse(loadedConfig);
      logger.info("loadedConfig is string");
    }
    logger.info("Load config from kv store Successfully");
  }

  if (loadedConfig) {
    applyRuntimeConfig(loadedConfig);
  } else {
    applyRuntimeConfig(appConfig);
  }
};

export const updateConfig = async (config: Config) => {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config));
    logger.info("Saved new config to config.json Successfully");
  } else {
    updateCredentials(APP_CONFIG, config);
    logger.info("Saved new config to kv store Successfully");
  }
  applyRuntimeConfig(config);
};
