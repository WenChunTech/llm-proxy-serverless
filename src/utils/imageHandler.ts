import { Context } from "hono";
import { appConfig } from "../config";
import { isProviderConfigEnabled } from "../types/config";

function cleanBaseUrl(url: string): string {
  return url.replace(/\/+$/, "").replace(/\/v1$/, "");
}

function findProviderConfig(model: string) {
  const configArrays = [
    appConfig.openai_chat,
    appConfig.openai_responses,
    appConfig.gemini,
    appConfig.claude,
  ] as const;

  for (const arr of configArrays) {
    if (!arr) continue;
    for (const cfg of arr) {
      if (isProviderConfigEnabled(cfg) && cfg.models.includes(model)) {
        return cfg as { base_url: string; api_key: string };
      }
    }
  }
  return undefined;
}

export async function handleImageGeneration(c: Context) {
  const body = await c.req.json();
  const model = body.model as string | undefined;

  if (!model) {
    return c.json(
      { error: { message: "model is required", type: "invalid_request_error" } },
      400,
    );
  }

  const config = findProviderConfig(model);

  if (!config) {
    return c.json(
      {
        error: {
          message: `Model '${model}' not found in any provider configuration`,
          type: "invalid_request_error",
        },
      },
      400,
    );
  }

  const url = `${cleanBaseUrl(config.base_url)}/v1/images/generations`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify(body),
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}