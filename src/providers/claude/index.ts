import { fetchWithRetry } from "../../utils/fetch.ts";
import { claudePoller } from "../../config.ts";
import {
  convertClaudeResponseTo,
  convertClaudeStreamResponseTo,
  convertToClaudeRequestTo,
} from "./adapter.ts";
import { TargetType } from "../../../pkg/converter_wasm.js";

export class ClaudeProvider {
  apiKey: string;
  baseUrl: string;

  constructor(model: string) {
    const claudeConfig = claudePoller.getNext(model);
    this.apiKey = claudeConfig.api_key;
    this.baseUrl = claudeConfig.base_url;
  }

  getProviderType() {
    return TargetType.Claude;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToClaudeRequestTo(body, source);
  }

  async fetchResponse(is_streaming: boolean, reqData: any) {
    const url = `${this.baseUrl}/v1/messages`;
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
    };
    const body = JSON.stringify({ ...reqData, stream: is_streaming });

    const fetcher = async () =>
      fetch(url, {
        method: "POST",
        headers: headers,
        body: body,
      });

    return fetchWithRetry(fetcher, {});
  }

  async convertResponseTo(c: any, response: Response, target: any) {
    return convertClaudeResponseTo(c, response, target);
  }

  async convertStreamResponseTo(stream: any, response: Response, target: any) {
    return convertClaudeStreamResponseTo(stream, response, target);
  }
}
