import { fetchWithRetry } from '../provider/gemini_cli.js'; // Reusing for now
import { fetchQwenResponse } from '../provider/qwen.js';
import { TargetType } from '../../pkg/converter_wasm.js';

export class QwenProvider {
    constructor() {
        // This is a placeholder. In a real application, the API key should be loaded securely.
        this.apiKey = 'dummy-qwen-api-key';
    }

    async execute(env, c, body, source) {
        const convertedRequest = this.convertRequest(body, source);
        const response = await fetchWithRetry(fetchQwenResponse, { apiKey: this.apiKey, data: convertedRequest });

        if (!response.ok) {
            console.error("Error fetching from Qwen provider:", await response.text());
            return new Response(response.body, { status: response.status, headers: response.headers });
        }

        return this.convertResponse(response);
    }

    convertRequest(body, source) {
        // Since Qwen is OpenAI compatible, no conversion is needed if the source is already OpenAI.
        if (source === TargetType.OpenAI) {
            return body;
        }
        throw new Error(`Unsupported source type for Qwen provider: ${source}`);
    }

    convertResponse(response) {
        // The response is already an OpenAI-compatible stream, so we return it directly.
        return response;
    }
}