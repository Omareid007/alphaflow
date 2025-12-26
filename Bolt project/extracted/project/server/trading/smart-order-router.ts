/**
 * SMART ORDER ROUTER
 *
 * Intelligently transforms order parameters to ensure orders are NEVER rejected
 * due to incorrect order type, time-in-force, or configuration.
 *
 * Features:
 * - Auto-selects correct order type based on market session
 * - Auto-calculates limit prices for extended hours trading
 * - Auto-selects correct TIF based on order type and session
 * - Handles crypto 24/7 trading vs equity market hours
 * - Prevents common rejection scenarios
 */

import { log } from "../utils/logger";
import { tradingSessionManager, type SessionType } from "../services/trading-session-manager";
import { getMarketSession, type MarketSession as MarketSessionEnum } from "./order-types-matrix";

// ============================================================================
// TYPES
// ============================================================================

export interface OrderInput {
  symbol: string;
  side: "buy" | "sell";
  qty?: string;
  notional?: string;
  type?: "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";
  timeInForce?: "day" | "gtc" | "ioc" | "fok" | "opg" | "cls";
  limitPrice?: string;
  stopPrice?: string;
  extendedHours?: boolean;
  orderClass?: "simple" | "bracket" | "oco" | "oto";
  takeProfitLimitPrice?: string;
  stopLossStopPrice?: string;
  trailPercent?: string;
}

export interface CurrentPriceData {
  bid: number;
  ask: number;
  last: number;
  spread?: number;
}

export interface TransformedOrder extends OrderInput {
  type: "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";
  timeInForce: "day" | "gtc" | "ioc" | "fok" | "opg" | "cls";
  limitPrice?: string;
  extendedHours: boolean;
  transformations: string[];
  warnings: string[];
  session: SessionType;
  isCrypto: boolean;
}

export interface SmartOrderConfig {
  // Price buffer for extended hours limit orders (percentage)
  buyBufferPercent?: number;  // Default: 0.3% above ask
  sellBufferPercent?: number; // Default: 0.3% below bid

  // Aggressive limit order offset (for immediate execution)
  aggressiveLimitBufferPercent?: number; // Default: 0.5%

  // Whether to automatically upgrade market to limit in extended hours
  autoUpgradeMarketToLimit?: boolean; // Default: true

  // Whether to force day TIF for all extended hours orders
  forceExtendedHoursDayTIF?: boolean; // Default: true

  // Whether to warn on potentially bad limit prices
  enablePriceValidation?: boolean; // Default: true
}

const DEFAULT_CONFIG: Required<SmartOrderConfig> = {
  buyBufferPercent: 0.3,
  sellBufferPercent: 0.3,
  aggressiveLimitBufferPercent: 0.5,
  autoUpgradeMarketToLimit: true,
  forceExtendedHoursDayTIF: true,
  enablePriceValidation: true,
};

// ============================================================================
// SMART ORDER ROUTER
// ============================================================================

export class SmartOrderRouter {
  private config: Required<SmartOrderConfig>;

