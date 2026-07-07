import { ProviderType } from "../../../pkg/converter_wasm";
import { openAIPoller } from "../../config";
import { OpenAIChatConfig } from "../../types/config";
import { type HeaderMap, mergeHeaders } from "../../utils/httpHeaders";
import { RequestLogger } from "../../utils/logger";
import type { Provider } from "../_base/interface";
import {
  convertOpenAIResponseTo,
  convertOpenAIStreamResponseTo,
  convertToOpenAIRequestTo,
} from "./adapter";

export class OpenAIProvider implements Provider {
  model: string;

  constructor(model: string) {
    this.model = model;
  }

  getProviderType() {
    return ProviderType.Chat;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToOpenAIRequestTo(body, source);
  }

  async fetchResponse(
    _isStreaming: boolean,
    reqData: any,
    config?: OpenAIChatConfig,
    _project?: string,
    forwardedHeaders?: HeaderMap,
  ) {
    const openaiConfig = config || openAIPoller.getNext(this.model);
    const url = `${openaiConfig.base_url}/chat/completions`;
    const headers = mergeHeaders(forwardedHeaders, {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiConfig.api_key}`,
    });

    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(reqData),
    });
  }

  async convertResponseTo(c: any, response: Response, target: any) {
    return convertOpenAIResponseTo(c, response, target);
  }

  async convertStreamResponseTo(
    stream: any,
    response: Response,
    target: any,
    requestLogger?: RequestLogger,
  ) {
    return convertOpenAIStreamResponseTo(
      stream,
      response,
      target,
      requestLogger,
    );
  }
}
