import { getCredentials } from './kv/creds'

export let appConfig;
export const APP_CONFIG = "APP_CONFIG";
export const initConfig = async (env) => {
    const configStr = await getCredentials(env, APP_CONFIG);
    if (configStr) {
        appConfig = JSON.parse(configStr);
    }
}