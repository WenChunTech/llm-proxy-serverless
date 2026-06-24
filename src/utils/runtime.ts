export interface RuntimeBindings {
  ASSETS?: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
  APP_CONFIG?: string;
  APP_CONFIG_JSON?: string;
  LOG_LEVEL?: string;
  KV_REST_API_TOKEN?: string;
  KV_REST_API_URL?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  [key: string]: unknown;
}

type ProcessLike = {
  env?: Record<string, string | undefined>;
  cwd?: () => string;
};

let runtimeEnv: RuntimeBindings = {};
let runtimeEnvBound = false;

function getProcess(): ProcessLike | undefined {
  return (globalThis as typeof globalThis & { process?: ProcessLike }).process;
}

export function setRuntimeEnv(env?: RuntimeBindings): void {
  runtimeEnv = env ?? {};
  runtimeEnvBound = Boolean(env);
}

export function getRuntimeBinding<T = unknown>(name: string): T | undefined {
  return runtimeEnv[name] as T | undefined;
}

export function getEnv(name: string): string | undefined {
  const runtimeValue = runtimeEnv[name];
  if (runtimeValue !== undefined && runtimeValue !== null) {
    return String(runtimeValue);
  }

  return getProcess()?.env?.[name];
}

export function isCloudflareRuntime(): boolean {
  const userAgent = (globalThis as typeof globalThis & {
    navigator?: { userAgent?: string };
  }).navigator?.userAgent ?? "";

  return userAgent.includes("Cloudflare-Workers") ||
    Boolean(runtimeEnv.ASSETS) ||
    (runtimeEnvBound && !getProcess()?.cwd);
}

export function isVercelRuntime(): boolean {
  return getEnv("VERCEL") === "1" || Boolean(getEnv("VERCEL_ENV"));
}

export function isDeploymentRuntime(): boolean {
  return isCloudflareRuntime() || isVercelRuntime();
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function stringToBase64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

export function timingSafeCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bytesA = encoder.encode(a);
  const bytesB = encoder.encode(b);
  const length = Math.max(bytesA.length, bytesB.length);
  let diff = bytesA.length ^ bytesB.length;

  for (let index = 0; index < length; index++) {
    diff |= (bytesA[index] ?? 0) ^ (bytesB[index] ?? 0);
  }

  return diff === 0;
}
