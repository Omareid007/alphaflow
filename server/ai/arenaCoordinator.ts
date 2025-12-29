import { callLLM, type LLMGatewayRequest } from "./llmGateway";
import { invokeTool } from "./toolRouter";
import { log } from "../utils/logger";
import type {
  AiAgentProfile,
  AiArenaRun,
  InsertAiArenaRun,
  InsertAiArenaAgentDecision,
  InsertAiOutcomeLink,
  DebateRole,
  LLMRole,
} from "@shared/schema";
import { db } from "../db";
import { aiAgentProfiles, aiArenaRuns, aiArenaAgentDecisions, aiOutcomeLinks } from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { z } from "zod";

export interface EscalationPolicy {
  disagreementThreshold: number;
  minConfidenceThreshold: number;
  highRiskPortfolioDeltaPct: number;
  maxPowerCallsPerDay: number;
}

export interface ArenaConfig {
  mode: "debate" | "competition" | "consensus";
  symbols: string[];
  agentProfileIds?: string[];
  escalationPolicy?: EscalationPolicy;
  timeoutMs?: number;
  triggeredBy?: string;
  strategyVersionId?: string;
}

const AgentDecisionOutputSchema = z.object({
  action: z.enum(["buy", "sell", "hold", "scale_in", "scale_out"]),
  symbols: z.array(z.string()).optional().default([]),
  confidence: z.number().min(0).max(1),
  stance: z.enum(["bullish", "bearish", "neutral", "abstain"]),
  rationale: z.string(),
  keySignals: z.array(z.string()).optional().default([]),
  risks: z.array(z.string()).optional().default([]),
  proposedOrder: z.object({
    symbol: z.string(),
    side: z.enum(["buy", "sell"]),
    qty: z.number().optional(),
    notional: z.number().optional(),
    type: z.enum(["market", "limit"]),
    limitPrice: z.number().optional(),
  }).optional(),
});

export type AgentDecisionOutput = z.infer<typeof AgentDecisionOutputSchema>;

export interface ConsensusResult {
  decision: "buy" | "sell" | "hold" | "no_trade";
  symbol?: string;
  confidence: number;
  orderIntent?: {
    symbol: string;
    side: "buy" | "sell";
    qty?: number;
    notional?: number;
    type: "market" | "limit";
  };
  disagreementRate: number;
  escalationTriggered: boolean;
  escalationReason?: string;
  riskVeto: boolean;
  riskVetoReason?: string;
}

const DEFAULT_ESCALATION_POLICY: EscalationPolicy = {
  disagreementThreshold: 0.34,
  minConfidenceThreshold: 0.62,
  highRiskPortfolioDeltaPct: 1.5,
  maxPowerCallsPerDay: 25,
};

const ROLE_PROMPTS: Record<DebateRole, string> = {
  bull: `You are the BULL analyst. Find reasons WHY this trade could succeed. Focus on: upside catalysts, momentum, positive news, growth. Be optimistic but data-driven.`,
  bear: `You are the BEAR analyst. Find reasons WHY this trade could fail. Focus on: downside risks, headwinds, negative news, valuation concerns. Be skeptical but fair.`,
  risk_manager: `You are the RISK MANAGER. Assess position sizing and risk controls. Focus on: max drawdown, stop-loss levels, concentration, correlation risks. Be conservative.`,
  technical_analyst: `You are the TECHNICAL ANALYST. Analyze price action and indicators. Focus on: support/resistance, trend strength, RSI/MACD, volume. Provide specific levels.`,
  fundamental_analyst: `You are the FUNDAMENTAL ANALYST. Analyze company fundamentals. Focus on: valuation, earnings, growth rates, competitive position. Assess intrinsic value.`,
  judge: `You are the JUDGE. Synthesize all analyst opinions into a final decision. Weigh arguments and confidence levels. Make a clear BUY/SELL/HOLD decision.`,
};

interface MarketContext {
  quotes: Record<string, unknown>;
  bars: Record<string, unknown>;
  account?: unknown;
  positions?: unknown[];
  marketClock?: unknown;
}

export class ArenaCoordinator {
  private escalationPolicy: EscalationPolicy;
  private powerCallsToday = 0;
  private lastDayReset: Date = new Date();

