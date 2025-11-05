import { claude_response_convert, gemini_request_convert, openai_request_convert, TargetType } from '../../../pkg/converter_wasm.js';
import { StreamEvent } from '../../streaming/sse.js';

export function convertToClaudeRequest(body: any, source: any) {
    switch (source) {
        case TargetType.Gemini:
            return gemini_request_convert(body, TargetType.Claude);
        case TargetType.OpenAI:
            return openai_request_convert(body, TargetType.Claude);
        case TargetType.Claude:
            return body;
        default:
            throw new Error(`Unsupported source type for Claude provider: ${source}`);
    }
}

export async function convertClaudeResponse(c: any, response: any, target: any) {
    const data = await response.json();
    const resp = claude_response_convert(data, target);
    return c.json(resp)
}

export async function convertClaudeStreamResponse(stream: any, response: any, target: any) {
    return StreamEvent(stream, response, TargetType.Claude, target);
}
