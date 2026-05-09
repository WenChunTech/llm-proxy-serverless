import crypto from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import http from "node:http";
import { exec } from "node:child_process";

// --- OAuth Constants (from CLIProxyAPI codex auth) ---
const AUTH_URL = "https://auth.openai.com/oauth/authorize";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const REDIRECT_URI = "http://localhost:1455/auth/callback";
const SCOPES = "openid email profile offline_access";

// --- Local Constants ---
const CREDENTIALS_DIR = ".codex";
const CREDENTIALS_FILE = "oauth_creds.json";

// --- PKCE Functions ---

/**
 * Generates a cryptographically random code verifier for PKCE.
 * @returns {string} A URL-safe base64 encoded random string (128 chars).
 */
function generateCodeVerifier() {
    return crypto.randomBytes(96).toString("base64url");
}

/**
 * Generates a SHA256 code challenge from a code verifier.
 * @param {string} verifier - The code verifier to hash.
 * @returns {string} The base64url-encoded SHA256 hash.
 */
function generateCodeChallenge(verifier) {
    return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// --- JWT Parser ---

/**
 * Parses a JWT token and extracts claims without signature verification.
 * @param {string} token - The JWT token string.
 * @returns {object} The decoded claims.
 */
function parseJWT(token) {
    const parts = token.split(".");
    if (parts.length !== 3) {
        throw new Error(`Invalid JWT format: expected 3 parts, got ${parts.length}`);
    }

    const claimsData = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(claimsData);
}

// --- Helper Functions ---

/**
 * Opens a URL in the default browser.
 * @param {string} url - The URL to open.
 */
async function openUrlInBrowser(url) {
    let command;
    switch (process.platform) {
        case "darwin":
            command = `open "${url}"`;
            break;
        case "win32":
            command = `start "" "${url}"`;
            break;
        default:
            command = `xdg-open "${url}"`;
            break;
    }

    return new Promise((resolve, reject) => {
        exec(command, (error) => {
            if (error) {
                console.log(
                    "Failed to open browser automatically. Please open the URL manually.",
                );
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

// --- OAuth Flow ---

/**
 * Starts a local HTTP server to receive the OAuth callback.
 * @param {string} state - The expected state parameter.
 * @param {string} codeVerifier - The PKCE code verifier.
 * @returns {Promise<object>} A promise that resolves with the credential data.
 */
function startCallbackServer(state, codeVerifier) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url, REDIRECT_URI);

                if (url.pathname !== "/auth/callback") {
                    res.writeHead(204);
                    res.end();
                    return;
                }

                const code = url.searchParams.get("code");
                const receivedState = url.searchParams.get("state");
                const errorParam = url.searchParams.get("error");

                if (errorParam) {
                    const errorMsg = url.searchParams.get("error_description") || errorParam;
                    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(`<html><body><h1>Authentication Failed</h1><p>${errorMsg}</p></body></html>`);
                    server.close();
                    reject(new Error(`OAuth error: ${errorMsg}`));
                    return;
                }

                if (!code) {
                    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<html><body><h1>Authentication Failed</h1><p>No authorization code received.</p></body></html>");
                    server.close();
                    reject(new Error("No authorization code received"));
                    return;
                }

                if (receivedState !== state) {
                    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<html><body><h1>Authentication Failed</h1><p>State mismatch. Possible CSRF attack.</p></body></html>");
                    server.close();
                    reject(new Error("State mismatch"));
                    return;
                }

                // Exchange authorization code for tokens
                const tokenData = await exchangeCodeForTokens(code, codeVerifier);

                // Parse ID token to extract user info
                let accountId = "";
                let email = "";
                let planType = "";

                if (tokenData.id_token) {
                    try {
                        const claims = parseJWT(tokenData.id_token);
                        email = claims.email || "";
                        const authInfo = claims["https://api.openai.com/auth"] || {};
                        accountId = authInfo.chatgpt_account_id || "";
                        planType = authInfo.chatgpt_plan_type || "";
                    } catch (e) {
                        console.warn("Warning: Failed to parse ID token:", e.message);
                    }
                }

                // Build credentials object
                const credentials = {
                    id_token: tokenData.id_token || "",
                    access_token: tokenData.access_token || "",
                    refresh_token: tokenData.refresh_token || "",
                    account_id: accountId,
                    email: email,
                    plan_type: planType,
                    expiry_date: Date.now() + (tokenData.expires_in || 3600) * 1000,
                    token_type: "codex",
                };

                // Save credentials
                const credPath = path.join("./", CREDENTIALS_DIR, CREDENTIALS_FILE);
                await fs.mkdir(path.dirname(credPath), { recursive: true });
                await fs.writeFile(credPath, JSON.stringify(credentials, null, 2));
                console.log(`\n[Codex Auth] Credentials saved to ${credPath}`);

                // Send success response
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authentication Successful - Codex</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex; justify-content: center; align-items: center;
            min-height: 100vh; margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 1rem;
        }
        .container {
            text-align: center; background: white; padding: 2.5rem;
            border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            max-width: 480px; width: 100%;
            animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        .success-icon {
            width: 64px; height: 64px; margin: 0 auto 1.5rem;
            background: #10b981; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            color: white; font-size: 2rem; font-weight: bold;
        }
        h1 { color: #1f2937; margin-bottom: 1rem; font-size: 1.75rem; }
        .subtitle { color: #6b7280; margin-bottom: 1.5rem; font-size: 1rem; line-height: 1.5; }
        .countdown { color: #9ca3af; font-size: 0.75rem; margin-top: 1rem; }
        .footer { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 0.75rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✓</div>
        <h1>Authentication Successful!</h1>
        <p class="subtitle">You have successfully authenticated with Codex. You can now close this window and return to your terminal to continue.</p>
        <div class="countdown">This window will close automatically in <span id="countdown">5</span> seconds</div>
        <div class="footer"><p>Powered by Codex</p></div>
    </div>
    <script>
        let countdown = 5;
        const el = document.getElementById('countdown');
        const timer = setInterval(() => { countdown--; el.textContent = countdown; if (countdown <= 0) { clearInterval(timer); window.close(); } }, 1000);
    </script>
</body>
</html>`);

                server.close();
                resolve(credentials);
            } catch (e) {
                console.error("[Codex Auth] Error during callback handling:", e);
                try {
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(`<html><body><h1>Authentication Error</h1><p>${e.message}</p></body></html>`);
                } catch (_) { }
                server.close();
                reject(e);
            }
        });

        // Parse the redirect URI to get port
        const redirectUrl = new URL(REDIRECT_URI);
        const port = parseInt(redirectUrl.port, 10);

        server.listen(port, redirectUrl.hostname, () => {
            console.log(`[Codex Auth] Listening for OAuth callback on ${REDIRECT_URI}`);
        });

        server.on("error", (err) => {
            reject(new Error(`Failed to start callback server: ${err.message}`));
        });
    });
}

/**
 * Exchanges an authorization code for tokens.
 * @param {string} code - The authorization code.
 * @param {string} codeVerifier - The PKCE code verifier.
 * @returns {Promise<object>} The token response data.
 */
async function exchangeCodeForTokens(code, codeVerifier) {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
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
            `Token exchange failed: ${response.status} ${errorText}`,
        );
    }

    return response.json();
}

// --- Main Execution ---

(async () => {
    try {
        // Generate PKCE codes
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);
        const state = crypto.randomBytes(16).toString("hex");

        // Build authorization URL
        const authParams = new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: "code",
            redirect_uri: REDIRECT_URI,
            scope: SCOPES,
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            prompt: "login",
            id_token_add_organizations: "true",
            codex_cli_simplified_flow: "true",
        });
        const authUrl = `${AUTH_URL}?${authParams.toString()}`;

        console.log("\n[Codex Auth] Please open this URL in your browser to authenticate:");
        console.log(authUrl, "\n");

        // Try to open browser automatically
        await openUrlInBrowser(authUrl).catch(() => { });

        console.log("Waiting for Codex authentication callback...");

        // Wait for the OAuth callback
        const credentials = await startCallbackServer(state, codeVerifier);

        console.log("\n[Codex Auth] Authentication completed successfully!");
        console.log(`  Email: ${credentials.email}`);
        console.log(`  Account ID: ${credentials.account_id}`);
        console.log(`  Plan Type: ${credentials.plan_type}`);
        console.log(`  Token expires: ${new Date(credentials.expiry_date).toLocaleString()}`);

        process.exit(0);
    } catch (error) {
        console.error("\n[Codex Auth] Authentication failed:", error.message);
        process.exit(1);
    }
})();