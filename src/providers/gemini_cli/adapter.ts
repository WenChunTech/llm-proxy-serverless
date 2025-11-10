import {
    openaiRequestConvertTo,
    claudeRequestConvertTo,
    geminiCliResponseConvertTo,
    geminiRequestConvertToGeminiCliRequest,
    TargetType
} from '../../../pkg/converter_wasm.js';
import { StreamEvent, geminiCliStreamResponseConvertToGeminiStreamResponse } from '../../streaming/sse.ts';

export function convertToGeminiCliRequestTo(body: any, source: any) {
    switch (source) {
        case TargetType.OpenAI:
            return openaiRequestConvertTo(body, TargetType.GeminiCli);
        case TargetType.Claude:
            return claudeRequestConvertTo(body, TargetType.GeminiCli);
        case TargetType.Gemini:
            return geminiRequestConvertToGeminiCliRequest(body);
        default:
            throw new Error(`Unsupported source type for Gemini provider: ${source}`);
    }
}

export async function convertGeminiCliResponseTo(c: any, response: Response, target: any) {
    const data = await response.json();
    const resp = geminiCliResponseConvertTo(data, target);
    return c.json(resp)
}

export async function convertGeminiStreamResponseTo(stream: any, response: Response, target: any) {
    if (target === TargetType.Gemini) {
        return geminiCliStreamResponseConvertToGeminiStreamResponse(stream, response);
    }
    return StreamEvent(stream, response, TargetType.GeminiCli, target);
}
