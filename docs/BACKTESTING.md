# Backtesting Subsystem

## Overview

The backtesting subsystem enables historical simulation of trading strategies against market data. It provides a realistic execution model with configurable fees, slippage, and execution timing to help evaluate strategy performance before live deployment.

## IMPORTANT: Bias Disclaimers

### Survivorship Bias Warning

**The historical data used in this backtesting system may be subject to survivorship bias.**

Survivorship bias occurs when only securities that have "survived" (remained listed, not gone bankrupt, not been delisted) are included in historical datasets. This can lead to overly optimistic backtest results because:

- Failed companies that went to zero are excluded from the data
- Delisted securities are often missing from historical feeds
- Merger/acquisition targets may have incomplete price histories
- The universe of tradable symbols today does not represent the universe available historically

**Mitigation strategies:**
- Use point-in-time constituent data when available
- Include delisted securities in analysis where possible
- Apply a haircut to reported returns to account for bias
- Compare results against published index returns that account for survivorship

### Look-Ahead Bias Prevention

This backtesting engine is designed to prevent look-ahead bias through strict temporal isolation:

**How look-ahead bias is prevented:**

1. **Chronological Bar Processing**: Bars are processed in strict chronological order. The strategy's `onBar()` callback only receives:
   - The current bar being processed
   - The index of the current bar
   - All bars from index 0 to the current index (historical data only)

2. **T+1 Execution Model**: Signals generated on bar `t` are executed at the price of bar `t+1`. The strategy cannot "see" the next bar's price when making decisions.

3. **Execution Price Rules**:
   - `NEXT_OPEN`: Orders fill at the opening price of the next bar
   - `NEXT_CLOSE`: Orders fill at the closing price of the next bar

4. **No Future Data Access**: The `allBarsUpToNow` parameter passed to signal generators explicitly excludes future bars.

**Code enforcement** (from execution-engine.ts):
```typescript
// Strategy only sees bars[0..i], never bars[i+1..n]
const allBarsUpToNow = bars.slice(0, i + 1);
const signals = signalGenerator.onBar(bar, i, allBarsUpToNow);
```

## Data Provenance Tracking

Every backtest run records complete data provenance:

```typescript
interface DataProvenance {
  source: string;           // e.g., "alpaca"
  fetchedAt: string;        // ISO timestamp
  symbolCount: number;      // Number of symbols fetched
  totalBars: number;        // Total bars across all symbols
  timeframe: string;        // e.g., "1Day"
  dateRange: {
    start: string;
    end: string;
  };
  warnings: string[];       // Any data quality warnings
}
```

This ensures reproducibility and audit trails for all backtest results.

## Execution Model

### Order Flow

1. Strategy generates signal on bar `t` (e.g., "BUY AAPL")
2. Signal is queued for execution
3. On bar `t+1`, order executes at configured price (NEXT_OPEN or NEXT_CLOSE)
4. Slippage is applied to execution price
5. Fees are deducted from cash balance
6. Position and cash are updated
7. Trade event is recorded

### Fee Models

| Model | Description | Example |
|-------|-------------|---------|
| `fixed` | Flat fee per trade | $1.00 per trade |
| `percentage` | Fee as percentage of trade value | 0.1% of notional |

### Slippage Models

| Model | Description | Example |
|-------|-------------|---------|
| `bps` | Basis points added to buy price / subtracted from sell price | 5 bps = 0.05% |
| `spread_proxy` | Estimates slippage based on bid-ask spread | Configurable value |

**Slippage calculation:**
```typescript
// For buys: price increases (worse fill)
// For sells: price decreases (worse fill)
const slippageMultiplier = side === "buy" ? 1 : -1;
const slippageAmount = price * (bps / 10000) * slippageMultiplier;
const executedPrice = price + slippageAmount;
```

## Metrics Calculated

### Performance Metrics

