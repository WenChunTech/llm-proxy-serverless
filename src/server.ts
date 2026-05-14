import * as path from "node:path";

import { Hono } from "hono";
import { TargetType } from "../pkg/converter_wasm.js";
import { serveStatic } from "@hono/node-server/serve-static";

import { handleModelRequest } from "./utils/routeHandlers.ts";
import { getModelsResponse } from "./services/models.ts";
import { initMiddleware } from "./middleware/init.ts";
import { authMiddleware } from "./middleware/auth.ts";

const app = new Hono();

// init middleware
app.use("*", initMiddleware);

// cors
app.use(async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  c.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key, x-goog-api-key",
  );
  await next();
});

app.use("/v1/*", authMiddleware);
app.use("/v1beta/*", authMiddleware);

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

app.use(
  "/*",
  serveStatic({
    root: path.join(__dirname, "../public"),
  }),
);

app.post("/v1/chat/completions", async (c) => {
  return handleModelRequest(c, TargetType.OpenAIChat);
});

app.post("/v1/responses", async (c) => {
  return handleModelRequest(c, TargetType.OpenAIResponses);
});

app.post("/v1/messages", async (c) => {
  return handleModelRequest(c, TargetType.Claude);
});

app.post("/v1beta/models/:modelName", async (c) => {
  return handleModelRequest(c, TargetType.Gemini);
});

app.get("/v1/models", async (c) => {
  return getModelsResponse(c);
});

export default app;
