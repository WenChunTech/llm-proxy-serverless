import { ProviderType } from "../../../pkg/converter_wasm";
import { grokPoller } from "../../config";
import { GrokAuth, GrokConfig } from "../../types/config";
import {
  convertGrokResponseTo,
  convertGrokStreamResponseTo,
  convertToGrokRequestTo,
} from "./adapter";
import { getAccessToken } from "./auth";
import { RequestLogger } from "../../utils/logger";
import { type HeaderMap, mergeHeaders } from "../../utils/httpHeaders";
import type { Provider } from "../_base/interface";

const DEFAULT_GROK_BASE_URL = "https://api.x.ai/v1";

function normalizeAuth(auth: GrokAuth | GrokAuth[]): GrokAuth {
  if (Array.isArray(auth)) {
    const enabled = auth.filter((a) => !a.disabled);
    if (enabled.length === 0) {
      throw new Error("No enabled Grok accounts available");
    }
    return enabled[0];
  }
  if (auth.disabled) {
    throw new Error("No enabled Grok accounts available");
  }
  return auth;
}

export class GrokProvider implements Provider {
  model: string;

  constructor(model: string) {
    this.model = model;
  }

  getProviderType() {
    return ProviderType.Responses;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToGrokRequestTo(body, source);
  }

  async fetchResponse(
    is_streaming: boolean,
    reqData: any,
    config?: GrokConfig,
    _project?: string,
    forwardedHeaders?: HeaderMap,
  ) {
    const grokConfig = config || grokPoller.getNext(this.model);
    const auth = normalizeAuth(grokConfig.auth);
    const token = await getAccessToken(auth);

    const baseUrl = auth.base_url || grokConfig.base_url || DEFAULT_GROK_BASE_URL;
    const url = `${baseUrl.replace(/\/+$/, "")}/responses`;

    const body: Record<string, any> = {
      ...reqData,
      model: this.model,
      stream: is_streaming,
    };

    const headers: Record<string, string> = mergeHeaders(forwardedHeaders, {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    if (is_streaming) {
      headers["accept"] = "text/event-stream";
    } else {
      headers["accept"] = "application/json";
    }

    if (auth.headers) {
      for (const [name, value] of Object.entries(auth.headers)) {
        const trimmed = value?.trim();
        if (trimmed) {
          headers[name] = trimmed;
        }
      }
    }

    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  async convertResponseTo(c: any, response: Response, target: any) {
    return convertGrokResponseTo(c, response, target);
  }

  async convertStreamResponseTo(
    stream: any,
    response: Response,
    target: any,
    requestLogger?: RequestLogger,
  ) {
    return convertGrokStreamResponseTo(
      stream,
      response,
      target,
      requestLogger,
    );
  }
}