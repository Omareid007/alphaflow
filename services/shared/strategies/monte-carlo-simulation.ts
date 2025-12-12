/**
 * AI Active Trader - Monte Carlo Simulation
 * Statistical validation of trading strategies through randomized simulations
 * 
 * Features:
 * - Trade sequence shuffling (tests if order matters)
 * - Bootstrap resampling for confidence intervals
 * - Equity curve path simulation
 * - Drawdown distribution analysis
 * - Risk of ruin estimation
 * - Synthetic market stress testing
 * - Statistical significance testing
 */

import { createLogger } from '../common';
import type { BacktestResult, StrategyContext } from './dsl-runtime';

const logger = createLogger('monte-carlo-simulation');

export interface MonteCarloConfig {
  numSimulations: number;
  confidenceLevels: number[];
  shuffleTrades: boolean;
  bootstrapEnabled: boolean;
  bootstrapBlockSize: number;
  syntheticStressTest: boolean;
  stressVolatilityMultiplier: number;
  stressTrendBias: number;
  riskOfRuinThreshold: number;
  randomSeed?: number;
  parallelSimulations: boolean;
  batchSize: number;
}

export interface EquityCurvePath {
  values: number[];
  finalEquity: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  peakEquity: number;
  ruinOccurred: boolean;
  ruinBar?: number;
}

export interface ConfidenceInterval {
  level: number;
  lower: number;
  upper: number;
  median: number;
}

export interface DrawdownDistribution {
  mean: number;
  median: number;
  stdDev: number;
  max: number;
  percentile95: number;
  percentile99: number;
  histogram: Array<{ bucket: number; count: number }>;
}

export interface ReturnDistribution {
  mean: number;
  median: number;
  stdDev: number;
  skewness: number;
  kurtosis: number;
  min: number;
  max: number;
  percentile5: number;
  percentile25: number;
  percentile75: number;
  percentile95: number;
  histogram: Array<{ bucket: number; count: number }>;
}

export interface RiskMetrics {
  valueAtRisk95: number;
  valueAtRisk99: number;
  conditionalVaR95: number;
  conditionalVaR99: number;
  expectedShortfall: number;
  tailRatio: number;
  riskOfRuin: number;
  probabilityOfProfit: number;
  expectedReturn: number;
  worstCaseReturn: number;
  bestCaseReturn: number;
}

export interface StatisticalTests {
  tStatistic: number;
  pValue: number;
  isSignificant: boolean;
  effectSize: number;
  confidenceWidth: number;
  sampleSize: number;
}

export interface MonteCarloResult {
  config: MonteCarloConfig;
  originalResult: BacktestResult;
  simulations: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
  };
  equityCurves: {
    paths: EquityCurvePath[];
    meanPath: number[];
    medianPath: number[];
    upperBound95: number[];
    lowerBound95: number[];
  };
  returnDistribution: ReturnDistribution;
  drawdownDistribution: DrawdownDistribution;
  finalEquityConfidence: ConfidenceInterval[];
  sharpeRatioConfidence: ConfidenceInterval[];
  winRateConfidence: ConfidenceInterval[];
  riskMetrics: RiskMetrics;
  statisticalTests: StatisticalTests;
  stressTestResults?: {
    originalReturn: number;
    stressedReturn: number;
    degradation: number;
    survivedStress: boolean;
  };
  simulationTimeMs: number;
}

class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  sampleWithReplacement<T>(array: T[], count: number): T[] {
    const result: T[] = [];
    for (let i = 0; i < count; i++) {
      result.push(array[this.nextInt(array.length)]);
    }
    return result;
  }

  blockSample<T>(array: T[], blockSize: number, totalSize: number): T[] {
    const result: T[] = [];
    while (result.length < totalSize) {
      const startIdx = this.nextInt(Math.max(1, array.length - blockSize));
      const block = array.slice(startIdx, Math.min(startIdx + blockSize, array.length));
      result.push(...block);
    }
    return result.slice(0, totalSize);
  }

  normal(mean: number = 0, stdDev: number = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }
}

