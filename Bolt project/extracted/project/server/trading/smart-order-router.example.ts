/**
 * SMART ORDER ROUTER USAGE EXAMPLES
 *
 * Demonstrates how to use the smart order router in real trading scenarios
 */

import { unifiedOrderExecutor } from "./unified-order-executor";
import {
  transformOrderForExecution,
  createPriceData,
  smartOrderRouter,
  type OrderInput,
} from "./smart-order-router";
import { alpaca } from "../connectors/alpaca";
import { log } from "../utils/logger";

// ============================================================================
// Example 1: Basic Usage with Auto-Transformation
// ============================================================================

export async function placeSmartMarketOrder(
  symbol: string,
  side: "buy" | "sell",
  qty: string,
  traceId?: string
) {
  log.info("SmartOrder", `Placing smart market order for ${symbol}`, { traceId });

  try {
    // 1. Get current price data
    const snapshots = await alpaca.getSnapshots([symbol]);
    const snapshot = snapshots[symbol];
    const priceData = createPriceData({
      bid: snapshot.latestQuote.bp,
      ask: snapshot.latestQuote.ap,
      last: snapshot.latestTrade.p,
    });

    log.debug("SmartOrder", "Current prices", {
      bid: priceData.bid,
      ask: priceData.ask,
      last: priceData.last,
      spread: priceData.spread,
    });

    // 2. Create order input
    const order: OrderInput = {
      symbol,
      side,
      qty,
      type: "market", // Will be auto-upgraded if needed
    };

    // 3. Transform order using smart router
    const transformed = transformOrderForExecution(order, priceData);

    // 4. Log transformations and warnings
    if (transformed.transformations.length > 0) {
      log.info("SmartOrder", "Order transformed", {
        symbol,
        transformations: transformed.transformations,
      });
    }

    if (transformed.warnings.length > 0) {
      log.warn("SmartOrder", "Order warnings", {
        symbol,
        warnings: transformed.warnings,
      });
    }

    // 5. Submit transformed order
    const result = await unifiedOrderExecutor.submitOrder({
      ...transformed,
      timeInForce: transformed.timeInForce as "day" | "gtc" | "ioc" | "fok",
      traceId,
    });

    log.info("SmartOrder", "Order submitted", {
      symbol,
      orderId: result.orderId,
      status: result.status,
    });

    return result;
  } catch (error) {
    log.error("SmartOrder", `Failed to place order for ${symbol}`, {
      error: error instanceof Error ? error.message : String(error),
      traceId,
    });
    throw error;
  }
}

// ============================================================================
// Example 2: Pre-Market Buy with Auto-Calculated Limit Price
// ============================================================================

export async function placePreMarketBuy(
  symbol: string,
  qty: string,
  traceId?: string
) {
  log.info("SmartOrder", `Placing pre-market buy for ${symbol}`, { traceId });

  // Get current quote
  const snapshots = await alpaca.getSnapshots([symbol]);
  const snapshot = snapshots[symbol];
  const priceData = createPriceData({
    bid: snapshot.latestQuote.bp,
    ask: snapshot.latestQuote.ap,
    last: snapshot.latestTrade.p,
  });

  // Input: Simple market order
  const order: OrderInput = {
    symbol,
    side: "buy",
    qty,
    type: "market", // NOT allowed in pre-market
  };

  // Transform: Will auto-upgrade to limit with calculated price
  const transformed = transformOrderForExecution(order, priceData);

  /*
   * Transformation result:
   * {
   *   type: "limit",                    // Upgraded from market
   *   limitPrice: "150.75",             // Auto-calculated (ask + 0.5%)
   *   timeInForce: "day",               // Required for extended hours
   *   extendedHours: true,              // Set automatically
   *   transformations: [
   *     "Upgraded market to limit order (pre_market)",
   *     "Auto-calculated buy limit: $150.75 (ask + 0.5% buffer)",
   *     "Set extended_hours=true for pre_market session"
   *   ]
   * }
   */

  // Submit the transformed order
  return await unifiedOrderExecutor.submitOrder({
    ...transformed,
    timeInForce: transformed.timeInForce as "day" | "gtc" | "ioc" | "fok",
    traceId,
  });
}

// ============================================================================
// Example 3: Bracket Order with Auto-Correction
// ============================================================================

