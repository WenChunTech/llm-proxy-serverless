import {
    openai_request_convert,
    claude_request_convert,
    gemini_cli_response_convert,
    gemini_req_convert_to_gemini_cli_req,
    TargetType
} from '../../pkg/converter_wasm.js';
import { StreamEvent, geminiCliResponseConvert } from '../eventstream.js';
import { appConfig } from '../init.js';

export class GeminiProvider {
    constructor() {
        this.project = appConfig.gemini_cli.projects[0];
    }

    async convertRequest(body, source) {
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

    async convertResponse(c, response, target) {
        const data = await response.json();
        const resp = gemini_cli_response_convert(data, target);
        return c.json(resp)
    }

    async convertStreamResponse(stream, response, target) {
        if (target === TargetType.Gemini) {
            return geminiCliResponseConvert(stream, response);
        }
        return StreamEvent(stream, response, TargetType.GeminiCli, target);
    }
}