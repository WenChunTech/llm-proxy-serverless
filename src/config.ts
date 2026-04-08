import fs from "node:fs";
import { getCredentials, updateCredentials } from "./services/credentials.ts";
import {
  ClaudeConfig,
  Config,
  GeminiCliConfig,
  GeminiConfig,
  IFlowConfig,
  OpenAIChatConfig,
  OpenAIResponsesConfig,
  QwenConfig,
} from "./types/config.ts";
import Poller from "./services/polling.ts";

export let appConfig: Config = {
  gemini_cli: [],
  gemini: [],
  qwen: [],
  openai_chat: [],
  openai_responses: [],
  claude: [],
  iflow: [],
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

export const initConfig = async () => {
  let loadedConfig: any;
  if (fs.existsSync(CONFIG_FILE)) {
    const fileContent = fs.readFileSync(CONFIG_FILE, "utf-8");
    loadedConfig = JSON.parse(fileContent);
    console.log("Load config from config.json Successfully");
  } else {
    loadedConfig = await getCredentials(APP_CONFIG);
    if (typeof loadedConfig === "string") {
      loadedConfig = JSON.parse(loadedConfig);
      console.log("loadedConfig is string");
    }
    console.log("Load config from kv store Successfully");
  }

  if (loadedConfig) {
    appConfig = loadedConfig;
  }
  geminiCliPoller = new Poller(appConfig.gemini_cli || []);
  geminiPoller = new Poller(appConfig.gemini || []);
  qwenPoller = new Poller(appConfig.qwen || []);
  openAIPoller = new Poller(appConfig.openai_chat || []);
  openAIResponsesPoller = new Poller(appConfig.openai_responses || []);
  claudePoller = new Poller(appConfig.claude || []);
  iflowPoller = new Poller(appConfig.iflow || []);
};

export const updateConfig = async (config: Config) => {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config));
    console.log("Saved new config to config.json Successfully");
  } else {
    updateCredentials(APP_CONFIG, config);
    console.log("Saved new config to kv store Successfully");
  }
  appConfig = config;
};
