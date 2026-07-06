import { codexPoller } from "../../config";
import { CodexAuth, CodexConfig } from "../../types/config";
import {
  convertCodexResponseTo,
  convertCodexStreamResponseTo,
  convertToCodexRequestTo,
} from "./adapter";
import { ProviderType } from "../../../pkg/converter_wasm";
import { RequestLogger } from "../../utils/logger";
import { type HeaderMap, mergeHeaders } from "../../utils/httpHeaders";
import type { Provider } from "../_base/interface";

const CODEX_USER_AGENT =
  "codex-tui/0.135.0 (Mac OS 26.5.0; arm64) iTerm.app/3.6.10 (codex-tui; 0.135.0)";
const DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";

function normalizeAuth(auth: CodexAuth): CodexAuth {
  if (!auth.expiry_date && auth.expired) {
    (auth as any).expiry_date = new Date(auth.expired).getTime();
  }
  return auth;
}

export class CodexProvider implements Provider {
  model: string;
  private static subAccountIndex = 0;

  constructor(model: string) {
    this.model = model;
  }

  private resolveAuth(auth: CodexAuth | CodexAuth[]): CodexAuth {
    if (Array.isArray(auth)) {
      const accounts = auth.filter((a) => !a.disabled);
      if (accounts.length === 0) {
        throw new Error("No enabled Codex accounts available");
      }
      const idx = CodexProvider.subAccountIndex++ % accounts.length;
      return normalizeAuth(accounts[idx]);
    }
    if (auth.disabled) {
      throw new Error("No enabled Codex accounts available");
    }
    return normalizeAuth(auth);
  }

  getProviderType() {
    return ProviderType.Responses;
  }

  async convertRequestTo(body: any, source: any) {
    const req = convertToCodexRequestTo(body, source);
    delete req.max_output_tokens;
    delete req.temperature;
    req.store = false;
    return req;
  }

  async fetchResponse(
    is_streaming: boolean,
    reqData: any,
    config?: CodexConfig,
    _project?: string,
    forwardedHeaders?: HeaderMap,
  ) {
    const codexConfig = config || codexPoller.getNext(this.model);

    const auth = this.resolveAuth(codexConfig.auth);

    const baseUrl = auth.base_url || codexConfig.base_url ||
      DEFAULT_CODEX_BASE_URL;
    const url = `${baseUrl.replace(/\/+$/, "")}/responses`;
    const body: Record<string, any> = {
      ...reqData,
      model: this.model,
      stream: is_streaming,
    };

    delete body.previous_response_id;
    delete body.prompt_cache_retention;
    delete body.safety_identifier;
    delete body.stream_options;

    if (body.instructions === undefined || body.instructions === null) {
      body.instructions = "";
    }

    const headers: Record<string, string> = mergeHeaders(forwardedHeaders, {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${auth.access_token}`,
      "User-Agent": CODEX_USER_AGENT,
      "Originator": "codex-tui",
      "Connection": "Keep-Alive",
    });

    if (is_streaming) {
      headers["accept"] = "text/event-stream";
    } else {
      headers["accept"] = "application/json";
    }

    if (auth.account_id) {
      headers["chatgpt-account-id"] = auth.account_id;
    }

    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  async convertResponseTo(c: any, response: Response, target: any) {
    return convertCodexResponseTo(c, response, target);
  }

  async convertStreamResponseTo(
    stream: any,
    response: Response,
    target: any,
    requestLogger?: RequestLogger,
  ) {
    return convertCodexStreamResponseTo(
      stream,
      response,
      target,
      requestLogger,
    );
  }
}
