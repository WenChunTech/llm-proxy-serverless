import { assertEquals, assertThrows } from "@std/assert";
import { appConfig } from "../config.ts";
import { getFallbackChain } from "./retryStrategy.ts";

Deno.test("getFallbackChain returns ordered chain", () => {
  const originalFallbacks = appConfig.fallback_models;

  try {
    appConfig.fallback_models = {
      a: "b",
      b: "c",
    };

    assertEquals(getFallbackChain("a"), ["b", "c"]);
  } finally {
    appConfig.fallback_models = originalFallbacks;
  }
});

Deno.test("getFallbackChain detects cycles", () => {
  const originalFallbacks = appConfig.fallback_models;

  try {
    appConfig.fallback_models = {
      a: "b",
      b: "a",
    };

    assertThrows(
      () => getFallbackChain("a"),
      Error,
      "Fallback cycle detected",
    );
  } finally {
    appConfig.fallback_models = originalFallbacks;
  }
});