| Metric | Description |
|--------|-------------|
| `totalReturn` | Final equity / Initial cash - 1 |
| `maxDrawdown` | Largest peak-to-trough decline |
| `sharpeRatio` | Risk-adjusted return (annualized) |
| `winRate` | Percentage of profitable trades |
| `profitFactor` | Gross profit / Gross loss |
| `totalTrades` | Number of completed trades |
| `avgWin` | Average profit on winning trades |
| `avgLoss` | Average loss on losing trades |

### Equity Curve

The equity curve is sampled and stored for visualization:
- Daily equity values
- Cash balance over time
- Exposure percentage (invested / total equity)

## API Endpoints

### Run a Backtest

```
POST /api/backtests/run
```

**Request Body:**
```json
{
  "strategyId": "optional-strategy-id",
  "strategyConfig": {
    "strategyType": "moving-average",
    "fastPeriod": 7,
    "slowPeriod": 20,
    "allocationPct": 0.1,
    "symbol": "AAPL"
  },
  "universe": ["AAPL", "MSFT", "GOOGL"],
  "timeframe": "1Day",
  "startDate": "2024-01-01",
  "endDate": "2024-12-01",
  "initialCash": 100000,
  "feesModel": { "type": "fixed", "value": 1 },
  "slippageModel": { "type": "bps", "value": 5 },
  "executionPriceRule": "NEXT_OPEN"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "DONE",
  "resultsSummary": {
    "totalReturn": 0.15,
    "maxDrawdown": -0.08,
    "sharpeRatio": 1.2,
    "totalTrades": 42,
    "winRate": 0.55
  },
  "runtimeMs": 1234
}
```

### List Backtests

```
GET /api/backtests?limit=50&offset=0
```

**Response:**
```json
{
  "runs": [...],
  "limit": 50,
  "offset": 0
}
```

### Get Backtest Details

```
GET /api/backtests/:id
```

Returns the full backtest run record including configuration, provenance, and results.

### Get Equity Curve

```
GET /api/backtests/:id/equity-curve
```

**Response:**
```json
{
  "points": [
    { "ts": "2024-01-02T00:00:00Z", "equity": 100000, "cash": 90000, "exposure": 0.1 },
    { "ts": "2024-01-03T00:00:00Z", "equity": 100500, "cash": 90500, "exposure": 0.1 }
  ]
}
```

### Get Trade Events

```
GET /api/backtests/:id/trades
```

**Response:**
```json
{
  "trades": [
    {
      "id": "uuid",
      "runId": "backtest-uuid",
      "ts": "2024-01-15T14:30:00Z",
      "symbol": "AAPL",
      "side": "buy",
      "qty": 10,
      "price": 185.50,
      "reason": "MA_CROSSOVER_UP",
      "orderType": "market",
      "fees": 1.00,
      "slippage": 0.09,
      "positionAfter": 10,
      "cashAfter": 98145.00
    }
  ]
}
```

## Database Schema

### backtest_runs

Stores metadata and results for each backtest execution.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| status | ENUM | QUEUED, RUNNING, DONE, FAILED |
| strategy_id | UUID | Optional link to strategy |
| strategy_config | JSONB | Strategy parameters |
| universe | TEXT[] | Symbols included |
| timeframe | TEXT | Bar timeframe |
| start_date | TEXT | Backtest start |
| end_date | TEXT | Backtest end |
| initial_cash | NUMERIC | Starting capital |
| fees_model | JSONB | Fee configuration |
| slippage_model | JSONB | Slippage configuration |
| execution_price_rule | TEXT | NEXT_OPEN or NEXT_CLOSE |
| provenance | JSONB | Data source metadata |
| results_summary | JSONB | Calculated metrics |
| runtime_ms | INTEGER | Execution time |

### backtest_trade_events

Individual trade records from the simulation.

### backtest_equity_curve

Time series of portfolio equity values.

## Best Practices

1. **Use realistic parameters**: Default slippage of 5 bps may be optimistic for illiquid securities
2. **Test across market regimes**: Include both bull and bear market periods
3. **Apply appropriate position sizing**: Backtest with realistic capital constraints
4. **Validate against known benchmarks**: Compare strategy returns to buy-and-hold
5. **Account for data limitations**: Remember survivorship bias in reported results
