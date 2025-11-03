import { fetchWithRetry } from '../../utils/fetch.js';
import { appConfig } from '../../config.js';
import { convertOpenAIRequest, convertOpenAIResponse, convertOpenAIStreamResponse } from './adapter.js';

export class OpenAIProvider {
    apiKey: string;
    constructor() {
        this.apiKey = appConfig.openai.api_key;
    }

    async convertRequest(body: any, source: any) {
        return convertOpenAIRequest(body, source);
    }

    async fetchResponse(is_streaming: boolean, reqData: any) {
        // Placeholder for fetchResponse
        return new Response();
    }

    async convertResponse(c: any, response: any, target: any) {
        return convertOpenAIResponse(c, response, target);
    }

    async convertStreamResponse(stream: any, response: any, target: any) {
        return convertOpenAIStreamResponse(stream, response, target);
    }
}
