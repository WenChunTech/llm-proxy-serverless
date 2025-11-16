import { fetchWithRetry } from '../../utils/fetch.ts';
import { openAIPoller } from '../../config.ts';
import { convertToOpenAIRequestTo, convertOpenAIResponseTo, convertOpenAIStreamResponseTo } from './adapter.ts';
import { TargetType } from '../../../pkg/converter_wasm.js';

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
