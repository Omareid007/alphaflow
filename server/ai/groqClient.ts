/**
 * Groq Client - Ultra-fast LLM inference using LPU technology
 *
 * OpenAI-compatible API with Llama 3.1 models.
 * Base URL: https://api.groq.com/openai/v1
 *
 * Pricing (per 1M tokens):
 * - Llama 3.1 8B:  $0.05 input, $0.08 output (CHEAP)
 * - Llama 3.1 70B: $0.59 input, $0.79 output (FAST)
 * - Llama 3.1 405B: $3.00 input, $3.00 output (POWERFUL)
 *
 * @see docs/AI_MODELS_AND_PROVIDERS.md
 */

import { OpenAICompatibleClient } from "./openaiCompatibleClient";

export class GroqClient extends OpenAICompatibleClient {
  constructor() {
    super({
      providerName: "groq",
      apiKeyEnvVars: ["GROQ_API_KEY"],
      baseUrlEnvVar: "GROQ_BASE_URL",
      defaultBaseUrl: "https://api.groq.com/openai/v1",
      modelEnvVar: "GROQ_MODEL",
      defaultModel: "llama-3.1-8b-instant",
      defaultMaxTokens: 1000,
      defaultTemperature: 0.3,
    });
  }
}

export const groqClient = new GroqClient();
