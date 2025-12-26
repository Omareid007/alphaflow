/**
 * AIML API Client - Access to 400+ AI/ML models
 *
 * OpenAI-compatible API with unified access to multiple providers.
 * Base URL: https://api.aimlapi.com/v1
 *
 * Features:
 * - 400+ models (LLMs, vision, audio)
 * - Free tier: 10 requests/hour
 * - Pay-as-you-go starting at $20
 *
 * @see docs/AI_MODELS_AND_PROVIDERS.md
 */

import { OpenAICompatibleClient } from "./openaiCompatibleClient";

export class AIMLClient extends OpenAICompatibleClient {
  constructor() {
    super({
      providerName: "aimlapi",
      apiKeyEnvVars: ["AIMLAPI_KEY"],
      baseUrlEnvVar: "AIMLAPI_BASE_URL",
      defaultBaseUrl: "https://api.aimlapi.com/v1",
      modelEnvVar: "AIMLAPI_MODEL",
      defaultModel: "gpt-4o-mini",
      defaultMaxTokens: 1000,
      defaultTemperature: 0.3,
    });
  }
}

export const aimlClient = new AIMLClient();
