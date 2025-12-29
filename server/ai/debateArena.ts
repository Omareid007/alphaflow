import { storage } from "../storage";
import { callLLM, type LLMGatewayRequest } from "./llmGateway";
import { invokeTool, getToolSchemas } from "./toolRouter";
import { log } from "../utils/logger";
import type {
  DebateRole,
  DebateSession,
  DebateMessage,
  DebateConsensus,
  InsertDebateSession,
  InsertDebateMessage,
  InsertDebateConsensus,
} from "@shared/schema";
import { workQueue } from "../lib/work-queue";

export interface DebateConfig {
  maxRoundsPerRole?: number;
  tokenBudgetPerRole?: number;
  timeoutMs?: number;
  enabledRoles?: DebateRole[];
}

export interface RoleOutput {
  stance: "bullish" | "bearish" | "neutral" | "abstain";
  confidence: number;
  keySignals: string[];
  risks: string[];
  invalidationPoints: string[];
  proposedAction: "buy" | "sell" | "hold" | "scale_in" | "scale_out";
  proposedOrder?: {
    side: "buy" | "sell";
    qty?: number;
    notional?: number;
    type: "market" | "limit";
    limitPrice?: number;
  };
  evidenceRefs: string[];
  rationale: string;
}

export interface ConsensusOutput {
  decision: "buy" | "sell" | "hold" | "scale_in" | "scale_out";
  orderIntent?: {
    symbol: string;
    side: "buy" | "sell";
    qty?: number;
    notional?: number;
    type: "market" | "limit";
    limitPrice?: number;
  };
  reasonsSummary: string;
  riskChecks: {
    passedAll: boolean;
    checks: Array<{ name: string; passed: boolean; note?: string }>;
  };
  confidence: number;
  dissent: Array<{ role: DebateRole; reason: string }>;
}

const DEFAULT_ROLES: DebateRole[] = [
  "bull",
  "bear",
  "risk_manager",
  "technical_analyst",
  "fundamental_analyst",
];

const ROLE_PROMPTS: Record<DebateRole, string> = {
  bull: `You are the BULL analyst. Your job is to find reasons WHY this trade could succeed.
Focus on: upside catalysts, momentum signals, positive news, growth indicators.
Be optimistic but data-driven. Cite specific evidence.`,

  bear: `You are the BEAR analyst. Your job is to find reasons WHY this trade could fail.
Focus on: downside risks, headwinds, negative news, valuation concerns.
Be skeptical but fair. Cite specific evidence.`,

  risk_manager: `You are the RISK MANAGER. Your job is to assess position sizing and risk controls.
Focus on: max drawdown, stop-loss levels, portfolio concentration, correlation risks.
Recommend specific risk parameters. Be conservative.`,

  technical_analyst: `You are the TECHNICAL ANALYST. Your job is to analyze price action and indicators.
Focus on: support/resistance, trend strength, RSI/MACD signals, volume patterns.
Provide specific entry/exit levels based on technicals.`,

  fundamental_analyst: `You are the FUNDAMENTAL ANALYST. Your job is to analyze company/asset fundamentals.
Focus on: valuation metrics, earnings, growth rates, competitive position.
Assess intrinsic value vs current price.`,

  judge: `You are the JUDGE. Your job is to synthesize all analyst opinions into a final decision.
Weigh each analyst's arguments and confidence levels.
Make a clear BUY/SELL/HOLD decision with risk parameters.
If there's strong dissent, explain why you overruled it.`,
};

const ROLE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    stance: {
      type: "string",
      enum: ["bullish", "bearish", "neutral", "abstain"],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    keySignals: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    invalidationPoints: { type: "array", items: { type: "string" } },
    proposedAction: {
      type: "string",
      enum: ["buy", "sell", "hold", "scale_in", "scale_out"],
    },
    proposedOrder: {
      type: "object",
      properties: {
        side: { type: "string", enum: ["buy", "sell"] },
        qty: { type: "number" },
        notional: { type: "number" },
        type: { type: "string", enum: ["market", "limit"] },
        limitPrice: { type: "number" },
      },
    },
    evidenceRefs: { type: "array", items: { type: "string" } },
    rationale: { type: "string" },
  },
  required: [
    "stance",
    "confidence",
    "keySignals",
    "risks",
    "proposedAction",
    "rationale",
  ],
};

