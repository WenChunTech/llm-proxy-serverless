export const PROVIDERS = {
    GEMINI: 'gemini',
    QWEN: 'qwen',
    OPENAI: 'openai',
    CLAUDE: 'claude',
};

export const MODEL_PROVIDER_MAP = [
    {
        pattern: /^gemini-.*/,
        provider: PROVIDERS.GEMINI,
    },
    {
        pattern: /^qwen-.*/,
        provider: PROVIDERS.QWEN,
    },
    {
        pattern: /^gpt-.*/,
        provider: PROVIDERS.OPENAI,
    },
    {
        pattern: /^claude-.*/,
        provider: PROVIDERS.CLAUDE,
    }
];