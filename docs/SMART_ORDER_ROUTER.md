# Smart Order Router

## Overview

The Smart Order Router is an intelligent order transformation system that **ensures orders are NEVER rejected** due to incorrect order type, time-in-force, or configuration. It automatically adapts order parameters based on:

- Current market session (pre-market, regular, after-hours, closed)
- Symbol type (equity vs crypto)
- Order side (buy vs sell)
- Extended hours trading requirements
- Broker-specific restrictions (Alpaca API)

## Key Features

### 1. Auto-Select Correct Order Type

The router automatically transforms order types based on market session:

| Session | Input Type | Output Type | Reason |
|---------|-----------|-------------|---------|
| Pre-market | `market` | `limit` | Market orders not allowed |
| After-hours | `market` | `limit` | Market orders not allowed |
| Extended hours | `stop` | `stop_limit` | Stop orders not allowed |
| Extended hours | `trailing_stop` | `limit` | Trailing stops not allowed |
| Market closed | `market` | `limit` | Queue for next open |

### 2. Auto-Calculate Limit Prices

For orders that need limit prices (especially in extended hours), the router automatically calculates intelligent limit prices:

**Buy Orders:**
```
Limit Price = Ask Price + Buffer (0.5% default in extended hours)
```

**Sell Orders:**
```
Limit Price = Bid Price - Buffer (0.5% default in extended hours)
```

**Configurable buffers:**
- `buyBufferPercent`: Regular hours buy buffer (default: 0.3%)
- `sellBufferPercent`: Regular hours sell buffer (default: 0.3%)
- `aggressiveLimitBufferPercent`: Extended hours buffer (default: 0.5%)

### 3. Auto-Select Correct Time-In-Force (TIF)

The router enforces TIF rules to prevent rejections:

| Order Type | Session | Requested TIF | Corrected TIF | Reason |
|-----------|---------|---------------|---------------|---------|
| `market` | Any | `gtc` | `day` | Market orders cannot use GTC |
| Any | Extended hours | `gtc` | `day` | Extended hours requires day |
| Bracket | Any | `gtc` | `day` | Alpaca requires day for brackets |
| Crypto market | Any | `gtc` | `ioc` | Crypto market orders use IOC |
| Any | Closed | `ioc`/`fok` | `day` | Queue for next open |

### 4. Crypto 24/7 Support

The router automatically detects crypto symbols and applies different rules:

- Crypto symbols: `BTC/USD`, `ETH/USD`, `DOGE`, `SOL`, etc.
- Crypto markets are open 24/7
- No extended hours flag needed
- Market orders allowed anytime
- Different volatility considerations

## Usage

### Basic Usage

```typescript
import { transformOrderForExecution, createPriceData } from "@/server/trading/smart-order-router";

// Get current price data
const quote = await alpaca.getLatestQuote("AAPL");
const priceData = createPriceData({
  bid: quote.bp,
  ask: quote.ap,
  last: quote.ap, // or from latest trade
});

// Transform order
const order = {
  symbol: "AAPL",
  side: "buy",
  qty: "10",
  type: "market",
};

const transformed = transformOrderForExecution(order, priceData);

// Submit transformed order
await unifiedOrderExecutor.submitOrder(transformed);

// Check transformations
console.log(transformed.transformations);
// ["Upgraded market to limit order (pre_market)", "Auto-calculated buy limit: $150.75 (ask + 0.5% buffer)"]

console.log(transformed.warnings);
// ["Wide spread detected (2.5%) - limit price may result in poor fill"]
```

### Advanced Configuration

```typescript
import { SmartOrderRouter } from "@/server/trading/smart-order-router";

const router = new SmartOrderRouter({
  buyBufferPercent: 0.5,              // 0.5% buffer for regular hours buys
  sellBufferPercent: 0.5,             // 0.5% buffer for regular hours sells
  aggressiveLimitBufferPercent: 1.0,  // 1% buffer for extended hours
  autoUpgradeMarketToLimit: true,     // Auto-upgrade market to limit in extended hours
  forceExtendedHoursDayTIF: true,     // Force 'day' TIF in extended hours
  enablePriceValidation: true,        // Warn on potentially bad prices
});

const transformed = router.transformOrderForExecution(order, priceData);
```

### Session Override

```typescript
// Force a specific session (useful for testing)
const transformed = transformOrderForExecution(
  order,
  priceData,
  "pre_market" // Override session detection
);
```

