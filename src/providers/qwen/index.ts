import { fetchWithRetry } from '../../utils/fetch.js';
import { appConfig } from '../../config.js';
import { convertQwenRequest, convertQwenResponse, convertQwenStreamResponse } from './adapter.js';

export class QwenProvider {
    apiKey: string;
    constructor() {
        this.apiKey = appConfig.qwen.api_key;
    }

    async convertRequest(body: any, source: any) {
        return convertQwenRequest(body, source);
    }

    async fetchResponse(is_streaming: boolean, reqData: any) {
        return fetchWithRetry(fetchQwenResponse, { apiKey: this.apiKey, data: reqData });
    }

    async convertResponse(c: any, response: any, target: any) {
        return convertQwenResponse(c, response, target);
    }

    async convertStreamResponse(stream: any, response: any, target: any) {
        return convertQwenStreamResponse(stream, response, target);
    }
}

export async function fetchQwenResponse({ apiKey, data }: { apiKey: string, data: any }) {
    const endpoint = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'enable'
    };

    return fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
    });
}
