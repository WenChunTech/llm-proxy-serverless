import { geminiCliPoller } from '../../config.ts';
import { GeminiCliConfig } from '../../types/config.ts';
import { getAccessToken, fetchGeminiCLiStreamResponse, fetchGeminiCLiResponse } from './auth.ts';
import { fetchWithRetry } from '../../utils/fetch.ts';
import { convertToGeminiCliRequestTo, convertGeminiCliResponseTo, convertGeminiStreamResponseTo } from './adapter.ts';
import { TargetType } from '../../../pkg/converter_wasm.js';

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
