/**
 * Cloudflare Workers AI Client
 *
 * Integrates Cloudflare's Workers AI for low-latency inference at the edge.
 *
 * Free Tier:
 * - 10,000 neurons per day (free tier)
 * - Global edge deployment for low latency
 * - No cold starts
 *
 * Models available:
 * - @cf/meta/llama-3.1-8b-instruct
 * - @cf/meta/llama-3.2-1b-instruct
 * - @cf/mistral/mistral-7b-instruct-v0.2
 * - @cf/microsoft/phi-2
 *
 * Use cases:
 * - Real-time trading decisions (low latency required)
 * - Quick sentiment checks
 * - Fast market analysis
 */

import { LLMClient, LLMRequest, LLMResponse } from "./llmClient";
import { log } from "../utils/logger";

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const DEFAULT_TEMPERATURE = 0.3;

interface CloudflareMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CloudflareAIRequest {
  messages: CloudflareMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface CloudflareAIResponse {
  result: {
    response: string;
  };
  success: boolean;
  errors?: Array<{ message: string }>;
  messages?: Array<{ message: string }>;
}

export class CloudflareClient implements LLMClient {
  private accountId: string;
  private apiToken: string;
  private model: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || "";
    this.model = process.env.CLOUDFLARE_MODEL || DEFAULT_MODEL;

    if (this.accountId && this.apiToken) {
      log.info("CloudflareClient", `Initialized with model: ${this.model}`, {
        accountConfigured: true,
        tokenConfigured: true,
      });
    } else {
      log.warn("CloudflareClient", "Cloudflare credentials not configured - provider will be unavailable", {
        hasAccountId: !!this.accountId,
        hasApiToken: !!this.apiToken,
      });
    }
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw new Error("Cloudflare Workers AI credentials not configured");
    }

    const model = req.model || this.model;
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`;

    log.debug("CloudflareClient", "Preparing request", {
      model,
      systemPresent: !!req.system,
      messageCount: req.messages?.length || 0,
    });

    // Build messages array
    const messages: CloudflareMessage[] = [];

    // Add system message if present
    if (req.system) {
      messages.push({
        role: "system",
        content: req.system,
      });
    }

    // Add conversation messages
    if (req.messages && req.messages.length > 0) {
      for (const msg of req.messages) {
        if (msg.role === "tool") {
          // Cloudflare doesn't support tool messages, skip
          continue;
        }
        messages.push({
          role: msg.role === "system" ? "system" : msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    const cloudflareRequest: CloudflareAIRequest = {
      messages,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
      stream: false,
    };

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cloudflareRequest),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        log.error("CloudflareClient", "API request failed", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          latency,
        });

        // Parse error for better messages
        let errorMessage = `Cloudflare API error ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.errors && errorData.errors.length > 0) {
            errorMessage = errorData.errors[0].message;
          }
        } catch {
          // Use default error message
        }

        throw new Error(errorMessage);
      }

      const data: CloudflareAIResponse = await response.json();

      if (!data.success) {
        const errorMsg = data.errors?.[0]?.message || "Unknown Cloudflare error";
        log.error("CloudflareClient", "API returned unsuccessful response", {
          error: errorMsg,
          latency,
        });
        throw new Error(errorMsg);
      }

      const content = data.result.response;

      // Cloudflare doesn't provide token counts in response
      // Estimate based on content length (rough approximation)
      const estimatedTokens = Math.ceil((req.system || "").length / 4) +
                             Math.ceil(req.messages.map(m => m.content).join("").length / 4) +
                             Math.ceil(content.length / 4);

      log.info("CloudflareClient", "Request successful", {
        model,
        latency,
        responseLength: content.length,
        estimatedTokens,
      });

      return {
        content,
        model,
        provider: "cloudflare",
        usage: {
          promptTokens: 0, // Cloudflare doesn't provide this
          completionTokens: 0,
          totalTokens: estimatedTokens, // Rough estimate
        },
        latencyMs: latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      log.error("CloudflareClient", "Request failed", {
        error: (error as Error).message,
        latency,
        model,
      });
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.accountId && !!this.apiToken;
  }

  getProviderName(): string {
    return "cloudflare";
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Get available Cloudflare AI models
   */
  getAvailableModels(): string[] {
    return [
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/meta/llama-3.2-1b-instruct",
      "@cf/meta/llama-3.2-3b-instruct",
      "@cf/mistral/mistral-7b-instruct-v0.2",
      "@cf/microsoft/phi-2",
      "@cf/qwen/qwen1.5-7b-chat-awq",
    ];
  }

  /**
   * Check Cloudflare Workers AI health
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const response = await this.call({
        system: "You are a helpful assistant. Respond with 'OK'.",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 0,
        maxTokens: 10,
      });

      return response.content.toLowerCase().includes("ok");
    } catch (error) {
      log.error("CloudflareClient", "Health check failed", {
        error: (error as Error).message,
      });
      return false;
    }
  }
}

// Export singleton instance
export const cloudflareClient = new CloudflareClient();
