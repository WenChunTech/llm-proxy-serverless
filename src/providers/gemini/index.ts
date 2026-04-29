import { geminiPoller } from "../../config.ts";
import { GeminiConfig } from "../../types/config.ts";
import {
  convertGeminiResponseTo,
  convertGeminiStreamResponseTo,
  convertToGeminiRequestTo,
} from "./adapter.ts";
import { TargetType } from "../../../pkg/converter_wasm.js";
import { RequestLogger } from "../../utils/logger.ts";

export class GeminiProvider {
  model: string;
  constructor(model: string) {
    this.model = model;
  }

  getProviderType() {
    return TargetType.Gemini;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToGeminiRequestTo(body, source);
  }

  async fetchResponse(
    is_streaming: boolean,
    reqData: any,
    config?: GeminiConfig,
  ) {
    const geminiConfig = config || geminiPoller.getNext(this.model);
    if (is_streaming) {
      const url =
        `${geminiConfig.base_url}/v1beta/models/${this.model}:streamGenerateContent?alt=sse`;
      const headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiConfig.api_key,
        "Authorization": `Bearer ${geminiConfig.api_key}`,
      };

      return fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(reqData),
      });
    } else {
      const url =
        `${geminiConfig.base_url}/v1beta/models/${this.model}:generateContent`;
      const headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiConfig.api_key,
        "Authorization": `Bearer ${geminiConfig.api_key}`,
      };

      return fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(reqData),
      });
    }
  }

  async convertResponseTo(c: any, response: Response, target: any) {
    if (target === TargetType.Gemini) {
      return response;
    }
    return convertGeminiResponseTo(c, response, target);
  }

  async convertStreamResponseTo(
    stream: any,
    response: Response,
    target: any,
    requestLogger?: RequestLogger,
  ) {
    if (target === TargetType.Gemini) {
      return response;
    }
    return convertGeminiStreamResponseTo(
      stream,
      response,
      target,
      requestLogger,
    );
  }
}
