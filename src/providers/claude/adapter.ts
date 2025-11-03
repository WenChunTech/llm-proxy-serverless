import { TargetType } from '../../../pkg/converter_wasm.js';

export function convertClaudeRequest(body: any, source: any) {
    // Placeholder
    return body;
}

export async function convertClaudeResponse(c: any, response: any, target: any) {
    // Placeholder
    const data = await response.json();
    return c.json(data);
}

export async function convertClaudeStreamResponse(stream: any, response: any, target: any) {
    // Placeholder
    return response.body;
}
