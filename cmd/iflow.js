import * as http from 'http';
import { promises as fs } from 'fs';
import * as path from 'path';
import { URLSearchParams } from 'url';
import crypto from 'crypto';

// --- iFlow Constants ---
const IFLOW_OAUTH_TOKEN_ENDPOINT = "https://iflow.cn/oauth/token";
const IFLOW_OAUTH_AUTHORIZE_ENDPOINT = "https://iflow.cn/oauth";
const IFLOW_USER_INFO_ENDPOINT = "https://iflow.cn/api/oauth/getUserInfo";
const IFLOW_OAUTH_CLIENT_ID = "10009311001";
const IFLOW_OAUTH_CLIENT_SECRET = "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW";

// --- Local Constants ---
const CREDENTIALS_DIR = '.iflow';
const IFLOW_CREDENTIAL_FILENAME = 'oauth_creds.json';
const AUTH_REDIRECT_PORT = 11451;
const HOST = '127.0.0.1';

/**
 * Generates a random string for the OAuth state parameter.
 * @returns {string} A random state string.
 */
function generateRandomState() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Makes a POST request to exchange an authorization code for an access token.
 * @param {URLSearchParams} body - The request body.
 * @returns {Promise<object>} A promise that resolves with the token data.
 */
async function fetchToken(body) {
    const basicAuth = Buffer.from(`${IFLOW_OAUTH_CLIENT_ID}:${IFLOW_OAUTH_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(IFLOW_OAUTH_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Authorization': `Basic ${basicAuth}`
        },
        body: body.toString(),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`iFlow token request failed: ${response.status} ${errorText}`);
    }
    return response.json();
}

/**
 * Fetches user info, including the API key, using an access token.
 * @param {string} accessToken - The access token obtained from the token endpoint.
 * @returns {Promise<object>} A promise that resolves with the user info data.
 */
async function fetchUserInfo(accessToken) {
    const url = new URL(IFLOW_USER_INFO_ENDPOINT);
    url.searchParams.set('accessToken', accessToken);

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`iFlow user info request failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    if (!result.success || !result.data || !result.data.apiKey) {
        throw new Error('iFlow user info request not successful or API key missing in response.');
    }
    return result.data;
}

/**
 * Initiates a new token acquisition flow for iFlow. It starts a local server to
 * listen for the OAuth2 callback, prints an auth URL for the user to visit,
 * exchanges the code for a token, fetches the API key, and saves the combined
 * credentials to a file.
 * @returns {Promise<object>} A promise that resolves with the new credentials.
 */
async function getNewTokenFromWeb() {
    const redirectUri = `http://${HOST}:${AUTH_REDIRECT_PORT}/oauth2callback`;
    const state = generateRandomState();

    return new Promise((resolve, reject) => {
        const authUrlParams = new URLSearchParams({
            loginMethod: 'phone',
            type: 'phone',
            redirect: redirectUri,
            state: state,
            client_id: IFLOW_OAUTH_CLIENT_ID,
        });
        const authUrl = `${IFLOW_OAUTH_AUTHORIZE_ENDPOINT}?${authUrlParams.toString()}`;

        console.log('\n[iFlow Auth] Please open this URL in your browser to authenticate:');
        console.log(authUrl, '\n');
        console.log('Waiting for iFlow authentication callback...');

        const server = http.createServer(async (req, res) => {
            try {
                const requestUrl = new URL(req.url, redirectUri);

                // Ignore requests for favicon.ico or other paths to prevent state mismatch errors.
                if (requestUrl.pathname !== '/oauth2callback') {
                    res.writeHead(204); // No Content
                    res.end();
                    return;
                }

                const code = requestUrl.searchParams.get('code');
                const receivedState = requestUrl.searchParams.get('state');

                if (receivedState !== state) {
                    res.end('Authentication failed: State mismatch. Please try again.');
                    server.close();
                    return reject(new Error('State mismatch'));
                }

                if (code) {
                    res.end('Authentication successful! You can close this window.');
                    server.close();

                    // 1. Exchange authorization code for tokens
                    const tokenBody = new URLSearchParams({
                        grant_type: 'authorization_code',
                        code: code,
                        redirect_uri: redirectUri,
                        client_id: IFLOW_OAUTH_CLIENT_ID,
                        client_secret: IFLOW_OAUTH_CLIENT_SECRET,
                    });
                    const tokenData = await fetchToken(tokenBody);
                    tokenData.expiry_date = Date.now() + tokenData.expires_in * 1000;

                    if (!tokenData.access_token) {
                        throw new Error('Missing access token in iFlow response.');
                    }

                    // 2. Fetch user info to get the API Key
                    const userInfo = await fetchUserInfo(tokenData.access_token);

                    // 3. Combine and save credentials
                    const credentials = {
                        ...tokenData,
                        ...userInfo,
                    };
                    const finalCredPath = path.join("./", CREDENTIALS_DIR, IFLOW_CREDENTIAL_FILENAME);
                    await fs.mkdir(path.dirname(finalCredPath), { recursive: true });
                    await fs.writeFile(finalCredPath, JSON.stringify(credentials, null, 2));
                    console.log(`[iFlow Auth] New token stored successfully in ${finalCredPath}`);
                    resolve(credentials);

                } else {
                    const error = requestUrl.searchParams.get('error');
                    if (error) {
                        res.end(`Authentication failed: ${error}. Please try again.`);
                        server.close();
                        reject(new Error(`Authentication failed: ${error}`));
                    }
                }
            } catch (e) {
                console.error('[iFlow Auth] An error occurred during the authentication process:', e);
                server.close();
                reject(e);
            }
        }).listen(AUTH_REDIRECT_PORT, HOST, () => {
            // Server is listening for the callback.
        });
    });
}

// --- Main Execution ---
(async () => {
    try {
        await getNewTokenFromWeb();
        process.exit(0);
    } catch (error) {
        console.error("Failed to get iFlow token:", error.message);
        process.exit(1);
    }
})();