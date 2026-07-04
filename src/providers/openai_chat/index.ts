import { openAIPoller } from '../../config';
import { convertToOpenAIRequestTo, convertOpenAIResponseTo, convertOpenAIStreamResponseTo } from './adapter';
import { ProviderType } from '../../../pkg/converter_wasm';
import { RequestLogger } from '../../utils/logger';

export class OpenAIProvider {
    apiKey: string;
    baseUrl: string;

    constructor(model: string) {
        const openaiConfig = openAIPoller.getNext(model);
        this.apiKey = openaiConfig.api_key;
        this.baseUrl = openaiConfig.base_url;
    }

    getProviderType() {
        return ProviderType.Chat;
    }

    async convertRequestTo(body: any, source: any) {
        return convertToOpenAIRequestTo(body, source);
    }

  async fetchResponse(_is_streaming: boolean, reqData: any) {
    const url = `${this.baseUrl}/chat/completions`;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
    };
    const body = JSON.stringify(reqData);
    return fetch(url, {
      method: "POST",
      headers: headers,
      body: body,
    });
    }

    async convertResponseTo(c: any, response: Response, target: any) {
        return convertOpenAIResponseTo(c, response, target);
    }

    async convertStreamResponseTo(stream: any, response: Response, target: any, requestLogger?: RequestLogger) {
        return convertOpenAIStreamResponseTo(stream, response, target, requestLogger);
    }
}
