/**
 * Strategy Order Service
 *
 * Bridges strategy configuration to order execution.
 * This module ensures that strategy parameters (position sizing, entry rules,
 * bracket orders) are properly applied when executing trades.
 *
 * Key responsibilities:
 * - Load strategy and parse execution context
 * - Validate AI decisions against strategy rules
 * - Calculate position sizes based on strategy config
 * - Generate bracket order parameters
 * - Submit orders through unified executor with all params applied
 */

import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { log } from "../utils/logger";
import { getCounter, setCounter, isRedisAvailable } from "../lib/redis-cache";
import { unifiedOrderExecutor, type UnifiedOrderRequest, type UnifiedOrderResult } from "./unified-order-executor";
import {
  parseStrategyContext,
  validateDecision,
  calculatePositionSize,
  calculateBracketOrderParams,
  getTimeInForce,
  getOrderType,
  calculateLimitPrice,
  logExecutionContext,
  type StrategyExecutionContext,
  type AIDecision,
  type ValidationResult,
  type PositionSizeResult,
  type BracketOrderParams,
} from "../autonomous/strategy-execution-context";
import type { Strategy } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Request to execute a trade with strategy context
 */
export interface StrategyOrderRequest {
  strategyId: string;
  symbol: string;
  side: "buy" | "sell";
  decision?: AIDecision;
  overrideQty?: number;
  overrideNotional?: number;
  traceId?: string;
  bypassQueue?: boolean;
}

/**
 * Result from strategy order execution
 */
