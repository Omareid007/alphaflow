/**
 * OpenAI Client - Minimal fetch-based OpenAI API client
 *
 * Uses fetch to call the OpenAI HTTP API directly, NO SDK.
 * Supports chat completions with tool calling.
 *
 * @see docs/AI_MODELS_AND_PROVIDERS.md
 */

import { OpenAICompatibleClient } from "./openaiCompatibleClient";

export class OpenAIClient extends OpenAICompatibleClient {
  constructor() {
    super({
      providerName: "openai",
      apiKeyEnvVars: ["AI_INTEGRATIONS_OPENAI_API_KEY", "OPENAI_API_KEY"],
      baseUrlEnvVar: "AI_INTEGRATIONS_OPENAI_BASE_URL",
      defaultBaseUrl: "https://api.openai.com/v1",
      modelEnvVar: "OPENAI_MODEL",
      defaultModel: "gpt-4o-mini",
      defaultMaxTokens: 1000,
      defaultTemperature: 0.3,
    });

    // Also check OPENAI_BASE_URL as fallback
    if (
      !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
      process.env.OPENAI_BASE_URL
    ) {
      this.baseUrl = process.env.OPENAI_BASE_URL;
    }
  }
}

export const openaiClient = new OpenAIClient();
