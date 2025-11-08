import { geminiCliPoller } from 'src/config.js';
import { GeminiCliConfig } from 'src/types/config.js';
import { getAccessToken, fetchGeminiCLiStreamResponse, fetchGeminiCLiResponse } from './auth.js';
import { fetchWithRetry } from 'src/utils/fetch.js';
import { convertToGeminiCliRequestTo, convertGeminiCliResponseTo, convertGeminiStreamResponseTo } from './adapter.js';
import { TargetType } from 'converter-wasm';

export class GeminiCliProvider {
    geminiConfig: GeminiCliConfig;
    projectCounter: number;
    constructor() {
        this.geminiConfig = geminiCliPoller.getNext();
        this.projectCounter = 0;
    }

    getProviderType() {
        return TargetType.GeminiCli
    }

    async convertRequestTo(body: any, source: any) {
        return convertToGeminiCliRequestTo(body, source);
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

    async convertResponseTo(c: any, response: Response, target: any) {
        return convertGeminiCliResponseTo(c, response, target);
    }

    async convertStreamResponseTo(stream: any, response: Response, target: any) {
        return convertGeminiStreamResponseTo(stream, response, target);
    }
}