async function gatherMarketContext(
  symbols: string[],
  traceId: string
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {};

  for (const symbol of symbols) {
    try {
      const quoteResult = await invokeTool("getQuote", { symbol }, { traceId });
      if (quoteResult.success) {
        context[`${symbol}_quote`] = quoteResult.result;
      }

      const barsResult = await invokeTool(
        "getBars",
        { symbol, timeframe: "1Day", limit: 10 },
        { traceId }
      );
      if (barsResult.success) {
        context[`${symbol}_bars`] = barsResult.result;
      }
    } catch (e) {
      log.warn("DebateArena", `Failed to gather data for ${symbol}`, {
        error: (e as Error).message,
      });
    }
  }

  try {
    const accountResult = await invokeTool("getAccount", {}, { traceId });
    if (accountResult.success) {
      context.account = accountResult.result;
    }

    const positionsResult = await invokeTool("listPositions", {}, { traceId });
    if (positionsResult.success) {
      context.positions = positionsResult.result;
    }

    const clockResult = await invokeTool("getMarketClock", {}, { traceId });
    if (clockResult.success) {
      context.marketClock = clockResult.result;
    }
  } catch (e) {
    log.warn("DebateArena", `Failed to gather account data`, {
      error: (e as Error).message,
    });
  }

  return context;
}

