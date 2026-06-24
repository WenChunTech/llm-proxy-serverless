import { Context, Next } from "hono";
import { initConfig } from "../config";
import initWasm from "../../pkg/converter_wasm";
// @ts-ignore Wrangler imports .wasm files as compiled modules.
import converterWasm from "../../pkg/converter_wasm_bg.wasm";

let isInitialized = false;
let initPromise: Promise<void> | null = null;

type BunLike = {
  file(path: string | URL): {
    arrayBuffer(): Promise<ArrayBuffer>;
  };
};

function getBun(): BunLike | undefined {
  return (globalThis as typeof globalThis & { Bun?: BunLike }).Bun;
}

async function getWasmModuleOrBytes(): Promise<unknown> {
  if (converterWasm instanceof WebAssembly.Module) {
    return converterWasm;
  }

  if (converterWasm instanceof ArrayBuffer || ArrayBuffer.isView(converterWasm)) {
    return converterWasm;
  }

  const bun = getBun();
  if (bun && typeof converterWasm === "string") {
    return await bun.file(new URL(converterWasm, import.meta.url)).arrayBuffer();
  }

  return converterWasm;
}

export const ensureInitialized = async (): Promise<void> => {
  if (isInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.log("Initializing WASM and config...");
      await initWasm({ module_or_path: await getWasmModuleOrBytes() as any });
      console.log("Initializing config...");
      await initConfig();
      isInitialized = true;
      console.log("Initialization completed successfully");
    } catch (error) {
      console.error("Initialization failed:", error);
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
        error: "Service initialization failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  }

  c.set("initialized", true);
  await next();
};
