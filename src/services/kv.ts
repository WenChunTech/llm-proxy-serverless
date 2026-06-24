import { base64ToBytes, bytesToBase64 } from "../utils/runtime";
import { getRedis } from "./redis";

const KEY_SEPARATOR = "\u001f";
const UINT8_ARRAY_MARKER = "__llm_proxy_uint8_array__";

type KvKeyPart = string | number | boolean;
export type KvKey = KvKeyPart[];

interface KvEntry<T> {
  key: KvKey;
  value: T | null;
}

interface KvListOptions {
  prefix: KvKey;
}

interface KvListSelector {
  limit?: number;
  reverse?: boolean;
}

function encodeKey(key: KvKey): string {
  return key.map((part) => encodeURIComponent(String(part))).join(KEY_SEPARATOR);
}

function decodeKey(key: string): KvKey {
  return key.split(KEY_SEPARATOR).map((part) => decodeURIComponent(part));
}

function encodeValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return {
      [UINT8_ARRAY_MARKER]: true,
      data: bytesToBase64(value),
    };
  }
  return value;
}

function decodeValue<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>)[UINT8_ARRAY_MARKER] === true &&
    typeof (value as { data?: unknown }).data === "string"
  ) {
    return base64ToBytes((value as { data: string }).data) as T;
  }
  return value as T;
}

async function* list<T>(
  options: KvListOptions,
  selector: KvListSelector = {},
): AsyncGenerator<KvEntry<T>> {
  const prefix = encodeKey(options.prefix);
  const match = `${prefix}${KEY_SEPARATOR}*`;
  const keys: string[] = [];
  let cursor: string | number = 0;

  do {
    const [nextCursor, batch] = await getRedis().scan(cursor, {
      match,
      count: Math.max(selector.limit ?? 100, 100),
    }) as [string | number, string[]];
    cursor = nextCursor;
    keys.push(...batch);
  } while (String(cursor) !== "0");

  keys.sort();
  if (selector.reverse) keys.reverse();

  const limitedKeys = selector.limit ? keys.slice(0, selector.limit) : keys;
  for (const key of limitedKeys) {
    const value = await getRedis().get(key);
    yield {
      key: decodeKey(key),
      value: decodeValue<T>(value),
    };
  }
}

export const kv = {
  async get<T>(key: KvKey): Promise<KvEntry<T>> {
    const value = await getRedis().get(encodeKey(key));
    return {
      key,
      value: decodeValue<T>(value),
    };
  },

  async set(
    key: KvKey,
    value: unknown,
    options?: { expireIn?: number },
  ): Promise<true> {
    const encodedKey = encodeKey(key);
    const encodedValue = encodeValue(value);
    if (options?.expireIn) {
      await getRedis().set(encodedKey, encodedValue, { px: options.expireIn });
    } else {
      await getRedis().set(encodedKey, encodedValue);
    }
    return true;
  },

  async delete(key: KvKey): Promise<number> {
    return getRedis().del(encodeKey(key));
  },

  list,
};
