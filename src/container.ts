import app from "./server";
import { logger } from "./utils/logger";
import { getEnv } from "./utils/runtime";

const port = Number(getEnv("PORT") ?? 3000);

Bun.serve({
  hostname: "0.0.0.0",
  port,
  fetch: app.fetch,
});

logger.info(`Server listening on http://0.0.0.0:${port}`);
