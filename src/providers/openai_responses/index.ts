import { fetchWithRetry } from "../../utils/fetch.ts";
import { openAIResponsesPoller } from "../../config.ts";
import {
  convertOpenAIResponsesResponseTo,
  convertOpenAIResponsesStreamResponseTo,
  convertToOpenAIResponsesRequestTo,
} from "./adapter.ts";
import { TargetType } from "../../../pkg/converter_wasm.js";
import { RequestLogger } from "../../utils/logger.ts";

export class OpenAIResponsesProvider {
  apiKey: string;
  baseUrl: string;

  constructor(model: string) {
    const config = openAIResponsesPoller.getNext(model);
    this.apiKey = config.api_key;
    this.baseUrl = config.base_url;
  }

  getProviderType() {
    return TargetType.OpenAIResponses;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToOpenAIResponsesRequestTo(body, source);
  }

  async fetchResponse(_is_streaming: boolean, reqData: any) {
    const url = `${this.baseUrl}/responses`;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
    };
    const body = JSON.stringify(reqData);
    const fetcher = async () =>
      fetch(url, {
        method: "POST",
        headers: headers,
        body: body,
      });

    return fetchWithRetry(fetcher, {});
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
