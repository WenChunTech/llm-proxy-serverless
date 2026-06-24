import * as path from "node:path";

import { Hono } from "hono";
import { ProviderType } from "../pkg/converter_wasm";
import { serveStatic } from "hono/bun";

import { handleModelRequest } from "./utils/routeHandlers";
import { getModelsResponse } from "./services/models";
import { initMiddleware } from "./middleware/init";
import { authMiddleware } from "./middleware/auth";
import {
  handleAddProvider,
  handleFetchProviderModels,
  handleImportSettings,
  handleRemoveProvider,
  handleSetFallbackModel,
  handleSettingsGet,
  handleSettingsPost,
  handleSettingsVerify,
  handleUpdateModelPriority,
} from "./utils/settingsHandler";
import {
  handleClearErrorLogs,
  handleGetErrorLogs,
} from "./utils/errorLogHandler";
import { refreshAllTokens } from "./services/refresh";

const app = new Hono();

app.use("*", initMiddleware);

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
  return handleModelRequest(c, ProviderType.Chat);
});

app.post("/v1/responses", async (c) => {
  return handleModelRequest(c, ProviderType.Responses);
});

app.post("/v1/messages", async (c) => {
  return handleModelRequest(c, ProviderType.Claude);
});

app.post("/v1beta/models/:modelName", async (c) => {
  return handleModelRequest(c, ProviderType.Gemini);
});

app.get("/v1/models", async (c) => {
  return getModelsResponse(c);
});

app.get("/api/settings/verify", async (c) => {
  return handleSettingsVerify(c);
});

app.get("/api/settings", async (c) => {
  return handleSettingsGet(c);
});

app.post("/api/settings", async (c) => {
  return handleSettingsPost(c);
});

app.post("/api/settings/provider/add", async (c) => {
  return handleAddProvider(c);
});

app.post("/api/settings/provider/models", async (c) => {
  return handleFetchProviderModels(c);
});

app.post("/api/settings/provider/remove", async (c) => {
  return handleRemoveProvider(c);
});

app.post("/api/settings/import", async (c) => {
  return handleImportSettings(c);
});

app.post("/api/settings/model-priority", async (c) => {
  return handleUpdateModelPriority(c);
});

app.post("/api/settings/fallback-model", async (c) => {
  return handleSetFallbackModel(c);
});

app.get("/api/logs", async (c) => {
  return handleGetErrorLogs(c);
});

app.get("/api/logs/clear", async (c) => {
  return handleClearErrorLogs(c);
});

app.get("/api/refresh-tokens", async (c) => {
  const results = await refreshAllTokens();
  return c.json(results);
});

export default app;
