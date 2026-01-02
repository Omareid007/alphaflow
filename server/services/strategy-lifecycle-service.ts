/**
 * Strategy Lifecycle Service
 *
 * Manages strategy state transitions and coordinates with the trading engine.
 * Implements the strategy lifecycle state machine:
 *
 * draft → backtesting → paper/live → paused → stopped → draft
 *
 * Key features:
 * - Valid transition enforcement
 * - Backtest gate for live deployment
 * - Position management on stop
 * - Performance tracking
 */

import { storage } from "../storage";
import { log } from "../utils/logger";
import type {
  Strategy,
  StrategyStatus,
  TradingMode,
  PerformanceSummary,
} from "@shared/schema/trading";

// ============================================================================
// TYPES
// ============================================================================

export interface LifecycleResult {
  success: boolean;
  error?: string;
  strategy?: Strategy;
  requiresConfirmation?: boolean;
  positionCount?: number;
  message?: string;
}

// ============================================================================
// STATE MACHINE
// ============================================================================

/**
 * Valid state transitions for strategy lifecycle
 *
 * Flow options:
 * 1. Quick test: draft → paper → live (paper trading doesn't require backtest)
 * 2. Full validation: draft → backtesting → backtested → paper/live
 * 3. Live requires backtest: draft → live is blocked (must backtest first)
 */
const VALID_TRANSITIONS: Record<StrategyStatus, StrategyStatus[]> = {
  draft: ["backtesting", "paper"], // Can go to paper directly, or backtest first
  backtesting: ["draft", "backtested", "paper", "live"],
  backtested: ["backtesting", "paper", "live"],
  paper: ["paused", "stopped", "live"],
  live: ["paused", "stopped"],
  paused: ["paper", "live", "stopped"],
  stopped: ["draft"],
};

/**
 * Check if a transition is valid
 */
