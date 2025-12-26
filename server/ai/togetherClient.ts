/**
 * Together.ai Client - 200+ open-source models with fast inference
 *
 * OpenAI-compatible API with models from Meta, Mistral, and more.
 * Base URL: https://api.together.xyz/v1
 *
 * Key Models:
 * - Llama 3 8B Lite: $0.10/1M tokens (6x cheaper than GPT-4o-mini)
 * - Llama 3.3 70B: 11x lower cost than GPT-4o
 * - Llama 4 Maverick 400B MoE: $0.27/1M tokens
 *
 * @see docs/AI_MODELS_AND_PROVIDERS.md
 */

import { OpenAICompatibleClient } from "./openaiCompatibleClient";

export class TogetherClient extends OpenAICompatibleClient {
  constructor() {
    super({
      providerName: "together",
      apiKeyEnvVars: ["TOGETHER_API_KEY"],
      baseUrlEnvVar: "TOGETHER_BASE_URL",
      defaultBaseUrl: "https://api.together.xyz/v1",
      modelEnvVar: "TOGETHER_MODEL",
      defaultModel: "meta-llama/Llama-3.2-3B-Instruct-Turbo",
      defaultMaxTokens: 1000,
      defaultTemperature: 0.3,
    });
  }
}

export const togetherClient = new TogetherClient();
