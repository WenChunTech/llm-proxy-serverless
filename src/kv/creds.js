// import kv from "@vercel/kv";
import { Redis } from '@upstash/redis'

const getCredentials = async (env, key) => {
    console.log("get:", env.Platform);
    if (env.Platform === "Cloudflare") {
        return await env.KV.get(key);
    } else if (env.Platform === "Vercel") {
        const redis = Redis.fromEnv();
        return await redis.get(key);
    } else if (env.Platform === "Deno") {
        const kv = await Deno.openKv();
        const entry = await kv.get([key]);
        return entry.value;
    }
};

const updateCredentials = async (env, key, value) => {
    console.log("update:", env);
    if (env.Platform === "Cloudflare") {
        return await env.KV.put(key, value);
    } else if (env.Platform === "Vercel") {
        const redis = Redis.fromEnv();
        return await redis.set(key, value);
    } else if (env.Platform === "Deno") {
        const kv = await Deno.openKv();
        await kv.set([key], value);
    }
};

export { getCredentials, updateCredentials };