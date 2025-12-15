/**
 * LLM Gateway - Centralized entry point for ALL LLM calls
 * 
 * This module provides a single, policy-driven interface for LLM requests:
 * - Criticality-based routing (low/medium/high)
 * - TraceId propagation for full observability
 * - Structured output support (JSON schema)
 * - Role-based model selection with fallback chains
 * - Unified logging and cost tracking
 * 
 * NO direct OpenAI or provider usage should happen outside this gateway.
 * 
 * @see docs/AI_MODELS_AND_PROVIDERS.md for routing policies
 * @see docs/OBSERVABILITY.md for traceability
 */

import { randomUUID } from "crypto";
import { log } from "../utils/logger";
import { db } from "../db";
import { llmCalls, type LLMRole, type InsertLlmCall } from "@shared/schema";
import { LLMRequest, LLMResponse, LLMMessage, LLMTool, LLMToolChoice } from "./llmClient";
import { openaiClient } from "./openaiClient";
import { openrouterClient } from "./openrouterClient";
import { groqClient } from "./groqClient";
import { togetherClient } from "./togetherClient";
import { aimlClient } from "./aimlClient";

// ============================================================================
// TYPES
// ============================================================================

export type Criticality = "low" | "medium" | "high";

export interface ResponseFormat {
  type: "json_object" | "json_schema";
  json_schema?: {
    name: string;
    schema: object;
    strict?: boolean;
  };
}

export interface LLMGatewayRequest {
  role: LLMRole;
  criticality: Criticality;
  purpose: string;
  traceId: string;
  userId?: string;
  sessionId?: string;
  symbol?: string;
  system?: string;
  messages: LLMMessage[];
  tools?: LLMTool[];
  toolChoice?: "auto" | "none" | LLMToolChoice;
  responseFormat?: ResponseFormat;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMGatewayResponse {
  text?: string;
  json?: unknown;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  provider: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  traceId: string;
  estimatedCost: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
}

// ============================================================================
// MODEL CHAINS BY CRITICALITY
// ============================================================================

interface ModelConfig {
  provider: string;
  model: string;
  costPer1kTokens: number;
}

// Environment overrides for model chains
const getEnvModel = (key: string): string | undefined => process.env[key];

const CRITICALITY_CHAINS: Record<LLMRole, Record<Criticality, ModelConfig[]>> = {
  technical_analyst: {
    high: [
      { provider: "openrouter", model: getEnvModel("TECH_ANALYST_HIGH_MODEL") || "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
      { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", costPer1kTokens: 0.003 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
    medium: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "openrouter", model: "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
    ],
    low: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
    ],
  },
  risk_manager: {
    high: [
      { provider: "openrouter", model: getEnvModel("RISK_MANAGER_HIGH_MODEL") || "anthropic/claude-3.5-sonnet", costPer1kTokens: 0.003 },
      { provider: "openrouter", model: "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
    medium: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", costPer1kTokens: 0.003 },
    ],
    low: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
    ],
  },
  execution_planner: {
    high: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", costPer1kTokens: 0.003 },
    ],
    medium: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.1-70b-versatile", costPer1kTokens: 0.00059 },
    ],
    low: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
    ],
  },
  market_news_summarizer: {
    high: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.3-70b-versatile", costPer1kTokens: 0.00059 },
    ],
    medium: [
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
      { provider: "together", model: "meta-llama/Llama-3.2-3B-Instruct-Turbo", costPer1kTokens: 0.0001 },
    ],
    low: [
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
      { provider: "together", model: "meta-llama/Llama-3.2-3B-Instruct-Turbo", costPer1kTokens: 0.0001 },
    ],
  },
  post_trade_reporter: {
    high: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
    ],
    medium: [
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
      { provider: "together", model: "meta-llama/Llama-3.2-3B-Instruct-Turbo", costPer1kTokens: 0.0001 },
    ],
    low: [
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
      { provider: "together", model: "meta-llama/Llama-3.2-3B-Instruct-Turbo", costPer1kTokens: 0.0001 },
    ],
  },
};

// ============================================================================
// PROVIDER CLIENTS
// ============================================================================

