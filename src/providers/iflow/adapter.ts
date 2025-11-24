import { claudeRequestConvertTo, geminiRequestConvertTo, openaiResponseConvertTo, TargetType } from '../../../pkg/converter_wasm.js';
import { StreamEvent } from '../../streaming/sse.ts';

export function convertToIFlowRequestTo(body: any, source: any) {
    switch (source) {
        case TargetType.Claude:
            return claudeRequestConvertTo(body, TargetType.OpenAI);
        case TargetType.Gemini:
            return geminiRequestConvertTo(body, TargetType.OpenAI);
        case TargetType.OpenAI:
            return body;
        default:
            throw new Error(`Unsupported source type for IFlow provider: ${source}`);
    }
}

export async function convertIFlowResponseTo(c: any, response: Response, target: any) {
    const data = await response.json();
    const resp = openaiResponseConvertTo(data, target);
    return c.json(resp)
}

export async function convertIFlowStreamResponseTo(stream: any, response: Response, target: any) {
    return StreamEvent(stream, response, TargetType.OpenAI, target);
}
