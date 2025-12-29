/**
 * Position Manager
 *
 * Handles all position lifecycle operations:
 * - Opening new positions (buy execution)
 * - Closing positions (sell execution, partial or full)
 * - Reinforcing existing positions (scale-in buying)
 * - Checking position rules (stop-loss, take-profit, trailing stops)
 * - Adjusting position rules (SL/TP modifications)
 */

import { alpaca, CreateOrderParams } from "../connectors/alpaca";
import { storage } from "../storage";
import { log } from "../utils/logger";
import { safeParseFloat } from "../utils/numeric";
import { toDecimal, calculatePnL, partialQuantity } from "../utils/money";
import type { AIDecision } from "../ai/decision-engine";
import { waitForAlpacaOrderFill } from "../trading/order-execution-flow";
import { recordTradeOutcome, updateTradeOutcomeOnClose } from "../ai/learning-service";
import { advancedRebalancingService } from "../services/advanced-rebalancing-service";
import { sectorExposureService } from "../services/sector-exposure-service";
import { tradabilityService } from "../services/tradability-service";

import type {
  PositionWithRules,
  ExecutionResult,
  RiskLimits,
  OrchestratorState,
} from "./types";
import { queueOrderExecution, queueOrderCancellation } from "./order-queue";
import { preTradeGuard, isSymbolTradable } from "./pre-trade-guard";
import { isCryptoSymbol, normalizeCryptoSymbol } from "./crypto-utils";

// ============================================================================
// POSITION MANAGER CLASS
// ============================================================================

/**
 * PositionManager handles all position lifecycle operations.
 *
 * It requires a reference to the orchestrator state to:
 * - Access and modify activePositions Map
 * - Track dailyPnl and dailyTradeCount
 * - Access portfolioValue for exposure calculations
 *
 * The manager uses dependency injection for state to allow
 * the orchestrator to maintain control over the state while
 * delegating position operations to this class.
 */
export class PositionManager {
  private state: OrchestratorState;
  private riskLimits: RiskLimits;
  private currentTraceId: string | null = null;
  private userId: string | null = null;

  constructor(
    state: OrchestratorState,
    riskLimits: RiskLimits,
    userId: string | null = null
  ) {
    this.state = state;
    this.riskLimits = riskLimits;
    this.userId = userId;
  }

  /**
   * Update the trace ID for logging correlation
   */
  setTraceId(traceId: string | null): void {
    this.currentTraceId = traceId;
  }

  /**
   * Update the user ID for database operations
   */
  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  /**
   * Update risk limits reference
   */
  updateRiskLimits(riskLimits: RiskLimits): void {
    this.riskLimits = riskLimits;
  }

  /**
   * Get current active positions
   */
  get activePositions(): Map<string, PositionWithRules> {
    return this.state.activePositions;
  }

  /**
   * Get current daily PnL
   */
  get dailyPnl(): number {
    return this.state.dailyPnl;
  }

  /**
   * Get current daily trade count
   */
  get dailyTradeCount(): number {
    return this.state.dailyTradeCount;
  }

  // ============================================================================
  // POSITION OPENING
  // ============================================================================

