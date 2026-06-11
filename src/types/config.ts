export interface ProviderConfigBase {
  models: string[];
  enabled?: boolean;
}

export function isProviderConfigEnabled(
  config: { enabled?: boolean } | null | undefined,
): boolean {
  return config?.enabled !== false;
}

export interface GeminiCliAuth {
  access_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
  refresh_token: string;
}

export interface GeminiCliConfig extends ProviderConfigBase {
  projects: string[];
  auth: GeminiCliAuth;
}

export interface GeminiConfig extends ProviderConfigBase {
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

export interface QwenConfig extends ProviderConfigBase {
  auth: QwenAuth;
}

export interface IFlowConfig extends ProviderConfigBase {
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

export interface OpenAIChatConfig extends ProviderConfigBase {
  base_url: string;
  api_key: string;
}

export interface OpenAIResponsesConfig extends ProviderConfigBase {
  base_url: string;
  api_key: string;
}

export interface ClaudeConfig extends ProviderConfigBase {
  base_url: string;
  api_key: string;
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

export interface CodexConfig extends ProviderConfigBase {
  auth: CodexAuth;
  base_url?: string;
}

export interface FallbackModelMap {
  [model: string]: string;
}

export type ProviderPriority =
  | "gemini_cli"
  | "codex"
  | "gemini"
  | "openai_chat"
  | "openai_responses"
  | "claude"
  | "qwen"
  | "iflow";

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
  model_priority: ProviderPriority[];
  fallback_models?: FallbackModelMap;
}
