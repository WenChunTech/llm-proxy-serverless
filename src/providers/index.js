import { MODEL_PROVIDER_MAP, PROVIDERS } from './base';
import { GeminiProvider } from './gemini';

export function getProvider(model) {
    const providerInfo = MODEL_PROVIDER_MAP.find(item => item.pattern.test(model));

    if (!providerInfo) {
        throw new Error(`Provider not found for model: ${model}`);
    }

    switch (providerInfo.provider) {
        case PROVIDERS.GEMINI:
            return new GeminiProvider();
        default:
            throw new Error(`Provider not found for model: ${model}`);
    }
}