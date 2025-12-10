import { appConfig } from '../../config.ts';
import { TokenRefresher } from '../../services/tokenRefresher.ts';
import { iFlowAuthManager } from './authManager.ts';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

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
        for (const config of appConfig.iflow) {
            if (config.auth && config.auth.refresh_token) {
                const task = async (): Promise<number | null> => {
                    console.log(`[iFlow Auth] Running scheduled token refresh for user: ${config.auth?.userName}`);
                    try {
                        const currentConfig = appConfig.iflow.find(c => c.auth?.userId === config.auth?.userId);
                        if (currentConfig) {
                            await iFlowAuthManager.refreshToken(currentConfig);
                            console.log(`[iFlow Auth] Token for ${config.auth?.userName} refreshed. Next refresh in 10 minutes.`);
                            return REFRESH_INTERVAL_MS;
                        }
                        console.error(`[iFlow Auth] Could not find config for user ${config.auth?.userName} to refresh token. Stopping refresher.`);
                        return null;
                    } catch (error) {
                        console.error(`[iFlow Auth] Scheduled token refresh failed for ${config.auth?.userName}:`, error);
                        return REFRESH_INTERVAL_MS; // Retry after 10 minutes
                    }
                };
                const initialDelay = REFRESH_INTERVAL_MS;
                const refresher = new TokenRefresher(task);
                refresher.start(initialDelay);
                this.refreshers.push(refresher);

                console.log(`[iFlow Auth] Scheduled token refresh for ${config.auth.userName}. First refresh in 10 minutes.`);
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
