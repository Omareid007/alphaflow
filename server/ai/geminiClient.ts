/**
 * Google Gemini AI Client
 *
 * Integrates Google's Gemini API (gemini-2.5-flash, gemini-2.5-flash-lite, etc.)
 * for cost-effective LLM inference.
 *
 * Free Tier (as of Dec 2025):
 * - Gemini 2.5 Flash-Lite: 15 RPM, 250K TPM, 1,000 requests/day
 * - Gemini 2.5 Flash: 10 RPM, 250K TPM, 250 requests/day
 * - Gemini 2.5 Pro: 5 RPM, 250K TPM, 100 requests/day
 * - Context window: Up to 1M tokens
 * - No expiration, no credit card required
 *
 * Use cases:
 * - News summarization (low cost, sufficient quality)
 * - Sentiment analysis (1M context for processing lots of news)
 * - Post-trade reporting
 * - Market commentary generation
 */

import { LLMClient, LLMRequest, LLMResponse, LLMTool } from "./llmClient";
import { log } from "../utils/logger";

const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiContent {
  parts: Array<{ text: string }>;
  role?: string;
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GeminiClient implements LLMClient {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey =
      process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
    this.model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    if (this.apiKey) {
      log.info("GeminiClient", `Initialized with model: ${this.model}`, {
        apiKeyConfigured: true,
        freeModel:
          this.model.includes("flash-lite") || this.model.includes("flash"),
      });
    } else {
      log.warn(
        "GeminiClient",
        "No API key configured - Gemini provider will be unavailable"
      );
    }
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const model = req.model || this.model;
    const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${this.apiKey}`;

    // Extract user message content from messages array
    const userContent = req.messages.map((m) => m.content).join("\n");

    log.debug("GeminiClient", "Preparing request", {
      model,
      systemPromptLength: req.system?.length || 0,
      userPromptLength: userContent.length,
      temperature: req.temperature,
    });

    // Build Gemini request
    const contents: GeminiContent[] = [];

    // Gemini doesn't have a separate system message - combine with user message
    if (req.system) {
      contents.push({
        parts: [{ text: `${req.system}\n\n${userContent}` }],
        role: "user",
      });
    } else {
      contents.push({
        parts: [{ text: userContent }],
        role: "user",
      });
    }

    const geminiRequest: GeminiRequest = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? DEFAULT_TEMPERATURE,
        maxOutputTokens: req.maxTokens ?? 2048,
        topP: 0.95,
      },
      // Disable safety filters for trading/financial content
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
      ],
    };

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geminiRequest),
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        log.error("GeminiClient", "API request failed", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          latency,
        });
        throw new Error(`Gemini API error ${response.status}: ${errorText}`);
      }

      const data: GeminiResponse = await response.json();

      // Handle blocked content
      if (!data.candidates || data.candidates.length === 0) {
        log.warn(
          "GeminiClient",
          "No candidates in response (possibly blocked)",
          {
            latency,
          }
        );
        throw new Error("Gemini response blocked by safety filters");
      }

      const candidate = data.candidates[0];
      const content = candidate.content.parts.map((p) => p.text).join("");

      // Check finish reason
      if (candidate.finishReason && candidate.finishReason !== "STOP") {
        log.warn(
          "GeminiClient",
          `Response finished with reason: ${candidate.finishReason}`,
          {
            finishReason: candidate.finishReason,
            contentLength: content.length,
          }
        );
      }

      const usage = data.usageMetadata || {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
      };

      log.info("GeminiClient", "Request successful", {
        model,
        latency,
        promptTokens: usage.promptTokenCount,
        completionTokens: usage.candidatesTokenCount,
        totalTokens: usage.totalTokenCount,
        finishReason: candidate.finishReason,
      });

      return {
        text: content,
        content,
        model,
        raw: {
          provider: "gemini",
          finishReason: candidate.finishReason,
          latencyMs: latency,
        },
        tokensUsed: {
          prompt: usage.promptTokenCount,
          completion: usage.candidatesTokenCount,
          total: usage.totalTokenCount,
        },
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      log.error("GeminiClient", "Request failed", {
        error: (error as Error).message,
        latency,
        model,
      });
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return "gemini";
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Get available Gemini models
   */
  getAvailableModels(): string[] {
    return [
      "gemini-2.5-flash-lite", // Free tier optimized
      "gemini-2.5-flash", // Balanced
      "gemini-2.5-pro", // Highest quality
      "gemini-3-flash-preview", // Latest preview
    ];
  }

  /**
   * Check Gemini API health
   */
  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await this.call({
        system: "You are a helpful assistant. Respond with 'OK'.",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 0,
        maxTokens: 10,
      });

      return (response.content || response.text || "")
        .toLowerCase()
        .includes("ok");
    } catch (error) {
      log.error("GeminiClient", "Health check failed", {
        error: (error as Error).message,
      });
      return false;
    }
  }
}

// Export singleton instance
export const geminiClient = new GeminiClient();
