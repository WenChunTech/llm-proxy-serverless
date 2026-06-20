import { kv } from "./kv.ts";

const ERROR_LOG_EXPIRY_MS = 0.5 * 60 * 60 * 1000;
const MAX_ERROR_LOG_VALUE_BYTES = 60 * 1024;
const MAX_LOG_BODY_BYTES = 24 * 1024;
const MAX_INLINE_REQUEST_BODY_BYTES = 24 * 1024;
const REQUEST_BODY_CHUNK_BYTES = 32 * 1024;
const MIN_LOG_BODY_BYTES = 4 * 1024;

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
  truncated?: boolean;
}

interface TruncatedBody {
  truncated: true;
  originalBytes: number;
  previewBytes: number;
  preview: string;
}

interface BodyReference {
  ref: true;
  key: string;
  chunks: number;
  bytes: number;
  encoding: "json" | "text";
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

function getUtf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function stringifyForLog(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseBodyReferenceValue(
  value: string,
  encoding: BodyReference["encoding"],
): unknown {
  if (encoding === "text") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function truncateByBytes(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(value);
  if (bytes.length <= maxBytes) return value;
  return decoder.decode(bytes.slice(0, maxBytes));
}

function compactBody(value: unknown, maxBytes = MAX_LOG_BODY_BYTES): unknown {
  if (value === undefined || value === null) return value;

  const serialized = stringifyForLog(value);
  const originalBytes = getUtf8Bytes(serialized);
  if (originalBytes <= maxBytes) return value;

  return {
    truncated: true,
    originalBytes,
    previewBytes: maxBytes,
    preview: truncateByBytes(serialized, maxBytes),
  } satisfies TruncatedBody;
}

function splitBytes(bytes: Uint8Array, maxBytes: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += maxBytes) {
    chunks.push(bytes.slice(offset, offset + maxBytes));
  }
  return chunks;
}

function isBodyReference(value: unknown): value is BodyReference {
  return Boolean(
    value &&
      typeof value === "object" &&
      "ref" in value &&
      (value as { ref?: unknown }).ref === true &&
      typeof (value as { key?: unknown }).key === "string",
  );
}

async function storeRequestBodyReference(
  logId: string,
  body: unknown,
): Promise<unknown> {
  if (body === undefined || body === null) return body;

  const serialized = stringifyForLog(body);
  const encoded = new TextEncoder().encode(serialized);
  if (encoded.length <= MAX_INLINE_REQUEST_BODY_BYTES) return body;

  const key = `${logId}_request_body`;
  const chunks = splitBytes(encoded, REQUEST_BODY_CHUNK_BYTES);

  await Promise.all(chunks.map((chunk, index) => {
    return kv.set(["error_log_bodies", key, index], chunk, {
      expireIn: ERROR_LOG_EXPIRY_MS,
    });
  }));

  return {
    ref: true,
    key,
    chunks: chunks.length,
    bytes: encoded.length,
    encoding: typeof body === "string" ? "text" : "json",
  } satisfies BodyReference;
}

async function resolveRequestBodyReference(body: unknown): Promise<unknown> {
  if (!isBodyReference(body)) return body;

  const chunks: Uint8Array[] = [];
  for (let index = 0; index < body.chunks; index++) {
    const entry = await kv.get<Uint8Array>([
      "error_log_bodies",
      body.key,
      index,
    ]);
    if (!(entry.value instanceof Uint8Array)) return body;
    chunks.push(entry.value);
  }

  const bytes = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return parseBodyReferenceValue(
    new TextDecoder().decode(bytes),
    body.encoding,
  );
}

async function compactErrorLogEntry(
  entry: ErrorLogEntry,
): Promise<ErrorLogEntry> {
  const requestBody = entry.request
    ? await storeRequestBodyReference(entry.id, entry.request.body)
    : undefined;
  const compacted: ErrorLogEntry = {
    ...entry,
    request: entry.request
      ? { ...entry.request, body: requestBody }
      : undefined,
    response: entry.response
      ? { ...entry.response, body: compactBody(entry.response.body) }
      : undefined,
  };

  if (getUtf8Bytes(JSON.stringify(compacted)) <= MAX_ERROR_LOG_VALUE_BYTES) {
    return compacted;
  }

  return {
    ...compacted,
    truncated: true,
    error: {
      message: truncateByBytes(compacted.error.message, 2048),
      stack: compacted.error.stack
        ? truncateByBytes(compacted.error.stack, 4096)
        : undefined,
    },
    request: compacted.request
      ? { ...compacted.request, body: compacted.request.body }
      : undefined,
    response: compacted.response
      ? {
        ...compacted.response,
        body: compactBody(compacted.response.body, MIN_LOG_BODY_BYTES),
      }
      : undefined,
  };
}

export async function saveErrorLog(
  entry: Omit<ErrorLogEntry, "id" | "timestamp">,
): Promise<string> {
  const id = generateId();
  const timestamp = new Date().toISOString();
  const fullEntry: ErrorLogEntry = { ...entry, id, timestamp };
  await kv.set(
    ["error_logs", timestamp, id],
    await compactErrorLogEntry(fullEntry),
    {
      expireIn: ERROR_LOG_EXPIRY_MS,
    },
  );
  return id;
}

async function resolveErrorLogEntry(
  entry: ErrorLogEntry,
): Promise<ErrorLogEntry> {
  if (!entry.request) return entry;

  return {
    ...entry,
    request: {
      ...entry.request,
      body: await resolveRequestBodyReference(entry.request.body),
    },
  };
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
    entries.push(await resolveErrorLogEntry(entry.value));
    if (entries.length >= limit) break;
  }
  return entries;
}

export async function clearErrorLogs(): Promise<void> {
  const iter = kv.list({ prefix: ["error_logs"] });
  for await (const entry of iter) {
    await kv.delete(entry.key);
  }

  const bodyIter = kv.list({ prefix: ["error_log_bodies"] });
  for await (const entry of bodyIter) {
    await kv.delete(entry.key);
  }
}
