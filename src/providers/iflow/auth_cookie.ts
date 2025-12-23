import { IFlowAuth } from "../../types/config.ts";

// --- Constants ---
const iFlowAPIKeyEndpoint = "https://platform.iflow.cn/api/openapi/apikey";

// --- Interfaces (from Go implementation) ---
interface iFlowKeyData {
  hasExpired: boolean;
  expireTime: string;
  name: string;
  apiKey: string;
  apiKeyMask: string;
}

interface iFlowAPIKeyResponse {
  success: boolean;
  code: string;
  message: string;
  exception: any;
  data: iFlowKeyData;
  extra: any;
}

/**
 * Fetches initial API key information to get the key's name.
 * This mimics the GET request from the browser.
 * @param cookie The browser cookie string.
 * @returns A promise that resolves with the API key data.
 */
async function fetchAPIKeyInfo(cookie: string): Promise<iFlowKeyData> {
  const headers = {
    "Cookie": cookie,
    "Accept": "application/json, text/plain, */*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };

  // Note: The 'fetch' API automatically handles gzip decompression when 'Accept-Encoding'
  // is set in the headers. The response body is transparently decompressed.
  const response = await fetch(iFlowAPIKeyEndpoint, {
    method: "GET",
    headers: headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[iFlow Cookie Auth] GET request failed: ${response.status} ${errorText}`,
    );
  }

  const result: iFlowAPIKeyResponse = await response.json();

  if (!result.success) {
    throw new Error(
      `[iFlow Cookie Auth] GET request not successful: ${result.message}`,
    );
  }

  return result.data;
}

/**
 * Refreshes the API key using the key's name.
 * This mimics the POST request from the browser.
 * @param cookie The browser cookie string.
 * @param name The name of the key to refresh.
 * @returns A promise that resolves with the refreshed API key data.
 */
async function refreshAPIKey(
  cookie: string,
  name: string,
): Promise<iFlowKeyData> {
  const headers = {
    "Cookie": cookie,
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Origin": "https://platform.iflow.cn",
    "Referer": "https://platform.iflow.cn/",
  };

  const body = JSON.stringify({ name: name });

  // Note: The 'fetch' API automatically handles gzip decompression when 'Accept-Encoding'
  // is set in the headers. The response body is transparently decompressed.
  const response = await fetch(iFlowAPIKeyEndpoint, {
    method: "POST",
    headers: headers,
    body: body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[iFlow Cookie Auth] POST request failed: ${response.status} ${errorText}`,
    );
  }

  const result: iFlowAPIKeyResponse = await response.json();

  if (!result.success) {
    throw new Error(
      `[iFlow Cookie Auth] POST request not successful: ${result.message}`,
    );
  }

  return result.data;
}

/**
 * Authenticates with iFlow using a browser cookie to obtain a refreshed API key.
 * The process involves two steps:
 * 1. A GET request to fetch the current API key's name.
 * 2. A POST request with the name to refresh the key and get new details.
 * @param cookie The full cookie string from a browser session on platform.iflow.cn.
 * @returns A promise that resolves with the token data containing the new API key.
 */
export async function authenticateWithCookie(
  cookie: string,
): Promise<IFlowAuth> {
  // Step 1: Get initial API key information to obtain the name
  const keyInfo = await fetchAPIKeyInfo(cookie);
  console.info("[iFlow Cookie Auth] Retrieved API key info:", keyInfo);
  if (!keyInfo.name) {
    throw new Error(
      "[iFlow Cookie Auth] Failed to retrieve API key name from initial fetch.",
    );
  }

  // Step 2: Refresh the API key using the obtained name
  const refreshedKeyInfo = await refreshAPIKey(cookie, keyInfo.name);
  console.info("[iFlow Cookie Auth] Refreshed API key info:", refreshedKeyInfo);
  const expiryDate = new Date(refreshedKeyInfo.expireTime).getTime();
  const auth: IFlowAuth = {
    access_token: "",
    token_type: "",
    refresh_token: "",
    expires_in: 0,
    scope: "",
    expiry_date: expiryDate,
    userId: "",
    userName: refreshedKeyInfo.name,
    avatar: "",
    email: "",
    phone: "",
    apiKey: refreshedKeyInfo.apiKey,
    cookie: cookie,
  };

  return auth;
}
