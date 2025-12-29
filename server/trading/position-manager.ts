import { storage } from "../storage";
import { alpaca, type AlpacaOrder, type AlpacaPosition } from "../connectors/alpaca";
import { eventBus, type PositionEvent } from "../orchestration";
import { log } from "../utils/logger";
import { calculatePnL, toDecimal, percentChange, formatPrice as formatMoneyPrice } from "../utils/money";
import { safeParseFloat } from "../utils/numeric";
import { normalizeSymbolForAlpaca, isCryptoSymbol, normalizeCryptoSymbol } from "./symbol-normalizer";
import { checkSellLossProtection } from "./risk-validator";
import type { AlpacaTradeResult, CurrentAllocation } from "./alpaca-trading-engine";

/**
 * Position Manager
 * Extracted from alpaca-trading-engine.ts
 * Handles position closing, reconciliation, syncing, and allocation tracking
 */
export class PositionManager {
  private orchestratorControlEnabled: boolean = false;

  setOrchestratorControl(enabled: boolean): void {
    this.orchestratorControlEnabled = enabled;
  }

  isOrchestratorControlEnabled(): boolean {
    return this.orchestratorControlEnabled;
  }

  /**
   * Close a position in Alpaca
   * Extracted from lines 703-805 of alpaca-trading-engine.ts
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
      if (this.orchestratorControlEnabled && !options.authorizedByOrchestrator && !options.isEmergencyStop) {
        log.warn("PositionManager", "Position close blocked - orchestrator has control", { symbol });
        return { success: false, error: "Orchestrator control active - direct position close blocked. Must go through work queue or be an emergency stop." };
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
        if (errorMsg.includes("404") || errorMsg.includes("not found") || errorMsg.includes("position does not exist")) {
          return { success: true, error: `Position for ${symbol} already closed or does not exist` };
        }
        throw posError;
      }

      if (!position) {
        return { success: true, error: `No position found for ${symbol} - may already be closed` };
      }

      // LOSS PROTECTION: Don't close positions at a loss unless stop-loss or emergency stop triggered
      const entryPrice = safeParseFloat(position.avg_entry_price);
      const currentPrice = safeParseFloat(position.current_price);
      const isAtLoss = currentPrice < entryPrice;
      const isProtectedClose = options.isStopLossTriggered || options.isEmergencyStop;

      if (isAtLoss && !isProtectedClose) {
        // Use Decimal.js for precise percentage calculation
        const lossPercentDecimal = percentChange(currentPrice, entryPrice).abs();
        const lossPercent = formatMoneyPrice(lossPercentDecimal, 2);
        log.warn("LossProtection", "Blocking close at loss - waiting for stop-loss or price recovery", { symbol, lossPercent: lossPercentDecimal.toNumber() });
        return {
          success: false,
          error: `Position at ${lossPercent}% loss - holding until stop-loss triggers or price recovers`
        };
      }

      let order: AlpacaOrder;
      try {
        order = await alpaca.closePosition(alpacaSymbol);
      } catch (closeError) {
        const errorMsg = (closeError as Error).message?.toLowerCase() || "";
        if (errorMsg.includes("404") || errorMsg.includes("not found") || errorMsg.includes("position does not exist")) {
          return { success: true, error: `Position for ${symbol} was already closed` };
        }
        throw closeError;
      }

      const quantity = safeParseFloat(position.qty);
      const exitPrice = safeParseFloat(order.filled_avg_price || position.current_price);
      const isShort = position.side === "short";
      const pnl = calculatePnL(entryPrice, exitPrice, quantity, isShort ? "short" : "long");
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
      log.info("PositionManager", `Closed ${position.side} position ${symbol}`, { pnl, exitPrice });

      return { success: true, order, trade };
    } catch (error) {
      log.error("PositionManager", "Close Alpaca position error", { symbol, error: (error as Error).message });
      eventBus.emit("trade:error", { message: (error as Error).message }, "position-manager");
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Reconcile positions between Alpaca and database
   * Extracted from lines 1661-1727 of alpaca-trading-engine.ts
   */
  async reconcilePositions(): Promise<{
    alpacaPositions: Array<{ symbol: string; qty: string; side: string; marketValue: string; unrealizedPnl: string }>;
    dbPositions: Array<{ id: string; symbol: string; quantity: string }>;
    discrepancies: Array<{ symbol: string; alpacaQty: string; dbQty: string; action: string }>;
    synced: boolean;
  }> {
    const alpacaPositions = await alpaca.getPositions();
    const dbPositions = await storage.getPositions();

    const alpacaMap = new Map(
      alpacaPositions.map(p => [p.symbol.toUpperCase(), p])
    );
    const dbMap = new Map(
      dbPositions.map(p => [p.symbol.toUpperCase(), p])
    );

    const discrepancies: Array<{ symbol: string; alpacaQty: string; dbQty: string; action: string }> = [];

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

    log.info("Reconciliation", "Position reconciliation complete", { discrepancies: discrepancies.length });

    return {
      alpacaPositions: alpacaPositions.map(p => ({
        symbol: p.symbol,
        qty: p.qty,
        side: p.side,
        marketValue: p.market_value,
        unrealizedPnl: p.unrealized_pl,
      })),
      dbPositions: dbPositions.map(p => ({
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
   * Extracted from lines 1729-1811 of alpaca-trading-engine.ts
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
        log.info("Sync", "Using admin user for system-level sync", { username: adminUser.username });
      }

      const dbPositions = await storage.getPositions(effectiveUserId);

      const alpacaMap = new Map(
        alpacaPositions.map(p => [p.symbol.toUpperCase(), p])
      );
      const dbMap = new Map(
        dbPositions.map(p => [p.symbol.toUpperCase(), p])
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
            log.info("Sync", "Created position", { symbol, userId: effectiveUserId });
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

      log.info("Sync", "Position sync completed", { created: created.length, updated: updated.length, removed: removed.length });
    } catch (err) {
      log.error("Sync", "Failed to sync positions", { error: (err as Error).message });
      throw err;
    }

    return { created, updated, removed, errors };
  }

  /**
   * Close all positions in Alpaca
   * Extracted from lines 1813-1887 of alpaca-trading-engine.ts
   */
  async closeAllPositions(options: {
    /** SECURITY: Only the work queue processor or emergency actions should set this to true */
    authorizedByOrchestrator?: boolean;
    isEmergencyStop?: boolean;
  } = {}): Promise<{
    closed: Array<{ symbol: string; qty: string; pnl: string }>;
    tradesCreated: number;
    errors: Array<{ symbol: string; error: string }>;
  }> {
    // SECURITY: Orchestrator control check - only allow close-all if authorized or emergency
    if (this.orchestratorControlEnabled && !options.authorizedByOrchestrator && !options.isEmergencyStop) {
      log.warn("PositionManager", "Close all positions blocked - orchestrator has control");
      return {
        closed: [],
        tradesCreated: 0,
        errors: [{ symbol: "ALL", error: "Orchestrator control active - close all blocked. Use emergency stop or go through orchestrator." }],
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
          const realizedPnl = calculatePnL(entryPrice, exitPrice, qty, isShort ? "short" : "long");
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
            pnl: realizedPnl.toFixed(2)
          });
          log.info("Reconciliation", "Closed position", { symbol: position.symbol, side: position.side, qty, pnl: realizedPnl.toFixed(2) });
        } catch (err) {
          errors.push({ symbol: position.symbol, error: (err as Error).message });
        }
      }

      await this.syncPositionsFromAlpaca();
      await this.updateAgentStats();
      log.info("Reconciliation", "Close all positions complete", { closed: closed.length, tradesCreated, errors: errors.length });
    } catch (err) {
      log.error("Reconciliation", "Failed to close all positions", { error: (err as Error).message });
      throw err;
    }

    return { closed, tradesCreated, errors };
  }

