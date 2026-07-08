const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const querystring = require("querystring");

const DEFAULT_BASE_URL = "https://chatgpt.com/backend-api/codex";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CONCURRENCY = 5;
const TIMEOUT_MS = 30000;

function parseArgs() {
  const args = process.argv.slice(2);
  let authDir = null;
  let outputFile = "valid-codex-auths.json";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && i + 1 < args.length) {
      outputFile = args[i + 1];
      i++;
    } else if (!authDir) {
      authDir = args[i];
    }
  }

  if (!authDir) {
    console.error(
      "Usage: node validate-codex-auths.js <auth-dir> [--output <output-file>]",
    );
    process.exit(1);
  }

  return { authDir, outputFile };
}

function resolveHome(p) {
  if (p.startsWith("~/")) {
    return path.join(
      process.env.HOME || process.env.USERPROFILE || "/tmp",
      p.slice(2),
    );
  }
  return p;
}

function loadAuthFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    console.error(`Error reading directory ${dir}: ${err.message}`);
    process.exit(1);
  }

  const auths = [];

  for (const file of entries) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(dir, file);
    let content;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch (err) {
      console.error(`  ERROR reading ${file}: ${err.message}`);
      continue;
    }

    let data;
    try {
      data = JSON.parse(content);
    } catch (err) {
      console.error(`  ERROR parsing ${file}: ${err.message}`);
      continue;
    }

    if (data.type !== "codex") continue;

    if (data.disabled === true) {
      console.log(`  SKIP (disabled): ${file}`);
      continue;
    }

    const token = data.access_token || "";
    if (!token) {
      console.log(`  SKIP (no access_token): ${file}`);
      continue;
    }

    const refreshToken = data.refresh_token || "";
    const baseURL = data.base_url || DEFAULT_BASE_URL;
    const email = data.email || file.replace(/\.json$/, "");

    auths.push({
      file,
      filePath,
      data,
      token,
      refreshToken,
      baseURL,
      email,
      planType: data.plan_type || "",
      refreshed: false,
    });
  }

  return auths;
}

function makeRequest(url, token, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const transport = urlObj.protocol === "https:" ? https : http;
    const bodyStr = JSON.stringify(body);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Length": Buffer.byteLength(bodyStr),
        "User-Agent": "Codex-Auth-Validator/1.0",
        Accept: "application/json",
      },
      timeout: TIMEOUT_MS,
    };

    const req = transport.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
          rawBody: raw,
        });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("request timeout"));
    });
    req.write(bodyStr);
    req.end();
  });
}

function postForm(url, formData) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const transport = urlObj.protocol === "https:" ? https : http;
    const bodyStr = querystring.stringify(formData);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
      timeout: TIMEOUT_MS,
    };

    const req = transport.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
        resolve({ statusCode: res.statusCode, body: parsed, rawBody: raw });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("token refresh timeout"));
    });
    req.write(bodyStr);
    req.end();
  });
}

async function tryRefresh(auth) {
  if (!auth.refreshToken) return null;

  const resp = await postForm(TOKEN_URL, {
    client_id: CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: auth.refreshToken,
    scope: "openid profile email",
  });

  if (resp.statusCode !== 200 || !resp.body || !resp.body.access_token) {
    const errMsg =
      (resp.body && (resp.body.error_description || resp.body.error)) ||
      `HTTP ${resp.statusCode}`;
    return { ok: false, error: errMsg };
  }

  const expireDate = new Date(
    Date.now() + (resp.body.expires_in || 3600) * 1000,
  ).toISOString();

  // Update in-memory data
  auth.data.access_token = resp.body.access_token;
  auth.data.refresh_token = resp.body.refresh_token || auth.refreshToken;
  auth.data.id_token = resp.body.id_token || auth.data.id_token;
  auth.data.expired = expireDate;
  auth.data.last_refresh = new Date().toISOString();
  auth.token = resp.body.access_token;
  auth.refreshToken = resp.body.refresh_token || auth.refreshToken;
  auth.refreshed = true;

  // Persist back to disk
  try {
    fs.writeFileSync(auth.filePath, JSON.stringify(auth.data, null, 2));
  } catch (err) {
    return {
      ok: true,
      error: `token refreshed but failed to save: ${err.message}`,
    };
  }

  return { ok: true };
}

