import app from "./server";
import { logger } from "./utils/logger";
import { getEnv } from "./utils/runtime";

type AppFetch = typeof app.fetch;

declare const Bun: {
  serve(options: {
    hostname: string;
    port: number;
    fetch: AppFetch;
  }): unknown;
} | undefined;

if (import.meta.main && getEnv("VERCEL") !== "1" && typeof Bun !== "undefined") {
  const port = Number(getEnv("PORT") ?? 3000);
  Bun.serve({
    hostname: "0.0.0.0",
    port,
    fetch: app.fetch,
  });
  logger.info(`Server listening on http://0.0.0.0:${port}`);
}

export default app;
