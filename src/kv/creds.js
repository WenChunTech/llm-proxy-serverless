import { Redis } from '@upstash/redis'

const getCredentials = async (env, key) => {
    const redis = Redis.fromEnv();
    return await redis.get(key);
};

const updateCredentials = async (env, key, value) => {
    const redis = Redis.fromEnv();
    return await redis.set(key, value);
};

export { getCredentials, updateCredentials };