export const PROVIDERS = {
  GEMINI_CLI: "gemini_cli",
  GEMINI: "gemini",
  QWEN: "qwen",
  IFLOW: "iflow",
  OPENAI_CHAT: "openai_chat",
  OPENAI_RESPONSES: "openai_responses",
  CLAUDE: "claude",
  CODEX: "codex",
};

export type { Provider } from "./interface.ts";
export type { ProviderId, ProviderDescriptor, ProviderConfig } from "../registry.ts";