  /**
   * Open a new position based on an AI decision
   *
   * This function:
   * 1. Validates portfolio exposure limits
   * 2. Checks sector concentration limits
   * 3. Validates symbol tradability
   * 4. Performs pre-trade checks (buying power, market hours)
   * 5. Submits the order through the work queue
   * 6. Waits for fill confirmation
   * 7. Records the trade in the database
   * 8. Updates position tracking with rules
   *
   * @param symbol - The symbol to buy
   * @param decision - AI decision with confidence, reasoning, and suggested parameters
   * @returns ExecutionResult with success/failure status
   */
  async openPosition(
    symbol: string,
    decision: AIDecision
  ): Promise<ExecutionResult> {
    try {
      const account = await alpaca.getAccount();
      const portfolioValue = safeParseFloat(account.portfolio_value);

      // Update state with actual portfolio value
      this.state.portfolioValue = portfolioValue;

      const positionSizePercent = Math.min(
        (decision.suggestedQuantity || 0.05) * 100,
        this.riskLimits.maxPositionSizePercent
      );
      const positionValue = portfolioValue * (positionSizePercent / 100);

      const totalExposure = this.calculateTotalExposure(portfolioValue);
      if (
        totalExposure + positionSizePercent >
        this.riskLimits.maxTotalExposurePercent
      ) {
        return {
          success: false,
          action: "skip",
          reason: `Would exceed max exposure (${totalExposure.toFixed(1)}% + ${positionSizePercent.toFixed(1)}% > ${this.riskLimits.maxTotalExposurePercent}%)`,
          symbol,
        };
      }

      // Check sector exposure limits (prevent concentration in single sector)
      const sectorCheck = await sectorExposureService.checkExposure(
        symbol,
        positionValue,
        this.state.activePositions,
        portfolioValue
      );
      if (!sectorCheck.canTrade) {
        log.warn("PositionManager", `Sector exposure check failed for ${symbol}`, {
          sector: sectorCheck.sector,
          currentExposure: sectorCheck.currentExposure.toFixed(1),
          maxExposure: sectorCheck.maxExposure,
        });
        return {
          success: false,
          action: "skip",
          reason: sectorCheck.reason || `Sector exposure limit exceeded for ${sectorCheck.sector}`,
          symbol,
        };
      }

      const isCrypto = isCryptoSymbol(symbol);
      const brokerSymbol = isCrypto ? normalizeCryptoSymbol(symbol) : symbol;

      const tradableCheck = await isSymbolTradable(symbol, isCrypto);
      if (!tradableCheck.tradable) {
        log.warn("PositionManager", `Symbol ${symbol} not tradable: ${tradableCheck.reason}`);
        return {
          success: false,
          action: "skip",
          reason: tradableCheck.reason || "Symbol not tradable",
          symbol,
        };
      }

      const preCheck = await preTradeGuard(symbol, "buy", positionValue, isCrypto);
      if (!preCheck.canTrade) {
        log.warn("PositionManager", `Pre-trade check failed for ${symbol}: ${preCheck.reason}`);
        return {
          success: false,
          action: "skip",
          reason: preCheck.reason || "Pre-trade check failed",
          symbol,
        };
      }

      const tradabilityCheck = await tradabilityService.validateSymbolTradable(symbol);
      if (!tradabilityCheck.tradable) {
        log.warn("PositionManager", `Symbol ${symbol} not tradable: ${tradabilityCheck.reason}`);
        return {
          success: false,
          action: "skip",
          reason: `Symbol not tradable: ${tradabilityCheck.reason || 'Not in broker universe'}`,
          symbol,
        };
      }

      let queuedResult;
      // TEMPORARILY DISABLED: Bracket orders failing due to work-queue format mismatch
      // Use simple market orders until tsx server restart or format fix deployed
      const hasBracketParams = false; // Was: decision.targetPrice && decision.stopLoss && !isCrypto;

      if (preCheck.useExtendedHours && preCheck.useLimitOrder && preCheck.limitPrice) {
        log.info("PositionManager", `Extended hours limit order for ${symbol} @ $${preCheck.limitPrice}`);
        const estimatedQty = Math.floor(positionValue / preCheck.limitPrice);
        if (estimatedQty < 1) {
          return {
            success: false,
            action: "skip",
            reason: `Position value too small for whole share order ($${positionValue.toFixed(2)} at $${preCheck.limitPrice})`,
            symbol,
          };
        }
        const orderParams: CreateOrderParams = {
          symbol: brokerSymbol,
          qty: estimatedQty.toString(),
          side: "buy",
          type: "limit",
          time_in_force: "day",
          limit_price: preCheck.limitPrice.toFixed(2),
          extended_hours: true,
        };
        queuedResult = await queueOrderExecution({
          orderParams,
          traceId: this.currentTraceId,
          symbol,
          side: "buy",
          decisionId: decision.aiDecisionId,
        });
      } else if (hasBracketParams && decision.targetPrice && decision.stopLoss) {
        log.info("PositionManager", `Bracket order for ${symbol}: TP=$${decision.targetPrice.toFixed(2)}, SL=$${decision.stopLoss.toFixed(2)}`);
        const currentPrice = await this.fetchCurrentPrice(symbol);
        if (currentPrice > 0 && positionValue > 0) {
          const estimatedQty = (positionValue / currentPrice).toFixed(6);
          // CRITICAL FIX: Bracket orders MUST use time_in_force: "day" per Alpaca API requirements
          const orderParams: any = {
            symbol: brokerSymbol,
            qty: estimatedQty,
            side: "buy",
            type: "market",
            time_in_force: "day",
            order_class: "bracket",
            take_profit_limit_price: decision.targetPrice.toFixed(2),
            stop_loss_stop_price: decision.stopLoss.toFixed(2),
            take_profit: { limit_price: decision.targetPrice.toFixed(2) },
            stop_loss: { stop_price: decision.stopLoss.toFixed(2) },
          };
          queuedResult = await queueOrderExecution({
            orderParams,
            traceId: this.currentTraceId,
            symbol,
            side: "buy",
            decisionId: decision.aiDecisionId,
          });
        } else {
          log.warn("PositionManager", `Bracket order fallback - invalid price/value for ${symbol}`);
          const orderParams: CreateOrderParams = {
            symbol: brokerSymbol,
            notional: positionValue.toFixed(2),
            side: "buy",
            type: "market",
            time_in_force: "day",
          };
          queuedResult = await queueOrderExecution({
            orderParams,
            traceId: this.currentTraceId,
            symbol,
            side: "buy",
            decisionId: decision.aiDecisionId,
          });
        }
      } else {
        // CRITICAL FIX: Market orders CANNOT use GTC time_in_force
        const orderParams: CreateOrderParams = {
          symbol: brokerSymbol,
          notional: positionValue.toFixed(2),
          side: "buy",
          type: "market",
          time_in_force: "day",
        };
        queuedResult = await queueOrderExecution({
          orderParams,
          traceId: this.currentTraceId,
          symbol,
          side: "buy",
          decisionId: decision.aiDecisionId,
        });
      }

      const fillResult = await waitForAlpacaOrderFill(queuedResult.orderId);

      if (!fillResult.order) {
        log.error("PositionManager", `Order ${queuedResult.orderId} - no order data received`);
        return {
          success: false,
          action: "buy",
          reason: "Order failed - no response from broker",
          symbol,
          orderId: queuedResult.orderId,
        };
      }

      if (!fillResult.hasFillData) {
        log.error("PositionManager", `Order ${queuedResult.orderId} has no fill data`);
        return {
          success: false,
          action: "buy",
          reason: fillResult.timedOut
            ? "Order fill timed out - position sync triggered"
            : "Order rejected or no fill data",
          symbol,
          orderId: queuedResult.orderId,
        };
      }

      if (fillResult.timedOut && !fillResult.isFullyFilled) {
        log.warn("PositionManager", `Order ${queuedResult.orderId} timed out with partial fill, using available data`);
      }

      const order = fillResult.order;
      let filledPrice = safeParseFloat(order.filled_avg_price, 0);
      const filledQty = safeParseFloat(order.filled_qty, 0);

      // If Alpaca didn't return filled price, fetch current market price
      if (filledPrice === 0) {
        filledPrice = await this.fetchCurrentPrice(symbol);
        if (filledPrice > 0) {
          log.info("PositionManager", `Using market price ${filledPrice} for ${symbol}`);
        }
      }

      if (!this.userId) {
        throw new Error("Cannot create trade: userId not initialized");
      }
      const trade = await storage.createTrade({
        userId: this.userId,
        symbol,
        side: "buy",
        quantity: filledQty.toString(),
        price: filledPrice.toString(),
        status: "completed",
        notes: `AI autonomous: ${decision.reasoning}`,
        traceId: this.currentTraceId,
      });

      if (decision.aiDecisionId) {
        const marketStatus = await alpaca.getMarketStatus();
        recordTradeOutcome({
          decisionId: decision.aiDecisionId,
          tradeId: trade.id,
          symbol,
          action: "buy",
          predictionConfidence: decision.confidence,
          entryPrice: filledPrice,
          quantity: filledQty,
          marketSessionAtEntry: marketStatus.session,
          strategyId: undefined,
        }).catch(err => log.error("PositionManager", `Failed to record trade outcome: ${err}`));
      }

      this.state.dailyTradeCount++;

      const positionWithRules: PositionWithRules = {
        symbol,
        quantity: filledQty,
        availableQuantity: filledQty,
        entryPrice: filledPrice,
        currentPrice: filledPrice,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        openedAt: new Date(),
        stopLossPrice: decision.stopLoss,
        takeProfitPrice: decision.targetPrice,
        trailingStopPercent: decision.trailingStopPercent,
      };

      this.state.activePositions.set(symbol, positionWithRules);

      // Register with advanced rebalancing service for graduated take-profits and trailing stops
      advancedRebalancingService.registerPosition(symbol, filledPrice);
      log.info("PositionManager", `Registered ${symbol} with advanced rebalancing (4-tier take-profits, trailing stops)`);

      log.trade(`Opened position: ${symbol} $${positionValue.toFixed(2)}`, { symbol, value: positionValue });

      return {
        success: true,
        orderId: order.id,
        action: "buy",
        reason: decision.reasoning,
        symbol,
        quantity: positionWithRules.quantity,
        price: positionWithRules.entryPrice,
      };
    } catch (error) {
      log.error("PositionManager", `Failed to open position ${symbol}`, { error: String(error) });
      return {
        success: false,
        action: "buy",
        reason: `Order failed: ${error}`,
        symbol,
        error: String(error),
      };
    }
  }

