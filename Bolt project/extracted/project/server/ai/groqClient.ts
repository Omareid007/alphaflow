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

import { log } from "../utils/logger";
import {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMToolCall,
  createLLMError,
} from "./llmClient";

const DEFAULT_MODEL = "llama-3.1-8b-instant";
const DEFAULT_MAX_TOKENS = 1000;
const DEFAULT_TEMPERATURE = 0.3;
const BASE_URL = "https://api.groq.com/openai/v1";

interface GroqMessage {
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

interface GroqResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: GroqMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class GroqClient implements LLMClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || "";
    this.baseUrl = process.env.GROQ_BASE_URL || BASE_URL;
    this.defaultModel = process.env.GROQ_MODEL || DEFAULT_MODEL;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return "groq";
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw createLLMError("Groq API key not configured", "groq", { isAuthError: true });
    }

    const model = req.model || this.defaultModel;
    const messages: GroqMessage[] = [];

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

        log.error("Groq", "API request failed", {
          statusCode,
          latencyMs,
          isRateLimit,
          isAuthError,
        });

        throw createLLMError(
          `Groq API error: ${statusCode}`,
          "groq",
          { isRateLimit, isAuthError, statusCode }
        );
      }

      const data = (await response.json()) as GroqResponse;
      const choice = data.choices[0];

      if (!choice) {
        throw createLLMError("Groq returned empty response", "groq");
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
            log.warn("Groq", "Failed to parse tool call arguments", {
              toolName: tc.function.name,
              error: String(parseError),
            });
          }
        }
      }

      log.ai("Groq call complete", {
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
      if ((error as { provider?: string }).provider === "groq") {
        throw error;
      }

      log.error("Groq", "Request failed", { error: String(error) });
      throw createLLMError(`Groq request failed: ${String(error)}`, "groq");
    }
  }
}

export const groqClient = new GroqClient();
