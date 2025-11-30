import { appConfig, updateConfig } from '../../config.ts';
import { IFlowAuth } from '../../types/config.ts';
import { URLSearchParams } from 'node:url';
import { Buffer } from 'node:buffer';

// --- iFlow Constants (from cmd/iflow.js) ---
const IFLOW_OAUTH_TOKEN_ENDPOINT = "https://iflow.cn/oauth/token";
const IFLOW_USER_INFO_ENDPOINT = "https://iflow.cn/api/oauth/getUserInfo";
const IFLOW_OAUTH_CLIENT_ID = "10009311001";
const IFLOW_OAUTH_CLIENT_SECRET = "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW";


/**
 * Checks if the access token is expired.
 * @param {object} auth - The authentication credentials object.
 * @returns {boolean} True if the token is expired or missing, otherwise false.
 */
export function isAccessTokenExpired(auth: IFlowAuth) {
    if (!auth || !auth.expiry_date) {
        return true;
    }
    // Add a 60-second buffer to be safe
    return Date.now() >= auth.expiry_date - 60000;
}

/**
 * Refreshes the access token using the refresh token.
 * @returns {Promise<object>} A promise that resolves with the new token data.
 */
export async function refreshAccessToken(auth: IFlowAuth) {
    console.log('[iFlow Auth] Refreshing access token...');
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: auth.refresh_token, // Use the refresh token from the current credentials
        client_id: IFLOW_OAUTH_CLIENT_ID,
        client_secret: IFLOW_OAUTH_CLIENT_SECRET,
    });

    const basicAuth = Buffer.from(`${IFLOW_OAUTH_CLIENT_ID}:${IFLOW_OAUTH_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(IFLOW_OAUTH_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Authorization': `Basic ${basicAuth}`
        },
        body: body.toString(),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`[iFlow Auth] Token refresh failed: ${response.status} ${errorText}`);
    }

    const newTokenData = await response.json();
    if (!newTokenData.access_token) {
        throw new Error('[iFlow Auth] Missing access token in refresh response.');
    }
    newTokenData.expiry_date = Date.now() + newTokenData.expires_in * 1000;
    // Fetch user info to get the latest API Key, similar to the Go implementation
    const userInfo = await fetchUserInfo(newTokenData.access_token);
    const updatedCreds = {
        ...auth,
        ...newTokenData,
        ...userInfo
    };
    const newConfig = {
        ...appConfig,
        iflow: appConfig.iflow.map((c) =>
            c.auth?.refresh_token === auth.refresh_token ? { ...c, auth: updatedCreds } : c
        ),
    };

    await updateConfig(newConfig);
    console.log('[iFlow Auth] Access token refreshed and stored successfully.');
    return updatedCreds;
}

/**
 * Gets a valid access token, refreshing it if necessary.
 * @returns {Promise<string>} A promise that resolves with a valid access token.
 */
export async function getAccessToken(auth: IFlowAuth) {
    // Check if the access token is expired or missing
    if (!auth || !auth.access_token || isAccessTokenExpired(auth)) {
        const newAuth = await refreshAccessToken(auth);
        auth.access_token = newAuth.access_token;
        auth.refresh_token = newAuth.refresh_token;
        auth.expiry_date = newAuth.expiry_date;
        auth.apiKey = newAuth.apiKey;
    }

    return auth.apiKey;
}

/**
 * Fetches user info, including the API key, using an access token.
 * (Logic adapted from cmd/iflow.js)
 * @param {string} accessToken - The access token.
 * @returns {Promise<object>} A promise that resolves with the user info data.
 */
async function fetchUserInfo(accessToken: string) {
    const url = new URL(IFLOW_USER_INFO_ENDPOINT);
    url.searchParams.set('accessToken', accessToken);

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`[iFlow Auth] User info request failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    if (!result.success || !result.data || !result.data.apiKey) {
        throw new Error('[iFlow Auth] User info request not successful or API key missing.');
    }
    return result.data;
}