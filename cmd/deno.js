const kv = await Deno.openKv("https://api.deno.com/databases/2c8bf7fc-f3bc-4f96-aba7-d4ae40307a17/connect");
const appConfig = 'APP_CONFIG';
const { key, value } = await kv.get([appConfig]);
console.log(JSON.stringify(value));

