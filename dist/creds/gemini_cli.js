import { OAuth2Client } from 'google-auth-library';
import { appConfig, updateConfig } from '../init.js';
const OAUTH_CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
const OAUTH_CLIENT_SECRET = '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';
const authClient = new OAuth2Client(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET);
const isAccessTokenExpired = () => {
    if (!authClient.credentials || !authClient.credentials.expiry_date) {
        return true;
    }
    return Date.now() >= authClient.credentials.expiry_date;
};
const refreshAccessToken = async () => {
    const { credentials } = await authClient.refreshAccessToken();
    authClient.setCredentials(credentials);
    appConfig.gemini_cli.auth = credentials;
    await updateConfig(appConfig);
};
const initAuthClient = async () => {
    authClient.setCredentials(appConfig.gemini_cli.auth);
    if (isAccessTokenExpired()) {
        console.log('Access token expired, refreshing...');
        await refreshAccessToken();
        console.log('Access token refreshed:', authClient.credentials.access_token);
    }
};
const getAccessToken = async () => {
    if (isAccessTokenExpired()) {
        console.log('Access token expired, refreshing...');
        await refreshAccessToken();
        console.log('Access token refreshed:', authClient.credentials.access_token);
    }
    return authClient.credentials.access_token;
};
export { initAuthClient, getAccessToken };
