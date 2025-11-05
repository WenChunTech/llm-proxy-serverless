import { fetchWithRetry } from '../../utils/fetch.js';
import { openAIPoller } from '../../config.js';
import { convertToOpenAIRequest, convertOpenAIResponse, convertOpenAIStreamResponse } from './adapter.js';

export class OpenAIProvider {
    apiKey: string;
    baseUrl: string;

    constructor() {
        const openaiConfig = openAIPoller.getNext();
        this.apiKey = openaiConfig.api_key;
        this.baseUrl = openaiConfig.base_url;
    }

    async convertRequest(body: any, source: any) {
        return convertToOpenAIRequest(body, source);
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

    async convertResponse(c: any, response: any, target: any) {
        return convertOpenAIResponse(c, response, target);
    }

    async convertStreamResponse(stream: any, response: any, target: any) {
        return convertOpenAIStreamResponse(stream, response, target);
    }
}
