/**
 * Hugging Face Inference API Client
 *
 * Integrates Hugging Face's Inference API for access to 100,000+ open-source models.
 *
 * Free Tier:
 * - Rate-limited but free for most small/medium models
 * - No hard daily limit, but requests are queued
 * - Serverless inference with automatic scaling
 *
 * Models available:
 * - Text generation: meta-llama/Llama-3.2-3B-Instruct, mistralai/Mistral-7B-Instruct-v0.2
 * - Sentiment: cardiffnlp/twitter-roberta-base-sentiment-latest
 * - Named Entity Recognition: dslim/bert-base-NER
 * - Zero-shot classification: facebook/bart-large-mnli
 *
 * Use cases:
 * - Specialized models for sentiment analysis
 * - Named entity recognition in financial news
 * - Zero-shot classification of market events
 * - Access to latest open-source models
 */

import { LLMClient, LLMRequest, LLMResponse } from "./llmClient";
import { log } from "../utils/logger";

const DEFAULT_MODEL = "meta-llama/Llama-3.2-3B-Instruct";
const DEFAULT_TEMPERATURE = 0.3;
const HF_API_BASE = "https://api-inference.huggingface.co/models";

interface HuggingFaceMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface HuggingFaceTextGenRequest {
  inputs: string;
  parameters?: {
    max_new_tokens?: number;
    temperature?: number;
    top_p?: number;
    return_full_text?: boolean;
  };
}

interface HuggingFaceChatRequest {
  messages: HuggingFaceMessage[];
  max_tokens?: number;
  temperature?: number;
}

type HuggingFaceTextGenResponse = Array<{
  generated_text: string;
}>;

interface HuggingFaceChatResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class HuggingFaceClient implements LLMClient {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || "";
    this.model = process.env.HUGGINGFACE_MODEL || DEFAULT_MODEL;

