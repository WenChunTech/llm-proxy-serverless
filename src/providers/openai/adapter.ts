import { claudeRequestConvertTo, geminiRequestConvertTo, openaiResponseConvertTo, TargetType } from 'converter-wasm';
import { StreamEvent } from '../../streaming/sse.js';

export function convertToOpenAIRequestTo(body: any, source: any) {
    switch (source) {
        case TargetType.Claude:
            return claudeRequestConvertTo(body, TargetType.OpenAI);
        case TargetType.Gemini:
            return geminiRequestConvertTo(body, TargetType.OpenAI);
        case TargetType.OpenAI:
            return body;
        default:
            throw new Error(`Unsupported source type for OpenAI provider: ${source}`);
    }
}

export async function convertOpenAIResponseTo(c: any, response: Response, target: any) {
    const data = await response.json();
    const resp = openaiResponseConvertTo(data, target);
    return c.json(resp)
}

export async function convertOpenAIStreamResponseTo(stream: any, response: Response, target: any) {
    return StreamEvent(stream, response, TargetType.OpenAI, target);
}
