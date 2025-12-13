# Financial Metrics Documentation

> **Purpose**  
> This document defines all financial calculations, P&L formulas, and business metrics used in the AI Active Trader application. Any changes to financial logic MUST be reflected here first.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [P&L Calculations](#2-pl-calculations)
3. [Performance Metrics](#3-performance-metrics)
4. [Portfolio Metrics](#4-portfolio-metrics)
5. [Risk Metrics](#5-risk-metrics)
6. [Trade Classification](#6-trade-classification)
7. [Numeric Examples](#7-numeric-examples)
8. [Implementation Reference](#8-implementation-reference)
9. [Metric to UI Mapping](#9-metric-to-ui-mapping)
10. [Current State (December 2025)](#10-current-state-december-2025)
11. [Enhancements Compared to Previous Version](#11-enhancements-compared-to-previous-version)
12. [Old vs New - Summary of Changes](#12-old-vs-new---summary-of-changes)

---

## 1. Core Concepts

### 1.1 Position Types

| Type | Description |
|------|-------------|
| **Long** | Buy low, sell high. Profit when price increases. |
| **Short** | Sell high, buy low. Profit when price decreases. (Not currently implemented) |

### 1.2 P&L Categories

| Category | Description | When Calculated |
|----------|-------------|-----------------|
| **Unrealized P&L** | Paper profit/loss on open positions | Continuously, based on current market price |
| **Realized P&L** | Actual profit/loss from closed trades | When position is closed (sell executed) |
| **Total P&L** | Sum of unrealized + realized | Portfolio summary |

### 1.3 Key Terms

| Term | Definition |
|------|------------|
| **Entry Price** | Price at which position was opened (buy price for long) |
| **Exit Price** | Price at which position was closed (sell price for long) |
| **Current Price** | Latest market price for the asset |
| **Quantity** | Number of shares/units held |
| **Market Value** | Current price × Quantity |
| **Cost Basis** | Entry price × Quantity |

---

## 2. P&L Calculations

### 2.1 Unrealized P&L (Open Positions)

**Formula (Long Position):**
```
Unrealized P&L = (Current Price - Entry Price) × Quantity
```

**Formula (Short Position):**
```
Unrealized P&L = (Entry Price - Current Price) × Quantity
```

**Example:**
- Entry Price: $150.00
- Current Price: $155.00
- Quantity: 10 shares
- Unrealized P&L: ($155.00 - $150.00) × 10 = **$50.00 profit**

### 2.2 Realized P&L (Closed Trades)

**Formula (Long Position):**
```
Realized P&L = (Exit Price - Entry Price) × Quantity
```

**Formula (Short Position):**
```
Realized P&L = (Entry Price - Exit Price) × Quantity
```

**Example:**
- Entry Price: $150.00
- Exit Price: $145.00
- Quantity: 10 shares
- Realized P&L: ($145.00 - $150.00) × 10 = **-$50.00 loss**

### 2.3 P&L Percentage

**Formula:**
```
P&L % = ((Current Price - Entry Price) / Entry Price) × 100
```

**Alternative (using cost basis):**
```
P&L % = ((Market Value - Cost Basis) / Cost Basis) × 100
```

**Example:**
- Entry Price: $150.00
- Current Price: $165.00
- P&L %: (($165.00 - $150.00) / $150.00) × 100 = **10.00%**

### 2.4 Implementation

```typescript
// From server/utils/numeric.ts
export function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  side: "long" | "short" = "long"
): number {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(exitPrice) || !Number.isFinite(quantity)) {
    return 0;
  }
  
  if (side === "long") {
    return (exitPrice - entryPrice) * quantity;
  } else {
    return (entryPrice - exitPrice) * quantity;
  }
}
```

---

## 3. Performance Metrics

### 3.1 Win Rate

**Definition:** Percentage of closed trades that were profitable.

**Formula:**
```
Win Rate = (Number of Winning Trades / Total Closed Trades) × 100
```

**Conditions:**
- A trade is "winning" if `P&L > 0`
- A trade is "losing" if `P&L < 0`
- Trades with `P&L = 0` are excluded from win rate calculation

**Example:**
- Total closed trades: 20
- Winning trades (P&L > 0): 12
- Win Rate: (12 / 20) × 100 = **60%**

### 3.2 Total Realized P&L

**Formula:**
```
Total Realized P&L = Σ (P&L of each closed trade)
```

**Implementation:**
```typescript
const closingTrades = trades.filter((t) => t.pnl !== null && t.pnl !== "0");
const totalRealizedPnl = closingTrades.reduce(
  (sum, t) => sum + safeParseFloat(t.pnl),
  0
);
```

### 3.3 Total Unrealized P&L

**Formula:**
```
Total Unrealized P&L = Σ (Unrealized P&L of each open position)
```

### 3.4 Average Trade P&L

**Formula:**
```
Average Trade P&L = Total Realized P&L / Number of Closed Trades
```

**Not Yet Implemented:** This metric is planned but not currently calculated.

### 3.5 Profit Factor

**Formula:**
```
Profit Factor = Gross Profit / Gross Loss
```

Where:
- Gross Profit = Sum of all positive P&L trades
- Gross Loss = Absolute value of sum of all negative P&L trades

**Not Yet Implemented:** This metric is planned but not currently calculated.

---

## 4. Portfolio Metrics

### 4.1 Cash Balance

**Definition:** Available cash not invested in positions.

**Initial Value:** $100,000 (paper trading default)

**Updates:**
- Decreased when buying positions
- Increased when selling positions (including P&L)

### 4.2 Positions Value

**Formula:**
```
Positions Value = Σ (Current Price × Quantity) for each position
```

### 4.3 Total Equity

**Formula:**
```
Total Equity = Cash Balance + Positions Value
```

**Example:**
- Cash Balance: $50,000
- Position 1: 100 shares of AAPL at $175 = $17,500
- Position 2: 50 shares of GOOGL at $140 = $7,000
- Positions Value: $24,500
- Total Equity: $50,000 + $24,500 = **$74,500**

### 4.4 Portfolio Return

**Formula:**
```
Portfolio Return % = ((Total Equity - Initial Capital) / Initial Capital) × 100
```

**Example:**
- Initial Capital: $100,000
- Total Equity: $105,000
- Portfolio Return: (($105,000 - $100,000) / $100,000) × 100 = **5.00%**

---

## 5. Risk Metrics

### 5.1 Position Size (% of Portfolio)

**Formula:**
```
Position Size % = (Position Value / Total Equity) × 100
```

**Default Limit:** 10% maximum per position

### 5.2 Total Exposure

**Formula:**
```
Total Exposure % = (Positions Value / Total Equity) × 100
```

**Default Limit:** 50% maximum

### 5.3 Daily Loss Limit

**Formula:**
```
Daily Loss % = (Today's Realized Losses / Starting Equity) × 100
```

**Default Limit:** 5% maximum (triggers kill switch)

### 5.4 Drawdown

**Definition:** Peak-to-trough decline in portfolio value.

**Formula:**
```
Drawdown % = ((Peak Equity - Current Equity) / Peak Equity) × 100
```

**Not Yet Implemented:** Maximum drawdown tracking is planned but not currently calculated.

### 5.5 Sharpe Ratio

**Formula:**
```
Sharpe Ratio = (Average Return - Risk-Free Rate) / Standard Deviation of Returns
```

**Not Yet Implemented:** This requires historical daily returns, which are not currently tracked.

---

## 6. Trade Classification

### 6.1 By Side

| Side | Action | P&L Behavior |
|------|--------|--------------|
| `buy` | Open long position | Creates cost basis |
| `sell` | Close long position | Realizes P&L |

### 6.2 By Status

| Status | Description |
|--------|-------------|
| `completed` | Trade executed successfully |
| `pending` | Order submitted, awaiting fill |
| `cancelled` | Order cancelled before fill |
| `failed` | Order rejected by broker |

### 6.3 By Asset Type

| Type | Examples | Identifier Pattern |
|------|----------|-------------------|
| Stock | AAPL, GOOGL, MSFT | Uppercase letters only |
| Crypto | BTC/USD, ETH/USD | Contains `/USD` suffix |

---

## 7. Numeric Examples

### 7.1 Complete Trade Lifecycle

**Scenario:** Buy 10 shares of AAPL, price rises, then sell.

| Step | Action | Price | Cash Balance | Position Value | P&L |
|------|--------|-------|--------------|----------------|-----|
| 1. Start | - | - | $100,000 | $0 | $0 |
| 2. Buy | Buy 10 AAPL | $150 | $98,500 | $1,500 | $0 unrealized |
| 3. Price Up | - | $160 | $98,500 | $1,600 | $100 unrealized |
| 4. Sell | Sell 10 AAPL | $160 | $100,100 | $0 | $100 realized |

**Calculations:**
- Step 2: Cash = $100,000 - ($150 × 10) = $98,500
- Step 3: Unrealized P&L = ($160 - $150) × 10 = $100
- Step 4: Realized P&L = ($160 - $150) × 10 = $100

### 7.2 Losing Trade Example

**Scenario:** Buy 5 shares of NVDA, price drops, then sell.

| Step | Action | Price | Calculation | P&L |
|------|--------|-------|-------------|-----|
| 1. Buy | Buy 5 | $500 | Cost = $2,500 | - |
| 2. Drop | - | $480 | Unrealized = ($480-$500) × 5 | -$100 |
| 3. Sell | Sell 5 | $475 | Realized = ($475-$500) × 5 | -$125 |

### 7.3 Win Rate Calculation

**Scenario:** 5 completed trades

| Trade | Symbol | Entry | Exit | P&L | Win? |
|-------|--------|-------|------|-----|------|
| 1 | AAPL | $150 | $155 | +$50 | Yes |
| 2 | GOOGL | $140 | $135 | -$50 | No |
| 3 | MSFT | $380 | $400 | +$200 | Yes |
| 4 | AMZN | $175 | $170 | -$50 | No |
| 5 | NVDA | $450 | $480 | +$300 | Yes |

**Calculation:**
- Winning trades: 3
- Total trades: 5
- Win Rate: 3/5 × 100 = **60%**
- Total Realized P&L: $50 - $50 + $200 - $50 + $300 = **$450**

---

## 8. Implementation Reference

### 8.1 Key Files

| File | Purpose |
|------|---------|
| `server/utils/numeric.ts` | `calculatePnL()`, `safeParseFloat()` |
| `server/trading/paper-trading-engine.ts` | Portfolio summary, position updates |
| `server/routes.ts` | Analytics endpoints |
| `shared/schema.ts` | Trade and Position data models |

### 8.2 API Endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /api/analytics/summary` | Total P&L, realized P&L, unrealized P&L, win rate, trade counts |
| `GET /api/positions` | Positions with current prices and unrealized P&L |
| `GET /api/trades` | Trade history with realized P&L |

#### /api/analytics/summary Response Format

```typescript
{
  totalTrades: number;        // All trades (buy + sell)
  totalPnl: string;           // unrealizedPnl + realizedPnl (per Section 1.2)
  realizedPnl: string;        // Sum of closed trade P&L
  unrealizedPnl: string;      // Sum of open position unrealized_pl from Alpaca
  winRate: string;            // (winningTrades / closedTrades) * 100
  winningTrades: number;      // Trades with P&L > 0
  losingTrades: number;       // Trades with P&L < 0
  openPositions: number;      // Current position count from Alpaca
  isAgentRunning: boolean;    // Trading agent status
  dailyPnl: string;           // portfolioValue - lastEquity (today's change)
  dailyTradeCount: number;    // Trades executed today
}
```

**Total P&L Formula (implemented Dec 2025):**
```typescript
// From server/routes.ts - /api/analytics/summary endpoint
const realizedPnl = closedTrades.reduce((sum, t) => sum + safeParseFloat(t.pnl, 0), 0);
const totalPnl = unrealizedPnl + realizedPnl;
```

### 8.3 Database Fields

**trades table:**
- `pnl`: Realized P&L (stored as numeric string)
- `price`: Exit price for sells, entry price for buys

**positions table:**
- `entryPrice`: Cost basis per share
- `currentPrice`: Latest market price
- `unrealizedPnl`: Current paper profit/loss

---

## 9. Metric to UI Mapping

This table shows where each financial metric is displayed in the application.

### 9.1 Dashboard Screen Metrics

| Metric | UI Component | Data Source | Format |
|--------|--------------|-------------|--------|
| **Total Equity** | Portfolio Summary Card | `/api/alpaca/account` → `equity` | `$XXX,XXX.XX` |
| **Cash Balance** | Portfolio Summary Card | `/api/alpaca/account` → `cash` | `$XXX,XXX.XX` |
| **Buying Power** | Portfolio Summary Card | `/api/alpaca/account` → `buying_power` | `$XXX,XXX.XX` |
| **Day Change** | Portfolio Summary Card | Calculated: `equity - last_equity` | `+$X,XXX.XX` / `-$X,XXX.XX` |
| **Day Change %** | Portfolio Summary Card | Calculated: `(day_change / last_equity) × 100` | `+X.XX%` / `-X.XX%` |
| **Total Unrealized P&L** | Positions Widget | Sum of all position `unrealized_pl` | Green/Red colored |
| **Total Realized P&L** | Analytics Card | `/api/analytics/summary` → `totalRealizedPnl` | `$X,XXX.XX` |
| **Win Rate** | Analytics Card | `/api/analytics/summary` → `winRate` | `XX%` |
| **Trade Count** | Analytics Card | `/api/analytics/summary` → `tradeCount` | Integer |

### 9.2 Position Row Metrics

| Metric | Field | Calculation | Format |
|--------|-------|-------------|--------|
| **Symbol** | `symbol` | Direct from Alpaca | `AAPL`, `BTC/USD` |
| **Quantity** | `qty` | Direct from Alpaca | Integer or decimal |
| **Avg Entry** | `avg_entry_price` | Direct from Alpaca | `$XXX.XX` |
| **Current Price** | `current_price` | Direct from Alpaca | `$XXX.XX` |
| **Market Value** | `market_value` | `current_price × qty` | `$X,XXX.XX` |
| **Unrealized P&L** | `unrealized_pl` | `(current - entry) × qty` | Green/Red `$X.XX` |
| **Unrealized P&L %** | `unrealized_plpc` | `(unrealized_pl / cost_basis) × 100` | Green/Red `X.XX%` |
| **Today's Change** | `change_today` | `(current - lastday_price) × qty` | `$X.XX` |

### 9.3 Trade History Row Metrics

| Metric | Field | Source | Format |
|--------|-------|--------|--------|
| **Symbol** | `symbol` | Database `trades` table | `AAPL` |
| **Side** | `side` | Database | `BUY` / `SELL` |
| **Quantity** | `quantity` | Database | Numeric |
| **Price** | `price` | Alpaca order fill price | `$XXX.XX` |
| **Realized P&L** | `pnl` | Calculated on sell | Green/Red `$X.XX` |
| **Executed At** | `executed_at` | Alpaca fill timestamp | `Dec 11, 2:30 PM` |
| **Status** | `status` | Database | `completed`, `failed` |

### 9.4 Agent Status Metrics

| Metric | UI Location | Source | Format |
|--------|-------------|--------|--------|
| **Agent Running** | Status Badge | `agentStatus.isRunning` | Green/Red dot |
| **Last Heartbeat** | Agent Card | `agentStatus.lastHeartbeat` | `X sec ago` |
| **Total Trades** | Agent Card | `agentStatus.totalTrades` | Integer |
| **Session P&L** | Agent Card | `agentStatus.totalPnl` | `$X,XXX.XX` |
| **Active Positions** | Agent Card | `positions.length` | Integer |

### 9.5 Color Coding Rules

| Condition | Color | Usage |
|-----------|-------|-------|
| `value > 0` | Green (`#10B981`) | Positive P&L, gains |
| `value < 0` | Red (`#EF4444`) | Negative P&L, losses |
| `value === 0` | Neutral (text color) | No change |
| Agent running | Green dot | Agent active |
| Agent stopped | Gray dot | Agent inactive |
| Kill switch active | Red dot | Emergency stop |

### 9.6 Calculation Functions Used

| UI Metric | Function | File |
|-----------|----------|------|
| P&L (any) | `calculatePnL()` | `server/utils/numeric.ts` |
| Percent change | `calculatePercentChange()` | `server/utils/numeric.ts` |
| Safe number parsing | `safeParseFloat()` | `server/utils/numeric.ts` |
| Price formatting | `formatPrice()` | `server/utils/numeric.ts` |
| Percent formatting | `formatPercent()` | `server/utils/numeric.ts` |

---

## Known Limitations

1. **Historical Trade Prices:** ~245 historical trades have `price = 0` due to a bug that has been fixed. Only new trades have accurate price data.

2. **Short Positions:** Not currently supported. All positions are assumed long.

3. **Fees and Commissions:** Not accounted for in P&L calculations.

4. **Dividends:** Not tracked or included in returns.

5. **Currency:** All values in USD. No multi-currency support.

6. **Advanced Metrics:** Sharpe ratio, Sortino ratio, and max drawdown are not yet implemented.

---

## Changelog

| Date | Change |
|------|--------|
| Dec 2024 | Initial documentation of all financial formulas |

---

## 10. Current State (December 2025)

### 10.1 Advanced Metrics Now Implemented

The shared backtesting library (`services/shared/backtesting/`) now includes full implementations of previously planned metrics:

| Metric | Implementation | Location |
|--------|---------------|----------|
| **Sharpe Ratio** | ✅ Implemented | `performance-analyzer.ts` |
| **Sortino Ratio** | ✅ Implemented | `performance-analyzer.ts` |
| **Calmar Ratio** | ✅ Implemented | `performance-analyzer.ts` |
| **Max Drawdown** | ✅ Implemented | `performance-analyzer.ts` |
| **Profit Factor** | ✅ Implemented | `performance-analyzer.ts` |
| **CAGR** | ✅ Implemented | `performance-analyzer.ts` |
| **Expectancy** | ✅ Implemented | `performance-analyzer.ts` |

### 10.2 PerformanceAnalyzer Class

```typescript
// services/shared/backtesting/performance-analyzer.ts
export class PerformanceAnalyzer {
  constructor(riskFreeRate: number = 0.05, tradingDaysPerYear: number = 252);
  addEquityPoint(point: EquityPoint): void;
  addTrade(trade: TradeRecord): void;
  analyze(initialCapital: number): PerformanceMetrics;
  getTradeAnalysis(): TradeAnalysis;
}
```

### 10.3 Complete PerformanceMetrics Interface

```typescript
export interface PerformanceMetrics {
  // Returns
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  cagr: number;

  // Risk-Adjusted Returns
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  informationRatio?: number;

  // Drawdown Analysis
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageDrawdown: number;
  maxDrawdownDuration: number;
  averageDrawdownDuration: number;

  // Volatility Metrics
  volatility: number;
  annualizedVolatility: number;
  downsideDeviation: number;
  skewness: number;
  kurtosis: number;

  // Trade Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  payoffRatio: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  averageHoldingPeriod: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;

  // Metadata
  riskFreeRate: number;
  tradingDays: number;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalEquity: number;
}
```

### 10.4 Trade Analysis Breakdown

```typescript
export interface TradeAnalysis {
  bySymbol: Map<string, { trades, winRate, totalPnl, avgPnl }>;
  bySide: {
    long: { trades, winRate, totalPnl };
    short: { trades, winRate, totalPnl };
  };
  byMonth: Map<string, { trades, pnl, winRate }>;
  byDayOfWeek: Map<number, { trades, pnl, winRate }>;
}
```

### 10.5 Ratio Calculations

**Sharpe Ratio:**
```typescript
private calculateSharpe(returns: number[]): number {
  const dailyRiskFree = this.riskFreeRate / this.tradingDaysPerYear;
  const excessReturns = returns.map(r => r - dailyRiskFree);
  const avgExcess = mean(excessReturns);
  const stdDev = calculateStdDev(excessReturns);
  return (avgExcess / stdDev) * Math.sqrt(this.tradingDaysPerYear);
}
```

**Sortino Ratio:**
```typescript
private calculateSortino(returns: number[]): number {
  const dailyRiskFree = this.riskFreeRate / this.tradingDaysPerYear;
  const excessReturns = returns.map(r => r - dailyRiskFree);
  const avgExcess = mean(excessReturns);
  const downsideDev = calculateDownsideDeviation(returns);
  return (avgExcess / downsideDev) * Math.sqrt(this.tradingDaysPerYear);
}
```

### 10.6 Drawdown Period Identification

The analyzer automatically tracks drawdown periods:

```typescript
interface DrawdownPeriod {
  startDate: Date;
  endDate?: Date;
  recoveryDate?: Date;
  peakEquity: number;
  troughEquity: number;
  drawdownPercent: number;
  durationDays: number;
  recoveryDays?: number;
}
```

---

## 11. Enhancements Compared to Previous Version

| Metric | Previous | Current |
|--------|----------|---------|
| **Sharpe Ratio** | Not implemented | ✅ Fully implemented with configurable risk-free rate |
| **Sortino Ratio** | Not implemented | ✅ Downside-only deviation |
| **Max Drawdown** | Not implemented | ✅ With duration and recovery tracking |
| **Profit Factor** | Not implemented | ✅ Gross profit / gross loss |
| **CAGR** | Not implemented | ✅ Annualized compound growth |
| **Expectancy** | Not implemented | ✅ Average expected P&L per trade |
| **Trade Analysis** | Basic | ✅ By symbol, side, month, day of week |
| **Short Positions** | Not supported | ✅ Fully supported in backtesting |

### Key Improvements

1. **Backtesting Engine**: Full event-driven simulation with realistic fills
2. **Equity Curve Tracking**: Daily equity points with automatic drawdown calculation
3. **Trade Record System**: Complete trade lifecycle with entry/exit tracking
4. **Multi-Dimensional Analysis**: Performance breakdown by multiple factors
5. **Report Generation**: Human-readable metrics summaries

---

## 12. Old vs New - Summary of Changes

### Metrics Implementation Status

| Category | Old (Dec 2024) | New (Dec 2025) |
|----------|----------------|----------------|
| P&L Calculations | ✅ Basic | ✅ Enhanced with cost basis |
| Win Rate | ✅ Implemented | ✅ Unchanged |
| Portfolio Metrics | ✅ Basic | ✅ Enhanced |
| Risk Metrics | ❌ Planned | ✅ Fully implemented |
| Advanced Ratios | ❌ Not started | ✅ Sharpe, Sortino, Calmar |
| Drawdown Analysis | ❌ Not started | ✅ With period tracking |

### New Files

| File | Purpose |
|------|---------|
| `services/shared/backtesting/performance-analyzer.ts` | Full metrics implementation |
| `services/shared/backtesting/simulation-engine.ts` | Backtesting engine |
| `services/shared/analytics/` | Transaction cost analysis |

### API Changes

| Endpoint | Change |
|----------|--------|
| `/api/analytics/summary` | Added `totalPnl` field (Dec 2025) |
| `/api/backtest/run` | New endpoint for backtesting |
| `/api/backtest/results` | Retrieve backtest results |

### Known Limitations Resolved

| Issue | Status |
|-------|--------|
| Historical trade prices = 0 | Fixed for new trades |
| Short positions | ✅ Now supported in backtesting |
| Sharpe/Sortino ratios | ✅ Now implemented |
| Max drawdown | ✅ Now implemented |

### Remaining Limitations

1. **Fees and Commissions:** Configurable in backtesting, not yet in live trading
2. **Dividends:** Still not tracked
3. **Currency:** USD only
4. **Live Advanced Metrics:** Sharpe/Sortino only in backtesting, not real-time

---

## Changelog

| Date | Change |
|------|--------|
| Dec 2024 | Initial documentation of all financial formulas |
| Dec 2025 | Added PerformanceAnalyzer with Sharpe, Sortino, drawdown |
| Dec 2025 | Added trade analysis by symbol, side, month, day |
| Dec 2025 | Added Current State, Enhancements, Old vs New sections |

---

*Last Updated: December 2025*
*Version: 2.0.0 (Microservices Migration)*