export async function placeBracketOrder(
  symbol: string,
  side: "buy" | "sell",
  qty: string,
  entryPrice: string,
  takeProfitPrice: string,
  stopLossPrice: string,
  traceId?: string
) {
  log.info("SmartOrder", `Placing bracket order for ${symbol}`, { traceId });

  // Get current price for validation
  const snapshots = await alpaca.getSnapshots([symbol]);
  const snapshot = snapshots[symbol];
  const priceData = createPriceData({
    bid: snapshot.latestQuote.bp,
    ask: snapshot.latestQuote.ap,
    last: snapshot.latestTrade.p,
  });

  // Input: Bracket order with incorrect TIF
  const order: OrderInput = {
    symbol,
    side,
    qty,
    type: "limit",
    limitPrice: entryPrice,
    timeInForce: "gtc", // WRONG! Bracket orders must use 'day'
    orderClass: "bracket",
    takeProfitLimitPrice: takeProfitPrice,
    stopLossStopPrice: stopLossPrice,
  };

  // Transform: Will auto-fix TIF to 'day'
  const transformed = transformOrderForExecution(order, priceData);

  /*
   * Transformation result:
   * {
   *   timeInForce: "day",                  // Fixed from 'gtc'
   *   transformations: [
   *     "Forced bracket order TIF to 'day' (Alpaca requirement)"
   *   ]
   * }
   */

  // This will now succeed instead of getting HTTP 422 error!
  return await unifiedOrderExecutor.submitOrder({
    ...transformed,
    timeInForce: transformed.timeInForce as "day" | "gtc" | "ioc" | "fok",
    traceId,
  });
}

// ============================================================================
// Example 4: After-Hours Sell with Spread Warning
// ============================================================================

export async function placeAfterHoursSell(
  symbol: string,
  qty: string,
  traceId?: string
) {
  log.info("SmartOrder", `Placing after-hours sell for ${symbol}`, { traceId });

  const snapshots = await alpaca.getSnapshots([symbol]);
  const snapshot = snapshots[symbol];
  const priceData = createPriceData({
    bid: snapshot.latestQuote.bp,
    ask: snapshot.latestQuote.ap,
    last: snapshot.latestTrade.p,
  });

  // Check for wide spread
  if (priceData.spread && priceData.spread > 0.02) {
    log.warn("SmartOrder", `Wide spread detected: ${(priceData.spread * 100).toFixed(2)}%`, {
      symbol,
      bid: priceData.bid,
      ask: priceData.ask,
    });
  }

  const order: OrderInput = {
    symbol,
    side: "sell",
    qty,
    type: "market",
  };

  // Transform for after-hours
  const transformed = transformOrderForExecution(order, priceData);

  /*
   * Transformation result:
   * {
   *   type: "limit",
   *   limitPrice: "249.50",              // bid - 0.5% buffer
   *   timeInForce: "day",
   *   extendedHours: true,
   *   warnings: [
   *     "Wide spread detected (3.50%) - limit price may result in poor fill"
   *   ]
   * }
   */

  // Decide whether to proceed based on warnings
  if (transformed.warnings.length > 0) {
    log.warn("SmartOrder", "Order has warnings", {
      symbol,
      warnings: transformed.warnings,
    });

    // In production, you might:
    // - Alert trader
    // - Wait for better spread
    // - Adjust buffer percentage
    // - Cancel order
  }

  return await unifiedOrderExecutor.submitOrder({
    ...transformed,
    timeInForce: transformed.timeInForce as "day" | "gtc" | "ioc" | "fok",
    traceId,
  });
}

// ============================================================================
// Example 5: Crypto 24/7 Trading
// ============================================================================

export async function placeCryptoOrder(
  symbol: string,
  side: "buy" | "sell",
  qty: string,
  traceId?: string
) {
  log.info("SmartOrder", `Placing crypto order for ${symbol}`, { traceId });

  // For crypto, we might use a different data source
  // This is a simplified example using Alpaca's crypto endpoint
  const cryptoSnapshots = await alpaca.getCryptoSnapshots([symbol]);
  const snapshot = cryptoSnapshots[symbol];
  const lastPrice = snapshot?.latestTrade?.p || 0;
  const priceData = createPriceData({
    last: lastPrice,
    // Crypto might not have bid/ask in all data sources
    bid: lastPrice * 0.999,
    ask: lastPrice * 1.001,
  });

  const order: OrderInput = {
    symbol,
    side,
    qty,
    type: "market",
    timeInForce: "gtc", // INVALID for market orders
  };

  // Transform
  const transformed = transformOrderForExecution(order, priceData);

  /*
   * Transformation result:
   * {
   *   type: "market",
   *   timeInForce: "day",                // Fixed from 'gtc'
   *   extendedHours: false,              // Not needed for crypto
   *   isCrypto: true,
   *   transformations: [
   *     "Changed market order TIF from 'gtc' to 'day' (not allowed)"
   *   ]
   * }
   */

  return await unifiedOrderExecutor.submitOrder({
    ...transformed,
    timeInForce: transformed.timeInForce as "day" | "gtc" | "ioc" | "fok",
    traceId,
  });
}

// ============================================================================
// Example 6: Custom Configuration for High Volatility Stock
// ============================================================================

