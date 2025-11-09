const kv = await Deno.openKv();

const getCredentials = async (key: string) => {
    const entry = await kv.get([key]);
    return entry.value;
};

const updateCredentials = async (key: string, value: any) => {
    await kv.set([key], value);
    return true;
};

export { getCredentials, updateCredentials };