  constructor(policy?: EscalationPolicy) {
    this.escalationPolicy = policy || DEFAULT_ESCALATION_POLICY;
  }

  private resetDailyCounters(): void {
    const now = new Date();
    if (now.getDate() !== this.lastDayReset.getDate()) {
      this.powerCallsToday = 0;
      this.lastDayReset = now;
    }
  }

  async runArena(config: ArenaConfig): Promise<{
    run: AiArenaRun;
    consensus: ConsensusResult;
    decisions: InsertAiArenaAgentDecision[];
  }> {
    this.resetDailyCounters();
    const traceId = `arena-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const startTime = Date.now();

    log.info("ArenaCoordinator", `Starting arena run`, { traceId, mode: config.mode, symbols: config.symbols });

    const agentProfiles = await this.getActiveAgentProfiles(config.agentProfileIds);
    if (agentProfiles.length === 0) {
      throw new Error("No active agent profiles found for arena run");
    }

    const run = await this.createArenaRun({
      traceId,
      mode: config.mode,
      symbols: config.symbols,
      agentProfileIds: agentProfiles.map(p => p.id),
      strategyVersionId: config.strategyVersionId,
      triggeredBy: config.triggeredBy,
      status: "running",
      startedAt: new Date(),
    });

    const marketContext = await this.gatherMarketContext(config.symbols, traceId);
    const cheapAgents = agentProfiles.filter(p => p.mode === "cheap_first" || p.mode === "always");
    const powerAgents = agentProfiles.filter(p => p.mode === "escalation_only");
    const allDecisions: InsertAiArenaAgentDecision[] = [];
    let escalationTriggered = false;
    let escalationReason: string | undefined;

    log.info("ArenaCoordinator", `Running ${cheapAgents.length} cheap agents`, { traceId });
    const cheapDecisions = await Promise.all(
      cheapAgents.map(agent => this.runAgent(agent, config.symbols, marketContext, run.id, traceId, false))
    );
    allDecisions.push(...cheapDecisions);

    let disagreementRate = this.calculateDisagreementRate(cheapDecisions);
    let avgConfidence = this.calculateAvgConfidence(cheapDecisions);
    const riskVeto = this.checkRiskVeto(cheapDecisions);

    if (this.shouldEscalate(disagreementRate, avgConfidence, riskVeto)) {
      escalationTriggered = true;
      escalationReason = this.getEscalationReason(disagreementRate, avgConfidence, riskVeto);
      log.info("ArenaCoordinator", `Escalation triggered: ${escalationReason}`, { traceId });

      if (powerAgents.length > 0 && this.powerCallsToday < this.escalationPolicy.maxPowerCallsPerDay) {
        log.info("ArenaCoordinator", `Running ${powerAgents.length} power agents`, { traceId });
        const powerDecisions = await Promise.all(
          powerAgents.map(agent => this.runAgent(agent, config.symbols, marketContext, run.id, traceId, true))
        );
        allDecisions.push(...powerDecisions);
        this.powerCallsToday += powerAgents.length;

        disagreementRate = this.calculateDisagreementRate(allDecisions);
        avgConfidence = this.calculateAvgConfidence(allDecisions);
      } else if (this.powerCallsToday >= this.escalationPolicy.maxPowerCallsPerDay) {
        log.warn("ArenaCoordinator", `Power call limit reached (${this.powerCallsToday}/${this.escalationPolicy.maxPowerCallsPerDay}), using cheap decisions only`, { traceId });
      }
    }

    const consensus = this.computeConsensus(allDecisions, disagreementRate, escalationTriggered, escalationReason);
    const durationMs = Date.now() - startTime;
    const totalCost = allDecisions.reduce((sum, d) => sum + parseFloat(d.costUsd || "0"), 0);
    const totalTokens = allDecisions.reduce((sum, d) => sum + (d.tokensUsed || 0), 0);

    await this.updateArenaRun(run.id, {
      status: "completed",
      completedAt: new Date(),
      durationMs,
      totalCostUsd: String(totalCost),
      totalTokensUsed: totalTokens,
      escalationTriggered,
      escalationReason,
      consensusReached: consensus.decision !== "no_trade",
      finalDecision: consensus.decision,
      disagreementRate: String(disagreementRate),
      avgConfidence: String(avgConfidence),
    });

    if (consensus.decision !== "no_trade" && consensus.decision !== "hold" && consensus.orderIntent) {
      const outcomeLink = await this.createOutcomeLink(run.id, consensus, totalCost, traceId);
      log.info("ArenaCoordinator", `Created outcome link: ${outcomeLink.id}`, { traceId });
    }

    log.info("ArenaCoordinator", `Arena run completed`, {
      traceId,
      durationMs,
      decision: consensus.decision,
      confidence: consensus.confidence,
      escalated: escalationTriggered,
      totalCost: totalCost.toFixed(4),
      agentsRun: allDecisions.length,
    });

    const updatedRun = await db.query.aiArenaRuns.findFirst({ where: eq(aiArenaRuns.id, run.id) });

    return {
      run: updatedRun!,
      consensus,
      decisions: allDecisions,
    };
  }

  private async getActiveAgentProfiles(ids?: string[]): Promise<AiAgentProfile[]> {
    const allProfiles = await db.query.aiAgentProfiles.findMany({
      where: eq(aiAgentProfiles.status, "active"),
    });
    
    if (ids && ids.length > 0) {
      return allProfiles.filter(p => ids.includes(p.id));
    }
    return allProfiles;
  }

  private async createArenaRun(data: InsertAiArenaRun): Promise<AiArenaRun> {
    const [run] = await db.insert(aiArenaRuns).values([data as typeof aiArenaRuns.$inferInsert]).returning();
    return run;
  }

  private async updateArenaRun(id: string, data: Partial<AiArenaRun>): Promise<void> {
    await db.update(aiArenaRuns).set(data).where(eq(aiArenaRuns.id, id));
  }

  private async gatherMarketContext(symbols: string[], traceId: string): Promise<MarketContext> {
    const context: MarketContext = {
      quotes: {},
      bars: {},
    };

    const quotePromises = symbols.map(async (symbol) => {
      try {
        const result = await invokeTool("getQuote", { symbol }, { traceId });
        if (result.success) {
          context.quotes[symbol] = result.result;
        }
      } catch (e) {
        log.warn("ArenaCoordinator", `Failed to get quote for ${symbol}`, { error: (e as Error).message, traceId });
      }
    });

    const barsPromises = symbols.map(async (symbol) => {
      try {
        const result = await invokeTool("getBars", { symbol, timeframe: "1Day", limit: 10 }, { traceId });
        if (result.success) {
          context.bars[symbol] = result.result;
        }
      } catch (e) {
        log.warn("ArenaCoordinator", `Failed to get bars for ${symbol}`, { error: (e as Error).message, traceId });
      }
    });

    const accountPromise = (async () => {
      try {
        const result = await invokeTool("getAccount", {}, { traceId });
        if (result.success) context.account = result.result;
      } catch (e) {
        log.warn("ArenaCoordinator", `Failed to get account`, { error: (e as Error).message, traceId });
      }
    })();

    const positionsPromise = (async () => {
      try {
        const result = await invokeTool("listPositions", {}, { traceId });
        if (result.success) context.positions = result.result as unknown[];
      } catch (e) {
        log.warn("ArenaCoordinator", `Failed to get positions`, { error: (e as Error).message, traceId });
      }
    })();

    const clockPromise = (async () => {
      try {
        const result = await invokeTool("getMarketClock", {}, { traceId });
        if (result.success) context.marketClock = result.result;
      } catch (e) {
        log.warn("ArenaCoordinator", `Failed to get market clock`, { error: (e as Error).message, traceId });
      }
    })();

    await Promise.all([...quotePromises, ...barsPromises, accountPromise, positionsPromise, clockPromise]);

    log.info("ArenaCoordinator", `Gathered market context`, { 
      traceId,
      quotesCount: Object.keys(context.quotes).length,
      barsCount: Object.keys(context.bars).length,
      hasAccount: !!context.account,
      positionsCount: context.positions?.length || 0,
    });

    return context;
  }

  private async runAgent(
    agent: AiAgentProfile,
    symbols: string[],
    marketContext: MarketContext,
    arenaRunId: string,
    traceId: string,
    isEscalation: boolean,
    retryCount: number = 0
  ): Promise<InsertAiArenaAgentDecision> {
    const MAX_RETRIES = 2;
    const startTime = Date.now();
    const role = agent.role as DebateRole;

    try {
      const contextSummary = this.formatMarketContext(symbols, marketContext);
      const systemPrompt = `${ROLE_PROMPTS[role] || ROLE_PROMPTS.bull}

You are analyzing: ${symbols.join(", ")}

CRITICAL: You MUST respond with a valid JSON object containing these exact fields:
- action: one of "buy", "sell", "hold", "scale_in", "scale_out"
- confidence: number between 0 and 1
- stance: one of "bullish", "bearish", "neutral", "abstain"
- rationale: your reasoning (string)
- keySignals: array of key signals supporting your view
- risks: array of risks to consider
- proposedOrder: optional object with {symbol, side, qty?, notional?, type, limitPrice?}

${contextSummary}`;

      const request: LLMGatewayRequest = {
        role: "technical_analyst" as LLMRole,
        criticality: isEscalation ? "high" : "medium",
        purpose: "arena_evaluation",
        traceId,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Analyze ${symbols.join(", ")} and provide your ${role} perspective. Be specific and data-driven. Return valid JSON only. Do not include any text outside the JSON object.`
          }
        ],
        maxTokens: agent.maxTokens || 2000,
        temperature: parseFloat(agent.temperature || "0.7"),
        responseFormat: { type: "json_object" },
      };

      const llmResult = await callLLM(request);
      const latencyMs = Date.now() - startTime;

      let output: AgentDecisionOutput | null = null;
      let parseError: string | null = null;
      
      try {
        const rawJson = JSON.parse(llmResult.text || "{}");
        const parsed = AgentDecisionOutputSchema.safeParse(rawJson);
        if (parsed.success) {
          output = parsed.data;
        } else {
          parseError = parsed.error.message;
          log.warn("ArenaCoordinator", `Agent output validation failed (attempt ${retryCount + 1})`, { traceId, agentId: agent.id, error: parseError });
        }
      } catch (e) {
        parseError = (e as Error).message;
        log.warn("ArenaCoordinator", `Failed to parse agent output JSON (attempt ${retryCount + 1})`, { traceId, agentId: agent.id, error: parseError });
      }

      if (!output && retryCount < MAX_RETRIES) {
        log.info("ArenaCoordinator", `Retrying agent ${agent.name} due to parse failure`, { traceId, retryCount: retryCount + 1 });
        return this.runAgent(agent, symbols, marketContext, arenaRunId, traceId, isEscalation, retryCount + 1);
      }

      if (!output) {
        output = {
          action: "hold",
          symbols,
          confidence: 0.2,
          stance: "abstain",
          rationale: `Parse failed after ${MAX_RETRIES + 1} attempts: ${parseError}`,
          keySignals: [],
          risks: ["Output validation error - max retries exceeded"],
        };
      }

      const decision: InsertAiArenaAgentDecision = {
        arenaRunId,
        agentProfileId: agent.id,
        role: agent.role,
        action: output.action,
        symbols: output.symbols || symbols,
        confidence: String(output.confidence),
        stance: output.stance,
        rationale: output.rationale,
        keySignals: Array.isArray(output.keySignals) ? JSON.stringify(output.keySignals) : output.keySignals,
        risks: Array.isArray(output.risks) ? JSON.stringify(output.risks) : output.risks,
        proposedOrder: typeof output.proposedOrder === 'object' ? JSON.stringify(output.proposedOrder) : output.proposedOrder,
        tokensUsed: llmResult.tokensUsed,
        costUsd: String(llmResult.estimatedCost || 0),
        latencyMs,
        modelUsed: llmResult.model,
        wasEscalation: isEscalation,
        rawOutput: (llmResult.text || "").slice(0, 5000),
        errorMessage: parseError && retryCount >= MAX_RETRIES ? `Parse failed: ${parseError}` : undefined,
      };

      await db.insert(aiArenaAgentDecisions).values([decision as typeof aiArenaAgentDecisions.$inferInsert]);
      await this.updateAgentStats(agent.id, llmResult.tokensUsed || 0, llmResult.estimatedCost || 0);

      log.info("ArenaCoordinator", `Agent ${agent.name} completed`, { 
        traceId, 
        action: output.action, 
        confidence: output.confidence,
        isEscalation,
        latencyMs,
        retries: retryCount,
      });

      return decision;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        log.info("ArenaCoordinator", `Retrying agent ${agent.name} due to error`, { traceId, retryCount: retryCount + 1, error: (error as Error).message });
        return this.runAgent(agent, symbols, marketContext, arenaRunId, traceId, isEscalation, retryCount + 1);
      }

      const latencyMs = Date.now() - startTime;
      log.error("ArenaCoordinator", `Agent ${agent.name} failed after ${MAX_RETRIES + 1} attempts: ${(error as Error).message}`, { traceId });
      
      const decision: InsertAiArenaAgentDecision = {
        arenaRunId,
        agentProfileId: agent.id,
        role: agent.role,
        action: "hold",
        symbols,
        confidence: "0",
        stance: "abstain",
        rationale: `Agent execution failed after ${MAX_RETRIES + 1} attempts`,
        keySignals: JSON.stringify([]),
        risks: JSON.stringify([(error as Error).message]),
        latencyMs,
        wasEscalation: isEscalation,
        errorMessage: (error as Error).message,
      };

      await db.insert(aiArenaAgentDecisions).values([decision as typeof aiArenaAgentDecisions.$inferInsert]);
      return decision;
    }
  }

  private formatMarketContext(symbols: string[], context: MarketContext): string {
    let summary = "=== MARKET CONTEXT ===\n\n";

    if (context.marketClock) {
      summary += `Market Clock: ${JSON.stringify(context.marketClock)}\n\n`;
    }

    if (context.account) {
      const acc = context.account as Record<string, unknown>;
      summary += `Account: Buying Power=$${acc.buying_power || "N/A"}, Equity=$${acc.equity || "N/A"}\n\n`;
    }

    for (const symbol of symbols) {
      summary += `--- ${symbol} ---\n`;
      if (context.quotes[symbol]) {
        const q = context.quotes[symbol] as Record<string, unknown>;
        summary += `Quote: Bid=$${q.bid_price || "N/A"}, Ask=$${q.ask_price || "N/A"}, Last=$${q.last_price || q.price || "N/A"}\n`;
      }
      if (context.bars[symbol]) {
        const bars = context.bars[symbol] as unknown[];
        if (Array.isArray(bars) && bars.length > 0) {
          summary += `Recent bars: ${bars.length} days of data\n`;
          const latest = bars[bars.length - 1] as Record<string, unknown>;
          summary += `Latest: O=${latest.o || latest.open}, H=${latest.h || latest.high}, L=${latest.l || latest.low}, C=${latest.c || latest.close}, V=${latest.v || latest.volume}\n`;
        }
      }
      summary += "\n";
    }

    if (context.positions && context.positions.length > 0) {
      summary += "=== CURRENT POSITIONS ===\n";
      for (const pos of context.positions) {
        const p = pos as Record<string, unknown>;
        summary += `${p.symbol}: ${p.qty} shares @ $${p.avg_entry_price}, P&L=$${p.unrealized_pl}\n`;
      }
    }

    return summary.slice(0, 6000);
  }

  private async updateAgentStats(agentId: string, tokens: number, cost: number): Promise<void> {
    const agent = await db.query.aiAgentProfiles.findFirst({ where: eq(aiAgentProfiles.id, agentId) });
    if (!agent) return;

    await db.update(aiAgentProfiles)
      .set({
        totalCalls: agent.totalCalls + 1,
        totalTokens: agent.totalTokens + tokens,
        totalCostUsd: String(parseFloat(agent.totalCostUsd) + cost),
        updatedAt: new Date(),
      })
      .where(eq(aiAgentProfiles.id, agentId));
  }

  private calculateDisagreementRate(decisions: InsertAiArenaAgentDecision[]): number {
    if (decisions.length < 2) return 0;
    
    const validDecisions = decisions.filter(d => !d.errorMessage);
    if (validDecisions.length < 2) return 0;

    const actions = validDecisions.map(d => d.action);
    const unique = new Set(actions);
    return (unique.size - 1) / Math.max(1, validDecisions.length - 1);
  }

  private calculateAvgConfidence(decisions: InsertAiArenaAgentDecision[]): number {
    const validDecisions = decisions.filter(d => !d.errorMessage);
    if (validDecisions.length === 0) return 0;
    const sum = validDecisions.reduce((acc, d) => acc + parseFloat(d.confidence || "0"), 0);
    return sum / validDecisions.length;
  }

  private checkRiskVeto(decisions: InsertAiArenaAgentDecision[]): boolean {
    const riskManager = decisions.find(d => d.role === "risk_manager" && !d.errorMessage);
    if (!riskManager) return false;
    const confidence = parseFloat(riskManager.confidence || "0");
    return riskManager.action === "hold" && confidence > 0.8;
  }

  private shouldEscalate(disagreement: number, avgConfidence: number, riskVeto: boolean): boolean {
    if (riskVeto) return true;
    if (disagreement > this.escalationPolicy.disagreementThreshold) return true;
    if (avgConfidence < this.escalationPolicy.minConfidenceThreshold) return true;
    return false;
  }

  private getEscalationReason(disagreement: number, avgConfidence: number, riskVeto: boolean): string {
    if (riskVeto) return "Risk manager veto with high confidence";
    if (disagreement > this.escalationPolicy.disagreementThreshold)
      return `Disagreement rate ${(disagreement * 100).toFixed(1)}% > ${this.escalationPolicy.disagreementThreshold * 100}%`;
    if (avgConfidence < this.escalationPolicy.minConfidenceThreshold)
      return `Avg confidence ${(avgConfidence * 100).toFixed(1)}% < ${this.escalationPolicy.minConfidenceThreshold * 100}%`;
    return "Unknown";
  }

  private computeConsensus(
    decisions: InsertAiArenaAgentDecision[],
    disagreementRate: number,
    escalationTriggered: boolean,
    escalationReason?: string
  ): ConsensusResult {
    const validDecisions = decisions.filter(d => !d.errorMessage);
    
    if (validDecisions.length === 0) {
      return {
        decision: "no_trade",
        confidence: 0,
        disagreementRate,
        escalationTriggered,
        escalationReason,
        riskVeto: false,
      };
    }

    const powerDecisions = validDecisions.filter(d => d.wasEscalation);
    const hasPowerAgents = powerDecisions.length > 0;

    const powerRiskManager = powerDecisions.find(d => d.role === "risk_manager");
    const cheapRiskManager = validDecisions.find(d => d.role === "risk_manager" && !d.wasEscalation);

    const powerRiskVeto = powerRiskManager && 
      powerRiskManager.action === "hold" && 
      parseFloat(powerRiskManager.confidence || "0") > 0.8;

    const cheapRiskVeto = cheapRiskManager && 
      cheapRiskManager.action === "hold" && 
      parseFloat(cheapRiskManager.confidence || "0") > 0.8;

    if (powerRiskVeto) {
      return {
        decision: "hold",
        confidence: parseFloat(powerRiskManager!.confidence || "0.5"),
        disagreementRate,
        escalationTriggered,
        escalationReason,
        riskVeto: true,
        riskVetoReason: powerRiskManager!.rationale || "Power risk manager vetoed the trade",
      };
    }

    if (cheapRiskVeto && !hasPowerAgents && !escalationTriggered) {
      return {
        decision: "hold",
        confidence: parseFloat(cheapRiskManager!.confidence || "0.5"),
        disagreementRate,
        escalationTriggered,
        escalationReason,
        riskVeto: true,
        riskVetoReason: cheapRiskManager!.rationale || "Risk manager vetoed the trade",
      };
    }

    if (cheapRiskVeto && !hasPowerAgents && escalationTriggered) {
      return {
        decision: "no_trade",
        confidence: 0.3,
        disagreementRate,
        escalationTriggered,
        escalationReason: (escalationReason || "") + " (power agents unavailable, deferring decision)",
        riskVeto: false,
        riskVetoReason: "Escalation triggered but power agents unavailable - decision deferred",
      };
    }

    const weightedVotes: Record<string, { score: number; confidenceSum: number; count: number }> = {};
    const powerWeight = 1.5;
    const riskManagerDiscount = cheapRiskVeto && hasPowerAgents ? 0.3 : 1.0;

    for (const d of validDecisions) {
      const action = d.action;
      const confidence = parseFloat(d.confidence || "0");
      let weight = d.wasEscalation ? powerWeight : 1.0;
      
      if (d.role === "risk_manager" && !d.wasEscalation && cheapRiskVeto && hasPowerAgents) {
        weight *= riskManagerDiscount;
      }

      if (!weightedVotes[action]) {
        weightedVotes[action] = { score: 0, confidenceSum: 0, count: 0 };
      }
      weightedVotes[action].score += weight * (1 + confidence * 0.5);
      weightedVotes[action].confidenceSum += confidence;
      weightedVotes[action].count++;
    }

    let bestAction = "hold";
    let bestScore = 0;

    for (const [action, stats] of Object.entries(weightedVotes)) {
      if (stats.score > bestScore) {
        bestScore = stats.score;
        bestAction = action;
      }
    }

    const avgConfidence = this.calculateAvgConfidence(validDecisions);

    if (avgConfidence < 0.4 || disagreementRate > 0.7) {
      return {
        decision: "no_trade",
        confidence: avgConfidence,
        disagreementRate,
        escalationTriggered,
        escalationReason,
        riskVeto: false,
      };
    }

    const orderDecision = validDecisions.find(
      d => (d.action === bestAction) && d.proposedOrder
    );
    const orderIntent = orderDecision?.proposedOrder as ConsensusResult["orderIntent"];

    return {
      decision: bestAction as ConsensusResult["decision"],
      symbol: orderIntent?.symbol,
      confidence: avgConfidence,
      orderIntent,
      disagreementRate,
      escalationTriggered,
      escalationReason,
      riskVeto: false,
    };
  }

  private async createOutcomeLink(
    arenaRunId: string,
    consensus: ConsensusResult,
    llmCost: number,
    traceId: string
  ): Promise<{ id: string }> {
    if (!consensus.orderIntent) {
      throw new Error("No order intent in consensus");
    }

    const link: InsertAiOutcomeLink = {
      symbol: consensus.orderIntent.symbol,
      side: consensus.orderIntent.side,
      intendedQty: consensus.orderIntent.qty ? String(consensus.orderIntent.qty) : undefined,
      intendedNotional: consensus.orderIntent.notional ? String(consensus.orderIntent.notional) : undefined,
      status: "pending",
      llmCostUsd: String(llmCost),
      traceId,
    };

    const [inserted] = await db.insert(aiOutcomeLinks).values([link as typeof aiOutcomeLinks.$inferInsert]).returning();

    await db.update(aiArenaRuns)
      .set({ outcomeLinked: true })
      .where(eq(aiArenaRuns.id, arenaRunId));

    return { id: inserted.id };
  }

  async getLeaderboard(windowDays = 30): Promise<Array<{
    agentId: string;
    agentName: string;
    role: string;
    totalRuns: number;
    avgConfidence: number;
    totalCost: number;
    avgLatency: number;
    successRate: number;
  }>> {
    const agents = await db.query.aiAgentProfiles.findMany({
      where: eq(aiAgentProfiles.status, "active"),
    });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - windowDays);

    const leaderboard = await Promise.all(
      agents.map(async (agent) => {
        const decisions = await db.query.aiArenaAgentDecisions.findMany({
          where: and(
            eq(aiArenaAgentDecisions.agentProfileId, agent.id),
            gte(aiArenaAgentDecisions.createdAt, cutoffDate)
          ),
        });

        const avgConfidence = decisions.length > 0
          ? decisions.reduce((sum, d) => sum + parseFloat(d.confidence || "0"), 0) / decisions.length
          : 0;

        const avgLatency = decisions.length > 0
          ? decisions.reduce((sum, d) => sum + (d.latencyMs || 0), 0) / decisions.length
          : 0;

        const successfulDecisions = decisions.filter(d => !d.errorMessage);

        return {
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role,
          totalRuns: decisions.length,
          avgConfidence,
          totalCost: parseFloat(agent.totalCostUsd),
          avgLatency,
          successRate: decisions.length > 0 ? successfulDecisions.length / decisions.length : 1,
        };
      })
    );

    return leaderboard.sort((a, b) => b.totalRuns - a.totalRuns);
  }
}

export const arenaCoordinator = new ArenaCoordinator();
