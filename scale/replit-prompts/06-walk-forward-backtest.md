# Replit Prompt: Walk-Forward Backtesting Implementation

## OBJECTIVE
Implement walk-forward optimization and out-of-sample validation to detect overfitting in trading strategies, providing more realistic performance estimates.

## FILES TO CREATE/MODIFY

### New Files:
- `/server/backtest/walk-forward-engine.ts` - Walk-forward optimization engine
- `/server/backtest/overfitting-detector.ts` - Overfitting detection utilities

### Files to Modify:
- `/server/backtest/backtest-runner.ts` - Integrate walk-forward option
- `/shared/schema.ts` - Add walk-forward result types (if needed)

## IMPLEMENTATION DETAILS

### Step 1: Create Walk-Forward Engine

Create `/server/backtest/walk-forward-engine.ts`:

```typescript
export interface WalkForwardConfig {
  // Total date range
  startDate: Date;
  endDate: Date;

  // Window configuration
  inSampleDays: number; // Training window (e.g., 252 trading days = 1 year)
  outOfSampleDays: number; // Validation window (e.g., 63 trading days = 1 quarter)
  stepDays: number; // How far to roll forward (e.g., 21 trading days = 1 month)

  // Optimization settings
  parameterRanges: ParameterRange[];
  optimizationMetric: 'sharpe' | 'sortino' | 'calmar' | 'returns' | 'profitFactor';
  minTrades: number; // Minimum trades required for valid window
}

export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface WindowResult {
  windowIndex: number;

  // Date ranges
  inSampleStart: Date;
  inSampleEnd: Date;
  outOfSampleStart: Date;
  outOfSampleEnd: Date;

  // Optimal parameters from in-sample
  optimizedParams: Record<string, number>;

  // In-sample performance
  inSampleMetrics: PerformanceMetrics;

  // Out-of-sample performance (forward test)
  outOfSampleMetrics: PerformanceMetrics;

  // Degradation analysis
  performanceDegradation: number; // % drop from IS to OOS
  parameterStability: number; // 0-1, how similar to previous window
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  avgTradeDuration: number;
}

export interface WalkForwardResult {
  config: WalkForwardConfig;
  windows: WindowResult[];

  // Aggregated out-of-sample performance
  aggregateOOS: PerformanceMetrics;

  // Overfitting indicators
  overfittingScore: number; // 0-1, higher = more overfitting
  robustnessScore: number; // 0-1, higher = more robust
  parameterStabilityScore: number; // 0-1, higher = more stable

  // Recommendations
  isOverfit: boolean;
  recommendations: string[];
}

class WalkForwardEngine {
  private backtestRunner: any; // Your existing backtest runner

  constructor(backtestRunner: any) {
    this.backtestRunner = backtestRunner;
  }

  async runWalkForward(
    strategyType: string,
    symbols: string[],
    config: WalkForwardConfig
  ): Promise<WalkForwardResult> {
    console.log('[WalkForward] Starting walk-forward optimization...');
    console.log(`[WalkForward] IS: ${config.inSampleDays}d, OOS: ${config.outOfSampleDays}d, Step: ${config.stepDays}d`);

    const windows = this.generateWindows(config);
    console.log(`[WalkForward] Generated ${windows.length} windows`);

    const windowResults: WindowResult[] = [];
    let previousParams: Record<string, number> | null = null;

    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];
      console.log(`[WalkForward] Processing window ${i + 1}/${windows.length}`);

      // Step 1: Optimize on in-sample period
      const optimizedParams = await this.optimizeParameters(
        strategyType,
        symbols,
        window.inSampleStart,
        window.inSampleEnd,
        config
      );

      // Step 2: Get in-sample performance with optimized params
      const inSampleMetrics = await this.runBacktest(
        strategyType,
        symbols,
        window.inSampleStart,
        window.inSampleEnd,
        optimizedParams
      );

      // Step 3: Test on out-of-sample period (forward test)
      const outOfSampleMetrics = await this.runBacktest(
        strategyType,
        symbols,
        window.outOfSampleStart,
        window.outOfSampleEnd,
        optimizedParams
      );

      // Calculate degradation
      const performanceDegradation = this.calculateDegradation(
        inSampleMetrics,
        outOfSampleMetrics,
        config.optimizationMetric
      );

      // Calculate parameter stability
      const parameterStability = previousParams
        ? this.calculateParameterStability(previousParams, optimizedParams, config.parameterRanges)
        : 1.0;

      windowResults.push({
        windowIndex: i,
        inSampleStart: window.inSampleStart,
        inSampleEnd: window.inSampleEnd,
        outOfSampleStart: window.outOfSampleStart,
        outOfSampleEnd: window.outOfSampleEnd,
        optimizedParams,
        inSampleMetrics,
        outOfSampleMetrics,
        performanceDegradation,
        parameterStability
      });

      previousParams = optimizedParams;
    }

    // Aggregate results
    const aggregateOOS = this.aggregateMetrics(windowResults.map(w => w.outOfSampleMetrics));
    const aggregateIS = this.aggregateMetrics(windowResults.map(w => w.inSampleMetrics));

    // Calculate scores
    const overfittingScore = this.calculateOverfittingScore(windowResults, aggregateIS, aggregateOOS);
    const robustnessScore = this.calculateRobustnessScore(windowResults);
    const parameterStabilityScore = this.calculateParamStabilityScore(windowResults);

    // Generate recommendations
    const { isOverfit, recommendations } = this.generateRecommendations(
      overfittingScore,
      robustnessScore,
      parameterStabilityScore,
      windowResults
    );

    return {
      config,
      windows: windowResults,
      aggregateOOS,
      overfittingScore,
      robustnessScore,
      parameterStabilityScore,
      isOverfit,
      recommendations
    };
  }

  private generateWindows(config: WalkForwardConfig): Array<{
    inSampleStart: Date;
    inSampleEnd: Date;
    outOfSampleStart: Date;
    outOfSampleEnd: Date;
  }> {
    const windows = [];
    const totalDays = Math.floor(
      (config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const windowSize = config.inSampleDays + config.outOfSampleDays;
    let currentStart = 0;

    while (currentStart + windowSize <= totalDays) {
      const inSampleStart = new Date(config.startDate);
      inSampleStart.setDate(inSampleStart.getDate() + currentStart);

      const inSampleEnd = new Date(inSampleStart);
      inSampleEnd.setDate(inSampleEnd.getDate() + config.inSampleDays);

      const outOfSampleStart = new Date(inSampleEnd);
      const outOfSampleEnd = new Date(outOfSampleStart);
      outOfSampleEnd.setDate(outOfSampleEnd.getDate() + config.outOfSampleDays);

      windows.push({
        inSampleStart,
        inSampleEnd,
        outOfSampleStart,
        outOfSampleEnd
      });

      currentStart += config.stepDays;
    }

    return windows;
  }

  private async optimizeParameters(
    strategyType: string,
    symbols: string[],
    startDate: Date,
    endDate: Date,
    config: WalkForwardConfig
  ): Promise<Record<string, number>> {
    // Grid search optimization
    const combinations = this.generateParameterCombinations(config.parameterRanges);
    let bestParams: Record<string, number> = {};
    let bestScore = -Infinity;

    for (const params of combinations) {
      const metrics = await this.runBacktest(strategyType, symbols, startDate, endDate, params);

      if (metrics.tradeCount < config.minTrades) continue;

      const score = this.getOptimizationScore(metrics, config.optimizationMetric);
      if (score > bestScore) {
        bestScore = score;
        bestParams = params;
      }
    }

    return bestParams;
  }

  private generateParameterCombinations(ranges: ParameterRange[]): Record<string, number>[] {
    if (ranges.length === 0) return [{}];

    const first = ranges[0];
    const rest = ranges.slice(1);
    const restCombinations = this.generateParameterCombinations(rest);
    const combinations: Record<string, number>[] = [];

    for (let value = first.min; value <= first.max; value += first.step) {
      for (const restCombo of restCombinations) {
        combinations.push({
          [first.name]: value,
          ...restCombo
        });
      }
    }

    return combinations;
  }

  private async runBacktest(
    strategyType: string,
    symbols: string[],
    startDate: Date,
    endDate: Date,
    params: Record<string, number>
  ): Promise<PerformanceMetrics> {
    // Call your existing backtest runner
    const result = await this.backtestRunner.run({
      strategyType,
      symbols,
      startDate,
      endDate,
      parameters: params
    });

    return {
      totalReturn: result.totalReturn,
      annualizedReturn: result.annualizedReturn,
      sharpeRatio: result.sharpeRatio,
      sortinoRatio: result.sortinoRatio || 0,
      calmarRatio: result.calmarRatio || 0,
      maxDrawdown: result.maxDrawdown,
      winRate: result.winRate,
      profitFactor: result.profitFactor,
      tradeCount: result.tradeCount,
      avgTradeDuration: result.avgTradeDuration || 0
    };
  }

  private getOptimizationScore(metrics: PerformanceMetrics, metric: string): number {
    switch (metric) {
      case 'sharpe': return metrics.sharpeRatio;
      case 'sortino': return metrics.sortinoRatio;
      case 'calmar': return metrics.calmarRatio;
      case 'returns': return metrics.annualizedReturn;
      case 'profitFactor': return metrics.profitFactor;
      default: return metrics.sharpeRatio;
    }
  }

  private calculateDegradation(is: PerformanceMetrics, oos: PerformanceMetrics, metric: string): number {
    const isScore = this.getOptimizationScore(is, metric);
    const oosScore = this.getOptimizationScore(oos, metric);

    if (isScore === 0) return 0;
    return ((isScore - oosScore) / Math.abs(isScore)) * 100;
  }

  private calculateParameterStability(
    prev: Record<string, number>,
    curr: Record<string, number>,
    ranges: ParameterRange[]
  ): number {
    let totalDiff = 0;
    let totalRange = 0;

    for (const range of ranges) {
      const prevVal = prev[range.name] || 0;
      const currVal = curr[range.name] || 0;
      const rangeSize = range.max - range.min;

      totalDiff += Math.abs(prevVal - currVal) / rangeSize;
      totalRange += 1;
    }

    return 1 - (totalDiff / totalRange);
  }

  private aggregateMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    const n = metrics.length;
    return {
      totalReturn: metrics.reduce((s, m) => s + m.totalReturn, 0) / n,
      annualizedReturn: metrics.reduce((s, m) => s + m.annualizedReturn, 0) / n,
      sharpeRatio: metrics.reduce((s, m) => s + m.sharpeRatio, 0) / n,
      sortinoRatio: metrics.reduce((s, m) => s + m.sortinoRatio, 0) / n,
      calmarRatio: metrics.reduce((s, m) => s + m.calmarRatio, 0) / n,
      maxDrawdown: Math.max(...metrics.map(m => m.maxDrawdown)),
      winRate: metrics.reduce((s, m) => s + m.winRate, 0) / n,
      profitFactor: metrics.reduce((s, m) => s + m.profitFactor, 0) / n,
      tradeCount: metrics.reduce((s, m) => s + m.tradeCount, 0),
      avgTradeDuration: metrics.reduce((s, m) => s + m.avgTradeDuration, 0) / n
    };
  }

  private calculateOverfittingScore(
    windows: WindowResult[],
    aggIS: PerformanceMetrics,
    aggOOS: PerformanceMetrics
  ): number {
    // Average degradation across windows
    const avgDegradation = windows.reduce((s, w) => s + w.performanceDegradation, 0) / windows.length;

    // Normalize: 0% degradation = 0 score, 100% degradation = 1 score
    let score = Math.min(1, Math.max(0, avgDegradation / 100));

    // Penalize if OOS Sharpe is negative when IS Sharpe is positive
    if (aggIS.sharpeRatio > 0.5 && aggOOS.sharpeRatio < 0) {
      score = Math.min(1, score + 0.3);
    }

    return score;
  }

  private calculateRobustnessScore(windows: WindowResult[]): number {
    // Count profitable OOS windows
    const profitableWindows = windows.filter(w => w.outOfSampleMetrics.totalReturn > 0);
    const profitableRatio = profitableWindows.length / windows.length;

    // Check consistency of Sharpe ratios
    const oosharpes = windows.map(w => w.outOfSampleMetrics.sharpeRatio);
    const avgSharpe = oosharpes.reduce((a, b) => a + b, 0) / oosharpes.length;
    const sharpeStdDev = Math.sqrt(
      oosharpes.reduce((s, v) => s + Math.pow(v - avgSharpe, 2), 0) / oosharpes.length
    );

    // Lower std dev = higher consistency
    const consistencyScore = Math.max(0, 1 - (sharpeStdDev / 2));

    return (profitableRatio * 0.6) + (consistencyScore * 0.4);
  }

  private calculateParamStabilityScore(windows: WindowResult[]): number {
    if (windows.length < 2) return 1;

    const stabilities = windows.slice(1).map(w => w.parameterStability);
    return stabilities.reduce((a, b) => a + b, 0) / stabilities.length;
  }

  private generateRecommendations(
    overfitting: number,
    robustness: number,
    paramStability: number,
    windows: WindowResult[]
  ): { isOverfit: boolean; recommendations: string[] } {
    const recommendations: string[] = [];

    const isOverfit = overfitting > 0.4 || robustness < 0.5;

    if (overfitting > 0.6) {
      recommendations.push('HIGH OVERFITTING: Reduce parameter complexity or add regularization');
    } else if (overfitting > 0.4) {
      recommendations.push('MODERATE OVERFITTING: Consider simpler strategy rules');
    }

    if (robustness < 0.4) {
      recommendations.push('LOW ROBUSTNESS: Strategy may not work in live trading');
    }

    if (paramStability < 0.6) {
      recommendations.push('UNSTABLE PARAMETERS: Optimal params change significantly between periods');
      recommendations.push('Consider using parameter averaging or ensemble approach');
    }

    // Check for negative OOS performance
    const negativeWindows = windows.filter(w => w.outOfSampleMetrics.sharpeRatio < 0);
    if (negativeWindows.length > windows.length * 0.3) {
      recommendations.push(`WARNING: ${negativeWindows.length}/${windows.length} windows had negative OOS Sharpe`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Strategy appears robust with acceptable overfitting levels');
    }

    return { isOverfit, recommendations };
  }
}

export const walkForwardEngine = new WalkForwardEngine(null); // Pass your backtest runner
```

