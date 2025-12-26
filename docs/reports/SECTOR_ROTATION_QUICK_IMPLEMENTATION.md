# Sector Rotation Strategy - Quick Implementation Guide

## Best Configuration Found

**Strategy:** Mixed_Top2Sectors_BiWeekly
**Sharpe Ratio:** 1.31
**Return:** 75.3% (3-year), 20.7% annualized
**Max Drawdown:** 16.1%
**Win Rate:** 53.1%

---

## Implementation Parameters

```typescript
const SECTOR_ROTATION_CONFIG = {
  // Core Strategy
  strategyName: "Mixed_Top2Sectors_BiWeekly",
  rotationFrequencyDays: 10,  // Bi-weekly rotation
  topSectorCount: 2,           // Select top 2 sectors
  stocksPerSector: 3,          // 3 stocks from each sector
  totalPositions: 6,           // 2 sectors × 3 stocks

  // Scoring Weights
  scoringWeights: {
    momentum: 0.40,           // 20-day price momentum
    relativeStrength: 0.30,   // Performance vs SPY
    volatility: 0.20,         // Inverse volatility (lower is better)
    trend: 0.10,              // SMA crossover confirmation
  },

  // Technical Parameters
  momentumLookback: 20,       // Days for momentum calculation
  volatilityLookback: 30,     // Days for volatility calculation
  trendSMA: [20, 50],         // SMAs for trend detection
  benchmark: "SPY",           // Benchmark for relative strength

  // Risk Management
  maxDrawdownStop: 0.20,      // Stop rotation if DD > 20%
  minWinRate: 0.50,           // Alert if win rate < 50%
  positionSize: 0.167,        // ~16.7% per position (1/6)

  // Execution
  orderType: "LIMIT",         // Use limit orders
  limitOffset: 0.001,         // 0.1% from market price
  minLiquidity: 1000000,      // Min $1M daily volume
};
```

---

## Sector Universe (SPDR Select Sector ETFs)

```typescript
const SECTOR_ETFS = [
  { symbol: "XLK", name: "Technology", priority: 1 },          // Highest momentum
  { symbol: "XLY", name: "Consumer Discretionary", priority: 2 },
  { symbol: "XLE", name: "Energy", priority: 3 },
  { symbol: "XLU", name: "Utilities", priority: 4 },           // Defensive anchor
  { symbol: "XLV", name: "Healthcare", priority: 5 },
  { symbol: "XLP", name: "Consumer Staples", priority: 6 },
  { symbol: "XLI", name: "Industrials", priority: 7 },
  { symbol: "XLF", name: "Financials", priority: 8 },
  { symbol: "XLRE", name: "Real Estate", priority: 9 },
  { symbol: "XLB", name: "Materials", priority: 10 },
];
```

---

## Stock Selection by Sector

Top 3 stocks per sector (by market cap and liquidity):

```typescript
const SECTOR_STOCKS = {
  XLK: ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AVGO", "ORCL", "AMD"],
  XLY: ["AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "LOW", "TGT"],
  XLE: ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO"],
  XLU: ["NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "XEL"],
  XLV: ["UNH", "JNJ", "LLY", "ABBV", "MRK", "TMO", "ABT", "PFE"],
  XLP: ["PG", "KO", "PEP", "WMT", "COST", "PM", "MO", "MDLZ"],
  XLI: ["CAT", "RTX", "HON", "UPS", "BA", "DE", "GE", "LMT"],
  XLF: ["JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "AXP"],
  XLRE: ["AMT", "PLD", "CCI", "EQIX", "PSA", "WELL", "DLR", "O"],
  XLB: ["LIN", "APD", "SHW", "ECL", "NEM", "FCX", "DD", "DOW"],
};
```

---

## Scoring Algorithm