  constructor(config?: SmartOrderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main transformation function - ensures order will not be rejected
   */
  transformOrderForExecution(
    order: OrderInput,
    currentPrice: CurrentPriceData,
    sessionOverride?: SessionType
  ): TransformedOrder {
    const transformations: string[] = [];
    const warnings: string[] = [];

    // Detect if crypto (crypto trades 24/7)
    const isCrypto = this.isCryptoSymbol(order.symbol);

    // Get current market session
    const session = sessionOverride || this.detectMarketSession(order.symbol);

    log.debug("SmartOrderRouter", "Transforming order", {
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      session,
      isCrypto,
    });

    // Start with input order
    let transformedOrder = { ...order };

    // Step 1: Handle extended hours detection
    const isExtendedHours = this.isExtendedHoursSession(session);
    const needsExtendedHours = isExtendedHours && !isCrypto;

    // Step 2: Auto-select order type based on session
    const orderType = this.selectOrderType(
      order,
      session,
      isCrypto,
      transformations
    );
    transformedOrder.type = orderType;

    // Step 3: Auto-calculate limit price if needed
    if (this.needsLimitPrice(orderType, needsExtendedHours)) {
      const limitPrice = this.calculateLimitPrice(
        order,
        currentPrice,
        session,
        transformations,
        warnings
      );
      if (limitPrice) {
        transformedOrder.limitPrice = limitPrice;
      }
    }

    // Step 4: Auto-select TIF
    const timeInForce = this.selectTimeInForce(
      { ...transformedOrder, type: orderType },
      session,
      isCrypto,
      needsExtendedHours,
      transformations
    );
    transformedOrder.timeInForce = timeInForce;

    // Step 5: Set extended_hours flag
    transformedOrder.extendedHours = needsExtendedHours;
    if (needsExtendedHours && !order.extendedHours) {
      transformations.push(`Set extended_hours=true for ${session} session`);
    }

    // Step 6: Validate and warn on prices
    if (this.config.enablePriceValidation && transformedOrder.limitPrice) {
      this.validateLimitPrice(
        { ...transformedOrder, type: orderType, limitPrice: transformedOrder.limitPrice },
        currentPrice,
        warnings
      );
    }

    // Step 7: Handle bracket orders special case
    if (transformedOrder.orderClass === "bracket") {
      if (transformedOrder.timeInForce !== "day") {
        transformedOrder.timeInForce = "day";
        transformations.push("Forced bracket order TIF to 'day' (Alpaca requirement)");
      }
      if (session !== "regular" && !isCrypto) {
        warnings.push("Bracket orders only recommended during regular hours");
      }
    }

    // Step 8: Final validation
    this.finalValidation(
      { ...transformedOrder, type: orderType, timeInForce: timeInForce },
      session,
      isCrypto,
      warnings
    );

    return {
      ...transformedOrder,
      type: transformedOrder.type!,
      timeInForce: transformedOrder.timeInForce!,
      extendedHours: transformedOrder.extendedHours || false,
      transformations,
      warnings,
      session,
      isCrypto,
    };
  }

  /**
   * Detect if symbol is cryptocurrency
   */
  private isCryptoSymbol(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase();

    // Common crypto patterns
    const cryptoPatterns = [
      /BTC/, /ETH/, /DOGE/, /SOL/, /ADA/, /MATIC/, /AVAX/,
      /LTC/, /BCH/, /XRP/, /DOT/, /LINK/, /UNI/, /AAVE/,
      /\/USD$/, /\/USDT$/, /\/USDC$/, // Trading pairs
    ];

    return cryptoPatterns.some(pattern => pattern.test(upperSymbol));
  }

  /**
   * Detect current market session for a symbol
   */
  private detectMarketSession(symbol: string): SessionType {
    const isCrypto = this.isCryptoSymbol(symbol);

    if (isCrypto) {
      return "regular"; // Crypto is always "regular" (24/7)
    }

    // Use the trading session manager for equities
    const exchange = tradingSessionManager.detectExchange(symbol);
    const sessionInfo = tradingSessionManager.getCurrentSession(exchange);

    return sessionInfo.session;
  }

  /**
   * Check if session is extended hours
   */
  private isExtendedHoursSession(session: SessionType): boolean {
    return session === "pre_market" || session === "after_hours";
  }

  /**
   * Auto-select the correct order type based on session and conditions
   */
  private selectOrderType(
    order: OrderInput,
    session: SessionType,
    isCrypto: boolean,
    transformations: string[]
  ): "market" | "limit" | "stop" | "stop_limit" | "trailing_stop" {
    const requestedType = order.type || "market";

    // Market closed - only limit orders queue
    if (session === "closed" && !isCrypto) {
      if (requestedType === "market") {
        transformations.push("Upgraded market order to limit (market closed)");
        return "limit";
      }
      return requestedType;
    }

    // Extended hours - only limit and stop_limit allowed
    if (this.isExtendedHoursSession(session) && !isCrypto) {
      if (requestedType === "market" && this.config.autoUpgradeMarketToLimit) {
        transformations.push(`Upgraded market to limit order (${session})`);
        return "limit";
      }

      if (requestedType === "stop") {
        transformations.push(`Upgraded stop to stop_limit (${session})`);
        return "stop_limit";
      }

      if (requestedType === "trailing_stop") {
        transformations.push(`Changed trailing_stop to limit (not supported in ${session})`);
        return "limit";
      }

      // Only limit and stop_limit allowed in extended hours
      if (!["limit", "stop_limit"].includes(requestedType)) {
        transformations.push(`Forced to limit order (${session} restriction)`);
        return "limit";
      }
    }

    return requestedType;
  }

  /**
   * Check if order needs a limit price
   */
  private needsLimitPrice(
    orderType: string,
    needsExtendedHours: boolean
  ): boolean {
    // Limit and stop_limit always need limit price
    if (orderType === "limit" || orderType === "stop_limit") {
      return true;
    }

    // Extended hours needs limit price even if upgraded from market
    if (needsExtendedHours) {
      return true;
    }

    return false;
  }

  /**
   * Calculate appropriate limit price based on side and session
   */
  private calculateLimitPrice(
    order: OrderInput,
    currentPrice: CurrentPriceData,
    session: SessionType,
    transformations: string[],
    warnings: string[]
  ): string | undefined {
    // If limit price already provided, validate but use it
    if (order.limitPrice) {
      return order.limitPrice;
    }

    const { side } = order;
    const isExtendedHours = this.isExtendedHoursSession(session);

    // Calculate buffer percentage
    let bufferPercent = isExtendedHours
      ? this.config.aggressiveLimitBufferPercent
      : this.config.buyBufferPercent;

    let calculatedPrice: number;
    let priceSource: string;

    if (side === "buy") {
      // BUY orders: use ask price + buffer to ensure fill
      // In extended hours, wider spread requires more buffer
      const basePrice = currentPrice.ask || currentPrice.last;
      bufferPercent = isExtendedHours
        ? this.config.aggressiveLimitBufferPercent
        : this.config.buyBufferPercent;

      calculatedPrice = basePrice * (1 + bufferPercent / 100);
      priceSource = currentPrice.ask ? "ask" : "last";

      transformations.push(
        `Auto-calculated buy limit: $${calculatedPrice.toFixed(2)} ` +
        `(${priceSource} + ${bufferPercent}% buffer)`
      );
    } else {
      // SELL orders: use bid price - buffer
      const basePrice = currentPrice.bid || currentPrice.last;
      bufferPercent = isExtendedHours
        ? this.config.aggressiveLimitBufferPercent
        : this.config.sellBufferPercent;

      calculatedPrice = basePrice * (1 - bufferPercent / 100);
      priceSource = currentPrice.bid ? "bid" : "last";

      transformations.push(
        `Auto-calculated sell limit: $${calculatedPrice.toFixed(2)} ` +
        `(${priceSource} - ${bufferPercent}% buffer)`
      );
    }

    // Warn if spread is too wide (only if we calculated the price)
    if (currentPrice.spread && currentPrice.spread > 0.02) {
      warnings.push(
        `Wide spread detected (${(currentPrice.spread * 100).toFixed(2)}%) - ` +
        `limit price may result in poor fill`
      );
    }

    // Format to 2 decimal places for stocks, more for crypto
    const decimals = calculatedPrice < 1 ? 4 : 2;
    return calculatedPrice.toFixed(decimals);
  }

  /**
   * Select appropriate time-in-force
   */
  private selectTimeInForce(
    order: OrderInput & { type: string },
    session: SessionType,
    isCrypto: boolean,
    needsExtendedHours: boolean,
    transformations: string[]
  ): "day" | "gtc" | "ioc" | "fok" | "opg" | "cls" {
    const requestedTIF = order.timeInForce || "day";
    const orderType = order.type;

    // Rule 1: Market orders CANNOT use GTC
    if (orderType === "market" && requestedTIF === "gtc") {
      transformations.push("Changed market order TIF from 'gtc' to 'day' (not allowed)");
      return "day";
    }

    // Rule 2: Extended hours MUST use 'day' TIF
    if (needsExtendedHours && this.config.forceExtendedHoursDayTIF) {
      if (requestedTIF !== "day") {
        transformations.push(`Forced TIF to 'day' for extended hours (${session})`);
      }
      return "day";
    }

    // Rule 3: Bracket orders MUST use 'day'
    if (order.orderClass === "bracket" && requestedTIF !== "day") {
      transformations.push("Forced bracket order TIF to 'day' (Alpaca requirement)");
      return "day";
    }

    // Rule 4: Market closed - prefer 'day' to execute at next open
    if (session === "closed" && !isCrypto) {
      if (requestedTIF === "ioc" || requestedTIF === "fok") {
        transformations.push("Changed TIF from 'ioc'/'fok' to 'day' (market closed)");
        return "day";
      }
    }

    // Rule 5: Crypto market orders should use 'day' or 'ioc', not 'gtc'
    if (isCrypto && orderType === "market") {
      if (requestedTIF === "gtc") {
        transformations.push("Changed crypto market order TIF from 'gtc' to 'ioc'");
        return "ioc";
      }
      // Already handled by Rule 1 above for non-crypto
    }

    // Rule 6: Stop and trailing_stop can use 'day' or 'gtc'
    if ((orderType === "stop" || orderType === "trailing_stop") &&
        !["day", "gtc"].includes(requestedTIF)) {
      transformations.push(`Changed ${orderType} TIF to 'day' (only day/gtc allowed)`);
      return "day";
    }

    return requestedTIF;
  }

  /**
   * Validate limit price to warn on potentially bad prices
   */
  private validateLimitPrice(
    order: OrderInput & { type: string; limitPrice: string },
    currentPrice: CurrentPriceData,
    warnings: string[]
  ): void {
    const limitPrice = parseFloat(order.limitPrice);
    const marketPrice = currentPrice.last;
    const { side, type } = order;

    // Also check for wide spreads during validation
    if (currentPrice.spread && currentPrice.spread > 0.02) {
      warnings.push(
        `Wide spread detected (${(currentPrice.spread * 100).toFixed(2)}%) - ` +
        `limit price may result in poor fill`
      );
    }

    if (type === "limit") {
      if (side === "buy") {
        // Buy limit significantly above market = bad price
        if (limitPrice > marketPrice * 1.05) {
          warnings.push(
            `Buy limit $${limitPrice.toFixed(2)} is ${((limitPrice / marketPrice - 1) * 100).toFixed(1)}% ` +
            `above market $${marketPrice.toFixed(2)} - may fill at worse price`
          );
        }

        // Buy limit too far below market = may not fill
        if (limitPrice < marketPrice * 0.95) {
          warnings.push(
            `Buy limit $${limitPrice.toFixed(2)} is ${((1 - limitPrice / marketPrice) * 100).toFixed(1)}% ` +
            `below market $${marketPrice.toFixed(2)} - may not fill`
          );
        }
      } else {
        // Sell limit significantly below market = bad price
        if (limitPrice < marketPrice * 0.95) {
          warnings.push(
            `Sell limit $${limitPrice.toFixed(2)} is ${((1 - limitPrice / marketPrice) * 100).toFixed(1)}% ` +
            `below market $${marketPrice.toFixed(2)} - may fill at worse price`
          );
        }

        // Sell limit too far above market = may not fill
        if (limitPrice > marketPrice * 1.05) {
          warnings.push(
            `Sell limit $${limitPrice.toFixed(2)} is ${((limitPrice / marketPrice - 1) * 100).toFixed(1)}% ` +
            `above market $${marketPrice.toFixed(2)} - may not fill`
          );
        }
      }
    }
  }

  /**
   * Final validation before returning
   */
  private finalValidation(
    order: OrderInput & { type: string; timeInForce: string },
    session: SessionType,
    isCrypto: boolean,
    warnings: string[]
  ): void {
    // Check for fractional shares in extended hours
    if (session !== "regular" && !isCrypto && order.qty) {
      const qty = parseFloat(order.qty);
      if (qty < 1 || qty % 1 !== 0) {
        warnings.push(
          "Fractional shares not allowed in extended hours - order may be rejected"
        );
      }
    }

    // Check for notional orders in extended hours
    if (session !== "regular" && !isCrypto && order.notional) {
      warnings.push(
        "Notional orders may not work in extended hours - consider using qty instead"
      );
    }

    // Check for stop orders in extended hours
    if ((order.type === "stop" || order.type === "trailing_stop") &&
        session !== "regular" && !isCrypto) {
      warnings.push(
        `${order.type} orders may not trigger in extended hours`
      );
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SmartOrderConfig>): void {
    this.config = { ...this.config, ...config };
    log.info("SmartOrderRouter", "Configuration updated", config);
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<SmartOrderConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const smartOrderRouter = new SmartOrderRouter();

/**
 * Convenience function for transforming orders
 */
export function transformOrderForExecution(
  order: OrderInput,
  currentPrice: CurrentPriceData,
  sessionOverride?: SessionType
): TransformedOrder {
  return smartOrderRouter.transformOrderForExecution(order, currentPrice, sessionOverride);
}

/**
 * Create current price data from quote/snapshot
 */
export function createPriceData(quote: {
  bid?: number;
  ask?: number;
  last?: number;
}): CurrentPriceData {
  const bid = quote.bid || quote.last || 0;
  const ask = quote.ask || quote.last || 0;
  const last = quote.last || ((bid + ask) / 2);

  const spread = ask && bid ? (ask - bid) / last : 0;

  return {
    bid,
    ask,
    last,
    spread,
  };
}
