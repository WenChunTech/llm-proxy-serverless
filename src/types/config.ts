
export interface GeminiCliAuth {
    access_token: string;
    scope: string;
    token_type: string;
    expiry_date: number;
    refresh_token: string;
}

export interface GeminiCliConfig {
    projects: string[];
    auth: GeminiCliAuth;
    models: string[];
}

export interface QwenConfig {
    api_key: string;
    models: string[];
}

export interface OpenAIConfig {
    base_url: string;
    api_key: string;
    models: string[];
}

export interface ClaudeConfig {
    base_url: string;
    api_key: string;
    models: string[];
}

export interface Config {
    gemini_cli: GeminiCliConfig[];
    qwen: QwenConfig[];
    openai: OpenAIConfig[];
    claude: ClaudeConfig[];
    model_priority: string[];
}
