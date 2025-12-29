import { storage } from "../storage";
import {
  alpaca,
  type AlpacaOrder,
  type AlpacaPosition,
} from "../connectors/alpaca";
import { eventBus, type PositionEvent } from "../orchestration";
import { log } from "../utils/logger";
import {
  calculatePnL,
  toDecimal,
  percentChange,
  formatPrice as formatMoneyPrice,
} from "../utils/money";
import { safeParseFloat } from "../utils/numeric";
import {
  normalizeSymbolForAlpaca,
  isCryptoSymbol,
  normalizeCryptoSymbol,
} from "./symbol-normalizer";
import { checkSellLossProtection } from "./risk-validator";
import type {
  AlpacaTradeResult,
  CurrentAllocation,
} from "./alpaca-trading-engine";

/**
 * @file Position Manager Module
 * @description Manages trading positions including closing, reconciliation, syncing, and allocation tracking.
 * Ensures consistency between Alpaca broker positions and local database state.
 *
 * Extracted from alpaca-trading-engine.ts
 *
 * @module server/trading/position-manager
 */

/**
 * PositionManager - Manages trading positions and portfolio state
 *
 * Handles all position-related operations with loss protection and orchestrator control.
 * Maintains consistency between broker (Alpaca) and database positions through reconciliation.
 *
 * @class PositionManager
 *
 * @example Close a position
 * ```typescript
 * const result = await positionManager.closeAlpacaPosition("AAPL", "strategy-123", {
 *   authorizedByOrchestrator: true
 * });
 *
 * if (result.success) {
 *   console.log("Position closed with P&L:", result.trade.pnl);
 * }
 * ```
 *
 * @example Reconcile positions
 * ```typescript
 * const reconciliation = await positionManager.reconcilePositions();
 * console.log("Discrepancies found:", reconciliation.discrepancies.length);
 * console.log("Positions synced:", reconciliation.synced);
 * ```
 *
 * @responsibilities
 * - Position closing with loss protection
 * - Position reconciliation between Alpaca and database
 * - Position synchronization
 * - Portfolio allocation tracking
 * - Agent statistics updates
 */
export class PositionManager {
  private orchestratorControlEnabled: boolean = false;

  /**
   * Enable or disable orchestrator control mode
   *
   * When enabled, all position operations must be authorized by the orchestrator
   * to prevent conflicting autonomous actions.
   *
   * @param enabled - Whether orchestrator control should be enabled
   */
  setOrchestratorControl(enabled: boolean): void {
    this.orchestratorControlEnabled = enabled;
  }

  /**
   * Check if orchestrator control is currently enabled
   *
   * @returns True if orchestrator control is active
   */
  isOrchestratorControlEnabled(): boolean {
    return this.orchestratorControlEnabled;
  }

