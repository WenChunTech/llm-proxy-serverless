import { ProviderType } from "../../../pkg/converter_wasm";
import { iflowPoller } from "../../config";
import { IFlowConfig } from "../../types/config";
import { type HeaderMap, mergeHeaders } from "../../utils/httpHeaders";
import { RequestLogger } from "../../utils/logger";
import type { Provider } from "../_base/interface";
import { getAccessToken } from "./auth";
import {
  convertIFlowResponseTo,
  convertIFlowStreamResponseTo,
  convertToIFlowRequestTo,
} from "./adapter";

export class IflowProvider implements Provider {
  model: string;

  constructor(model: string) {
    this.model = model;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToIFlowRequestTo(body, source);
  }

  getProviderType() {
    return ProviderType.Chat;
  }

  async fetchResponse(
    _isStreaming: boolean,
    reqData: any,
    config?: IFlowConfig,
    _project?: string,
    forwardedHeaders?: HeaderMap,
  ) {
    const iflowConfig = config || iflowPoller.getNext(this.model);
    const token = await getAccessToken(iflowConfig.auth);
    const endpoint = "https://apis.iflow.cn/v1/chat/completions";
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
    return convertIFlowResponseTo(c, response, target);
  }

  async convertStreamResponseTo(
    stream: any,
    response: any,
    target: any,
    requestLogger?: RequestLogger,
  ) {
    return convertIFlowStreamResponseTo(
      stream,
      response,
      target,
      requestLogger,
    );
  }
}
