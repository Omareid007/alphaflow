# OMAR Ultra Hyperoptimizer - Complete User Guide

## Executive Summary

The OMAR Ultra Hyperoptimizer is a sophisticated genetic algorithm-based trading strategy optimizer designed to:
- Run up to **50 million iterations** of parameter optimization
- Cover **200+ markets** including precious metals, commodities, equities, and ETFs
- Process **100,000+ parameter combinations** across 30+ years of data
- Continuously learn and improve through self-evaluation

---

## Table of Contents

1. [User Categories & Skill Levels](#user-categories--skill-levels)
2. [Minimal User Inputs](#minimal-user-inputs)
3. [Optimal Run Frequency](#optimal-run-frequency)
4. [How to Use the Algorithm](#how-to-use-the-algorithm)
5. [Market Coverage](#market-coverage)
6. [Continuous Learning Mode](#continuous-learning-mode)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## User Categories & Skill Levels

### Beginner (Blue Level)
**For new algorithmic traders with limited experience**

| Setting | Recommended Value | Why |
|---------|-------------------|-----|
| Risk Profile | Conservative (1-3) | Minimize drawdowns while learning |
| Market Focus | US Large Cap + ETFs | Most liquid, predictable markets |
| Run Frequency | Weekly only | Less parameter churn |
| Max Positions | 5-10 | Easier to monitor |
| Position Size | 2-4% per trade | Lower risk exposure |

**What You Control:**
- Capital amount
- Risk tolerance slider (1-10)
- ON/OFF toggle for auto-trading

**What's Automated:**
- All parameter optimization
- Entry/exit timing
- Position sizing
- Stop-loss placement

---

### Intermediate (Green Level)
**For traders with 1-2 years algorithmic trading experience**

| Setting | Recommended Value | Why |
|---------|-------------------|-----|
| Risk Profile | Moderate (4-6) | Balance risk/reward |
| Market Focus | US + Sectors + Some Metals | Diversification |
| Run Frequency | Weekly full + Daily incremental | Adapt to market changes |
| Max Positions | 10-20 | More diversification |
| Position Size | 4-8% per trade | Moderate exposure |

**What You Control:**
- All Beginner settings plus:
- Sector preferences (enable/disable specific sectors)
- Regime sensitivity (how quickly to adapt to market changes)
- Rebalancing frequency

**Additional Features:**
- View trade attribution reports
- Set custom alert thresholds
- Export performance data

---

### Advanced (Yellow Level)
**For experienced quant traders**

| Setting | Recommended Value | Why |
|---------|-------------------|-----|
| Risk Profile | Aggressive (7-10) | Maximize returns |
| Market Focus | Full Universe (200+ symbols) | Maximum opportunity |
| Run Frequency | Continuous background | Always adapting |
| Max Positions | 20-40 | Full diversification |
| Position Size | 5-15% per trade | Higher conviction trades |

**What You Control:**
- All Intermediate settings plus:
- Individual signal weights (technical, momentum, sentiment)
- Indicator parameters (RSI periods, MACD settings)
- Custom stop/target multipliers
- Regime filter toggles

**Additional Features:**
- Custom fitness function weights
- Multi-regime strategy profiles
- Out-of-sample validation periods
- Parameter sensitivity analysis

---

### Expert (Red Level)
**For quantitative researchers and fund managers**

| Setting | Recommended Value | Why |
|---------|-------------------|-----|
| Risk Profile | Custom | Full control |
| Market Focus | Custom universe | Strategy-specific |
| Run Frequency | Custom schedules | Research-driven |
| Max Positions | Dynamic | Risk-based sizing |
| Position Size | Dynamic (risk parity) | Portfolio optimization |

**What You Control:**
- Direct genome editing
- Custom objective functions
- Walk-forward validation schedules
- Ensemble strategy construction
- API integration for execution

**Additional Features:**
- Raw backtest data export
- Custom indicator development
- Strategy combination tools
- Monte Carlo simulation
- Regime prediction models

---

## Minimal User Inputs

### Essential Inputs (ALL Users Must Provide)

```
1. CAPITAL AMOUNT
   ├── Minimum: $1,000
   ├── Recommended: $10,000+
   └── Maximum: No limit (scale-adjusted)

2. RISK TOLERANCE (1-10 Scale)
   ├── 1-3: Conservative
   │       └── Max drawdown target: 10%
   │       └── Win rate priority: High (55%+)
   │       └── Trade frequency: Lower
   ├── 4-6: Moderate
   │       └── Max drawdown target: 15%
   │       └── Balanced Sharpe optimization
   │       └── Trade frequency: Medium
   └── 7-10: Aggressive
           └── Max drawdown target: 25%
           └── Return maximization
           └── Trade frequency: Higher

3. TIME HORIZON
   ├── Short-term (Days to Weeks)
   │       └── Faster indicators
   │       └── Tighter stops
   │       └── Higher turnover
   ├── Medium-term (Weeks to Months)
   │       └── Balanced approach
   │       └── Moderate stops
   │       └── Medium turnover
   └── Long-term (Months to Years)
           └── Slower indicators
           └── Wider stops
           └── Lower turnover
```

### Optional Inputs

```
4. MARKET FOCUS (Optional)
   ├── All Markets (default)
   ├── US Only
   ├── Metals & Commodities Focus
   ├── Tech Sector Focus
   ├── Defensive (Healthcare, Utilities, Staples)
   └── Custom Selection

5. TRADING SCHEDULE (Optional)
   ├── Market Hours Only
   ├── Extended Hours
   └── 24/7 (for crypto-adjacent)
```

---

## Optimal Run Frequency

### Recommended Schedule by User Level

| User Level | Full Optimization | Incremental Update | Regime Check |
|------------|-------------------|-------------------|--------------|
| Beginner | Weekly (Sun) | None | None |
| Intermediate | Weekly (Sun) | Daily (6PM) | Every 4 hours |
| Advanced | 2x Weekly | Daily | Continuous |
| Expert | Custom | Custom | Continuous |

### Full Optimization
**When:** Weekends (market closed)
**Duration:** 2-8 hours depending on iterations
**Purpose:** Deep parameter search across all dimensions

```
Recommended Settings:
- Iterations: 10,000 - 100,000
- Population: 100-500
- Islands: 5-10
- Convergence threshold: 0.001
```

### Incremental Update
**When:** Daily after market close
**Duration:** 15-30 minutes
**Purpose:** Fine-tune existing parameters based on recent market action

```
Recommended Settings:
- Iterations: 1,000 - 5,000
- Use current best as seed
- Lower mutation rate (0.05-0.10)
- Focus on recent data (30-60 days)
```

### Regime Check
**When:** Every 4 hours during market hours
**Duration:** 1-2 minutes
**Purpose:** Detect market condition changes and adjust risk parameters

```
Triggers Re-optimization When:
- VIX changes >20% in 4 hours
- SPY moves >2% from open
- Major economic announcement
- Sector rotation signal
```

### Continuous Mode (24/7)
**For:** Advanced and Expert users
**What it does:**
1. Runs low-intensity optimization in background
2. Accumulates knowledge over time
3. Auto-adapts to regime changes
4. Stores insights for future optimization seeds

```
Background Process:
- CPU Usage: 5-10% (throttled)
- Iterations per hour: 500-1,000
- Auto-checkpoint every 1,000 iterations
- Saves best configurations to database
```

---

## How to Use the Algorithm

### Getting Started (5-Minute Setup)

```bash
# Step 1: Set API credentials
export ALPACA_API_KEY="your_key_here"
export ALPACA_SECRET_KEY="your_secret_here"

# Step 2: Run the optimizer
npx tsx scripts/omar-ultra-hyperoptimizer.ts

# Step 3: Review results and apply
# Best configuration is saved automatically
```

### Configuration File (config.json)

```json
{
  "user": {
    "capital": 100000,
    "riskTolerance": 5,
    "timeHorizon": "medium"
  },
  "optimization": {
    "iterations": 50000,
    "populationSize": 200,
    "islands": 10
  },
  "markets": {
    "includeMetals": true,
    "includeCommodities": true,
    "includeInternational": false
  },
  "schedule": {
    "fullOptimization": "weekly",
    "incrementalUpdate": "daily",
    "regimeCheck": "4hours"
  }
}
```

### Interpreting Results

**Key Metrics to Monitor:**

| Metric | Excellent | Good | Acceptable | Poor |
|--------|-----------|------|------------|------|
| Sharpe Ratio | >2.0 | 1.5-2.0 | 1.0-1.5 | <1.0 |
| Sortino Ratio | >3.0 | 2.0-3.0 | 1.5-2.0 | <1.5 |
| Calmar Ratio | >2.0 | 1.5-2.0 | 1.0-1.5 | <1.0 |
| Win Rate | >55% | 50-55% | 45-50% | <45% |
| Max Drawdown | <10% | 10-15% | 15-20% | >20% |
| Profit Factor | >2.0 | 1.5-2.0 | 1.2-1.5 | <1.2 |

**Verdict Classifications:**
- **EXCELLENT**: Deploy immediately, high confidence
- **GOOD**: Deploy with monitoring, moderate confidence
- **ACCEPTABLE**: Use cautiously, consider paper trading first
- **POOR**: Do not deploy, needs more optimization
- **SUSPICIOUS**: May be overfitted, validate with out-of-sample data

---

## Market Coverage

### 200+ Market Universe

#### Precious Metals ETFs (10)
```
GLD  - Gold Trust
IAU  - iShares Gold
SLV  - Silver Trust
PPLT - Platinum ETF
PALL - Palladium ETF
SGOL - Aberdeen Gold
SIVR - Aberdeen Silver
OUNZ - VanEck Gold
GLDM - Gold MiniShares
BAR  - GraniteShares Gold
```

#### Metal Mining Stocks (28)
```
Major Gold Miners: NEM, GOLD, AEM, WPM, FNV, RGLD, KGC, AU
Silver Miners: AG, PAAS, HL, CDE, EXK, MAG, SVM
Copper/Base: FCX, SCCO, TECK, RIO, BHP, VALE
Steel: NUE, STLD, CLF, X, MT
Aluminum: AA, CENX
```

#### Energy Commodities (23)
```
ETFs: USO, BNO, UNG, BOIL, UCO, XLE, VDE, OIH, XOP
Stocks: XOM, CVX, COP, SLB, EOG, MPC, PSX, VLO, OXY, DVN, HAL, BKR, FANG, PXD
```

#### Agriculture (18)
```
ETFs: DBA, CORN, WEAT, SOYB, COW, NIB, JO, SGG, BAL, MOO, VEGI
Stocks: ADM, BG, DE, CTVA, NTR, MOS, CF
```

#### US Large Cap (50)
```
Tech: AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA
Finance: JPM, BAC, GS, MS, V, MA
Healthcare: UNH, JNJ, LLY, ABBV, MRK, PFE
Consumer: WMT, KO, PG, MCD, NKE, DIS
[Full list in market universe]
```

#### Sector ETFs (21)
```
SPDR: XLF, XLK, XLE, XLV, XLI, XLP, XLY, XLB, XLU, XLRE, XLC
Vanguard: VGT, VHT, VFH, VCR, VDC, VIS, VAW, VPU, VOX, VNQ
```

#### Bonds (14)
```
Treasury: TLT, IEF, SHY
Corporate: LQD, VCSH, VCIT
High Yield: HYG, JNK
Municipal: MUB
International: EMB, BNDX
Aggregate: BND, AGG
```

#### International (19)
```
Developed: EFA, VEU, IEFA, EWJ, EWG, EWU, EWC, EWA, EWH
Emerging: EEM, VWO, IEMG, FXI, EWZ, EWY, INDA, EWT, EWS
```

---

## Continuous Learning Mode

### How Self-Improvement Works

```
┌─────────────────────────────────────────────────────────────┐
│                  CONTINUOUS LEARNING CYCLE                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. EVALUATE                                                │
│     └── Run backtest on current parameters                  │
│     └── Judge system scores performance                     │
│     └── Detect overfitting risk                             │
│                                                             │
│  2. LEARN                                                   │
│     └── Pattern mining identifies what works                │
│     └── Regime analyzer tracks market conditions            │
│     └── Store successful configurations                     │
│                                                             │
│  3. ADAPT                                                   │
│     └── Adjust mutation rates based on convergence          │
│     └── Inject diversity when stagnating                    │
│     └── Narrow search space around best clusters            │
│                                                             │
│  4. REMEMBER                                                │
│     └── Save knowledge to database                          │
│     └── Build regime-specific strategies                    │
│     └── Seed future optimizations with best configs         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Knowledge Persistence

The system stores:
1. **Best Configurations** - Top 1,000 parameter sets with full metrics
2. **Regime Knowledge** - Optimal strategies for each market condition
3. **Pattern Insights** - Discovered correlations and parameter interactions
4. **Evolution History** - Track improvement over generations

### Automatic Regime Adaptation

| Market Regime | Strategy Adjustment |
|---------------|-------------------|
| Strong Bull | Higher exposure, momentum focus, wider stops |
| Mild Bull | Balanced approach, trend following |
| Sideways | Mean reversion, tighter stops, lower positions |
| Volatile | Reduced size, defensive sectors, cash allocation |
| Bear | Minimal exposure, hedge positions, quality focus |

---

## Best Practices

### Do's

1. **Start with paper trading** - Validate for 30 days before live trading
2. **Use out-of-sample validation** - Reserve 20% of data for testing
3. **Monitor regime changes** - Market conditions affect strategy performance
4. **Reoptimize regularly** - Markets evolve, parameters should too
5. **Diversify across strategies** - Don't put all capital in one configuration
6. **Keep records** - Log all trades and decisions for analysis

### Don'ts

1. **Don't over-optimize** - Sharpe > 4 is usually overfitted
2. **Don't ignore drawdown** - Return without risk management is gambling
3. **Don't change settings mid-optimization** - Let it converge naturally
4. **Don't trade earnings/events** - Unless explicitly modeled
5. **Don't use leverage without understanding** - Magnifies losses too
6. **Don't deploy suspicious verdicts** - If the system warns, investigate

### Position Sizing Guide

| Capital Range | Recommended Position Size | Max Positions |
|--------------|--------------------------|---------------|
| $1K - $10K | 5-10% | 3-5 |
| $10K - $50K | 3-8% | 5-15 |
| $50K - $250K | 2-6% | 10-25 |
| $250K - $1M | 1-4% | 15-40 |
| $1M+ | 0.5-3% | 20-50 |

---

## Troubleshooting

### Common Issues

**Problem: Low trade count (<50 trades)**
```
Solution:
1. Lower buyThreshold (try 0.08-0.12)
2. Lower confidenceMin (try 0.20-0.25)
3. Increase symbol universe
4. Extend backtest period
```

**Problem: High drawdown (>25%)**
```
Solution:
1. Reduce maxPositionPct (try 3-5%)
2. Tighten atrMultStop (try 1.0-1.5)
3. Lower maxPositions
4. Add regime filter
```

**Problem: Overfitting suspected (Sharpe > 4)**
```
Solution:
1. Use walk-forward optimization
2. Increase minimum trade count requirement
3. Add complexity penalty to fitness
4. Test on out-of-sample data
```

**Problem: Stagnation (no improvement for 200+ generations)**
```
Solution:
1. Increase mutation rate temporarily
2. Inject diverse random genomes
3. Expand parameter search ranges
4. Try different island count
```

**Problem: Slow optimization speed**
```
Solution:
1. Reduce symbol universe
2. Lower population size
3. Increase batch size for parallel processing
4. Use SSD storage for data
```

---

## API Reference

### Running Optimization

```bash
# Basic run
npx tsx scripts/omar-ultra-hyperoptimizer.ts

# With custom iterations
ITERATIONS=100000 npx tsx scripts/omar-ultra-hyperoptimizer.ts

# With specific symbols
SYMBOLS="GLD,SLV,NEM,FCX" npx tsx scripts/omar-ultra-hyperoptimizer.ts
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| ALPACA_API_KEY | Alpaca API key | Required |
| ALPACA_SECRET_KEY | Alpaca secret | Required |
| ITERATIONS | Total iterations | 50,000,000 |
| POPULATION_SIZE | Genomes per generation | 500 |
| NUM_ISLANDS | Island count | 10 |
| YEARS_OF_DATA | Historical years | 30 |

---

## Support & Resources

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Full API reference in `/docs`
- **Community**: Discord/Slack channel for discussions

---

*Generated by OMAR Ultra Hyperoptimizer v2.0*
*Last Updated: 2025-12-22*
