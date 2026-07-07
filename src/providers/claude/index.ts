import { ProviderType } from "../../../pkg/converter_wasm";
import { claudePoller } from "../../config";
import { ClaudeConfig } from "../../types/config";
import { type HeaderMap, mergeHeaders } from "../../utils/httpHeaders";
import { RequestLogger } from "../../utils/logger";
import type { Provider } from "../_base/interface";
import {
  convertClaudeResponseTo,
  convertClaudeStreamResponseTo,
  convertToClaudeRequestTo,
} from "./adapter";

export class ClaudeProvider implements Provider {
  model: string;

  constructor(model: string) {
    this.model = model;
  }

  getProviderType() {
    return ProviderType.Claude;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToClaudeRequestTo(body, source);
  }

  async fetchResponse(
    _isStreaming: boolean,
    reqData: any,
    config?: ClaudeConfig,
    _project?: string,
    forwardedHeaders?: HeaderMap,
  ) {
    const claudeConfig = config || claudePoller.getNext(this.model);
    const url = `${claudeConfig.base_url}/v1/messages`;
    const headers = mergeHeaders(forwardedHeaders, {
      "Content-Type": "application/json",
      "x-api-key": claudeConfig.api_key,
      "anthropic-version": "2023-06-01",
    });

    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(reqData),
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
