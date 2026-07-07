import { ProviderType } from "../../../pkg/converter_wasm";
import { geminiCliPoller } from "../../config";
import { GeminiCliConfig } from "../../types/config";
import { RequestLogger } from "../../utils/logger";
import type { Provider } from "../_base/interface";
import {
  convertGeminiCliResponseTo,
  convertGeminiStreamResponseTo,
  convertToGeminiCliRequestTo,
} from "./adapter";
import {
  fetchGeminiCLiResponse,
  fetchGeminiCLiStreamResponse,
  getAccessToken,
} from "./auth";

export class GeminiCliProvider implements Provider {
  model: string;

  constructor(model: string) {
    this.model = model;
  }

  getProviderType() {
    return ProviderType.GeminiCli;
  }

  async convertRequestTo(body: any, source: any) {
    return convertToGeminiCliRequestTo(body, source);
  }

  async fetchResponse(
    isStreaming: boolean,
    reqData: any,
    config?: GeminiCliConfig,
    project?: string,
  ) {
    const geminiConfig = config || geminiCliPoller.getNext(this.model);
    const selectedProject = project || geminiConfig.projects[0];
    if (!selectedProject) {
      throw new Error(`No Gemini CLI project configured for model: ${this.model}`);
    }

    const token = await getAccessToken(geminiConfig.auth);
    const payload = { ...reqData, project: selectedProject };
    if (isStreaming) {
      return fetchGeminiCLiStreamResponse({ token, data: payload });
    }
    return fetchGeminiCLiResponse({ token, data: payload });
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
