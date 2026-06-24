import { openAIResponsesPoller } from "../../config";
import { OpenAIResponsesConfig } from "../../types/config";
import {
  convertOpenAIResponsesResponseTo,
  convertOpenAIResponsesStreamResponseTo,
  convertToOpenAIResponsesRequestTo,
} from "./adapter";
import { ProviderType } from "../../../pkg/converter_wasm";
import { RequestLogger } from "../../utils/logger";
import { type HeaderMap, mergeHeaders } from "../../utils/httpHeaders";
import type { Provider } from "../_base/interface";

export class OpenAIResponsesProvider implements Provider {
  model: string;
  constructor(model: string) {
    this.model = model;
  }

  getProviderType() {
    return ProviderType.Responses;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToOpenAIResponsesRequestTo(body, source);
  }

  async fetchResponse(
    _is_streaming: boolean,
    reqData: any,
    config?: OpenAIResponsesConfig,
    _project?: string,
    forwardedHeaders?: HeaderMap,
  ) {
    const openaiConfig = config || openAIResponsesPoller.getNext(this.model);
    const url = `${openaiConfig.base_url}/responses`;
    const headers = mergeHeaders(forwardedHeaders, {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiConfig.api_key}`,
    });

    return fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(reqData),
    });
  }

  async convertResponseTo(c: any, response: Response, target: any) {
    return convertOpenAIResponsesResponseTo(c, response, target);
  }

  async convertStreamResponseTo(
    stream: any,
    response: Response,
    target: any,
    requestLogger?: RequestLogger,
  ) {
    return convertOpenAIResponsesStreamResponseTo(
      stream,
      response,
      target,
      requestLogger,
    );
  }
}
