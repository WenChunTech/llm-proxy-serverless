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
    }],
    iflow: [],
    codex: [],
    model_priority: ["openai", "claude"],
  };

  await updateConfig(nextConfig);

  assertEquals(appConfig.api_key, "test-key");
  assertEquals(geminiCliPoller.length, 1);
  assertEquals(claudePoller.length, 1);
  assertEquals(getProviderConfigsById("openai"), []);
});
