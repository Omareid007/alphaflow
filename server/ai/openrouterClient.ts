/**
 * OpenRouter Client - Minimal fetch-based OpenRouter API client
 * 
 * Uses fetch to call OpenRouter's OpenAI-compatible API.
 * Provides access to multiple LLM providers through a single interface.
 * 
 * @see docs/AI_MODELS_AND_PROVIDERS.md
 */

import { log } from "../utils/logger";
import {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMToolCall,
  createLLMError,
} from "./llmClient";

const DEFAULT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 1000;
const DEFAULT_TEMPERATURE = 0.3;
const BASE_URL = "https://openrouter.ai/api/v1";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: OpenRouterMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterClient implements LLMClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
    this.baseUrl = process.env.OPENROUTER_BASE_URL || BASE_URL;
    this.defaultModel = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return "openrouter";
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw createLLMError("OpenRouter API key not configured", "openrouter", { isAuthError: true });
    }

    const model = req.model || this.defaultModel;
    const messages: OpenRouterMessage[] = [];

    if (req.system) {
      messages.push({ role: "system", content: req.system });
    }

    for (const msg of req.messages) {
      messages.push({
        role: msg.role,
        content: msg.content,
        tool_call_id: msg.tool_call_id,
        name: msg.name,
      });
    }

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
    };

    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools;
      if (req.toolChoice) {
        body.tool_choice = req.toolChoice;
      }
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": process.env.REPLIT_DEV_DOMAIN || "https://replit.com",
          "X-Title": "AI Active Trader",
        },
        body: JSON.stringify(body),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        const statusCode = response.status;

        const isRateLimit = statusCode === 429 ||
          errorText.toLowerCase().includes("rate") ||
          errorText.toLowerCase().includes("quota");

        const isAuthError = statusCode === 401 || statusCode === 403;

        log.error("OpenRouter", "API request failed", {
          statusCode,
          latencyMs,
          isRateLimit,
          isAuthError,
        });

        throw createLLMError(
          `OpenRouter API error: ${statusCode}`,
          "openrouter",
          { isRateLimit, isAuthError, statusCode }
        );
      }

      const data = (await response.json()) as OpenRouterResponse;
      const choice = data.choices[0];

      if (!choice) {
        throw createLLMError("OpenRouter returned empty response", "openrouter");
      }

      const message = choice.message;
      const toolCalls: LLMToolCall[] = [];

      if (message.tool_calls) {
        for (const tc of message.tool_calls) {
          try {
            const args = JSON.parse(tc.function.arguments);
            toolCalls.push({
              id: tc.id,
              name: tc.function.name,
              arguments: args,
            });
          } catch (parseError) {
            log.warn("OpenRouter", "Failed to parse tool call arguments", {
              toolName: tc.function.name,
              error: String(parseError),
            });
          }
        }
      }

      log.ai("OpenRouter call complete", {
        model,
        tokensUsed: data.usage?.total_tokens,
        latencyMs,
        hasToolCalls: toolCalls.length > 0,
      });

      return {
        text: message.content ?? undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        raw: data,
        model: data.model,
        tokensUsed: data.usage?.total_tokens,
      };
    } catch (error) {
      if ((error as { provider?: string }).provider === "openrouter") {
        throw error;
      }

      log.error("OpenRouter", "Request failed", { error: String(error) });
      throw createLLMError(`OpenRouter request failed: ${String(error)}`, "openrouter");
    }
  }
}

export const openrouterClient = new OpenRouterClient();
