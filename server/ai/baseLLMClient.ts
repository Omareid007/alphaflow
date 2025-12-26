/**
 * Base LLM Client - Abstract base class for all LLM providers
 *
 * Provides common functionality:
 * - Configuration handling
 * - Availability checking
 * - Error handling utilities
 * - Latency tracking
 */

import { log } from "../utils/logger";
import { LLMClient, LLMRequest, LLMResponse, createLLMError } from "./llmClient";

export interface BaseLLMClientConfig {
  providerName: string;
  apiKeyEnvVars: string[];
  baseUrlEnvVar?: string;
  defaultBaseUrl: string;
  modelEnvVar?: string;
  defaultModel: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

export abstract class BaseLLMClient implements LLMClient {
  protected apiKey: string;
  protected baseUrl: string;
  protected defaultModel: string;
  protected config: BaseLLMClientConfig;

  constructor(config: BaseLLMClientConfig) {
    this.config = config;
    this.apiKey = this.resolveApiKey(config.apiKeyEnvVars);
    this.baseUrl = process.env[config.baseUrlEnvVar || ''] || config.defaultBaseUrl;
    this.defaultModel = process.env[config.modelEnvVar || ''] || config.defaultModel;
  }

  private resolveApiKey(envVars: string[]): string {
    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value) return value;
    }
    return "";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return this.config.providerName;
  }

  abstract call(req: LLMRequest): Promise<LLMResponse>;

  protected async measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
    const startTime = Date.now();
    const result = await fn();
    return { result, latencyMs: Date.now() - startTime };
  }

  protected handleHttpError(response: Response, errorText: string): never {
    const statusCode = response.status;
    const isRateLimit = statusCode === 429 ||
      errorText.toLowerCase().includes("rate") ||
      errorText.toLowerCase().includes("quota");
    const isAuthError = statusCode === 401 || statusCode === 403;

    log.error(this.config.providerName, "API request failed", {
      statusCode,
      isRateLimit,
      isAuthError,
    });

    throw createLLMError(
      `${this.config.providerName} API error: ${statusCode}`,
      this.config.providerName,
      { isRateLimit, isAuthError, statusCode }
    );
  }

  protected createAuthError(): never {
    throw createLLMError(
      `${this.config.providerName} API key not configured`,
      this.config.providerName,
      { isAuthError: true }
    );
  }
}
