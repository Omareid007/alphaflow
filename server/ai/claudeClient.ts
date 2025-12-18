/**
 * Claude Client - Minimal fetch-based Anthropic Claude API client
 * 
 * Uses fetch to call the Anthropic Claude HTTP API directly, NO SDK.
 * Supports chat completions with tool calling.
 * 
 * Note: Claude OAuth is NOT supported by Anthropic for API access.
 * Only API key authentication is available. OAuth only works for Claude Code CLI.
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

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.3;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

interface ClaudeToolResultContent {
  type: "text";
  text: string;
}

interface ClaudeToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: ClaudeToolResultContent[] | string;
}

interface ClaudeTextBlock {
  type: "text";
  text: string;
}

type ClaudeMessageContent = ClaudeTextBlock | ClaudeToolResult;

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ClaudeMessageContent[];
}

interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface ClaudeToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ClaudeTextContent {
  type: "text";
  text: string;
}

type ClaudeContentBlock = ClaudeTextContent | ClaudeToolUse;

interface ClaudeResponse {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: ClaudeContentBlock[];
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeClient implements LLMClient {
  private apiKey: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";
    this.defaultModel = process.env.CLAUDE_MODEL || DEFAULT_MODEL;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return "claude";
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw createLLMError(
        "Claude API key not configured. Set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.",
        "claude",
        { isAuthError: true }
      );
    }

    const model = req.model || this.defaultModel;
    const messages: ClaudeMessage[] = [];

    for (const msg of req.messages) {
      if (msg.role === "system") {
        continue;
      }

      if (msg.role === "tool") {
        const toolResultBlock: ClaudeToolResult = {
          type: "tool_result" as const,
          tool_use_id: msg.tool_call_id || "",
          content: [{ type: "text" as const, text: msg.content }],
        };
        
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === "user") {
          if (typeof lastMsg.content === "string") {
            lastMsg.content = [{ type: "text" as const, text: lastMsg.content }];
          }
          (lastMsg.content as ClaudeMessageContent[]).push(toolResultBlock);
        } else {
          messages.push({
            role: "user",
            content: [toolResultBlock],
          });
        }
      } else {
        messages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    const body: Record<string, unknown> = {
      model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages,
    };

    if (req.system) {
      body.system = req.system;
    }

    if (req.temperature !== undefined) {
      body.temperature = req.temperature;
    }

    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((tool): ClaudeTool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: {
          type: "object",
          properties: tool.function.parameters.properties,
          required: tool.function.parameters.required,
        },
      }));

      if (req.toolChoice) {
        if (req.toolChoice === "auto") {
          body.tool_choice = { type: "auto" };
        } else if (req.toolChoice === "none") {
          delete body.tools;
        } else if (typeof req.toolChoice === "object" && req.toolChoice.function) {
          body.tool_choice = { type: "tool", name: req.toolChoice.function.name };
        }
      }
    }

    const startTime = Date.now();

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        
        if (response.status === 401) {
          throw createLLMError(`Claude authentication failed: ${errorText}`, "claude", {
            isAuthError: true,
            statusCode: response.status,
          });
        }
        
        if (response.status === 429) {
          throw createLLMError(`Claude rate limit exceeded: ${errorText}`, "claude", {
            isRateLimit: true,
            statusCode: response.status,
          });
        }

        throw createLLMError(
          `Claude API error ${response.status}: ${errorText.substring(0, 200)}`,
          "claude",
          { statusCode: response.status }
        );
      }

      const data: ClaudeResponse = await response.json();
      const latencyMs = Date.now() - startTime;

      let text: string | undefined;
      const toolCalls: LLMToolCall[] = [];

      for (const block of data.content) {
        if (block.type === "text") {
          text = (text || "") + block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input,
          });
        }
      }

      log.debug("ClaudeClient", `Call completed in ${latencyMs}ms`, {
        model: data.model,
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        stopReason: data.stop_reason,
      });

      return {
        text,
        content: text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        raw: data,
        model: data.model,
        tokensUsed: {
          prompt: data.usage.input_tokens,
          completion: data.usage.output_tokens,
          total: data.usage.input_tokens + data.usage.output_tokens,
        },
      };
    } catch (error) {
      if ((error as any).provider === "claude") {
        throw error;
      }
      
      log.error("ClaudeClient", "API call failed", { error });
      throw createLLMError(
        `Claude API call failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "claude"
      );
    }
  }
}

export const claudeClient = new ClaudeClient();
