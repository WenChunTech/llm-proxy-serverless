import crypto from 'crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import * as os from 'os';
import { exec } from 'child_process';
import { EventEmitter } from 'events';

// --- Constants ---
const QWEN_DIR = '.qwen';
const QWEN_CREDENTIAL_FILENAME = 'oauth_creds.json';
const QWEN_OAUTH_BASE_URL = 'https://chat.qwen.ai';
const QWEN_OAUTH_DEVICE_CODE_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/device/code`;
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`;
const QWEN_OAUTH_CLIENT_ID = 'f0304373b74a44d2b584a3fb70ca9e56';
const QWEN_OAUTH_SCOPE = 'openid profile email model.completion';
const QWEN_OAUTH_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

// --- Event Emitter ---
const authEvents = new EventEmitter();
const AuthEvent = {
    AuthUri: 'auth-uri',
    AuthProgress: 'auth-progress',
};

// --- Helper Functions ---
async function commonFetch(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.data = errorData;
        throw error;
    }
    return response.json();
}

function generatePKCEPair() {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return { code_verifier: codeVerifier, code_challenge: codeChallenge };
}

function objectToUrlEncoded(data) {
    return Object.keys(data).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`).join('&');
}

async function openUrlInBrowser(url) {
    let command;
    switch (process.platform) {
        case 'darwin': // macOS
            command = `open "${url}"`;
            break;
        case 'win32': // Windows
            command = `start "${url}"`;
            break;
        default: // Linux, etc.
            command = `xdg-open "${url}"`;
            break;
    }
    return new Promise((resolve, reject) => {
        exec(command, (error) => {
            if (error) {
                console.log('Failed to open browser automatically. Please open the URL manually.');
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

// --- Credential Management ---
function getQwenCachedCredentialPath() {
    return path.join(QWEN_DIR, QWEN_CREDENTIAL_FILENAME);
}

async function cacheQwenCredentials(credentials) {
    const filePath = getQwenCachedCredentialPath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(credentials, null, 2));
}

// --- Core Authentication Flow ---
async function authWithQwenDeviceFlow() {
    try {
        const { code_verifier, code_challenge } = generatePKCEPair();
        const deviceAuthResponse = await commonFetch(QWEN_OAUTH_DEVICE_CODE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: objectToUrlEncoded({
                client_id: QWEN_OAUTH_CLIENT_ID,
                scope: QWEN_OAUTH_SCOPE,
                code_challenge,
                code_challenge_method: 'S256',
            }),
        });

        if (!deviceAuthResponse.device_code) {
            throw new Error(`Device authorization failed: ${deviceAuthResponse?.error || 'Unknown error'}`);
        }

        authEvents.emit(AuthEvent.AuthUri, deviceAuthResponse);
        await openUrlInBrowser(deviceAuthResponse.verification_uri_complete).catch(() => { });

        authEvents.emit(AuthEvent.AuthProgress, 'polling', 'Waiting for authorization...');
        const pollInterval = (deviceAuthResponse.interval || 5) * 1000;
        const expires_in = (deviceAuthResponse.expires_in || 1800);
        const maxAttempts = Math.ceil(expires_in / (pollInterval / 1000));

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            try {
                const tokenResponse = await commonFetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: objectToUrlEncoded({
                        grant_type: QWEN_OAUTH_GRANT_TYPE,
                        client_id: QWEN_OAUTH_CLIENT_ID,
                        device_code: deviceAuthResponse.device_code,
                        code_verifier,
                    }),
                });

                if (tokenResponse.access_token) {
                    const credentials = {
                        access_token: tokenResponse.access_token,
                        refresh_token: tokenResponse.refresh_token,
                        expiry_date: Date.now() + tokenResponse.expires_in * 1000,
                        ...tokenResponse,
                    };
                    console.log(tokenResponse);
                    await cacheQwenCredentials(credentials);
                    authEvents.emit(AuthEvent.AuthProgress, 'success', 'Authentication successful!');
                    return { success: true };
                }
            } catch (error) {
                const errorData = error.data || {};
                if (errorData.error !== 'authorization_pending' && errorData.error !== 'slow_down') {
                    throw new Error(`Token polling failed: ${errorData.error_description || error.message}`);
                }
            }
        }

        throw new Error('Authentication timed out.');

    } catch (error) {
        authEvents.emit(AuthEvent.AuthProgress, 'error', error.message);
        return { success: false, reason: error.message };
    }
}

// --- Main Execution ---
async function main() {
    authEvents.on(AuthEvent.AuthUri, (authUri) => {
        console.log('Please go to this URL to authorize the application:');
        console.log(authUri.verification_uri_complete);
    });

    authEvents.on(AuthEvent.AuthProgress, (status, message) => {
        console.log(`[Auth] ${status}: ${message}`);
    });

    const result = await authWithQwenDeviceFlow();

    if (result.success) {
        console.log('Qwen authentication completed successfully.');
        process.exit(0);
    } else {
        console.error(`Qwen authentication failed: ${result.reason}`);
        process.exit(1);
    }
}

main();