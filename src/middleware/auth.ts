import { Context, Next } from "hono";
import { appConfig } from "../config";
import { timingSafeCompare } from "../utils/runtime";

function getRequestApiKey(c: Context): string {
  const authorization = c.req.header("Authorization");
  if (authorization) {
    const [scheme, token] = authorization.trim().split(/\s+/, 2);
    if (scheme?.toLowerCase() === "bearer" && token) {
      return token;
    }
  }

  return c.req.header("x-api-key") ||
    c.req.header("x-goog-api-key") ||
    "";
}

export const authMiddleware = async (c: Context, next: Next) => {
  if (c.req.method === "OPTIONS") {
    await next();
    return;
  }

  const configuredApiKey = appConfig.api_key?.trim();
  if (!configuredApiKey) {
    await next();
    return;
  }

  const requestApiKey = getRequestApiKey(c);
  if (!timingSafeCompare(requestApiKey, configuredApiKey)) {
    return c.json({
      error: {
        message: "Invalid API key",
        type: "invalid_request_error",
        code: "invalid_api_key",
      },
    }, 401);
  }

  await next();
};
