import type { PerformanceMetrics } from './walk-forward-engine';

export interface OverfittingAnalysis {
  degreeOfFreedom: number; // # of parameters
  dataPoints: number; // # of trades/observations
  dofRatio: number; // data points per parameter
  isSuspicious: boolean;
  warnings: string[];
}

/**
 * Analyzes overfitting risk using multiple heuristics
 * @param parameterCount Number of tunable parameters in the strategy
 * @param tradeCount Number of trades executed
 * @param inSampleSharpe Sharpe ratio from in-sample period
 * @param outOfSampleSharpe Sharpe ratio from out-of-sample period
 * @returns Analysis with warnings and suspicious flag
 */
export function analyzeOverfittingRisk(
  parameterCount: number,
  tradeCount: number,
  inSampleSharpe: number,
  outOfSampleSharpe: number
): OverfittingAnalysis {
  const warnings: string[] = [];

  // Rule of thumb: need 30+ trades per parameter
  const dofRatio = parameterCount > 0 ? tradeCount / parameterCount : tradeCount;

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

  // Negative out-of-sample after positive in-sample
  if (inSampleSharpe > 0.5 && outOfSampleSharpe < 0) {
    warnings.push('Out-of-sample performance is negative despite positive in-sample');
  }

  return {
    degreeOfFreedom: parameterCount,
    dataPoints: tradeCount,
    dofRatio,
    isSuspicious: warnings.length >= 2 || dofRatio < 20,
    warnings
  };
}

/**
 * Calculates the Probability of Backtest Overfitting (PBO)
 * Based on the paper "The Probability of Backtest Overfitting" by Bailey et al.
 *
 * This is a simplified version that compares in-sample vs out-of-sample performance
 * across multiple parameter configurations.
 *
 * @param inSampleScores Array of performance scores from in-sample optimization
 * @param outOfSampleScores Corresponding out-of-sample scores
 * @returns PBO score between 0 and 1 (higher = more likely overfit)
 */
export function calculatePBO(
  inSampleScores: number[],
  outOfSampleScores: number[]
): number {
  if (inSampleScores.length !== outOfSampleScores.length || inSampleScores.length === 0) {
    return 0;
  }

  // Rank the parameter sets by in-sample performance
  const combined = inSampleScores.map((is, i) => ({
    is,
    oos: outOfSampleScores[i],
    index: i
  }));

  // Sort by in-sample score descending
  combined.sort((a, b) => b.is - a.is);

  // Count how many of the top-performing in-sample configurations
  // also performed well out-of-sample
  const halfwayPoint = Math.floor(combined.length / 2);
  const topHalfIS = combined.slice(0, halfwayPoint);

  // Calculate median OOS performance
  const allOOS = [...outOfSampleScores].sort((a, b) => b - a);
  const medianOOS = allOOS[Math.floor(allOOS.length / 2)];

  // Count how many top IS performers have OOS below median
  const underperformingCount = topHalfIS.filter(item => item.oos < medianOOS).length;

  // PBO is the proportion that underperformed
  const pbo = underperformingCount / topHalfIS.length;

  return pbo;
}

/**
 * Calculates the Deflated Sharpe Ratio (DSR)
 * Adjusts the Sharpe ratio for the number of trials attempted
 *
 * @param sharpe Observed Sharpe ratio
 * @param numTrials Number of parameter combinations tested
 * @param numObservations Number of return observations
 * @param skewness Skewness of returns (optional, default 0)
 * @param kurtosis Excess kurtosis of returns (optional, default 0)
 * @returns Deflated Sharpe Ratio
 */
export function calculateDeflatedSharpe(
  sharpe: number,
  numTrials: number,
  numObservations: number,
  skewness: number = 0,
  kurtosis: number = 0
): number {
  if (numObservations < 2 || numTrials < 1) return 0;

  // Variance of Sharpe ratio estimator
  const sharpeVariance = (1 + sharpe * sharpe / 2 - skewness * sharpe + (kurtosis - 1) * sharpe * sharpe / 4) / numObservations;

  // Expected maximum Sharpe from N(0,1) distribution after numTrials attempts
  const expectedMaxSharpe = (1 - 0.5772 / Math.sqrt(Math.log(numTrials))) * Math.sqrt(2 * Math.log(numTrials));

  // Deflate the observed Sharpe
  const deflatedSharpe = (sharpe - expectedMaxSharpe * Math.sqrt(sharpeVariance)) / Math.sqrt(sharpeVariance);

  return deflatedSharpe;
}

/**
 * Calculates consistency score across multiple windows
 * A consistent strategy maintains similar performance across different time periods
 *
 * @param windowMetrics Array of performance metrics from different windows
 * @returns Consistency score between 0 and 1 (higher = more consistent)
 */
