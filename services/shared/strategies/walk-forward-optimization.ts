/**
 * AI Active Trader - Walk-Forward Optimization
 * Robust strategy validation through rolling in-sample/out-of-sample testing
 * 
 * Features:
 * - Rolling window optimization with configurable ratios
 * - Parameter grid search with parallel evaluation
 * - Anchored and rolling walk-forward modes
 * - Out-of-sample aggregation for realistic performance
 * - Optimization objective functions (Sharpe, Sortino, Calmar, etc.)
 * - Overfitting detection and robustness metrics
 */

import { createLogger } from '../common';
import type { StrategyDefinition, BacktestResult, StrategyContext } from './dsl-runtime';

const logger = createLogger('walk-forward-optimization');

export type OptimizationObjective = 
  | 'sharpe_ratio'
  | 'sortino_ratio'
  | 'calmar_ratio'
  | 'total_return'
  | 'profit_factor'
  | 'win_rate'
  | 'max_drawdown_inverse'
  | 'risk_adjusted_return'
  | 'expectancy';

export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step: number;
  type: 'int' | 'float';
}

export interface WalkForwardConfig {
  inSampleRatio: number;
  outOfSampleRatio: number;
  numWindows: number;
  mode: 'rolling' | 'anchored';
  objective: OptimizationObjective;
  parameterRanges: ParameterRange[];
  minTradesPerWindow: number;
  warmupBars: number;
  initialCapital: number;
  commissionPercent: number;
  slippagePercent: number;
  parallelOptimization: boolean;
  maxParameterCombinations: number;
}

export interface WindowResult {
  windowIndex: number;
  inSampleStart: Date;
  inSampleEnd: Date;
  outOfSampleStart: Date;
  outOfSampleEnd: Date;
  bestParameters: Record<string, number>;
  inSampleResult: BacktestResult;
  outOfSampleResult: BacktestResult;
  objectiveValue: number;
  parameterStability: number;
}

export interface WalkForwardResult {
  strategyId: string;
  config: WalkForwardConfig;
  windows: WindowResult[];
  aggregatedOutOfSample: {
    totalReturn: number;
    totalReturnPercent: number;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxDrawdownPercent: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    expectancy: number;
  };
  robustnessMetrics: {
    inSampleOutOfSampleCorrelation: number;
    parameterStability: number;
    overfitRatio: number;
    windowConsistency: number;
    degradation: number;
  };
  parameterEvolution: Array<{
    window: number;
    parameters: Record<string, number>;
  }>;
  startDate: Date;
  endDate: Date;
  totalBars: number;
  optimizationTimeMs: number;
}

export interface ParameterCombination {
  parameters: Record<string, number>;
  objectiveValue: number;
  result?: BacktestResult;
}

type BacktestFunction = (
  strategyId: string,
  bars: StrategyContext['bars'],
  parameters: Record<string, number>,
  options: { initialCapital: number; commissionPercent: number; slippagePercent: number }
) => Promise<BacktestResult>;

export class WalkForwardOptimizer {
  private config: WalkForwardConfig;
  private backtestFn: BacktestFunction;

  constructor(
    config: Partial<WalkForwardConfig>,
    backtestFn: BacktestFunction
  ) {
    this.config = {
      inSampleRatio: config.inSampleRatio ?? 0.7,
      outOfSampleRatio: config.outOfSampleRatio ?? 0.3,
      numWindows: config.numWindows ?? 5,
      mode: config.mode ?? 'rolling',
      objective: config.objective ?? 'sharpe_ratio',
      parameterRanges: config.parameterRanges ?? [],
      minTradesPerWindow: config.minTradesPerWindow ?? 10,
      warmupBars: config.warmupBars ?? 50,
      initialCapital: config.initialCapital ?? 100000,
      commissionPercent: config.commissionPercent ?? 0.001,
      slippagePercent: config.slippagePercent ?? 0.0005,
      parallelOptimization: config.parallelOptimization ?? true,
      maxParameterCombinations: config.maxParameterCombinations ?? 1000,
    };
    this.backtestFn = backtestFn;

    if (this.config.inSampleRatio + this.config.outOfSampleRatio !== 1) {
      throw new Error('inSampleRatio + outOfSampleRatio must equal 1');
    }
  }