async function runRole(
  role: DebateRole,
  symbols: string[],
  marketContext: Record<string, unknown>,
  priorMessages: DebateMessage[],
  session: DebateSession,
  config: DebateConfig
): Promise<DebateMessage> {
  const priorContext = priorMessages
    .map(
      (m) =>
        `[${m.role.toUpperCase()}] Stance: ${m.stance}, Confidence: ${m.confidence}, Action: ${m.proposedAction}\nRationale: ${m.rawOutput?.slice(0, 500) || "N/A"}`
    )
    .join("\n\n");

  const systemPrompt = `${ROLE_PROMPTS[role]}

You are analyzing: ${symbols.join(", ")}

Your response MUST be valid JSON matching this schema:
${JSON.stringify(ROLE_OUTPUT_SCHEMA, null, 2)}

Market Context:
${JSON.stringify(marketContext, null, 2)}

${priorMessages.length > 0 ? `\nPrior Analyst Opinions:\n${priorContext}` : ""}`;

  const startTime = Date.now();

  try {
    const response = await callLLM({
      role: role === "judge" ? "execution_planner" : "technical_analyst",
      criticality: "high",
      traceId: session.traceId,
      purpose: `debate_${role}`,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analyze ${symbols.join(", ")} and provide your ${role} perspective.`,
        },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: config.tokenBudgetPerRole || 1500,
    });

    const latencyMs = Date.now() - startTime;
    let parsed: RoleOutput;

    try {
      parsed = response.json as RoleOutput;
    } catch {
      parsed = JSON.parse(response.text || "{}") as RoleOutput;
    }

    const message = await storage.createDebateMessage({
      sessionId: session.id,
      role,
      stance: parsed.stance,
      confidence: String(parsed.confidence),
      keySignals: parsed.keySignals,
      risks: parsed.risks,
      invalidationPoints: parsed.invalidationPoints,
      proposedAction: parsed.proposedAction,
      proposedOrder: parsed.proposedOrder,
      evidenceRefs: parsed.evidenceRefs,
      rawOutput: parsed.rationale,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
      estimatedCost: String(response.estimatedCost),
      latencyMs,
    });

    log.info("DebateArena", `Role ${role} completed`, {
      sessionId: session.id,
      stance: parsed.stance,
      confidence: parsed.confidence,
      latencyMs,
    });

    return message;
  } catch (error) {
    log.error("DebateArena", `Role ${role} failed`, {
      sessionId: session.id,
      error: (error as Error).message,
    });
    throw error;
  }
}

async function runJudge(
  symbols: string[],
  roleMessages: DebateMessage[],
  session: DebateSession
): Promise<ConsensusOutput> {
  const analysisContext = roleMessages
    .map(
      (m) => `
[${m.role.toUpperCase()}]
Stance: ${m.stance} (Confidence: ${m.confidence})
Key Signals: ${((m.keySignals as string[]) || []).join(", ")}
Risks: ${((m.risks as string[]) || []).join(", ")}
Proposed Action: ${m.proposedAction}
Rationale: ${m.rawOutput || "N/A"}
`
    )
    .join("\n---\n");

  const systemPrompt = `You are the JUDGE synthesizing analyst opinions for ${symbols.join(", ")}.

Analyst Opinions:
${analysisContext}

Make a final decision. Your response MUST be valid JSON:
{
  "decision": "buy" | "sell" | "hold" | "scale_in" | "scale_out",
  "orderIntent": { "symbol": "...", "side": "buy" | "sell", "qty": number, "type": "market" | "limit" } | null,
  "reasonsSummary": "Concise explanation of the decision",
  "riskChecks": {
    "passedAll": boolean,
    "checks": [{ "name": "...", "passed": boolean, "note": "..." }]
  },
  "confidence": 0.0-1.0,
  "dissent": [{ "role": "...", "reason": "..." }]
}

Include orderIntent ONLY if decision is buy/sell/scale_in/scale_out.
Be decisive. If the risk manager has serious concerns, address them.`;

  const response = await callLLM({
    role: "execution_planner",
    criticality: "high",
    traceId: session.traceId,
    purpose: "debate_judge",
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: "Synthesize all analyst opinions and make a final decision.",
      },
    ],
    responseFormat: { type: "json_object" },
    maxTokens: 2000,
  });

  try {
    return response.json as ConsensusOutput;
  } catch {
    return JSON.parse(response.text || "{}") as ConsensusOutput;
  }
}

export async function startDebate(
  symbols: string[],
  traceId: string,
  config: DebateConfig = {},
  triggeredBy?: string,
  strategyVersionId?: string
): Promise<{ session: DebateSession; consensus: DebateConsensus }> {
  const session = await storage.createDebateSession({
    traceId,
    symbols,
    status: "running",
    triggeredBy,
    strategyVersionId,
    config,
    startedAt: new Date(),
  });

  log.info("DebateArena", `Starting debate session`, {
    sessionId: session.id,
    symbols,
    traceId,
  });

  const startTime = Date.now();
  const enabledRoles = config.enabledRoles || DEFAULT_ROLES;
  const roleMessages: DebateMessage[] = [];
  let totalCost = 0;

  try {
    const marketContext = await gatherMarketContext(symbols, traceId);
    await storage.updateDebateSession(session.id, { marketContext });

    for (const role of enabledRoles) {
      const message = await runRole(
        role,
        symbols,
        marketContext,
        roleMessages,
        session,
        config
      );
      roleMessages.push(message);
      totalCost += parseFloat(message.estimatedCost || "0");
    }

    const consensusOutput = await runJudge(symbols, roleMessages, session);

    let workItemId: string | undefined;
    let brokerOrderId: string | undefined;

    if (consensusOutput.orderIntent && consensusOutput.decision !== "hold") {
      const workItem = await workQueue.enqueue({
        type: "ORDER_SUBMIT",
        symbol: consensusOutput.orderIntent.symbol,
        payload: JSON.stringify({
          symbol: consensusOutput.orderIntent.symbol,
          side: consensusOutput.orderIntent.side,
          qty: consensusOutput.orderIntent.qty,
          notional: consensusOutput.orderIntent.notional,
          type: consensusOutput.orderIntent.type,
          time_in_force: "day",
          debateSessionId: session.id,
        }),
        idempotencyKey: `debate-${session.id}-${consensusOutput.orderIntent.symbol}`,
      });
      workItemId = workItem.id;

      log.info("DebateArena", `Order enqueued from debate`, {
        sessionId: session.id,
        workItemId,
        symbol: consensusOutput.orderIntent.symbol,
        side: consensusOutput.orderIntent.side,
      });
    }

    const consensus = await storage.createDebateConsensus({
      sessionId: session.id,
      decision: consensusOutput.decision,
      orderIntent: consensusOutput.orderIntent,
      reasonsSummary: consensusOutput.reasonsSummary,
      riskChecks: consensusOutput.riskChecks,
      confidence: String(consensusOutput.confidence),
      dissent: consensusOutput.dissent,
      workItemId,
      brokerOrderId,
    });

    const durationMs = Date.now() - startTime;
    await storage.updateDebateSession(session.id, {
      status: "completed",
      completedAt: new Date(),
      durationMs,
      totalCost: String(totalCost),
    });

    log.info("DebateArena", `Debate completed`, {
      sessionId: session.id,
      decision: consensusOutput.decision,
      confidence: consensusOutput.confidence,
      durationMs,
      totalCost,
    });

    const updatedSession = await storage.getDebateSession(session.id);
    return { session: updatedSession!, consensus };
  } catch (error) {
    await storage.updateDebateSession(session.id, {
      status: "failed",
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    });

    log.error("DebateArena", `Debate failed`, {
      sessionId: session.id,
      error: (error as Error).message,
    });

    throw error;
  }
}

export async function getDebateDetails(sessionId: string): Promise<{
  session: DebateSession;
  messages: DebateMessage[];
  consensus: DebateConsensus | undefined;
} | null> {
  const session = await storage.getDebateSession(sessionId);
  if (!session) return null;

  const messages = await storage.getDebateMessagesBySession(sessionId);
  const consensus = await storage.getDebateConsensusBySession(sessionId);

  return { session, messages, consensus };
}

export async function listDebateSessions(limit = 50): Promise<DebateSession[]> {
  return storage.getDebateSessions(limit);
}
