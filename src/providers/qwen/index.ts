import { fetchWithRetry } from 'src/utils/fetch.js';
import { qwenPoller } from 'src/config.js';
import { convertToQwenRequest, convertQwenResponse, convertQwenStreamResponse } from './adapter.js';
import { TargetType } from 'converter-wasm';

export class QwenProvider {
    constructor() { }


    async convertRequest(body: any, source: any) {
        return convertToQwenRequest(body, source);
    }

    getProviderType() {
        return TargetType.OpenAI;
    }

    async fetchResponse(is_streaming: boolean, reqData: any) {
        const qwenConfig = qwenPoller.getNext();
        const apiKey = qwenConfig.api_key;
        const endpoint = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";

        const headers: any = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        if (is_streaming) {
            headers['X-DashScope-SSE'] = 'enable';
        }

        const fetcher = async () => fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(reqData)
        });

        return fetchWithRetry(fetcher, {});
    }

    async convertResponse(c: any, response: any, target: any) {
        return convertQwenResponse(c, response, target);
    }

    async convertStreamResponse(stream: any, response: any, target: any) {
        return convertQwenStreamResponse(stream, response, target);
    }
}
