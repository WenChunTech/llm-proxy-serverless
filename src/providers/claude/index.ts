import { fetchWithRetry } from '../../utils/fetch.js';
import { appConfig } from '../../config.js';
import { convertClaudeRequest, convertClaudeResponse, convertClaudeStreamResponse } from './adapter.js';

export class ClaudeProvider {
    apiKey: string;
    constructor() {
        this.apiKey = appConfig.claude.api_key;
    }

    async convertRequest(body: any, source: any) {
        return convertClaudeRequest(body, source);
    }

    async fetchResponse(is_streaming: boolean, reqData: any) {
        // Placeholder
        return new Response();
    }

    async convertResponse(c: any, response: any, target: any) {
        return convertClaudeResponse(c, response, target);
    }

    async convertStreamResponse(stream: any, response: any, target: any) {
        return convertClaudeStreamResponse(stream, response, target);
    }
}
