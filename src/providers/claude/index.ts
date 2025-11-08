import { fetchWithRetry } from '@/utils/fetch.js';
import { claudePoller } from '@/config.js';
import { convertToClaudeRequestTo, convertClaudeResponseTo, convertClaudeStreamResponseTo } from './adapter.js';
import { TargetType } from 'converter-wasm';

export class ClaudeProvider {
    apiKey: string;
    baseUrl: string;

    constructor() {
        const claudeConfig = claudePoller.getNext();
        this.apiKey = claudeConfig.api_key;
        this.baseUrl = claudeConfig.base_url;
    }

    getProviderType() {
        return TargetType.Claude;
    }

    async convertRequestTo(body: any, source: any) {
        return convertToClaudeRequestTo(body, source);
    }

    async fetchResponse(is_streaming: boolean, reqData: any) {
        const url = `${this.baseUrl}/v1/messages`;
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
        };
        const body = JSON.stringify({ ...reqData, stream: is_streaming });

        const fetcher = async () => fetch(url, {
            method: 'POST',
            headers: headers,
            body: body,
        });

        return fetchWithRetry(fetcher, {});
    }

    async convertResponseTo(c: any, response: Response, target: any) {
        return convertClaudeResponseTo(c, response, target);
    }

    async convertStreamResponseTo(stream: any, response: Response, target: any) {
        return convertClaudeStreamResponseTo(stream, response, target);
    }
}
