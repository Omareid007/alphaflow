/**
 * Role-Based LLM Router
 * 
 * Routes LLM requests based on functional roles with per-role fallback chains.
 * Supports parallel role execution, budget-aware routing, and call logging.
 * 
 * Roles:
 * - market_news_summarizer: cheap + fast model for summarizing news
 * - technical_analyst: strong reasoning model for analysis
 * - risk_manager: conservative, instruction-following model
 * - execution_planner: deterministic, tool-use friendly model
 * - post_trade_reporter: cheap summarizer for reports
 */

import { log } from "../utils/logger";
import { LLMRequest, LLMResponse, LLMClientError } from "./llmClient";
import { openaiClient } from "./openaiClient";
import { groqClient } from "./groqClient";
import { togetherClient } from "./togetherClient";
import { aimlClient } from "./aimlClient";
import { openrouterClient } from "./openrouterClient";
import { db } from "../db";
import { llmCalls, llmRoleConfigs, type LLMRole, type InsertLlmCall, type LlmRoleConfig } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface ModelConfig {
  provider: string;
  model: string;
  costPer1kTokens?: number;
}

export interface RoleConfig {
  role: LLMRole;
  description: string;
  fallbackChain: ModelConfig[];
  maxTokens?: number;
  temperature?: number;
  enableCitations?: boolean;
}

const PROVIDER_CLIENTS: Record<string, { client: any; isAvailable: () => boolean }> = {
  openai: { client: openaiClient, isAvailable: () => openaiClient.isAvailable() },
  groq: { client: groqClient, isAvailable: () => groqClient.isAvailable() },
  together: { client: togetherClient, isAvailable: () => togetherClient.isAvailable() },
  aimlapi: { client: aimlClient, isAvailable: () => aimlClient.isAvailable() },
  openrouter: { client: openrouterClient, isAvailable: () => openrouterClient.isAvailable() },
};

