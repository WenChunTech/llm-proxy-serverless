import { fetchWithRetry } from '../../utils/fetch.js';
import { claudePoller } from '../../config.js';
import { convertToClaudeRequest, convertClaudeResponse, convertClaudeStreamResponse } from './adapter.js';

export class ClaudeProvider {
    apiKey: string;
    baseUrl: string;

    constructor() {
        const claudeConfig = claudePoller.getNext();
        this.apiKey = claudeConfig.api_key;
        this.baseUrl = claudeConfig.base_url || 'https://api.anthropic.com';
    }

    async convertRequest(body: any, source: any) {
        return convertToClaudeRequest(body, source);
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

    async convertResponse(c: any, response: any, target: any) {
        return convertClaudeResponse(c, response, target);
    }

    async convertStreamResponse(stream: any, response: any, target: any) {
        return convertClaudeStreamResponse(stream, response, target);
    }
}
