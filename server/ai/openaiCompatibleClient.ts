/**
 * OpenAI-Compatible Client - Base class for OpenAI-format API providers
 *
 * Supports: OpenAI, Groq, Together, AIML, OpenRouter
 * All use the same /chat/completions endpoint format
 */

import { log } from "../utils/logger";
import {
  LLMRequest,
  LLMResponse,
  LLMToolCall,
  createLLMError,
} from "./llmClient";
import { BaseLLMClient, BaseLLMClientConfig } from "./baseLLMClient";

interface OpenAICompatibleMessage {
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

interface OpenAICompatibleResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAICompatibleMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAICompatibleConfig extends BaseLLMClientConfig {
  extraHeaders?: Record<string, string>;
}

export class OpenAICompatibleClient extends BaseLLMClient {
  protected extraHeaders: Record<string, string>;

  constructor(config: OpenAICompatibleConfig) {
    super(config);
    this.extraHeaders = config.extraHeaders || {};
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      this.createAuthError();
    }

    const model = req.model || this.defaultModel;
    const messages = this.buildMessages(req);
    const body = this.buildRequestBody(req, model, messages);

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...this.extraHeaders,
        },
        body: JSON.stringify(body),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        this.handleHttpError(response, errorText);
      }

      const data = (await response.json()) as OpenAICompatibleResponse;
      return this.parseResponse(data, latencyMs, model);
    } catch (error) {
      if (
        (error as { provider?: string }).provider === this.config.providerName
      ) {
        throw error;
      }

      log.error(this.config.providerName, "Request failed", {
        error: String(error),
      });
      throw createLLMError(
        `${this.config.providerName} request failed: ${String(error)}`,
        this.config.providerName
      );
    }
  }

  protected buildMessages(req: LLMRequest): OpenAICompatibleMessage[] {
    const messages: OpenAICompatibleMessage[] = [];

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

    return messages;
  }

  protected buildRequestBody(
    req: LLMRequest,
    model: string,
    messages: OpenAICompatibleMessage[]
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: req.maxTokens ?? this.config.defaultMaxTokens ?? 1000,
      temperature: req.temperature ?? this.config.defaultTemperature ?? 0.3,
    };

    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools;
      if (req.toolChoice) {
        body.tool_choice = req.toolChoice;
      }
    }

    if (req.responseFormat) {
      body.response_format = req.responseFormat;
    }

    return body;
  }

  protected parseResponse(
    data: OpenAICompatibleResponse,
    latencyMs: number,
    model: string
  ): LLMResponse {
    const choice = data.choices[0];

    if (!choice) {
      throw createLLMError(
        `${this.config.providerName} returned empty response`,
        this.config.providerName
      );
    }

    const message = choice.message;
    const toolCalls = this.parseToolCalls(message.tool_calls);

    log.ai(`${this.config.providerName} call complete`, {
      model: data.model || model,
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
  }

  protected parseToolCalls(
    toolCalls?: OpenAICompatibleMessage["tool_calls"]
  ): LLMToolCall[] {
    if (!toolCalls) return [];

    const parsed: LLMToolCall[] = [];
    for (const tc of toolCalls) {
      try {
        const args = JSON.parse(tc.function.arguments);
        parsed.push({
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        });
      } catch (parseError) {
        log.warn(
          this.config.providerName,
          "Failed to parse tool call arguments",
          {
            toolName: tc.function.name,
            error: String(parseError),
          }
        );
      }
    }
    return parsed;
  }
}
