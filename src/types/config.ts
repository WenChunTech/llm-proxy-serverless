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

export interface GeminiConfig {
  models: string[];
  base_url: string;
  api_key: string;
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
  cookie: string | null;
}

export interface OpenAIChatConfig {
  base_url: string;
  api_key: string;
  models: string[];
}

export interface OpenAIResponsesConfig {
  base_url: string;
  api_key: string;
  models: string[];
}

export interface ClaudeConfig {
  base_url: string;
  api_key: string;
  models: string[];
}

export interface CodexAuth {
  id_token: string;
  access_token: string;
  refresh_token: string;
  account_id: string;
  email: string;
  plan_type: string;
  expiry_date: number;
}

export interface CodexConfig {
  models: string[];
  auth: CodexAuth;
  base_url?: string;
}

export interface FallbackModelMap {
  [model: string]: string;
}

export interface Config {
  gemini_cli: GeminiCliConfig[];
  gemini: GeminiConfig[];
  qwen: QwenConfig[];
  openai_chat: OpenAIChatConfig[];
  openai_responses: OpenAIResponsesConfig[];
  claude: ClaudeConfig[];
  iflow: IFlowConfig[];
  codex: CodexConfig[];
  model_priority: string[];
  fallback_models?: FallbackModelMap;
}