  async optimize(
    strategyId: string,
    bars: StrategyContext['bars']
  ): Promise<WalkForwardResult> {
    const startTime = Date.now();
    
    logger.info('Starting walk-forward optimization', {
      strategyId,
      bars: bars.length,
      windows: this.config.numWindows,
      mode: this.config.mode,
      objective: this.config.objective,
    });

    const windows = this.calculateWindows(bars);
    const windowResults: WindowResult[] = [];
    const parameterEvolution: WalkForwardResult['parameterEvolution'] = [];

    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];
      
      logger.info(`Processing window ${i + 1}/${windows.length}`, {
        inSampleBars: window.inSampleBars.length,
        outOfSampleBars: window.outOfSampleBars.length,
      });

      const optimizationResult = await this.optimizeWindow(
        strategyId,
        window.inSampleBars,
        i
      );

      const outOfSampleResult = await this.backtestFn(
        strategyId,
        window.outOfSampleBars,
        optimizationResult.parameters,
        {
          initialCapital: this.config.initialCapital,
          commissionPercent: this.config.commissionPercent,
          slippagePercent: this.config.slippagePercent,
        }
      );

      const inSampleResult = optimizationResult.result!;

      const windowResult: WindowResult = {
        windowIndex: i,
        inSampleStart: window.inSampleBars[0].timestamp,
        inSampleEnd: window.inSampleBars[window.inSampleBars.length - 1].timestamp,
        outOfSampleStart: window.outOfSampleBars[0].timestamp,
        outOfSampleEnd: window.outOfSampleBars[window.outOfSampleBars.length - 1].timestamp,
        bestParameters: optimizationResult.parameters,
        inSampleResult,
        outOfSampleResult,
        objectiveValue: optimizationResult.objectiveValue,
        parameterStability: i > 0 
          ? this.calculateParameterStability(windowResults[i - 1].bestParameters, optimizationResult.parameters)
          : 1,
      };

      windowResults.push(windowResult);
      parameterEvolution.push({
        window: i,
        parameters: optimizationResult.parameters,
      });

