import kv from "@vercel/kv";

const getCredentials = async (env, key) => {
    if (env.Platform === "Cloudflare") {
        return await env.KV.get(key);
    } else if (env.Platform === "Vercel") {
        return await kv.get(key);
    } else if (env.Platform === "Deno") {
        const kv = await Deno.openKv();
        const entry = await kv.get([key]);
        return entry.value;
    }
};

const updateCredentials = async (env, key, value) => {
    if (env.Platform === "Cloudflare") {
        return await env.KV.put(key, value);
    } else if (env.Platform === "Vercel") {
        return await kv.set(key, value);
    } else if (env.Platform === "Deno") {
        const kv = await Deno.openKv();
        await kv.set([key], value);
    }
};

const listKeys = async (env) => {
    if (env.Platform === "Cloudflare") {
        return await env.KV.list();
    } else if (env.Platform === "Vercel") {
        return await kv.keys();
    } else if (env.Platform === "Deno") {
        const kv = await Deno.openKv();
        const entries = await kv.list();
        return entries.map((entry) => entry.key[0]);
    }
}

export { getCredentials, updateCredentials, listKeys };