import { MODEL_PROVIDER_MAP, PROVIDERS } from './base';
import { GeminiProvider } from './gemini';
import { QwenProvider } from './qwen';

export function getProvider(model) {
    const providerInfo = MODEL_PROVIDER_MAP.find(item => item.pattern.test(model));

    if (!providerInfo) {
        throw new Error(`Provider not found for model: ${model}`);
    }

    switch (providerInfo.provider) {
        case PROVIDERS.GEMINI:
            return new GeminiProvider();
        case PROVIDERS.QWEN:
            return new QwenProvider();
        default:
            throw new Error(`Provider not found for model: ${model}`);
    }
}