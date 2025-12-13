# Analytics Service Specification

> **Domain:** Reporting & Performance Metrics  
> **Owner:** Analytics Team  
> **Status:** Design
>
> [INDEX.md](../INDEX.md) | Canonical: [FINANCIAL_METRICS.md](../FINANCIAL_METRICS.md), [API_REFERENCE.md](../API_REFERENCE.md), [OBSERVABILITY.md](../OBSERVABILITY.md)

---

## Service Overview

The Analytics Service materializes trading performance data, calculates P&L metrics, and provides historical analysis capabilities.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ANALYTICS SERVICE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │  P&L Engine     │  │  Metrics Store  │  │  Report Gen     │            │
│  │                 │  │                 │  │                 │            │
│  │ • Realized      │  │ • Time-series   │  │ • Daily summary │            │
│  │ • Unrealized    │  │ • Aggregations  │  │ • Performance   │            │
│  │ • Attribution   │  │ • Snapshots     │  │ • Risk reports  │            │
│  │ • Fees          │  │ • Retention     │  │ • Export        │            │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘            │
│           │                    │                    │                      │
│           └────────────────────┴────────────────────┘                      │
│                                │                                            │
│                    ┌───────────▼───────────┐                               │
│                    │   Query Engine        │                               │
│                    │   (DuckDB/ClickHouse) │                               │
│                    └───────────────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Specification

### REST Endpoints

#### Portfolio Summary

```yaml
# Get Portfolio Summary
GET /api/v1/analytics/summary
Response:
  equity: number
  cash: number
  buyingPower: number
  positionCount: number
  dayPnl: number
  dayPnlPercent: number
  weekPnl: number
  weekPnlPercent: number
  monthPnl: number
  monthPnlPercent: number
  ytdPnl: number
  ytdPnlPercent: number
  allTimePnl: number
  allTimePnlPercent: number
  lastUpdated: string
```

#### P&L Analysis

```yaml
# Get P&L Report
GET /api/v1/analytics/pnl
Query:
  period: "1d" | "1w" | "1m" | "3m" | "1y" | "ytd" | "all"
  groupBy?: "day" | "week" | "month" | "strategy" | "symbol"
Response:
  period: string
  startDate: string
  endDate: string
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  totalPnlPercent: number
  breakdown: [
    {
      date?: string
      strategy?: string
      symbol?: string
      pnl: number
      pnlPercent: number
      trades: number
    }
  ]

# Get Equity Curve
GET /api/v1/analytics/equity-curve
Query:
  period: "1w" | "1m" | "3m" | "1y" | "all"
  interval: "1h" | "1d" | "1w"
Response:
  dataPoints: [
    {
      timestamp: string
      equity: number
      cash: number
      positionValue: number
      benchmarkValue?: number
    }
  ]
```

#### Trade Statistics

```yaml
# Get Trade Statistics
GET /api/v1/analytics/trades/stats
Query:
  period: "1w" | "1m" | "3m" | "1y" | "all"
  strategyId?: string
Response:
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  avgWin: number
  avgLoss: number
  avgWinPercent: number
  avgLossPercent: number
  profitFactor: number
  expectancy: number
  avgHoldingPeriod: number  # minutes
  largestWin: number
  largestLoss: number
  consecutiveWins: number
  consecutiveLosses: number

# Get Trade History
GET /api/v1/analytics/trades
Query:
  limit: number (default: 50)
  offset: number
  strategyId?: string
  symbol?: string
  side?: "buy" | "sell"
  startDate?: string
  endDate?: string
Response:
  trades: Trade[]
  total: number
  hasMore: boolean
```

#### Risk Metrics