## Real-World Examples

### Example 1: Pre-Market Market Order

**Input:**
```typescript
{
  symbol: "AAPL",
  side: "buy",
  qty: "100",
  type: "market",
  timeInForce: "gtc"
}
```

**Output:**
```typescript
{
  symbol: "AAPL",
  side: "buy",
  qty: "100",
  type: "limit",              // Upgraded from market
  limitPrice: "150.75",       // Auto-calculated
  timeInForce: "day",         // Changed from gtc
  extendedHours: true,        // Set automatically
  transformations: [
    "Upgraded market to limit order (pre_market)",
    "Auto-calculated buy limit: $150.75 (ask + 0.5% buffer)",
    "Changed market order TIF from 'gtc' to 'day' (not allowed)",
    "Forced TIF to 'day' for extended hours (pre_market)",
    "Set extended_hours=true for pre_market session"
  ]
}
```

**Result:** Order executes successfully instead of being rejected!

### Example 2: After-Hours Sell Order

**Input:**
```typescript
{
  symbol: "TSLA",
  side: "sell",
  qty: "50",
  type: "market"
}
```

**Output:**
```typescript
{
  symbol: "TSLA",
  side: "sell",
  qty: "50",
  type: "limit",
  limitPrice: "249.50",       // bid - 0.5% buffer
  timeInForce: "day",
  extendedHours: true,
  transformations: [
    "Upgraded market to limit order (after_hours)",
    "Auto-calculated sell limit: $249.50 (bid - 0.5% buffer)",
    "Set extended_hours=true for after_hours session"
  ]
}
```

### Example 3: Bracket Order Fix

**Input:**
```typescript
{
  symbol: "NVDA",
  side: "buy",
  qty: "25",
  type: "limit",
  limitPrice: "500.00",
  timeInForce: "gtc",          // INVALID for bracket orders
  orderClass: "bracket",
  takeProfitLimitPrice: "550.00",
  stopLossStopPrice: "475.00"
}
```

**Output:**
```typescript
{
  symbol: "NVDA",
  side: "buy",
  qty: "25",
  type: "limit",
  limitPrice: "500.00",
  timeInForce: "day",          // Fixed to 'day'
  orderClass: "bracket",
  takeProfitLimitPrice: "550.00",
  stopLossStopPrice: "475.00",
  extendedHours: false,
  transformations: [
    "Forced TIF to 'day' for bracket order (Alpaca requirement)"
  ]
}
```

**Result:** Bracket order executes instead of HTTP 422 rejection!

### Example 4: Crypto 24/7 Trading

**Input:**
```typescript
{
  symbol: "BTC/USD",
  side: "buy",
  qty: "0.1",
  type: "market",
  timeInForce: "gtc"           // INVALID for market orders
}
```

**Output:**
```typescript
{
  symbol: "BTC/USD",
  side: "buy",
  qty: "0.1",
  type: "market",
  timeInForce: "ioc",          // Fixed to 'ioc'
  extendedHours: false,        // No extended hours for crypto
  isCrypto: true,
  transformations: [
    "Changed crypto market order TIF from 'gtc' to 'ioc'"
  ]
}
```

### Example 5: Market Closed

**Input:**
```typescript
{
  symbol: "AAPL",
  side: "buy",
  qty: "100",
  type: "market",
  timeInForce: "ioc"
}
```

**Output:**
```typescript
{
  symbol: "AAPL",
  side: "buy",
  qty: "100",
  type: "limit",               // Upgraded to limit
  limitPrice: "150.30",        // Auto-calculated
  timeInForce: "day",          // Changed to queue for open
  extendedHours: false,
  transformations: [
    "Upgraded market order to limit (market closed)",
    "Auto-calculated buy limit: $150.30 (ask + 0.3% buffer)",
    "Changed TIF from 'ioc'/'fok' to 'day' (market closed)"
  ]
}
```

## Warnings

The router provides helpful warnings for potential issues:

### Price Warnings

```typescript
warnings: [
  "Buy limit $160.00 is 6.2% above market $150.50 - may fill at worse price",
  "Sell limit $140.00 is 7.0% below market $150.50 - may fill at worse price",
  "Wide spread detected (2.5%) - limit price may result in poor fill"
]
```

### Session Warnings

