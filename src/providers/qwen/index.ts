import { ProviderType } from "../../../pkg/converter_wasm";
import { qwenPoller } from "../../config";
import { QwenConfig } from "../../types/config";
import { type HeaderMap, mergeHeaders } from "../../utils/httpHeaders";
import { RequestLogger } from "../../utils/logger";
import type { Provider } from "../_base/interface";
import { getAccessToken } from "./auth";
import {
  convertQwenResponseTo,
  convertQwenStreamResponseTo,
  convertToQwenRequestTo,
} from "./adapter";

export class QwenProvider implements Provider {
  model: string;

  constructor(model: string) {
    this.model = model;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToQwenRequestTo(body, source);
  }

  getProviderType() {
    return ProviderType.Chat;
  }

  async fetchResponse(
    _isStreaming: boolean,
    reqData: any,
    config?: QwenConfig,
    _project?: string,
    forwardedHeaders?: HeaderMap,
  ) {
    const qwenConfig = config || qwenPoller.getNext(this.model);
    const token = await getAccessToken(qwenConfig.auth);
    const endpoint = `https://${qwenConfig.auth.resource_url}/v1/chat/completions`;
    const headers = mergeHeaders(forwardedHeaders, {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    });

    return fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(reqData),
    });
  }

  async convertResponseTo(c: any, response: any, target: any) {
    return convertQwenResponseTo(c, response, target);
  }

  async convertStreamResponseTo(
    stream: any,
    response: any,
    target: any,
    requestLogger?: RequestLogger,
  ) {
    return convertQwenStreamResponseTo(stream, response, target, requestLogger);
  }
}
