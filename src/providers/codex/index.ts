import { codexPoller } from "../../config.ts";
import { CodexConfig } from "../../types/config.ts";
import { isTokenExpired, refreshCodexToken } from "./auth.ts";
import {
  convertCodexResponseTo,
  convertCodexStreamResponseTo,
  convertToCodexRequestTo,
} from "./adapter.ts";
import { TargetType } from "../../../pkg/converter_wasm.js";
import { RequestLogger } from "../../utils/logger.ts";

const CODEX_USER_AGENT =
  "codex-tui/0.118.0 (Mac OS 26.3.1; arm64) iTerm.app/3.6.9 (codex-tui; 0.118.0)";

export class CodexProvider {
  model: string;
  constructor(model: string) {
    this.model = model;
  }

  getProviderType() {
    return TargetType.OpenAIResponses;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToCodexRequestTo(body, source);
  }

  async fetchResponse(
    is_streaming: boolean,
    reqData: any,
    config?: CodexConfig,
  ) {
    const codexConfig = config || codexPoller.getNext(this.model);

    // Ensure we have a valid access token
    let auth = codexConfig.auth;
    if (isTokenExpired(auth)) {
      console.log("[Codex] Access token expired, refreshing...");
      auth = await refreshCodexToken(auth);
      codexConfig.auth = auth;
    }

    const url = "https://chatgpt.com/backend-api/codex/responses";
    // Build request body in Responses API format
    const body: Record<string, any> = {
      ...reqData,
      model: this.model,
      stream: is_streaming,
    };

    // Remove fields that Codex doesn't accept
    delete body.previous_response_id;
    delete body.prompt_cache_retention;
    delete body.safety_identifier;
    delete body.stream_options;

    // Ensure instructions field exists (Codex requires it)
    if (body.instructions === undefined || body.instructions === null) {
      body.instructions = "";
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${auth.access_token}`,
      "User-Agent": CODEX_USER_AGENT,
      "Originator": "codex-tui",
      "Connection": "Keep-Alive",
    };

    if (is_streaming) {
      headers["Accept"] = "text/event-stream";
    } else {
      headers["Accept"] = "application/json";
    }

    // Add ChatGPT account ID header
    if (auth.account_id) {
      headers["Chatgpt-Account-Id"] = auth.account_id;
    }

    // Add a session ID
    // headers["Session_id"] = crypto.randomUUID();

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
