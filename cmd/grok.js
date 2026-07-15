import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { exec } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
const XAI_DISCOVERY_URL = "https://auth.x.ai/.well-known/openid-configuration";
const XAI_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const XAI_SCOPE =
  "openid profile email offline_access grok-cli:access api:access";
const REDIRECT_HOST = "127.0.0.1";
const CALLBACK_PORT = 56121;
const REDIRECT_PATH = "/callback";
const DEFAULT_BASE_URL = "https://cli-chat-proxy.grok.com/v1";
const DEFAULT_OUTPUT_DIR = ".grok";
const TIMEOUT_MS = 5 * 60 * 1000;
const MANUAL_PROMPT_DELAY_MS = 10 * 1000;
function generateRandomString(byteLength) {
  return randomBytes(byteLength).toString("base64url");
}
function generatePKCECodes() {
  const verifier = generateRandomString(96);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
function parseJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}
async function discover() {
  const resp = await fetch(XAI_DISCOVERY_URL, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    throw new Error(
      `xAI discovery failed: ${resp.status} ${await resp.text()}`,
    );
  }
  const data = await resp.json();
  if (!data.authorization_endpoint || !data.token_endpoint) {
    throw new Error(
      "xAI discovery response missing authorization_endpoint or token_endpoint",
    );
  }
  return {
    authorization_endpoint: data.authorization_endpoint,
    token_endpoint: data.token_endpoint,
  };
}
function buildAuthorizeURL(params) {
  const url = new URL(params.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", XAI_CLIENT_ID);
  url.searchParams.set("redirect_uri", params.redirectURI);
  url.searchParams.set("scope", XAI_SCOPE);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("plan", "generic");
  url.searchParams.set("referrer", "cli-proxy-api");
  return url.toString();
}
async function exchangeCodeForTokens(params) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectURI,
    client_id: XAI_CLIENT_ID,
    code_verifier: params.codeVerifier,
  });
  const resp = await fetch(params.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  if (!resp.ok) {
    throw new Error(
      `xAI token exchange failed: ${resp.status} ${await resp.text()}`,
    );
  }
  const data = await resp.json();
  if (!data.access_token) {
    throw new Error("xAI token exchange response missing access_token");
  }
  if (!data.refresh_token) {
    throw new Error("xAI token exchange response missing refresh_token");
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    id_token: data.id_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
  };
}
function openBrowser(url) {
  const platform = process.platform;
  let command;
  if (platform === "darwin") {
    command = `open "${url}"`;
  } else if (platform === "win32") {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  exec(command, (err) => {
    if (err) {
      console.log(
        "Could not open browser automatically. Please open the URL manually.",
      );
    }
  });
}
function startCallbackServer(port) {
  return new Promise((resolve, reject) => {
    let resultResolve;
    const resultPromise = new Promise((res) => (resultResolve = res));
    const server = createServer((req, res) => {
      if (!req.url?.startsWith(REDIRECT_PATH)) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      const url = new URL(req.url, `http://${REDIRECT_HOST}:${port}`);
      const code = url.searchParams.get("code") || "";
      const error = url.searchParams.get("error") || "";
      const state = url.searchParams.get("state") || "";
      resultResolve({ code, error, state });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (code && !error) {
        res.end("<h1>Login successful</h1><p>You can close this window.</p>");
      } else {
        res.end(
          `<h1>Login failed</h1><p>Error: ${error || "unknown"}</p><p>Please check the CLI output.</p>`,
        );
      }
    });
    server.listen(port, REDIRECT_HOST, () => {
      const address = server.address();
      const actualPort =
        address && typeof address === "object" ? address.port : port;
      resolve({ server, actualPort, result: resultPromise });
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        const retryServer = createServer((req, res) => {
          if (!req.url?.startsWith(REDIRECT_PATH)) {
            res.writeHead(404);
            res.end("Not Found");
            return;
          }
          const url = new URL(req.url, `http://${REDIRECT_HOST}:0`);
          const code = url.searchParams.get("code") || "";
          const error = url.searchParams.get("error") || "";
          const state = url.searchParams.get("state") || "";
          resultResolve({ code, error, state });
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          if (code && !error) {
            res.end(
              "<h1>Login successful</h1><p>You can close this window.</p>",
            );
          } else {
            res.end(`<h1>Login failed</h1><p>Error: ${error || "unknown"}</p>`);
          }
        });
        retryServer.listen(0, REDIRECT_HOST, () => {
          const address = retryServer.address();
          const actualPort =
            address && typeof address === "object" ? address.port : 0;
          resolve({
            server: retryServer,
            actualPort,
            result: resultPromise,
          });
        });
      } else {
        reject(err);
      }
    });
  });
}
function readLineFromStdin(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
function parseManualCallbackToken(input, state) {
  const token = input.trim();
  if (!token) {
    return { result: { code: "", error: "", state: "" }, ok: false };
  }
  if (token.includes("://") || token.includes("?") || token.includes("code=")) {
    return {
      result: { code: "", error: "", state: "" },
      ok: false,
      error: "Please paste only the code, not the full callback URL",
    };
  }
  return { result: { code: token, error: "", state }, ok: true };
}
function buildGrokAuthOutput(params) {
  const { tokenData, redirectURI, tokenEndpoint, customHeaders } = params;
  const expiresIn = tokenData.expires_in || 3600;
  const expiryDate = Date.now() + expiresIn * 1000;
  let email = "";
  let subject = "";
  if (tokenData.id_token) {
    const claims = parseJWT(tokenData.id_token);
    if (claims) {
      if (typeof claims.email === "string") email = claims.email;
      if (typeof claims.sub === "string") subject = claims.sub;
    }
  }
  const result = {
    type: "xai",
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    id_token: tokenData.id_token || "",
    token_type: tokenData.token_type || "Bearer",
    expires_in: expiresIn,
    expiry_date: expiryDate,
    expired: new Date(expiryDate).toISOString(),
    last_refresh: new Date().toISOString(),
    email,
    sub: subject,
    base_url: DEFAULT_BASE_URL,
    redirect_uri: redirectURI,
    token_endpoint: tokenEndpoint,
    auth_kind: "oauth",
    disabled: false,
    headers: {
      "x-grok-client-version": "0.2.93",
      "x-xai-token-auth": "xai-grok-cli",
      "x-authenticateresponse": "authenticate-response",
      "x-grok-client-identifier": "grok-shell",
      "User-Agent": "grok-shell/0.2.93 (linux; x86_64)",
    },
  };
  if (customHeaders && Object.keys(customHeaders).length > 0) {
    result.headers = customHeaders;
  }
  return result;
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
xAI Grok OAuth Login Tool

Usage: node cmd/grok.js [options]

Options:
  --no-browser          Do not open browser automatically; print URL instead
  --output-dir=<DIR>    Save credentials JSON file to the specified directory (default: .grok)
  --models=<LIST>       Comma-separated list of models (default: grok-4.5)
  --base-url=<URL>      Override the default API base URL (default: https://cli-chat-proxy.grok.com/v1)
  --headers=<JSON>      Custom headers to include in requests, as JSON object
  --help, -h            Show this help message

The login flow supports two modes:
  1. Automatic callback: Browser redirects to local server (default)
  2. Manual code entry: If the browser shows a code instead of redirecting,
     paste it into the prompt that appears after 10 seconds

Examples:
  node cmd/grok.js
  node cmd/grok.js --no-browser
  node cmd/grok.js --models=grok-4.5
  node cmd/grok.js --output-dir=.grok
  node cmd/grok.js --base-url=https://cli-chat-proxy.grok.com/v1
  node cmd/grok.js --headers='{"x-grok-client-version":"0.2.93","x-xai-token-auth":"xai-grok-cli"}'
`);
    process.exit(0);
  }
  const noBrowser = args.includes("--no-browser");
  const outputDir =
    args.find((a) => a.startsWith("--output-dir="))?.split("=")[1] ||
    DEFAULT_OUTPUT_DIR;
  const models = args
    .find((a) => a.startsWith("--models="))
    ?.split("=")[1]
    ?.split(",")
    .filter(Boolean) || ["grok-3-mini", "grok-3-mini-fast"];
  const baseUrl =
    args.find((a) => a.startsWith("--base-url="))?.split("=")[1] ||
    DEFAULT_BASE_URL;
  const headersArg = args
    .find((a) => a.startsWith("--headers="))
    ?.split("=")
    .slice(1)
    .join("=");
  let customHeaders;
  if (headersArg) {
    try {
      customHeaders = JSON.parse(headersArg);
    } catch {
      console.error(
        'Invalid --headers JSON. Example: --headers=\'{"x-grok-client-version":"0.2.93"}\'',
      );
      process.exit(1);
    }
  }
  console.log("=== xAI Grok OAuth Login ===\n");
  console.log("Step 1: Discovering xAI OAuth endpoints...");
  const discovery = await discover();
  console.log(`  Authorization endpoint: ${discovery.authorization_endpoint}`);
  console.log(`  Token endpoint: ${discovery.token_endpoint}`);
  console.log("\nStep 2: Generating PKCE codes...");
  const pkce = generatePKCECodes();
  const state = generateRandomString(32);
  const nonce = generateRandomString(32);
  console.log("  PKCE codes generated.");
  console.log("\nStep 3: Starting callback server...");
  const serverInfo = await startCallbackServer(CALLBACK_PORT);
  const { server, actualPort, result: callbackPromise } = serverInfo;
  const redirectURI = `http://${REDIRECT_HOST}:${actualPort}${REDIRECT_PATH}`;
  console.log(
    `  Callback server listening on http://${REDIRECT_HOST}:${actualPort}`,
  );
  const authURL = buildAuthorizeURL({
    authorizationEndpoint: discovery.authorization_endpoint,
    redirectURI,
    codeChallenge: pkce.challenge,
    state,
    nonce,
  });
  console.log("\nStep 4: Opening browser for authentication...");
  if (noBrowser) {
    console.log("  --no-browser flag set. Open the URL manually:");
  } else {
    openBrowser(authURL);
  }
  console.log(`\n  ${authURL}\n`);
  console.log("Waiting for authentication (timeout: 5 minutes)...");
  console.log(
    "  If the browser shows a code instead of redirecting, paste it below.\n",
  );
  let callbackResolved = false;
  let callbackResult = null;
  let manualAborted = false;
  callbackPromise.then((result) => {
    callbackResult = result;
    callbackResolved = true;
    manualAborted = true;
  });
  const timeoutPromise = new Promise((_resolve, reject) => {
    setTimeout(() => {
      manualAborted = true;
      reject(new Error("Authentication timed out after 5 minutes"));
    }, TIMEOUT_MS);
  });
  const manualPromptDelay = new Promise((resolve) =>
    setTimeout(resolve, MANUAL_PROMPT_DELAY_MS),
  );
  let authCode = null;
  try {
    await Promise.race([
      callbackPromise,
      timeoutPromise,
      (async () => {
        await manualPromptDelay;
        while (!callbackResolved && !manualAborted) {
          const input = await readLineFromStdin(
            "Paste the code from the browser (or press Enter to keep waiting): ",
          );
          if (callbackResolved || manualAborted) break;
          if (!input) continue;
          const parsed = parseManualCallbackToken(input, state);
          if (parsed.error) {
            console.log(`  Error: ${parsed.error}`);
            continue;
          }
          if (parsed.ok) {
            authCode = parsed.result.code;
            break;
          }
        }
      })(),
    ]);
  } catch (err) {
    server.close();
    console.error("\nAuthentication failed:", err);
    process.exit(1);
  }
  server.close();
  let finalCode;
  let finalState;
  if (authCode) {
    finalCode = authCode;
    finalState = state;
  } else if (callbackResult) {
    if (callbackResult.error) {
      console.error(`\nAuthentication failed: ${callbackResult.error}`);
      process.exit(1);
    }
    if (callbackResult.state !== state) {
      console.error(
        "\nAuthentication failed: invalid state (possible CSRF attack)",
      );
      process.exit(1);
    }
    if (!callbackResult.code) {
      console.error("\nAuthentication failed: missing authorization code");
      process.exit(1);
    }
    finalCode = callbackResult.code;
    finalState = callbackResult.state;
  } else {
    console.error("\nAuthentication failed: no code received");
    process.exit(1);
  }
  console.log("\nStep 5: Exchanging authorization code for tokens...");
  const tokenData = await exchangeCodeForTokens({
    code: finalCode,
    redirectURI,
    codeVerifier: pkce.verifier,
    tokenEndpoint: discovery.token_endpoint,
  });
  console.log("  Token exchange successful.");
  const authOutput = buildGrokAuthOutput({
    tokenData,
    redirectURI,
    tokenEndpoint: discovery.token_endpoint,
    customHeaders,
  });
  if (baseUrl !== DEFAULT_BASE_URL) {
    authOutput.base_url = baseUrl;
  }
  const email = authOutput.email || "unknown";
  const label = email !== "unknown" ? email : "xAI";
  console.log(`\n=== Authentication Successful ===`);
  console.log(`  Account: ${label}`);
  if (authOutput.sub) console.log(`  Subject: ${authOutput.sub}`);
  console.log(`  Expires: ${authOutput.expired}`);
  const providerConfig = {
    models,
    enabled: true,
    base_url: authOutput.base_url || baseUrl,
    auth: authOutput,
  };
  const jsonOutput = JSON.stringify(providerConfig, null, 2);
  const dir = outputDir;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const safeName = email.replace(/[^a-zA-Z0-9@._-]/g, "-");
  const fileName =
    safeName !== "unknown"
      ? `grok-${safeName}.json`
      : `grok-${Date.now()}.json`;
  const filePath = join(dir, fileName);
  writeFileSync(filePath, jsonOutput, "utf8");
  console.log(`\n  Credentials saved to: ${filePath}`);
  console.log("\n=== Provider Configuration ===");
  console.log("Add the following to your config under the 'grok' key:\n");
  console.log(jsonOutput);
  console.log("");
  process.exit(0);
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
