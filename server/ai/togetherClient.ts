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

import { log } from "../utils/logger";
import {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMToolCall,
  createLLMError,
} from "./llmClient";

const DEFAULT_MODEL = "meta-llama/Llama-3.2-3B-Instruct-Turbo";
const DEFAULT_MAX_TOKENS = 1000;
const DEFAULT_TEMPERATURE = 0.3;
const BASE_URL = "https://api.together.xyz/v1";

interface TogetherMessage {
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

interface TogetherResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: TogetherMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class TogetherClient implements LLMClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.TOGETHER_API_KEY || "";
    this.baseUrl = process.env.TOGETHER_BASE_URL || BASE_URL;
    this.defaultModel = process.env.TOGETHER_MODEL || DEFAULT_MODEL;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return "together";
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw createLLMError("Together.ai API key not configured", "together", { isAuthError: true });
    }

    const model = req.model || this.defaultModel;
    const messages: TogetherMessage[] = [];

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

        log.error("Together", "API request failed", {
          statusCode,
          latencyMs,
          isRateLimit,
          isAuthError,
        });

        throw createLLMError(
          `Together.ai API error: ${statusCode}`,
          "together",
          { isRateLimit, isAuthError, statusCode }
        );
      }

      const data = (await response.json()) as TogetherResponse;
      const choice = data.choices[0];

      if (!choice) {
        throw createLLMError("Together.ai returned empty response", "together");
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
            log.warn("Together", "Failed to parse tool call arguments", {
              toolName: tc.function.name,
              error: String(parseError),
            });
          }
        }
      }

      log.ai("Together.ai call complete", {
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
      if ((error as { provider?: string }).provider === "together") {
        throw error;
      }

      log.error("Together", "Request failed", { error: String(error) });
      throw createLLMError(`Together.ai request failed: ${String(error)}`, "together");
    }
  }
}

export const togetherClient = new TogetherClient();
