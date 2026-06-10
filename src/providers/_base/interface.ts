import { Context } from "hono";
import { ProviderType } from "../../../pkg/converter_wasm.js";
import { RequestLogger } from "../../utils/logger.ts";

export interface Provider {
  model: string;
  getProviderType(): ProviderType;
  convertRequestTo(
    body: Record<string, unknown>,
    source: ProviderType,
  ): Promise<Record<string, unknown>>;
  fetchResponse(
    isStreaming: boolean,
    reqData: Record<string, unknown>,
    config?: unknown,
    project?: string,
  ): Promise<Response>;
  convertResponseTo(
    c: Context,
    response: Response,
    target: ProviderType,
  ): Promise<Response>;
  convertStreamResponseTo(
    stream: any,
    response: Response,
    target: ProviderType,
    requestLogger?: RequestLogger,
  ): Promise<void>;
}
