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
| `GET /api/analytics/summary` | Total realized + unrealized P&L |
| `GET /api/positions` | Positions with current prices and unrealized P&L |
| `GET /api/trades` | Trade history with realized P&L |

### 8.3 Database Fields

**trades table:**
- `pnl`: Realized P&L (stored as numeric string)
- `price`: Exit price for sells, entry price for buys

**positions table:**
- `entryPrice`: Cost basis per share
- `currentPrice`: Latest market price
- `unrealizedPnl`: Current paper profit/loss

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

*Last Updated: December 2024*
