import fs from 'fs'

import { initAuthClient } from './providers/gemini/auth.js';
import { getCredentials, updateCredentials } from './services/credentials.js';

export let appConfig: any;
export const APP_CONFIG = "APP_CONFIG";

export const initConfig = async () => {
    if (appConfig) {
        return;
    }
    try {
        await fs.promises.access('config.json');
        appConfig = JSON.parse(await fs.promises.readFile('config.json', 'utf-8'));
    } catch (e) {
        const config = await getCredentials(APP_CONFIG);
        if (config) {
            appConfig = config;
        }
    }
    if (appConfig.gemini_cli.auth) {
        await initAuthClient();
    }
}

export const updateConfig = async (config: any) => {
    try {
        await fs.promises.access('config.json');
        appConfig = config;
        await fs.promises.writeFile('config.json', JSON.stringify(appConfig));
    } catch (e) {
        await updateCredentials(APP_CONFIG, JSON.stringify(config));
    }
}