export class MonteCarloSimulator {
  private config: MonteCarloConfig;
  private random: SeededRandom;

  constructor(config: Partial<MonteCarloConfig> = {}) {
    this.config = {
      numSimulations: config.numSimulations ?? 1000,
      confidenceLevels: config.confidenceLevels ?? [0.90, 0.95, 0.99],
      shuffleTrades: config.shuffleTrades ?? true,
      bootstrapEnabled: config.bootstrapEnabled ?? true,
      bootstrapBlockSize: config.bootstrapBlockSize ?? 5,
      syntheticStressTest: config.syntheticStressTest ?? true,
      stressVolatilityMultiplier: config.stressVolatilityMultiplier ?? 2.0,
      stressTrendBias: config.stressTrendBias ?? -0.1,
      riskOfRuinThreshold: config.riskOfRuinThreshold ?? 0.5,
      randomSeed: config.randomSeed,
      parallelSimulations: config.parallelSimulations ?? true,
      batchSize: config.batchSize ?? 100,
    };
    this.random = new SeededRandom(this.config.randomSeed);
  }

  async simulate(backtestResult: BacktestResult): Promise<MonteCarloResult> {
    const startTime = Date.now();
    
    logger.info('Starting Monte Carlo simulation', {
      numSimulations: this.config.numSimulations,
      trades: backtestResult.trades.length,
      shuffleTrades: this.config.shuffleTrades,
      bootstrapEnabled: this.config.bootstrapEnabled,
    });

    if (backtestResult.trades.length < 2) {
      throw new Error('Monte Carlo simulation requires at least 2 trades');
    }

    const equityPaths = await this.generateEquityPaths(backtestResult);
    const returnDist = this.calculateReturnDistribution(equityPaths);
    const drawdownDist = this.calculateDrawdownDistribution(equityPaths);
    const riskMetrics = this.calculateRiskMetrics(equityPaths, backtestResult);
    const statTests = this.performStatisticalTests(backtestResult, equityPaths);

    const finalEquityConfidence = this.calculateConfidenceIntervals(
      equityPaths.map(p => p.finalEquity),
      this.config.confidenceLevels
    );

    const sharpeRatios = this.calculateSimulatedSharpeRatios(equityPaths, backtestResult);
    const sharpeRatioConfidence = this.calculateConfidenceIntervals(
      sharpeRatios,
      this.config.confidenceLevels
    );

    const winRates = this.calculateSimulatedWinRates(equityPaths, backtestResult);
    const winRateConfidence = this.calculateConfidenceIntervals(
      winRates,
      this.config.confidenceLevels
    );

    const equityCurveSummary = this.summarizeEquityCurves(equityPaths, backtestResult);

    let stressTestResults: MonteCarloResult['stressTestResults'] | undefined;
    if (this.config.syntheticStressTest) {
      stressTestResults = this.runStressTest(backtestResult);
    }

    const successfulRuns = equityPaths.filter(p => !p.ruinOccurred).length;

    const result: MonteCarloResult = {
      config: this.config,
      originalResult: backtestResult,
      simulations: {
        totalRuns: this.config.numSimulations,
        successfulRuns,
        failedRuns: this.config.numSimulations - successfulRuns,
      },
      equityCurves: equityCurveSummary,
      returnDistribution: returnDist,
      drawdownDistribution: drawdownDist,
      finalEquityConfidence,
      sharpeRatioConfidence,
      winRateConfidence,
      riskMetrics,
      statisticalTests: statTests,
      stressTestResults,
      simulationTimeMs: Date.now() - startTime,
    };

    logger.info('Monte Carlo simulation complete', {
      simulations: result.simulations.totalRuns,
      successRate: `${((successfulRuns / this.config.numSimulations) * 100).toFixed(1)}%`,
      riskOfRuin: `${(riskMetrics.riskOfRuin * 100).toFixed(2)}%`,
      expectedReturn: `${returnDist.mean.toFixed(2)}%`,
      timeMs: result.simulationTimeMs,
    });

    return result;
  }

