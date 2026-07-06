import { appConfig, updateConfig } from '../config';
import { isAccessTokenExpired, refreshAccessToken as refreshIflowToken } from '../providers/iflow/auth';
import { refreshAccessToken as refreshQwenToken, isAccessTokenExpired as isQwenAccessTokenExpired } from '../providers/qwen/auth';
import { isTokenExpired as isCodexTokenExpired, refreshCodexToken } from '../providers/codex/auth';
import { CodexAuth } from '../types/config';

function getCodexAuthList(auth: CodexAuth | CodexAuth[]): CodexAuth[] {
    return Array.isArray(auth) ? [...auth] : [auth];
}

async function refreshCodexTokens(results: {
    codex: {
        success: number;
        refreshed: number;
        skipped: number;
        failed: number;
        errors: any[];
    };
}) {
    const codexConfigs = Array.isArray(appConfig.codex) ? appConfig.codex : [];
    if (codexConfigs.length === 0) return;

    let changed = false;
    const updatedCodexConfigs = [...codexConfigs];

    for (let configIndex = 0; configIndex < codexConfigs.length; configIndex++) {
        const codexConfig = codexConfigs[configIndex];
        if (!codexConfig || codexConfig.enabled === false || !codexConfig.auth) {
            continue;
        }

        const authIsArray = Array.isArray(codexConfig.auth);
        const authList = getCodexAuthList(codexConfig.auth);
        let authListChanged = false;

        for (let authIndex = 0; authIndex < authList.length; authIndex++) {
            const auth = authList[authIndex];
            if (!auth || auth.disabled || !auth.refresh_token) {
                results.codex.skipped++;
                continue;
            }

            try {
                if (isCodexTokenExpired(auth)) {
                    authList[authIndex] = await refreshCodexToken(auth);
                    authListChanged = true;
                    results.codex.refreshed++;
                }
                results.codex.success++;
            } catch (error: any) {
                results.codex.failed++;
                results.codex.errors.push(error.message);
                console.error(`[Codex Refresh] Failed for a configuration: ${error.message}`);
            }
        }

        if (authListChanged) {
            updatedCodexConfigs[configIndex] = {
                ...codexConfig,
                auth: authIsArray ? authList : authList[0],
            };
            changed = true;
        }
    }

    if (changed) {
        await updateConfig({
            ...appConfig,
            codex: updatedCodexConfigs,
        });
    }
}

export const refreshAllTokens = async () => {
    const results = {
        iflow: { success: 0, failed: 0, errors: [] as any[] },
        qwen: { success: 0, failed: 0, errors: [] as any[] },
        codex: {
            success: 0,
            refreshed: 0,
            skipped: 0,
            failed: 0,
            errors: [] as any[],
        },
    };

    // Refresh iFlow tokens
    for (const iflowConfig of appConfig.iflow) {
        if (iflowConfig.auth) {
            try {
                if (isAccessTokenExpired(iflowConfig.auth)) {
                    await refreshIflowToken(iflowConfig.auth);
                }
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
                if (isQwenAccessTokenExpired(qwenConfig.auth)) {
                    await refreshQwenToken(qwenConfig.auth);
                }
                results.qwen.success++;
            } catch (error: any) {
                results.qwen.failed++;
                results.qwen.errors.push(error.message);
                console.error(`[Qwen Refresh] Failed for a configuration: ${error.message}`);
            }
        }
    }

    await refreshCodexTokens(results);

    console.log('[Token Refresh] Process completed.', results);
    return results;
};
