import { Hono } from "hono";
import { serveStatic } from "hono/serve-static";
import { ProviderType } from "../pkg/converter_wasm";

import { handleModelRequest } from "./utils/routeHandlers";
import { handleImageGeneration } from "./utils/imageHandler";
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
  handleTestProvider,
  handleUpdateModelPriority,
  handleValidateCodexAuths,
  handleValidateGrokAuths,
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

type BunLike = {
  file(path: string): {
    arrayBuffer(): Promise<ArrayBuffer>;
    exists(): Promise<boolean>;
  };
};

function getBun(): BunLike | undefined {
  return (globalThis as typeof globalThis & { Bun?: BunLike }).Bun;
}

type AssetsBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

function getAssets(c: { env?: { ASSETS?: AssetsBinding } }): AssetsBinding | undefined {
  return c.env?.ASSETS;
}

function toAssetPath(filePath: string): string {
  const withoutRoot = filePath.replace(/^\.?\/?public\/?/, "");
  return `/${withoutRoot.replace(/^\/+/, "") || "index.html"}`;
}

app.use(
  "/*",
  serveStatic({
    root: "public",
    rewriteRequestPath: (requestPath) =>
      requestPath === "/" ? "/index.html" : requestPath,
    getContent: async (filePath, c) => {
      const assets = getAssets(c);
      if (assets) {
        const assetUrl = new URL(c.req.url);
        assetUrl.pathname = toAssetPath(filePath);
        const response = await assets.fetch(assetUrl);
        return response.status === 404 ? null : response;
      }

      const bun = getBun();
      if (!bun) return null;
      const file = bun.file(filePath);
      if (!(await file.exists())) return null;
      return await file.arrayBuffer();
    },
  }),
);

app.post("/v1/chat/completions", async (c) => {
  return handleModelRequest(c, ProviderType.Chat);
});

app.post("/v1/images/generations", async (c) => {
  return handleImageGeneration(c);
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

app.post("/api/settings/provider/test", async (c) => {
  return handleTestProvider(c);
});

app.post("/api/settings/codex/validate", async (c) => {
  return handleValidateCodexAuths(c);
});

app.post("/api/settings/grok/validate", async (c) => {
  return handleValidateGrokAuths(c);
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