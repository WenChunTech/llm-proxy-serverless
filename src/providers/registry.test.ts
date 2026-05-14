import { assertEquals } from "@std/assert";
import { appConfig } from "../config.ts";
import { PROVIDERS } from "./_base/index.ts";
import {
  getProviderConfigsById,
  getProvidersForModel,
  normalizeModelPriority,
} from "./registry.ts";

Deno.test("normalizeModelPriority maps openai alias to openai_chat", () => {
  const priority = normalizeModelPriority(["openai", "claude"]);

  assertEquals(priority[0], PROVIDERS.OPENAI_CHAT);
  assertEquals(priority[1], PROVIDERS.CLAUDE);
});

Deno.test("getProvidersForModel follows normalized priority", () => {
  const originalOpenAI = appConfig.openai_chat;
  const originalClaude = appConfig.claude;
  const originalPriority = appConfig.model_priority;

  try {
    appConfig.openai_chat = [{
      base_url: "https://example.com",
      api_key: "openai-key",
      models: ["shared-model"],
    }];
    appConfig.claude = [{
      base_url: "https://example.com",
      api_key: "claude-key",
      models: ["shared-model"],
    }];
    appConfig.model_priority = ["claude", "openai_chat"];

    assertEquals(getProvidersForModel("shared-model"), [
      PROVIDERS.CLAUDE,
      PROVIDERS.OPENAI_CHAT,
    ]);
  } finally {
    appConfig.openai_chat = originalOpenAI;
    appConfig.claude = originalClaude;
    appConfig.model_priority = originalPriority;
  }
});

Deno.test("getProviderConfigsById accepts openai alias", () => {
  const originalOpenAI = appConfig.openai_chat;

  try {
    appConfig.openai_chat = [{
      base_url: "https://example.com",
      api_key: "openai-key",
      models: ["alias-model"],
    }];

    assertEquals(getProviderConfigsById("openai"), appConfig.openai_chat);
  } finally {
    appConfig.openai_chat = originalOpenAI;
  }
});
