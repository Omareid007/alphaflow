/**
 * Strategy Execution Context
 *
 * Provides the bridge between strategy configuration and order execution.
 * This module ensures that strategy parameters (position sizing, entry rules,
 * bracket orders) are properly applied during trading.
 *
 * Key responsibilities:
 * - Parse strategy config into execution parameters
 * - Validate AI decisions against strategy rules
 * - Calculate position sizes based on strategy config
 * - Generate bracket order parameters from strategy config
 */

import { log } from "../utils/logger";
import type { Strategy, StrategyConfig } from "@shared/schema/trading";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Entry rules for strategy execution
 */
export interface EntryRules {
  minConfidence: number; // 0-1, minimum confidence to enter (default 0.7)
  maxPositions: number; // Max concurrent positions (default 10)
  excludeSymbols: string[]; // Never trade these symbols
  includeSymbols: string[]; // Only trade these symbols (if set)
}

/**
 * Position sizing configuration
 */
export interface PositionSizing {
  type: "percent" | "fixed" | "risk_based";
  value: number; // % of portfolio or fixed $ or risk %
  maxNotional: number; // Max $ per position (default 50000)
  minNotional: number; // Min $ per position (default 100)
}

/**
 * Bracket order configuration
 */
export interface BracketOrderConfig {
  enabled: boolean;
  takeProfitPercent: number; // Default 10%
  stopLossPercent: number; // Default 5%
  trailingStopPercent?: number;
  useTrailingStop: boolean;
}

/**
 * Order execution configuration
 */
export interface OrderExecutionConfig {
  timeInForce: "day" | "gtc" | "ioc" | "fok";
  orderType: "market" | "limit";
  limitOffsetPercent: number; // For limit orders, offset from current price
  extendedHours: boolean;
}

/**
 * Exit rules configuration
 */
export interface ExitRules {
  maxHoldingPeriodHours?: number;
  profitTargetPercent?: number;
  lossLimitPercent?: number;
}

/**
 * Complete strategy execution parameters
 */
export interface StrategyExecutionParams {
  entryRules: EntryRules;
  positionSizing: PositionSizing;
  bracketOrders: BracketOrderConfig;
  orderExecution: OrderExecutionConfig;
  exitRules: ExitRules;
}

/**
 * Full execution context with strategy metadata
 */
export interface StrategyExecutionContext {
  strategyId: string;
  strategyName: string;
  strategyType: string;
  mode: "paper" | "live" | null;
  params: StrategyExecutionParams;
}

/**
 * AI Decision interface for validation
 */
export interface AIDecision {
  symbol: string;
  action: "buy" | "sell" | "hold";
  confidence: number;
  reasoning?: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  quantity?: number;
}

/**
 * Validation result for AI decisions
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  warnings?: string[];
}

/**
 * Position size calculation result
 */
export interface PositionSizeResult {
  notional: number;
  quantity: number;
  warnings?: string[];
}

/**
 * Bracket order parameters
 */
