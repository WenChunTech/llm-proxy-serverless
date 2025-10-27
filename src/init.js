import fs from 'fs'

import { initAuthClient } from './creds/gemini_cli.js'
import { getCredentials, updateCredentials } from './kv/creds.js'

export let appConfig;
export const APP_CONFIG = "APP_CONFIG";

export const initConfig = async (env) => {
    if (appConfig) {
        return;
    }
    if (await fs.existsSync('config.json')) {
        appConfig = JSON.parse(fs.readFileSync('config.json'));
    } else {
        const config = await getCredentials(env, APP_CONFIG);
        if (config) {
            appConfig = config;
        }
    }
    if (appConfig.gemini_cli.auth) {
        await initAuthClient(appConfig.gemini_cli.auth);
    }
}

export const updateConfig = async (env, config) => {
    if (await fs.existsSync('config.json')) {
        appConfig = config;
        fs.writeFileSync('config.json', JSON.stringify(appConfig));
    } else {
        await updateCredentials(env, APP_CONFIG, JSON.stringify(config));
    }
}