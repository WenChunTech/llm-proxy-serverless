import fs from "node:fs";
import { assertEquals } from "@std/assert";
import {
  appConfig,
  claudePoller,
  geminiCliPoller,
  updateConfig,
} from "./config.ts";
import { getProviderConfigsById } from "./providers/registry.ts";
import type { Config } from "./types/config.ts";

Deno.test("updateConfig refreshes runtime config and pollers", async () => {
  const nextConfig: Config = {
    api_key: "test-key",
    gemini_cli: [{
      projects: ["project-a", "project-b"],
      auth: {
        access_token: "",
        scope: "",
        token_type: "",
        expiry_date: 0,
        refresh_token: "",
      },
      models: ["gemini-2.5-pro"],
    }],
    gemini: [],
    qwen: [],
    openai_chat: [],
    openai_responses: [],
    claude: [{
      base_url: "https://example.com",
      api_key: "claude-key",
      models: ["claude-sonnet"],
      enabled: false,
    }],
    iflow: [],
    codex: [],
    model_priority: ["openai_chat", "claude"],
  };
  const serializedNextConfig = JSON.stringify(nextConfig);
  const configFile = "config.json";
  const fileExisted = fs.existsSync(configFile);
  const originalConfigFile = fileExisted
    ? fs.readFileSync(configFile, "utf-8")
    : null;
  const shouldRestoreOriginal = fileExisted &&
    originalConfigFile?.trim() !== serializedNextConfig;

  try {
    await updateConfig(nextConfig);

    assertEquals(appConfig.api_key, "test-key");
    assertEquals(geminiCliPoller.length, 1);
    assertEquals(claudePoller.length, 0);
    assertEquals(getProviderConfigsById("openai"), []);
    assertEquals(getProviderConfigsById("claude"), []);
  } finally {
    if (shouldRestoreOriginal && originalConfigFile !== null) {
      fs.writeFileSync(configFile, originalConfigFile);
    } else if (fs.existsSync(configFile)) {
      fs.unlinkSync(configFile);
    }
  }
});
