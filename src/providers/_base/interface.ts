import { Context } from "hono";
import { TargetType } from "../../../pkg/converter_wasm.js";
import { RequestLogger } from "../../utils/logger.ts";

export interface Provider {
  model: string;
  getProviderType(): TargetType;
  convertRequestTo(body: Record<string, unknown>, source: TargetType): Promise<Record<string, unknown>>;
  fetchResponse(isStreaming: boolean, reqData: Record<string, unknown>, config?: unknown, project?: string): Promise<Response>;
  convertResponseTo(c: Context, response: Response, target: TargetType): Promise<Response>;
  convertStreamResponseTo(stream: any, response: Response, target: TargetType, requestLogger?: RequestLogger): Promise<void>;
}
