import { TargetType } from '../../../pkg/converter_wasm.js';

export function convertOpenAIRequest(body: any, source: any) {
    // Placeholder
    return body;
}

export async function convertOpenAIResponse(c: any, response: any, target: any) {
    // Placeholder
    const data = await response.json();
    return c.json(data);
}

export async function convertOpenAIStreamResponse(stream: any, response: any, target: any) {
    // Placeholder
    return response.body;
}
