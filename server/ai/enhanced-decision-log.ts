/**
 * Enhanced AI Decision Logging - Full transparency into AI trading decisions
 *
 * Provides:
 * - Complete input snapshot (market data, sentiment, fundamentals)
 * - Reasoning chain with step-by-step analysis
 * - Alternative actions considered with scores
 * - Provider and model information
 * - Cost and latency metrics
 *
 * @see docs/AI_MODELS_AND_PROVIDERS.md
 */

import { log } from "../utils/logger";
import { FusedMarketIntelligence } from "./data-fusion-engine";
import {
  AIDecision,
  MarketData,
  NewsContext,
  StrategyContext,
} from "./decision-engine";

export interface InputSnapshot {
  marketData: {
    symbol: string;
    price: number;
    change24h?: number;
    changePercent24h?: number;
    volume?: number;
    high24h?: number;
    low24h?: number;
  };

  sentiment?: {
    overall: string;
    score: number;
    confidence: number;
    sources: string[];
    headlines?: string[];
  };

  fundamentals?: {
    eps?: number;
    peRatio?: number;
    revenueGrowth?: number;
    sources: string[];
  };

  fusedIntelligence?: {
    trendStrength: number;
    signalAgreement: number;
    dataQuality: {
      completeness: number;
      freshness: number;
      reliability: number;
    };
    warnings: string[];
  };

  strategyContext?: {
    id: string;
    name: string;
    type: string;
    parameters?: Record<string, unknown>;
  };
}

export interface ReasoningStep {
  step: number;
  category:
    | "market_analysis"
    | "sentiment_analysis"
    | "fundamental_analysis"
    | "risk_assessment"
    | "signal_synthesis"
    | "final_decision";
  observation: string;
  implication: string;
  weight: number;
}

export interface AlternativeConsidered {
  action: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string;
  whyRejected?: string;
}

export interface EnhancedDecisionLog {
  id: string;
  timestamp: Date;
  cycleId?: string;

  input: InputSnapshot;

  reasoning: {
    steps: ReasoningStep[];
    summary: string;
    keyFactors: string[];
  };

  alternatives: AlternativeConsidered[];

  decision: AIDecision;

  providerInfo: {
    provider: string;
    model: string;
    tokensUsed?: number;
    latencyMs?: number;
    cost?: number;
  };

  metadata: {
    dataSourcesUsed: string[];
    enrichmentApplied: boolean;
    fusionConfidence: number;
    warningCount: number;
  };
}

export function createInputSnapshot(
  marketData: MarketData,
  newsContext?: NewsContext,
  strategy?: StrategyContext,
  fusedIntelligence?: FusedMarketIntelligence
): InputSnapshot {
  const snapshot: InputSnapshot = {
    marketData: {
      symbol: marketData.symbol,
      price: marketData.currentPrice,
      change24h: marketData.priceChange24h,
      changePercent24h: marketData.priceChangePercent24h,
      volume: marketData.volume,
      high24h: marketData.high24h,
      low24h: marketData.low24h,
    },
  };

  if (newsContext) {
    snapshot.sentiment = {
      overall: newsContext.sentiment || "neutral",
      score: 0,
      confidence: 0.5,
      sources: ["newsapi"],
      headlines: newsContext.headlines?.slice(0, 5),
    };
  }

  if (fusedIntelligence) {
    snapshot.sentiment = {
      overall: fusedIntelligence.sentiment.overall,
      score: fusedIntelligence.sentiment.score,
      confidence: fusedIntelligence.sentiment.confidence,
      sources: fusedIntelligence.sentiment.sources,
    };

    if (fusedIntelligence.fundamentals) {
      snapshot.fundamentals = {
        eps: fusedIntelligence.fundamentals.eps,
        peRatio: fusedIntelligence.fundamentals.peRatio,
        revenueGrowth: fusedIntelligence.fundamentals.revenueGrowth,
        sources: fusedIntelligence.fundamentals.sources,
      };
    }

    snapshot.fusedIntelligence = {
      trendStrength: fusedIntelligence.trendStrength,
      signalAgreement: fusedIntelligence.signalAgreement,
      dataQuality: fusedIntelligence.dataQuality,
      warnings: fusedIntelligence.warnings,
    };
  }

  if (strategy) {
    snapshot.strategyContext = {
      id: strategy.id,
      name: strategy.name,
      type: strategy.type,
      parameters: strategy.parameters,
    };
  }

  return snapshot;
}