```typescript
function scoreSector(sectorSymbol: string, bars: Map<string, Bar[]>): SectorScore {
  const sectorBars = bars.get(sectorSymbol);
  const spyBars = bars.get("SPY");
  const closes = sectorBars.map(b => b.close);

  // 1. Momentum Score (40%)
  const momentum = (closes[closes.length - 1] - closes[closes.length - 21]) /
                   closes[closes.length - 21];

  // 2. Relative Strength Score (30%)
  const spyCloses = spyBars.map(b => b.close);
  const spyMomentum = (spyCloses[spyCloses.length - 1] - spyCloses[spyCloses.length - 21]) /
                      spyCloses[spyCloses.length - 21];
  const relativeStrength = momentum - spyMomentum;

  // 3. Volatility Score (20%) - inverse
  const returns = [];
  for (let i = 1; i < 31; i++) {
    returns.push((closes[closes.length - i] - closes[closes.length - i - 1]) /
                 closes[closes.length - i - 1]);
  }
  const volatility = standardDeviation(returns) * Math.sqrt(252);
  const volatilityScore = 1 - volatility;  // Lower is better

  // 4. Trend Score (10%)
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const trend = sma20[sma20.length - 1] > sma50[sma50.length - 1] ? 1 : -1;

  // Composite Score
  const compositeScore =
    momentum * 0.40 +
    relativeStrength * 0.30 +
    volatilityScore * 0.20 +
    trend * 0.10;

  return {
    symbol: sectorSymbol,
    score: compositeScore,
    momentum,
    relativeStrength,
    volatility,
    trend,
  };
}
```

---

## Rotation Logic (Bi-Weekly)

```typescript
async function rotatePortfolio() {
  // Run every 10 trading days
  const daysSinceLastRotation = getDaysSinceLastRotation();
  if (daysSinceLastRotation < 10) return;

  // Step 1: Score all sectors
  const sectorScores = SECTOR_ETFS.map(sector =>
    scoreSector(sector.symbol, historicalBars)
  );

  // Step 2: Rank and select top 2
  sectorScores.sort((a, b) => b.score - a.score);
  const topSectors = sectorScores.slice(0, 2);

  console.log(`Top Sectors: ${topSectors.map(s => s.symbol).join(", ")}`);

  // Step 3: Select top 3 stocks from each sector
  const selectedStocks = [];
  for (const sector of topSectors) {
    const stocks = SECTOR_STOCKS[sector.symbol];
    selectedStocks.push(...stocks.slice(0, 3));
  }

  // Step 4: Close existing positions
  await closeAllPositions();

  // Step 5: Open new positions (equal weight)
  const portfolioValue = await getPortfolioValue();
  const positionSize = portfolioValue / selectedStocks.length;

  for (const stock of selectedStocks) {
    await openPosition({
      symbol: stock,
      value: positionSize,
      orderType: "LIMIT",
    });
  }

  updateLastRotationDate();
  logRotation(topSectors, selectedStocks);
}
```

---

## Expected Performance Metrics

| Metric | Target | Acceptable Range |
|--------|--------|------------------|
| **Sharpe Ratio** | 1.31 | 1.0 - 1.5 |
| **Sortino Ratio** | 1.37 | 1.0 - 1.6 |
| **Calmar Ratio** | 1.29 | 0.8 - 1.5 |
| **Total Return (Annual)** | 20.7% | 15% - 25% |
| **Max Drawdown** | 16.1% | 12% - 20% |
| **Win Rate** | 53.1% | 50% - 60% |
| **Volatility** | 16.8% | 14% - 20% |
| **Avg Holding Period** | 9.9 days | 8 - 12 days |

---

## Risk Controls

### Position-Level Controls:
- **Stop Loss:** -15% per position (trailing)
- **Take Profit:** +30% per position (optional)
- **Max Position Size:** 20% (safety limit)
- **Min Liquidity:** $1M daily volume

### Portfolio-Level Controls:
- **Max Drawdown:** Stop all trading if portfolio DD > 20%
- **Win Rate Alert:** Review strategy if win rate < 50% over 30 days
- **Correlation Check:** Avoid selecting highly correlated sectors (>0.7)
- **Sector Exposure Limit:** Max 60% in any single sector

