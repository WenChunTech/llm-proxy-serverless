import { OAuth2Client } from 'google-auth-library';

import { getCredentials, updateCredentials } from '../kv/creds'
import { appConfig, APP_CONFIG } from '../init'

const OAUTH_CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
const OAUTH_CLIENT_SECRET = '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';
const authClient = new OAuth2Client(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET);

const isAccessTokenExpired = () => {
    if (!authClient.credentials || !authClient.credentials.expiry_date) {
        return true;
    }
    return Date.now() >= authClient.credentials.expiry_date;
}

const refreshAccessToken = async (env) => {
    const { credentials } = await authClient.refreshAccessToken();
    authClient.setCredentials(credentials);
    appConfig.gemini_cli.auth = credentials
    updateCredentials(env, APP_CONFIG, JSON.stringify(appConfig));
}

const initAuthClient = async (env) => {
    const credentials = await getCredentials(env, GeminiCLICredentials);
    if (credentials) {
        authClient.setCredentials(JSON.parse(credentials));
    }
}

const getAccessToken = async (env) => {
    if (isAccessTokenExpired()) {
        await refreshAccessToken(env);
    }
    return authClient.credentials.access_token;
}

export { initAuthClient, getAccessToken }