export function generateReasoningSteps(
  input: InputSnapshot,
  decision: AIDecision
): ReasoningStep[] {
  const steps: ReasoningStep[] = [];
  let stepNum = 1;

  steps.push({
    step: stepNum++,
    category: "market_analysis",
    observation: `Current price: $${input.marketData.price.toFixed(2)}, 24h change: ${(input.marketData.changePercent24h || 0).toFixed(2)}%`,
    implication:
      input.marketData.changePercent24h && input.marketData.changePercent24h > 0
        ? "Positive short-term momentum"
        : input.marketData.changePercent24h &&
            input.marketData.changePercent24h < 0
          ? "Negative short-term momentum"
          : "Neutral price action",
    weight: 0.3,
  });

  if (input.sentiment) {
    steps.push({
      step: stepNum++,
      category: "sentiment_analysis",
      observation: `Sentiment: ${input.sentiment.overall} (score: ${input.sentiment.score.toFixed(2)}, confidence: ${(input.sentiment.confidence * 100).toFixed(0)}%)`,
      implication:
        input.sentiment.overall === "bullish"
          ? "Market sentiment supports buying"
          : input.sentiment.overall === "bearish"
            ? "Market sentiment suggests caution"
            : "Neutral sentiment, no strong directional bias",
      weight: 0.25,
    });
  }

  if (input.fundamentals) {
    const fundObs: string[] = [];
    if (input.fundamentals.peRatio !== undefined) {
      fundObs.push(`P/E: ${input.fundamentals.peRatio.toFixed(1)}`);
    }
    if (input.fundamentals.revenueGrowth !== undefined) {
      fundObs.push(
        `Revenue growth: ${(input.fundamentals.revenueGrowth * 100).toFixed(1)}%`
      );
    }

    if (fundObs.length > 0) {
      steps.push({
        step: stepNum++,
        category: "fundamental_analysis",
        observation: fundObs.join(", "),
        implication:
          input.fundamentals.revenueGrowth &&
          input.fundamentals.revenueGrowth > 0
            ? "Fundamentals indicate growth"
            : "Fundamentals suggest caution",
        weight: 0.2,
      });
    }
  }

  if (input.fusedIntelligence) {
    steps.push({
      step: stepNum++,
      category: "signal_synthesis",
      observation: `Signal agreement: ${(input.fusedIntelligence.signalAgreement * 100).toFixed(0)}%, Trend strength: ${(input.fusedIntelligence.trendStrength * 100).toFixed(0)}%`,
      implication:
        input.fusedIntelligence.signalAgreement > 0.7
          ? "Strong consensus across data sources"
          : input.fusedIntelligence.signalAgreement < 0.3
            ? "Conflicting signals suggest uncertainty"
            : "Mixed signals require careful evaluation",
      weight: 0.15,
    });
  }

  steps.push({
    step: stepNum++,
    category: "risk_assessment",
    observation: `Risk level: ${decision.riskLevel}, Confidence: ${(decision.confidence * 100).toFixed(0)}%`,
    implication:
      decision.riskLevel === "low"
        ? "Low risk supports position taking"
        : decision.riskLevel === "high"
          ? "High risk warrants smaller position or waiting"
          : "Moderate risk, proceed with caution",
    weight: 0.1,
  });

  steps.push({
    step: stepNum++,
    category: "final_decision",
    observation: `Action: ${decision.action.toUpperCase()}`,
    implication: decision.reasoning,
    weight: 1.0,
  });

  return steps;
}

