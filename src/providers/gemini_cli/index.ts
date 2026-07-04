import { geminiCliPoller } from '../../config';
import { GeminiCliConfig } from '../../types/config';
import { getAccessToken, fetchGeminiCLiStreamResponse, fetchGeminiCLiResponse } from './auth';
import { convertToGeminiCliRequestTo, convertGeminiCliResponseTo, convertGeminiStreamResponseTo } from './adapter';
import { ProviderType } from '../../../pkg/converter_wasm';
import { RequestLogger } from '../../utils/logger';

export class GeminiCliProvider {
    geminiConfig: GeminiCliConfig;
    projectCounter: number;
    model: string;
    constructor(model: string) {
        this.model = model
        this.geminiConfig = geminiCliPoller.getNext(model);
        this.projectCounter = 0;
    }

    getProviderType() {
        return ProviderType.GeminiCli
    }

    async convertRequestTo(body: any, source: any) {
        return convertToGeminiCliRequestTo(body, source);
    }

    async fetchResponse(is_streaming: boolean, reqData: any) {
        if (this.projectCounter >= this.geminiConfig.projects.length) {
            this.geminiConfig = geminiCliPoller.getNext(this.model);
            this.projectCounter = 0;
        }

        const project = this.geminiConfig.projects[this.projectCounter];
        this.projectCounter++;

        const token = await getAccessToken(this.geminiConfig.auth);
        reqData.project = project;
        if (is_streaming) {
            return fetchGeminiCLiStreamResponse({ token, data: reqData });
        } else {
            return fetchGeminiCLiResponse({ token, data: reqData });
        }
    }

    async convertResponseTo(c: any, response: Response, target: any) {
        return convertGeminiCliResponseTo(c, response, target);
    }

    async convertStreamResponseTo(stream: any, response: Response, target: any, requestLogger?: RequestLogger) {
        return convertGeminiStreamResponseTo(stream, response, target, requestLogger);
    }
}