export interface StrategyOrderResult {
  success: boolean;
  orderId?: string;
  clientOrderId?: string;
  status?: string;
  error?: string;
  validation?: ValidationResult;
  positionSize?: PositionSizeResult;
  bracketParams?: BracketOrderParams | null;
  context?: {
    strategyId: string;
    strategyName: string;
    mode: "paper" | "live" | null;
  };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class StrategyOrderService {
  // Removed: in-memory position count cache (TE-004 fix)
  // Now using Redis atomic counters for thread-safe position counting

  /**
   * Execute a trade using strategy configuration
   *
   * This is the main entry point for strategy-aware order execution.
   * It loads the strategy, validates the decision, calculates position size,
   * and submits the order with all strategy parameters applied.
   */
  async executeWithStrategy(request: StrategyOrderRequest): Promise<StrategyOrderResult> {
    const { strategyId, symbol, side, decision, overrideQty, overrideNotional, traceId, bypassQueue } = request;

    try {
      // 1. Load strategy and parse context
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return {
          success: false,
          error: `Strategy not found: ${strategyId}`,
        };
      }

      // Check if strategy is in a deployable state
      if (!this.isStrategyExecutable(strategy)) {
        return {
          success: false,
          error: `Strategy ${strategy.name} is not in an executable state (status: ${strategy.status})`,
          context: {
            strategyId: strategy.id,
            strategyName: strategy.name,
            mode: (strategy.mode as "paper" | "live") || null,
          },
        };
      }

      const context = parseStrategyContext(strategy);
      logExecutionContext(context);

      // 2. Get current position count for validation
      const positionCount = await this.getStrategyPositionCount(strategyId);

      // 3. Validate decision against entry rules (if decision provided)
      if (decision) {
        const validation = validateDecision(decision, context, positionCount);
        if (!validation.valid) {
          log.warn("StrategyOrderService", "Decision validation failed", {
            strategyId,
            symbol,
            reason: validation.reason,
          });
          return {
            success: false,
            error: validation.reason,
            validation,
            context: {
              strategyId: strategy.id,
              strategyName: strategy.name,
              mode: (strategy.mode as "paper" | "live") || null,
            },
          };
        }

        if (validation.warnings && validation.warnings.length > 0) {
          log.info("StrategyOrderService", "Decision validation warnings", {
            strategyId,
            symbol,
            warnings: validation.warnings,
          });
        }
      }

      // 4. Get current price for calculations
      const quote = await this.getCurrentPrice(symbol);
      if (!quote.price) {
        return {
          success: false,
          error: `Unable to get current price for ${symbol}`,
        };
      }

      // 5. Get portfolio value for position sizing
      const portfolioValue = await this.getPortfolioValue();
      if (!portfolioValue) {
        return {
          success: false,
          error: "Unable to get portfolio value",
        };
      }

      // 6. Calculate position size (unless overridden)
      let quantity: number;
      let notional: number | undefined;
      let positionSizeResult: PositionSizeResult | undefined;

      if (overrideQty) {
        quantity = overrideQty;
      } else if (overrideNotional) {
        quantity = Math.floor(overrideNotional / quote.price);
        notional = overrideNotional;
      } else {
        positionSizeResult = calculatePositionSize(context, portfolioValue, quote.price);
        if (positionSizeResult.quantity < 1) {
          return {
            success: false,
            error: positionSizeResult.warnings?.[0] || "Position size too small",
            positionSize: positionSizeResult,
          };
        }
        quantity = positionSizeResult.quantity;
        notional = positionSizeResult.notional;

        if (positionSizeResult.warnings && positionSizeResult.warnings.length > 0) {
          log.info("StrategyOrderService", "Position sizing warnings", {
            strategyId,
            symbol,
            warnings: positionSizeResult.warnings,
          });
        }
      }

      // 7. Calculate bracket order params if enabled
      const bracketParams = calculateBracketOrderParams(context, quote.price, side);

      // 8. Determine order type and parameters
      const orderType = getOrderType(context);
      const timeInForce = getTimeInForce(context);
      const limitPrice = orderType === "limit" ? calculateLimitPrice(context, quote.price, side) : undefined;

      // 9. Build unified order request
      const orderRequest: UnifiedOrderRequest = {
        symbol,
        side,
        qty: quantity.toString(),
        type: orderType,
        timeInForce,
        limitPrice: limitPrice?.toString(),
        strategyId,
        decisionId: decision ? (decision as AIDecision & { id?: string }).id : undefined,
        traceId,
        bypassQueue,
        extendedHours: context.params.orderExecution.extendedHours,
      };

      // Add bracket order parameters if enabled
      if (bracketParams) {
        orderRequest.orderClass = "bracket";
        orderRequest.takeProfitLimitPrice = bracketParams.takeProfitPrice?.toString();
        orderRequest.stopLossStopPrice = bracketParams.stopLossPrice?.toString();
        if (bracketParams.trailingStopPercent) {
          orderRequest.trailPercent = bracketParams.trailingStopPercent.toString();
        }
      }

      log.info("StrategyOrderService", "Submitting strategy order", {
        strategyId,
        strategyName: strategy.name,
        symbol,
        side,
        quantity,
        orderType,
        timeInForce,
        hasBracket: !!bracketParams,
        mode: strategy.mode,
      });

      // 10. Submit order through unified executor
      const result = await unifiedOrderExecutor.submitOrder(orderRequest);

      if (result.success) {
        log.info("StrategyOrderService", "Strategy order submitted successfully", {
          strategyId,
          orderId: result.orderId,
          clientOrderId: result.clientOrderId,
        });

        // No cache invalidation needed - Redis atomic counters are source of truth
      } else {
        log.error("StrategyOrderService", "Strategy order failed", {
          strategyId,
          error: result.error,
        });
      }

      return {
        success: result.success,
        orderId: result.orderId,
        clientOrderId: result.clientOrderId,
        status: result.status,
        error: result.error,
        positionSize: positionSizeResult,
        bracketParams,
        context: {
          strategyId: strategy.id,
          strategyName: strategy.name,
          mode: (strategy.mode as "paper" | "live") || null,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error("StrategyOrderService", "Unexpected error executing strategy order", {
        strategyId,
        symbol,
        error: errorMessage,
      });
      return {
        success: false,
        error: `Unexpected error: ${errorMessage}`,
      };
    }
  }

  /**
   * Check if a strategy is in an executable state
   */
  private isStrategyExecutable(strategy: Strategy): boolean {
    const executableStatuses = ["paper", "live"];
    return executableStatuses.includes(strategy.status || "");
  }

  /**
   * Get current position count for a strategy (thread-safe via Redis)
   *
   * TE-004 FIX: Uses Redis atomic counters instead of in-memory cache
   * - Redis GET is atomic - no race conditions
   * - Falls back to database if Redis unavailable
   * - Counter initialized from DB on first access
   */
  private async getStrategyPositionCount(strategyId: string): Promise<number> {
    const cacheKey = `strategy:${strategyId}:position_count`;

    try {
      // Try Redis first (atomic, thread-safe)
      if (isRedisAvailable()) {
        const cachedCount = await getCounter(cacheKey);

        if (cachedCount !== null) {
          return cachedCount;
        }

        // Initialize Redis counter from database
        const positions = await storage.getPositionsByStrategy(strategyId);
        const count = positions.length;
        await setCounter(cacheKey, count);

        log.debug("StrategyOrderService", "Initialized position count in Redis", {
          strategyId,
          count,
        });

        return count;
      }

      // Fallback to database if Redis unavailable
      const positions = await storage.getPositionsByStrategy(strategyId);
      return positions.length;
    } catch (error) {
      log.warn("StrategyOrderService", "Failed to get position count, using 0", {
        strategyId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get current price for a symbol
   */
  private async getCurrentPrice(symbol: string): Promise<{ price: number | null; bid?: number; ask?: number }> {
    try {
      const snapshots = await alpaca.getSnapshots([symbol]);
      const snapshot = snapshots[symbol];

      if (!snapshot) {
        log.warn("StrategyOrderService", "No snapshot returned for symbol", { symbol });
        return { price: null };
      }

      // Prefer quote mid-price, fall back to latest trade
      if (snapshot.latestQuote && snapshot.latestQuote.bp > 0 && snapshot.latestQuote.ap > 0) {
        const price = (snapshot.latestQuote.bp + snapshot.latestQuote.ap) / 2;
        return {
          price,
          bid: snapshot.latestQuote.bp,
          ask: snapshot.latestQuote.ap,
        };
      }

      if (snapshot.latestTrade && snapshot.latestTrade.p > 0) {
        return { price: snapshot.latestTrade.p };
      }

      log.warn("StrategyOrderService", "Snapshot has no valid price data", { symbol });
      return { price: null };
    } catch (error) {
      log.error("StrategyOrderService", "Failed to get price data", {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return { price: null };
    }
  }

  /**
   * Get current portfolio value for position sizing
   */
  private async getPortfolioValue(): Promise<number | null> {
    try {
      const account = await alpaca.getAccount();
      return parseFloat(account.portfolio_value);
    } catch (error) {
      log.error("StrategyOrderService", "Failed to get portfolio value", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Execute a sell order for an existing position using strategy context
   */
  async closePosition(
    strategyId: string,
    symbol: string,
    quantity?: number,
    traceId?: string
  ): Promise<StrategyOrderResult> {
    // For closes, we don't need to validate entry rules or calculate position size
    // Just use strategy's order execution settings
    const strategy = await storage.getStrategy(strategyId);
    if (!strategy) {
      return {
        success: false,
        error: `Strategy not found: ${strategyId}`,
      };
    }

    const context = parseStrategyContext(strategy);

    // Get current position if quantity not specified
    let closeQty = quantity;
    if (!closeQty) {
      try {
        const positions = await alpaca.getPositions();
        const position = positions.find((p) => p.symbol === symbol);
        if (!position) {
          return {
            success: false,
            error: `No position found for ${symbol}`,
          };
        }
        closeQty = Math.abs(parseFloat(position.qty));
      } catch (error) {
        return {
          success: false,
          error: `Failed to get position: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    const orderRequest: UnifiedOrderRequest = {
      symbol,
      side: "sell",
      qty: closeQty.toString(),
      type: getOrderType(context),
      timeInForce: getTimeInForce(context),
      strategyId,
      traceId,
    };

    const result = await unifiedOrderExecutor.submitOrder(orderRequest);

    return {
      success: result.success,
      orderId: result.orderId,
      clientOrderId: result.clientOrderId,
      status: result.status,
      error: result.error,
      context: {
        strategyId: strategy.id,
        strategyName: strategy.name,
        mode: (strategy.mode as "paper" | "live") || null,
      },
    };
  }

  /**
   * Get strategy execution context for a strategy
   */
  async getExecutionContext(strategyId: string): Promise<StrategyExecutionContext | null> {
    const strategy = await storage.getStrategy(strategyId);
    if (!strategy) {
      return null;
    }
    return parseStrategyContext(strategy);
  }

  /**
   * Validate an AI decision against strategy rules without executing
   */
  async validateDecisionForStrategy(
    strategyId: string,
    decision: AIDecision
  ): Promise<ValidationResult> {
    const strategy = await storage.getStrategy(strategyId);
    if (!strategy) {
      return {
        valid: false,
        reason: `Strategy not found: ${strategyId}`,
      };
    }

    const context = parseStrategyContext(strategy);
    const positionCount = await this.getStrategyPositionCount(strategyId);
    return validateDecision(decision, context, positionCount);
  }

  /**
   * Preview position size calculation for a strategy
   */
  async previewPositionSize(
    strategyId: string,
    symbol: string
  ): Promise<PositionSizeResult & { portfolioValue?: number; currentPrice?: number }> {
    const strategy = await storage.getStrategy(strategyId);
    if (!strategy) {
      return {
        notional: 0,
        quantity: 0,
        warnings: [`Strategy not found: ${strategyId}`],
      };
    }

    const context = parseStrategyContext(strategy);
    const portfolioValue = await this.getPortfolioValue();
    const quote = await this.getCurrentPrice(symbol);

    if (!portfolioValue || !quote.price) {
      return {
        notional: 0,
        quantity: 0,
        warnings: ["Unable to get portfolio value or current price"],
      };
    }

    const result = calculatePositionSize(context, portfolioValue, quote.price);
    return {
      ...result,
      portfolioValue,
      currentPrice: quote.price,
    };
  }
}

// Export singleton instance
export const strategyOrderService = new StrategyOrderService();