function classify(response) {
  const { statusCode, body, rawBody } = response;
  const err = body && body.error ? body.error : {};
  const errType = (err.type || "").toLowerCase();
  const errCode = (err.code || "").toLowerCase();
  const errMsg = err.message || "";
  const lower = rawBody.toLowerCase();

  if (
    statusCode === 401 ||
    errType === "authentication_error" ||
    errCode === "invalid_api_key" ||
    lower.includes("invalid or expired token")
  ) {
    return {
      valid: false,
      reason: "invalid_auth",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }

  if (statusCode === 200 || statusCode === 201) {
    return { valid: true, reason: "ok", errType, errCode, errMsg, statusCode };
  }

  if (statusCode === 402) {
    return {
      valid: false,
      reason: "payment_required",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }
  if (statusCode === 403) {
    return {
      valid: false,
      reason: "forbidden",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }

  if (statusCode === 402) {
    return {
      valid: true,
      reason: "payment_required",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }
  if (statusCode === 403) {
    return {
      valid: true,
      reason: "forbidden",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }
  if (statusCode === 429) {
    return {
      valid: true,
      reason: "rate_limited",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }

  if (statusCode >= 400 && statusCode < 500 && statusCode !== 401) {
    return {
      valid: true,
      reason: "request_error",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }

  if (statusCode >= 500) {
    return {
      valid: true,
      reason: "server_error",
      errType,
      errCode,
      errMsg,
      statusCode,
    };
  }

  return {
    valid: false,
    reason: "unexpected",
    errType,
    errCode,
    errMsg,
    statusCode,
  };
}

async function main() {
  const { authDir, outputFile } = parseArgs();
  const resolvedDir = resolveHome(authDir);

  console.log(`Scanning: ${resolvedDir}\n`);

  const all = loadAuthFiles(resolvedDir);
  console.log(`Found ${all.length} auth(s) to validate\n`);

  if (all.length === 0) {
    console.log("Nothing to validate.");
    process.exit(0);
  }

  const results = [];
  let done = 0;
  const queue = [...all];

  async function worker() {
    while (queue.length > 0) {
      const auth = queue.shift();
      const label = `${auth.email || auth.file}`;
      let prefix = `[${++done}/${all.length}] ${label} ... `;

      try {
        const url = `${auth.baseURL.replace(/\/+$/, "")}/responses`;
        const resp = await makeRequest(url, auth.token, {
          model: "gpt-5.4",
          input: [
            {
              content: "hello",
              role: "user",
            },
          ],
          store: false,
          stream: true,
        });
        let result = classify(resp);

        // if auth invalid and refresh_token available, try refresh once
        if (
          !result.valid &&
          result.reason === "invalid_auth" &&
          auth.refreshToken &&
          !auth.refreshed
        ) {
          prefix += "(token rejected, refreshing...) ";
          const refreshResult = await tryRefresh(auth);
          if (refreshResult.ok) {
            const retry = await makeRequest(url, auth.token, {
              model: "gpt-5.4",
              input: [
                {
                  content: "hello",
                  role: "user",
                },
              ],
              stream: true,
              store: false,
            });
            result = classify(retry);
            results.push({
              ...auth,
              validation: result,
              rawBody: retry.rawBody,
            });
          } else {
            result = {
              valid: false,
              reason: "refresh_failed",
              errMsg: refreshResult.error,
              statusCode: 0,
            };
            results.push({
              ...auth,
              validation: result,
              rawBody: resp.rawBody,
            });
          }
        } else {
          results.push({ ...auth, validation: result, rawBody: resp.rawBody });
        }
        console.log(
          `${prefix}${result.valid ? `✓ ${result.reason}` : `✗ ${result.reason}`}`,
        );
      } catch (err) {
        console.log(`${prefix}✗ error: ${err.message}`);
        results.push({
          ...auth,
          validation: {
            valid: false,
            reason: "request_failed",
            errMsg: err.message,
            statusCode: 0,
          },
          rawBody: null,
        });
      }
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY, all.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  const valid = results.filter((r) => r.validation.valid);
  const invalid = results.filter((r) => !r.validation.valid);

  console.log("\n——— Summary ———");
  console.log(`Total:   ${results.length}`);
  console.log(`Valid:   ${valid.length}`);
  console.log(`Invalid: ${invalid.length}`);

  const buckets = {};
  for (const r of invalid) {
    const k = r.validation.reason;
    buckets[k] = buckets[k] || [];
    buckets[k].push(r);
  }
  for (const [reason, list] of Object.entries(buckets)) {
    console.log(`  Invalid (${reason}): ${list.length}`);
  }
  const vbuckets = {};
  for (const r of valid) {
    const k = r.validation.reason;
    vbuckets[k] = vbuckets[k] || [];
    vbuckets[k].push(r);
  }
  for (const [reason, list] of Object.entries(vbuckets)) {
    console.log(`  Valid (${reason}): ${list.length}`);
  }

  if (valid.length > 0) {
    const out = [];
    for (const auth of valid) {
      out.push(auth.data);
    }

    const absOut = path.resolve(outputFile);
    fs.writeFileSync(absOut, JSON.stringify(out, null, 2));
    console.log(`\nSaved ${Object.keys(out).length} valid auth(s) → ${absOut}`);
  } else {
    console.log("\nNo valid auths — nothing saved.");
  }

  const refreshed = results.filter((r) => r.refreshed);
  if (refreshed.length > 0) {
    console.log(
      `\nRefreshed tokens for ${refreshed.length} auth(s) and saved to disk.`,
    );
  }

  const requestErrors = results.filter(
    (r) => r.validation.reason === "request_error",
  );
  if (requestErrors.length > 0) {
    console.log("\n——— Request Errors (response bodies) ———");
    for (const r of requestErrors) {
      console.log(`  ${r.file}:`);
      if (r.rawBody) {
        try {
          const pretty = JSON.stringify(JSON.parse(r.rawBody), null, 2);
          console.log(`    ${pretty}`);
        } catch {
          console.log(`    ${r.rawBody}`);
        }
      } else {
        console.log("    (no response body)");
      }
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
