import { OAuth2Client } from 'google-auth-library';
import * as http from 'http';
import { promises as fs } from 'fs';
import * as path from 'path';

// --- Constants ---
const OAUTH_CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
const OAUTH_CLIENT_SECRET = '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';
const CREDENTIALS_DIR = '.gemini';
const CREDENTIALS_FILE = 'oauth_creds.json';
const AUTH_REDIRECT_PORT = 8085;
const HOST = '127.0.0.1';

// --- Module-level variables ---
const credPath = path.join("./", CREDENTIALS_DIR, CREDENTIALS_FILE);
// const credPath = path.join(os.homedir(), CREDENTIALS_DIR, CREDENTIALS_FILE);
const authClient = new OAuth2Client(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET);

/**
 * Initiates a new token acquisition flow. It starts a local server to
 * listen for the OAuth2 callback, prints an auth URL for the user to visit,
 * and saves the obtained token to the credentials file.
 * @returns {Promise<object>} A promise that resolves with the new tokens.
 */
async function getNewToken() {
    const redirectUri = `http://${HOST}:${AUTH_REDIRECT_PORT}/callback`;
    authClient.redirectUri = redirectUri;

    return new Promise((resolve, reject) => {
        const authUrl = authClient.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/cloud-platform']
        });

        console.log('\n[Gemini Auth] Please open this URL in your browser to authenticate:');
        console.log(authUrl, '\n');

        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url, redirectUri);
                const code = url.searchParams.get('code');

                if (code) {
                    res.end('Authentication successful! You can close this window.');
                    server.close();
                    const { tokens } = await authClient.getToken(code);
                    fs.mkdir(path.dirname(credPath), { recursive: true });
                    fs.writeFile(credPath, JSON.stringify(tokens, null, 2));
                    console.log('[Gemini Auth] New token stored successfully.');
                    resolve(tokens);
                } else {
                    const error = url.searchParams.get('error');
                    if (error) {
                        res.end(`Authentication failed: ${error}. Please try again.`);
                        server.close();
                        reject(new Error(`Authentication failed: ${error}`));
                    }
                }
            } catch (e) {
                server.close();
                reject(e);
            }
        }).listen(AUTH_REDIRECT_PORT, HOST, () => {
            // Server is listening, user interaction is next.
        });
    });
}

/**
 * Checks if the current access token is expired or close to expiring.
 * @returns {boolean} True if the token is expired, otherwise false.
 */
function isAccessTokenExpired() {
    if (!authClient.credentials || !authClient.credentials.expiry_date) {
        return true; // Assume expired if no credentials or expiry date.
    }
    return Date.now() >= authClient.credentials.expiry_date;
}

/**
 * Refreshes the access token using the refresh token.
 * If refreshing fails, it triggers the new token acquisition flow.
 */
async function refreshAccessToken(refreshToken) {
    console.log('[Gemini Auth] Refreshing access token...');
    const { credentials } = await authClient.refreshAccessToken();
    console.log('[Gemini Auth] Refreshed token:', credentials);
    authClient.setCredentials(credentials);
    fs.writeFile(credPath, JSON.stringify(credentials, null, 2));
    console.log('[Gemini Auth] Token refreshed and stored successfully.');
}

/**
 * Initializes authentication by loading tokens from the file.
 * If the file doesn't exist, it starts the new token flow.
 * If tokens are loaded, it checks for expiration and refreshes if needed.
 */
async function initializeAuth() {
    let credentials
    if (await fs.exists(credPath)) {
        const data = await fs.readFile(credPath, "utf8");
        credentials = JSON.parse(data);
    } else {
        console.log(`[Gemini Auth] Credentials file not found. Starting new authentication flow...`);
        credentials = await getNewToken();
        console.log('[Gemini Auth] New token obtained and configured.');
    }
    console.log('[Gemini Auth] Authentication configured successfully.');
    console.log(credentials);
    authClient.setCredentials(credentials);
    if (isAccessTokenExpired()) {
        await refreshAccessToken();
    }
}

/**
 * Retrieves a valid access token. It ensures authentication is initialized
 * and handles token expiration and refreshing automatically.
 * @returns {Promise<string>} A promise that resolves with the valid access token.
 */
export async function getAccessToken() {
    // Ensure credentials are loaded before proceeding.
    if (!authClient.credentials || !authClient.credentials.access_token) {
        await initializeAuth();
    } else if (isAccessTokenExpired()) {
        // If already loaded but expired, refresh.
        await refreshAccessToken();
    }
    return authClient.credentials.access_token;
}