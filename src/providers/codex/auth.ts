import { CodexAuth } from "../../types/config";

const TOKEN_URL = "https://auth.openai.com/oauth/token";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

/**
 * Parse JWT token claims without signature verification.
 */
function parseJWT(token: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error(
      `Invalid JWT format: expected 3 parts, got ${parts.length}`,
    );
  }
  // base64url -> base64
  let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const claimsData = atob(base64);
  return JSON.parse(claimsData);
}

/**
 * Check if the access token is expired.
 */
export function isTokenExpired(auth: CodexAuth): boolean {
  return Date.now() >= auth.expiry_date - 60_000; // 1 minute buffer
}

/**
 * Refresh the access token using the refresh token.
 */
export async function refreshCodexToken(
  auth: CodexAuth,
): Promise<CodexAuth> {
  if (!auth.refresh_token) {
    throw new Error("No refresh token available for Codex auth");
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: auth.refresh_token,
    scope: "openid email profile offline_access",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Codex token refresh failed: ${response.status} ${errorText}`,
    );
  }

  const tokenData: any = await response.json();

  // Parse ID token to extract updated user info
  let accountId = auth.account_id;
  let email = auth.email;
  let planType = auth.plan_type || "";

  if (tokenData.id_token) {
    try {
      const claims = parseJWT(tokenData.id_token);
      email = claims.email || email;
      const authInfo = claims["https://api.openai.com/auth"] || {};
      accountId = authInfo.chatgpt_account_id || accountId;
      planType = authInfo.chatgpt_plan_type || planType;
    } catch {
      // Keep existing values if parsing fails
    }
  }

  return {
    id_token: tokenData.id_token || auth.id_token,
    access_token: tokenData.access_token || auth.access_token,
    refresh_token: tokenData.refresh_token || auth.refresh_token,
    account_id: accountId,
    email: email,
    plan_type: planType,
    expiry_date: Date.now() + (tokenData.expires_in || 3600) * 1000,
  };
}
