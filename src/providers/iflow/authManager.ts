import { IFlowAuth, IFlowConfig } from '../../types/config.ts';
import { appConfig, updateConfig } from '../../config.ts';
import {Buffer} from 'node:buffer'

const IFLOW_OAUTH_TOKEN_ENDPOINT = "https://iflow.cn/oauth/token";
const IFLOW_USER_INFO_ENDPOINT = "https://iflow.cn/api/oauth/getUserInfo";
const IFLOW_OAUTH_CLIENT_ID = "10009311001";
const IFLOW_OAUTH_CLIENT_SECRET = "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW";

class IFlowAuthManager {

    private isAccessTokenExpired(auth: IFlowAuth): boolean {
        if (!auth || !auth.expiry_date) {
            return true;
        }
        // Add a 60-second buffer to be safe
        return Date.now() >= auth.expiry_date - 60000;
    }

    public async refreshToken(configToRefresh: IFlowConfig): Promise<IFlowConfig> {
        const auth = configToRefresh.auth;
        if (!auth || !auth.refresh_token) {
            throw new Error('[iFlow Auth] No refresh token found in the provided config.');
        }
        console.log(`[iFlow Auth] Refreshing access token for user: ${auth.userName}`);

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
        // Fetch user info to get the latest API Key
        const userInfo = await this.fetchUserInfo(newTokenData.access_token);

        const updatedAuth: IFlowAuth = {
            ...auth,
            ...newTokenData,
            ...userInfo,
            expiry_date: Date.now() + newTokenData.expires_in * 1000,
        };

        const updatedConfig = { ...configToRefresh, auth: updatedAuth };

        // Update the global appConfig
        const newAppConfig = {
            ...appConfig,
            iflow: appConfig.iflow.map((c) =>
                c.auth?.userId === updatedAuth.userId ? updatedConfig : c
            ),
        };

        await updateConfig(newAppConfig);
        console.log('[iFlow Auth] Access token refreshed and global config updated successfully.');

        return updatedConfig;
    }

    public async getValidApiKey(config: IFlowConfig): Promise<string> {
        let currentConfig = config;
        if (!currentConfig.auth || this.isAccessTokenExpired(currentConfig.auth)) {
            currentConfig = await this.refreshToken(currentConfig);
        }

        if (!currentConfig.auth?.apiKey) {
            throw new Error("[iFlow Auth] API key is missing after token validation/refresh.");
        }

        return currentConfig.auth.apiKey;
    }
    private async fetchUserInfo(accessToken: string): Promise<Partial<IFlowAuth>> {
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
}

export const iFlowAuthManager = new IFlowAuthManager();