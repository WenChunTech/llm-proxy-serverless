import { geminiRequestConvertTo, openaiRequestConvertTo, openaiResponseConvertTo, TargetType } from 'converter-wasm';
import { StreamEvent } from '@/streaming/sse.js';

export function convertToClaudeRequestTo(body: any, source: any) {
    switch (source) {
        case TargetType.Gemini:
            return geminiRequestConvertTo(body, TargetType.Claude);
        case TargetType.OpenAI:
            return openaiRequestConvertTo(body, TargetType.Claude);
        case TargetType.Claude:
            return body;
        default:
            throw new Error(`Unsupported source type for Claude provider: ${source}`);
    }
}

export async function convertClaudeResponseTo(c: any, response: Response, target: any) {
    const data = await response.json();
    const resp = openaiResponseConvertTo(data, target);
    return c.json(resp)
}

export async function convertClaudeStreamResponseTo(stream: any, response: Response, target: any) {
    return StreamEvent(stream, response, TargetType.Claude, target);
}