export async function placeHighVolatilityOrder(
  symbol: string,
  side: "buy" | "sell",
  qty: string,
  traceId?: string
) {
  log.info("SmartOrder", `Placing high-volatility order for ${symbol}`, { traceId });

  // Create custom router with wider buffers for volatile stocks
  const volatileRouter = smartOrderRouter;
  volatileRouter.updateConfig({
    buyBufferPercent: 1.0,             // 1% buffer for buys
    sellBufferPercent: 1.0,            // 1% buffer for sells
    aggressiveLimitBufferPercent: 2.0, // 2% for extended hours
  });

  const snapshots = await alpaca.getSnapshots([symbol]);
  const snapshot = snapshots[symbol];
  const priceData = createPriceData({
    bid: snapshot.latestQuote.bp,
    ask: snapshot.latestQuote.ap,
    last: snapshot.latestTrade.p,
  });

  const order: OrderInput = {
    symbol,
    side,
    qty,
    type: "market",
  };

  // Use custom router
  const transformed = volatileRouter.transformOrderForExecution(order, priceData);

  // Reset to default config after use
  volatileRouter.updateConfig({
    buyBufferPercent: 0.3,
    sellBufferPercent: 0.3,
    aggressiveLimitBufferPercent: 0.5,
  });

  return await unifiedOrderExecutor.submitOrder({
    ...transformed,
    timeInForce: transformed.timeInForce as "day" | "gtc" | "ioc" | "fok",
    traceId,
  });
}

// ============================================================================
// Example 7: Dry-Run Mode (Preview Transformations)
// ============================================================================

export async function previewOrderTransformations(
  symbol: string,
  side: "buy" | "sell",
  qty: string
): Promise<{
  original: OrderInput;
  transformed: any;
  willChange: boolean;
}> {
  const snapshots = await alpaca.getSnapshots([symbol]);
  const snapshot = snapshots[symbol];
  const priceData = createPriceData({
    bid: snapshot.latestQuote.bp,
    ask: snapshot.latestQuote.ap,
    last: snapshot.latestTrade.p,
  });

  const order: OrderInput = {
    symbol,
    side,
    qty,
    type: "market",
  };

  const transformed = transformOrderForExecution(order, priceData);

  const willChange = transformed.transformations.length > 0;

  return {
    original: order,
    transformed: {
      type: transformed.type,
      timeInForce: transformed.timeInForce,
      limitPrice: transformed.limitPrice,
      extendedHours: transformed.extendedHours,
      transformations: transformed.transformations,
      warnings: transformed.warnings,
      session: transformed.session,
    },
    willChange,
  };
}

// ============================================================================
// Example 8: Batch Order Processing with Smart Router
// ============================================================================

export async function processBatchOrders(
  orders: Array<{
    symbol: string;
    side: "buy" | "sell";
    qty: string;
  }>,
  traceId?: string
): Promise<Array<{ symbol: string; success: boolean; orderId?: string; error?: string }>> {
  const results = [];

  for (const order of orders) {
    try {
      const result = await placeSmartMarketOrder(
        order.symbol,
        order.side,
        order.qty,
        traceId
      );

      results.push({
        symbol: order.symbol,
        success: result.success,
        orderId: result.orderId,
      });
    } catch (error) {
      results.push({
        symbol: order.symbol,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return results;
}

// ============================================================================
// Usage in AI Trading Agent
// ============================================================================

export async function executeAIDecision(
  decision: {
    symbol: string;
    action: "buy" | "sell";
    quantity: string;
    confidence: number;
  },
  traceId: string
) {
  log.info("AIAgent", "Executing AI decision", {
    symbol: decision.symbol,
    action: decision.action,
    confidence: decision.confidence,
    traceId,
  });

  // Get current market data
  const snapshots = await alpaca.getSnapshots([decision.symbol]);
  const snapshot = snapshots[decision.symbol];
  const priceData = createPriceData({
    bid: snapshot.latestQuote.bp,
    ask: snapshot.latestQuote.ap,
    last: snapshot.latestTrade.p,
  });

  // Create order
  const order: OrderInput = {
    symbol: decision.symbol,
    side: decision.action === "buy" ? "buy" : "sell",
    qty: decision.quantity,
    type: "market", // AI wants market execution
  };

  // Transform with smart router
  const transformed = transformOrderForExecution(order, priceData);

  // Log what the router did
  log.info("AIAgent", "Order transformed by smart router", {
    symbol: decision.symbol,
    session: transformed.session,
    transformations: transformed.transformations,
    warnings: transformed.warnings,
    traceId,
  });

  // Check if transformations are acceptable for AI strategy
  if (transformed.type !== "market" && decision.confidence > 0.9) {
    log.warn("AIAgent", "High confidence decision was upgraded from market to limit", {
      symbol: decision.symbol,
      confidence: decision.confidence,
      newType: transformed.type,
      limitPrice: transformed.limitPrice,
      traceId,
    });
  }

  // Submit order
  const result = await unifiedOrderExecutor.submitOrder({
    ...transformed,
    timeInForce: transformed.timeInForce as "day" | "gtc" | "ioc" | "fok",
    traceId,
  });

  return {
    ...result,
    transformations: transformed.transformations,
    warnings: transformed.warnings,
  };
}
