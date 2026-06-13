const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const REQUEST_HEADERS_BLOCKLIST = new Set([
  ...HOP_BY_HOP_HEADERS,
  "authorization",
  "content-length",
  "cookie",
  "host",
  "proxy-connection",
  "x-api-key",
  "x-goog-api-key",
]);

const RESPONSE_HEADERS_BLOCKLIST = new Set([
  ...HOP_BY_HOP_HEADERS,
  "content-encoding",
  "content-length",
]);

export type HeaderMap = Record<string, string>;

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase();
}

function isNonEmptyHeaderValue(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function getForwardableRequestHeaders(headers?: Headers): HeaderMap {
  const result: HeaderMap = {};
  if (!headers) return result;

  headers.forEach((value, name) => {
    const normalizedName = normalizeHeaderName(name);
    if (!normalizedName || REQUEST_HEADERS_BLOCKLIST.has(normalizedName)) {
      return;
    }
    result[normalizedName] = value;
  });

  return result;
}

export function mergeHeaders(
  ...headersList: Array<HeaderMap | undefined>
): HeaderMap {
  const merged = new Headers();

  for (const headers of headersList) {
    if (!headers) continue;

    for (const [name, value] of Object.entries(headers)) {
      if (!isNonEmptyHeaderValue(value)) continue;
      merged.set(name, value);
    }
  }

  return Object.fromEntries(merged.entries());
}

export function getProxyResponseHeaders(headers: Headers): Headers {
  const result = new Headers();

  headers.forEach((value, name) => {
    const normalizedName = normalizeHeaderName(name);
    if (!normalizedName || RESPONSE_HEADERS_BLOCKLIST.has(normalizedName)) {
      return;
    }
    result.set(name, value);
  });

  return result;
}

export function withUpstreamResponseHeaders(
  convertedResponse: Response,
  upstreamResponse: Response,
): Response {
  const headers = getProxyResponseHeaders(upstreamResponse.headers);

  convertedResponse.headers.forEach((value, name) => {
    if (!RESPONSE_HEADERS_BLOCKLIST.has(normalizeHeaderName(name))) {
      headers.set(name, value);
    }
  });

  return new Response(convertedResponse.body, {
    status: convertedResponse.status,
    statusText: convertedResponse.statusText,
    headers,
  });
}
