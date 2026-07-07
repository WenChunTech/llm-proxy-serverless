export interface BaseProviderConfig {
  models: string[];
  enabled?: boolean;
}

export interface GeminiCliAuth {
  access_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
  refresh_token: string;
}

export interface GeminiCliConfig extends BaseProviderConfig {
  projects: string[];
  auth: GeminiCliAuth;
}

export interface GeminiConfig extends BaseProviderConfig {
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

export interface QwenConfig extends BaseProviderConfig {
  auth: QwenAuth;
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

export interface IFlowConfig extends BaseProviderConfig {
  auth: IFlowAuth;
}

export interface OpenAIChatConfig extends BaseProviderConfig {
  base_url: string;
  api_key: string;
}

export interface OpenAIResponsesConfig extends BaseProviderConfig {
  base_url: string;
  api_key: string;
}

export interface ClaudeConfig extends BaseProviderConfig {
  base_url: string;
  api_key: string;
}

export interface CodexAuth {
  id_token: string;
  access_token: string;
  refresh_token: string;
  account_id?: string;
  base_url?: string;
  email?: string;
  plan_type?: string;
  expiry_date: number;
  expired?: string;
  session_token?: string;
  chatgpt_plan_type?: string;
  chatgpt_account_id?: string;
  disabled?: boolean;
  id_token_synthetic?: boolean;
  last_refresh?: string;
  name?: string;
  type?: string;
  token_type?: string;
  _validated_at?: string;
  _validation_status?: string;
}

export interface CodexConfig extends BaseProviderConfig {
  base_url?: string;
  auth: CodexAuth | CodexAuth[];
}

export interface Config {
  api_key?: string;
  gemini_cli: GeminiCliConfig[];
  gemini: GeminiConfig[];
  qwen: QwenConfig[];
  openai_chat: OpenAIChatConfig[];
  openai_responses: OpenAIResponsesConfig[];
  claude: ClaudeConfig[];
  iflow: IFlowConfig[];
  codex: CodexConfig[];
  model_priority: string[];
  fallback_models?: string[];
}

export function isProviderConfigEnabled(config: BaseProviderConfig): boolean {
  return config.enabled !== false;
}
