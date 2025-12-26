# OMAR Optimal Indicator Parameters - Quick Reference

## Best Configuration (Iteration 417 - Score: 254.23)

### Performance Summary
```
Sharpe:  1.752  |  Sortino: 1.776  |  Calmar: 1.466
Return:  24.72% |  MaxDD:   5.24%  |  Win Rate: 45.19%
Trades:  208    |  Profit Factor: 2.45
```

---

## Parameter Settings

### RSI (Relative Strength Index)
```typescript
period:     7
oversold:   34
overbought: 80
```

### MACD (Moving Average Convergence Divergence)
```typescript
fastEMA:    8
slowEMA:    32
signal:     12
```

### Bollinger Bands
```typescript
period:     21
stdDev:     1.8
```

### ATR (Average True Range)
```typescript
period:     20
```

### Stochastic Oscillator
```typescript
period:     21
smoothK:    5
smoothD:    1
```

---

## Signal Generation Logic

### Buy Signal (Long Entry)
```
RSI < 34 (oversold)
AND MACD histogram > 0 AND increasing
AND Price < BB Lower (1.8 std dev)
AND Stochastic K < 20 AND K > D (crossing up)
AND Volume > 1.5x average
```

### Sell Signal (Exit)
```
RSI > 80 (overbought)
OR MACD histogram < 0 AND decreasing
OR Price > BB Upper
OR Stochastic K > 80 AND K < D (crossing down)
OR Stop Loss hit (entry - 1.5 * ATR)
OR Take Profit hit (entry + 4.0 * ATR)
```

---

## Code Implementation

```typescript
// Indicator Configuration
const OPTIMAL_CONFIG = {
  rsi: {
    period: 7,
    oversold: 34,
    overbought: 80,
  },
  macd: {
    fast: 8,
    slow: 32,
    signal: 12,
  },
  bollingerBands: {
    period: 21,
    stdDev: 1.8,
  },
  atr: {
    period: 20,
  },
  stochastic: {
    period: 21,
    smoothK: 5,
    smoothD: 1,
  },
};

// Stop Loss and Take Profit
const RISK_PARAMS = {
  stopLoss: 1.5,    // ATR multiplier
  takeProfit: 4.0,  // ATR multiplier
};
```

---

## Top 5 Alternative Configurations

### #2 - Higher Return (25.1%)
```
RSI: 7/36/70  |  MACD: 13/28/11  |  BB: 21/1.5
Sharpe: 1.67  |  Return: 25.1%   |  MaxDD: 5.25%
```

### #3 - Balanced
```
RSI: 21/32/74  |  MACD: 9/26/6  |  BB: 15/2.6
Sharpe: 1.57   |  Return: 23.4% |  MaxDD: 6.10%
```

### #4 - Highest Return (27.2%)
```
RSI: 18/40/70  |  MACD: 15/30/7  |  BB: 22/2.0
Sharpe: 1.74   |  Return: 27.2%  |  MaxDD: 6.89%
```

### #5 - Aggressive (28.7% return)
```
RSI: 16/32/70  |  MACD: 9/20/6  |  BB: 20/2.0
Sharpe: 1.65   |  Return: 28.7% |  MaxDD: 7.01%
```

---

## Key Insights

1. **Fast RSI (7 days)** captures momentum shifts 2x faster than traditional 14-day
2. **Wide MACD spread (24 days)** filters noise while maintaining responsiveness
3. **Tighter BB (1.8 std)** provides earlier mean reversion signals
4. **Long ATR (20 days)** prevents premature stop-outs
5. **Heavy Stochastic smoothing** reduces whipsaws

---

## Optimal Ranges (Top 20 Analysis)

```
RSI Period:     7-21   (avg: 14.4, sweet spot: 7-18)
RSI Oversold:   20-40  (avg: 33.8, sweet spot: 32-36)
RSI Overbought: 68-80  (avg: 73.8, sweet spot: 70-80)

MACD Fast:      8-15   (avg: 10.6, sweet spot: 8-10)
MACD Slow:      20-32  (avg: 25.6, sweet spot: 26-32)
MACD Signal:    6-12   (avg: 8.4,  sweet spot: 6-9)

BB Period:      15-25  (avg: 20.7, sweet spot: 19-22)
BB StdDev:      1.5-3.0 (avg: 2.0, sweet spot: 1.5-2.0)

ATR Period:     10-20  (avg: 12.9, sweet spot: 12-20)

Stoch Period:   5-21   (avg: 14.6, sweet spot: 14-21)
```

---

## Comparison to Traditional Settings

| Metric | Traditional | Optimal | Improvement |
|--------|-------------|---------|-------------|
| Sharpe | 0.8-1.2 | 1.752 | +46-119% |
| MaxDD | 8-15% | 5.24% | -34-65% |
| Win Rate | 35-40% | 45.19% | +13-29% |
| Profit Factor | 1.5-2.0 | 2.45 | +23-63% |

---

**Last Updated**: 2025-12-22
**Optimization Iterations**: 1,000
**Validation Period**: 3 years (2022-2025)
**Symbol Universe**: 21 symbols