      logger.info(`Window ${i + 1} complete`, {
        inSampleReturn: `${inSampleResult.totalReturnPercent.toFixed(2)}%`,
        outOfSampleReturn: `${outOfSampleResult.totalReturnPercent.toFixed(2)}%`,
        bestParams: optimizationResult.parameters,
      });
    }

    const aggregated = this.aggregateOutOfSample(windowResults);
    const robustness = this.calculateRobustnessMetrics(windowResults);

    const result: WalkForwardResult = {
      strategyId,
      config: this.config,
      windows: windowResults,
      aggregatedOutOfSample: aggregated,
      robustnessMetrics: robustness,
      parameterEvolution,
      startDate: bars[0].timestamp,
      endDate: bars[bars.length - 1].timestamp,
      totalBars: bars.length,
      optimizationTimeMs: Date.now() - startTime,
    };

    logger.info('Walk-forward optimization complete', {
      windows: windowResults.length,
      aggregatedReturn: `${aggregated.totalReturnPercent.toFixed(2)}%`,
      sharpeRatio: aggregated.sharpeRatio.toFixed(3),
      overfitRatio: robustness.overfitRatio.toFixed(3),
      timeMs: result.optimizationTimeMs,
    });

    return result;
  }

  private calculateWindows(bars: StrategyContext['bars']): Array<{
    inSampleBars: StrategyContext['bars'];
    outOfSampleBars: StrategyContext['bars'];
  }> {
    const windows: Array<{
      inSampleBars: StrategyContext['bars'];
      outOfSampleBars: StrategyContext['bars'];
    }> = [];

    const totalBars = bars.length - this.config.warmupBars;
    
    if (this.config.mode === 'rolling') {
      const windowSize = Math.floor(totalBars / this.config.numWindows);
      const inSampleSize = Math.floor(windowSize * this.config.inSampleRatio);
      const outOfSampleSize = windowSize - inSampleSize;

      for (let i = 0; i < this.config.numWindows; i++) {
        const windowStart = this.config.warmupBars + (i * windowSize);
        const inSampleEnd = windowStart + inSampleSize;
        const outOfSampleEnd = inSampleEnd + outOfSampleSize;

        if (outOfSampleEnd > bars.length) break;

        windows.push({
          inSampleBars: bars.slice(windowStart, inSampleEnd),
          outOfSampleBars: bars.slice(inSampleEnd, outOfSampleEnd),
        });
      }
    } else {
      const outOfSampleSize = Math.floor(
        (totalBars * this.config.outOfSampleRatio) / this.config.numWindows
      );

      for (let i = 0; i < this.config.numWindows; i++) {
        const outOfSampleStart = bars.length - ((this.config.numWindows - i) * outOfSampleSize);
        const outOfSampleEnd = outOfSampleStart + outOfSampleSize;

        if (outOfSampleStart <= this.config.warmupBars) break;

        windows.push({
          inSampleBars: bars.slice(this.config.warmupBars, outOfSampleStart),
          outOfSampleBars: bars.slice(outOfSampleStart, outOfSampleEnd),
        });
      }
    }

    return windows;
  }

  private async optimizeWindow(
    strategyId: string,
    inSampleBars: StrategyContext['bars'],
    windowIndex: number
  ): Promise<ParameterCombination> {
    const combinations = this.generateParameterCombinations();
    
    logger.debug(`Testing ${combinations.length} parameter combinations for window ${windowIndex}`);

    const results: ParameterCombination[] = [];

    if (this.config.parallelOptimization) {
      const batchSize = 10;
      for (let i = 0; i < combinations.length; i += batchSize) {
        const batch = combinations.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (combo) => {
            try {
              const result = await this.backtestFn(
                strategyId,
                inSampleBars,
                combo,
                {
                  initialCapital: this.config.initialCapital,
                  commissionPercent: this.config.commissionPercent,
                  slippagePercent: this.config.slippagePercent,
                }
              );

              if (result.totalTrades < this.config.minTradesPerWindow) {
                return { parameters: combo, objectiveValue: -Infinity };
              }

              return {
                parameters: combo,
                objectiveValue: this.calculateObjective(result),
                result,
              };
            } catch (e) {
              return { parameters: combo, objectiveValue: -Infinity };
            }
          })
        );
        results.push(...batchResults);
      }
    } else {
      for (const combo of combinations) {
        try {
          const result = await this.backtestFn(
            strategyId,
            inSampleBars,
            combo,
            {
              initialCapital: this.config.initialCapital,
              commissionPercent: this.config.commissionPercent,
              slippagePercent: this.config.slippagePercent,
            }
          );

          if (result.totalTrades < this.config.minTradesPerWindow) {
            results.push({ parameters: combo, objectiveValue: -Infinity });
            continue;
          }

          results.push({
            parameters: combo,
            objectiveValue: this.calculateObjective(result),
            result,
          });
        } catch (e) {
          results.push({ parameters: combo, objectiveValue: -Infinity });
        }
      }
    }

    results.sort((a, b) => b.objectiveValue - a.objectiveValue);
    
    return results[0] || { parameters: {}, objectiveValue: 0 };
  }

  private generateParameterCombinations(): Record<string, number>[] {
    const combinations: Record<string, number>[] = [];

    const generateRecursive = (
      ranges: ParameterRange[],
      current: Record<string, number>,
      depth: number
    ) => {
      if (combinations.length >= this.config.maxParameterCombinations) return;
      
      if (depth >= ranges.length) {
        combinations.push({ ...current });
        return;
      }

      const range = ranges[depth];
      const numSteps = Math.round((range.max - range.min) / range.step) + 1;
      
      for (let i = 0; i < numSteps; i++) {
        if (combinations.length >= this.config.maxParameterCombinations) return;
        
        const value = range.min + i * range.step;
        if (value > range.max + 1e-10) break;
        
        current[range.name] = range.type === 'int' ? Math.round(value) : Math.round(value * 1e10) / 1e10;
        generateRecursive(ranges, current, depth + 1);
      }
    };

    if (this.config.parameterRanges.length === 0) {
      return [{}];
    }

    generateRecursive(this.config.parameterRanges, {}, 0);
    return combinations;
  }

  private calculateObjective(result: BacktestResult): number {
    switch (this.config.objective) {
      case 'sharpe_ratio':
        return result.sharpeRatio;
      
      case 'sortino_ratio':
        return this.calculateSortinoRatio(result);
      
      case 'calmar_ratio':
        return result.maxDrawdownPercent > 0 
          ? result.totalReturnPercent / result.maxDrawdownPercent 
          : result.totalReturnPercent > 0 ? Infinity : 0;
      
      case 'total_return':
        return result.totalReturnPercent;
      
      case 'profit_factor':
        return result.profitFactor === Infinity ? 1000 : result.profitFactor;
      
      case 'win_rate':
        return result.winRate;
      
      case 'max_drawdown_inverse':
        return result.maxDrawdownPercent > 0 ? 100 / result.maxDrawdownPercent : 100;
      
      case 'risk_adjusted_return':
        const riskFactor = 1 + (result.maxDrawdownPercent / 100);
        return result.totalReturnPercent / riskFactor;
      
      case 'expectancy':
        return this.calculateExpectancy(result);
      
      default:
        return result.sharpeRatio;
    }
  }

  private calculateSortinoRatio(result: BacktestResult): number {
    if (result.trades.length < 2) return 0;

    const returns = result.trades.map(t => t.pnlPercent);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return avgReturn > 0 ? 10 : 0;

    const downsideDeviation = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + r * r, 0) / negativeReturns.length
    );

    return downsideDeviation > 0 ? avgReturn / downsideDeviation : 0;
  }

  private calculateExpectancy(result: BacktestResult): number {
    if (result.totalTrades === 0) return 0;

    const winRate = result.winRate / 100;
    const avgWin = Math.abs(result.avgWin);
    const avgLoss = Math.abs(result.avgLoss);

    if (avgLoss === 0) return avgWin > 0 ? avgWin : 0;

    return (winRate * avgWin) - ((1 - winRate) * avgLoss);
  }

  private calculateParameterStability(
    prevParams: Record<string, number>,
    currParams: Record<string, number>
  ): number {
    const keys = Object.keys(currParams);
    if (keys.length === 0) return 1;

    let totalSimilarity = 0;
    for (const key of keys) {
      const prev = prevParams[key] ?? currParams[key];
      const curr = currParams[key];
      
      const range = this.config.parameterRanges.find(r => r.name === key);
      if (!range) {
        totalSimilarity += prev === curr ? 1 : 0;
        continue;
      }

      const maxDiff = range.max - range.min;
      const actualDiff = Math.abs(curr - prev);
      totalSimilarity += 1 - (actualDiff / maxDiff);
    }

    return totalSimilarity / keys.length;
  }

  private aggregateOutOfSample(windows: WindowResult[]): WalkForwardResult['aggregatedOutOfSample'] {
    const allTrades = windows.flatMap(w => w.outOfSampleResult.trades);
    
    if (allTrades.length === 0) {
      return {
        totalReturn: 0,
        totalReturnPercent: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        maxDrawdownPercent: 0,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
        expectancy: 0,
      };
    }

    let equity = this.config.initialCapital;
    let maxEquity = equity;
    let maxDrawdown = 0;
    const equityCurve: number[] = [equity];

    for (const trade of allTrades) {
      equity += trade.pnl;
      equityCurve.push(equity);
      maxEquity = Math.max(maxEquity, equity);
      const drawdown = (maxEquity - equity) / maxEquity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    const totalReturn = equity - this.config.initialCapital;
    const totalReturnPercent = (totalReturn / this.config.initialCapital) * 100;

    const winningTrades = allTrades.filter(t => t.pnl > 0);
    const losingTrades = allTrades.filter(t => t.pnl <= 0);

    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((a, t) => a + t.pnl, 0) / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? losingTrades.reduce((a, t) => a + t.pnl, 0) / losingTrades.length 
      : 0;

    const winRate = allTrades.length > 0 
      ? (winningTrades.length / allTrades.length) * 100 
      : 0;

    const profitFactor = losingTrades.length > 0 && losingTrades.reduce((a, t) => a + t.pnl, 0) !== 0
      ? Math.abs(winningTrades.reduce((a, t) => a + t.pnl, 0) / losingTrades.reduce((a, t) => a + t.pnl, 0))
      : winningTrades.length > 0 ? Infinity : 0;

    const returns = allTrades.map(t => t.pnlPercent);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdReturn > 0 ? avgReturn / stdReturn : 0;

    const negReturns = returns.filter(r => r < 0);
    const downDev = negReturns.length > 0 
      ? Math.sqrt(negReturns.reduce((sum, r) => sum + r * r, 0) / negReturns.length)
      : 0;
    const sortinoRatio = downDev > 0 ? avgReturn / downDev : avgReturn > 0 ? 10 : 0;

    const calmarRatio = maxDrawdown > 0 
      ? totalReturnPercent / (maxDrawdown * 100) 
      : totalReturnPercent > 0 ? 10 : 0;

    const expectancy = (winRate / 100 * Math.abs(avgWin)) - ((1 - winRate / 100) * Math.abs(avgLoss));

    return {
      totalReturn,
      totalReturnPercent,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDrawdownPercent: maxDrawdown * 100,
      winRate,
      profitFactor: profitFactor === Infinity ? 1000 : profitFactor,
      totalTrades: allTrades.length,
      expectancy,
    };
  }

  private calculateRobustnessMetrics(windows: WindowResult[]): WalkForwardResult['robustnessMetrics'] {
    if (windows.length === 0) {
      return {
        inSampleOutOfSampleCorrelation: 0,
        parameterStability: 0,
        overfitRatio: 1,
        windowConsistency: 0,
        degradation: 1,
      };
    }

    const inSampleReturns = windows.map(w => w.inSampleResult.totalReturnPercent);
    const outOfSampleReturns = windows.map(w => w.outOfSampleResult.totalReturnPercent);

    const correlation = this.calculateCorrelation(inSampleReturns, outOfSampleReturns);

    const avgParamStability = windows.reduce((sum, w) => sum + w.parameterStability, 0) / windows.length;

    const avgInSample = inSampleReturns.reduce((a, b) => a + b, 0) / inSampleReturns.length;
    const avgOutOfSample = outOfSampleReturns.reduce((a, b) => a + b, 0) / outOfSampleReturns.length;
    
    const inSampleVariance = inSampleReturns.length > 1
      ? inSampleReturns.reduce((sum, r) => sum + Math.pow(r - avgInSample, 2), 0) / (inSampleReturns.length - 1)
      : 0;
    const outOfSampleVariance = outOfSampleReturns.length > 1
      ? outOfSampleReturns.reduce((sum, r) => sum + Math.pow(r - avgOutOfSample, 2), 0) / (outOfSampleReturns.length - 1)
      : 0;
    
    // Overfit ratio: measures how much performance degrades from IS to OOS
    // Formula: max(0, (IS - OOS) / max(|IS|, epsilon))
    // This handles all cases including sign flips proportionally
    const epsilon = 0.01; // Prevent division by zero
    const denominator = Math.max(Math.abs(avgInSample), epsilon);
    const overfitRatio = Math.max(0, Math.min(1, (avgInSample - avgOutOfSample) / denominator));

    const profitableWindows = windows.filter(w => w.outOfSampleResult.totalReturnPercent > 0).length;
    const windowConsistency = windows.length > 0 ? profitableWindows / windows.length : 0;

    const degradation = avgInSample > 0 && avgOutOfSample < avgInSample
      ? (avgInSample - avgOutOfSample) / avgInSample
      : 0;

    return {
      inSampleOutOfSampleCorrelation: correlation,
      parameterStability: avgParamStability,
      overfitRatio,
      windowConsistency,
      degradation,
    };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator > 0 ? numerator / denominator : 0;
  }
}