```typescript
warnings: [
  "Fractional shares not allowed in extended hours - order may be rejected",
  "Notional orders may not work in extended hours - consider using qty instead",
  "Bracket orders only recommended during regular hours",
  "stop orders may not trigger in extended hours"
]
```

## Integration with Unified Order Executor

```typescript
import { unifiedOrderExecutor } from "@/server/trading/unified-order-executor";
import { transformOrderForExecution, createPriceData } from "@/server/trading/smart-order-router";
import { alpaca } from "@/connectors/alpaca";

async function placeSmartOrder(order: OrderInput) {
  // 1. Get current price
  const quote = await alpaca.getLatestQuote(order.symbol);
  const priceData = createPriceData({
    bid: quote.bp,
    ask: quote.ap,
    last: quote.ap,
  });

  // 2. Transform order
  const transformed = transformOrderForExecution(order, priceData);

  // 3. Log transformations
  if (transformed.transformations.length > 0) {
    log.info("SmartOrder", "Order transformed", {
      symbol: order.symbol,
      transformations: transformed.transformations,
      warnings: transformed.warnings,
    });
  }

  // 4. Submit transformed order
  const result = await unifiedOrderExecutor.submitOrder({
    ...transformed,
    traceId: order.traceId,
    decisionId: order.decisionId,
  });

  return result;
}
```

## Testing

Run the comprehensive test suite:

```bash
bun test server/trading/smart-order-router.test.ts
```

Tests cover:
- Regular hours trading (all order types)
- Pre-market transformations
- After-hours transformations
- Market closed scenarios
- Crypto 24/7 trading
- Price validation
- Configuration options
- Complex scenarios

## API Reference

### `transformOrderForExecution()`

```typescript
function transformOrderForExecution(
  order: OrderInput,
  currentPrice: CurrentPriceData,
  sessionOverride?: SessionType
): TransformedOrder
```

**Parameters:**
- `order`: Input order parameters
- `currentPrice`: Current bid/ask/last prices
- `sessionOverride`: Optional session override for testing

**Returns:**
- `TransformedOrder`: Transformed order with correct parameters

### `createPriceData()`

```typescript
function createPriceData(quote: {
  bid?: number;
  ask?: number;
  last?: number;
}): CurrentPriceData
```

**Parameters:**
- `quote`: Quote data from broker

**Returns:**
- `CurrentPriceData`: Normalized price data with spread calculation

### `SmartOrderRouter`

```typescript
class SmartOrderRouter {
  constructor(config?: SmartOrderConfig);

  transformOrderForExecution(
    order: OrderInput,
    currentPrice: CurrentPriceData,
    sessionOverride?: SessionType
  ): TransformedOrder;

  updateConfig(config: Partial<SmartOrderConfig>): void;
  getConfig(): Required<SmartOrderConfig>;
}
```

## Best Practices

1. **Always use current prices**: Get fresh quotes before transforming orders
2. **Review transformations**: Log and review what was changed
3. **Monitor warnings**: Warnings indicate potential issues
4. **Test thoroughly**: Use session overrides to test all scenarios
5. **Configure buffers**: Adjust buffers based on symbol volatility
6. **Handle crypto separately**: Crypto has different rules than equities

## Common Rejection Scenarios Prevented

| Scenario | Error Prevented | Solution |
|----------|----------------|----------|
| Market order in pre-market | `market orders not allowed` | Upgrade to limit with calculated price |
| Market order with GTC TIF | `invalid time_in_force` | Change to 'day' |
| Bracket order with GTC | `HTTP 422 rejection` | Force to 'day' TIF |
| Stop order in extended hours | `order type not supported` | Upgrade to stop_limit |
| Extended hours without flag | Order queues incorrectly | Set extended_hours=true |
| Fractional shares extended | `fractional not allowed` | Warn user |
| IOC when market closed | Order rejected immediately | Change to 'day' to queue |

## Future Enhancements

- [ ] Support for more exchanges (NASDAQ, NYSE specific rules)
- [ ] Dynamic buffer calculation based on volatility
- [ ] Integration with order flow analysis
- [ ] Machine learning price prediction for limit prices
- [ ] Smart trailing stop conversion strategies
- [ ] Position-aware order sizing
- [ ] Multi-leg order optimization

## See Also

- [Order Types Matrix](./order-types-matrix.ts) - Complete order type rules
- [Trading Session Manager](../services/trading-session-manager.ts) - Market hours detection
- [Unified Order Executor](./unified-order-executor.ts) - Order submission
