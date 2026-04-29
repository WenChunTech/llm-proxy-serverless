import { geminiCliPoller } from "../../config.ts";
import { GeminiCliConfig } from "../../types/config.ts";
import {
  fetchGeminiCLiResponse,
  fetchGeminiCLiStreamResponse,
  getAccessToken,
} from "./auth.ts";
import {
  convertGeminiCliResponseTo,
  convertGeminiStreamResponseTo,
  convertToGeminiCliRequestTo,
} from "./adapter.ts";
import { TargetType } from "../../../pkg/converter_wasm.js";
import { RequestLogger } from "../../utils/logger.ts";

export class GeminiCliProvider {
  model: string;
  constructor(model: string) {
    this.model = model;
  }

  getProviderType() {
    return TargetType.GeminiCli;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToGeminiCliRequestTo(body, source);
  }

  async fetchResponse(
    is_streaming: boolean,
    reqData: any,
    config?: GeminiCliConfig,
    project?: string,
  ) {
    const geminiConfig = config || geminiCliPoller.getNext(this.model);
    const selectedProject =
      project || geminiConfig.projects[0];

    const token = await getAccessToken(geminiConfig.auth);
    reqData.project = selectedProject;
    if (is_streaming) {
      return fetchGeminiCLiStreamResponse({
        token,
        data: reqData,
      });
    } else {
      return fetchGeminiCLiResponse({ token, data: reqData });
    }
  }

  async convertResponseTo(c: any, response: Response, target: any) {
    return convertGeminiCliResponseTo(c, response, target);
  }

  async convertStreamResponseTo(
    stream: any,
    response: Response,
    target: any,
    requestLogger?: RequestLogger,
  ) {
    return convertGeminiStreamResponseTo(
      stream,
      response,
      target,
      requestLogger,
    );
  }
}
