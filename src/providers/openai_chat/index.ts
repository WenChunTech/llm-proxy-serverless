import { openAIPoller } from '../../config';
import { convertToOpenAIRequestTo, convertOpenAIResponseTo, convertOpenAIStreamResponseTo } from './adapter';
import { TargetType } from '../../../pkg/converter_wasm';

export class OpenAIProvider {
    apiKey: string;
    baseUrl: string;

    constructor(model: string) {
        const openaiConfig = openAIPoller.getNext(model);
        this.apiKey = openaiConfig.api_key;
        this.baseUrl = openaiConfig.base_url;
    }

    getProviderType() {
        return TargetType.OpenAI;
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

    async convertStreamResponseTo(stream: any, response: Response, target: any) {
        return convertOpenAIStreamResponseTo(stream, response, target);
    }
}
