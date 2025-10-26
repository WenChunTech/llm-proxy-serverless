export const PROVIDERS = {
    GEMINI: 'gemini',
    QWEN: 'qwen',
};

export const MODEL_PROVIDER_MAP = [
    {
        pattern: /^gemini-.*/,
        provider: PROVIDERS.GEMINI,
    },
    {
        pattern: /^qwen-.*/,
        provider: PROVIDERS.QWEN,
    }
];