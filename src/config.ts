import fs from 'fs';
import { getCredentials, updateCredentials } from './services/credentials.js';
import { Config, GeminiCliConfig, QwenConfig, OpenAIConfig, ClaudeConfig } from './types/config.js';
import Poller from './services/polling.js';

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

export const initConfig = async (force: boolean = false) => {
    if (appConfig && !force && appConfig.gemini_cli.length > 0) {
        return;
    }

    let loadedConfig: any;
    if (fs.existsSync(CONFIG_FILE)) {
        await fs.promises.access(CONFIG_FILE);
        const fileContent = await fs.promises.readFile(CONFIG_FILE, 'utf-8');
        loadedConfig = JSON.parse(fileContent);
    } else {
        loadedConfig = await getCredentials(APP_CONFIG);
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
    try {
        await fs.promises.access(CONFIG_FILE);
        await fs.promises.writeFile(CONFIG_FILE, JSON.stringify(config));
        console.log("Saved new config to config.json Successfully");
    } catch (e) {
        await updateCredentials(APP_CONFIG, JSON.stringify(config));
        console.log("Saved new config to kv store Successfully");
    }
    appConfig = config;
    await initConfig(true);
}