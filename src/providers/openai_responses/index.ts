import { openAIResponsesPoller } from "../../config.ts";
import { OpenAIResponsesConfig } from "../../types/config.ts";
import {
  convertOpenAIResponsesResponseTo,
  convertOpenAIResponsesStreamResponseTo,
  convertToOpenAIResponsesRequestTo,
} from "./adapter.ts";
import { TargetType } from "../../../pkg/converter_wasm.js";
import { RequestLogger } from "../../utils/logger.ts";
import type { Provider } from "../_base/interface.ts";

export class OpenAIResponsesProvider implements Provider {
  model: string;
  constructor(model: string) {
    this.model = model;
  }

  getProviderType() {
    return TargetType.OpenAIResponses;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToOpenAIResponsesRequestTo(body, source);
  }

  async fetchResponse(
    _is_streaming: boolean,
    reqData: any,
    config?: OpenAIResponsesConfig,
  ) {
    const openaiConfig = config || openAIResponsesPoller.getNext(this.model);
    const url = `${openaiConfig.base_url}/responses`;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiConfig.api_key}`,
    };

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