const DEFAULT_ROLE_CONFIGS: Record<LLMRole, RoleConfig> = {
  market_news_summarizer: {
    role: "market_news_summarizer",
    description: "Cheap + fast model for summarizing market news",
    fallbackChain: [
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
      { provider: "together", model: "meta-llama/Llama-3.2-3B-Instruct-Turbo", costPer1kTokens: 0.0001 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
    maxTokens: 500,
    temperature: 0.3,
  },
  technical_analyst: {
    role: "technical_analyst",
    description: "Strong reasoning model for technical analysis",
    fallbackChain: [
      { provider: "openrouter", model: "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
      { provider: "groq", model: "llama-3.3-70b-versatile", costPer1kTokens: 0.00059 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
    maxTokens: 2000,
    temperature: 0.2,
  },
  risk_manager: {
    role: "risk_manager",
    description: "Conservative, instruction-following model for risk assessment",
    fallbackChain: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", costPer1kTokens: 0.003 },
      { provider: "openrouter", model: "google/gemini-pro-1.5", costPer1kTokens: 0.00125 },
    ],
    maxTokens: 1500,
    temperature: 0.1,
    enableCitations: true,
  },
  execution_planner: {
    role: "execution_planner",
    description: "Deterministic, tool-use friendly model for trade execution",
    fallbackChain: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.1-70b-versatile", costPer1kTokens: 0.00059 },
      { provider: "together", model: "meta-llama/Llama-3.2-3B-Instruct-Turbo", costPer1kTokens: 0.0001 },
    ],
    maxTokens: 1000,
    temperature: 0.0,
  },
  post_trade_reporter: {
    role: "post_trade_reporter",
    description: "Cheap summarizer for post-trade reports",
    fallbackChain: [
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
      { provider: "together", model: "meta-llama/Llama-3.2-3B-Instruct-Turbo", costPer1kTokens: 0.0001 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
    maxTokens: 800,
    temperature: 0.4,
  },
  // New roles added for enhanced trading capabilities
  position_sizer: {
    role: "position_sizer",
    description: "Optimal position sizing based on risk and market conditions",
    fallbackChain: [
      { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", costPer1kTokens: 0.003 },
      { provider: "openrouter", model: "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
    maxTokens: 1500,
    temperature: 0.2,
  },
  sentiment_analyst: {
    role: "sentiment_analyst",
    description: "Dedicated sentiment analysis from news and social sources",
    fallbackChain: [
      { provider: "groq", model: "llama-3.3-70b-versatile", costPer1kTokens: 0.00059 },
      { provider: "openrouter", model: "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
    maxTokens: 1200,
    temperature: 0.3,
  },
  post_trade_analyzer: {
    role: "post_trade_analyzer",
    description: "Detailed trade performance analysis and learning",
    fallbackChain: [
      { provider: "openrouter", model: "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
      { provider: "groq", model: "llama-3.3-70b-versatile", costPer1kTokens: 0.00059 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
    maxTokens: 2000,
    temperature: 0.3,
  },
  futures_analyst: {
    role: "futures_analyst",
    description: "Specialized futures market analysis and recommendations",
    fallbackChain: [
      { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", costPer1kTokens: 0.003 },
      { provider: "openrouter", model: "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
      { provider: "groq", model: "llama-3.3-70b-versatile", costPer1kTokens: 0.00059 },
    ],
    maxTokens: 2500,
    temperature: 0.2,
  },
};

export interface RoleBasedRequest extends Omit<LLMRequest, "model"> {
  role: LLMRole;
  budgetLimit?: number;
}

export interface RoleBasedResponse extends LLMResponse {
  role: LLMRole;
  provider: string;
  estimatedCost: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
}

function estimateCost(tokens: number, costPer1kTokens: number): number {
  return (tokens / 1000) * costPer1kTokens;
}

function parseFallbackChain(chainJson: string): ModelConfig[] {
  try {
    return JSON.parse(chainJson);
  } catch {
    return [];
  }
}

async function getRoleConfig(role: LLMRole): Promise<RoleConfig> {
  try {
    const [dbConfig] = await db
      .select()
      .from(llmRoleConfigs)
      .where(eq(llmRoleConfigs.role, role))
      .limit(1);

    if (dbConfig && dbConfig.isActive) {
      return {
        role: role,
        description: dbConfig.description || DEFAULT_ROLE_CONFIGS[role].description,
        fallbackChain: parseFallbackChain(dbConfig.fallbackChain),
        maxTokens: dbConfig.maxTokens || DEFAULT_ROLE_CONFIGS[role].maxTokens,
        temperature: parseFloat(dbConfig.temperature || "0.3"),
        enableCitations: dbConfig.enableCitations,
      };
    }
  } catch (error) {
    log.warn("RoleBasedRouter", `Failed to load config for ${role}, using defaults`, { error: String(error) });
  }

  return DEFAULT_ROLE_CONFIGS[role];
}

async function logCall(callData: InsertLlmCall): Promise<void> {
  try {
    await db.insert(llmCalls).values(callData);
  } catch (error) {
    log.warn("RoleBasedRouter", "Failed to log LLM call", { error: String(error) });
  }
}

export async function roleBasedLLMCall(req: RoleBasedRequest): Promise<RoleBasedResponse> {
  const startTime = Date.now();
  const config = await getRoleConfig(req.role);
  
  let fallbackUsed = false;
  let fallbackReason: string | undefined;
  let lastError: Error | undefined;

  for (let i = 0; i < config.fallbackChain.length; i++) {
    const modelConfig = config.fallbackChain[i];
    const providerEntry = PROVIDER_CLIENTS[modelConfig.provider];

    if (!providerEntry || !providerEntry.isAvailable()) {
      if (i === 0) {
        fallbackUsed = true;
        fallbackReason = `Primary provider ${modelConfig.provider} not available`;
      }
      continue;
    }

    try {
      const llmRequest: LLMRequest = {
        ...req,
        model: modelConfig.model,
        maxTokens: req.maxTokens || config.maxTokens,
        temperature: req.temperature ?? config.temperature,
      };

      if (config.enableCitations && llmRequest.system) {
        llmRequest.system = `${llmRequest.system}\n\nIMPORTANT: Always cite your sources. Reference internal data (market data, news feeds, analysis) rather than external knowledge. Format citations as [Source: X].`;
      }

      const response = await providerEntry.client.call(llmRequest);
      const latencyMs = Date.now() - startTime;
      const totalTokens = response.tokensUsed?.total || 0;
      const estimatedCost = estimateCost(totalTokens, modelConfig.costPer1kTokens || 0.0001);

      await logCall({
        role: req.role,
        provider: modelConfig.provider,
        model: modelConfig.model,
        promptTokens: response.tokensUsed?.prompt || null,
        completionTokens: response.tokensUsed?.completion || null,
        totalTokens: totalTokens || null,
        estimatedCost: estimatedCost.toFixed(6),
        latencyMs,
        status: "success",
        systemPrompt: req.system || null,
        userPrompt: req.messages.map(m => m.content).join("\n").slice(0, 2000),
        response: response.content?.slice(0, 2000) || null,
        cacheHit: false,
        fallbackUsed,
        fallbackReason: fallbackReason || null,
      });

      log.ai(`RoleBasedRouter: ${req.role} succeeded`, {
        role: req.role,
        provider: modelConfig.provider,
        model: modelConfig.model,
        tokensUsed: totalTokens,
        estimatedCost,
        latencyMs,
        fallbackUsed,
      });

      return {
        ...response,
        role: req.role,
        provider: modelConfig.provider,
        estimatedCost,
        fallbackUsed,
        fallbackReason,
      };
    } catch (error) {
      lastError = error as Error;
      const llmError = error as LLMClientError;

      log.warn("RoleBasedRouter", `${modelConfig.provider}/${modelConfig.model} failed for ${req.role}`, {
        isRateLimit: llmError?.isRateLimit,
        isAuthError: llmError?.isAuthError,
        error: String(error),
      });

      if (i === 0) {
        fallbackUsed = true;
        fallbackReason = llmError?.isRateLimit 
          ? "Rate limit exceeded" 
          : llmError?.isAuthError 
            ? "Auth error" 
            : "Provider error";
      }

      if (llmError?.isRateLimit) {
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
  });

  log.error("RoleBasedRouter", `All providers failed for ${req.role}`, {
    role: req.role,
    triedProviders: config.fallbackChain.map(c => c.provider),
    lastError: String(lastError),
  });

  throw lastError || new Error(`All LLM providers failed for role: ${req.role}`);
}

export async function getAllRoleConfigs(): Promise<RoleConfig[]> {
  const configs: RoleConfig[] = [];
  
  for (const role of Object.keys(DEFAULT_ROLE_CONFIGS) as LLMRole[]) {
    const config = await getRoleConfig(role);
    configs.push(config);
  }
  
  return configs;
}

export async function updateRoleConfig(role: LLMRole, updates: Partial<RoleConfig>): Promise<LlmRoleConfig> {
  const fallbackChainJson = updates.fallbackChain 
    ? JSON.stringify(updates.fallbackChain) 
    : JSON.stringify(DEFAULT_ROLE_CONFIGS[role].fallbackChain);

  const existing = await db
    .select()
    .from(llmRoleConfigs)
    .where(eq(llmRoleConfigs.role, role))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(llmRoleConfigs)
      .set({
        description: updates.description,
        fallbackChain: fallbackChainJson,
        maxTokens: updates.maxTokens,
        temperature: updates.temperature?.toString(),
        enableCitations: updates.enableCitations,
        updatedAt: new Date(),
      })
      .where(eq(llmRoleConfigs.role, role))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(llmRoleConfigs)
    .values({
      role,
      description: updates.description || DEFAULT_ROLE_CONFIGS[role].description,
      fallbackChain: fallbackChainJson,
      maxTokens: updates.maxTokens || DEFAULT_ROLE_CONFIGS[role].maxTokens,
      temperature: (updates.temperature ?? DEFAULT_ROLE_CONFIGS[role].temperature)?.toString(),
      enableCitations: updates.enableCitations ?? DEFAULT_ROLE_CONFIGS[role].enableCitations ?? false,
      isActive: true,
    })
    .returning();

  return inserted;
}

export async function getRecentCalls(limit: number = 20, role?: LLMRole) {
  if (role) {
    return db.select().from(llmCalls).where(eq(llmCalls.role, role)).orderBy(desc(llmCalls.createdAt)).limit(limit);
  }
  return db.select().from(llmCalls).orderBy(desc(llmCalls.createdAt)).limit(limit);
}

export async function getCallStats() {
  const calls = await db.select().from(llmCalls).orderBy(desc(llmCalls.createdAt)).limit(1000);
  
  const stats = {
    total: calls.length,
    byRole: {} as Record<string, { count: number; totalCost: number; avgLatency: number }>,
    byProvider: {} as Record<string, { count: number; totalCost: number; successRate: number }>,
    totalCost: 0,
  };

  for (const call of calls) {
    const cost = parseFloat(call.estimatedCost || "0");
    stats.totalCost += cost;

    if (!stats.byRole[call.role]) {
      stats.byRole[call.role] = { count: 0, totalCost: 0, avgLatency: 0 };
    }
    stats.byRole[call.role].count++;
    stats.byRole[call.role].totalCost += cost;
    stats.byRole[call.role].avgLatency += call.latencyMs || 0;

    if (!stats.byProvider[call.provider]) {
      stats.byProvider[call.provider] = { count: 0, totalCost: 0, successRate: 0 };
    }
    stats.byProvider[call.provider].count++;
    stats.byProvider[call.provider].totalCost += cost;
    if (call.status === "success") {
      stats.byProvider[call.provider].successRate++;
    }
  }

  for (const role of Object.keys(stats.byRole)) {
    stats.byRole[role].avgLatency /= stats.byRole[role].count;
  }

  for (const provider of Object.keys(stats.byProvider)) {
    stats.byProvider[provider].successRate = 
      (stats.byProvider[provider].successRate / stats.byProvider[provider].count) * 100;
  }

  return stats;
}

export const roleBasedRouter = {
  call: roleBasedLLMCall,
  getAllConfigs: getAllRoleConfigs,
  updateConfig: updateRoleConfig,
  getRecentCalls,
  getCallStats,
  getAvailableProviders: () => {
    return Object.entries(PROVIDER_CLIENTS)
      .filter(([_, v]) => v.isAvailable())
      .map(([name]) => name);
  },
};