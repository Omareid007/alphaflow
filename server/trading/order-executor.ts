import {
  alpaca,
  type AlpacaOrder,
  type CreateOrderParams,
  type BracketOrderParams,
} from "../connectors/alpaca";
import { storage } from "../storage";
import { eventBus, logger, type TradeExecutedEvent } from "../orchestration";
import { log } from "../utils/logger";
import { toDecimal, priceWithBuffer, roundPrice } from "../utils/money";
import { safeParseFloat } from "../utils/numeric";
import { checkRiskLimits, checkSellLossProtection } from "./risk-validator";
import { orchestratorController } from "./orchestrator-controller";
import { normalizeSymbolForAlpaca, isCryptoSymbol } from "./symbol-normalizer";
import { tradabilityService } from "../services/tradability-service";
import type { AlpacaTradeRequest, AlpacaTradeResult } from "./engine-types";

/**
 * @file Order Execution Module
 * @description Core order execution logic for the trading engine. Handles all trade execution
 * with comprehensive validation, intelligent order type selection, and automated risk management.
 *
 * Extracted from alpaca-trading-engine.ts (lines 403-701)
 *
 * @module server/trading/order-executor
 *
 * @critical
 * This module is CRITICAL for trading safety. It implements:
 * 1. Guard clauses (quantity, orchestrator control, loss protection, risk limits, tradability, extended hours)
 * 2. Order type selection (bracket orders, trailing stops, extended hours limits, standard market/limit)
 * 3. Post-execution (trade records, event emission, automated stop-loss creation)
 */

/**
 * OrderExecutor - Core order execution engine
 *
 * Handles all trade execution logic with comprehensive validation and risk management.
 * This class is the single point of entry for executing trades with Alpaca.
 *
 * @class OrderExecutor
 *
 * @example
 * ```typescript
 * const result = await orderExecutor.executeAlpacaTrade({
 *   symbol: "AAPL",
 *   side: "buy",
 *   quantity: 10,
 *   orderType: "limit",
 *   limitPrice: 150.00,
 *   stopLossPrice: 145.00,
 *   takeProfitPrice: 160.00,
 *   useBracketOrder: true,
 *   authorizedByOrchestrator: true
 * });
 *
 * if (result.success) {
 *   console.log("Order placed:", result.order.id);
 * }
 * ```
 *
 * @responsibilities
 * - Pre-trade validation (6 guard clauses)
 * - Intelligent order type selection based on parameters
 * - Post-trade record keeping and event emission
 * - Automated stop-loss creation for risk management
 * - Agent statistics tracking
 */
