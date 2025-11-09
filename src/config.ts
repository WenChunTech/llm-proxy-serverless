import * as fs from 'node:fs';
import { getCredentials, updateCredentials } from './services/credentials.ts';
import { Config, GeminiCliConfig, QwenConfig, OpenAIConfig, ClaudeConfig } from './types/config.ts';
import Poller from './services/polling.ts';

export let appConfig: Config = {
    gemini_cli: [],
    qwen: [],
    openai: [],
    claude: [],
    model_priority: [],
};
export const APP_CONFIG = "APP_CONFIG";
const CONFIG_FILE = "config.json";

export let geminiCliPoller: Poller<GeminiCliConfig>;
export let geminiCliProjectsPoller: Poller<string>;
export let qwenPoller: Poller<QwenConfig>;
export let openAIPoller: Poller<OpenAIConfig>;
export let claudePoller: Poller<ClaudeConfig>;

export const initConfig = async () => {
    let loadedConfig: any;
    if (fs.existsSync(CONFIG_FILE)) {
        const fileContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
        loadedConfig = JSON.parse(fileContent);
        console.log("Load config from config.json Successfully");
    } else {
        loadedConfig = await getCredentials(APP_CONFIG);
        console.log("Load config from kv store Successfully");
    }

    if (loadedConfig) {
        appConfig = { ...appConfig, ...loadedConfig };
    }
    geminiCliPoller = new Poller(appConfig.gemini_cli || []);
    const allProjects = appConfig.gemini_cli.flatMap(c => c.projects);
    geminiCliProjectsPoller = new Poller(allProjects || []);
    qwenPoller = new Poller(appConfig.qwen || []);
    openAIPoller = new Poller(appConfig.openai || []);
    claudePoller = new Poller(appConfig.claude || []);
}


export const updateConfig = async (config: Config) => {
    if (fs.existsSync(CONFIG_FILE)) {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config));
        console.log("Saved new config to config.json Successfully");
    } else {
        updateCredentials(APP_CONFIG, JSON.stringify(config));
        console.log("Saved new config to kv store Successfully");
    }
    appConfig = config;
}