export function generateAlternatives(
  input: InputSnapshot,
  chosenDecision: AIDecision
): AlternativeConsidered[] {
  const alternatives: AlternativeConsidered[] = [];
  const actions: ("buy" | "sell" | "hold")[] = ["buy", "sell", "hold"];

  for (const action of actions) {
    if (action === chosenDecision.action) continue;

    let confidence = 0;
    let reasoning = "";
    let whyRejected = "";

    switch (action) {
      case "buy":
        confidence = input.sentiment?.overall === "bullish" ? 0.4 : 0.2;
        if (
          input.marketData.changePercent24h &&
          input.marketData.changePercent24h > 0
        ) {
          confidence += 0.1;
        }
        reasoning = "Potential entry point based on market conditions";
        whyRejected =
          chosenDecision.action === "hold"
            ? "Insufficient conviction for entry"
            : "Better opportunity identified in opposite direction";
        break;

      case "sell":
        confidence = input.sentiment?.overall === "bearish" ? 0.4 : 0.2;
        if (
          input.marketData.changePercent24h &&
          input.marketData.changePercent24h < 0
        ) {
          confidence += 0.1;
        }
        reasoning = "Exit or short opportunity based on bearish signals";
        whyRejected =
          chosenDecision.action === "hold"
            ? "No existing position or insufficient bearish confirmation"
            : "Bullish signals outweigh bearish indicators";
        break;

      case "hold":
        confidence = 0.5;
        reasoning = "Wait for clearer signals before acting";
        whyRejected =
          chosenDecision.confidence > 0.6
            ? "Strong signals support taking action"
            : "Opportunity cost of waiting outweighed by potential gains";
        break;
    }

    alternatives.push({
      action,
      confidence,
      reasoning,
      whyRejected,
    });
  }

  alternatives.sort((a, b) => b.confidence - a.confidence);

  return alternatives;
}

export function createEnhancedDecisionLog(
  decision: AIDecision,
  marketData: MarketData,
  newsContext?: NewsContext,
  strategy?: StrategyContext,
  fusedIntelligence?: FusedMarketIntelligence,
  providerInfo?: Partial<EnhancedDecisionLog["providerInfo"]>,
  cycleId?: string
): EnhancedDecisionLog {
  const id = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const input = createInputSnapshot(
    marketData,
    newsContext,
    strategy,
    fusedIntelligence
  );
  const reasoning = generateReasoningSteps(input, decision);
  const alternatives = generateAlternatives(input, decision);

  const dataSourcesUsed: string[] = [];
  if (input.marketData) dataSourcesUsed.push("market_data");
  if (input.sentiment) dataSourcesUsed.push(...(input.sentiment.sources || []));
  if (input.fundamentals)
    dataSourcesUsed.push(...(input.fundamentals.sources || []));

  const keyFactors: string[] = [];
  const sortedSteps = [...reasoning].sort((a, b) => b.weight - a.weight);
  for (const step of sortedSteps.slice(0, 3)) {
    if (step.category !== "final_decision") {
      keyFactors.push(step.implication);
    }
  }

  const enhancedLog: EnhancedDecisionLog = {
    id,
    timestamp: new Date(),
    cycleId,
    input,
    reasoning: {
      steps: reasoning,
      summary: decision.reasoning,
      keyFactors,
    },
    alternatives,
    decision,
    providerInfo: {
      provider: providerInfo?.provider || "unknown",
      model: providerInfo?.model || "unknown",
      tokensUsed: providerInfo?.tokensUsed,
      latencyMs: providerInfo?.latencyMs,
      cost: providerInfo?.cost,
    },
    metadata: {
      dataSourcesUsed: [...new Set(dataSourcesUsed)],
      enrichmentApplied: !!fusedIntelligence,
      fusionConfidence: fusedIntelligence?.dataQuality.reliability || 0,
      warningCount: fusedIntelligence?.warnings.length || 0,
    },
  };

  log.ai("Enhanced decision logged", {
    id,
    symbol: marketData.symbol,
    action: decision.action,
    confidence: decision.confidence,
    alternativesCount: alternatives.length,
    reasoningSteps: reasoning.length,
  });

  return enhancedLog;
}

