import { appConfig } from '../config.js';
import { refreshAccessToken as refreshIflowToken } from '../providers/iflow/auth.js';
import { refreshAccessToken as refreshQwenToken } from '../providers/qwen/auth.js';

export const refreshAllTokens = async () => {
    const results = {
        iflow: { success: 0, failed: 0, errors: [] as any[] },
        qwen: { success: 0, failed: 0, errors: [] as any[] },
    };

    // Refresh iFlow tokens
    for (const iflowConfig of appConfig.iflow) {
        if (iflowConfig.auth) {
            try {
                await refreshIflowToken(iflowConfig.auth);
                results.iflow.success++;
            } catch (error: any) {
                results.iflow.failed++;
                results.iflow.errors.push(error.message);
                console.error(`[iFlow Refresh] Failed for a configuration: ${error.message}`);
            }
        }
    }

    // Refresh Qwen tokens
    for (const qwenConfig of appConfig.qwen) {
        if (qwenConfig.auth) {
            try {
                await refreshQwenToken(qwenConfig.auth);
                results.qwen.success++;
            } catch (error: any) {
                results.qwen.failed++;
                results.qwen.errors.push(error.message);
                console.error(`[Qwen Refresh] Failed for a configuration: ${error.message}`);
            }
        }
    }

    console.log('[Token Refresh] Process completed.', results);
    return results;
};
