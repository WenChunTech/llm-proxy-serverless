import { fetchWithRetry } from 'src/utils/fetch.js';
import { openAIPoller } from 'src/config.js';
import { convertToOpenAIRequestTo, convertOpenAIResponseTo, convertOpenAIStreamResponseTo } from './adapter.js';
import { TargetType } from 'converter-wasm';

export class OpenAIProvider {
    apiKey: string;
    baseUrl: string;

    constructor() {
        const openaiConfig = openAIPoller.getNext();
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
        const url = `${this.baseUrl}/v1/chat/completions`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        };
        const body = JSON.stringify(reqData);
        const fetcher = async () => fetch(url, {
            method: 'POST',
            headers: headers,
            body: body,
        });

        return fetchWithRetry(fetcher, {});
    }

    async convertResponseTo(c: any, response: Response, target: any) {
        return convertOpenAIResponseTo(c, response, target);
    }

    async convertStreamResponseTo(stream: any, response: Response, target: any) {
        return convertOpenAIStreamResponseTo(stream, response, target);
    }
}
