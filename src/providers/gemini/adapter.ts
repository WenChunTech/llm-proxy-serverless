import {
    openai_request_convert,
    claude_request_convert,
    gemini_cli_response_convert,
    gemini_req_convert_to_gemini_cli_req,
    TargetType
} from '../../../pkg/converter_wasm.js';
import { StreamEvent, geminiCliResponseConvert } from '../../streaming/sse.js';

export function convertGeminiRequest(body: any, source: any) {
    switch (source) {
        case TargetType.OpenAI:
            return openai_request_convert(body, TargetType.GeminiCli);
        case TargetType.Claude:
            return claude_request_convert(body, TargetType.GeminiCli);
        case TargetType.Gemini:
            return gemini_req_convert_to_gemini_cli_req(body)
        default:
            throw new Error(`Unsupported source type for Gemini provider: ${source}`);
    }
}

export async function convertGeminiResponse(c: any, response: any, target: any) {
    const data = await response.json();
    const resp = gemini_cli_response_convert(data, target);
    return c.json(resp)
}

export async function convertGeminiStreamResponse(stream: any, response: any, target: any) {
    if (target === TargetType.Gemini) {
        return geminiCliResponseConvert(stream, response);
    }
    return StreamEvent(stream, response, TargetType.GeminiCli, target);
}