  private async generateEquityPaths(backtestResult: BacktestResult): Promise<EquityCurvePath[]> {
    const paths: EquityCurvePath[] = [];
    const trades = backtestResult.trades;
    const initialCapital = backtestResult.initialCapital;

    if (this.config.parallelSimulations) {
      const batches: Promise<EquityCurvePath[]>[] = [];
      for (let i = 0; i < this.config.numSimulations; i += this.config.batchSize) {
        const batchSize = Math.min(this.config.batchSize, this.config.numSimulations - i);
        batches.push(this.generateBatch(trades, initialCapital, batchSize));
      }
      const results = await Promise.all(batches);
      paths.push(...results.flat());
    } else {
      for (let i = 0; i < this.config.numSimulations; i++) {
        const path = this.generateSinglePath(trades, initialCapital);
        paths.push(path);
      }
    }

    return paths;
  }

  private async generateBatch(
    trades: BacktestResult['trades'],
    initialCapital: number,
    count: number
  ): Promise<EquityCurvePath[]> {
    const paths: EquityCurvePath[] = [];
    for (let i = 0; i < count; i++) {
      paths.push(this.generateSinglePath(trades, initialCapital));
    }
    return paths;
  }

  private generateSinglePath(
    trades: BacktestResult['trades'],
    initialCapital: number
  ): EquityCurvePath {
    let simulatedTrades: typeof trades;

    if (this.config.bootstrapEnabled) {
      simulatedTrades = this.random.blockSample(
        trades,
        this.config.bootstrapBlockSize,
        trades.length
      );
    } else if (this.config.shuffleTrades) {
      simulatedTrades = this.random.shuffle(trades);
    } else {
      simulatedTrades = [...trades];
    }

    const values: number[] = [initialCapital];
    let equity = initialCapital;
    let maxEquity = initialCapital;
    let maxDrawdown = 0;
    let ruinOccurred = false;
    let ruinBar: number | undefined;

    for (let i = 0; i < simulatedTrades.length; i++) {
      const trade = simulatedTrades[i];
      equity += trade.pnl;
      values.push(equity);

      maxEquity = Math.max(maxEquity, equity);
      const drawdown = (maxEquity - equity) / maxEquity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);

      if (!ruinOccurred && equity < initialCapital * this.config.riskOfRuinThreshold) {
        ruinOccurred = true;
        ruinBar = i;
      }
    }

