import { Context, Next } from 'hono';
import { initConfig } from '../config.ts';
import initWasm from '../../pkg/converter_wasm.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';


let isInitialized = false;
let initPromise: Promise<void> | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wasmPath = path.join(__dirname, '../..', 'pkg', 'converter_wasm_bg.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);

const ensureInitialized = async (): Promise<void> => {
  if (isInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.log('Initializing WASM and config...');
      await initWasm({ module_or_path: wasmBuffer });
      console.log('Initializing config...');
      await initConfig();
      isInitialized = true;
      console.log('Initialization completed successfully');
    } catch (error) {
      console.error('Initialization failed:', error);
      initPromise = null; // 重置，允许重试
      throw error;
    }
  })();

  return initPromise;
};

// 初始化中间件
export const initMiddleware = async (c: Context, next: Next) => {
  // 将初始化状态注入到上下文中
  if (!isInitialized) {
    try {
      await ensureInitialized();
    } catch (error) {
      return c.json({
        error: 'Service initialization failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }

  c.set('initialized', true);
  await next();
};