```yaml
# Get Risk Metrics
GET /api/v1/analytics/risk
Response:
  maxDrawdown: number
  maxDrawdownPercent: number
  maxDrawdownDate: string
  currentDrawdown: number
  sharpeRatio: number
  sortinoRatio: number
  calmarRatio: number
  beta: number
  alpha: number
  volatility: number
  var95: number           # Value at Risk (95%)
  riskExposure: number    # Total position value / equity
  concentrationRisk: number

# Get Position Risk
GET /api/v1/analytics/risk/positions
Response:
  positions: [
    {
      symbol: string
      weight: number
      sector: string
      beta: number
      volatility: number
      var95: number
      correlations: Record<string, number>
    }
  ]
```

#### Strategy Performance

```yaml
# Get Strategy Performance
GET /api/v1/analytics/strategies/:strategyId
Query:
  period: "1w" | "1m" | "3m" | "1y" | "all"
Response:
  strategyId: string
  name: string
  pnl: number
  pnlPercent: number
  trades: number
  winRate: number
  profitFactor: number
  sharpeRatio: number
  maxDrawdown: number
  avgHoldingPeriod: number
  bestTrade: Trade
  worstTrade: Trade
  
# Compare Strategies
GET /api/v1/analytics/strategies/compare
Query:
  strategyIds: string (comma-separated)
  period: string
Response:
  strategies: StrategyPerformance[]
  correlationMatrix: number[][]
```

### Event Subscriptions

| Event Type | Description | Action |
|------------|-------------|--------|
| `trade.order.filled` | Order filled | Update P&L, record trade |
| `trade.position.updated` | Position changed | Recalculate unrealized P&L |
| `trade.position.closed` | Position closed | Record realized P&L |
| `market.bar.1d` | Daily bar closed | Daily snapshot |

### Event Publications

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `analytics.pnl.calculated` | P&L recalculated | P&L summary |
| `analytics.metrics.snapshot` | Periodic snapshot | Full metrics |
| `analytics.drawdown.alert` | Drawdown threshold | Alert details |

---

## Data Model

### Database Schema

```sql
-- analytics schema
CREATE SCHEMA analytics;

-- Equity snapshots (time-series)
CREATE TABLE analytics.equity_snapshots (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  equity DECIMAL(15, 2) NOT NULL,
  cash DECIMAL(15, 2) NOT NULL,
  position_value DECIMAL(15, 2) NOT NULL,
  day_pnl DECIMAL(15, 2),
  day_pnl_percent DECIMAL(10, 4),
  position_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Trade records (denormalized for analytics)
CREATE TABLE analytics.trade_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL,
  order_id UUID NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(4) NOT NULL,
  quantity DECIMAL(15, 4) NOT NULL,
  entry_price DECIMAL(15, 4) NOT NULL,
  exit_price DECIMAL(15, 4),
  pnl DECIMAL(15, 2),
  pnl_percent DECIMAL(10, 4),
  commission DECIMAL(10, 4) DEFAULT 0,
  strategy_id UUID,
  decision_id UUID,
  entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
  exit_time TIMESTAMP WITH TIME ZONE,
  holding_period_minutes INTEGER,
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily aggregates (materialized)
CREATE TABLE analytics.daily_summary (
  date DATE PRIMARY KEY,
  starting_equity DECIMAL(15, 2),
  ending_equity DECIMAL(15, 2),
  high_equity DECIMAL(15, 2),
  low_equity DECIMAL(15, 2),
  day_pnl DECIMAL(15, 2),
  day_pnl_percent DECIMAL(10, 4),
  realized_pnl DECIMAL(15, 2),
  unrealized_pnl DECIMAL(15, 2),
  trades_count INTEGER,
  winning_trades INTEGER,
  losing_trades INTEGER,
  volume_traded DECIMAL(20, 2),
  commissions DECIMAL(15, 4),
  max_drawdown DECIMAL(10, 4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Strategy performance (materialized)
CREATE TABLE analytics.strategy_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL,
  date DATE NOT NULL,
  pnl DECIMAL(15, 2),
  pnl_percent DECIMAL(10, 4),
  trades INTEGER,
  winning_trades INTEGER,
  losing_trades INTEGER,
  win_rate DECIMAL(5, 4),
  profit_factor DECIMAL(10, 4),
  avg_holding_minutes INTEGER,
  UNIQUE(strategy_id, date)
);

-- Indexes
CREATE INDEX idx_equity_timestamp ON analytics.equity_snapshots(timestamp);
CREATE INDEX idx_trades_symbol ON analytics.trade_records(symbol);
CREATE INDEX idx_trades_strategy ON analytics.trade_records(strategy_id);
CREATE INDEX idx_trades_entry ON analytics.trade_records(entry_time);
CREATE INDEX idx_daily_date ON analytics.daily_summary(date);
```

