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
const BASE_URL = "https://api.aimlapi.com/v1";

interface AIMLMessage {
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

interface AIMLResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: AIMLMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AIMLClient implements LLMClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.AIMLAPI_KEY || "";
    this.baseUrl = process.env.AIMLAPI_BASE_URL || BASE_URL;
    this.defaultModel = process.env.AIMLAPI_MODEL || DEFAULT_MODEL;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return "aimlapi";
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw createLLMError("AIML API key not configured", "aimlapi", { isAuthError: true });
    }

    const model = req.model || this.defaultModel;
    const messages: AIMLMessage[] = [];

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

        log.error("AIMLAPI", "API request failed", {
          statusCode,
          latencyMs,
          isRateLimit,
          isAuthError,
        });

        throw createLLMError(
          `AIML API error: ${statusCode}`,
          "aimlapi",
          { isRateLimit, isAuthError, statusCode }
        );
      }

      const data = (await response.json()) as AIMLResponse;
      const choice = data.choices[0];

      if (!choice) {
        throw createLLMError("AIML API returned empty response", "aimlapi");
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
            log.warn("AIMLAPI", "Failed to parse tool call arguments", {
              toolName: tc.function.name,
              error: String(parseError),
            });
          }
        }
      }

      log.ai("AIML API call complete", {
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
      if ((error as { provider?: string }).provider === "aimlapi") {
        throw error;
      }

      log.error("AIMLAPI", "Request failed", { error: String(error) });
      throw createLLMError(`AIML API request failed: ${String(error)}`, "aimlapi");
    }
  }
}

export const aimlClient = new AIMLClient();
