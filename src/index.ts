import { refreshCodexToken } from "./providers/codex/auth.ts";
import app from "./server.ts";
import { getCredentials, updateCredentials } from "./services/credentials.ts";
import { CodexConfig } from "./types/config.ts";
import { logger } from "./utils/logger.ts";

export default {
  hostname: "0.0.0.0",
  port: 3000,
  fetch: app.fetch,
};

Deno.cron("Codex Auth refresh", "0 */12 * * *", async () => {
  const configKey = "APP_CONFIG";
  let config: any = await getCredentials(configKey);
  if (typeof config === "string") {
    config = JSON.parse(config);
  }

  let configChanged = false;

  const codex: CodexConfig[] = config.codex || [];
  if (codex.length > 0) {
    try {
      const newCodex = codex.map(async (configToRefresh) => {
        const newAuth = await refreshCodexToken(configToRefresh.auth);
        configToRefresh.auth = newAuth;
        return configToRefresh;
      });
      config.codex = await Promise.all(newCodex);
      configChanged = true;
    } catch (error) {
      logger.error("[Cron] Failed to refresh codex tokens:", error);
    }
  }

  if (configChanged) {
    await updateCredentials(configKey, config);
    logger.info("[Cron] Token refresh completed and config saved");
  }
});
