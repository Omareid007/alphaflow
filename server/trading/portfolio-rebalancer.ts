import { alpaca } from "../connectors/alpaca";
import { storage } from "../storage";
import { eventBus, logger } from "../orchestration";
import { log } from "../utils/logger";
import { toDecimal, calculateWholeShares, positionValue } from "../utils/money";
import { safeParseFloat } from "../utils/numeric";
import { normalizeSymbolForAlpaca } from "./symbol-normalizer";
import type {
  TargetAllocation,
  CurrentAllocation,
  RebalanceTrade,
  RebalancePreview,
  RebalanceResult,
} from "./engine-types";

/**
 * Portfolio Rebalancer
 *
 * Handles portfolio rebalancing operations with dependency injection to avoid circular dependencies.
 * Uses callbacks for getCurrentAllocations, executeTrade, and watchlist to decouple from the trading engine.
 */
export class PortfolioRebalancer {
  /**
   * Preview a rebalance operation without executing trades
   *
   * @param targetAllocations - Target allocation percentages for each symbol
   * @param getCurrentAllocationsCallback - Callback to get current portfolio allocations
   * @returns Preview of proposed trades and cash impact
   */
  async previewRebalance(
    targetAllocations: TargetAllocation[],
    getCurrentAllocationsCallback: () => Promise<{
      allocations: CurrentAllocation[];
      portfolioValue: number;
      cashBalance: number;
    }>
  ): Promise<RebalancePreview> {
    const { allocations: currentAllocations, portfolioValue, cashBalance } =
      await getCurrentAllocationsCallback();

    const totalTargetPercent = targetAllocations.reduce((sum, t) => sum + t.targetPercent, 0);
    if (totalTargetPercent > 100) {
      throw new Error(`Target allocations sum to ${totalTargetPercent}%, must be <= 100%`);
    }

    const proposedTrades: RebalanceTrade[] = [];
    let estimatedCashChange = 0;

    const currentMap = new Map(
      currentAllocations
        .filter(a => a.symbol !== "CASH")
        .map(a => [a.symbol, a])
    );

    for (const target of targetAllocations) {
      if (target.symbol === "CASH") continue;

      const symbol = target.symbol.toUpperCase();
      // Use Decimal.js for precise portfolio allocation calculations
      const targetValue = toDecimal(target.targetPercent).dividedBy(100).times(portfolioValue);
      const current = currentMap.get(symbol);
      const currentValue = current?.currentValue || 0;
      const currentPercent = current?.currentPercent || 0;
      const currentPrice = current?.price || 0;

      const valueDiff = targetValue.minus(currentValue);

      if (valueDiff.abs().lessThan(10)) continue;

      if (valueDiff.isPositive() && currentPrice > 0) {
        const buyQuantity = calculateWholeShares(valueDiff, currentPrice).toNumber();
        if (buyQuantity >= 1) {
          const estimatedValue = positionValue(buyQuantity, currentPrice).toNumber();
          proposedTrades.push({
            symbol,
            side: "buy",
            quantity: buyQuantity,
            estimatedValue,
            currentPercent,
            targetPercent: target.targetPercent,
            reason: `Increase allocation from ${currentPercent.toFixed(1)}% to ${target.targetPercent}%`,
          });
          estimatedCashChange -= estimatedValue;
        }
      } else if (valueDiff.isNegative() && currentPrice > 0 && current) {
        const maxSellQty = calculateWholeShares(valueDiff.abs(), currentPrice).toNumber();
        const sellQuantity = Math.min(maxSellQty, current.quantity);
        if (sellQuantity >= 1) {
          const estimatedValue = positionValue(sellQuantity, currentPrice).toNumber();
          proposedTrades.push({
            symbol,
            side: "sell",
            quantity: sellQuantity,
            estimatedValue,
            currentPercent,
            targetPercent: target.targetPercent,
            reason: `Decrease allocation from ${currentPercent.toFixed(1)}% to ${target.targetPercent}%`,
          });
          estimatedCashChange += estimatedValue;
        }
      }
    }

    for (const [symbol, current] of currentMap) {
      const hasTarget = targetAllocations.some(
        t => t.symbol.toUpperCase() === symbol
      );
      if (!hasTarget && current.quantity > 0) {
        proposedTrades.push({
          symbol,
          side: "sell",
          quantity: current.quantity,
          estimatedValue: current.currentValue,
          currentPercent: current.currentPercent,
          targetPercent: 0,
          reason: `Close position - not in target allocation`,
        });
        estimatedCashChange += current.currentValue;
      }
    }

    proposedTrades.sort((a, b) => {
      if (a.side === "sell" && b.side === "buy") return -1;
      if (a.side === "buy" && b.side === "sell") return 1;
      return b.estimatedValue - a.estimatedValue;
    });

    const estimatedTradingCost = proposedTrades.length * 0.01;

    return {
      currentAllocations,
      targetAllocations,
      proposedTrades,
      portfolioValue,
      cashAvailable: cashBalance,
      cashAfterRebalance: cashBalance + estimatedCashChange,
      estimatedTradingCost,
    };
  }