  /**
   * Get current portfolio allocations
   * Extracted from lines 1897-1943 of alpaca-trading-engine.ts
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
      allocation.currentPercent = portfolioValue > 0
        ? (allocation.currentValue / portfolioValue) * 100
        : 0;
    }

    allocations.push({
      symbol: "CASH",
      currentPercent: portfolioValue > 0 ? (cashBalance / portfolioValue) * 100 : 100,
      currentValue: cashBalance,
      quantity: cashBalance,
      price: 1,
    });

    return { allocations, portfolioValue, cashBalance };
  }

  /**
   * Update agent stats (helper method)
   * Extracted from lines 1529-1551 of alpaca-trading-engine.ts
   */
  private async updateAgentStats(): Promise<void> {
    try {
      const trades = await storage.getTrades(undefined, 1000);
      const closingTrades = trades.filter((t) => t.pnl !== null && t.pnl !== "0");
      const totalRealizedPnl = closingTrades.reduce(
        (sum, t) => sum + safeParseFloat(t.pnl, 0),
        0
      );
      const winningTrades = closingTrades.filter((t) => safeParseFloat(t.pnl, 0) > 0);
      const winRate = closingTrades.length > 0
        ? (winningTrades.length / closingTrades.length) * 100
        : 0;

      await storage.updateAgentStatus({
        totalTrades: trades.length,
        totalPnl: totalRealizedPnl.toString(),
        winRate: winRate.toString(),
        lastHeartbeat: new Date(),
      });
    } catch (error) {
      log.error("PositionManager", "Failed to update agent stats", { error: (error as Error).message });
    }
  }
}

export const positionManager = new PositionManager();
