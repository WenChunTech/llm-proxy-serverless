import app from './server.js';
import { initConfig } from './config.js';
import initWasm from 'converter-wasm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const wasmPath = path.join(__dirname, '..', 'node_modules', 'converter-wasm', 'converter_wasm_bg.wasm');
// const wasmBuffer = fs.readFileSync(wasmPath);
// await initWasm({ module_or_path: wasmBuffer });

await initWasm();
await initConfig();

export default {
  hostname: "0.0.0.0",
  port: 3000,
  fetch: app.fetch,
}
