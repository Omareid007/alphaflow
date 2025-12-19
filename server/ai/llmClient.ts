/**
 * LLMClient - Minimal, provider-agnostic LLM abstraction
 * 
 * This module defines a simple interface for LLM interactions that:
 * - Works with OpenAI as primary provider
 * - Supports OpenRouter as optional secondary provider
 * - Uses NO external LLM frameworks (no langchain, llamaindex, etc.)
 * - Is restricted to SAFE, READ-ONLY helper tasks
 * 
 * @see docs/AI_MODELS_AND_PROVIDERS.md for usage guidelines
 * @see docs/AGENT_EXECUTION_GUIDE.md Section 14 for governance
 */

// Note: Claude models are accessed via OpenRouter provider, not a separate claude provider
export type LLMProvider = "openai" | "openrouter" | "groq" | "together" | "aimlapi";

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface LLMTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

export interface LLMToolChoice {
  type: "function";
  function: { name: string };
}

export interface ResponseFormat {
  type: "json_object" | "json_schema";
  json_schema?: {
    name: string;
    schema: object;
    strict?: boolean;
  };
}

export interface LLMRequest {
  model?: string;
  system?: string;
  messages: LLMMessage[];
  tools?: LLMTool[];
  toolChoice?: "auto" | "none" | LLMToolChoice;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: ResponseFormat;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  text?: string;
  content?: string;
  toolCalls?: LLMToolCall[];
  raw: unknown;
  model?: string;
  tokensUsed?: {
    prompt?: number;
    completion?: number;
    total?: number;
  } | number;
}

export interface LLMClient {
  call(req: LLMRequest): Promise<LLMResponse>;
  isAvailable(): boolean;
  getProviderName(): string;
}

export interface LLMClientError extends Error {
  provider: string;
  isRateLimit: boolean;
  isAuthError: boolean;
  statusCode?: number;
}

export function createLLMError(
  message: string,
  provider: string,
  opts: { isRateLimit?: boolean; isAuthError?: boolean; statusCode?: number } = {}
): LLMClientError {
  const error = new Error(message) as LLMClientError;
  error.provider = provider;
  error.isRateLimit = opts.isRateLimit ?? false;
  error.isAuthError = opts.isAuthError ?? false;
  error.statusCode = opts.statusCode;
  return error;
}
