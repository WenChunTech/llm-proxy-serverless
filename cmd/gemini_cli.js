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
async function getNewTokenFromWeb() {
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

await getNewTokenFromWeb()