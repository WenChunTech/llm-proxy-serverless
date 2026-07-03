import { geminiPoller } from "../../config";
import { GeminiConfig } from "../../types/config";
import {
  convertGeminiResponseTo,
  convertGeminiStreamResponseTo,
  convertToGeminiRequestTo,
} from "./adapter";
import { TargetType } from "../../../pkg/converter_wasm";

export class GeminiProvider {
  geminiConfig: GeminiConfig;
  model: string;
  constructor(model: string) {
    this.model = model;
    this.geminiConfig = geminiPoller.getNext(model);
  }

  getProviderType() {
    return TargetType.Gemini;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToGeminiRequestTo(body, source);
  }

  async fetchResponse(is_streaming: boolean, reqData: any) {
    if (is_streaming) {
      const url =
        `${this.geminiConfig.base_url}/v1beta/models/${this.model}:streamGenerateContent?alt=sse`;
      const headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": this.geminiConfig.api_key,
        "Authorization": `Bearer ${this.geminiConfig.api_key}`,
      };
      const body = JSON.stringify(reqData);
      return fetch(url, {
        method: "POST",
        headers: headers,
        body: body,
      });
    } else {
      const url =
        `${this.geminiConfig.base_url}/v1beta/models/${this.model}:generateContent`;
      const headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": this.geminiConfig.api_key,
        "Authorization": `Bearer ${this.geminiConfig.api_key}`,
      };
      const body = JSON.stringify(reqData);
      return fetch(url, {
        method: "POST",
        headers: headers,
        body: body,
      });
    }
  }

  async convertResponseTo(c: any, response: Response, target: any) {
    if (target === TargetType.Gemini) {
      return response;
    }
    return convertGeminiResponseTo(c, response, target);
  }

  async convertStreamResponseTo(stream: any, response: Response, target: any) {
    if (target === TargetType.Gemini) {
      return response;
    }
    return convertGeminiStreamResponseTo(stream, response, target);
  }
}
