import { OAuth2Client } from "google-auth-library";
import { GeminiCliAuth } from "../../types/config.ts";
import { appConfig, updateConfig } from "../../config.ts";

// 定义本地类型以避免直接导入 gaxios
interface GaxiosOptions {
  url?: string;
  method?: string;
  headers?: any;
  data?: any;
}

interface GaxiosResponse {
  config: any;
  data: any;
  headers: any;
  status: number;
  statusText: string;
}

const OAUTH_CLIENT_ID =
  "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com";
const OAUTH_CLIENT_SECRET = "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";

const authClient = new OAuth2Client(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET);

/**
 * A gaxios adapter that uses Deno's native fetch.
 * This is to work around a bug in Deno's node compatibility layer for http.
 */
async function denoFetchAdapter(
  options: GaxiosOptions,
): Promise<GaxiosResponse> {
  const response = await fetch(options.url!, {
    method: options.method,
    headers: options.headers as HeadersInit,
    body: options.data as BodyInit,
  });

  const responseText = await response.text();
  let data;
  try {
    // The token response is JSON
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }

  return {
    config: options as any,
    data: data,
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  } as any;
}

// Force gaxios to use the Deno native fetch adapter.
// @ts-ignore
authClient.transporter.defaults.adapter = denoFetchAdapter;

function isAccessTokenExpired(auth: GeminiCliAuth) {
  if (!auth || !auth.expiry_date) {
    return true;
  }
  return Date.now() >= auth.expiry_date;
}

async function refreshAccessToken(auth: GeminiCliAuth) {
  console.log("[Gemini Auth] Refreshing access token...");
  authClient.setCredentials(auth);
  const { credentials } = await authClient.refreshAccessToken();
  console.log("[Gemini Auth] Refreshed Token");
  const updatedAuth = {
    ...auth,
    access_token: credentials.access_token!,
    expiry_date: credentials.expiry_date!,
  };

  const newConfig = {
    ...appConfig,
    gemini_cli: appConfig.gemini_cli.map((c) =>
      c.auth.refresh_token === auth.refresh_token
        ? { ...c, auth: updatedAuth }
        : c
    ),
  };

  await updateConfig(newConfig);

  return credentials;
}

export async function getAccessToken(auth: GeminiCliAuth) {
  if (!auth || !auth.access_token || isAccessTokenExpired(auth)) {
    const newCreds = await refreshAccessToken(auth);
    auth.access_token = newCreds.access_token!;
    auth.expiry_date = newCreds.expiry_date!;
    return newCreds.access_token;
  }
  return auth.access_token;
}

export async function fetchGeminiCLiStreamResponse({ token, data }: any) {
  const response = await fetch(
    `https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    },
  );
  return response;
}

export async function fetchGeminiCLiResponse({ token, data }: any) {
  const response = await fetch(
    `https://cloudcode-pa.googleapis.com/v1internal:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    },
  );
  return response;
}