function isValidTransition(from: StrategyStatus, to: StrategyStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class StrategyLifecycleService {
  /**
   * Deploy a strategy to paper or live trading
   *
   * @param strategyId - Strategy to deploy
   * @param mode - 'paper' or 'live'
   * @returns Result with success status and updated strategy
   */
  async deployStrategy(
    strategyId: string,
    mode: TradingMode
  ): Promise<LifecycleResult> {
    const strategy = await storage.getStrategy(strategyId);

    if (!strategy) {
      return { success: false, error: "Strategy not found" };
    }

    const currentStatus = (strategy.status as StrategyStatus) || "draft";
    const targetStatus: StrategyStatus = mode;

    // Check valid transition
    if (!isValidTransition(currentStatus, targetStatus)) {
      const validSources = Object.entries(VALID_TRANSITIONS)
        .filter(([_, targets]) => targets.includes(targetStatus))
        .map(([source]) => source);
      return {
        success: false,
        error: `Cannot deploy to '${targetStatus}' from '${currentStatus}' status. Valid source states: ${validSources.join(", ")}.`,
      };
    }

    // Require backtest for live deployment (user preference: mandatory)
    if (mode === "live" && !strategy.lastBacktestId) {
      return {
        success: false,
        error: "A successful backtest is required before live deployment",
      };
    }

    // Update strategy status
    const updated = await storage.updateStrategyStatus(
      strategyId,
      targetStatus,
      mode
    );

    if (!updated) {
      return { success: false, error: "Failed to update strategy status" };
    }

    log.info("StrategyLifecycle", `Strategy deployed to ${mode}`, {
      strategyId,
      strategyName: strategy.name,
      previousStatus: currentStatus,
      newStatus: targetStatus,
    });

    return { success: true, strategy: updated };
  }

  /**
   * Pause a running strategy
   *
   * @param strategyId - Strategy to pause
   * @returns Result with success status
   */
  async pauseStrategy(strategyId: string): Promise<LifecycleResult> {
    const strategy = await storage.getStrategy(strategyId);

    if (!strategy) {
      return { success: false, error: "Strategy not found" };
    }

    const currentStatus = (strategy.status as StrategyStatus) || "draft";

    // Can only pause running strategies
    if (!["paper", "live"].includes(currentStatus)) {
      return {
        success: false,
        error: `Cannot pause strategy in '${currentStatus}' status. Must be 'paper' or 'live'.`,
      };
    }

    // Preserve the mode so we can resume to the same state
    const currentMode = (strategy.mode as TradingMode) || "paper";
    const updated = await storage.updateStrategyStatus(
      strategyId,
      "paused",
      currentMode
    );

    if (!updated) {
      return { success: false, error: "Failed to pause strategy" };
    }

    log.info("StrategyLifecycle", "Strategy paused", {
      strategyId,
      strategyName: strategy.name,
      previousStatus: currentStatus,
      preservedMode: currentMode,
    });

    return { success: true, strategy: updated };
  }

  /**
   * Resume a paused strategy
   *
   * @param strategyId - Strategy to resume
   * @returns Result with success status
   */
  async resumeStrategy(strategyId: string): Promise<LifecycleResult> {
    const strategy = await storage.getStrategy(strategyId);

    if (!strategy) {
      return { success: false, error: "Strategy not found" };
    }

    const currentStatus = (strategy.status as StrategyStatus) || "draft";

    if (currentStatus !== "paused") {
      return {
        success: false,
        error: `Cannot resume strategy in '${currentStatus}' status. Must be 'paused'.`,
      };
    }

    // Resume to the preserved mode
    const targetMode = (strategy.mode as TradingMode) || "paper";
    const targetStatus: StrategyStatus = targetMode;

    const updated = await storage.updateStrategyStatus(
      strategyId,
      targetStatus,
      targetMode
    );

    if (!updated) {
      return { success: false, error: "Failed to resume strategy" };
    }

    log.info("StrategyLifecycle", "Strategy resumed", {
      strategyId,
      strategyName: strategy.name,
      newStatus: targetStatus,
    });

    return { success: true, strategy: updated };
  }

  /**
   * Stop a strategy completely
   *
   * @param strategyId - Strategy to stop
   * @param closePositions - Whether to close open positions (undefined = prompt user)
   * @returns Result with success status or confirmation request
   */
  async stopStrategy(
    strategyId: string,
    closePositions?: boolean
  ): Promise<LifecycleResult> {
    const strategy = await storage.getStrategy(strategyId);

    if (!strategy) {
      return { success: false, error: "Strategy not found" };
    }

    const currentStatus = (strategy.status as StrategyStatus) || "draft";

    // Check valid transition
    if (!isValidTransition(currentStatus, "stopped")) {
      return {
        success: false,
        error: `Cannot stop strategy in '${currentStatus}' status.`,
      };
    }

    // Check for open positions (user preference: ask each time)
    const positions = await storage.getPositionsByStrategy(strategyId);

    if (closePositions === undefined && positions.length > 0) {
      return {
        success: false,
        requiresConfirmation: true,
        positionCount: positions.length,
        message: `Strategy has ${positions.length} open position(s). Do you want to close them?`,
      };
    }

    // Close positions if requested
    if (closePositions && positions.length > 0) {
      log.info("StrategyLifecycle", "Closing positions before stop", {
        strategyId,
        positionCount: positions.length,
        symbols: positions.map((p) => p.symbol),
      });

      // Import alpaca connector dynamically to avoid circular dependency
      try {
        const { alpaca } = await import("../connectors/alpaca");
        for (const pos of positions) {
          try {
            await alpaca.closePosition(pos.symbol);
            log.info("StrategyLifecycle", `Closed position for ${pos.symbol}`);
          } catch (error) {
            log.error(
              "StrategyLifecycle",
              `Failed to close position ${pos.symbol}`,
              {
                error,
              }
            );
          }
        }
      } catch (error) {
        log.error("StrategyLifecycle", "Failed to import alpaca connector", {
          error,
        });
      }
    }

    // Update strategy status (clear mode on stop)
    const updated = await storage.updateStrategyStatus(
      strategyId,
      "stopped",
      undefined
    );

    if (!updated) {
      return { success: false, error: "Failed to stop strategy" };
    }

    log.info("StrategyLifecycle", "Strategy stopped", {
      strategyId,
      strategyName: strategy.name,
      previousStatus: currentStatus,
      positionsClosed: closePositions && positions.length > 0,
    });

    return { success: true, strategy: updated };
  }

  /**
   * Start backtesting for a strategy
   *
   * @param strategyId - Strategy to backtest
   * @returns Result with success status
   */
  async startBacktest(strategyId: string): Promise<LifecycleResult> {
    const strategy = await storage.getStrategy(strategyId);

    if (!strategy) {
      return { success: false, error: "Strategy not found" };
    }

    const currentStatus = (strategy.status as StrategyStatus) || "draft";

    if (currentStatus !== "draft") {
      return {
        success: false,
        error: `Cannot start backtest from '${currentStatus}' status. Must be 'draft'.`,
      };
    }

    const updated = await storage.updateStrategyStatus(
      strategyId,
      "backtesting",
      undefined
    );

    if (!updated) {
      return { success: false, error: "Failed to start backtest" };
    }

    log.info("StrategyLifecycle", "Backtest started", {
      strategyId,
      strategyName: strategy.name,
    });

    return { success: true, strategy: updated };
  }

  /**
   * Complete backtesting and return to draft (or ready for deployment)
   *
   * @param strategyId - Strategy that completed backtesting
   * @param backtestId - ID of the completed backtest run
   * @param performance - Performance summary from backtest
   * @returns Result with success status
   */
  async completeBacktest(
    strategyId: string,
    backtestId: string,
    performance?: PerformanceSummary
  ): Promise<LifecycleResult> {
    const strategy = await storage.getStrategy(strategyId);

    if (!strategy) {
      return { success: false, error: "Strategy not found" };
    }

    // Update the strategy with backtest results
    const updated = await storage.updateStrategy(strategyId, {
      status: "draft", // Return to draft, ready for deployment
      lastBacktestId: backtestId,
      performanceSummary: performance
        ? { ...performance, lastUpdated: new Date().toISOString() }
        : undefined,
    });

    if (!updated) {
      return { success: false, error: "Failed to complete backtest" };
    }

    log.info("StrategyLifecycle", "Backtest completed", {
      strategyId,
      strategyName: strategy.name,
      backtestId,
      performance,
    });

    return { success: true, strategy: updated };
  }

  /**
   * Reset a stopped strategy to draft
   *
   * @param strategyId - Strategy to reset
   * @returns Result with success status
   */
  async resetToDraft(strategyId: string): Promise<LifecycleResult> {
    const strategy = await storage.getStrategy(strategyId);

    if (!strategy) {
      return { success: false, error: "Strategy not found" };
    }

    const currentStatus = (strategy.status as StrategyStatus) || "draft";

    if (currentStatus !== "stopped") {
      return {
        success: false,
        error: `Cannot reset strategy in '${currentStatus}' status. Must be 'stopped'.`,
      };
    }

    const updated = await storage.updateStrategyStatus(
      strategyId,
      "draft",
      undefined
    );

    if (!updated) {
      return { success: false, error: "Failed to reset strategy" };
    }

    log.info("StrategyLifecycle", "Strategy reset to draft", {
      strategyId,
      strategyName: strategy.name,
    });

    return { success: true, strategy: updated };
  }

  /**
   * Get the current status of a strategy
   */
  async getStrategyStatus(
    strategyId: string
  ): Promise<{ status: StrategyStatus; mode: TradingMode | null } | null> {
    const strategy = await storage.getStrategy(strategyId);

    if (!strategy) {
      return null;
    }

    return {
      status: (strategy.status as StrategyStatus) || "draft",
      mode: (strategy.mode as TradingMode) || null,
    };
  }

  /**
   * Get all strategies that are currently active (paper or live)
   */
  async getRunningStrategies(): Promise<Strategy[]> {
    return storage.getActiveStrategies();
  }

  /**
   * Calculate and update performance summary for a strategy
   */
  async updatePerformanceMetrics(strategyId: string): Promise<LifecycleResult> {
    const strategy = await storage.getStrategy(strategyId);

    if (!strategy) {
      return { success: false, error: "Strategy not found" };
    }

    // Get trades for this strategy
    const strategyTrades = await storage.getTradesByStrategy(strategyId, 1000);

    if (strategyTrades.length === 0) {
      return {
        success: true,
        strategy,
        message: "No trades to calculate metrics",
      };
    }

    // Calculate metrics
    const closedTrades = strategyTrades.filter((t) => t.pnl !== null);
    const totalPnl = closedTrades.reduce(
      (sum, t) => sum + parseFloat(t.pnl || "0"),
      0
    );
    const winningTrades = closedTrades.filter(
      (t) => parseFloat(t.pnl || "0") > 0
    );
    const losingTrades = closedTrades.filter(
      (t) => parseFloat(t.pnl || "0") < 0
    );

    const winRate =
      closedTrades.length > 0
        ? (winningTrades.length / closedTrades.length) * 100
        : 0;

    // Calculate Sharpe ratio approximation (simplified)
    const returns = closedTrades.map((t) => parseFloat(t.pnl || "0"));
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
        returns.length
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;
    for (const trade of closedTrades) {
      cumulative += parseFloat(trade.pnl || "0");
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = peak > 0 ? ((peak - cumulative) / peak) * 100 : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const performanceSummary: PerformanceSummary = {
      totalReturn: totalPnl,
      winRate,
      sharpeRatio,
      maxDrawdown,
      totalTrades: closedTrades.length,
      lastUpdated: new Date().toISOString(),
    };

    const updated = await storage.updateStrategyPerformance(
      strategyId,
      performanceSummary
    );

    if (!updated) {
      return { success: false, error: "Failed to update performance metrics" };
    }

    log.info("StrategyLifecycle", "Performance metrics updated", {
      strategyId,
      metrics: performanceSummary,
    });

    return { success: true, strategy: updated };
  }
}

// Export singleton instance
export const strategyLifecycleService = new StrategyLifecycleService();
