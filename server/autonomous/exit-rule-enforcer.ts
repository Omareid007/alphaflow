/**
 * Exit Rule Enforcer
 *
 * Monitors positions and enforces exit rules defined in strategy configuration:
 * - Profit target: Auto-close when position reaches target profit %
 * - Stop loss: Auto-close when position hits loss limit %
 * - Time-based: Auto-close after max holding period
 * - Trailing stop: Adjust stop loss as price moves favorably
 *
 * This module runs as a background process checking positions against their
 * strategy's exit rules and triggering exits when conditions are met.
 */

import { log } from "../utils/logger";
import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { strategyOrderService } from "../trading/strategy-order-service";
import {
  parseStrategyContext,
  type ExitRules,
} from "./strategy-execution-context";
import type { Strategy } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

export interface PositionWithStrategy {
  symbol: string;
  strategyId: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  entryTime: Date;
  holdingPeriodHours: number;
}

export interface ExitDecision {
  shouldExit: boolean;
  reason?: string;
  exitType?:
    | "profit_target"
    | "stop_loss"
    | "time_exit"
    | "trailing_stop"
    | "manual";
  priority: number; // Higher = more urgent
}

export interface ExitResult {
  symbol: string;
  strategyId: string;
  success: boolean;
  exitType: string;
  orderId?: string;
  error?: string;
}

export interface EnforcerStatistics {
  totalChecks: number;
  exitTriggered: number;
  profitTargetExits: number;
  stopLossExits: number;
  timeExits: number;
  trailingStopExits: number;
  failedExits: number;
}

// ============================================================================
// EXIT RULE ENFORCER
// ============================================================================

class ExitRuleEnforcer {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private statistics: EnforcerStatistics = {
    totalChecks: 0,
    exitTriggered: 0,
    profitTargetExits: 0,
    stopLossExits: 0,
    timeExits: 0,
    trailingStopExits: 0,
    failedExits: 0,
  };

  // Track trailing stop high water marks
  private trailingStopHighs = new Map<string, number>();

  // DEPRECATED: Position entry times now come from database (TE-001 fix)
  // Kept for backward compatibility with recordPositionEntry() calls
  private positionEntryTimes = new Map<string, Date>();

  private readonly DEFAULT_CHECK_INTERVAL_MS = 30000; // 30 seconds

  /**
   * Start the exit rule enforcer
   */
  start(intervalMs = this.DEFAULT_CHECK_INTERVAL_MS): void {
    if (this.isRunning) {
      log.warn("ExitRuleEnforcer", "Already running");
      return;
    }

    this.isRunning = true;
    log.info("ExitRuleEnforcer", "Starting exit rule enforcer", {
      intervalMs,
    });

    // Run immediately and then at intervals
    this.checkAllPositions();
    this.checkInterval = setInterval(() => {
      this.checkAllPositions();
    }, intervalMs);
  }

  /**
   * Stop the exit rule enforcer
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    log.info("ExitRuleEnforcer", "Stopped exit rule enforcer");
  }

  /**
   * Check all positions against their strategy exit rules
   */
  async checkAllPositions(): Promise<ExitResult[]> {
    this.statistics.totalChecks++;
    const results: ExitResult[] = [];

    try {
      // Get all positions
      const positions = await this.getPositionsWithStrategy();

      log.debug("ExitRuleEnforcer", "Checking positions", {
        positionCount: positions.length,
      });

      for (const position of positions) {
        const result = await this.checkPosition(position);
        if (result) {
          results.push(result);
        }
      }

      return results;
    } catch (error) {
      log.error("ExitRuleEnforcer", "Error checking positions", {
        error: error instanceof Error ? error.message : String(error),
      });
      return results;
    }
  }

