import { kv } from "./kv.ts";

const ERROR_LOG_EXPIRY_MS = 4 * 60 * 60 * 1000;

export type ErrorLogType =
  | "request_conversion"
  | "response_conversion"
  | "response_500";

export interface ErrorLogEntry {
  id: string;
  type: ErrorLogType;
  timestamp: string;
  error: {
    message: string;
    stack?: string;
  };
  request?: {
    method?: string;
    path?: string;
    body?: unknown;
    sourceType?: string;
    targetType?: string;
    model?: string;
    requestId?: string;
    provider?: string;
    baseUrl?: string;
    attempt?: number;
    providerSlot?: string;
    project?: string;
    projectSlot?: string;
  };
  response?: {
    status?: number;
    body?: unknown;
  };
}

function generateId(): string {
  const now = new Date();
  const ts = now
    .toISOString()
    .replace(/[-:T]/g, "")
    .replace(/\.\d{3}Z$/, "");
  const random = Math.random().toString(36).substring(2, 8);
  return `${ts}_${random}`;
}

export async function saveErrorLog(
  entry: Omit<ErrorLogEntry, "id" | "timestamp">,
): Promise<string> {
  const id = generateId();
  const timestamp = new Date().toISOString();
  const fullEntry: ErrorLogEntry = { ...entry, id, timestamp };
  await kv.set(["error_logs", timestamp, id], fullEntry, {
    expireIn: ERROR_LOG_EXPIRY_MS,
  });
  return id;
}

export async function getErrorLogs(options?: {
  type?: ErrorLogType;
  limit?: number;
}): Promise<ErrorLogEntry[]> {
  const limit = options?.limit ?? 10;
  const entries: ErrorLogEntry[] = [];
  const iter = kv.list<ErrorLogEntry>({ prefix: ["error_logs"] }, {
    limit: limit,
    reverse: true,
  });
  for await (const entry of iter) {
    if (options?.type && entry.value.type !== options.type) continue;
    entries.push(entry.value);
    if (entries.length >= limit) break;
  }
  return entries;
}

export async function clearErrorLogs(): Promise<void> {
  const iter = kv.list({ prefix: ["error_logs"] });
  for await (const entry of iter) {
    await kv.delete(entry.key);
  }
}
