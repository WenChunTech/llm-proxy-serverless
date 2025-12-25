import { refreshAccessToken } from "./providers/iflow/auth.ts";
import { refreshAccessToken as refreshQwenAccessToken } from "./providers/qwen/auth.ts";
import app from "./server.ts";
import { getCredentials, updateCredentials } from "./services/credentials.ts";
import { IFlowConfig, QwenConfig } from "./types/config.ts";

export default {
  hostname: "0.0.0.0",
  port: 3000,
  fetch: app.fetch,
};

Deno.cron("Iflow Auth refresh", "0 */6 * * *", async () => {
  const appConfig = "APP_CONFIG";
  let config: any = await getCredentials(appConfig);
  if (typeof config === "string") {
    config = JSON.parse(config);
  }
  const qwen: QwenConfig[] = config.qwen;
  try {
    const newQwen = qwen.map(async (configToRefresh) => {
      const newAuth = await refreshQwenAccessToken(configToRefresh.auth);
      configToRefresh.auth = newAuth;
      return configToRefresh;
    });
    config.qwen = await Promise.all(newQwen);
  } catch (error) {
    console.log(error);
  }
  if (config.qwen.length > 0) {
    await updateCredentials(appConfig, config);
    console.log("new qwen config saved");
  }

  const iflow: IFlowConfig[] = config.iflow;
  try {
    const newIflow = iflow.map(async (configToRefresh) => {
      const newAuth =  await refreshAccessToken(configToRefresh.auth);
      configToRefresh.auth = newAuth;
      return configToRefresh;
    });
    config.iflow = await Promise.all(newIflow);
  } catch (error) {
    console.log(error);
  }

  if (config.iflow.length > 0) {
    await updateCredentials(appConfig, config);
    console.log("new iflow config saved");
  }
});