export const createDefaultWalkForward = (
  parameterRanges: ParameterRange[],
  backtestFn: BacktestFunction
): WalkForwardOptimizer => {
  return new WalkForwardOptimizer(
    {
      inSampleRatio: 0.7,
      outOfSampleRatio: 0.3,
      numWindows: 5,
      mode: 'rolling',
      objective: 'sharpe_ratio',
      parameterRanges,
      minTradesPerWindow: 10,
      warmupBars: 50,
    },
    backtestFn
  );
};

export const createConservativeWalkForward = (
  parameterRanges: ParameterRange[],
  backtestFn: BacktestFunction
): WalkForwardOptimizer => {
  return new WalkForwardOptimizer(
    {
      inSampleRatio: 0.6,
      outOfSampleRatio: 0.4,
      numWindows: 8,
      mode: 'rolling',
      objective: 'calmar_ratio',
      parameterRanges,
      minTradesPerWindow: 20,
      warmupBars: 100,
    },
    backtestFn
  );
};

export const createAggressiveWalkForward = (
  parameterRanges: ParameterRange[],
  backtestFn: BacktestFunction
): WalkForwardOptimizer => {
  return new WalkForwardOptimizer(
    {
      inSampleRatio: 0.8,
      outOfSampleRatio: 0.2,
      numWindows: 3,
      mode: 'anchored',
      objective: 'total_return',
      parameterRanges,
      minTradesPerWindow: 5,
      warmupBars: 30,
    },
    backtestFn
  );
};