export function formatDecisionLogForDisplay(
  decisionLog: EnhancedDecisionLog
): string {
  const parts: string[] = [];

  parts.push(`=== AI Decision Log: ${decisionLog.id} ===`);
  parts.push(`Timestamp: ${decisionLog.timestamp.toISOString()}`);
  if (decisionLog.cycleId) {
    parts.push(`Cycle ID: ${decisionLog.cycleId}`);
  }

  parts.push(`\n--- INPUT SNAPSHOT ---`);
  parts.push(`Symbol: ${decisionLog.input.marketData.symbol}`);
  parts.push(`Price: $${decisionLog.input.marketData.price.toFixed(2)}`);
  if (decisionLog.input.marketData.changePercent24h !== undefined) {
    parts.push(
      `24h Change: ${decisionLog.input.marketData.changePercent24h.toFixed(2)}%`
    );
  }
  if (decisionLog.input.sentiment) {
    parts.push(
      `Sentiment: ${decisionLog.input.sentiment.overall} (score: ${decisionLog.input.sentiment.score.toFixed(2)})`
    );
  }
  if (decisionLog.input.fundamentals?.peRatio) {
    parts.push(
      `P/E Ratio: ${decisionLog.input.fundamentals.peRatio.toFixed(1)}`
    );
  }

  parts.push(`\n--- REASONING CHAIN ---`);
  for (const step of decisionLog.reasoning.steps) {
    parts.push(`${step.step}. [${step.category}] ${step.observation}`);
    parts.push(`   -> ${step.implication}`);
  }

  parts.push(`\n--- KEY FACTORS ---`);
  for (const factor of decisionLog.reasoning.keyFactors) {
    parts.push(`  * ${factor}`);
  }

  parts.push(`\n--- ALTERNATIVES CONSIDERED ---`);
  for (const alt of decisionLog.alternatives) {
    parts.push(
      `  ${alt.action.toUpperCase()}: ${(alt.confidence * 100).toFixed(0)}% confidence`
    );
    if (alt.whyRejected) {
      parts.push(`    Rejected: ${alt.whyRejected}`);
    }
  }

  parts.push(`\n--- FINAL DECISION ---`);
  parts.push(`Action: ${decisionLog.decision.action.toUpperCase()}`);
  parts.push(
    `Confidence: ${(decisionLog.decision.confidence * 100).toFixed(0)}%`
  );
  parts.push(`Risk Level: ${decisionLog.decision.riskLevel}`);
  parts.push(`Reasoning: ${decisionLog.decision.reasoning}`);

  parts.push(`\n--- PROVIDER INFO ---`);
  parts.push(`Provider: ${decisionLog.providerInfo.provider}`);
  parts.push(`Model: ${decisionLog.providerInfo.model}`);
  if (decisionLog.providerInfo.latencyMs) {
    parts.push(`Latency: ${decisionLog.providerInfo.latencyMs}ms`);
  }
  if (decisionLog.providerInfo.tokensUsed) {
    parts.push(`Tokens: ${decisionLog.providerInfo.tokensUsed}`);
  }

  parts.push(`\n--- METADATA ---`);
  parts.push(
    `Data Sources: ${decisionLog.metadata.dataSourcesUsed.join(", ")}`
  );
  parts.push(
    `Enrichment Applied: ${decisionLog.metadata.enrichmentApplied ? "Yes" : "No"}`
  );
  parts.push(`Warnings: ${decisionLog.metadata.warningCount}`);

  return parts.join("\n");
}
