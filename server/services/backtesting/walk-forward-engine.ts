import { runBacktest, type RunBacktestParams } from './backtest-runner';
import type { BacktestResultsSummary } from '../../../shared/types/backtesting';
import { log } from '../../utils/logger';

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

export class WalkForwardEngine {
  async runWalkForward(
    strategyType: string,
    symbols: string[],
    baseParams: Omit<RunBacktestParams, 'startDate' | 'endDate' | 'strategyParams'>,
    config: WalkForwardConfig
  ): Promise<WalkForwardResult> {
    log.info('WalkForward', `Starting walk-forward optimization...`);
    log.info('WalkForward', `IS: ${config.inSampleDays}d, OOS: ${config.outOfSampleDays}d, Step: ${config.stepDays}d`);

    const windows = this.generateWindows(config);
    log.info('WalkForward', `Generated ${windows.length} windows`);

    const windowResults: WindowResult[] = [];
    let previousParams: Record<string, number> | null = null;

    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];
      log.info('WalkForward', `Processing window ${i + 1}/${windows.length}`);

      // Step 1: Optimize on in-sample period
      const optimizedParams = await this.optimizeParameters(
        symbols,
        baseParams,
        window.inSampleStart,
        window.inSampleEnd,
        config
      );

      log.info('WalkForward', `Optimized params for window ${i + 1}: ${JSON.stringify(optimizedParams)}`);

      // Step 2: Get in-sample performance with optimized params
      const inSampleMetrics = await this.runBacktest(
        symbols,
        baseParams,
        window.inSampleStart,
        window.inSampleEnd,
        optimizedParams
      );

      // Step 3: Test on out-of-sample period (forward test)
      const outOfSampleMetrics = await this.runBacktest(
        symbols,
        baseParams,
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

      log.info('WalkForward',
        `Window ${i + 1}: IS ${this.getOptimizationScore(inSampleMetrics, config.optimizationMetric).toFixed(2)} ` +
        `-> OOS ${this.getOptimizationScore(outOfSampleMetrics, config.optimizationMetric).toFixed(2)} ` +
        `(degradation: ${performanceDegradation.toFixed(1)}%)`
      );

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

    log.info('WalkForward',
      `Analysis complete - Overfitting: ${(overfittingScore * 100).toFixed(1)}%, ` +
      `Robustness: ${(robustnessScore * 100).toFixed(1)}%, ` +
      `Param Stability: ${(parameterStabilityScore * 100).toFixed(1)}%`
    );

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
    symbols: string[],
    baseParams: Omit<RunBacktestParams, 'startDate' | 'endDate' | 'strategyParams'>,
    startDate: Date,
    endDate: Date,
    config: WalkForwardConfig
  ): Promise<Record<string, number>> {
    // Grid search optimization
    const combinations = this.generateParameterCombinations(config.parameterRanges);
    let bestParams: Record<string, number> = {};
    let bestScore = -Infinity;

    log.info('WalkForward', `Testing ${combinations.length} parameter combinations...`);

    for (const params of combinations) {
      const metrics = await this.runBacktest(symbols, baseParams, startDate, endDate, params);

      if (metrics.tradeCount < config.minTrades) continue;

      const score = this.getOptimizationScore(metrics, config.optimizationMetric);
      if (score > bestScore) {
        bestScore = score;
        bestParams = params;
      }
    }

    if (Object.keys(bestParams).length === 0) {
      log.warn('WalkForward', 'No valid parameter combination found, using first combination');
      bestParams = combinations[0] || {};
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
    symbols: string[],
    baseParams: Omit<RunBacktestParams, 'startDate' | 'endDate' | 'strategyParams'>,
    startDate: Date,
    endDate: Date,
    params: Record<string, number>
  ): Promise<PerformanceMetrics> {
    const backtestParams: RunBacktestParams = {
      ...baseParams,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      universe: symbols,
      strategyParams: params
    };

    try {
      const result = await runBacktest(backtestParams);

      if (!result.resultsSummary) {
        return this.createEmptyMetrics();
      }

      const summary = result.resultsSummary;

      return {
        totalReturn: summary.totalReturnPct,
        annualizedReturn: summary.cagr || 0,
        sharpeRatio: summary.sharpeRatio || 0,
        sortinoRatio: summary.sortinoRatio || 0,
        calmarRatio: summary.calmarRatio || 0,
        maxDrawdown: summary.maxDrawdownPct,
        winRate: summary.winRatePct,
        profitFactor: summary.profitFactor || 0,
        tradeCount: summary.totalTrades,
        avgTradeDuration: summary.avgHoldingPeriodDays || 0
      };
    } catch (error) {
      log.error('WalkForward', `Backtest failed: ${error instanceof Error ? error.message : String(error)}`);
      return this.createEmptyMetrics();
    }
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      profitFactor: 0,
      tradeCount: 0,
      avgTradeDuration: 0
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

      if (rangeSize > 0) {
        totalDiff += Math.abs(prevVal - currVal) / rangeSize;
        totalRange += 1;
      }
    }

    return totalRange > 0 ? 1 - (totalDiff / totalRange) : 1;
  }

  private aggregateMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    const n = metrics.length;
    if (n === 0) return this.createEmptyMetrics();

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
    if (windows.length === 0) return 0;

    // Count profitable OOS windows
    const profitableWindows = windows.filter(w => w.outOfSampleMetrics.totalReturn > 0);
    const profitableRatio = profitableWindows.length / windows.length;

    // Check consistency of Sharpe ratios
    const oosSharpes = windows.map(w => w.outOfSampleMetrics.sharpeRatio);
    const avgSharpe = oosSharpes.reduce((a, b) => a + b, 0) / oosSharpes.length;
    const sharpeStdDev = Math.sqrt(
      oosSharpes.reduce((s, v) => s + Math.pow(v - avgSharpe, 2), 0) / oosSharpes.length
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
    } else if (robustness < 0.6) {
      recommendations.push('MODERATE ROBUSTNESS: Exercise caution with live deployment');
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

    // Check for consistent underperformance
    const negativeReturns = windows.filter(w => w.outOfSampleMetrics.totalReturn < 0);
    if (negativeReturns.length > windows.length * 0.4) {
      recommendations.push(`WARNING: ${negativeReturns.length}/${windows.length} windows had negative OOS returns`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Strategy appears robust with acceptable overfitting levels');
      recommendations.push('Consider live paper trading before deploying with real capital');
    }

    return { isOverfit, recommendations };
  }
}

export const walkForwardEngine = new WalkForwardEngine();
