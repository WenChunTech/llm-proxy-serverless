import { assertEquals } from "@std/assert";
import app from "./server.ts";
import { appConfig } from "./config.ts";

Deno.test("auth middleware rejects missing API key on protected route", async () => {
  const originalApiKey = appConfig.api_key;

  try {
    appConfig.api_key = "secret-key";

    const response = await app.request("/v1/models");
    const body = await response.json();

    assertEquals(response.status, 401);
    assertEquals(body.error.code, "invalid_api_key");
  } finally {
    appConfig.api_key = originalApiKey;
  }
});

Deno.test("auth middleware accepts bearer token on protected route", async () => {
  const originalApiKey = appConfig.api_key;
  const originalOpenAI = appConfig.openai_chat;

  try {
    appConfig.api_key = "secret-key";
    appConfig.openai_chat = [{
      base_url: "https://example.com",
      api_key: "openai-key",
      models: ["gpt-4o"],
    }];

    const response = await app.request("/v1/models", {
      headers: {
        Authorization: "Bearer secret-key",
      },
    });

    assertEquals(response.status, 200);
  } finally {
    appConfig.api_key = originalApiKey;
    appConfig.openai_chat = originalOpenAI;
  }
});
