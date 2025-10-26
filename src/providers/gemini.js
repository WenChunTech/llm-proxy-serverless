import {
    openai_request_convert,
    claude_request_convert,
    gemini_req_convert_to_gemini_cli_req,
    TargetType
} from '../../pkg/converter_wasm.js';
import { getAccessToken } from '../creds/gemini_cli.js';
import { fetchWithRetry, fetchGeminiCLiResponse } from '../provider/gemini_cli.js';
import { StreamEvent, geminiCliResponseConvert } from '../eventstream.js';
import { appConfig } from '../init.js';

export class GeminiProvider {
    constructor() {
        this.project = appConfig.gemini_cli.projects[0];
    }

    async execute(env, stream, body, source, target) {
        const convertedRequest = this.convertRequest(body, source);
        convertedRequest.project = this.project;
        const token = await getAccessToken(env);
        const response = await fetchWithRetry(fetchGeminiCLiResponse, { token, data: convertedRequest });

        if (!response.ok) {
            console.error("Error fetching from provider:", await response.text());
            // Handle error appropriately
            return;
        }

        return this.convertResponse(stream, response, target);
    }

    convertRequest(body, source) {
        switch (source) {
            case TargetType.OpenAI:
                return openai_request_convert(body, TargetType.GeminiCli);
            case TargetType.Claude:
                return claude_request_convert(body, TargetType.GeminiCli);
            case TargetType.Gemini:
                return gemini_req_convert_to_gemini_cli_req(body, TargetType.GeminiCli)
            default:
                throw new Error(`Unsupported source type for Gemini provider: ${source}`);
        }
    }

    convertResponse(stream, response, target) {
        if (target === TargetType.Gemini) {
            return geminiCliResponseConvert(stream, response);
        }
        return StreamEvent(stream, response, TargetType.GeminiCli, target);
    }
}