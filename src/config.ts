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

export let geminiCliPoller: Poller<GeminiCliConfig>;
export let geminiCliProjectsPoller: Poller<string>;
export let qwenPoller: Poller<QwenConfig>;
export let openAIPoller: Poller<OpenAIConfig>;
export let claudePoller: Poller<ClaudeConfig>;

export const initConfig = async (force: boolean = false) => {
    if (appConfig && !force && appConfig.gemini_cli.length > 0) { // Check if already initialized
        return;
    }

    let loadedConfig: any;
    try {
        await fs.promises.access('config.json');
        const fileContent = await fs.promises.readFile('config.json', 'utf-8');
        loadedConfig = JSON.parse(fileContent);
    } catch (e) {
        const configStr = await getCredentials(APP_CONFIG);
        if (configStr && typeof configStr === 'string') {
            loadedConfig = JSON.parse(configStr);
        }
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
        await fs.promises.access('config.json');
        await fs.promises.writeFile('config.json', JSON.stringify(config, null, 4));
    } catch (e) {
        await updateCredentials(APP_CONFIG, JSON.stringify(config));
    }
    appConfig = config;
    // Re-initialize pollers with new config
    await initConfig(true);
}