export interface BracketOrderParams {
  takeProfitPrice?: number;
  stopLossPrice?: number;
  trailingStopPercent?: number;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_ENTRY_RULES: EntryRules = {
  minConfidence: 0.7,
  maxPositions: 10,
  excludeSymbols: [],
  includeSymbols: [],
};

const DEFAULT_POSITION_SIZING: PositionSizing = {
  type: "percent",
  value: 5, // 5% of portfolio
  maxNotional: 50000,
  minNotional: 100,
};

const DEFAULT_BRACKET_ORDERS: BracketOrderConfig = {
  enabled: false,
  takeProfitPercent: 10,
  stopLossPercent: 5,
  useTrailingStop: false,
};

const DEFAULT_ORDER_EXECUTION: OrderExecutionConfig = {
  timeInForce: "day",
  orderType: "market",
  limitOffsetPercent: 0.1,
  extendedHours: false,
};

const DEFAULT_EXIT_RULES: ExitRules = {
  maxHoldingPeriodHours: undefined,
  profitTargetPercent: undefined,
  lossLimitPercent: undefined,
};

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

/**
 * Parse a Strategy object into execution parameters
 */
export function parseStrategyParams(
  config?: StrategyConfig | null
): StrategyExecutionParams {
  if (!config) {
    return {
      entryRules: DEFAULT_ENTRY_RULES,
      positionSizing: DEFAULT_POSITION_SIZING,
      bracketOrders: DEFAULT_BRACKET_ORDERS,
      orderExecution: DEFAULT_ORDER_EXECUTION,
      exitRules: DEFAULT_EXIT_RULES,
    };
  }

  return {
    entryRules: {
      minConfidence:
        config.entryRules?.minConfidence ?? DEFAULT_ENTRY_RULES.minConfidence,
      maxPositions:
        config.entryRules?.maxPositions ?? DEFAULT_ENTRY_RULES.maxPositions,
      excludeSymbols:
        config.entryRules?.excludeSymbols ?? DEFAULT_ENTRY_RULES.excludeSymbols,
      includeSymbols:
        config.entryRules?.includeSymbols ?? DEFAULT_ENTRY_RULES.includeSymbols,
    },
    positionSizing: {
      type: config.positionSizing?.type ?? DEFAULT_POSITION_SIZING.type,
      value: config.positionSizing?.value ?? DEFAULT_POSITION_SIZING.value,
      maxNotional:
        config.positionSizing?.maxNotional ??
        DEFAULT_POSITION_SIZING.maxNotional,
      minNotional:
        config.positionSizing?.minNotional ??
        DEFAULT_POSITION_SIZING.minNotional,
    },
    bracketOrders: {
      enabled: config.bracketOrders?.enabled ?? DEFAULT_BRACKET_ORDERS.enabled,
      takeProfitPercent:
        config.bracketOrders?.takeProfitPercent ??
        DEFAULT_BRACKET_ORDERS.takeProfitPercent,
      stopLossPercent:
        config.bracketOrders?.stopLossPercent ??
        DEFAULT_BRACKET_ORDERS.stopLossPercent,
      trailingStopPercent: config.bracketOrders?.trailingStopPercent,
      useTrailingStop:
        config.bracketOrders?.useTrailingStop ??
        DEFAULT_BRACKET_ORDERS.useTrailingStop,
    },
    orderExecution: {
      timeInForce:
        config.orderExecution?.timeInForce ??
        DEFAULT_ORDER_EXECUTION.timeInForce,
      orderType:
        config.orderExecution?.orderType ?? DEFAULT_ORDER_EXECUTION.orderType,
      limitOffsetPercent:
        config.orderExecution?.limitOffsetPercent ??
        DEFAULT_ORDER_EXECUTION.limitOffsetPercent,
      extendedHours:
        config.orderExecution?.extendedHours ??
        DEFAULT_ORDER_EXECUTION.extendedHours,
    },
    exitRules: {
      maxHoldingPeriodHours: config.exitRules?.maxHoldingPeriodHours,
      profitTargetPercent: config.exitRules?.profitTargetPercent,
      lossLimitPercent: config.exitRules?.lossLimitPercent,
    },
  };
}

/**
 * Create a full execution context from a Strategy object
 */
export function parseStrategyContext(
  strategy: Strategy
): StrategyExecutionContext {
  const config = strategy.config as StrategyConfig | null;

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    strategyType: strategy.type,
    mode: (strategy.mode as "paper" | "live") || null,
    params: parseStrategyParams(config),
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate an AI decision against strategy rules
 */
export function validateDecision(
  decision: AIDecision,
  context: StrategyExecutionContext,
  currentPositionCount: number
): ValidationResult {
  const warnings: string[] = [];
  const rules = context.params.entryRules;

  // Check exclude list
  if (
    rules.excludeSymbols.length > 0 &&
    rules.excludeSymbols.includes(decision.symbol)
  ) {
    return {
      valid: false,
      reason: `Symbol ${decision.symbol} is in the exclude list`,
    };
  }

  // Check include list (if set)
  if (
    rules.includeSymbols.length > 0 &&
    !rules.includeSymbols.includes(decision.symbol)
  ) {
    return {
      valid: false,
      reason: `Symbol ${decision.symbol} is not in the include list`,
    };
  }

  // Check max positions (only for buys)
  if (decision.action === "buy" && currentPositionCount >= rules.maxPositions) {
    return {
      valid: false,
      reason: `Maximum positions (${rules.maxPositions}) reached`,
    };
  }

  // Check minimum confidence
  if (decision.confidence < rules.minConfidence) {
    return {
      valid: false,
      reason: `Confidence ${(decision.confidence * 100).toFixed(1)}% is below minimum ${(rules.minConfidence * 100).toFixed(1)}%`,
    };
  }

  // Warnings for borderline confidence
  if (decision.confidence < rules.minConfidence + 0.1) {
    warnings.push(`Confidence is just above minimum threshold`);
  }

  // Warning for approaching max positions
  if (
    decision.action === "buy" &&
    currentPositionCount >= rules.maxPositions - 2
  ) {
    warnings.push(
      `Approaching maximum positions (${currentPositionCount}/${rules.maxPositions})`
    );
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================================================
// POSITION SIZING FUNCTIONS
// ============================================================================

/**
 * Calculate position size based on strategy configuration
 */
export function calculatePositionSize(
  context: StrategyExecutionContext,
  portfolioValue: number,
  currentPrice: number
): PositionSizeResult {
  const sizing = context.params.positionSizing;
  const warnings: string[] = [];

  let notional: number;

  switch (sizing.type) {
    case "percent":
      notional = portfolioValue * (sizing.value / 100);
      break;
    case "fixed":
      notional = sizing.value;
      break;
    case "risk_based":
      // Risk-based sizing: value is the % of portfolio to risk per trade
      // Assume 2% stop loss, so position size = risk / stop_loss_pct
      const riskAmount = portfolioValue * (sizing.value / 100);
      const assumedStopLossPct =
        context.params.bracketOrders.stopLossPercent / 100;
      notional = riskAmount / assumedStopLossPct;
      break;
    default:
      notional = portfolioValue * 0.05; // Default 5%
  }

  // Apply min/max constraints
  if (notional > sizing.maxNotional) {
    warnings.push(`Position capped at max notional $${sizing.maxNotional}`);
    notional = sizing.maxNotional;
  }

  if (notional < sizing.minNotional) {
    warnings.push(`Position below min notional $${sizing.minNotional}`);
    notional = sizing.minNotional;
  }

  // Calculate quantity
  const quantity = Math.floor(notional / currentPrice);

  // Check if we can afford at least 1 share
  if (quantity < 1) {
    return {
      notional: 0,
      quantity: 0,
      warnings: [`Cannot afford 1 share at $${currentPrice.toFixed(2)}`],
    };
  }

  // Recalculate actual notional based on whole shares
  const actualNotional = quantity * currentPrice;

  return {
    notional: actualNotional,
    quantity,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Calculate bracket order prices based on strategy configuration
 */
export function calculateBracketOrderParams(
  context: StrategyExecutionContext,
  entryPrice: number,
  side: "buy" | "sell"
): BracketOrderParams | null {
  const bracket = context.params.bracketOrders;

  if (!bracket.enabled) {
    return null;
  }

  let takeProfitPrice: number;
  let stopLossPrice: number;

  if (side === "buy") {
    // Long position: take profit above, stop loss below
    takeProfitPrice = entryPrice * (1 + bracket.takeProfitPercent / 100);
    stopLossPrice = entryPrice * (1 - bracket.stopLossPercent / 100);
  } else {
    // Short position: take profit below, stop loss above
    takeProfitPrice = entryPrice * (1 - bracket.takeProfitPercent / 100);
    stopLossPrice = entryPrice * (1 + bracket.stopLossPercent / 100);
  }

  return {
    takeProfitPrice: Math.round(takeProfitPrice * 100) / 100,
    stopLossPrice: Math.round(stopLossPrice * 100) / 100,
    trailingStopPercent: bracket.useTrailingStop
      ? bracket.trailingStopPercent
      : undefined,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a strategy is configured for live trading
 */
export function isLiveStrategy(context: StrategyExecutionContext): boolean {
  return context.mode === "live";
}

/**
 * Check if bracket orders are enabled for a strategy
 */
export function hasBracketOrders(context: StrategyExecutionContext): boolean {
  return context.params.bracketOrders.enabled;
}

/**
 * Get the time-in-force setting for a strategy
 */
export function getTimeInForce(
  context: StrategyExecutionContext
): "day" | "gtc" | "ioc" | "fok" {
  return context.params.orderExecution.timeInForce;
}

/**
 * Get the order type setting for a strategy
 */
export function getOrderType(
  context: StrategyExecutionContext
): "market" | "limit" {
  return context.params.orderExecution.orderType;
}

/**
 * Calculate limit price based on current price and strategy config
 */
export function calculateLimitPrice(
  context: StrategyExecutionContext,
  currentPrice: number,
  side: "buy" | "sell"
): number {
  const offsetPct = context.params.orderExecution.limitOffsetPercent / 100;

  if (side === "buy") {
    // For buy orders, set limit slightly above current price
    return Math.round(currentPrice * (1 + offsetPct) * 100) / 100;
  } else {
    // For sell orders, set limit slightly below current price
    return Math.round(currentPrice * (1 - offsetPct) * 100) / 100;
  }
}

/**
 * Log execution context for debugging
 */
export function logExecutionContext(context: StrategyExecutionContext): void {
  log.debug("ExecutionContext", "Strategy execution context", {
    strategyId: context.strategyId,
    strategyName: context.strategyName,
    mode: context.mode,
    entryRules: {
      minConfidence: context.params.entryRules.minConfidence,
      maxPositions: context.params.entryRules.maxPositions,
      excludeCount: context.params.entryRules.excludeSymbols.length,
      includeCount: context.params.entryRules.includeSymbols.length,
    },
    positionSizing: context.params.positionSizing,
    bracketOrders: {
      enabled: context.params.bracketOrders.enabled,
      takeProfit: context.params.bracketOrders.takeProfitPercent,
      stopLoss: context.params.bracketOrders.stopLossPercent,
    },
    orderExecution: context.params.orderExecution,
  });
}
