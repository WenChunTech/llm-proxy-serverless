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
const authClient = new OAuth2Client(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET);

async function getNewToken() {
    const redirectUri = `http://${HOST}:${AUTH_REDIRECT_PORT}/callback`;

    return new Promise((resolve, reject) => {
        const authUrl = authClient.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/cloud-platform'],
            redirect_uri: redirectUri
        });

        console.log('\n[Gemini Auth] Please open this URL in your browser to authenticate:');
        console.log(authUrl, '\n');

        const server = http.createServer(async (req, res) => {
            try {
                if (!req.url) {
                    reject(new Error('Request URL is missing.'));
                    return;
                }
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

function isAccessTokenExpired() {
    if (!authClient.credentials || !authClient.credentials.expiry_date) {
        return true;
    }
    return Date.now() >= authClient.credentials.expiry_date;
}

async function refreshAccessToken() {
    console.log('[Gemini Auth] Refreshing access token...');
    const { credentials } = await authClient.refreshAccessToken();
    console.log('[Gemini Auth] Refreshed Token');
    authClient.setCredentials(credentials);
    fs.writeFile(credPath, JSON.stringify(credentials, null, 2));
    console.log('[Gemini Auth] Token refreshed and stored successfully.');
}

export async function initAuthClient() {
    let credentials: any;
    try {
        await fs.stat(credPath);
        const data = await fs.readFile(credPath, "utf8");
        credentials = JSON.parse(data);
    } catch (e) {
        console.log(`[Gemini Auth] Credentials file not found. Starting new authentication flow...`);
        credentials = await getNewToken();
        console.log('[Gemini Auth] New token obtained and configured.');
    }
    console.log('[Gemini Auth] Authentication configured successfully.');
    authClient.setCredentials(credentials);
    if (isAccessTokenExpired()) {
        await refreshAccessToken();
    }
}

export async function getAccessToken() {
    if (!authClient.credentials || !authClient.credentials.access_token || isAccessTokenExpired()) {
        await initAuthClient();
    }
    return authClient.credentials.access_token;
}

export async function fetchGeminiCLiStreamResponse({ token, data }: any) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${data.model}:streamGenerateContent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return response;
}

export async function fetchGeminiCLiResponse({ token, data }: any) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${data.model}:generateContent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return response;
}