export class OrderExecutor {
  /**
   * Execute a trade with Alpaca with comprehensive validation and risk management
   *
   * This is the main entry point for all trade execution. It runs through 6 critical guard clauses,
   * selects the appropriate order type, executes the trade, and creates post-execution records.
   *
   * @param request - The trade request parameters
   * @param request.symbol - Stock symbol (e.g., "AAPL") or crypto pair (e.g., "BTC/USD")
   * @param request.side - Trade direction: "buy" or "sell"
   * @param request.quantity - Number of shares/units to trade (must be > 0)
   * @param request.strategyId - Optional strategy ID for tracking
   * @param request.notes - Optional notes for trade record
   * @param request.orderType - Order type: "market", "limit", "stop", "stop_limit" (default: "market")
   * @param request.limitPrice - Required for limit/stop_limit orders
   * @param request.stopLossPrice - Optional stop-loss price for bracket orders
   * @param request.takeProfitPrice - Optional take-profit price for bracket orders
   * @param request.useBracketOrder - Whether to use bracket order (requires stopLossPrice and takeProfitPrice)
   * @param request.trailingStopPercent - Optional trailing stop percentage for sell orders
   * @param request.extendedHours - Whether to allow extended hours trading (requires limit order)
   * @param request.authorizedByOrchestrator - SECURITY: Must be true if orchestrator control is enabled
   *
   * @returns Promise resolving to trade result with success status, order details, and trade record
   *
   * @example Basic market order
   * ```typescript
   * const result = await orderExecutor.executeAlpacaTrade({
   *   symbol: "AAPL",
   *   side: "buy",
   *   quantity: 10,
   *   orderType: "market",
   *   authorizedByOrchestrator: true
   * });
   * ```
   *
   * @example Bracket order with stop-loss and take-profit
   * ```typescript
   * const result = await orderExecutor.executeAlpacaTrade({
   *   symbol: "TSLA",
   *   side: "buy",
   *   quantity: 5,
   *   orderType: "limit",
   *   limitPrice: 200.00,
   *   stopLossPrice: 190.00,    // 5% stop-loss
   *   takeProfitPrice: 220.00,  // 10% take-profit
   *   useBracketOrder: true,
   *   authorizedByOrchestrator: true
   * });
   * ```
   *
   * @example Extended hours limit order
   * ```typescript
   * const result = await orderExecutor.executeAlpacaTrade({
   *   symbol: "NVDA",
   *   side: "buy",
   *   quantity: 10,
   *   orderType: "limit",
   *   limitPrice: 450.00,
   *   extendedHours: true,
   *   authorizedByOrchestrator: true
   * });
   * ```
   *
   * @throws Never throws - all errors are caught and returned in result.error
   *
   * @guardClauses The method runs through 6 critical guard clauses before execution:
   * 1. **Quantity validation**: Ensures quantity > 0
   * 2. **Orchestrator control**: Blocks unauthorized trades when orchestrator is active
   * 3. **Loss protection**: Prevents selling at a loss unless it's a stop-loss order
   * 4. **Risk limits**: Validates against daily loss limits and kill switch
   * 5. **Tradability**: Ensures symbol is tradable in broker universe
   * 6. **Extended hours restrictions**: Validates extended hours compatibility
   *
   * @orderTypeSelection After guard clauses, the method selects the appropriate order type:
   * - **Bracket order**: If useBracketOrder=true, side=buy, has stop/profit prices, not crypto, not extended hours
   * - **Trailing stop**: If trailingStopPercent set, side=sell, not crypto, not extended hours
   * - **Extended hours limit**: If extendedHours=true (must be limit or stop_limit order)
   * - **Standard order**: Market or limit order with appropriate time_in_force
   *
   * @automatedStopLoss After successful buy orders (non-bracket, non-crypto, non-extended-hours):
   * - Automatically creates a stop-loss order at 2% below entry price
   * - Links stop-loss order ID to trade record for tracking
   * - Non-blocking: Logs error if stop-loss creation fails but doesn't fail the main trade
   */
  async executeAlpacaTrade(
    request: AlpacaTradeRequest
  ): Promise<AlpacaTradeResult> {
    try {
      const {
        symbol,
        side,
        quantity,
        strategyId,
        notes,
        orderType = "market",
        limitPrice,
        stopLossPrice,
        takeProfitPrice,
        useBracketOrder,
        trailingStopPercent,
        extendedHours = false,
        userId,
      } = request;

      // ============================================================================
      // GUARD CLAUSES - Validation and safety checks
      // ============================================================================

      // Guard 1: Quantity validation
      if (quantity <= 0) {
        log.warn(
          "Trading",
          `ORDER_BLOCKED: ${symbol} - Quantity must be greater than 0`,
          {
            symbol,
            side,
            quantity,
            reason: "INVALID_QUANTITY",
          }
        );
        return { success: false, error: "Quantity must be greater than 0" };
      }

      // Guard 2: User context validation
      // SECURITY: All trading operations MUST have proper user attribution
      if (!userId || userId.trim() === "") {
        log.warn(
          "Trading",
          `ORDER_BLOCKED: ${symbol} - Missing user context`,
          {
            symbol,
            side,
            quantity,
            reason: "MISSING_USER_CONTEXT",
            userId: userId || "undefined",
          }
        );
        return {
          success: false,
          error: "Trading operation requires valid user authentication"
        };
      }

      // Guard 3: Orchestrator control check
      // SECURITY: Only allow trades authorized by the orchestrator/work queue
      // This cannot be bypassed by manipulating notes strings
      if (
        orchestratorController.isOrchestratorControlEnabled() &&
        !request.authorizedByOrchestrator
      ) {
        log.warn(
          "Trading",
          `ORDER_BLOCKED: ${symbol} - Orchestrator control active`,
          {
            symbol,
            side,
            quantity,
            reason: "ORCHESTRATOR_CONTROL_ACTIVE",
            orchestratorControlEnabled:
              orchestratorController.isOrchestratorControlEnabled(),
            authorizedByOrchestrator: request.authorizedByOrchestrator,
          }
        );
        return {
          success: false,
          error:
            "Orchestrator control active - direct trade execution blocked. Trades must go through the work queue.",
        };
      }

      // Guard 3: Loss protection for sells
      // LOSS PROTECTION: Block direct sell orders at a loss unless it's a stop-loss
      if (side === "sell") {
        const lossProtectionResult = await checkSellLossProtection(
          symbol,
          notes,
          normalizeSymbolForAlpaca
        );
        if (!lossProtectionResult.allowed) {
          log.warn(
            "Trading",
            `ORDER_BLOCKED: ${symbol} - Loss protection active`,
            {
              symbol,
              side,
              quantity,
              reason: "LOSS_PROTECTION_ACTIVE",
            }
          );
          return {
            success: false,
            error:
              lossProtectionResult.reason ||
              "Position at loss - holding until stop-loss triggers or price recovers",
          };
        }
      }

      // Guard 4: Risk limits check
      const agentStatus = await storage.getAgentStatus();
      const riskCheck = await checkRiskLimits(
        side,
        symbol,
        quantity,
        agentStatus?.killSwitchActive || false,
        normalizeSymbolForAlpaca
      );
      if (!riskCheck.allowed) {
        log.warn("Trading", `ORDER_BLOCKED: ${symbol} - Risk limit exceeded`, {
          symbol,
          side,
          quantity,
          reason: "RISK_LIMIT_EXCEEDED",
          riskCheckReason: riskCheck.reason,
        });
        return { success: false, error: riskCheck.reason };
      }

      // Guard 5: Tradability validation
      const tradabilityCheck =
        await tradabilityService.validateSymbolTradable(symbol);
      if (!tradabilityCheck.tradable) {
        log.warn("Trading", `ORDER_BLOCKED: ${symbol} - Symbol not tradable`, {
          symbol,
          side,
          quantity,
          reason: "SYMBOL_NOT_TRADABLE",
          tradabilityReason: tradabilityCheck.reason,
        });
        return {
          success: false,
          error: `Symbol ${symbol} is not tradable: ${tradabilityCheck.reason || "Not found in broker universe"}`,
        };
      }

      const alpacaSymbol = normalizeSymbolForAlpaca(symbol, true);
      const isCrypto = isCryptoSymbol(symbol);
      let order: AlpacaOrder;

      // Guard 6: Extended hours restrictions
      if (extendedHours && isCrypto) {
        log.warn(
          "Trading",
          `ORDER_BLOCKED: ${symbol} - Extended hours not available for crypto`,
          {
            symbol,
            side,
            quantity,
            reason: "EXTENDED_HOURS_CRYPTO_NOT_SUPPORTED",
          }
        );
        return {
          success: false,
          error: "Extended hours trading is not available for crypto",
        };
      }

      // FIXED: Extended hours allows both limit AND stop_limit orders per Alpaca API docs
      if (extendedHours && !["limit", "stop_limit"].includes(orderType)) {
        log.warn(
          "Trading",
          `ORDER_BLOCKED: ${symbol} - Extended hours requires limit or stop_limit orders`,
          {
            symbol,
            side,
            quantity,
            orderType,
            reason: "EXTENDED_HOURS_REQUIRES_LIMIT_OR_STOP_LIMIT",
          }
        );
        return {
          success: false,
          error:
            "Extended hours trading requires limit or stop_limit orders only",
        };
      }

      if (extendedHours && !limitPrice) {
        log.warn(
          "Trading",
          `ORDER_BLOCKED: ${symbol} - Extended hours requires limit price`,
          {
            symbol,
            side,
            quantity,
            reason: "EXTENDED_HOURS_REQUIRES_LIMIT_PRICE",
          }
        );
        return {
          success: false,
          error: "Extended hours trading requires a limit price",
        };
      }

      if (extendedHours && !Number.isInteger(quantity)) {
        log.warn(
          "Trading",
          `ORDER_BLOCKED: ${symbol} - Extended hours requires whole shares`,
          {
            symbol,
            side,
            quantity,
            reason: "EXTENDED_HOURS_REQUIRES_WHOLE_SHARES",
          }
        );
        return {
          success: false,
          error:
            "Extended hours trading requires whole share quantities (no fractional shares)",
        };
      }

      // ============================================================================
      // ORDER TYPE SELECTION - Choose appropriate order type based on parameters
      // ============================================================================

      const shouldUseBracketOrder =
        useBracketOrder &&
        side === "buy" &&
        stopLossPrice &&
        takeProfitPrice &&
        !isCrypto &&
        !extendedHours;

      if (shouldUseBracketOrder) {
        // CRITICAL FIX: Bracket orders MUST use time_in_force: "day" per Alpaca API requirements
        // Using "gtc" will result in HTTP 422 rejection from the API
        const bracketParams: BracketOrderParams = {
          symbol: alpacaSymbol,
          qty: quantity.toString(),
          side,
          type: orderType === "limit" ? "limit" : "market",
          time_in_force: "day", // FIXED: Was "gtc" which causes 422 rejection
          take_profit_price: takeProfitPrice.toFixed(2),
          stop_loss_price: stopLossPrice.toFixed(2),
        };

        if (orderType === "limit" && limitPrice) {
          bracketParams.limit_price = limitPrice.toString();
        }

        logger.info(
          "Trading",
          `Creating bracket order for ${symbol}: Entry=${limitPrice || "market"}, TP=$${takeProfitPrice.toFixed(2)}, SL=$${stopLossPrice.toFixed(2)}, TIF=day`
        );
        order = await alpaca.createBracketOrder(bracketParams);
        logger.info("Trading", `Bracket order submitted for ${symbol}`, {
          orderId: order.id,
          status: order.status,
        });
      } else if (
        trailingStopPercent &&
        side === "sell" &&
        !isCrypto &&
        !extendedHours
      ) {
        log.info("Trading", "Creating trailing stop order", {
          symbol,
          trailingStopPercent,
        });
        order = await alpaca.createTrailingStopOrder({
          symbol: alpacaSymbol,
          qty: quantity.toString(),
          side,
          trail_percent: trailingStopPercent,
          time_in_force: "gtc",
        });
      } else if (extendedHours) {
        const orderParams: CreateOrderParams = {
          symbol: alpacaSymbol,
          qty: quantity.toString(),
          side,
          type: "limit",
          time_in_force: "day",
          limit_price: limitPrice!.toString(),
          extended_hours: true,
        };

        log.info("Trading", "Creating extended hours limit order", {
          symbol,
          side,
          quantity,
          limitPrice,
        });
        order = await alpaca.createOrder(orderParams);
      } else {
        // CRITICAL FIX: Market orders CANNOT use GTC time_in_force
        // Market orders must use: day, ioc, fok, opg, or cls
        // For crypto with limit orders, GTC is valid; for market orders, use "day"
        const effectiveTif =
          orderType === "market"
            ? "day" // Market orders cannot be GTC
            : isCrypto
              ? "gtc"
              : "day"; // Limit orders can use GTC for crypto

        const orderParams: CreateOrderParams = {
          symbol: alpacaSymbol,
          qty: quantity.toString(),
          side,
          type: orderType,
          time_in_force: effectiveTif,
        };

        if (orderType === "limit" && limitPrice) {
          orderParams.limit_price = limitPrice.toString();
        }

        order = await alpaca.createOrder(orderParams);
      }

      // ============================================================================
      // POST-EXECUTION - Record trade, emit events, create automated stop-loss
      // ============================================================================

      const filledPrice = order.filled_avg_price
        ? safeParseFloat(order.filled_avg_price)
        : limitPrice || 0;

      let tradeNotes = notes || `Alpaca Order ID: ${order.id}`;
      if (shouldUseBracketOrder) {
        tradeNotes += ` | Bracket: SL=$${stopLossPrice?.toFixed(2)}, TP=$${takeProfitPrice?.toFixed(2)}`;
      }

      const trade = await storage.createTrade({
        symbol: symbol.toUpperCase(),
        side,
        quantity: quantity.toString(),
        price: filledPrice.toString(),
        strategyId: strategyId || null,
        status: order.status,
        notes: tradeNotes,
        pnl: null,
        userId: userId, // SECURITY: Ensure trade is attributed to authenticated user
      });

      await this.updateAgentStats();

      const tradeEvent: TradeExecutedEvent = {
        tradeId: trade.id,
        orderId: order.id,
        symbol: symbol.toUpperCase(),
        side,
        quantity,
        price: filledPrice,
        status: order.status,
        strategyId,
      };
      eventBus.emit("trade:executed", tradeEvent, "order-executor");
      logger.trade(`Executed ${side} ${quantity} ${symbol} @ $${filledPrice}`, {
        orderId: order.id,
        status: order.status,
      });

      // AUTOMATED STOP-LOSS: Create stop-loss order after successful buy
      if (
        side === "buy" &&
        order.status === "filled" &&
        !shouldUseBracketOrder &&
        !isCrypto &&
        !extendedHours
      ) {
        try {
          // Calculate stop-loss price (2% below entry for risk management)
          const entryPrice = filledPrice || limitPrice || 0;
          const stopLossPrice = entryPrice * 0.98; // 2% stop-loss

          logger.info("Trading", `Creating automated stop-loss for ${symbol}`, {
            entryPrice,
            stopLossPrice: stopLossPrice.toFixed(2),
            quantity,
          });

          // Create stop-loss order
          const stopLossOrder = await alpaca.createOrder({
            symbol: alpacaSymbol,
            qty: quantity.toString(),
            side: "sell",
            type: "stop",
            stop_price: stopLossPrice.toFixed(2),
            time_in_force: "gtc",
          });

          // Store stop-loss relationship in trade notes
          await storage.updateTrade(trade.id, {
            notes: `${tradeNotes} | Stop-Loss: Order ${stopLossOrder.id} @ $${stopLossPrice.toFixed(2)}`,
          });

          logger.info("Trading", `Automated stop-loss created for ${symbol}`, {
            stopLossOrderId: stopLossOrder.id,
            stopLossPrice: stopLossPrice.toFixed(2),
            tradeId: trade.id,
          });
        } catch (stopLossError) {
          // Log error but don't fail the main trade
          logger.error(
            "Trading",
            `Failed to create automated stop-loss for ${symbol}`,
            {
              error: (stopLossError as Error).message,
              tradeId: trade.id,
            }
          );
        }
      }

      return { success: true, order, trade };
    } catch (error) {
      const errorMsg = (error as Error).message;
      logger.error(
        "Trading",
        `Trade execution FAILED for ${request.symbol}: ${errorMsg}`,
        {
          symbol: request.symbol,
          side: request.side,
          quantity: request.quantity,
          orderType: request.orderType,
          useBracketOrder: request.useBracketOrder,
          error: errorMsg,
        }
      );
      eventBus.emit(
        "trade:error",
        {
          symbol: request.symbol,
          side: request.side,
          quantity: request.quantity,
          message: errorMsg,
          orderType: request.orderType,
          useBracketOrder: request.useBracketOrder,
        },
        "order-executor"
      );
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Update agent statistics after trade execution
   *
   * Calculates and updates key trading performance metrics:
   * - Total number of trades
   * - Total realized P&L (profit/loss)
   * - Win rate percentage
   * - Last heartbeat timestamp
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
      log.error("OrderExecutor", "Failed to update agent stats", {
        error: (error as Error).message,
      });
    }
  }
}

export const orderExecutor = new OrderExecutor();