  /**
   * Close a position in Alpaca with loss protection
   *
   * Closes an open position, calculating P&L and creating a trade record.
   * Includes loss protection that prevents closing positions at a loss unless
   * it's an emergency stop or stop-loss trigger.
   *
   * Extracted from lines 703-805 of alpaca-trading-engine.ts
   *
   * @param symbol - Stock symbol or crypto pair to close
   * @param strategyId - Optional strategy ID for tracking
   * @param options - Closing options
   * @param options.isStopLossTriggered - True if this is a stop-loss execution (bypasses loss protection)
   * @param options.isEmergencyStop - True if this is an emergency stop (bypasses loss protection)
   * @param options.authorizedByOrchestrator - SECURITY: Must be true if orchestrator control is enabled
   *
   * @returns Promise resolving to trade result with order and trade details
   *
   * @example Normal position close
   * ```typescript
   * const result = await positionManager.closeAlpacaPosition("AAPL", "strategy-123", {
   *   authorizedByOrchestrator: true
   * });
   * ```
   *
   * @example Emergency stop (bypasses loss protection)
   * ```typescript
   * const result = await positionManager.closeAlpacaPosition("TSLA", undefined, {
   *   isEmergencyStop: true
   * });
   * ```
   *
   * @lossProtection This method implements loss protection:
   * - Calculates current P&L by comparing entry price vs current price
   * - If position is at a loss AND not a stop-loss/emergency stop, blocks the close
   * - Returns error with loss percentage to inform user
   * - Exception: Stop-loss triggers and emergency stops always execute
   *
   * @note For crypto symbols, automatically converts to slash format (e.g., "BTC/USD")
   * @note Handles 404 errors gracefully if position is already closed
   */
  async closeAlpacaPosition(
    symbol: string,
    strategyId?: string,
    options: {
      isStopLossTriggered?: boolean;
      isEmergencyStop?: boolean;
      /** SECURITY: Only the work queue processor should set this to true */
      authorizedByOrchestrator?: boolean;
    } = {}
  ): Promise<AlpacaTradeResult> {
    try {
      // SECURITY: Orchestrator control check - only allow position closes authorized by orchestrator/work queue
      // Exception: Emergency stops and stop-loss triggers are always allowed for safety
      if (
        this.orchestratorControlEnabled &&
        !options.authorizedByOrchestrator &&
        !options.isEmergencyStop
      ) {
        log.warn(
          "PositionManager",
          "Position close blocked - orchestrator has control",
          { symbol }
        );
        return {
          success: false,
          error:
            "Orchestrator control active - direct position close blocked. Must go through work queue or be an emergency stop.",
        };
      }

      // For crypto, use slash format; for stocks, use standard format
      const alpacaSymbol = isCryptoSymbol(symbol)
        ? normalizeCryptoSymbol(symbol)
        : normalizeSymbolForAlpaca(symbol);
      let position: AlpacaPosition | null = null;
      try {
        position = await alpaca.getPosition(alpacaSymbol);
      } catch (posError) {
        const errorMsg = (posError as Error).message?.toLowerCase() || "";
        if (
          errorMsg.includes("404") ||
          errorMsg.includes("not found") ||
          errorMsg.includes("position does not exist")
        ) {
          return {
            success: true,
            error: `Position for ${symbol} already closed or does not exist`,
          };
        }
        throw posError;
      }

      if (!position) {
        return {
          success: true,
          error: `No position found for ${symbol} - may already be closed`,
        };
      }

      // LOSS PROTECTION: Don't close positions at a loss unless stop-loss or emergency stop triggered
      const entryPrice = safeParseFloat(position.avg_entry_price);
      const currentPrice = safeParseFloat(position.current_price);
      const isAtLoss = currentPrice < entryPrice;
      const isProtectedClose =
        options.isStopLossTriggered || options.isEmergencyStop;

      if (isAtLoss && !isProtectedClose) {
        // Use Decimal.js for precise percentage calculation
        const lossPercentDecimal = percentChange(
          currentPrice,
          entryPrice
        ).abs();
        const lossPercent = formatMoneyPrice(lossPercentDecimal, 2);
        log.warn(
          "LossProtection",
          "Blocking close at loss - waiting for stop-loss or price recovery",
          { symbol, lossPercent: lossPercentDecimal.toNumber() }
        );
        return {
          success: false,
          error: `Position at ${lossPercent}% loss - holding until stop-loss triggers or price recovers`,
        };
      }

      let order: AlpacaOrder;
      try {
        order = await alpaca.closePosition(alpacaSymbol);
      } catch (closeError) {
        const errorMsg = (closeError as Error).message?.toLowerCase() || "";
        if (
          errorMsg.includes("404") ||
          errorMsg.includes("not found") ||
          errorMsg.includes("position does not exist")
        ) {
          return {
            success: true,
            error: `Position for ${symbol} was already closed`,
          };
        }
        throw closeError;
      }

      const quantity = safeParseFloat(position.qty);
      const exitPrice = safeParseFloat(
        order.filled_avg_price || position.current_price
      );
      const isShort = position.side === "short";
      const pnl = calculatePnL(
        entryPrice,
        exitPrice,
        quantity,
        isShort ? "short" : "long"
      );
      // Closing a long = sell; closing a short = buy
      const tradeSide = isShort ? "buy" : "sell";

      const trade = await storage.createTrade({
        symbol: symbol.toUpperCase(),
        side: tradeSide,
        quantity: quantity.toString(),
        price: exitPrice.toString(),
        strategyId: strategyId || null,
        status: "completed",
        notes: `Closed Alpaca ${position.side} position. Order ID: ${order.id}`,
        pnl: pnl.toString(),
      });

      await this.updateAgentStats();

      const positionEvent: PositionEvent = {
        symbol: symbol.toUpperCase(),
        quantity: 0,
        entryPrice,
        currentPrice: exitPrice,
        unrealizedPnl: 0,
        side: isShort ? "short" : "long",
      };
      eventBus.emit("position:closed", positionEvent, "position-manager");
      log.info(
        "PositionManager",
        `Closed ${position.side} position ${symbol}`,
        { pnl, exitPrice }
      );

      return { success: true, order, trade };
    } catch (error) {
      log.error("PositionManager", "Close Alpaca position error", {
        symbol,
        error: (error as Error).message,
      });
      eventBus.emit(
        "trade:error",
        { message: (error as Error).message },
        "position-manager"
      );
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Reconcile positions between Alpaca and database
   *
   * Compares positions in Alpaca broker account with local database records
   * and identifies any discrepancies that need to be synchronized.
   *
   * Extracted from lines 1661-1727 of alpaca-trading-engine.ts
   *
   * @returns Promise resolving to reconciliation report with positions and discrepancies
   * @returns result.alpacaPositions - Current positions in Alpaca
   * @returns result.dbPositions - Current positions in database
   * @returns result.discrepancies - List of differences requiring sync
   * @returns result.synced - True if no discrepancies found
   *
   * @example
   * ```typescript
   * const report = await positionManager.reconcilePositions();
   *
   * if (!report.synced) {
   *   console.log("Found discrepancies:", report.discrepancies);
   *   // Discrepancies might include:
   *   // - { symbol: "AAPL", action: "create_in_db" } - exists in Alpaca but not DB
   *   // - { symbol: "TSLA", action: "update_db_quantity" } - quantity mismatch
   *   // - { symbol: "MSFT", action: "remove_from_db" } - exists in DB but not Alpaca
   * }
   * ```
   *
   * @note This is a read-only operation - use syncPositionsFromAlpaca() to apply fixes
   */
  async reconcilePositions(): Promise<{
    alpacaPositions: Array<{
      symbol: string;
      qty: string;
      side: string;
      marketValue: string;
      unrealizedPnl: string;
    }>;
    dbPositions: Array<{ id: string; symbol: string; quantity: string }>;
    discrepancies: Array<{
      symbol: string;
      alpacaQty: string;
      dbQty: string;
      action: string;
    }>;
    synced: boolean;
  }> {
    const alpacaPositions = await alpaca.getPositions();
    const dbPositions = await storage.getPositions();

    const alpacaMap = new Map(
      alpacaPositions.map((p) => [p.symbol.toUpperCase(), p])
    );
    const dbMap = new Map(dbPositions.map((p) => [p.symbol.toUpperCase(), p]));

    const discrepancies: Array<{
      symbol: string;
      alpacaQty: string;
      dbQty: string;
      action: string;
    }> = [];

    for (const [symbol, alpacaPos] of alpacaMap) {
      const dbPos = dbMap.get(symbol);
      if (!dbPos) {
        discrepancies.push({
          symbol,
          alpacaQty: alpacaPos.qty,
          dbQty: "0",
          action: "create_in_db",
        });
      } else if (alpacaPos.qty !== dbPos.quantity) {
        discrepancies.push({
          symbol,
          alpacaQty: alpacaPos.qty,
          dbQty: dbPos.quantity,
          action: "update_db_quantity",
        });
      }
    }

    for (const [symbol, dbPos] of dbMap) {
      if (!alpacaMap.has(symbol)) {
        discrepancies.push({
          symbol,
          alpacaQty: "0",
          dbQty: dbPos.quantity,
          action: "remove_from_db",
        });
      }
    }

    log.info("Reconciliation", "Position reconciliation complete", {
      discrepancies: discrepancies.length,
    });

    return {
      alpacaPositions: alpacaPositions.map((p) => ({
        symbol: p.symbol,
        qty: p.qty,
        side: p.side,
        marketValue: p.market_value,
        unrealizedPnl: p.unrealized_pl,
      })),
      dbPositions: dbPositions.map((p) => ({
        id: p.id,
        symbol: p.symbol,
        quantity: p.quantity,
      })),
      discrepancies,
      synced: discrepancies.length === 0,
    };
  }

  /**
   * Sync positions from Alpaca to database
   *
   * Synchronizes all positions from Alpaca broker to local database.
   * Creates missing positions, updates existing ones, and removes stale positions.
   *
   * Extracted from lines 1729-1811 of alpaca-trading-engine.ts
   *
   * @param userId - Optional user ID (defaults to admin user for system-level sync)
   *
   * @returns Promise resolving to sync report
   * @returns result.created - Array of symbols for newly created positions
   * @returns result.updated - Array of symbols for updated positions
   * @returns result.removed - Array of symbols for removed positions
   * @returns result.errors - Array of errors encountered during sync
   *
   * @example System-level sync (uses admin user)
   * ```typescript
   * const result = await positionManager.syncPositionsFromAlpaca();
   * console.log(`Created: ${result.created.length}, Updated: ${result.updated.length}`);
   * ```
   *
   * @example User-specific sync
   * ```typescript
   * const result = await positionManager.syncPositionsFromAlpaca("user-123");
   * ```
   *
   * @note This applies the fixes identified by reconcilePositions()
   * @note If no userId provided, uses admin user from database
   */
  async syncPositionsFromAlpaca(userId?: string): Promise<{
    created: string[];
    updated: string[];
    removed: string[];
    errors: Array<{ symbol: string; error: string }>;
  }> {
    const created: string[] = [];
    const updated: string[] = [];
    const removed: string[] = [];
    const errors: Array<{ symbol: string; error: string }> = [];

    try {
      const alpacaPositions = await alpaca.getPositions();

      // If no userId provided, get admin user's positions (system-level sync)
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const adminUser = await storage.getUserByUsername("admintest");
        if (!adminUser) {
          throw new Error("No admin user found for system-level position sync");
        }
        effectiveUserId = adminUser.id;
        log.info("Sync", "Using admin user for system-level sync", {
          username: adminUser.username,
        });
      }

      const dbPositions = await storage.getPositions(effectiveUserId);

      const alpacaMap = new Map(
        alpacaPositions.map((p) => [p.symbol.toUpperCase(), p])
      );
      const dbMap = new Map(
        dbPositions.map((p) => [p.symbol.toUpperCase(), p])
      );

      for (const [symbol, alpacaPos] of alpacaMap) {
        try {
          const dbPos = dbMap.get(symbol);
          if (!dbPos) {
            await storage.createPosition({
              userId: effectiveUserId,
              symbol: alpacaPos.symbol,
              side: alpacaPos.side,
              quantity: alpacaPos.qty,
              entryPrice: alpacaPos.avg_entry_price,
              currentPrice: alpacaPos.current_price,
              unrealizedPnl: alpacaPos.unrealized_pl,
              strategyId: null,
            });
            created.push(symbol);
            log.info("Sync", "Created position", {
              symbol,
              userId: effectiveUserId,
            });
          } else {
            await storage.updatePosition(dbPos.id, {
              quantity: alpacaPos.qty,
              currentPrice: alpacaPos.current_price,
              unrealizedPnl: alpacaPos.unrealized_pl,
            });
            updated.push(symbol);
          }
        } catch (err) {
          errors.push({ symbol, error: (err as Error).message });
        }
      }

      for (const [symbol, dbPos] of dbMap) {
        if (!alpacaMap.has(symbol)) {
          try {
            await storage.deletePosition(dbPos.id);
            removed.push(symbol);
            log.info("Sync", "Removed stale position", { symbol });
          } catch (err) {
            errors.push({ symbol, error: (err as Error).message });
          }
        }
      }

      log.info("Sync", "Position sync completed", {
        created: created.length,
        updated: updated.length,
        removed: removed.length,
      });
    } catch (err) {
      log.error("Sync", "Failed to sync positions", {
        error: (err as Error).message,
      });
      throw err;
    }

    return { created, updated, removed, errors };
  }

  /**
   * Close all positions in Alpaca
   *
   * Closes all open positions in the broker account and creates trade records for each.
   * Includes orchestrator control check to prevent unauthorized mass closures.
   *
   * Extracted from lines 1813-1887 of alpaca-trading-engine.ts
   *
   * @param options - Closing options
   * @param options.authorizedByOrchestrator - SECURITY: Must be true if orchestrator control is enabled
   * @param options.isEmergencyStop - True if this is an emergency stop (bypasses orchestrator control)
   *
   * @returns Promise resolving to close-all report
   * @returns result.closed - Array of closed positions with symbols, quantities, and P&L
   * @returns result.tradesCreated - Number of trade records created
   * @returns result.errors - Array of errors encountered during closing
   *
   * @example Close all positions (requires authorization)
   * ```typescript
   * const result = await positionManager.closeAllPositions({
   *   authorizedByOrchestrator: true
   * });
   *
   * console.log(`Closed ${result.closed.length} positions`);
   * result.closed.forEach(pos => {
   *   console.log(`${pos.symbol}: P&L $${pos.pnl}`);
   * });
   * ```
   *
   * @example Emergency stop (bypasses orchestrator)
   * ```typescript
   * const result = await positionManager.closeAllPositions({
   *   isEmergencyStop: true
   * });
   * ```
   *
   * @note Automatically syncs positions after closing
   * @note Updates agent statistics after completion
   * @note Continues closing remaining positions even if some fail
   */
  async closeAllPositions(
    options: {
      /** SECURITY: Only the work queue processor or emergency actions should set this to true */
      authorizedByOrchestrator?: boolean;
      isEmergencyStop?: boolean;
    } = {}
  ): Promise<{
    closed: Array<{ symbol: string; qty: string; pnl: string }>;
    tradesCreated: number;
    errors: Array<{ symbol: string; error: string }>;
  }> {
    // SECURITY: Orchestrator control check - only allow close-all if authorized or emergency
    if (
      this.orchestratorControlEnabled &&
      !options.authorizedByOrchestrator &&
      !options.isEmergencyStop
    ) {
      log.warn(
        "PositionManager",
        "Close all positions blocked - orchestrator has control"
      );
      return {
        closed: [],
        tradesCreated: 0,
        errors: [
          {
            symbol: "ALL",
            error:
              "Orchestrator control active - close all blocked. Use emergency stop or go through orchestrator.",
          },
        ],
      };
    }

    const closed: Array<{ symbol: string; qty: string; pnl: string }> = [];
    const errors: Array<{ symbol: string; error: string }> = [];
    let tradesCreated = 0;

    try {
      const positions = await alpaca.getPositions();

      for (const position of positions) {
        try {
          const qty = safeParseFloat(position.qty);
          const entryPrice = safeParseFloat(position.avg_entry_price);
          const currentPrice = safeParseFloat(position.current_price);
          const isShort = position.side === "short";

          const order = await alpaca.closePosition(position.symbol);

          const exitPrice = order.filled_avg_price
            ? safeParseFloat(order.filled_avg_price)
            : currentPrice;
          const realizedPnl = calculatePnL(
            entryPrice,
            exitPrice,
            qty,
            isShort ? "short" : "long"
          );
          // Closing a long = sell; closing a short = buy
          const tradeSide = isShort ? "buy" : "sell";

          await storage.createTrade({
            symbol: position.symbol,
            side: tradeSide,
            quantity: position.qty,
            price: exitPrice.toString(),
            strategyId: null,
            status: "completed",
            notes: `Closed all positions (${position.side}). Order ID: ${order.id}. Entry: $${entryPrice.toFixed(2)}, Exit: $${exitPrice.toFixed(2)}`,
            pnl: realizedPnl.toString(),
          });
          tradesCreated++;

          closed.push({
            symbol: position.symbol,
            qty: position.qty,
            pnl: realizedPnl.toFixed(2),
          });
          log.info("Reconciliation", "Closed position", {
            symbol: position.symbol,
            side: position.side,
            qty,
            pnl: realizedPnl.toFixed(2),
          });
        } catch (err) {
          errors.push({
            symbol: position.symbol,
            error: (err as Error).message,
          });
        }
      }

      await this.syncPositionsFromAlpaca();
      await this.updateAgentStats();
      log.info("Reconciliation", "Close all positions complete", {
        closed: closed.length,
        tradesCreated,
        errors: errors.length,
      });
    } catch (err) {
      log.error("Reconciliation", "Failed to close all positions", {
        error: (err as Error).message,
      });
      throw err;
    }

    return { closed, tradesCreated, errors };
  }

  /**
   * Get current portfolio allocations
   *
   * Calculates current portfolio allocation percentages and values for all positions.
   * Includes cash as a position for complete portfolio view.
   *
   * Extracted from lines 1897-1943 of alpaca-trading-engine.ts
   *
   * @returns Promise resolving to portfolio allocation report
   * @returns result.allocations - Array of allocations with percentages and values
   * @returns result.portfolioValue - Total portfolio value (positions + cash)
   * @returns result.cashBalance - Current cash balance
   *
   * @example
   * ```typescript
   * const { allocations, portfolioValue, cashBalance } = await positionManager.getCurrentAllocations();
   *
   * console.log(`Total Portfolio Value: $${portfolioValue.toFixed(2)}`);
   * console.log(`Cash: $${cashBalance.toFixed(2)}\n`);
   *
   * allocations.forEach(alloc => {
   *   if (alloc.symbol !== "CASH") {
   *     console.log(`${alloc.symbol}: ${alloc.currentPercent.toFixed(1)}% ($${alloc.currentValue.toFixed(2)})`);
   *     console.log(`  Quantity: ${alloc.quantity} @ $${alloc.price.toFixed(2)}/share`);
   *   }
   * });
   * ```
   *
   * @note Allocations array includes CASH as the last entry
   * @note Percentages are calculated as (position value / total portfolio value) * 100
   */
  async getCurrentAllocations(): Promise<{
    allocations: CurrentAllocation[];
    portfolioValue: number;
    cashBalance: number;
  }> {
    const account = await alpaca.getAccount();
    const positions = await alpaca.getPositions();

    const cashBalance = safeParseFloat(account.cash);
    let positionsValue = 0;

    const allocations: CurrentAllocation[] = [];

    for (const position of positions) {
      const marketValue = safeParseFloat(position.market_value);
      const quantity = safeParseFloat(position.qty);
      const price = safeParseFloat(position.current_price);

      positionsValue += marketValue;

      allocations.push({
        symbol: position.symbol.toUpperCase(),
        currentPercent: 0,
        currentValue: marketValue,
        quantity,
        price,
      });
    }

    const portfolioValue = cashBalance + positionsValue;

    for (const allocation of allocations) {
      allocation.currentPercent =
        portfolioValue > 0
          ? (allocation.currentValue / portfolioValue) * 100
          : 0;
    }

    allocations.push({
      symbol: "CASH",
      currentPercent:
        portfolioValue > 0 ? (cashBalance / portfolioValue) * 100 : 100,
      currentValue: cashBalance,
      quantity: cashBalance,
      price: 1,
    });

    return { allocations, portfolioValue, cashBalance };
  }

  /**
   * Update agent statistics after position operations
   *
   * Calculates and updates key trading performance metrics:
   * - Total number of trades
   * - Total realized P&L (profit/loss)
   * - Win rate percentage
   * - Last heartbeat timestamp
   *
   * Extracted from lines 1529-1551 of alpaca-trading-engine.ts
   *
   * @private
   * @returns Promise that resolves when stats are updated
   *
   * @note Only counts trades with non-null, non-zero P&L for win rate calculation
   */
  private async updateAgentStats(): Promise<void> {
    try {
      const trades = await storage.getTrades(undefined, 1000);
      const closingTrades = trades.filter(
        (t) => t.pnl !== null && t.pnl !== "0"
      );
      const totalRealizedPnl = closingTrades.reduce(
        (sum, t) => sum + safeParseFloat(t.pnl, 0),
        0
      );
      const winningTrades = closingTrades.filter(
        (t) => safeParseFloat(t.pnl, 0) > 0
      );
      const winRate =
        closingTrades.length > 0
          ? (winningTrades.length / closingTrades.length) * 100
          : 0;

      await storage.updateAgentStatus({
        totalTrades: trades.length,
        totalPnl: totalRealizedPnl.toString(),
        winRate: winRate.toString(),
        lastHeartbeat: new Date(),
      });
    } catch (error) {
      log.error("PositionManager", "Failed to update agent stats", {
        error: (error as Error).message,
      });
    }
  }
}

export const positionManager = new PositionManager();
