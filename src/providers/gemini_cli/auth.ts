import { GeminiCliAuth } from "../../types/config";
import { appConfig, updateConfig } from "../../config";
import { logger } from "../../utils/logger";

const OAUTH_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const OAUTH_CLIENT_ID = "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com";
const OAUTH_CLIENT_SECRET = "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";

function isAccessTokenExpired(auth: GeminiCliAuth) {
  if (!auth || !auth.expiry_date) {
    return true;
  }
  return Date.now() >= auth.expiry_date;
}

async function refreshAccessToken(auth: GeminiCliAuth) {
  logger.info("[Gemini Auth] Refreshing access token...");

  const response = await fetch(OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: auth.refresh_token,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[Gemini Auth] Token refresh failed: ${response.status} ${errorText}`,
    );
  }

  const credentials = await response.json() as {
    access_token: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };

  logger.info("[Gemini Auth] Refreshed Token");
  const updatedAuth: GeminiCliAuth = {
    ...auth,
    access_token: credentials.access_token,
    expiry_date: Date.now() + (credentials.expires_in ?? 3600) * 1000,
    scope: credentials.scope ?? auth.scope,
    token_type: credentials.token_type ?? auth.token_type,
  };

  const newConfig = {
    ...appConfig,
    gemini_cli: appConfig.gemini_cli.map((c) =>
      c.auth.refresh_token === auth.refresh_token ? { ...c, auth: updatedAuth } : c
    ),
  };

  await updateConfig(newConfig);

  return updatedAuth;
}

export async function getAccessToken(auth: GeminiCliAuth) {
  if (!auth || !auth.access_token || isAccessTokenExpired(auth)) {
    const newCreds = await refreshAccessToken(auth);
    auth.access_token = newCreds.access_token;
    auth.expiry_date = newCreds.expiry_date;
    return newCreds.access_token;
  }
  return auth.access_token;
}

export async function fetchGeminiCLiStreamResponse({ token, data }: any) {
  const response = await fetch("https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return response;
}

export async function fetchGeminiCLiResponse({ token, data }: any) {
  const response = await fetch("https://cloudcode-pa.googleapis.com/v1internal:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return response;
}
