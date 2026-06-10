import { qwenPoller } from "../../config.ts";
import { QwenConfig } from "../../types/config.ts";
import { ProviderType } from "../../../pkg/converter_wasm.js";
import {
  convertQwenResponseTo,
  convertQwenStreamResponseTo,
  convertToQwenRequestTo,
} from "./adapter.ts";
import { getAccessToken } from "./auth.ts";
import { RequestLogger } from "../../utils/logger.ts";
import type { Provider } from "../_base/interface.ts";

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
    _is_streaming: boolean,
    reqData: any,
    config?: QwenConfig,
  ) {
    const qwenConfig = config || qwenPoller.getNext(this.model);
    const token = await getAccessToken(qwenConfig.auth);
    const endpoint =
      `https://${qwenConfig.auth.resource_url}/v1/chat/completions`;
    const headers: any = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    return fetch(endpoint, {
      method: "POST",
      headers: headers,
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
