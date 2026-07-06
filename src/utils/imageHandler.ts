import { Context } from "hono";
import { appConfig } from "../config";
import { isProviderConfigEnabled } from "../types/config";
import { logger, RequestLogger } from "./logger";
import { getProxyResponseHeaders } from "./httpHeaders";

function cleanBaseUrl(url: string): string {
  return url.replace(/\/+$/, "").replace(/\/v1$/, "");
}

function findAllProviderConfigs(model: string) {
  const configs: Array<{ base_url: string; api_key: string }> = [];
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
        configs.push(cfg as { base_url: string; api_key: string });
      }
    }
  }
  return configs;
}

export async function handleImageGeneration(c: Context) {
  try {
    const body = await c.req.json();
    const model = body.model as string | undefined;
    const requestLogger = new RequestLogger();
    requestLogger.saveRequestBody(body);

    if (!model) {
      return c.json(
        { error: { message: "model is required", type: "invalid_request_error" } },
        400,
      );
    }

    const configs = findAllProviderConfigs(model);
    logger.info("[image-request-entry]", {
      requestId: requestLogger.getRequestId(),
      model,
      configsCount: configs.length,
    });

    if (configs.length === 0) {
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

    let lastResponse: { status: number; statusText: string; body: string; headers: Headers } | null = null;

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const url = `${cleanBaseUrl(config.base_url)}/v1/images/generations`;

      logger.info("[image-provider-attempt]", {
        requestId: requestLogger.getRequestId(),
        model,
        attempt: i + 1,
        url,
      });

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.api_key}`,
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          logger.info("[image-provider-succeeded]", {
            requestId: requestLogger.getRequestId(),
            model,
            url,
            status: response.status,
          });
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: getProxyResponseHeaders(response.headers),
          });
        }

        const errorBody = await response.text();
        requestLogger.saveRawResponse(errorBody);
        logger.warn("[image-provider-failed]", {
          requestId: requestLogger.getRequestId(),
          model,
          url,
          status: response.status,
          error: errorBody.substring(0, 500),
        });

        lastResponse = {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
          headers: getProxyResponseHeaders(response.headers),
        };
      } catch (fetchError) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
        logger.error("[image-provider-fetch-error]", {
          requestId: requestLogger.getRequestId(),
          model,
          url,
          error: errorMsg,
        });
        lastResponse = {
          status: 502,
          statusText: "Bad Gateway",
          body: JSON.stringify({ error: { message: errorMsg, type: "upstream_error" } }),
          headers: new Headers({ "Content-Type": "application/json" }),
        };
      }
    }

    logger.error("[image-all-providers-failed]", {
      requestId: requestLogger.getRequestId(),
      model,
      lastStatus: lastResponse?.status,
    });

    return new Response(lastResponse!.body, {
      status: lastResponse!.status,
      statusText: lastResponse!.statusText,
      headers: lastResponse!.headers,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error("[image-handler-error]", { error: errMsg });
    return c.json({ error: { message: errMsg, type: "internal_error" } }, 500);
  }
}