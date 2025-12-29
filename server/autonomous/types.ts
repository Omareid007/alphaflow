/**
 * Autonomous Orchestrator Types
 *
 * This file contains all interfaces, types, and constants extracted from orchestrator.ts
 * for better modularity and separation of concerns.
 */

import { tradingConfig } from "../config/trading-config";
import type { AIDecision } from "../ai/decision-engine";

// ============================================================================
// CONFIG CONSTANTS (from tradingConfig)
// ============================================================================

export const DEFAULT_HARD_STOP_LOSS_PERCENT = tradingConfig.riskManagement.defaultHardStopLossPercent;
export const DEFAULT_TAKE_PROFIT_PERCENT = tradingConfig.riskManagement.defaultTakeProfitPercent;
export const MAX_STOCK_SYMBOLS_PER_CYCLE = tradingConfig.universe.maxStockSymbolsPerCycle;
export const MAX_CRYPTO_SYMBOLS_PER_CYCLE = tradingConfig.universe.maxCryptoSymbolsPerCycle;
export const ALPACA_SNAPSHOT_CHUNK_SIZE = tradingConfig.universe.alpacaSnapshotChunkSize;
export const MIN_CONFIDENCE_FOR_UNIVERSE = tradingConfig.universe.minConfidenceForUniverse;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Represents the symbols in the trading universe, categorized by asset type
 */
export interface UniverseSymbols {
  stocks: string[];
  crypto: string[];
  sources: {
    watchlist: number;
    candidates: number;
    recentDecisions: number;
    executedTrades: number;
  };
}

/**
 * Configuration for the autonomous orchestrator
 */
export interface OrchestratorConfig {
  analysisIntervalMs: number;
  positionCheckIntervalMs: number;
  enabled: boolean;
}

/**
 * Position with associated trading rules (stop loss, take profit, etc.)
 */
export interface PositionWithRules {
  symbol: string;
  quantity: number;
  availableQuantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  trailingStopPercent?: number;
  maxHoldingPeriodMs?: number;
  openedAt: Date;
  strategyId?: string;
}

/**
 * Risk limits for position sizing and exposure management
 */
export interface RiskLimits {
  maxPositionSizePercent: number;
  maxTotalExposurePercent: number;
  maxPositionsCount: number;
  dailyLossLimitPercent: number;
  killSwitchActive: boolean;
}

/**
 * Result of an order execution attempt
 */
export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  error?: string;
  action: "buy" | "sell" | "hold" | "skip";
  reason: string;
  symbol: string;
  quantity?: number;
  price?: number;
}

/**
 * Current state of the autonomous orchestrator
 */
export interface OrchestratorState {
  isRunning: boolean;
  mode: "autonomous" | "semi-auto" | "manual";
  lastAnalysisTime: Date | null;
  lastPositionCheckTime: Date | null;
  activePositions: Map<string, PositionWithRules>;
  pendingSignals: Map<string, AIDecision>;
  executionHistory: ExecutionResult[];
  dailyPnl: number;
  dailyTradeCount: number;
  portfolioValue?: number;
  errors: string[];
}

/**
 * State for rotating through symbols in the universe
 */
export interface UniverseRotationState {
  stockRotationOffset: number;
  cryptoRotationOffset: number;
  lastRotationTime: Date;
}

/**
 * Result from queued order execution via work queue
 */
export interface QueuedOrderResult {
  orderId: string;
  status: string;
  workItemId: string;
}

/**
 * Pre-trade validation check result
 */
export interface PreTradeCheck {
  canTrade: boolean;
  reason?: string;
  marketSession: "regular" | "pre_market" | "after_hours" | "closed";
  availableBuyingPower: number;
  requiredBuyingPower: number;
  useExtendedHours: boolean;
  useLimitOrder: boolean;
  limitPrice?: number;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default orchestrator configuration
 */
export const DEFAULT_CONFIG: OrchestratorConfig = {
  analysisIntervalMs: 60000,
  positionCheckIntervalMs: 30000,
  enabled: true,
};

/**
 * Default risk limits - values loaded from tradingConfig
 */
export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionSizePercent: tradingConfig.riskManagement.defaultMaxPositionSizePercent,
  maxTotalExposurePercent: tradingConfig.riskManagement.defaultMaxExposurePercent,
  maxPositionsCount: 100,              // AGGRESSIVE: Increased from 10 to enterprise-level 100 positions
  dailyLossLimitPercent: 5,            // Keep same for safety
  killSwitchActive: false,
};

// ============================================================================
// ADDITIONAL CONSTANTS
// ============================================================================

export const RECENT_DECISIONS_LOOKBACK = 500;