  /**
   * Check a single position against its strategy exit rules
   */
  async checkPosition(
    position: PositionWithStrategy
  ): Promise<ExitResult | null> {
    try {
      // Get strategy and exit rules
      const strategy = await storage.getStrategy(position.strategyId);
      if (!strategy) {
        log.warn("ExitRuleEnforcer", "Strategy not found for position", {
          strategyId: position.strategyId,
          symbol: position.symbol,
        });
        return null;
      }

      const context = parseStrategyContext(strategy);
      const exitRules = context.params.exitRules;
      const bracketOrders = context.params.bracketOrders;

      // Evaluate exit decision
      const decision = this.evaluateExitRules(
        position,
        exitRules,
        bracketOrders
      );

      if (!decision.shouldExit) {
        return null;
      }

      log.info("ExitRuleEnforcer", "Exit triggered", {
        symbol: position.symbol,
        strategyId: position.strategyId,
        exitType: decision.exitType,
        reason: decision.reason,
        pnlPercent: position.unrealizedPnlPercent.toFixed(2),
      });

      // Execute exit
      const exitResult = await this.executeExit(position, decision);

      // Update statistics
      this.statistics.exitTriggered++;
      switch (decision.exitType) {
        case "profit_target":
          this.statistics.profitTargetExits++;
          break;
        case "stop_loss":
          this.statistics.stopLossExits++;
          break;
        case "time_exit":
          this.statistics.timeExits++;
          break;
        case "trailing_stop":
          this.statistics.trailingStopExits++;
          break;
      }

      if (!exitResult.success) {
        this.statistics.failedExits++;
      }

      return exitResult;
    } catch (error) {
      log.error("ExitRuleEnforcer", "Error checking position", {
        symbol: position.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Evaluate exit rules for a position
   */
  private evaluateExitRules(
    position: PositionWithStrategy,
    exitRules: ExitRules,
    bracketOrders: {
      enabled: boolean;
      takeProfitPercent: number;
      stopLossPercent: number;
      trailingStopPercent?: number;
      useTrailingStop: boolean;
    }
  ): ExitDecision {
    const decisions: ExitDecision[] = [];

    // 1. Check profit target
    const profitTarget =
      exitRules.profitTargetPercent ?? bracketOrders.takeProfitPercent;
    if (profitTarget && position.unrealizedPnlPercent >= profitTarget) {
      decisions.push({
        shouldExit: true,
        reason: `Profit target ${profitTarget}% reached (current: ${position.unrealizedPnlPercent.toFixed(2)}%)`,
        exitType: "profit_target",
        priority: 3, // Medium priority - can wait a bit for better execution
      });
    }

    // 2. Check stop loss
    const stopLoss =
      exitRules.lossLimitPercent ?? bracketOrders.stopLossPercent;
    if (stopLoss && position.unrealizedPnlPercent <= -stopLoss) {
      decisions.push({
        shouldExit: true,
        reason: `Stop loss ${stopLoss}% triggered (current: ${position.unrealizedPnlPercent.toFixed(2)}%)`,
        exitType: "stop_loss",
        priority: 5, // High priority - exit immediately
      });
    }

    // 3. Check trailing stop
    if (bracketOrders.useTrailingStop && bracketOrders.trailingStopPercent) {
      const trailingDecision = this.evaluateTrailingStop(
        position,
        bracketOrders.trailingStopPercent
      );
      if (trailingDecision.shouldExit) {
        decisions.push(trailingDecision);
      }
    }

    // 4. Check max holding period
    if (
      exitRules.maxHoldingPeriodHours &&
      position.holdingPeriodHours >= exitRules.maxHoldingPeriodHours
    ) {
      decisions.push({
        shouldExit: true,
        reason: `Max holding period ${exitRules.maxHoldingPeriodHours}h exceeded (current: ${position.holdingPeriodHours.toFixed(1)}h)`,
        exitType: "time_exit",
        priority: 2, // Lower priority - time-based exits can be more flexible
      });
    }

    // Return highest priority exit decision
    if (decisions.length === 0) {
      return { shouldExit: false, priority: 0 };
    }

    decisions.sort((a, b) => b.priority - a.priority);
    return decisions[0];
  }

  /**
   * Evaluate trailing stop
   */
  private evaluateTrailingStop(
    position: PositionWithStrategy,
    trailingStopPercent: number
  ): ExitDecision {
    const key = `${position.strategyId}:${position.symbol}`;

    // Get or set high water mark
    const currentHigh = this.trailingStopHighs.get(key) || position.entryPrice;
    const newHigh = Math.max(currentHigh, position.currentPrice);
    this.trailingStopHighs.set(key, newHigh);

    // Calculate trailing stop level
    const trailingStopPrice = newHigh * (1 - trailingStopPercent / 100);
    const dropFromHigh = ((newHigh - position.currentPrice) / newHigh) * 100;

    if (position.currentPrice <= trailingStopPrice) {
      return {
        shouldExit: true,
        reason: `Trailing stop triggered: dropped ${dropFromHigh.toFixed(2)}% from high of $${newHigh.toFixed(2)}`,
        exitType: "trailing_stop",
        priority: 4, // High priority
      };
    }

    return { shouldExit: false, priority: 0 };
  }

  /**
   * Execute an exit order
   */
  private async executeExit(
    position: PositionWithStrategy,
    decision: ExitDecision
  ): Promise<ExitResult> {
    try {
      const result = await strategyOrderService.closePosition(
        position.strategyId,
        position.symbol,
        Math.abs(position.quantity),
        `exit-${decision.exitType}-${Date.now()}`
      );

      // Clean up trailing stop tracking on exit
      if (result.success) {
        const key = `${position.strategyId}:${position.symbol}`;
        this.trailingStopHighs.delete(key);
        this.positionEntryTimes.delete(key);
      }

      return {
        symbol: position.symbol,
        strategyId: position.strategyId,
        success: result.success,
        exitType: decision.exitType || "unknown",
        orderId: result.orderId,
        error: result.error,
      };
    } catch (error) {
      return {
        symbol: position.symbol,
        strategyId: position.strategyId,
        success: false,
        exitType: decision.exitType || "unknown",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get positions with their associated strategies
   */
  private async getPositionsWithStrategy(): Promise<PositionWithStrategy[]> {
    const positions = await alpaca.getPositions();
    const result: PositionWithStrategy[] = [];

    // TE-001 FIX: Load all DB positions once to avoid N+1 queries
    const dbPositions = await storage.getPositions();
    const dbPositionMap = new Map(
      dbPositions.map((p) => [`${p.strategyId}:${p.symbol}`, p])
    );

    for (const position of positions) {
      // Try to find strategy for this position
      // In a full implementation, this would query the database for
      // positions or orders that link to strategies
      const strategyId = await this.findStrategyForPosition(position.symbol);

      if (!strategyId) {
        continue; // Skip positions not associated with a strategy
      }

      const entryPrice = parseFloat(position.avg_entry_price);
      const currentPrice = parseFloat(position.current_price);
      const quantity = parseFloat(position.qty);
      const marketValue = parseFloat(position.market_value);
      const unrealizedPnl = parseFloat(position.unrealized_pl);
      const unrealizedPnlPercent = parseFloat(position.unrealized_plpc) * 100;

      // TE-001 FIX: Load entry time from database instead of in-memory Map
      // Try to get from database position record first
      const key = `${strategyId}:${position.symbol}`;
      const dbPosition = dbPositionMap.get(key);

      let entryTime: Date;
      if (dbPosition && dbPosition.entryTime) {
        // Use database entry time (persists across restarts)
        entryTime = new Date(dbPosition.entryTime);
      } else {
        // Fallback to in-memory Map for backward compatibility
        entryTime = this.positionEntryTimes.get(key) || new Date();
        if (!this.positionEntryTimes.has(key)) {
          this.positionEntryTimes.set(key, entryTime);
        }
      }

      const holdingPeriodHours =
        (Date.now() - entryTime.getTime()) / (1000 * 60 * 60);

      result.push({
        symbol: position.symbol,
        strategyId,
        entryPrice,
        currentPrice,
        quantity,
        marketValue,
        unrealizedPnl,
        unrealizedPnlPercent,
        entryTime,
        holdingPeriodHours,
      });
    }

    return result;
  }

  /**
   * Find the strategy associated with a position
   * In a full implementation, this would query orders/positions with strategyId
   */
  private async findStrategyForPosition(
    symbol: string
  ): Promise<string | null> {
    try {
      // Get all strategies and check which one owns this position
      const strategies = await storage.getStrategies();

      for (const strategy of strategies) {
        if (strategy.status !== "paper" && strategy.status !== "live") {
          continue;
        }

        // Check if this strategy has orders for this symbol
        const strategyOrders = await storage.getOrdersByStrategy(
          strategy.id,
          50
        );
        const hasSymbolOrder = strategyOrders.some(
          (order) => order.symbol === symbol && order.status === "filled"
        );
        if (hasSymbolOrder) {
          return strategy.id;
        }

        // Also check include list in config
        const config = strategy.config as Record<string, unknown> | null;
        const includeSymbols = config?.includeSymbols as string[] | undefined;
        if (includeSymbols?.includes(symbol)) {
          return strategy.id;
        }
      }

      return null;
    } catch (error) {
      log.warn("ExitRuleEnforcer", "Error finding strategy for position", {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Manually trigger exit check for a specific strategy
   */
  async checkStrategy(strategyId: string): Promise<ExitResult[]> {
    const positions = await this.getPositionsWithStrategy();
    const strategyPositions = positions.filter(
      (p) => p.strategyId === strategyId
    );
    const results: ExitResult[] = [];

    for (const position of strategyPositions) {
      const result = await this.checkPosition(position);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Set entry time for a position (called when order fills)
   */
  recordPositionEntry(
    strategyId: string,
    symbol: string,
    entryTime: Date = new Date()
  ): void {
    const key = `${strategyId}:${symbol}`;
    this.positionEntryTimes.set(key, entryTime);
  }

  /**
   * Get enforcer statistics
   */
  getStatistics(): EnforcerStatistics {
    return { ...this.statistics };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.statistics = {
      totalChecks: 0,
      exitTriggered: 0,
      profitTargetExits: 0,
      stopLossExits: 0,
      timeExits: 0,
      trailingStopExits: 0,
      failedExits: 0,
    };
  }

  /**
   * Check if enforcer is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// Export singleton
export const exitRuleEnforcer = new ExitRuleEnforcer();