const PROVIDER_CLIENTS: Record<string, { client: any; isAvailable: () => boolean }> = {
  openai: { client: openaiClient, isAvailable: () => openaiClient.isAvailable() },
  groq: { client: groqClient, isAvailable: () => groqClient.isAvailable() },
  together: { client: togetherClient, isAvailable: () => togetherClient.isAvailable() },
  aimlapi: { client: aimlClient, isAvailable: () => aimlClient.isAvailable() },
  openrouter: { client: openrouterClient, isAvailable: () => openrouterClient.isAvailable() },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function estimateCost(tokens: number, costPer1kTokens: number): number {
  return (tokens / 1000) * costPer1kTokens;
}

function getModelChain(role: LLMRole, criticality: Criticality): ModelConfig[] {
  const roleChains = CRITICALITY_CHAINS[role];
  if (!roleChains) {
    return CRITICALITY_CHAINS.technical_analyst[criticality];
  }
  return roleChains[criticality] || roleChains.medium;
}

async function logCall(callData: InsertLlmCall & { traceId?: string; criticality?: string; purpose?: string }): Promise<void> {
  try {
    const metadata = JSON.stringify({
      traceId: callData.traceId,
      criticality: callData.criticality,
      purpose: callData.purpose,
    });
    await db.insert(llmCalls).values({
      ...callData,
      metadata,
    } as InsertLlmCall);
  } catch (error) {
    log.warn("LLMGateway", "Failed to log LLM call", { error: String(error) });
  }
}

function parseJsonFromText(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function extractTokenCount(tokensUsed: LLMResponse["tokensUsed"]): number {
  if (typeof tokensUsed === "number") {
    return tokensUsed;
  }
  if (tokensUsed && typeof tokensUsed === "object") {
    return tokensUsed.total || 0;
  }
  return 0;
}

// ============================================================================
// MAIN GATEWAY FUNCTION
// ============================================================================

/**
 * Unified LLM Gateway - All LLM calls should go through this function
 * 
 * @param req - Gateway request with role, criticality, traceId, and standard LLM params
 * @returns Gateway response with text, json, toolCalls, and tracing metadata
 * 
 * @example
 * ```typescript
 * const response = await callLLM({
 *   role: "technical_analyst",
 *   criticality: "high",
 *   purpose: "analyze_trade_opportunity",
 *   traceId: crypto.randomUUID(),
 *   system: "You are an expert trading analyst.",
 *   messages: [{ role: "user", content: "Analyze AAPL" }],
 * });
 * ```
 */
export async function callLLM(req: LLMGatewayRequest): Promise<LLMGatewayResponse> {
  const startTime = Date.now();
  const chain = getModelChain(req.role, req.criticality);
  
  let fallbackUsed = false;
  let fallbackReason: string | undefined;
  let lastError: Error | undefined;
  
  for (let i = 0; i < chain.length; i++) {
    const modelConfig = chain[i];
    const providerEntry = PROVIDER_CLIENTS[modelConfig.provider];
    
    if (!providerEntry || !providerEntry.isAvailable()) {
      if (i === 0) {
        fallbackUsed = true;
        fallbackReason = `Primary provider ${modelConfig.provider} not available`;
      }
      continue;
    }
    
    try {
      const llmRequest: LLMRequest & { responseFormat?: ResponseFormat } = {
        model: modelConfig.model,
        system: req.system,
        messages: req.messages,
        tools: req.tools,
        toolChoice: req.toolChoice,
        maxTokens: req.maxTokens,
        temperature: req.temperature,
        responseFormat: req.responseFormat,
      };
      
      const response: LLMResponse = await providerEntry.client.call(llmRequest);
      const latencyMs = Date.now() - startTime;
      const tokensUsed = extractTokenCount(response.tokensUsed);
      const estimatedCost = estimateCost(tokensUsed, modelConfig.costPer1kTokens);
      
      let jsonResponse: unknown | null = null;
      if (req.responseFormat && response.text) {
        jsonResponse = parseJsonFromText(response.text);
      }
      
      await logCall({
        role: req.role,
        provider: modelConfig.provider,
        model: modelConfig.model,
        promptTokens: null,
        completionTokens: null,
        totalTokens: tokensUsed || null,
        estimatedCost: estimatedCost.toFixed(6),
        latencyMs,
        status: "success",
        systemPrompt: req.system || null,
        userPrompt: req.messages.map(m => m.content).join("\n").slice(0, 2000),
        response: response.text?.slice(0, 2000) || null,
        cacheHit: false,
        fallbackUsed,
        fallbackReason: fallbackReason || null,
        traceId: req.traceId,
        criticality: req.criticality,
        purpose: req.purpose,
      });
      
      log.ai(`LLMGateway: ${req.role}/${req.criticality} succeeded`, {
        role: req.role,
        criticality: req.criticality,
        purpose: req.purpose,
        traceId: req.traceId,
        provider: modelConfig.provider,
        model: modelConfig.model,
        tokensUsed,
        estimatedCost,
        latencyMs,
        fallbackUsed,
      });
      
      return {
        text: response.text,
        json: jsonResponse,
        toolCalls: response.toolCalls,
        provider: modelConfig.provider,
        model: modelConfig.model,
        tokensUsed,
        latencyMs,
        traceId: req.traceId,
        estimatedCost,
        fallbackUsed,
        fallbackReason,
      };
    } catch (error) {
      lastError = error as Error;
      const errorMsg = (error as Error).message || String(error);
      
      log.warn("LLMGateway", `${modelConfig.provider}/${modelConfig.model} failed for ${req.role}`, {
        traceId: req.traceId,
        criticality: req.criticality,
        purpose: req.purpose,
        error: errorMsg,
      });
      
      if (i === 0) {
        fallbackUsed = true;
        fallbackReason = errorMsg.includes("rate") || errorMsg.includes("429")
          ? "Rate limit exceeded"
          : errorMsg.includes("401") || errorMsg.includes("403")
            ? "Auth error"
            : "Provider error";
      }
      
      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  
  const latencyMs = Date.now() - startTime;
  await logCall({
    role: req.role,
    provider: "none",
    model: "none",
    status: "error",
    errorMessage: String(lastError),
    latencyMs,
    systemPrompt: req.system || null,
    userPrompt: req.messages.map(m => m.content).join("\n").slice(0, 2000),
    fallbackUsed: true,
    fallbackReason: "All providers failed",
    traceId: req.traceId,
    criticality: req.criticality,
    purpose: req.purpose,
  });
  
  log.error("LLMGateway", `All providers failed for ${req.role}/${req.criticality}`, {
    traceId: req.traceId,
    purpose: req.purpose,
    triedProviders: chain.map(c => c.provider),
    lastError: String(lastError),
  });
  
  throw lastError || new Error(`All LLM providers failed for role: ${req.role}, criticality: ${req.criticality}`);
}

// ============================================================================
// HELPER: Generate trace ID
// ============================================================================

export function generateTraceId(): string {
  return randomUUID();
}

// ============================================================================
// EXPORTS
// ============================================================================

export const llmGateway = {
  call: callLLM,
  generateTraceId,
  getAvailableProviders: () => {
    return Object.entries(PROVIDER_CLIENTS)
      .filter(([_, v]) => v.isAvailable())
      .map(([name]) => name);
  },
};
