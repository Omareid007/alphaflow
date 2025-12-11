/**
 * AI Module Index - Multi-provider LLM access with intelligent routing
 * 
 * Provider priority (with fallbacks):
 * 1. OpenAI - Primary provider (most reliable, best quality)
 * 2. Groq - Ultra-fast inference with Llama models
 * 3. Together.ai - 200+ open-source models
 * 4. AIML API - 400+ models (vision, audio, text)
 * 5. OpenRouter - Fallback with multiple providers
 * 
 * @see docs/AI_MODELS_AND_PROVIDERS.md for configuration
 * @see docs/AGENT_EXECUTION_GUIDE.md Section 14 for governance
 */

import { LLMClient, LLMProvider } from "./llmClient";
import { openaiClient, OpenAIClient } from "./openaiClient";
import { openrouterClient, OpenRouterClient } from "./openrouterClient";
import { groqClient, GroqClient } from "./groqClient";
import { togetherClient, TogetherClient } from "./togetherClient";
import { aimlClient, AIMLClient } from "./aimlClient";
import { llmRouter, LLMRouter, routedLLMCall, RouterConfig, TaskComplexity, TaskPriority } from "./llmRouter";

export * from "./llmClient";
export { OpenAIClient, openaiClient } from "./openaiClient";
export { OpenRouterClient, openrouterClient } from "./openrouterClient";
export { GroqClient, groqClient } from "./groqClient";
export { TogetherClient, togetherClient } from "./togetherClient";
export { AIMLClient, aimlClient } from "./aimlClient";
export { LLMRouter, llmRouter, routedLLMCall } from "./llmRouter";
export type { RouterConfig, TaskComplexity, TaskPriority };

function getConfiguredProvider(): LLMProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === "openrouter") return "openrouter";
  if (provider === "groq") return "groq";
  if (provider === "together") return "together";
  if (provider === "aimlapi") return "aimlapi";
  return "openai";
}

function selectClient(): LLMClient {
  const provider = getConfiguredProvider();
  
  const clientMap: Record<LLMProvider, LLMClient> = {
    openai: openaiClient,
    openrouter: openrouterClient,
    groq: groqClient,
    together: togetherClient,
    aimlapi: aimlClient,
  };

  const preferredClient = clientMap[provider];
  if (preferredClient?.isAvailable()) {
    return preferredClient;
  }

  if (openaiClient.isAvailable()) return openaiClient;
  if (groqClient.isAvailable()) return groqClient;
  if (togetherClient.isAvailable()) return togetherClient;
  if (aimlClient.isAvailable()) return aimlClient;
  if (openrouterClient.isAvailable()) return openrouterClient;
  
  return openaiClient;
}

export const llm: LLMClient = selectClient();

export function getLLMStatus(): {
  provider: LLMProvider;
  available: boolean;
  providers: Record<LLMProvider, boolean>;
} {
  const client = selectClient();
  
  return {
    provider: client.getProviderName() as LLMProvider,
    available: client.isAvailable(),
    providers: {
      openai: openaiClient.isAvailable(),
      openrouter: openrouterClient.isAvailable(),
      groq: groqClient.isAvailable(),
      together: togetherClient.isAvailable(),
      aimlapi: aimlClient.isAvailable(),
    },
  };
}

export function getAllAvailableProviders(): LLMProvider[] {
  const available: LLMProvider[] = [];
  if (openaiClient.isAvailable()) available.push("openai");
  if (groqClient.isAvailable()) available.push("groq");
  if (togetherClient.isAvailable()) available.push("together");
  if (aimlClient.isAvailable()) available.push("aimlapi");
  if (openrouterClient.isAvailable()) available.push("openrouter");
  return available;
}
