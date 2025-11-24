import { QwenAuth } from '../../types/config.ts';
import { appConfig, updateConfig } from '../../config.ts';

const QWEN_OAUTH_TOKEN_ENDPOINT = 'https://chat.qwen.ai/api/v1/oauth2/token';
const QWEN_OAUTH_CLIENT_ID = 'f0304373b74a44d2b584a3fb70ca9e56';

function objectToUrlEncoded(data: Record<string, string>) {
    return Object.keys(data)
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
        .join('&');
}

export function isAccessTokenExpired(auth: QwenAuth): boolean {
    if (!auth || !auth.expiry_date) {
        return true;
    }
    return Date.now() >= auth.expiry_date - 60000;
}

export async function refreshAccessToken(auth: QwenAuth): Promise<QwenAuth> {
    console.log('[Qwen Auth] Refreshing access token...');

    const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body: objectToUrlEncoded({
            'grant_type': 'refresh_token',
            'refresh_token': auth.refresh_token!,
            'client_id': QWEN_OAUTH_CLIENT_ID,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Qwen Auth] Token refresh failed:', errorData);
        throw new Error(`Failed to refresh Qwen access token: ${response.statusText}`);
    }

    const tokenResponse = await response.json();

    const updatedAuth: QwenAuth = {
        ...auth,
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token || auth.refresh_token,
        expiry_date: Date.now() + tokenResponse.expires_in * 1000,
    };

    const newConfig = {
        ...appConfig,
        qwen: appConfig.qwen.map((c) =>
            c.auth?.refresh_token === auth.refresh_token ? { ...c, auth: updatedAuth } : c
        ),
    };

    await updateConfig(newConfig);
    console.log('[Qwen Auth] Refreshed Token');

    return updatedAuth;
}

export async function getAccessToken(auth: QwenAuth): Promise<string> {
    if (!auth || !auth.access_token || isAccessTokenExpired(auth)) {
        const newAuth = await refreshAccessToken(auth);
        auth.access_token = newAuth.access_token;
        auth.expiry_date = newAuth.expiry_date;
        return newAuth.access_token;
    }
    return auth.access_token;
}