export function calculateConsistencyScore(windowMetrics: PerformanceMetrics[]): number {
  if (windowMetrics.length < 2) return 1;

  // Calculate coefficient of variation for key metrics
  const sharpeRatios = windowMetrics.map(m => m.sharpeRatio);
  const returns = windowMetrics.map(m => m.totalReturn);
  const winRates = windowMetrics.map(m => m.winRate);

  const cvSharpe = coefficientOfVariation(sharpeRatios);
  const cvReturns = coefficientOfVariation(returns);
  const cvWinRate = coefficientOfVariation(winRates);

  // Lower CV = more consistent, normalize to 0-1 scale
  // CV > 1 is considered highly inconsistent
  const sharpeConsistency = Math.max(0, 1 - cvSharpe);
  const returnConsistency = Math.max(0, 1 - cvReturns / 2); // Allow more variance in returns
  const winRateConsistency = Math.max(0, 1 - cvWinRate);

  // Weighted average
  return (sharpeConsistency * 0.5 + returnConsistency * 0.3 + winRateConsistency * 0.2);
}

/**
 * Helper function to calculate coefficient of variation
 * @param values Array of numeric values
 * @returns CV (standard deviation / mean)
 */
function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return Infinity;

  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return stdDev / Math.abs(mean);
}

/**
 * Detects if a strategy is overfit by analyzing multiple signals
 * @param analysis Combined analysis from various metrics
 * @returns Boolean indicating if strategy is likely overfit
 */
export function isStrategyOverfit(
  overfittingScore: number,
  robustnessScore: number,
  pbo: number,
  consistencyScore: number
): boolean {
  // Multiple criteria must be met for high confidence
  let suspicionCount = 0;

  if (overfittingScore > 0.5) suspicionCount++;
  if (robustnessScore < 0.5) suspicionCount++;
  if (pbo > 0.6) suspicionCount++;
  if (consistencyScore < 0.5) suspicionCount++;

  // If 2 or more indicators suggest overfitting, flag it
  return suspicionCount >= 2;
}

/**
 * Generates a comprehensive overfitting report
 * @param metrics Performance metrics from walk-forward analysis
 * @returns Human-readable report
 */
export function generateOverfittingReport(
  parameterCount: number,
  totalTrades: number,
  overfittingScore: number,
  robustnessScore: number,
  consistencyScore: number,
  avgDegradation: number
): string {
  const lines: string[] = [];

  lines.push('=== OVERFITTING ANALYSIS REPORT ===\n');

  // Data sufficiency
  const dofRatio = parameterCount > 0 ? totalTrades / parameterCount : totalTrades;
  lines.push(`Data Sufficiency:`);
  lines.push(`  Parameters: ${parameterCount}`);
  lines.push(`  Total Trades: ${totalTrades}`);
  lines.push(`  DOF Ratio: ${dofRatio.toFixed(1)} (need 30+)`);

  if (dofRatio < 30) {
    lines.push(`  ⚠️  WARNING: Insufficient data for parameter count\n`);
  } else {
    lines.push(`  ✓ Sufficient data\n`);
  }

  // Overfitting score
  lines.push(`Overfitting Score: ${(overfittingScore * 100).toFixed(1)}%`);
  if (overfittingScore > 0.6) {
    lines.push(`  ⚠️  HIGH RISK - Strategy is likely overfit`);
  } else if (overfittingScore > 0.4) {
    lines.push(`  ⚠️  MODERATE RISK - Proceed with caution`);
  } else {
    lines.push(`  ✓ Low overfitting risk`);
  }
  lines.push('');

  // Robustness
  lines.push(`Robustness Score: ${(robustnessScore * 100).toFixed(1)}%`);
  if (robustnessScore < 0.4) {
    lines.push(`  ⚠️  LOW - Strategy is fragile`);
  } else if (robustnessScore < 0.6) {
    lines.push(`  ⚠️  MODERATE - Needs improvement`);
  } else {
    lines.push(`  ✓ Good robustness`);
  }
  lines.push('');

  // Consistency
  lines.push(`Consistency Score: ${(consistencyScore * 100).toFixed(1)}%`);
  if (consistencyScore < 0.5) {
    lines.push(`  ⚠️  LOW - Unstable performance across periods`);
  } else {
    lines.push(`  ✓ Consistent performance`);
  }
  lines.push('');

  // Performance degradation
  lines.push(`Average IS→OOS Degradation: ${avgDegradation.toFixed(1)}%`);
  if (avgDegradation > 50) {
    lines.push(`  ⚠️  SEVERE - Performance collapses out-of-sample`);
  } else if (avgDegradation > 30) {
    lines.push(`  ⚠️  MODERATE - Significant performance drop`);
  } else if (avgDegradation > 0) {
    lines.push(`  ✓ Acceptable degradation`);
  } else {
    lines.push(`  ✓ No degradation (or improvement!)`);
  }
  lines.push('');

  // Final verdict
  const isOverfit = overfittingScore > 0.4 || robustnessScore < 0.5;
  lines.push('=== VERDICT ===');
  if (isOverfit) {
    lines.push('❌ Strategy is likely OVERFIT');
    lines.push('   Do NOT deploy to live trading');
  } else {
    lines.push('✓ Strategy passes overfitting checks');
    lines.push('  Recommend paper trading before live deployment');
  }

  return lines.join('\n');
}