    return {
      values,
      finalEquity: equity,
      maxDrawdown: maxEquity - Math.min(...values),
      maxDrawdownPercent: maxDrawdown * 100,
      peakEquity: maxEquity,
      ruinOccurred,
      ruinBar,
    };
  }

  private calculateReturnDistribution(paths: EquityCurvePath[]): ReturnDistribution {
    const returns = paths.map(p => 
      ((p.finalEquity - p.values[0]) / p.values[0]) * 100
    );

    returns.sort((a, b) => a - b);

    const n = returns.length;
    const mean = returns.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0 
      ? (returns[n / 2 - 1] + returns[n / 2]) / 2 
      : returns[Math.floor(n / 2)];

    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const skewness = n > 2 
      ? (returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 3), 0) * n) / ((n - 1) * (n - 2))
      : 0;

    const kurtosis = n > 3
      ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * 
        returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 4), 0) -
        (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3))
      : 0;

    const histogram = this.createHistogram(returns, 20);

    return {
      mean,
      median,
      stdDev,
      skewness,
      kurtosis,
      min: returns[0],
      max: returns[n - 1],
      percentile5: this.percentile(returns, 0.05),
      percentile25: this.percentile(returns, 0.25),
      percentile75: this.percentile(returns, 0.75),
      percentile95: this.percentile(returns, 0.95),
      histogram,
    };
  }

  private calculateDrawdownDistribution(paths: EquityCurvePath[]): DrawdownDistribution {
    const drawdowns = paths.map(p => p.maxDrawdownPercent);
    drawdowns.sort((a, b) => a - b);

    const n = drawdowns.length;
    const mean = drawdowns.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0 
      ? (drawdowns[n / 2 - 1] + drawdowns[n / 2]) / 2 
      : drawdowns[Math.floor(n / 2)];

    const variance = drawdowns.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const histogram = this.createHistogram(drawdowns, 20);

    return {
      mean,
      median,
      stdDev,
      max: drawdowns[n - 1],
      percentile95: this.percentile(drawdowns, 0.95),
      percentile99: this.percentile(drawdowns, 0.99),
      histogram,
    };
  }

  private calculateRiskMetrics(
    paths: EquityCurvePath[],
    backtestResult: BacktestResult
  ): RiskMetrics {
    const returns = paths.map(p => 
      ((p.finalEquity - p.values[0]) / p.values[0]) * 100
    );
    returns.sort((a, b) => a - b);

    const n = returns.length;

    const var95Idx = Math.floor(n * 0.05);
    const var99Idx = Math.floor(n * 0.01);

    const lossAtVar95 = returns[var95Idx];
    const lossAtVar99 = returns[var99Idx];
    const valueAtRisk95 = lossAtVar95 < 0 ? -lossAtVar95 : 0;
    const valueAtRisk99 = lossAtVar99 < 0 ? -lossAtVar99 : 0;

    const tail95 = returns.slice(0, var95Idx + 1).filter(r => r < 0);
    const conditionalVaR95 = tail95.length > 0 
      ? -tail95.reduce((a, b) => a + b, 0) / tail95.length 
      : valueAtRisk95;

    const tail99 = returns.slice(0, var99Idx + 1).filter(r => r < 0);
    const conditionalVaR99 = tail99.length > 0 
      ? -tail99.reduce((a, b) => a + b, 0) / tail99.length 
      : valueAtRisk99;

    const allLosses = returns.filter(r => r < 0);
    const expectedShortfall = allLosses.length > 0
      ? -allLosses.slice(0, Math.max(1, Math.floor(allLosses.length * 0.05))).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(allLosses.length * 0.05))
      : 0;

    const upperTailGains = returns.slice(Math.floor(n * 0.95)).filter(r => r > 0);
    const lowerTailLosses = returns.slice(0, Math.floor(n * 0.05)).filter(r => r < 0);
    const upperSum = upperTailGains.reduce((a, b) => a + b, 0);
    const lowerSum = Math.abs(lowerTailLosses.reduce((a, b) => a + b, 0));
    const tailRatio = lowerSum > 0 ? upperSum / lowerSum : upperSum > 0 ? Infinity : 1;

    const ruinCount = paths.filter(p => p.ruinOccurred).length;
    const riskOfRuin = ruinCount / n;

    const profitCount = paths.filter(p => p.finalEquity > p.values[0]).length;
    const probabilityOfProfit = profitCount / n;

    const expectedReturn = returns.reduce((a, b) => a + b, 0) / n;
    const worstCaseReturn = returns[0];
    const bestCaseReturn = returns[n - 1];

    return {
      valueAtRisk95,
      valueAtRisk99,
      conditionalVaR95,
      conditionalVaR99,
      expectedShortfall,
      tailRatio,
      riskOfRuin,
      probabilityOfProfit,
      expectedReturn,
      worstCaseReturn,
      bestCaseReturn,
    };
  }

  private performStatisticalTests(
    backtestResult: BacktestResult,
    paths: EquityCurvePath[]
  ): StatisticalTests {
    const simulatedReturns = paths.map(p => 
      ((p.finalEquity - p.values[0]) / p.values[0]) * 100
    );

    const originalReturn = backtestResult.totalReturnPercent;

    const n = simulatedReturns.length;
    const simMean = simulatedReturns.reduce((a, b) => a + b, 0) / n;
    const simVariance = simulatedReturns.reduce((sum, r) => sum + Math.pow(r - simMean, 2), 0) / Math.max(1, n - 1);
    const simStdDev = Math.sqrt(simVariance);

    const countBelowZero = simulatedReturns.filter(r => r <= 0).length;
    const pValue = countBelowZero / n;

    const isSignificant = pValue < 0.05 && simMean > 0;

    const effectSize = simStdDev > 0 ? simMean / simStdDev : 0;

    const tStatistic = simStdDev > 0 ? (simMean / simStdDev) * Math.sqrt(n) : 0;

    const sortedReturns = [...simulatedReturns].sort((a, b) => a - b);
    const lower025 = sortedReturns[Math.floor(n * 0.025)];
    const upper975 = sortedReturns[Math.min(Math.floor(n * 0.975), n - 1)];
    const confidenceWidth = upper975 - lower025;

    return {
      tStatistic,
      pValue,
      isSignificant,
      effectSize,
      confidenceWidth,
      sampleSize: n,
    };
  }

  private calculateTTestPValue(t: number, df: number): number {
    const x = df / (df + t * t);
    
    if (t === 0) return 1;
    
    const absT = Math.abs(t);
    const a = df / 2;
    const b = 0.5;
    
    const approxP = 2 * (1 - this.normalCDF(absT * Math.sqrt(df / (df + 2))));
    return Math.max(0, Math.min(1, approxP));
  }

  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  private getTCriticalValue(df: number, probability: number): number {
    if (df >= 120) return 1.96;
    if (df >= 60) return 2.0;
    if (df >= 30) return 2.04;
    if (df >= 20) return 2.09;
    if (df >= 15) return 2.13;
    if (df >= 10) return 2.23;
    if (df >= 5) return 2.57;
    return 2.78;
  }

  private calculateSimulatedSharpeRatios(
    paths: EquityCurvePath[],
    backtestResult: BacktestResult
  ): number[] {
    return paths.map(path => {
      if (path.values.length < 2) return 0;

      const periodReturns: number[] = [];
      for (let i = 1; i < path.values.length; i++) {
        const ret = (path.values[i] - path.values[i - 1]) / path.values[i - 1];
        periodReturns.push(ret);
      }

      if (periodReturns.length === 0) return 0;

      const meanReturn = periodReturns.reduce((a, b) => a + b, 0) / periodReturns.length;
      const variance = periodReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / periodReturns.length;
      const stdDev = Math.sqrt(variance);

      return stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;
    });
  }

  private calculateSimulatedWinRates(
    paths: EquityCurvePath[],
    backtestResult: BacktestResult
  ): number[] {
    return paths.map(path => {
      if (path.values.length < 2) return 0;

      let wins = 0;
      let total = 0;

      for (let i = 1; i < path.values.length; i++) {
        if (path.values[i] > path.values[i - 1]) {
          wins++;
        }
        total++;
      }

      return total > 0 ? (wins / total) * 100 : 0;
    });
  }

  private calculateConfidenceIntervals(
    values: number[],
    levels: number[]
  ): ConfidenceInterval[] {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const median = n % 2 === 0 
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
      : sorted[Math.floor(n / 2)];

    return levels.map(level => {
      const alpha = 1 - level;
      const lowerIdx = Math.floor(n * (alpha / 2));
      const upperIdx = Math.floor(n * (1 - alpha / 2));

      return {
        level,
        lower: sorted[lowerIdx],
        upper: sorted[Math.min(upperIdx, n - 1)],
        median,
      };
    });
  }

  private summarizeEquityCurves(
    paths: EquityCurvePath[],
    backtestResult: BacktestResult
  ): MonteCarloResult['equityCurves'] {
    const maxLength = Math.max(...paths.map(p => p.values.length));
    
    const normalizedPaths = paths.map(path => {
      const normalized = [...path.values];
      const lastValue = normalized[normalized.length - 1];
      while (normalized.length < maxLength) {
        normalized.push(lastValue);
      }
      return normalized;
    });

    const meanPath: number[] = [];
    const medianPath: number[] = [];
    const upperBound95: number[] = [];
    const lowerBound95: number[] = [];

    for (let i = 0; i < maxLength; i++) {
      const valuesAtPoint = normalizedPaths.map(p => p[i]).sort((a, b) => a - b);
      const n = valuesAtPoint.length;

      meanPath.push(valuesAtPoint.reduce((a, b) => a + b, 0) / n);
      medianPath.push(n % 2 === 0 
        ? (valuesAtPoint[n / 2 - 1] + valuesAtPoint[n / 2]) / 2 
        : valuesAtPoint[Math.floor(n / 2)]);
      lowerBound95.push(valuesAtPoint[Math.floor(n * 0.025)]);
      upperBound95.push(valuesAtPoint[Math.floor(n * 0.975)]);
    }

    return {
      paths,
      meanPath,
      medianPath,
      upperBound95,
      lowerBound95,
    };
  }

  private runStressTest(backtestResult: BacktestResult): MonteCarloResult['stressTestResults'] {
    const originalReturn = backtestResult.totalReturnPercent;

    const stressedTrades = backtestResult.trades.map(trade => ({
      ...trade,
      pnl: trade.pnl * (1 + this.config.stressTrendBias) + 
           this.random.normal(0, Math.abs(trade.pnl) * (this.config.stressVolatilityMultiplier - 1)),
      pnlPercent: trade.pnlPercent * (1 + this.config.stressTrendBias) +
           this.random.normal(0, Math.abs(trade.pnlPercent) * (this.config.stressVolatilityMultiplier - 1)),
    }));

    let equity = backtestResult.initialCapital;
    let minEquity = equity;

    for (const trade of stressedTrades) {
      equity += trade.pnl;
      minEquity = Math.min(minEquity, equity);
    }

    const stressedReturn = ((equity - backtestResult.initialCapital) / backtestResult.initialCapital) * 100;
    const degradation = originalReturn !== 0 
      ? (originalReturn - stressedReturn) / Math.abs(originalReturn) 
      : 0;
    const survivedStress = minEquity >= backtestResult.initialCapital * this.config.riskOfRuinThreshold;

    return {
      originalReturn,
      stressedReturn,
      degradation,
      survivedStress,
    };
  }

  private percentile(sortedArray: number[], p: number): number {
    const idx = p * (sortedArray.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  private createHistogram(
    values: number[],
    numBuckets: number
  ): Array<{ bucket: number; count: number }> {
    if (values.length === 0) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const bucketWidth = range / numBuckets;

    const buckets: Map<number, number> = new Map();
    
    for (let i = 0; i < numBuckets; i++) {
      buckets.set(i, 0);
    }

    for (const value of values) {
      const bucketIdx = Math.min(
        Math.floor((value - min) / bucketWidth),
        numBuckets - 1
      );
      buckets.set(bucketIdx, (buckets.get(bucketIdx) || 0) + 1);
    }

    return Array.from(buckets.entries()).map(([idx, count]) => ({
      bucket: min + (idx + 0.5) * bucketWidth,
      count,
    }));
  }
}

export const createDefaultMonteCarloSimulator = (): MonteCarloSimulator => {
  return new MonteCarloSimulator({
    numSimulations: 1000,
    confidenceLevels: [0.90, 0.95, 0.99],
    shuffleTrades: true,
    bootstrapEnabled: true,
    bootstrapBlockSize: 5,
    syntheticStressTest: true,
  });
};

export const createQuickMonteCarloSimulator = (): MonteCarloSimulator => {
  return new MonteCarloSimulator({
    numSimulations: 100,
    confidenceLevels: [0.95],
    shuffleTrades: true,
    bootstrapEnabled: false,
    syntheticStressTest: false,
  });
};

export const createRobustMonteCarloSimulator = (): MonteCarloSimulator => {
  return new MonteCarloSimulator({
    numSimulations: 10000,
    confidenceLevels: [0.90, 0.95, 0.99, 0.999],
    shuffleTrades: true,
    bootstrapEnabled: true,
    bootstrapBlockSize: 10,
    syntheticStressTest: true,
    stressVolatilityMultiplier: 3.0,
    stressTrendBias: -0.2,
    riskOfRuinThreshold: 0.25,
  });
};
