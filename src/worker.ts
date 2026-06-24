import app from "./server";
import { ensureInitialized } from "./middleware/init";
import { refreshAllTokens } from "./services/refresh";
import { refreshLogLevelFromEnv } from "./utils/logger";
import { RuntimeBindings, setRuntimeEnv } from "./utils/runtime";

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

function bindRuntime(env: RuntimeBindings): void {
  setRuntimeEnv(env);
  refreshLogLevelFromEnv();
}

export default {
  fetch(request: Request, env: RuntimeBindings, ctx: ExecutionContextLike) {
    bindRuntime(env);
    return app.fetch(request, env, ctx as any);
  },

  async scheduled(
    _controller: unknown,
    env: RuntimeBindings,
    ctx: ExecutionContextLike,
  ) {
    bindRuntime(env);
    ctx.waitUntil((async () => {
      await ensureInitialized();
      await refreshAllTokens();
    })());
  },
};
