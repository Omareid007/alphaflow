/**
 * AI Module Index - Multi-provider LLM access with intelligent routing
 *
 * Provider priority (with fallbacks):
 * 1. OpenAI - Primary provider (most reliable, best quality)
 * 2. Groq - Ultra-fast inference with Llama models
 * 3. Together.ai - 200+ open-source models
 * 4. AIML API - 400+ models (vision, audio, text)
 * 5. OpenRouter - Fallback with multiple providers
 * 6. Claude - Anthropic's Claude models
 * 7. Gemini - Google's Gemini models (generous free tier)
 * 8. Cloudflare - Edge inference with Workers AI
 * 9. HuggingFace - 100,000+ open-source models
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
import { claudeClient, ClaudeClient } from "./claudeClient";
import { geminiClient, GeminiClient } from "./geminiClient";
import { cloudflareClient, CloudflareClient } from "./cloudflareClient";
import { huggingfaceClient, HuggingFaceClient } from "./huggingfaceClient";

export * from "./llmClient";
export { OpenAIClient, openaiClient } from "./openaiClient";
export { OpenRouterClient, openrouterClient } from "./openrouterClient";
export { GroqClient, groqClient } from "./groqClient";
export { TogetherClient, togetherClient } from "./togetherClient";
export { AIMLClient, aimlClient } from "./aimlClient";
export { ClaudeClient, claudeClient } from "./claudeClient";
export { GeminiClient, geminiClient } from "./geminiClient";
export { CloudflareClient, cloudflareClient } from "./cloudflareClient";
export { HuggingFaceClient, huggingfaceClient } from "./huggingfaceClient";

function getConfiguredProvider(): LLMProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === "openrouter") return "openrouter";
  if (provider === "groq") return "groq";
  if (provider === "together") return "together";
  if (provider === "aimlapi") return "aimlapi";
  if (provider === "claude") return "claude";
  if (provider === "gemini") return "gemini";
  if (provider === "cloudflare") return "cloudflare";
  if (provider === "huggingface") return "huggingface";
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
    claude: claudeClient,
    gemini: geminiClient,
    cloudflare: cloudflareClient,
    huggingface: huggingfaceClient,
  };

  const preferredClient = clientMap[provider];
  if (preferredClient?.isAvailable()) {
    return preferredClient;
  }

  // Fallback chain
  if (openaiClient.isAvailable()) return openaiClient;
  if (groqClient.isAvailable()) return groqClient;
  if (togetherClient.isAvailable()) return togetherClient;
  if (aimlClient.isAvailable()) return aimlClient;
  if (claudeClient.isAvailable()) return claudeClient;
  if (geminiClient.isAvailable()) return geminiClient;
  if (cloudflareClient.isAvailable()) return cloudflareClient;
  if (huggingfaceClient.isAvailable()) return huggingfaceClient;
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
      claude: claudeClient.isAvailable(),
      gemini: geminiClient.isAvailable(),
      cloudflare: cloudflareClient.isAvailable(),
      huggingface: huggingfaceClient.isAvailable(),
    },
  };
}

export function getAllAvailableProviders(): LLMProvider[] {
  const available: LLMProvider[] = [];
  if (openaiClient.isAvailable()) available.push("openai");
  if (groqClient.isAvailable()) available.push("groq");
  if (togetherClient.isAvailable()) available.push("together");
  if (aimlClient.isAvailable()) available.push("aimlapi");
  if (claudeClient.isAvailable()) available.push("claude");
  if (geminiClient.isAvailable()) available.push("gemini");
  if (cloudflareClient.isAvailable()) available.push("cloudflare");
  if (huggingfaceClient.isAvailable()) available.push("huggingface");
  if (openrouterClient.isAvailable()) available.push("openrouter");
  return available;
}
