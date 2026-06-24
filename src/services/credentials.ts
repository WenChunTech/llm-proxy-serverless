import { getRedis } from "./redis";

const getCredentials = async <T>(key: string): Promise<T | null> => {
  return await getRedis().get<T>(key);
};

const updateCredentials = async (key: string, value: unknown) => {
  return await getRedis().set(key, value);
};

export { getCredentials, updateCredentials };
