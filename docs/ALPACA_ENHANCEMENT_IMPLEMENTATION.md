# Alpaca Integration Enhancement - Implementation Summary

> **Document Date:** December 2025
> **Status:** Implemented
> **Related:** [CONNECTORS_AND_INTEGRATIONS.md](CONNECTORS_AND_INTEGRATIONS.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [ORCHESTRATOR_AND_AGENT_RUNTIME.md](ORCHESTRATOR_AND_AGENT_RUNTIME.md)

---

## Executive Summary

This document describes the comprehensive enhancements made to the AI Active Trader platform's Alpaca integration, implementing features from the Alpaca-py SDK enhancement plan while adapting them to the existing TypeScript architecture.

### Key Enhancements Delivered

| Component | Status | Description |
|-----------|--------|-------------|
| Multi-Source Stream Aggregator | Implemented | Real-time quotes, trades, bars, news via WebSocket |
| Dynamic Exposure Controller | Implemented | Confidence-based position sizing with correlation awareness |
| News-Enhanced Decision Engine | Implemented | Sentiment time-series tracking with momentum detection |
| Profit Cycling Engine | Implemented | Take-profit cycling with automatic reinvestment |
| Profit Chase Loop | Implemented | Scale-in logic for winning positions |

---

## 1. Gap Analysis: Plan vs. Existing

### Already Well-Implemented (Preserved)

| Component | Location | Features |
|-----------|----------|----------|
| Alpaca REST Connector | `server/connectors/alpaca.ts` | Full trading API, market data, account management |
| Trading Engine | `server/trading/alpaca-trading-engine.ts` | Order execution, validation, crypto, extended hours |
| Order Execution Flow | `server/trading/order-execution-flow.ts` | Retry logic, error classification, recovery strategies |
| Smart Order Router | `server/trading/smart-order-router.ts` | Auto-transforms orders, TIF selection, session detection |
| Decision Engine | `server/ai/decision-engine.ts` | 18 AI tools, function calling, multi-provider |
| Data Fusion Engine | `server/ai/data-fusion-engine.ts` | 7-source data fusion with confidence scoring |
| Multi-Factor Scoring | `server/scoring/multi-factor-scoring-engine.ts` | 6-factor composite scoring system |
| Orchestrator | `server/autonomous/orchestrator.ts` | Analysis loops, position management, heartbeat |
| Risk Management | Multiple files | Stop loss, take profit, graduated exits, trailing stops |

### Gaps Identified and Filled

| Gap | Solution Implemented | File |
|-----|---------------------|------|
| Only trade_updates streaming | Multi-source stream aggregator | `server/trading/stream-aggregator.ts` |
| Fixed position sizing | Dynamic confidence-based sizing | `server/services/dynamic-exposure-controller.ts` |
| Basic news sentiment | Sentiment time-series with momentum | `server/ai/news-enhanced-decision-engine.ts` |
| No reinvestment automation | Take-profit cycling with reinvest | `server/autonomous/profit-cycling-engine.ts` |
| No profit chasing | Scale-in logic for winners | `server/autonomous/profit-cycling-engine.ts` |

---

## 2. New Components

### 2.1 Stream Aggregator

**File:** `server/trading/stream-aggregator.ts`

**Purpose:** Combines multiple Alpaca WebSocket streams into a unified event bus.

**Streams Supported:**
- Trade Updates (order status) - `wss://paper-api.alpaca.markets/stream`
- Stock Data (trades, quotes, bars) - `wss://stream.data.alpaca.markets/v2/{iex|sip}`
- Crypto Data (trades, quotes, bars) - `wss://stream.data.alpaca.markets/v1beta3/crypto/us`
- News Headlines - `wss://stream.data.alpaca.markets/v1beta1/news`

**Event Types:**
```typescript
enum StreamType {
  STOCK_TRADE = "stock_trade",
  STOCK_QUOTE = "stock_quote",
  STOCK_BAR = "stock_bar",
  CRYPTO_TRADE = "crypto_trade",
  CRYPTO_QUOTE = "crypto_quote",
  CRYPTO_BAR = "crypto_bar",
  NEWS = "news",
  TRADE_UPDATE = "trade_update",
}
```

**Key Features:**
- Prioritized callback subscriptions
- Automatic reconnection with exponential backoff
- Price and quote caching
- Event metrics tracking
- Dynamic symbol subscription updates

**Usage:**
```typescript
import { streamAggregator, StreamType } from "./trading/stream-aggregator";

// Subscribe to events
streamAggregator.subscribe({
  symbols: ["AAPL", "MSFT", "NVDA"],
  streamTypes: [StreamType.STOCK_QUOTE, StreamType.NEWS],
  callback: (event) => console.log(event),
  priority: 10, // Higher = processed first
});

// Start streaming
await streamAggregator.start(
  ["SPY", "QQQ", "AAPL"],  // Stock symbols
  ["BTC/USD", "ETH/USD"],  // Crypto symbols
  ["AAPL", "MSFT", "BTC"]  // News symbols
);

// Get cached data
const price = streamAggregator.getLatestPrice("AAPL");
const quote = streamAggregator.getLatestQuote("AAPL");
```

---

### 2.2 Dynamic Exposure Controller

**File:** `server/services/dynamic-exposure-controller.ts`

**Purpose:** Adaptive portfolio exposure management with confidence-based position sizing.

**Key Features:**

1. **Dynamic Max Exposure Calculation:**
   - Scales from `baseMaxExposurePct` (80%) to `absoluteMaxExposurePct` (100%)
   - Adjusts based on: volatility regime, signal confidence, recent performance

2. **Dynamic Position Sizing:**
   - Base position size: 10% of portfolio
   - Can scale up to 25% for high-conviction trades
   - Factors: confidence, volatility, sector correlation

3. **Take Profit Management:**
   - Configurable scale-out thresholds: [2%, 4%, 6%]
   - Graduated partial exits
   - Automatic reinvestment queue

4. **Portfolio Heat Assessment:**
   - Total exposure tracking
   - Sector concentration limits
   - Correlation risk scoring
   - Heat levels: low/moderate/high/critical

**Configuration:**
```typescript
interface ExposureConfig {
  baseMaxExposurePct: number;       // 80% default
  absoluteMaxExposurePct: number;   // 100% max
  baseMaxPositionPct: number;       // 10% default
  absoluteMaxPositionPct: number;   // 25% max
  volatilityScaling: boolean;
  confidenceScaling: boolean;
  correlationScaling: boolean;
  takeProfitThresholdPct: number;   // 2%
  scaleOutThresholds: number[];     // [2, 4, 6]
  enableAutoReinvest: boolean;
  reinvestCooldownMs: number;       // 5 minutes
}
```

**Usage:**
```typescript
import { dynamicExposureController } from "./services/dynamic-exposure-controller";

// Get account status
const status = await dynamicExposureController.getAccountStatus();

// Calculate position size
const sizeRec = dynamicExposureController.calculateDynamicPositionSize(
  "AAPL",
  currentPrice,
  0.85, // confidence
  status.portfolioValue,
  status.currentExposure,
  "enter"
);

console.log(sizeRec.recommendedQty, sizeRec.constraintsApplied);

// Check take profit conditions
const candidates = dynamicExposureController.checkTakeProfitConditions();

// Execute take profit
const result = await dynamicExposureController.executeTakeProfitCycle(
  "AAPL",
  50, // qty to sell
  true // reinvest
);
```

---

### 2.3 News-Enhanced Decision Engine

**File:** `server/ai/news-enhanced-decision-engine.ts`

**Purpose:** Enhanced AI decision-making with comprehensive news/sentiment integration.

**Key Features:**

1. **Sentiment Analysis:**
   - Rule-based keyword sentiment scoring
   - Positive/negative keyword detection
   - Confidence based on keyword count
   - Ready for FinBERT integration

2. **Sentiment Time-Series:**
   - Historical sentiment tracking per symbol
   - Time-decayed weighted averaging
   - Configurable decay period (4 hours default)
   - Maximum age pruning (24 hours)

3. **Sentiment Momentum:**
   - Rate of change detection
   - Momentum window (10 scores)
   - Volatility calculation

4. **Technical Signal Integration:**
   - Signal strength enum (STRONG_BUY to STRONG_SELL)
   - Time-decayed technical signals
   - 15-minute half-life

5. **Combined Decision Making:**
   - Weighted combination (30% news, 70% technical)
   - Signal alignment detection (aligned/divergent/neutral)
   - Confidence adjustment based on alignment
   - Price target calculation

**Decision Types:**
```typescript
enum DecisionType {
  ENTER_LONG = "enter_long",
  ENTER_SHORT = "enter_short",
  EXIT_LONG = "exit_long",
  EXIT_SHORT = "exit_short",
  SCALE_IN = "scale_in",
  SCALE_OUT = "scale_out",
  TAKE_PROFIT = "take_profit",
  STOP_LOSS = "stop_loss",
  HOLD = "hold",
}
```

**Usage:**
```typescript
import { newsEnhancedDecisionEngine, DecisionType } from "./ai/news-enhanced-decision-engine";

// Fetch and process news
await newsEnhancedDecisionEngine.fetchAndProcessNews("AAPL", false);

// Get aggregate sentiment
const sentiment = newsEnhancedDecisionEngine.getAggregateSentiment("AAPL");
console.log(sentiment.score, sentiment.momentum);

// Make enhanced decision
const { enhanced, legacy, composite } = await newsEnhancedDecisionEngine.makeEnhancedDecision(
  "AAPL",
  currentPrice,
  { marketContext: "bullish" },
  { qty: 100, avgEntryPrice: 180 }
);

console.log(enhanced.decisionType, enhanced.confidence, enhanced.isActionable);
```

---

### 2.4 Profit Cycling Engine

**File:** `server/autonomous/profit-cycling-engine.ts`

**Purpose:** Automated profit-taking, reinvestment, and profit chasing.

**Key Features:**

1. **Take Profit Cycling:**
   - Monitors positions for profit thresholds
   - Executes graduated take-profits
   - Queues proceeds for reinvestment
   - Tracks take-profit history

2. **Reinvestment Queue:**
   - Cooldown period before reinvesting (5 minutes)
   - Best target selection using news-enhanced engine
   - Concurrent limit (3 active reinvestments)
   - Minimum amount threshold ($100)

3. **Profit Chase Loop:**
   - Monitors winning positions (>3% unrealized gain)
   - Scales in when signal remains strong
   - Limits scale-in count per position (2 max)
   - Tracks high water marks

**Configuration:**
```typescript
interface ProfitCyclingConfig {
  enableTakeProfitCycling: boolean;
  autoReinvest: boolean;
  enableProfitChasing: boolean;
  profitChaseThresholdPct: number;   // 3%
  profitChaseMinConfidence: number;  // 0.7
  profitChaseMaxScaleIn: number;     // 2
  cycleIntervalMs: number;           // 30s
  reinvestCooldownMs: number;        // 5 min
  maxActiveReinvests: number;        // 3
  minReinvestAmount: number;         // $100
}
```

**Usage:**
```typescript
import { profitCyclingEngine } from "./autonomous/profit-cycling-engine";

// Start the engine
profitCyclingEngine.start();

// Get metrics
const metrics = profitCyclingEngine.getMetrics();
console.log(metrics.state.takeProfitsExecuted);
console.log(metrics.state.profitChasesExecuted);

// Manual operations
await profitCyclingEngine.manualTakeProfit("AAPL", 50);
await profitCyclingEngine.manualReinvest(5000, "MSFT");

// Stop
profitCyclingEngine.stop();
```

---

## 3. Integration Points

### How Components Connect

```
                    +------------------+
                    |   Orchestrator   |
                    +--------+---------+
                             |
         +-------------------+-------------------+
         |                   |                   |
         v                   v                   v
+----------------+  +------------------+  +------------------+
| ProfitCycling  |  | DynamicExposure  |  | NewsEnhanced     |
| Engine         |  | Controller       |  | DecisionEngine   |
+--------+-------+  +--------+---------+  +--------+---------+
         |                   |                    |
         +-------------------+--------------------+
                             |
                             v
                    +------------------+
                    | StreamAggregator |
                    +--------+---------+
                             |
      +----------------------+----------------------+
      |              |              |               |
      v              v              v               v
+----------+  +----------+  +----------+  +----------+
| Trade    |  | Stock    |  | Crypto   |  | News     |
| Updates  |  | Data     |  | Data     |  | Stream   |
+----------+  +----------+  +----------+  +----------+
```

### Data Flow

1. **Real-Time Data:**
   - StreamAggregator receives WebSocket messages
   - Dispatches typed events to subscribers
   - Updates price/quote caches

2. **Decision Making:**
   - NewsEnhancedDecisionEngine fetches news
   - Analyzes sentiment with time-series
   - Combines with technical signals
   - Outputs actionable decisions

3. **Position Management:**
   - DynamicExposureController monitors positions
   - Calculates dynamic sizing
   - Tracks sector correlation
   - Manages take-profit conditions

4. **Execution:**
   - ProfitCyclingEngine runs cycles
   - Executes take-profits
   - Manages reinvestment queue
   - Implements profit chasing

---

## 4. Alpaca API Capabilities Used

### Trading API
| Feature | Status | Location |
|---------|--------|----------|
| TradingClient equivalent | Implemented | `alpaca.ts` |
| Market Orders | Implemented | `alpaca.ts` |
| Limit Orders | Implemented | `alpaca.ts` |
| Stop Orders | Implemented | `alpaca.ts` |
| Bracket Orders | Implemented | `alpaca.ts` |
| Trailing Stop | Implemented | `alpaca.ts` |
| OCO Orders | Implemented | `alpaca.ts` |
| Get Account | Implemented | `alpaca.ts` |
| Get Positions | Implemented | `alpaca.ts` |
| Get Orders | Implemented | `alpaca.ts` |
| Close Positions | Implemented | `alpaca.ts` |

### Market Data (REST)
| Feature | Status | Location |
|---------|--------|----------|
| Stock Bars | Implemented | `alpaca.ts` |
| Stock Snapshots | Implemented | `alpaca.ts` |
| Crypto Snapshots | Implemented | `alpaca.ts` |
| Market Clock | Implemented | `alpaca.ts` |

### Market Data (Streaming)
| Feature | Status | Location |
|---------|--------|----------|
| Trade Updates | Implemented | `stream-aggregator.ts` |
| Stock Trades | Implemented | `stream-aggregator.ts` |
| Stock Quotes | Implemented | `stream-aggregator.ts` |
| Stock Bars | Implemented | `stream-aggregator.ts` |
| Crypto Trades | Implemented | `stream-aggregator.ts` |
| Crypto Quotes | Implemented | `stream-aggregator.ts` |
| Crypto Bars | Implemented | `stream-aggregator.ts` |
| News Stream | Implemented | `stream-aggregator.ts` |

---

## 5. Files Changed/Created

### New Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `server/trading/stream-aggregator.ts` | Multi-source WebSocket streaming | ~850 |
| `server/services/dynamic-exposure-controller.ts` | Confidence-based position sizing | ~550 |
| `server/ai/news-enhanced-decision-engine.ts` | Sentiment time-series analysis | ~620 |
| `server/autonomous/profit-cycling-engine.ts` | Take-profit and reinvestment | ~550 |
| `docs/ALPACA_ENHANCEMENT_IMPLEMENTATION.md` | This documentation | ~650 |

### Existing Files Enhanced (Not Modified)

The implementation was designed as **additive** - all new components are separate modules that integrate with but do not modify the existing codebase. This ensures:

- Zero risk of breaking existing functionality
- Easy rollback if needed
- Clean separation of concerns
- Independent testing capability

---

## 6. Usage Example: Full Integration

```typescript
import { streamAggregator, StreamType } from "./trading/stream-aggregator";
import { dynamicExposureController } from "./services/dynamic-exposure-controller";
import { newsEnhancedDecisionEngine } from "./ai/news-enhanced-decision-engine";
import { profitCyclingEngine } from "./autonomous/profit-cycling-engine";

async function initializeEnhancedTrading() {
  // 1. Start stream aggregator
  await streamAggregator.start(
    ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
    ["BTC/USD", "ETH/USD"],
    ["SPY", "AAPL", "BTC"]
  );

  // 2. Subscribe to price updates for decision engine
  streamAggregator.subscribe({
    symbols: ["*"],
    streamTypes: [StreamType.STOCK_QUOTE, StreamType.CRYPTO_QUOTE],
    callback: async (event) => {
      // Update technical signals based on price movement
      // ...
    },
    priority: 5,
  });

  // 3. Subscribe to news for sentiment updates
  streamAggregator.subscribe({
    symbols: ["*"],
    streamTypes: [StreamType.NEWS],
    callback: async (event) => {
      if (event.streamType === StreamType.NEWS) {
        const newsData = event.data as NewsData;
        for (const symbol of newsData.symbols) {
          const sentiment = newsEnhancedDecisionEngine.analyzeSentiment(
            newsData.headline,
            newsData.summary,
            newsData.id,
            newsData.source || "alpaca",
            newsData.symbols
          );
          newsEnhancedDecisionEngine.updateSentiment(symbol, sentiment);
        }
      }
    },
    priority: 9,
  });

  // 4. Start profit cycling engine
  profitCyclingEngine.start();

  console.log("Enhanced trading system initialized");
}

async function runTradingCycle(symbol: string) {
  // Get account status
  const accountStatus = await dynamicExposureController.getAccountStatus();

  // Get current price
  const price = streamAggregator.getLatestPrice(symbol) || 0;

  // Make enhanced decision
  const { enhanced } = await newsEnhancedDecisionEngine.makeEnhancedDecision(
    symbol,
    price,
    {},
    accountStatus.positions.get(symbol) ? {
      qty: parseInt(accountStatus.positions.get(symbol)!.qty),
      avgEntryPrice: parseFloat(accountStatus.positions.get(symbol)!.avg_entry_price),
    } : undefined
  );

  // If actionable, calculate position size
  if (enhanced.isActionable) {
    const sizeRec = dynamicExposureController.calculateDynamicPositionSize(
      symbol,
      price,
      enhanced.confidence,
      accountStatus.portfolioValue,
      accountStatus.currentExposure,
      enhanced.decisionType.includes("scale") ? "scale_in" : "enter"
    );

    console.log(`Decision for ${symbol}: ${enhanced.decisionType}`);
    console.log(`Confidence: ${(enhanced.confidence * 100).toFixed(1)}%`);
    console.log(`Recommended qty: ${sizeRec.recommendedQty}`);
    console.log(`Constraints: ${sizeRec.constraintsApplied.join(", ")}`);
  }
}

// Run
initializeEnhancedTrading().catch(console.error);
```

---

## 7. Testing Recommendations

### Unit Tests

1. **StreamAggregator:**
   - WebSocket connection handling
   - Message parsing for each stream type
   - Subscription management
   - Reconnection logic

2. **DynamicExposureController:**
   - Position sizing calculations
   - Correlation penalty calculation
   - Take profit threshold detection
   - Volatility regime adjustments

3. **NewsEnhancedDecisionEngine:**
   - Sentiment scoring accuracy
   - Time-decay calculations
   - Momentum detection
   - Decision type determination

4. **ProfitCyclingEngine:**
   - Reinvestment queue management
   - Best target selection
   - Profit chase logic
   - Scale-in limits

### Integration Tests

1. Full cycle: Stream event -> Decision -> Position sizing -> Execution
2. Take profit -> Reinvest -> New position
3. Profit chase scenario with multiple scale-ins
4. Error handling and recovery

---

## 8. Future Enhancements

### Not Yet Implemented (From Plan)

| Feature | Priority | Complexity |
|---------|----------|------------|
| FinBERT integration for sentiment | High | Medium |
| Options trading support | Medium | High |
| Portfolio margin calculations | Low | High |
| Tax lot accounting | Low | Medium |
| Multi-account support | Low | High |

### Recommended Next Steps

1. **FinBERT Integration:** Replace rule-based sentiment with transformer model
2. **Backtesting Framework:** Test strategies on historical data
3. **Dashboard Enhancements:** Visualize streaming data and decisions
4. **Alert System:** Real-time notifications for significant events

---

## 9. Conclusion

This implementation successfully bridges the gap between the Python alpaca-py SDK plan and the existing TypeScript codebase. All major features have been implemented:

- Real-time multi-source streaming
- Dynamic confidence-based position sizing
- News-enhanced decision making with sentiment tracking
- Automated profit cycling with reinvestment
- Profit chasing for winning positions

The implementation is **additive and non-breaking**, integrating cleanly with the existing architecture while providing significant new capabilities for profit maximization.
