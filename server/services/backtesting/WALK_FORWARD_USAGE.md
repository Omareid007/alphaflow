# Walk-Forward Backtesting Usage Guide

## Overview

Walk-forward optimization is a powerful technique to detect overfitting in trading strategies by:
1. Splitting historical data into multiple rolling windows
2. Optimizing parameters on in-sample data
3. Validating performance on out-of-sample data
4. Comparing in-sample vs out-of-sample performance degradation

## Quick Start

```typescript
import { walkForwardEngine } from './server/services/backtesting';

// Define your walk-forward configuration
const config = {
  startDate: new Date('2023-01-01'),
  endDate: new Date('2024-12-31'),
  inSampleDays: 252,        // 1 year training window
  outOfSampleDays: 63,      // 1 quarter validation window
  stepDays: 21,             // Roll forward 1 month at a time

  // Parameters to optimize
  parameterRanges: [
    { name: 'fastPeriod', min: 5, max: 20, step: 5 },
    { name: 'slowPeriod', min: 20, max: 50, step: 10 },
    { name: 'allocationPct', min: 5, max: 20, step: 5 }
  ],

  optimizationMetric: 'sharpe',  // or 'sortino', 'calmar', 'returns', 'profitFactor'
  minTrades: 10                   // Minimum trades required per window
};

// Base backtest parameters (without strategyParams)
const baseParams = {
  strategyId: 'ma-crossover-v1',
  strategyConfig: { type: 'moving_average_crossover' },
  universe: ['AAPL', 'MSFT', 'GOOGL'],
  timeframe: '1Day',
  initialCash: 100000,
  feesModel: { type: 'fixed', value: 1 },
  slippageModel: { type: 'bps', value: 5 },
  executionPriceRule: 'NEXT_OPEN',
  strategyType: 'moving_average_crossover'
};

// Run walk-forward analysis
const result = await walkForwardEngine.runWalkForward(
  'moving_average_crossover',
  ['AAPL', 'MSFT', 'GOOGL'],
  baseParams,
  config
);

// Analyze results
console.log('Overfitting Score:', result.overfittingScore);
console.log('Robustness Score:', result.robustnessScore);
console.log('Parameter Stability:', result.parameterStabilityScore);
console.log('Is Overfit?', result.isOverfit);
console.log('Recommendations:', result.recommendations);

// Check individual windows
result.windows.forEach((window, i) => {
  console.log(`Window ${i + 1}:`);
  console.log('  Optimized Params:', window.optimizedParams);
  console.log('  In-Sample Sharpe:', window.inSampleMetrics.sharpeRatio);
  console.log('  Out-of-Sample Sharpe:', window.outOfSampleMetrics.sharpeRatio);
  console.log('  Degradation:', window.performanceDegradation + '%');
});
```

## Overfitting Detection Utilities

```typescript
import {
  analyzeOverfittingRisk,
  calculatePBO,
  calculateConsistencyScore,
  generateOverfittingReport
} from './server/services/backtesting';

// Analyze overfitting risk for a single backtest
const analysis = analyzeOverfittingRisk(
  3,      // Number of parameters
  150,    // Number of trades
  2.5,    // In-sample Sharpe
  1.2     // Out-of-sample Sharpe
);

console.log('DOF Ratio:', analysis.dofRatio);
console.log('Is Suspicious?', analysis.isSuspicious);
console.log('Warnings:', analysis.warnings);

// Calculate Probability of Backtest Overfitting (PBO)
const inSampleScores = [2.5, 2.3, 2.1, 1.9, 1.7];
const outOfSampleScores = [1.2, 1.5, 0.8, 1.1, 0.9];
const pbo = calculatePBO(inSampleScores, outOfSampleScores);
console.log('PBO:', pbo); // Higher = more likely overfit

// Calculate consistency across windows
const consistencyScore = calculateConsistencyScore(result.windows.map(w => w.outOfSampleMetrics));
console.log('Consistency Score:', consistencyScore);

// Generate comprehensive report
const report = generateOverfittingReport(
  3,                              // Parameter count
  result.aggregateOOS.tradeCount, // Total trades
  result.overfittingScore,
  result.robustnessScore,
  consistencyScore,
  50                              // Average degradation %
);
console.log(report);
```

