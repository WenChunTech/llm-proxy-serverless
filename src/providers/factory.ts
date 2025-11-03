import { MODEL_PROVIDER_MAP, PROVIDERS } from './_base';
import { GeminiProvider } from './gemini';
import { OpenAIProvider } from './openai';
import { ClaudeProvider } from './claude';
import { QwenProvider } from './qwen';

const providerClasses = {
  [PROVIDERS.GEMINI]: GeminiProvider,
  [PROVIDERS.OPENAI]: OpenAIProvider,
  [PROVIDERS.CLAUDE]: ClaudeProvider,
  [PROVIDERS.QWEN]: QwenProvider,
};

const providerInstances: { [key: string]: any } = {};

export function getProvider(model: string) {
  const providerInfo = MODEL_PROVIDER_MAP.find(item => item.pattern.test(model));

  if (!providerInfo) {
    throw new Error(`Provider not found for model: ${model}`);
  }

  const providerName = providerInfo.provider;

  if (!providerInstances[providerName]) {
    const ProviderClass = providerClasses[providerName];
    if (ProviderClass) {
      providerInstances[providerName] = new ProviderClass();
    } else {
      throw new Error(`Provider not found for model: ${model}`);
    }
  }

  return providerInstances[providerName];
}