### Step 2: Create Overfitting Detector

Create `/server/backtest/overfitting-detector.ts`:

```typescript
export interface OverfittingAnalysis {
  degreeOfFreedom: number; // # of parameters
  dataPoints: number; // # of trades/observations
  dofRatio: number; // data points per parameter
  isSuspicious: boolean;
  warnings: string[];
}

export function analyzeOverfittingRisk(
  parameterCount: number,
  tradeCount: number,
  inSampleSharpe: number,
  outOfSampleSharpe: number
): OverfittingAnalysis {
  const warnings: string[] = [];

  // Rule of thumb: need 30+ trades per parameter
  const dofRatio = tradeCount / parameterCount;

  if (dofRatio < 30) {
    warnings.push(`Low DOF ratio: ${dofRatio.toFixed(1)} (recommend 30+)`);
  }

  // Sharpe degradation
  if (inSampleSharpe > 0) {
    const sharpeDegradation = (inSampleSharpe - outOfSampleSharpe) / inSampleSharpe;
    if (sharpeDegradation > 0.5) {
      warnings.push(`High Sharpe degradation: ${(sharpeDegradation * 100).toFixed(0)}%`);
    }
  }

  // Suspiciously high in-sample performance
  if (inSampleSharpe > 3) {
    warnings.push(`In-sample Sharpe of ${inSampleSharpe.toFixed(2)} is suspiciously high`);
  }

  return {
    degreeOfFreedom: parameterCount,
    dataPoints: tradeCount,
    dofRatio,
    isSuspicious: warnings.length >= 2 || dofRatio < 20,
    warnings
  };
}
```

