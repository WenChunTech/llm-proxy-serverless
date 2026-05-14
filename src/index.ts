import { refreshAccessToken } from "./providers/iflow/auth.ts";
import { refreshAccessToken as refreshQwenAccessToken } from "./providers/qwen/auth.ts";
import app from "./server.ts";
import { getCredentials, updateCredentials } from "./services/credentials.ts";
import { IFlowConfig, QwenConfig } from "./types/config.ts";
import { logger } from "./utils/logger.ts";

export default {
  hostname: "0.0.0.0",
  port: 3000,
  fetch: app.fetch,
};

Deno.cron("Iflow Auth refresh", "0 */6 * * *", async () => {
  const configKey = "APP_CONFIG";
  let config: any = await getCredentials(configKey);
  if (typeof config === "string") {
    config = JSON.parse(config);
  }

  let configChanged = false;

  const qwen: QwenConfig[] = config.qwen || [];
  if (qwen.length > 0) {
    try {
      const newQwen = qwen.map(async (configToRefresh) => {
        const newAuth = await refreshQwenAccessToken(configToRefresh.auth);
        configToRefresh.auth = newAuth;
        return configToRefresh;
      });
      config.qwen = await Promise.all(newQwen);
      configChanged = true;
    } catch (error) {
      logger.error("[Cron] Failed to refresh qwen tokens:", error);
    }
  }

  const iflow: IFlowConfig[] = config.iflow || [];
  if (iflow.length > 0) {
    try {
      const newIflow = iflow.map(async (configToRefresh) => {
        const newAuth = await refreshAccessToken(configToRefresh.auth);
        configToRefresh.auth = newAuth;
        return configToRefresh;
      });
      config.iflow = await Promise.all(newIflow);
      configChanged = true;
    } catch (error) {
      logger.error("[Cron] Failed to refresh iflow tokens:", error);
    }
  }

  if (configChanged) {
    await updateCredentials(configKey, config);
    logger.info("[Cron] Token refresh completed and config saved");
  }
});
