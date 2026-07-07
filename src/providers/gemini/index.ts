import { geminiPoller } from "../../config";
import { GeminiConfig } from "../../types/config";
import { type HeaderMap, mergeHeaders } from "../../utils/httpHeaders";
import {
  convertGeminiResponseTo,
  convertGeminiStreamResponseTo,
  convertToGeminiRequestTo,
} from "./adapter";
import { ProviderType } from "../../../pkg/converter_wasm";
import { RequestLogger } from "../../utils/logger";
import type { Provider } from "../_base/interface";

export class GeminiProvider implements Provider {
  model: string;

  constructor(model: string) {
    this.model = model;
  }

  getProviderType() {
    return ProviderType.Gemini;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToGeminiRequestTo(body, source);
  }

  async fetchResponse(
    isStreaming: boolean,
    reqData: any,
    config?: GeminiConfig,
    _project?: string,
    forwardedHeaders?: HeaderMap,
  ) {
    const geminiConfig = config || geminiPoller.getNext(this.model);
    const action = isStreaming
      ? "streamGenerateContent?alt=sse"
      : "generateContent";
    const url =
      `${geminiConfig.base_url}/v1beta/models/${this.model}:${action}`;
    const headers = mergeHeaders(forwardedHeaders, {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiConfig.api_key,
      "Authorization": `Bearer ${geminiConfig.api_key}`,
    });

    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(reqData),
    });
  }

  async convertResponseTo(c: any, response: Response, target: any) {
    if (target === ProviderType.Gemini) {
      return response;
    }
    return convertGeminiResponseTo(c, response, target);
  }

  async convertStreamResponseTo(stream: any, response: Response, target: any, requestLogger?: RequestLogger) {
    if (target === ProviderType.Gemini) {
      return;
    }
    return convertGeminiStreamResponseTo(stream, response, target, requestLogger);
  }
}