## Understanding the Scores

### Overfitting Score (0-1)
- **0.0-0.3**: Low overfitting risk (good)
- **0.3-0.5**: Moderate overfitting (caution)
- **0.5-1.0**: High overfitting (do not deploy)

Calculated based on:
- Average performance degradation from in-sample to out-of-sample
- Whether in-sample profits become out-of-sample losses

### Robustness Score (0-1)
- **0.7-1.0**: Highly robust strategy (good)
- **0.5-0.7**: Moderately robust (acceptable)
- **0.0-0.5**: Fragile strategy (problematic)

Calculated based on:
- Percentage of profitable out-of-sample windows
- Consistency of Sharpe ratios across windows

### Parameter Stability Score (0-1)
- **0.7-1.0**: Stable parameters (good)
- **0.5-0.7**: Moderate stability (acceptable)
- **0.0-0.5**: Unstable parameters (problematic)

Calculated based on:
- How much optimal parameters change between adjacent windows
- Normalized by parameter ranges

## Best Practices

### 1. Window Sizing
- **In-sample**: At least 1 year (252 trading days) for daily strategies
- **Out-of-sample**: At least 1 quarter (63 trading days)
- **Step size**: 1 month (21 days) to balance computation and rolling coverage

### 2. Parameter Ranges
- Start with wide ranges to explore parameter space
- Use reasonable step sizes (too fine = overfitting, too coarse = missing optimal)
- Limit to 3-5 parameters maximum (DOF ratio!)

### 3. Minimum Trades
- Require at least 10-20 trades per window for statistical significance
- Higher is better for reliable metrics

### 4. Optimization Metric
- **Sharpe ratio**: Best for risk-adjusted returns
- **Sortino ratio**: If you care more about downside risk
- **Calmar ratio**: For strategies focused on drawdown control
- **Returns**: Only if risk is managed elsewhere
- **Profit factor**: Alternative risk-adjusted metric

### 5. Interpretation
A strategy should:
- Have overfitting score < 0.4
- Have robustness score > 0.5
- Have parameter stability > 0.6
- Show consistent positive OOS returns
- Not have severe performance degradation (< 50%)

If any of these fail, **DO NOT deploy to live trading**. Instead:
- Simplify the strategy (fewer parameters)
- Increase data requirements (more history, more symbols)
- Add constraints or regularization
- Consider ensemble approaches

## Common Pitfalls

### 1. Too Many Parameters
More parameters = more overfitting risk. Rule of thumb:
- Need 30+ trades per parameter
- Maximum 3-5 parameters for most strategies

### 2. Too Short Windows
Short windows don't capture market regime changes. Minimum recommendations:
- Daily strategies: 252 days in-sample, 63 days out-of-sample
- Intraday strategies: Adjust proportionally

### 3. Ignoring Warnings
If multiple windows show negative OOS performance, **stop**. Don't try to "fix" it by:
- Adjusting parameters manually
- Cherry-picking date ranges
- Adding more parameters

### 4. Curve Fitting on Walk-Forward Results
Don't use walk-forward results to further optimize. That defeats the purpose!
Walk-forward is the final validation step, not another optimization layer.

## Integration with API

Future enhancement: Add API endpoint for walk-forward analysis

```typescript
// POST /api/backtest/walk-forward
{
  "strategyType": "moving_average_crossover",
  "symbols": ["AAPL", "MSFT"],
  "startDate": "2023-01-01",
  "endDate": "2024-12-31",
  "inSampleDays": 252,
  "outOfSampleDays": 63,
  "stepDays": 21,
  "parameterRanges": [
    { "name": "fastPeriod", "min": 5, "max": 20, "step": 5 },
    { "name": "slowPeriod", "min": 20, "max": 50, "step": 10 }
  ],
  "optimizationMetric": "sharpe",
  "minTrades": 10
}
```

## References

- Bailey, D. H., Borwein, J., Lopez de Prado, M., & Zhu, Q. J. (2014). "The Probability of Backtest Overfitting"
- Pardo, R. (2008). "The Evaluation and Optimization of Trading Strategies"
- Aronson, D. (2006). "Evidence-Based Technical Analysis"