export const evaluateWalkForwardQuality = (
  result: WalkForwardResult
): { score: number; grade: string; recommendations: string[] } => {
  const recommendations: string[] = [];
  let score = 0;

  const { robustnessMetrics, aggregatedOutOfSample } = result;

  if (robustnessMetrics.overfitRatio < 0.3) {
    score += 25;
  } else if (robustnessMetrics.overfitRatio < 0.5) {
    score += 15;
    recommendations.push('Moderate overfitting detected - consider using more conservative parameters');
  } else {
    recommendations.push('High overfitting detected - strategy may not perform well in live trading');
  }

  if (robustnessMetrics.windowConsistency >= 0.8) {
    score += 25;
  } else if (robustnessMetrics.windowConsistency >= 0.6) {
    score += 15;
    recommendations.push('Some windows showed losses - strategy may be regime-dependent');
  } else {
    recommendations.push('Low window consistency - strategy may not be robust');
  }

  if (robustnessMetrics.parameterStability >= 0.7) {
    score += 20;
  } else if (robustnessMetrics.parameterStability >= 0.5) {
    score += 10;
    recommendations.push('Parameters vary significantly between windows - may indicate curve fitting');
  } else {
    recommendations.push('Unstable parameters - strategy relies heavily on specific values');
  }

  if (robustnessMetrics.inSampleOutOfSampleCorrelation >= 0.5) {
    score += 15;
  } else if (robustnessMetrics.inSampleOutOfSampleCorrelation >= 0.2) {
    score += 8;
  } else {
    recommendations.push('Low correlation between in-sample and out-of-sample performance');
  }

  if (aggregatedOutOfSample.sharpeRatio >= 1.5) {
    score += 15;
  } else if (aggregatedOutOfSample.sharpeRatio >= 0.5) {
    score += 8;
    recommendations.push('Consider improving risk-adjusted returns');
  } else {
    recommendations.push('Low Sharpe ratio - strategy may not provide adequate risk-adjusted returns');
  }

  let grade: string;
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 50) grade = 'D';
  else grade = 'F';

  return { score, grade, recommendations };
};
