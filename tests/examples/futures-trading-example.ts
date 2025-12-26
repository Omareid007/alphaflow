/**
 * Futures Trading Example
 *
 * This file demonstrates how to use the futures broker interface
 * for trading futures contracts.
 *
 * DO NOT RUN THIS IN PRODUCTION - This is for demonstration only.
 */

import {
  createFuturesBroker,
  type FuturesBroker,
  type FuturesOrderParams
} from "../connectors/futures-broker-interface";
import {
  getFuturesConfig,
  setFuturesBroker,
  isFuturesTradingAvailable,
  calculateFuturesPositionSize,
  isActiveTradingSession
} from "../strategies/futures-strategy";

// ============================================================================
// EXAMPLE 1: Initialize Broker Connection
// ============================================================================

async function example1_InitializeBroker() {
  console.log("\n=== Example 1: Initialize Broker ===\n");

  // For Interactive Brokers
  const ibBroker = createFuturesBroker("interactive_brokers", {
    host: process.env.IB_HOST || "127.0.0.1",
    port: parseInt(process.env.IB_PORT || "7497"),
    clientId: 0,
    paperTrading: true
  });

  try {
    await ibBroker.connect();
    console.log("✓ Connected to Interactive Brokers");

    // Register with futures strategy system
    setFuturesBroker(ibBroker);

    const status = ibBroker.getConnectionStatus();
    console.log("Connection status:", status);
  } catch (error) {
    console.error("✗ Failed to connect:", error);
  }
}

// ============================================================================
// EXAMPLE 2: Get Account Information
// ============================================================================

async function example2_GetAccountInfo(broker: FuturesBroker) {
  console.log("\n=== Example 2: Get Account Info ===\n");

  try {
    const account = await broker.getAccount();

    console.log("Account Details:");
    console.log(`  Net Liquidation: $${account.netLiquidation.toFixed(2)}`);
    console.log(`  Cash Balance: $${account.cashBalance.toFixed(2)}`);
    console.log(`  Available Funds: $${account.availableFunds.toFixed(2)}`);
    console.log(`  Initial Margin: $${account.initialMargin.toFixed(2)}`);
    console.log(`  Maintenance Margin: $${account.maintenanceMargin.toFixed(2)}`);
    console.log(`  Unrealized P&L: $${account.unrealizedPNL.toFixed(2)}`);
    console.log(`  Realized P&L: $${account.realizedPNL.toFixed(2)}`);
    console.log(`  Leverage: ${account.leverage.toFixed(2)}x`);
  } catch (error) {
    console.error("✗ Failed to get account info:", error);
  }
}

// ============================================================================
// EXAMPLE 3: Get Instrument Configuration
// ============================================================================

function example3_GetInstrumentConfig() {
  console.log("\n=== Example 3: Get Instrument Config ===\n");

  // Get Micro E-mini S&P 500 configuration
  const mesConfig = getFuturesConfig("MES");

  if (mesConfig) {
    console.log(`${mesConfig.name} (${mesConfig.symbol}):`);
    console.log(`  Exchange: ${mesConfig.exchange}`);
    console.log(`  Tick Size: ${mesConfig.tickSize}`);
    console.log(`  Tick Value: $${mesConfig.tickValue}`);
    console.log(`  Contract Size: $${mesConfig.contractSize}`);
    console.log(`  Initial Margin: $${mesConfig.marginRequirement.initial}`);
    console.log(`  Day Trading Margin: $${mesConfig.marginRequirement.dayTrading}`);
    console.log(`  Average Daily Range: ${mesConfig.volatilityProfile.averageDailyRange} points`);
    console.log(`  Volatility Level: ${mesConfig.volatilityProfile.volatilityLevel}`);
    console.log(`  Recommended Strategies: ${mesConfig.recommendedStrategies.join(", ")}`);
  }
}

// ============================================================================
// EXAMPLE 4: Check Trading Hours
// ============================================================================

function example4_CheckTradingHours() {
  console.log("\n=== Example 4: Check Trading Hours ===\n");

  const symbols = ["MES", "GC", "FDAX"];
  const currentTime = new Date();

  for (const symbol of symbols) {
    const isActive = isActiveTradingSession(symbol, currentTime);
    const config = getFuturesConfig(symbol);

    console.log(`${symbol}:`);
    console.log(`  Currently Active: ${isActive ? "Yes" : "No"}`);
    console.log(`  Best Trading Hours: ${config?.tradingHours.bestTradingHours.join(", ")}`);
    console.log(`  Active Sessions: ${config?.tradingHours.activeSessions.join(", ")}`);
  }
}

// ============================================================================
// EXAMPLE 5: Calculate Position Size
// ============================================================================