  /**
   * Execute a portfolio rebalance
   *
   * @param targetAllocations - Target allocation percentages for each symbol
   * @param dryRun - If true, preview trades without executing
   * @param getCurrentAllocationsCallback - Callback to get current portfolio allocations
   * @param executeTradeCallback - Callback to execute individual trades
   * @returns Result with executed trades, errors, and portfolio values
   */
  async executeRebalance(
    targetAllocations: TargetAllocation[],
    dryRun: boolean = false,
    getCurrentAllocationsCallback: () => Promise<{
      allocations: CurrentAllocation[];
      portfolioValue: number;
      cashBalance: number;
    }>,
    executeTradeCallback: (trade: {
      symbol: string;
      side: "buy" | "sell";
      quantity: number;
      notes?: string;
    }) => Promise<{
      success: boolean;
      order?: { id: string };
      error?: string;
    }>
  ): Promise<RebalanceResult> {
    const preview = await this.previewRebalance(targetAllocations, getCurrentAllocationsCallback);
    const portfolioValueBefore = safeParseFloat(preview.portfolioValue);

    if (dryRun) {
      return {
        success: true,
        tradesExecuted: preview.proposedTrades.map(t => ({
          symbol: t.symbol,
          side: t.side,
          quantity: Math.floor(safeParseFloat(t.quantity)),
          status: "dry_run",
        })),
        errors: [],
        portfolioValueBefore,
        portfolioValueAfter: portfolioValueBefore,
      };
    }

    const tradesExecuted: RebalanceResult["tradesExecuted"] = [];
    const errors: string[] = [];

    const sellTrades = preview.proposedTrades.filter(t => t.side === "sell");

    for (const trade of sellTrades) {
      try {
        const quantity = Math.floor(safeParseFloat(trade.quantity));
        if (quantity < 1) continue;

        const result = await executeTradeCallback({
          symbol: trade.symbol,
          side: "sell",
          quantity,
          notes: `Rebalance: ${trade.reason}`,
        });

        tradesExecuted.push({
          symbol: trade.symbol,
          side: "sell",
          quantity,
          status: result.success ? "executed" : "failed",
          orderId: result.order?.id,
          error: result.error,
        });

        if (!result.success) {
          errors.push(`${trade.symbol} sell failed: ${result.error}`);
        }
      } catch (err) {
        const errorMsg = (err as Error).message;
        errors.push(`${trade.symbol} sell error: ${errorMsg}`);
        tradesExecuted.push({
          symbol: trade.symbol,
          side: "sell",
          quantity: Math.floor(safeParseFloat(trade.quantity)),
          status: "error",
          error: errorMsg,
        });
      }
    }

    if (sellTrades.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const { allocations: refreshedAllocations, portfolioValue: refreshedPortfolioValue, cashBalance: availableCash } =
      await getCurrentAllocationsCallback();

    const refreshedPositionMap = new Map(
      refreshedAllocations
        .filter(a => a.symbol !== "CASH")
        .map(a => [a.symbol, a])
    );

    for (const target of targetAllocations) {
      if (target.symbol === "CASH") continue;

      const symbol = target.symbol.toUpperCase();
      // Use Decimal.js for precise rebalance calculations
      const targetValue = toDecimal(safeParseFloat(target.targetPercent)).dividedBy(100).times(refreshedPortfolioValue);
      const current = refreshedPositionMap.get(symbol);
      const currentValue = current ? safeParseFloat(current.currentValue) : 0;
      const currentPrice = current ? safeParseFloat(current.price) : 0;

      const valueDiff = targetValue.minus(currentValue);

      if (valueDiff.lessThanOrEqualTo(10) || currentPrice <= 0) continue;

      const maxBuyValue = toDecimal(availableCash).times(0.95).toNumber();
      const maxBuyValueCapped = Math.min(valueDiff.toNumber(), maxBuyValue);
      const buyQuantity = calculateWholeShares(maxBuyValueCapped, currentPrice).toNumber();

      if (buyQuantity < 1) continue;

      try {
        const result = await executeTradeCallback({
          symbol,
          side: "buy",
          quantity: buyQuantity,
          notes: `Rebalance: Increase allocation to ${target.targetPercent}%`,
        });

        tradesExecuted.push({
          symbol,
          side: "buy",
          quantity: buyQuantity,
          status: result.success ? "executed" : "failed",
          orderId: result.order?.id,
          error: result.error,
        });

        if (!result.success) {
          errors.push(`${symbol} buy failed: ${result.error}`);
        }
      } catch (err) {
        const errorMsg = (err as Error).message;
        errors.push(`${symbol} buy error: ${errorMsg}`);
        tradesExecuted.push({
          symbol,
          side: "buy",
          quantity: buyQuantity,
          status: "error",
          error: errorMsg,
        });
      }
    }

    // Wait for positions to settle before getting final values
    await new Promise(resolve => setTimeout(resolve, 1000));

    const finalAccount = await alpaca.getAccount();
    const finalPositions = await alpaca.getPositions();
    const cashAfter = safeParseFloat(finalAccount.cash);
    const positionsValueAfter = finalPositions.reduce(
      (sum, p) => sum + safeParseFloat(p.market_value), 0
    );
    const portfolioValueAfter = cashAfter + positionsValueAfter;

    logger.trade(`Rebalance complete: ${tradesExecuted.length} trades, ${errors.length} errors`, {
      tradesExecuted: tradesExecuted.length,
      errors: errors.length,
      portfolioValueBefore,
      portfolioValueAfter,
    });

    eventBus.emit("portfolio:rebalanced", {
      tradesExecuted: tradesExecuted.length,
      errors: errors.length,
      portfolioValueBefore,
      portfolioValueAfter,
    }, "portfolio-rebalancer");

    return {
      success: errors.length === 0,
      tradesExecuted,
      errors,
      portfolioValueBefore,
      portfolioValueAfter,
    };
  }

  /**
   * Get suggested rebalance allocations based on current portfolio
   *
   * @param getCurrentAllocationsCallback - Callback to get current portfolio allocations
   * @param getDefaultWatchlist - Callback to get default watchlist symbols
   * @returns Current allocations, suggested allocations, and reasoning
   */
  async getRebalanceSuggestions(
    getCurrentAllocationsCallback: () => Promise<{
      allocations: CurrentAllocation[];
      portfolioValue: number;
      cashBalance: number;
    }>,
    getDefaultWatchlist: () => string[]
  ): Promise<{
    currentAllocations: CurrentAllocation[];
    suggestedAllocations: TargetAllocation[];
    reasoning: string;
  }> {
    const { allocations: currentAllocations, portfolioValue } =
      await getCurrentAllocationsCallback();

    const nonCashAllocations = currentAllocations.filter(a => a.symbol !== "CASH");

    if (nonCashAllocations.length === 0) {
      const defaultWatchlist = getDefaultWatchlist();
      return {
        currentAllocations,
        suggestedAllocations: defaultWatchlist.slice(0, 5).map((symbol, i) => ({
          symbol,
          targetPercent: 15,
        })),
        reasoning: "No current positions. Suggesting equal-weight allocation across top 5 watchlist stocks (15% each, 25% cash reserve).",
      };
    }

    const symbolCount = nonCashAllocations.length;
    const equalWeight = Math.floor(80 / symbolCount);

    const suggestedAllocations: TargetAllocation[] = nonCashAllocations.map(a => ({
      symbol: a.symbol,
      targetPercent: equalWeight,
    }));

    const allocatedPercent = suggestedAllocations.reduce((sum, a) => sum + a.targetPercent, 0);
    if (allocatedPercent < 80 && suggestedAllocations.length > 0) {
      suggestedAllocations[0].targetPercent += (80 - allocatedPercent);
    }

    return {
      currentAllocations,
      suggestedAllocations,
      reasoning: `Suggesting equal-weight rebalancing across ${symbolCount} positions (~${equalWeight}% each) with 20% cash reserve for risk management.`,
    };
  }
}

// Export singleton instance
export const portfolioRebalancer = new PortfolioRebalancer();