---

## Calculation Engine

### P&L Calculations

```typescript
interface PnLCalculation {
  // Realized P&L (closed positions)
  realizedPnl: number;
  
  // Unrealized P&L (open positions)
  unrealizedPnl: number;
  
  // Total P&L
  totalPnl: number;
  
  // Percentage return
  pnlPercent: number;
}

function calculateRealizedPnL(trade: ClosedTrade): number {
  const gross = (trade.exitPrice - trade.entryPrice) * trade.quantity * 
    (trade.side === 'buy' ? 1 : -1);
  return gross - trade.commission;
}

function calculateUnrealizedPnL(position: Position, currentPrice: number): number {
  return (currentPrice - position.averageEntryPrice) * position.quantity *
    (position.side === 'long' ? 1 : -1);
}
```

### Risk Metrics

```typescript
// Sharpe Ratio = (Return - Risk-Free Rate) / Standard Deviation
function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.05): number {
  const avgReturn = mean(returns);
  const stdDev = standardDeviation(returns);
  const annualizedReturn = avgReturn * 252;
  const annualizedStd = stdDev * Math.sqrt(252);
  return (annualizedReturn - riskFreeRate) / annualizedStd;
}

// Maximum Drawdown
function calculateMaxDrawdown(equityCurve: number[]): {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  peakDate: Date;
  troughDate: Date;
} {
  let peak = equityCurve[0];
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  
  for (const equity of equityCurve) {
    if (equity > peak) {
      peak = equity;
    }
    const drawdown = peak - equity;
    const drawdownPercent = drawdown / peak;
    
    if (drawdownPercent > maxDrawdownPercent) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPercent;
    }
  }
  
  return { maxDrawdown, maxDrawdownPercent, peakDate, troughDate };
}
```

---

## Configuration

```yaml
analytics:
  server:
    port: 3004
    host: "0.0.0.0"
  
  snapshots:
    interval: 60000       # 1 minute during market hours
    retentionDays: 365    # Keep 1 year of snapshots
  
  aggregation:
    dailySummaryTime: "16:30"  # After market close
    weeklyReportTime: "09:00"  # Monday morning
  
  alerts:
    maxDrawdownThreshold: 0.05  # 5%
    dailyLossThreshold: 0.02    # 2%
  
  database:
    host: ${DB_HOST}
    port: ${DB_PORT}
    name: ai_trader
    schema: analytics
  
  eventBus:
    url: ${NATS_URL}
    publishPrefix: "ai-trader.analytics"
    subscriptions:
      - "ai-trader.trade.*"
      - "ai-trader.market.bar.1d"
```

---

## Health & Metrics

### Health Endpoint

```json
GET /health
{
  "status": "healthy",
  "checks": {
    "database": "connected",
    "eventBus": "connected"
  },
  "lastSnapshot": "2025-12-12T10:30:00Z",
  "snapshotsToday": 420,
  "tradesProcessed": 45
}
```

### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `analytics_snapshots_total` | Counter | Total snapshots taken |
| `analytics_pnl_calculations_total` | Counter | P&L recalculations |
| `analytics_query_latency_ms` | Histogram | Query response time |
| `analytics_trade_records` | Gauge | Total trade records |
| `analytics_current_equity` | Gauge | Current portfolio equity |
| `analytics_current_drawdown` | Gauge | Current drawdown % |
