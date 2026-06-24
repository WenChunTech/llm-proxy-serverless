import { type HeaderMap, mergeHeaders } from "../../utils/httpHeaders";

const GEMINI_CLI_VERSION = "0.22.0";

function buildGeminiCliUserAgent(model?: string) {
  const runtime = (globalThis as {
    Deno?: { build?: { os?: string; arch?: string } };
  }).Deno?.build;
  const osMap: Record<string, string> = { windows: "win32" };
  const archMap: Record<string, string> = { aarch64: "arm64", x86_64: "x64" };
  const os = osMap[runtime?.os || ""] || runtime?.os || "unknown";
  const arch = archMap[runtime?.arch || ""] || runtime?.arch || "unknown";
  return `GeminiCLI/${GEMINI_CLI_VERSION}/${
    model || "unknown"
  } (${os}; ${arch})`;
}

export function buildGeminiCliHeaders(
  token: string,
  model?: string,
  forwardedHeaders?: HeaderMap,
) {
  return mergeHeaders(forwardedHeaders, {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    "User-Agent": buildGeminiCliUserAgent(model),
  });
}
