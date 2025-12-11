/**
 * AI Module Index - Provider selection and unified LLM access
 * 
 * This module selects the appropriate LLM provider based on configuration:
 * - Primary: OpenAI (default)
 * - Secondary: OpenRouter (when AI_PROVIDER=openrouter)
 * 
 * @see docs/AI_MODELS_AND_PROVIDERS.md for configuration
 * @see docs/AGENT_EXECUTION_GUIDE.md Section 14 for governance
 */

import { LLMClient, LLMProvider } from "./llmClient";
import { openaiClient, OpenAIClient } from "./openaiClient";
import { openrouterClient, OpenRouterClient } from "./openrouterClient";

export * from "./llmClient";
export { OpenAIClient, openaiClient } from "./openaiClient";
export { OpenRouterClient, openrouterClient } from "./openrouterClient";

function getConfiguredProvider(): LLMProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === "openrouter") {
    return "openrouter";
  }
  return "openai";
}

function selectClient(): LLMClient {
  const provider = getConfiguredProvider();
  
  if (provider === "openrouter" && openrouterClient.isAvailable()) {
    return openrouterClient;
  }
  
  if (openaiClient.isAvailable()) {
    return openaiClient;
  }
  
  if (openrouterClient.isAvailable()) {
    return openrouterClient;
  }
  
  return openaiClient;
}

export const llm: LLMClient = selectClient();

export function getLLMStatus(): {
  provider: LLMProvider;
  available: boolean;
  openaiAvailable: boolean;
  openrouterAvailable: boolean;
} {
  const configuredProvider = getConfiguredProvider();
  const client = selectClient();
  
  return {
    provider: client.getProviderName() as LLMProvider,
    available: client.isAvailable(),
    openaiAvailable: openaiClient.isAvailable(),
    openrouterAvailable: openrouterClient.isAvailable(),
  };
}