  // ============================================================================
  // POSITION CLOSING
  // ============================================================================

  /**
   * Close a position (fully or partially)
   *
   * This function:
   * 1. Checks if closing at a loss is permitted (stop-loss or emergency)
   * 2. Cancels any pending orders for the symbol
   * 3. Submits the close order
   * 4. Waits for fill confirmation
   * 5. Records the trade and PnL
   * 6. Updates position tracking
   *
   * @param symbol - The symbol to sell
   * @param decision - AI decision with reasoning
   * @param position - Current position data
   * @param partialPercent - Percentage to close (default: 100)
   * @param options - Additional options (isStopLossTriggered, isEmergencyStop)
   * @returns ExecutionResult with success/failure status
   */
  async closePosition(
    symbol: string,
    decision: AIDecision,
    position: PositionWithRules,
    partialPercent: number = 100,
    options: { isStopLossTriggered?: boolean; isEmergencyStop?: boolean } = {}
  ): Promise<ExecutionResult> {
    try {
      const isCrypto = isCryptoSymbol(symbol);
      const brokerSymbol = isCrypto ? normalizeCryptoSymbol(symbol) : symbol;

      // LOSS PROTECTION: Don't close positions at a loss unless stop-loss or emergency stop triggered
      const isAtLoss = position.currentPrice < position.entryPrice;
      const isProtectedClose = options.isStopLossTriggered || options.isEmergencyStop;

      if (isAtLoss && !isProtectedClose) {
        const lossPercent = ((position.entryPrice - position.currentPrice) / position.entryPrice * 100).toFixed(2);
        log.info("PositionManager", `Blocking close of ${symbol} at ${lossPercent}% loss - stop loss not triggered`, {
          symbol,
          entryPrice: position.entryPrice,
          currentPrice: position.currentPrice,
          lossPercent,
        });
        return {
          success: false,
          action: "hold",
          reason: `Position at ${lossPercent}% loss - holding until stop-loss triggers or price recovers`,
          symbol,
        };
      }

      // Cancel any pending orders for this symbol
      try {
        const openOrders = await alpaca.getOrders("open");
        const symbolOrders = openOrders.filter(o => o.symbol === brokerSymbol);
        for (const order of symbolOrders) {
          try {
            await queueOrderCancellation({
              orderId: order.id,
              traceId: this.currentTraceId,
              symbol,
            });
            log.info("PositionManager", `Queued cancellation for pending order ${order.id} for ${symbol} before closing`);
          } catch {
            // Ignore cancellation errors
          }
        }
        if (symbolOrders.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        log.warn("PositionManager", `Failed to cancel orders for ${symbol}: ${err}`);
      }

      let orderId: string;
      if (partialPercent >= 100) {
        const initialOrder = await alpaca.closePosition(brokerSymbol);
        orderId = initialOrder.id;
      } else {
        const tradabilityCheck = await tradabilityService.validateSymbolTradable(symbol);
        if (!tradabilityCheck.tradable) {
          log.warn("PositionManager", `Cannot partial close ${symbol}: not tradable`);
          return {
            success: false,
            action: "sell",
            reason: `Symbol not tradable: ${tradabilityCheck.reason || 'Not in broker universe'}`,
            symbol,
          };
        }
        const closeQty = partialQuantity(position.quantity, partialPercent).toNumber();
        // CRITICAL FIX: Market orders CANNOT use GTC
        const orderParams: CreateOrderParams = {
          symbol: brokerSymbol,
          qty: closeQty.toString(),
          side: "sell",
          type: "market",
          time_in_force: "day",
        };
        const queuedResult = await queueOrderExecution({
          orderParams,
          traceId: this.currentTraceId,
          symbol,
          side: "sell",
          decisionId: decision.aiDecisionId,
        });
        orderId = queuedResult.orderId;
      }

      const fillResult = await waitForAlpacaOrderFill(orderId);

      if (!fillResult.order) {
        log.error("PositionManager", `Close order ${orderId} - no order data received`);
        return {
          success: false,
          action: "sell",
          reason: "Close order failed - no response from broker",
          symbol,
          orderId,
        };
      }

      if (!fillResult.hasFillData) {
        log.error("PositionManager", `Close order ${orderId} has no fill data`);
        return {
          success: false,
          action: "sell",
          reason: fillResult.timedOut
            ? "Close order fill timed out - position sync triggered"
            : "Close order rejected or no fill data",
          symbol,
          orderId,
        };
      }

      if (fillResult.timedOut && !fillResult.isFullyFilled) {
        log.warn("PositionManager", `Close order ${orderId} timed out with partial fill, using available data`);
      }

      const order = fillResult.order;
      let filledPrice = safeParseFloat(order.filled_avg_price, 0);
      const filledQty = safeParseFloat(order.filled_qty, 0);

      // If Alpaca didn't return filled price, fetch current market price
      if (filledPrice === 0) {
        filledPrice = await this.fetchCurrentPrice(symbol);
        if (filledPrice > 0) {
          log.info("PositionManager", `Using market price ${filledPrice} for ${symbol}`);
        }
      }

      const pnl = calculatePnL(position.entryPrice, filledPrice, filledQty, "long").toNumber();
      const exitReason = decision.reasoning || (pnl > 0 ? "take_profit" : "stop_loss");

      if (!this.userId) {
        throw new Error("Cannot create trade: userId not initialized");
      }
      await storage.createTrade({
        userId: this.userId,
        symbol,
        side: "sell",
        quantity: filledQty.toString(),
        price: filledPrice.toString(),
        pnl: pnl.toString(),
        status: "completed",
        notes: `AI autonomous: ${decision.reasoning}`,
        traceId: this.currentTraceId,
      });

      if (decision.aiDecisionId) {
        const marketStatus = await alpaca.getMarketStatus();
        updateTradeOutcomeOnClose(
          decision.aiDecisionId,
          filledPrice,
          exitReason,
          marketStatus.session
        ).catch(err => log.error("PositionManager", `Failed to update trade outcome: ${err}`));
      }

      this.state.dailyPnl += pnl;
      this.state.dailyTradeCount++;

      if (partialPercent >= 100) {
        this.state.activePositions.delete(symbol);
        // Clean up advanced rebalancing rules when position fully closed
        advancedRebalancingService.removePositionRules(symbol);
      } else {
        const remaining = toDecimal(position.quantity).minus(partialQuantity(position.quantity, partialPercent)).toNumber();
        position.quantity = remaining;
        this.state.activePositions.set(symbol, position);
      }

      log.trade(`Closed ${partialPercent}% of ${symbol}, P&L: $${pnl.toFixed(2)}`, { symbol, pnl, partialPercent });

      return {
        success: true,
        orderId: order.id,
        action: "sell",
        reason: decision.reasoning,
        symbol,
        quantity: filledQty,
        price: filledPrice,
      };
    } catch (error) {
      log.error("PositionManager", `Failed to close position ${symbol}`, { error: String(error) });
      return {
        success: false,
        action: "sell",
        reason: `Close failed: ${error}`,
        symbol,
        error: String(error),
      };
    }
  }

  // ============================================================================
  // POSITION REINFORCEMENT
  // ============================================================================

  /**
   * Reinforce an existing position by adding to it
   *
   * This scales down the buy size to 50% of the suggested quantity
   * to manage risk when adding to an existing position.
   *
   * @param symbol - The symbol to reinforce
   * @param decision - AI decision with reasoning
   * @param existingPosition - Current position data
   * @returns ExecutionResult with success/failure status
   */
  async reinforcePosition(
    symbol: string,
    decision: AIDecision,
    existingPosition: PositionWithRules
  ): Promise<ExecutionResult> {
    log.info("PositionManager", `Reinforcing position: ${symbol}`);

    const reinforceDecision: AIDecision = {
      ...decision,
      suggestedQuantity: (decision.suggestedQuantity || 0.05) * 0.5,
    };

    return await this.openPosition(symbol, reinforceDecision);
  }

  // ============================================================================
  // POSITION RULES CHECKING
  // ============================================================================

  /**
   * Check and apply position rules (stop-loss, take-profit, trailing stops)
   *
   * This function checks in priority order:
   * 1. Stop-loss trigger
   * 2. Emergency stop (high loss protection at -8%)
   * 3. Graduated take-profits (4-tier system)
   * 4. Trailing stop updates
   * 5. Max holding period check
   * 6. Legacy take-profit fallback
   *
   * @param symbol - The symbol to check
   * @param position - Current position data
   */
  async checkPositionRules(
    symbol: string,
    position: PositionWithRules
  ): Promise<void> {
    // 1. Check stop-loss first (highest priority)
    if (position.stopLossPrice && position.currentPrice <= position.stopLossPrice) {
      log.warn("PositionManager", `Stop-loss triggered for ${symbol}`);
      advancedRebalancingService.removePositionRules(symbol);
      await this.closePosition(
        symbol,
        {
          action: "sell",
          confidence: 1,
          reasoning: `Stop-loss triggered at $${position.stopLossPrice}`,
          riskLevel: "high",
        },
        position,
        100,
        { isStopLossTriggered: true }
      );
      return;
    }

    // 2. Check emergency stop (high loss protection)
    if (position.unrealizedPnlPercent <= -8) {
      log.warn("PositionManager", `Emergency stop for ${symbol} at ${position.unrealizedPnlPercent.toFixed(1)}% loss`);
      advancedRebalancingService.removePositionRules(symbol);
      await this.closePosition(
        symbol,
        {
          action: "sell",
          confidence: 1,
          reasoning: `Emergency stop: ${position.unrealizedPnlPercent.toFixed(1)}% loss`,
          riskLevel: "high",
        },
        position,
        100,
        { isEmergencyStop: true }
      );
      return;
    }

    // 3. Check graduated take-profits (4-tier system: 10%, 20%, 35%, 50% - each closes 25%)
    const partialTakeProfit = advancedRebalancingService.checkPartialTakeProfits(position);
    if (partialTakeProfit && partialTakeProfit.shouldClose) {
      log.info("PositionManager", `Graduated take-profit for ${symbol}: ${partialTakeProfit.reason}`);
      await this.closePosition(
        symbol,
        {
          action: "sell",
          confidence: 0.95,
          reasoning: partialTakeProfit.reason,
          riskLevel: "low",
        },
        position,
        partialTakeProfit.closePercent
      );
      return;
    }

    // 4. Update trailing stop if applicable
    const trailingUpdate = advancedRebalancingService.updateTrailingStop(position);
    if (trailingUpdate) {
      log.info("PositionManager", `Trailing stop update for ${symbol}: ${trailingUpdate.reason}`);
      position.stopLossPrice = trailingUpdate.newStopLoss;
      this.state.activePositions.set(symbol, position);
    }

    // 5. Check max holding period
    const holdingCheck = advancedRebalancingService.checkHoldingPeriod(position);
    if (holdingCheck && holdingCheck.exceeded) {
      log.warn("PositionManager", `Max holding period exceeded for ${symbol}: ${holdingCheck.holdingHours.toFixed(1)}h > ${holdingCheck.maxHours}h`);
      advancedRebalancingService.removePositionRules(symbol);
      await this.closePosition(
        symbol,
        {
          action: "sell",
          confidence: 0.8,
          reasoning: `Max holding period exceeded (${holdingCheck.holdingHours.toFixed(1)} hours)`,
          riskLevel: "medium",
        },
        position,
        100
      );
      return;
    }

    // 6. Fallback: Legacy take-profit check (if no advanced rules registered)
    if (position.takeProfitPrice && position.currentPrice >= position.takeProfitPrice) {
      log.info("PositionManager", `Legacy take-profit triggered for ${symbol}`);
      const pnlPercent = position.unrealizedPnlPercent;
      if (pnlPercent > 15) {
        await this.closePosition(
          symbol,
          {
            action: "sell",
            confidence: 1,
            reasoning: `Take-profit fully triggered at $${position.takeProfitPrice}`,
            riskLevel: "low",
          },
          position,
          100
        );
      } else if (pnlPercent > 10) {
        await this.closePosition(
          symbol,
          {
            action: "sell",
            confidence: 0.9,
            reasoning: `Partial take-profit at $${position.currentPrice}`,
            riskLevel: "low",
          },
          position,
          50
        );
      }
    }
  }

  // ============================================================================
  // POSITION RULES ADJUSTMENT
  // ============================================================================

  /**
   * Adjust stop-loss, take-profit, or trailing stop for a position
   *
   * @param symbol - The symbol to adjust
   * @param newStopLoss - New stop-loss price (optional)
   * @param newTakeProfit - New take-profit price (optional)
   * @param trailingStopPercent - New trailing stop percentage (optional)
   * @returns true if adjustment was successful
   */
  async adjustStopLossTakeProfit(
    symbol: string,
    newStopLoss?: number,
    newTakeProfit?: number,
    trailingStopPercent?: number
  ): Promise<boolean> {
    const position = this.state.activePositions.get(symbol);
    if (!position) {
      log.warn("PositionManager", `Cannot adjust SL/TP: Position ${symbol} not found`);
      return false;
    }

    if (newStopLoss !== undefined) {
      if (newStopLoss >= position.currentPrice) {
        log.warn("PositionManager", `Invalid stop loss: $${newStopLoss} >= current price $${position.currentPrice}`);
        return false;
      }
      position.stopLossPrice = newStopLoss;
    }

    if (newTakeProfit !== undefined) {
      if (newTakeProfit <= position.currentPrice) {
        log.warn("PositionManager", `Invalid take profit: $${newTakeProfit} <= current price $${position.currentPrice}`);
        return false;
      }
      position.takeProfitPrice = newTakeProfit;
    }

    if (trailingStopPercent !== undefined) {
      if (trailingStopPercent <= 0 || trailingStopPercent >= 100) {
        log.warn("PositionManager", `Invalid trailing stop percent: ${trailingStopPercent}`);
        return false;
      }
      position.trailingStopPercent = trailingStopPercent;
    }

    this.state.activePositions.set(symbol, position);
    log.info("PositionManager", `Updated ${symbol} - SL: $${position.stopLossPrice?.toFixed(2)}, TP: $${position.takeProfitPrice?.toFixed(2)}, Trail: ${position.trailingStopPercent || 'N/A'}%`);
    return true;
  }

  /**
   * Apply trailing stop to all profitable positions
   *
   * @param trailPercent - Trailing stop percentage (default: 5%)
   */
  async applyTrailingStopToAllPositions(trailPercent: number = 5): Promise<void> {
    for (const [symbol, position] of this.state.activePositions.entries()) {
      if (position.unrealizedPnlPercent > 0) {
        position.trailingStopPercent = trailPercent;
        this.state.activePositions.set(symbol, position);
        log.info("PositionManager", `Applied ${trailPercent}% trailing stop to ${symbol}`);
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Calculate total portfolio exposure as a percentage
   */
  private calculateTotalExposure(portfolioValue: number): number {
    let totalValue = 0;
    for (const position of this.state.activePositions.values()) {
      totalValue += position.currentPrice * position.quantity;
    }
    return (totalValue / portfolioValue) * 100;
  }

  /**
   * Fetch current market price for a symbol
   */
  private async fetchCurrentPrice(symbol: string): Promise<number> {
    try {
      const isCrypto = isCryptoSymbol(symbol);
      if (isCrypto) {
        const normSymbol = normalizeCryptoSymbol(symbol);
        const snapshots = await alpaca.getCryptoSnapshots([normSymbol]);
        const snapshot = snapshots[normSymbol];
        return snapshot?.latestTrade?.p || 0;
      } else {
        const snapshots = await alpaca.getSnapshots([symbol]);
        const snapshot = snapshots[symbol];
        return snapshot?.latestTrade?.p || 0;
      }
    } catch (error) {
      log.warn("PositionManager", `Failed to fetch current price for ${symbol}`, { error: String(error) });
      return 0;
    }
  }
}
