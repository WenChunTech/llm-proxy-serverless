import { claude_request_convert, gemini_request_convert, openai_response_convert, TargetType } from '../../../pkg/converter_wasm.js';
import { StreamEvent } from '../../streaming/sse.js';

export function convertToOpenAIRequest(body: any, source: any) {
    switch (source) {
        case TargetType.Claude:
            return claude_request_convert(body, TargetType.OpenAI);
        case TargetType.Gemini:
            return gemini_request_convert(body, TargetType.OpenAI);
        case TargetType.OpenAI:
            return body;
        default:
            throw new Error(`Unsupported source type for OpenAI provider: ${source}`);
    }
}

export async function convertOpenAIResponse(c: any, response: any, target: any) {
    const data = await response.json();
    const resp = openai_response_convert(data, target);
    return c.json(resp)
}

export async function convertOpenAIStreamResponse(stream: any, response: any, target: any) {
    return StreamEvent(stream, response, TargetType.OpenAI, target);
}
