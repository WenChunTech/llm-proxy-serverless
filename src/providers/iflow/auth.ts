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

        for (const config of appConfig.iflow) {
            if (config.auth && config.auth.refresh_token) {
                // Refresh every 50 minutes, as the token expires in 1 hour.
                // 172799 seconds = ~48 hours, so refreshing every 24 hours is safe.
                const refreshInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

                const task = async () => {
                    console.log(`[iFlow Auth] Running scheduled token refresh for user: ${config.auth?.userName}`);
                    try {
                        // We need to pass the most current version of the config.
                        // Since the config can be updated, we find it from the global config.
                        const currentConfig = appConfig.iflow.find(c => c.auth?.userId === config.auth?.userId);
                        if (currentConfig) {
                            await iFlowAuthManager.refreshToken(currentConfig);
                        } else {
                            console.error(`[iFlow Auth] Could not find config for user ${config.auth?.userName} to refresh token.`);
                        }
                    } catch (error) {
                        console.error(`[iFlow Auth] Scheduled token refresh failed for ${config.auth?.userName}:`, error);
                    }
                };

                const refresher = new TokenRefresher(task, refreshInterval);
                refresher.start();
                this.refreshers.push(refresher);
                console.log(`[iFlow Auth] Scheduled token refresh for ${config.auth.userName}.`);
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