function example5_CalculatePositionSize() {
  console.log("\n=== Example 5: Calculate Position Size ===\n");

  const accountEquity = 100000; // $100k account
  const riskPerTrade = 1000; // Risk $1k per trade

  const symbols = ["MES", "MNQ", "GC"];

  for (const symbol of symbols) {
    const { contracts, notionalValue } = calculateFuturesPositionSize(
      symbol,
      accountEquity,
      riskPerTrade
    );

    const config = getFuturesConfig(symbol);
    const marginRequired = config ? contracts * config.marginRequirement.initial : 0;

    console.log(`${symbol}:`);
    console.log(`  Position Size: ${contracts} contracts`);
    console.log(`  Notional Value: $${notionalValue.toFixed(2)}`);
    console.log(`  Margin Required: $${marginRequired.toFixed(2)}`);
    console.log(`  Risk Amount: $${riskPerTrade.toFixed(2)}`);
  }
}

// ============================================================================
// EXAMPLE 6: Create Market Order
// ============================================================================

async function example6_CreateMarketOrder(broker: FuturesBroker) {
  console.log("\n=== Example 6: Create Market Order ===\n");

  const orderParams: FuturesOrderParams = {
    symbol: "MES",
    contractMonth: "202503", // March 2025
    side: "buy",
    quantity: 1,
    type: "market",
    timeInForce: "day",
    notes: "Example market order"
  };

  try {
    console.log("Placing market order...");
    console.log(`  Symbol: ${orderParams.symbol}`);
    console.log(`  Side: ${orderParams.side}`);
    console.log(`  Quantity: ${orderParams.quantity}`);

    const order = await broker.createOrder(orderParams);

    console.log("\n✓ Order placed successfully:");
    console.log(`  Order ID: ${order.id}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Filled Quantity: ${order.filledQuantity}/${order.quantity}`);
    if (order.avgFillPrice) {
      console.log(`  Avg Fill Price: ${order.avgFillPrice}`);
    }
  } catch (error) {
    console.error("✗ Failed to place order:", error);
  }
}

// ============================================================================
// EXAMPLE 7: Create Bracket Order (Entry + Stop Loss + Take Profit)
// ============================================================================

async function example7_CreateBracketOrder(broker: FuturesBroker) {
  console.log("\n=== Example 7: Create Bracket Order ===\n");

  // Get current quote to calculate stop/target prices
  const quote = await broker.getQuote("MES");
  const entryPrice = quote.last;
  const stopLoss = entryPrice - 10; // 10 points below entry
  const takeProfit = entryPrice + 20; // 20 points above entry

  try {
    console.log("Placing bracket order...");
    console.log(`  Entry: Market (~${entryPrice})`);
    console.log(`  Stop Loss: ${stopLoss}`);
    console.log(`  Take Profit: ${takeProfit}`);

    const order = await broker.createBracketOrder({
      symbol: "MES",
      side: "buy",
      quantity: 1,
      type: "market",
      timeInForce: "gtc",
      takeProfitPrice: takeProfit,
      stopLossPrice: stopLoss
    });

    console.log("\n✓ Bracket order placed successfully:");
    console.log(`  Main Order ID: ${order.id}`);
    console.log(`  Stop Loss Order: ${order.legs?.[0].id}`);
    console.log(`  Take Profit Order: ${order.legs?.[1].id}`);
  } catch (error) {
    console.error("✗ Failed to place bracket order:", error);
  }
}

// ============================================================================
// EXAMPLE 8: Get Current Positions
// ============================================================================

async function example8_GetPositions(broker: FuturesBroker) {
  console.log("\n=== Example 8: Get Positions ===\n");

  try {
    const positions = await broker.getPositions();

    if (positions.length === 0) {
      console.log("No open positions");
      return;
    }

    console.log(`Open Positions: ${positions.length}\n`);

    for (const position of positions) {
      console.log(`${position.symbol} (${position.contractMonth}):`);
      console.log(`  Side: ${position.side}`);
      console.log(`  Quantity: ${position.quantity} contracts`);
      console.log(`  Avg Entry: ${position.avgEntryPrice}`);
      console.log(`  Current Price: ${position.currentPrice}`);
      console.log(`  Unrealized P&L: $${position.unrealizedPnl.toFixed(2)}`);
      console.log(`  Point Value: $${position.pointValue}`);
      console.log(`  Margin Per Contract: $${position.initialMarginPerContract}`);
      console.log("");
    }
  } catch (error) {
    console.error("✗ Failed to get positions:", error);
  }
}

// ============================================================================
// EXAMPLE 9: Get Market Data
// ============================================================================

async function example9_GetMarketData(broker: FuturesBroker) {
  console.log("\n=== Example 9: Get Market Data ===\n");

  const symbols = ["MES", "MNQ", "GC"];

  for (const symbol of symbols) {
    try {
      const quote = await broker.getQuote(symbol);

      console.log(`${quote.symbol}:`);
      console.log(`  Last: ${quote.last}`);
      console.log(`  Bid: ${quote.bid} x ${quote.bidSize}`);
      console.log(`  Ask: ${quote.ask} x ${quote.askSize}`);
      console.log(`  Spread: ${(quote.ask - quote.bid).toFixed(2)}`);
      console.log(`  Volume: ${quote.volume.toLocaleString()}`);
      console.log(`  Open Interest: ${quote.openInterest.toLocaleString()}`);
      console.log(`  Day Range: ${quote.low} - ${quote.high}`);
      console.log("");
    } catch (error) {
      console.error(`✗ Failed to get quote for ${symbol}:`, error);
    }
  }
}

