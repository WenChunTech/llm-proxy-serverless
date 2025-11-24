
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

export interface QwenAuth {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
    status: string;
    token_type: string;
    expires_in: number;
    scope: string;
    resource_url: string;
}

export interface QwenConfig {
    models: string[];
    auth: QwenAuth;
}

export interface IFlowConfig {
    models: string[];
    auth: IFlowAuth;
}

export interface IFlowAuth {
    access_token: string;
    token_type: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    expiry_date: number;
    userId: string;
    userName: string;
    avatar: string;
    email: string | null;
    phone: string;
    apiKey: string;
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
    iflow: IFlowConfig[];
    model_priority: string[];
}