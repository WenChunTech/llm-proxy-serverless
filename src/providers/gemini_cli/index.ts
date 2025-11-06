import { geminiCliPoller } from '../../config.js';
import { GeminiCliConfig } from '../../types/config.js';
import { getAccessToken, fetchGeminiCLiStreamResponse, fetchGeminiCLiResponse } from './auth.js';
import { fetchWithRetry } from '../../utils/fetch.js';
import { convertToGeminiCliRequest, convertGeminiCliResponse, convertGeminiStreamResponse } from './adapter.js';

export class GeminiCliProvider {
    geminiConfig: GeminiCliConfig;
    projectCounter: number;
    constructor() {
        this.geminiConfig = geminiCliPoller.getNext();
        this.projectCounter = 0;
    }

    async convertRequest(body: any, source: any) {
        return convertToGeminiCliRequest(body, source);
    }

    async fetchResponse(is_streaming: boolean, reqData: any) {
        if (this.projectCounter >= this.geminiConfig.projects.length) {
            this.geminiConfig = geminiCliPoller.getNext();
            this.projectCounter = 0;
        }

        const project = this.geminiConfig.projects[this.projectCounter];
        this.projectCounter++;

        const token = await getAccessToken(this.geminiConfig.auth);
        reqData.project = project;
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