// ============================================================================
// EXAMPLE 10: Subscribe to Real-Time Quotes
// ============================================================================

async function example10_SubscribeQuotes(broker: FuturesBroker) {
  console.log("\n=== Example 10: Subscribe to Real-Time Quotes ===\n");

  const symbols = ["MES", "MNQ"];

  console.log(`Subscribing to: ${symbols.join(", ")}`);
  console.log("Quotes will stream for 30 seconds...\n");

  broker.subscribeQuotes(symbols, (quote) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${quote.symbol}: ${quote.last} (bid: ${quote.bid}, ask: ${quote.ask})`);
  });

  // Stop after 30 seconds
  setTimeout(() => {
    broker.unsubscribeQuotes(symbols);
    console.log("\n✓ Unsubscribed from quotes");
  }, 30000);
}

// ============================================================================
// EXAMPLE 11: Get Historical Bars
// ============================================================================

async function example11_GetHistoricalBars(broker: FuturesBroker) {
  console.log("\n=== Example 11: Get Historical Bars ===\n");

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

  try {
    console.log("Fetching 5-minute bars for MES...");
    const bars = await broker.getBars("MES", "5m", startDate, endDate);

    console.log(`\nReceived ${bars.length} bars\n`);

    // Show first 5 bars
    for (let i = 0; i < Math.min(5, bars.length); i++) {
      const bar = bars[i];
      console.log(`${bar.timestamp.toLocaleString()}:`);
      console.log(`  O: ${bar.open}, H: ${bar.high}, L: ${bar.low}, C: ${bar.close}`);
      console.log(`  Volume: ${bar.volume.toLocaleString()}`);
      if (bar.vwap) {
        console.log(`  VWAP: ${bar.vwap.toFixed(2)}`);
      }
      console.log("");
    }
  } catch (error) {
    console.error("✗ Failed to get historical bars:", error);
  }
}

// ============================================================================
// EXAMPLE 12: Close Position
// ============================================================================

async function example12_ClosePosition(broker: FuturesBroker) {
  console.log("\n=== Example 12: Close Position ===\n");

  try {
    // First check if we have a position
    const position = await broker.getPosition("MES");

    if (!position) {
      console.log("No open position for MES");
      return;
    }

    console.log(`Closing ${position.side} position:`);
    console.log(`  Quantity: ${position.quantity} contracts`);
    console.log(`  Entry Price: ${position.avgEntryPrice}`);
    console.log(`  Current Price: ${position.currentPrice}`);
    console.log(`  Unrealized P&L: $${position.unrealizedPnl.toFixed(2)}`);

    const order = await broker.closePosition("MES");

    console.log("\n✓ Position closed:");
    console.log(`  Close Order ID: ${order.id}`);
    console.log(`  Status: ${order.status}`);
  } catch (error) {
    console.error("✗ Failed to close position:", error);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║         Futures Trading Interface - Examples            ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  // Static examples (no broker required)
  example3_GetInstrumentConfig();
  example4_CheckTradingHours();
  example5_CalculatePositionSize();

  console.log("\n" + "=".repeat(60));
  console.log("To run broker-specific examples:");
  console.log("1. Implement a futures broker connector");
  console.log("2. Set up broker credentials in .env");
  console.log("3. Uncomment the broker examples below");
  console.log("=".repeat(60) + "\n");

  /*
  // Uncomment to run with a real broker connection:

  try {
    // Initialize broker
    const broker = createFuturesBroker("interactive_brokers", {
      host: process.env.IB_HOST || "127.0.0.1",
      port: parseInt(process.env.IB_PORT || "7497"),
      paperTrading: true
    });

    await broker.connect();
    setFuturesBroker(broker);

    // Run examples
    await example2_GetAccountInfo(broker);
    await example6_CreateMarketOrder(broker);
    await example7_CreateBracketOrder(broker);
    await example8_GetPositions(broker);
    await example9_GetMarketData(broker);
    await example11_GetHistoricalBars(broker);
    await example10_SubscribeQuotes(broker); // Keep this last as it runs for 30s
    await example12_ClosePosition(broker);

    // Cleanup
    await broker.disconnect();
  } catch (error) {
    console.error("Error running examples:", error);
  }
  */
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_InitializeBroker,
  example2_GetAccountInfo,
  example3_GetInstrumentConfig,
  example4_CheckTradingHours,
  example5_CalculatePositionSize,
  example6_CreateMarketOrder,
  example7_CreateBracketOrder,
  example8_GetPositions,
  example9_GetMarketData,
  example10_SubscribeQuotes,
  example11_GetHistoricalBars,
  example12_ClosePosition
};
