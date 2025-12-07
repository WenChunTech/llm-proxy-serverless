import { appConfig } from '../../config.ts';
import { TokenRefresher } from '../../services/tokenRefresher.ts';
import { iFlowAuthManager } from './authManager.ts';

class IFlowAuth {
    private refreshers: TokenRefresher[] = [];
    private isInitialized = false;

    public init() {
        if (this.isInitialized) {
            return;
        }
        console.log('[iFlow Auth] Initializing token refresh tasks...');
        if (!appConfig.iflow || appConfig.iflow.length === 0) {
            console.log('[iFlow Auth] No iFlow configurations found to initialize.');
            this.isInitialized = true;
            return;
        }
        const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer
        for (const config of appConfig.iflow) {
            if (config.auth && config.auth.refresh_token && config.auth.expiry_date) {
                const task = async (): Promise<number | null> => {
                    console.log(`[iFlow Auth] Running scheduled token refresh for user: ${config.auth?.userName}`);
                    try {
                        const currentConfig = appConfig.iflow.find(c => c.auth?.userId === config.auth?.userId);
                        if (currentConfig) {
                            const updatedConfig = await iFlowAuthManager.refreshToken(currentConfig);
                            const newExpiryDate = updatedConfig.auth?.expiry_date;

                            if (newExpiryDate) {
                                const nextDelay = newExpiryDate - Date.now() - REFRESH_BUFFER_MS;
                                console.log(`[iFlow Auth] Token for ${config.auth?.userName} refreshed. Next refresh in ${Math.round(nextDelay / 1000 / 60)} minutes.`);
                                return nextDelay > 0 ? nextDelay : 0;
                            }
                        }
                        console.error(`[iFlow Auth] Could not find config for user ${config.auth?.userName} to refresh token. Stopping refresher.`);
                        return null;
                    } catch (error) {
                        console.error(`[iFlow Auth] Scheduled token refresh failed for ${config.auth?.userName}:`, error);
                        return null; // Stop refresher on failure
                    }
                };
                const initialDelay = config.auth.expiry_date - Date.now() - REFRESH_BUFFER_MS;
                const refresher = new TokenRefresher(task);
                refresher.start(Math.max(0, initialDelay));
                this.refreshers.push(refresher);

                console.log(`[iFlow Auth] Scheduled token refresh for ${config.auth.userName}. Initial delay: ${Math.round(Math.max(0, initialDelay) / 1000 / 60)} minutes.`);
            }
        }
        this.isInitialized = true;
    }

    public stopAll() {
        console.log('[iFlow Auth] Stopping all token refresh tasks...');
        this.refreshers.forEach(refresher => refresher.stop());
        this.refreshers = [];
        this.isInitialized = false;
    }
}

export const iflowAuth = new IFlowAuth();
