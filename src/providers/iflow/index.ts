import { iflowPoller } from "../../config.ts";
import { IFlowConfig } from "../../types/config.ts";
import {
  convertIFlowResponseTo,
  convertIFlowStreamResponseTo,
  convertToIFlowRequestTo,
} from "./adapter.ts";
import { TargetType } from "../../../pkg/converter_wasm.js";
import { getAccessToken, iflowHeaderSign } from "./auth.ts";
import { RequestLogger } from "../../utils/logger.ts";

export class IflowProvider {
  model: string;
  constructor(model: string) {
    this.model = model;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToIFlowRequestTo(body, source);
  }

  getProviderType() {
    return TargetType.OpenAIChat;
  }

  async fetchResponse(
    _is_streaming: boolean,
    reqData: any,
    config?: IFlowConfig,
  ) {
    const iflowConfig = config || iflowPoller.getNext(this.model);
    const token = await getAccessToken(iflowConfig.auth);
    const endpoint = "https://apis.iflow.cn/v1/chat/completions";
    const headerSign = iflowHeaderSign(token);
    const headers: any = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "iFlow-Cli",
      ...headerSign,
    };

    return fetch(endpoint, {
      method: "POST",
      headers: headers,
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