## ACCEPTANCE CRITERIA

- [ ] Walk-forward engine created with rolling window logic
- [ ] Parameter optimization within each in-sample window
- [ ] Out-of-sample validation on held-out data
- [ ] Overfitting score calculation (0-1)
- [ ] Robustness score calculation (0-1)
- [ ] Parameter stability tracking across windows
- [ ] Recommendation generation
- [ ] Overfitting detector utilities
- [ ] Integration with existing backtest runner
- [ ] TypeScript compilation succeeds

## VERIFICATION COMMANDS

```bash
# Check files created
ls -la server/backtest/walk-forward-engine.ts
ls -la server/backtest/overfitting-detector.ts

# Verify TypeScript
npx tsc --noEmit

# Run walk-forward test
npm test -- --grep "walk-forward"

# API endpoint test
curl -X POST http://localhost:5000/api/backtest/walk-forward \
  -H "Content-Type: application/json" \
  -d '{"strategyType":"momentum","symbols":["AAPL"],"inSampleDays":252,"outOfSampleDays":63}'
```

## ESTIMATED IMPACT

- **New lines**: ~500
- **Files affected**: 4
- **Risk level**: Low (new feature, doesn't break existing)
- **Testing required**: Extensive with historical data
- **Performance improvement**: More realistic strategy expectations
