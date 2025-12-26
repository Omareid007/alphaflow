/**
 * OpenAI Client - Minimal fetch-based OpenAI API client
 * 
 * Uses fetch to call the OpenAI HTTP API directly, NO SDK.
 * Supports chat completions with tool calling.
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

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 1000;
const DEFAULT_TEMPERATURE = 0.3;

interface OpenAIMessage {
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

interface OpenAIResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIClient implements LLMClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
    this.baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    this.defaultModel = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return "openai";
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw createLLMError("OpenAI API key not configured", "openai", { isAuthError: true });
    }

    const model = req.model || this.defaultModel;
    const messages: OpenAIMessage[] = [];

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

    if (req.responseFormat) {
      if (req.responseFormat.type === "json_object") {
        body.response_format = { type: "json_object" };
      } else if (req.responseFormat.type === "json_schema" && req.responseFormat.json_schema) {
        body.response_format = {
          type: "json_schema",
          json_schema: req.responseFormat.json_schema,
        };
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

        log.error("OpenAI", "API request failed", {
          statusCode,
          latencyMs,
          isRateLimit,
          isAuthError,
        });

        throw createLLMError(
          `OpenAI API error: ${statusCode}`,
          "openai",
          { isRateLimit, isAuthError, statusCode }
        );
      }

      const data = (await response.json()) as OpenAIResponse;
      const choice = data.choices[0];

      if (!choice) {
        throw createLLMError("OpenAI returned empty response", "openai");
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
            log.warn("OpenAI", "Failed to parse tool call arguments", {
              toolName: tc.function.name,
              error: String(parseError),
            });
          }
        }
      }

      log.ai("OpenAI call complete", {
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
      if ((error as { provider?: string }).provider === "openai") {
        throw error;
      }

      log.error("OpenAI", "Request failed", { error: String(error) });
      throw createLLMError(`OpenAI request failed: ${String(error)}`, "openai");
    }
  }
}

export const openaiClient = new OpenAIClient();
