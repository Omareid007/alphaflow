/**
 * OpenRouter Client - Minimal fetch-based OpenRouter API client
 *
 * Uses fetch to call OpenRouter's OpenAI-compatible API.
 * Provides access to multiple LLM providers through a single interface.
 *
 * @see docs/AI_MODELS_AND_PROVIDERS.md
 */

import { OpenAICompatibleClient } from "./openaiCompatibleClient";

export class OpenRouterClient extends OpenAICompatibleClient {
  constructor() {
    super({
      providerName: "openrouter",
      apiKeyEnvVars: ["OPENROUTER_API_KEY"],
      baseUrlEnvVar: "OPENROUTER_BASE_URL",
      defaultBaseUrl: "https://openrouter.ai/api/v1",
      modelEnvVar: "OPENROUTER_MODEL",
      defaultModel: "openai/gpt-4o-mini",
      defaultMaxTokens: 1000,
      defaultTemperature: 0.3,
      extraHeaders: {
        "HTTP-Referer": process.env.REPLIT_DEV_DOMAIN || "https://replit.com",
        "X-Title": "AI Active Trader",
      },
    });
  }
}

export const openrouterClient = new OpenRouterClient();
