import { geminiCliPoller, geminiCliProjectsPoller } from '../../config.js';
import { getAccessToken, fetchGeminiCLiStreamResponse, fetchGeminiCLiResponse } from './auth.js';
import { fetchWithRetry } from '../../utils/fetch.js';
import { convertToGeminiCliRequest, convertGeminiCliResponse, convertGeminiStreamResponse } from './adapter.js';

export class GeminiCliProvider {
    project: string;
    constructor() {
        this.project = geminiCliProjectsPoller.getNext();
    }

    async convertRequest(body: any, source: any) {
        return convertToGeminiCliRequest(body, source);
    }

    async fetchResponse(is_streaming: boolean, reqData: any) {
        const geminiConfig = geminiCliPoller.getNext();
        const token = await getAccessToken(geminiConfig.auth);
        reqData.project = this.project;
        if (is_streaming) {
            return fetchWithRetry(fetchGeminiCLiStreamResponse, { token, data: reqData });
        } else {
            return fetchWithRetry(fetchGeminiCLiResponse, { token, data: reqData });
        }
    }

    async convertResponse(c: any, response: any, target: any) {
        return convertGeminiCliResponse(c, response, target);
    }

    async convertStreamResponse(stream: any, response: any, target: any) {
        return convertGeminiStreamResponse(stream, response, target);
    }
}
