import app from "./server";
import { logger } from "./utils/logger";

type AppFetch = typeof app.fetch;

declare const Bun: {
  serve(options: {
    hostname: string;
    port: number;
    fetch: AppFetch;
  }): unknown;
} | undefined;

if (import.meta.main && process.env.VERCEL !== "1" && typeof Bun !== "undefined") {
  const port = Number(process.env.PORT ?? 3000);
  Bun.serve({
    hostname: "0.0.0.0",
    port,
    fetch: app.fetch,
  });
  logger.info(`Server listening on http://0.0.0.0:${port}`);
}

export default app;
