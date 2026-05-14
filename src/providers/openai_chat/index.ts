import { openAIPoller } from "../../config.ts";
import { OpenAIChatConfig } from "../../types/config.ts";
import {
  convertOpenAIResponseTo,
  convertOpenAIStreamResponseTo,
  convertToOpenAIRequestTo,
} from "./adapter.ts";
import { TargetType } from "../../../pkg/converter_wasm.js";
import { RequestLogger } from "../../utils/logger.ts";
import type { Provider } from "../_base/interface.ts";

export class OpenAIProvider implements Provider {
  model: string;
  constructor(model: string) {
    this.model = model;
  }

  getProviderType() {
    return TargetType.OpenAIChat;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToOpenAIRequestTo(body, source);
  }

  async fetchResponse(
    _is_streaming: boolean,
    reqData: any,
    config?: OpenAIChatConfig,
  ) {
    const openaiConfig = config || openAIPoller.getNext(this.model);
    const url = `${openaiConfig.base_url}/chat/completions`;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiConfig.api_key}`,
    };
    const body = JSON.stringify(reqData);

    return fetch(url, {
      method: "POST",
      headers: headers,
      body: body,
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
