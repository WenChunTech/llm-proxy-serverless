import { appConfig } from '../../config.js';
import { getAccessToken, fetchGeminiCLiStreamResponse, fetchGeminiCLiResponse } from './auth.js';
import { fetchWithRetry } from '../../utils/fetch.js';
import { convertGeminiRequest, convertGeminiResponse, convertGeminiStreamResponse } from './adapter.js';

export class GeminiProvider {
    project: string;
    constructor() {
        this.project = appConfig.gemini_cli.projects[0];
    }

    async convertRequest(body: any, source: any) {
        return convertGeminiRequest(body, source);
    }

    async fetchResponse(is_streaming: boolean, reqData: any) {
        const token = await getAccessToken();
        reqData.project = this.project;
        if (is_streaming) {
            return fetchWithRetry(fetchGeminiCLiStreamResponse, { token, data: reqData });
        } else {
            return fetchWithRetry(fetchGeminiCLiResponse, { token, data: reqData });
        }
    }

    async convertResponse(c: any, response: any, target: any) {
        return convertGeminiResponse(c, response, target);
    }

    async convertStreamResponse(stream: any, response: any, target: any) {
        return convertGeminiStreamResponse(stream, response, target);
    }
}
