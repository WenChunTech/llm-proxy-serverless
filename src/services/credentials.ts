import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv();

const getCredentials = async (key: string) => {
    return await redis.get(key);
};

const updateCredentials = async (key: string, value: any) => {
    return await redis.set(key, value);
};

export { getCredentials, updateCredentials };