    if (this.apiKey) {
      log.info("HuggingFaceClient", `Initialized with model: ${this.model}`, {
        apiKeyConfigured: true,
      });
    } else {
      log.warn("HuggingFaceClient", "No API key configured - HuggingFace provider will be unavailable");
    }
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error("HuggingFace API key not configured");
    }

    const model = req.model || this.model;
    const url = `${HF_API_BASE}/${model}`;

    log.debug("HuggingFaceClient", "Preparing request", {
      model,
      messageCount: req.messages?.length || 0,
    });

    // Determine if model supports chat format or text generation
    const isChatModel = model.includes("chat") || model.includes("instruct") || model.includes("Instruct");

    let requestBody: any;

    if (isChatModel && req.messages) {
      // Use chat format for chat/instruct models
      const messages: HuggingFaceMessage[] = [];

      if (req.system) {
        messages.push({ role: "system", content: req.system });
      }

      for (const msg of req.messages) {
        if (msg.role === "tool") continue; // Skip tool messages
        messages.push({
          role: msg.role === "system" ? "system" : msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }

      requestBody = {
        messages,
        max_tokens: req.maxTokens ?? 2048,
        temperature: req.temperature ?? DEFAULT_TEMPERATURE,
      };
    } else {
      // Use text generation format for base models
      const prompt = req.system
        ? `${req.system}\n\n${req.messages.map(m => m.content).join("\n")}`
        : req.messages.map(m => m.content).join("\n");

      requestBody = {
        inputs: prompt,
        parameters: {
          max_new_tokens: req.maxTokens ?? 512,
          temperature: req.temperature ?? DEFAULT_TEMPERATURE,
          top_p: 0.95,
          return_full_text: false,
        },
      };
    }

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        log.error("HuggingFaceClient", "API request failed", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          latency,
        });

        // Handle specific error cases
        if (response.status === 503) {
          throw new Error("Model is loading, please retry in a few seconds");
        } else if (response.status === 429) {
          throw new Error("Rate limit exceeded");
        } else {
          throw new Error(`HuggingFace API error ${response.status}: ${errorText}`);
        }
      }

      const data = await response.json();

      let content: string;
      let usage: any = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      if (isChatModel && data.choices) {
        // Chat format response
        const chatData = data as HuggingFaceChatResponse;
        content = chatData.choices[0].message.content;
        if (chatData.usage) {
          usage = {
            promptTokens: chatData.usage.prompt_tokens,
            completionTokens: chatData.usage.completion_tokens,
            totalTokens: chatData.usage.total_tokens,
          };
        }
      } else if (Array.isArray(data)) {
        // Text generation format response
        const textGenData = data as HuggingFaceTextGenResponse;
        content = textGenData[0].generated_text;

        // Estimate tokens (HF text gen doesn't provide counts)
        const inputText = req.system
          ? `${req.system}\n\n${req.messages.map(m => m.content).join("\n")}`
          : req.messages.map(m => m.content).join("\n");
        usage = {
          promptTokens: Math.ceil(inputText.length / 4),
          completionTokens: Math.ceil(content.length / 4),
          totalTokens: Math.ceil((inputText.length + content.length) / 4),
        };
      } else {
        throw new Error("Unexpected response format from HuggingFace");
      }

      log.info("HuggingFaceClient", "Request successful", {
        model,
        latency,
        responseLength: content.length,
        totalTokens: usage.totalTokens,
      });

      return {
        text: content,
        content,
        model,
        raw: {
          provider: "huggingface",
          latencyMs: latency,
        },
        tokensUsed: {
          prompt: usage.promptTokens,
          completion: usage.completionTokens,
          total: usage.totalTokens,
        },
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      log.error("HuggingFaceClient", "Request failed", {
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
    return "huggingface";
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Get popular Hugging Face models for different tasks
   */
  getAvailableModels(): {
    textGeneration: string[];
    sentiment: string[];
    ner: string[];
    classification: string[];
  } {
    return {
      textGeneration: [
        "meta-llama/Llama-3.2-3B-Instruct",
        "meta-llama/Llama-3.2-1B-Instruct",
        "mistralai/Mistral-7B-Instruct-v0.2",
        "microsoft/phi-2",
        "google/gemma-2b-it",
      ],
      sentiment: [
        "cardiffnlp/twitter-roberta-base-sentiment-latest",
        "finiteautomata/bertweet-base-sentiment-analysis",
        "ProsusAI/finbert",
      ],
      ner: [
        "dslim/bert-base-NER",
        "Jean-Baptiste/camembert-ner",
      ],
      classification: [
        "facebook/bart-large-mnli",
        "cross-encoder/nli-deberta-v3-base",
      ],
    };
  }

  /**
   * Call specialized sentiment model
   */
  async analyzeSentiment(text: string): Promise<{ label: string; score: number }> {
    const sentimentModel = "cardiffnlp/twitter-roberta-base-sentiment-latest";
    const url = `${HF_API_BASE}/${sentimentModel}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) {
      throw new Error(`Sentiment analysis failed: ${response.status}`);
    }

    const data = await response.json();
    // Returns: [{ label: "positive", score: 0.95 }, ...]
    const topResult = Array.isArray(data) && Array.isArray(data[0])
      ? data[0][0]
      : data[0];

    return {
      label: topResult.label.toLowerCase(),
      score: topResult.score,
    };
  }

  /**
   * Check HuggingFace API health
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const response = await this.call({
        system: "You are a helpful assistant.",
        messages: [{ role: "user", content: "Say 'OK'" }],
        temperature: 0,
        maxTokens: 10,
      });

      return (response.content || response.text || "").toLowerCase().includes("ok");
    } catch (error) {
      log.error("HuggingFaceClient", "Health check failed", {
        error: (error as Error).message,
      });
      return false;
    }
  }
}

// Export singleton instance
export const huggingfaceClient = new HuggingFaceClient();
