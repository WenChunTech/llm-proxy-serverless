import { Redis } from "@upstash/redis";
import { getEnv } from "../utils/runtime";

export interface RedisRuntimeConfig {
  url: string;
  token: string;
}

let redis: Redis | null = null;
let redisCacheKey = "";

export function getRedisRuntimeConfig(): RedisRuntimeConfig | null {
  const url = getEnv("KV_REST_API_URL");
  const token = getEnv("KV_REST_API_TOKEN");

  if (!url || !token) {
    return null;
  }

  return {
    url: url.trim(),
    token: token.trim(),
  };
}

export function hasRedisRuntimeConfig(): boolean {
  return getRedisRuntimeConfig() !== null;
}

export function getRedis(): Redis {
  const config = getRedisRuntimeConfig();
  if (!config) {
    throw new Error(
      "Shared Redis requires Vercel Redis env vars KV_REST_API_URL and KV_REST_API_TOKEN.",
    );
  }

  const cacheKey = `${config.url}\n${config.token}`;
  if (!redis || redisCacheKey !== cacheKey) {
    redis = new Redis({
      url: config.url,
      token: config.token,
    });
    redisCacheKey = cacheKey;
  }

  return redis;
}
