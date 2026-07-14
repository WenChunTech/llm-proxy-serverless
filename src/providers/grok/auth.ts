export interface GrokAuth {
  type?: string;
  access_token: string;
  refresh_token: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  expiry_date: number;
  expired?: string;
  last_refresh?: string;
  email?: string;
  sub?: string;
  base_url?: string;
  redirect_uri?: string;
  token_endpoint?: string;
  auth_kind?: string;
  headers?: Record<string, string>;
  disabled?: boolean;
  _validated_at?: string;
  _validation_status?: string;
}

const XAI_DISCOVERY_URL = "https://auth.x.ai/.well-known/openid-configuration";
const XAI_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const DEFAULT_TOKEN_ENDPOINT = "https://auth.x.ai/oauth/token";

function parseJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

async function resolveTokenEndpoint(
  storedEndpoint?: string,
): Promise<string> {
  const endpoint = storedEndpoint?.trim();
  if (endpoint) {
    return endpoint;
  }
  try {
    const resp = await fetch(XAI_DISCOVERY_URL, {
      headers: { Accept: "application/json" },
    });
    if (resp.ok) {
      const data = (await resp.json()) as {
        token_endpoint?: string;
      };
      if (data.token_endpoint) {
        return data.token_endpoint;
      }
    }
  } catch {}
  return DEFAULT_TOKEN_ENDPOINT;
}

export function isTokenExpired(auth: GrokAuth): boolean {
  const expiryDate = auth.expiry_date
    ? auth.expiry_date
    : auth.expired
      ? new Date(auth.expired).getTime()
      : 0;
  return Date.now() >= expiryDate - 300_000;
}

export async function refreshGrokToken(auth: GrokAuth): Promise<GrokAuth> {
  if (!auth.refresh_token) {
    throw new Error(
      "No refresh token available for Grok auth. Re-authentication required.",
    );
  }

  const tokenEndpoint = await resolveTokenEndpoint(auth.token_endpoint);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: XAI_CLIENT_ID,
    refresh_token: auth.refresh_token,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Grok token refresh failed: ${response.status} ${errorText}`,
    );
  }

  const tokenData = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    token_type?: string;
    expires_in?: number;
  };

  let email = auth.email || "";
  let subject = auth.sub || "";

  if (tokenData.id_token) {
    const claims = parseJWT(tokenData.id_token);
    if (claims) {
      if (typeof claims.email === "string") {
        email = claims.email;
      }
      if (typeof claims.sub === "string") {
        subject = claims.sub;
      }
    }
  }

  const expiresIn = tokenData.expires_in || 3600;

  return {
    ...auth,
    id_token: tokenData.id_token || auth.id_token,
    access_token: tokenData.access_token || auth.access_token,
    refresh_token: tokenData.refresh_token || auth.refresh_token,
    token_type: tokenData.token_type || auth.token_type,
    expires_in: expiresIn,
    expiry_date: Date.now() + expiresIn * 1000,
    expired: new Date(Date.now() + expiresIn * 1000).toISOString(),
    last_refresh: new Date().toISOString(),
    email,
    sub: subject,
    token_endpoint: tokenEndpoint,
  };
}

export async function getAccessToken(auth: GrokAuth): Promise<string> {
  if (!auth.access_token || isTokenExpired(auth)) {
    const refreshed = await refreshGrokToken(auth);
    auth.access_token = refreshed.access_token;
    auth.refresh_token = refreshed.refresh_token;
    auth.expiry_date = refreshed.expiry_date;
    auth.id_token = refreshed.id_token;
    auth.email = refreshed.email;
    auth.sub = refreshed.sub;
  }
  return auth.access_token;
}