### Execution Controls:
- **Limit Orders:** Always use limit orders (0.1% from market)
- **Pre-Market Check:** Only trade during regular hours (9:30 AM - 4:00 PM ET)
- **Gap Protection:** Don't rotate on gap days (>2% overnight move in SPY)
- **Earnings Avoidance:** Don't hold stocks through earnings

---

## Monitoring Dashboard

### Daily Metrics:
- [ ] Current sector allocation
- [ ] Portfolio value & P&L
- [ ] Days until next rotation
- [ ] Current Sharpe ratio (rolling 30-day)
- [ ] Max drawdown from peak

### Weekly Review:
- [ ] Win rate (last 10 trades)
- [ ] Sector performance ranking
- [ ] Correlation matrix (top sectors)
- [ ] Transaction cost analysis

### Monthly Analysis:
- [ ] Compare to backtest expectations
- [ ] Regime detection (bull/bear/neutral)
- [ ] Sector rotation heatmap
- [ ] Alpha vs SPY benchmark

---

## Integration with OMAR Algorithm

### Recommended Allocation:
- **60%** - Sector Rotation Strategy (this strategy)
- **40%** - OMAR Tactical Stock Picking

### Coordination:
1. Run sector rotation on **even weeks** (weeks 2, 4, 6, etc.)
2. Run OMAR stock picking on **odd weeks** (weeks 1, 3, 5, etc.)
3. Share liquidity pool to avoid over-allocation
4. Cross-check positions to avoid overlap

### Example Portfolio (60/40 split):
```
Total Capital: $100,000

Sector Rotation ($60,000):
  - XLK: AAPL ($10k), MSFT ($10k), NVDA ($10k)
  - XLY: AMZN ($10k), TSLA ($10k), HD ($10k)

OMAR Tactical ($40,000):
  - Individual picks based on OMAR signals
```

---

## Deployment Checklist

### Pre-Production:
- [ ] Backtest on additional historical periods
- [ ] Paper trade for 30 days
- [ ] Verify transaction cost assumptions
- [ ] Test in simulated crash scenario
- [ ] Review with risk committee

### Production Launch:
- [ ] Start with 10% of target allocation
- [ ] Monitor for 2 weeks
- [ ] Scale to 25% if metrics align
- [ ] Scale to 50% after 1 month
- [ ] Scale to 100% after 2 months

### Post-Launch:
- [ ] Daily P&L reconciliation
- [ ] Weekly performance vs backtest
- [ ] Monthly strategy review
- [ ] Quarterly optimization update

---

## Troubleshooting

### If Sharpe < 1.0 for 30 days:
1. Check if market regime has changed
2. Verify scoring algorithm is working correctly
3. Review transaction costs (may be higher than expected)
4. Consider switching to monthly rotation temporarily

### If Max Drawdown > 20%:
1. Immediately pause new rotations
2. Hold current positions
3. Wait for drawdown to recover to <15%
4. Reduce allocation by 50%

### If Win Rate < 50% for 20 trades:
1. Analyze losing trades for patterns
2. Check if whipsaw conditions (choppy market)
3. Consider increasing rotation frequency to weekly
4. Review stock selection within sectors

---

## Success Criteria

**Month 1 (Paper Trading):**
- Sharpe > 0.8
- Max Drawdown < 20%
- Win Rate > 48%

**Month 2-3 (10-25% Allocation):**
- Sharpe > 1.0
- Max Drawdown < 18%
- Win Rate > 50%

**Month 4+ (Full Allocation):**
- Sharpe > 1.2
- Max Drawdown < 16%
- Win Rate > 52%

---

## Contact & Support

For questions or issues:
- Review backtest report: `/home/runner/workspace/SECTOR_ROTATION_OPTIMIZATION_REPORT.md`
- Run optimizer: `npx tsx scripts/omar-sector-rotation-optimizer.ts`
- Check OMAR hyperoptimizer: `scripts/omar-hyperoptimizer.ts`

---

**Last Updated:** December 22, 2025
**Version:** 1.0
**Status:** Ready for Paper Trading
