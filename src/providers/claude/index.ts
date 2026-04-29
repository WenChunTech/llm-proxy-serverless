import { claudePoller } from "../../config.ts";
import { ClaudeConfig } from "../../types/config.ts";
import {
  convertClaudeResponseTo,
  convertClaudeStreamResponseTo,
  convertToClaudeRequestTo,
} from "./adapter.ts";
import { TargetType } from "../../../pkg/converter_wasm.js";
import { RequestLogger } from "../../utils/logger.ts";

export class ClaudeProvider {
  model: string;
  constructor(model: string) {
    this.model = model;
  }

  getProviderType() {
    return TargetType.Claude;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToClaudeRequestTo(body, source);
  }

  async fetchResponse(
    is_streaming: boolean,
    reqData: any,
    config?: ClaudeConfig,
  ) {
    const claudeConfig = config || claudePoller.getNext(this.model);
    const url = `${claudeConfig.base_url}/v1/messages`;
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": claudeConfig.api_key,
      "Authorization": `Bearer ${claudeConfig.api_key}`,
      "anthropic-version": "2023-06-01",
    };
    const body = JSON.stringify({ ...reqData, stream: is_streaming });

    return fetch(url, {
      method: "POST",
      headers: headers,
      body: body,
    });
  }

  async convertResponseTo(c: any, response: Response, target: any) {
    return convertClaudeResponseTo(c, response, target);
  }

  async convertStreamResponseTo(
    stream: any,
    response: Response,
    target: any,
    requestLogger?: RequestLogger,
  ) {
    return convertClaudeStreamResponseTo(
      stream,
      response,
      target,
      requestLogger,
    );
  }
}
