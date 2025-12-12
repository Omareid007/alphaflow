/**
 * AI Active Trader - Alpha Decay Modeling
 * Quantitative analysis of signal decay and optimal holding periods
 * 
 * Features:
 * - Signal half-life estimation from historical returns
 * - Exponential and hyperbolic decay rate modeling
 * - Decay curve fitting with least-squares optimization
 * - Residual alpha prediction for future time horizons
 * - Optimal holding period calculation based on decay and costs
 * - Turnover optimization balancing alpha capture vs transaction costs
 * - Information content decay modeling with multi-signal aggregation
 */

import { createLogger } from '../common';

const logger = createLogger('alpha-decay');

/**
 * Type of decay model to use for alpha estimation
 */
export type DecayModelType = 'exponential' | 'hyperbolic' | 'power_law' | 'linear';

/**
 * Signal decay profile containing half-life, decay rate, and asymptotic behavior
 */
export interface SignalDecayProfile {
  /** Unique identifier for the signal */
  signalId: string;
  /** Type of decay model used */
  decayModel: DecayModelType;
  /** Time (in periods) for signal to decay to 50% of initial strength */
  halfLife: number;
  /** Decay rate parameter (lambda for exponential, alpha for hyperbolic) */
  decayRate: number;
  /** Asymptotic value the signal decays toward (typically 0) */
  asymptote: number;
  /** Initial signal strength at t=0 */
  initialStrength: number;
  /** R-squared goodness of fit for the decay model */
  rSquared: number;
  /** Standard error of the decay rate estimate */
  decayRateStdError: number;
  /** 95% confidence interval for half-life [lower, upper] */
  halfLifeConfidenceInterval: [number, number];
  /** Timestamp when the profile was computed */
  computedAt: Date;
}

/**
 * Analysis of optimal holding period based on alpha decay and transaction costs
 */
export interface HoldingPeriodAnalysis {
  /** Recommended optimal holding period in trading periods */
  optimalDuration: number;
  /** Expected gross alpha at optimal holding period (before costs) */
  expectedGrossAlpha: number;
  /** Expected net alpha at optimal holding period (after costs) */
  expectedNetAlpha: number;
  /** Total transaction costs (entry + exit) */
  totalTransactionCosts: number;
  /** Alpha capture efficiency (net alpha / gross alpha at t=0) */
  alphaCaptureEfficiency: number;
  /** Breakeven holding period where alpha equals transaction costs */
  breakevenPeriod: number;
  /** Maximum holding period before alpha becomes negative */
  maxProfitableHolding: number;
  /** Sensitivity of optimal period to transaction cost changes */
  costSensitivity: number;
  /** Annualized expected return at optimal holding */
  annualizedReturn: number;
}

/**
 * Configuration for alpha decay analysis
 */
export interface AlphaDecayConfig {
  /** Minimum number of observations required for estimation */
  minObservations: number;
  /** Maximum lag periods to consider for decay estimation */
  maxLagPeriods: number;
  /** Confidence level for interval estimation (0-1) */
  confidenceLevel: number;
  /** Decay model type to use */
  decayModel: DecayModelType;
  /** Whether to use weighted least squares */
  useWeightedRegression: boolean;
  /** Risk-free rate for excess return calculation */
  riskFreeRate: number;
  /** One-way transaction cost as decimal */
  transactionCostBps: number;
  /** Bid-ask spread cost as decimal */
  bidAskSpreadBps: number;
  /** Market impact cost as decimal of trade size */
  marketImpactBps: number;
  /** Trading periods per year for annualization */
  periodsPerYear: number;
}

/**
 * Historical alpha observation for decay analysis
 */
export interface AlphaObservation {
  /** Timestamp of the observation */
  timestamp: Date;
  /** Signal value at observation time */
  signalValue: number;
  /** Forward return realized after holding period */
  forwardReturn: number;
  /** Holding period in trading periods */
  holdingPeriod: number;
  /** Benchmark return for alpha calculation */
  benchmarkReturn?: number;
}

/**
 * Decay curve data point
 */
export interface DecayCurvePoint {
  /** Time period from signal generation */
  period: number;
  /** Signal strength at this period */
  strength: number;
  /** Alpha contribution at this period */
  alpha: number;
  /** Cumulative alpha from t=0 to this period */
  cumulativeAlpha: number;
}

/**
 * Turnover optimization configuration
 */
export interface TurnoverConfig {
  /** Current portfolio turnover (annual) */
  currentTurnover: number;
  /** One-way transaction cost in basis points */
  transactionCostBps: number;
  /** Market impact as function of trade size */
  marketImpactBps: number;
  /** Bid-ask spread in basis points */
  bidAskSpreadBps: number;
  /** Tax rate on short-term gains */
  shortTermTaxRate: number;
  /** Tax rate on long-term gains */
  longTermTaxRate: number;
  /** Long-term holding threshold in days */
  longTermThresholdDays: number;
  /** Target tracking error constraint */
  maxTrackingError?: number;
}

/**
 * Result of turnover optimization
 */
export interface TurnoverOptimizationResult {
  /** Optimal annual turnover rate */
  optimalTurnover: number;
  /** Optimal rebalancing frequency (times per year) */
  optimalRebalanceFrequency: number;
  /** Expected gross alpha capture at optimal turnover */
  expectedGrossAlpha: number;
  /** Total transaction costs at optimal turnover */
  totalTransactionCosts: number;
  /** Expected net alpha after all costs */
  expectedNetAlpha: number;
  /** Information ratio at optimal turnover */
  informationRatio: number;
  /** Alpha decay between rebalances */
  alphaDecayLoss: number;
  /** Tax efficiency ratio */
  taxEfficiency: number;
  /** Sensitivity analysis results */
  sensitivity: {
    turnoverToAlpha: number;
    turnoverToCost: number;
    optimalTurnoverRange: [number, number];
  };
}

/**
 * Information decay curve parameters
 */
export interface InformationDecayParams {
  /** Signal identifier */
  signalId: string;
  /** Initial information content (bits or signal strength) */
  initialInformation: number;
  /** Decay half-life in periods */
  halfLife: number;
  /** Noise accumulation rate */
  noiseRate: number;
  /** Signal quality at generation */
  signalQuality: number;
  /** Correlation with market regime */
  regimeCorrelation: number;
}

/**
 * Multi-signal aggregation result
 */
export interface AggregatedSignalDecay {
  /** Combined effective half-life */
  effectiveHalfLife: number;
  /** Weighted average decay rate */
  weightedDecayRate: number;
  /** Signal contribution weights */
  signalWeights: Map<string, number>;
  /** Combined signal strength over time */
  combinedStrengthCurve: DecayCurvePoint[];
  /** Diversification benefit (reduction in decay) */
  diversificationBenefit: number;
  /** Correlation matrix between signals */
  signalCorrelations: number[][];
}

/**
 * AlphaDecayAnalyzer class
 * Analyzes signal decay patterns and estimates optimal holding periods
 */
export class AlphaDecayAnalyzer {
  private config: AlphaDecayConfig;

  /**
   * Create a new AlphaDecayAnalyzer
   * @param config - Configuration options for decay analysis
   */
  constructor(config: Partial<AlphaDecayConfig> = {}) {
    this.config = {
      minObservations: config.minObservations ?? 30,
      maxLagPeriods: config.maxLagPeriods ?? 60,
      confidenceLevel: config.confidenceLevel ?? 0.95,
      decayModel: config.decayModel ?? 'exponential',
      useWeightedRegression: config.useWeightedRegression ?? true,
      riskFreeRate: config.riskFreeRate ?? 0.05,
      transactionCostBps: config.transactionCostBps ?? 10,
      bidAskSpreadBps: config.bidAskSpreadBps ?? 5,
      marketImpactBps: config.marketImpactBps ?? 5,
      periodsPerYear: config.periodsPerYear ?? 252,
    };

    logger.info('AlphaDecayAnalyzer initialized', {
      decayModel: this.config.decayModel,
      maxLagPeriods: this.config.maxLagPeriods,
      transactionCostBps: this.config.transactionCostBps,
    });
  }

  /**
   * Estimate the half-life of a signal from historical returns
   * Uses regression on autocorrelation structure to estimate decay rate
   * 
   * @param observations - Historical alpha observations with varying holding periods
   * @param signalId - Identifier for the signal being analyzed
   * @returns Signal decay profile with half-life estimate
   */
  estimateHalfLife(
    observations: AlphaObservation[],
    signalId: string
  ): SignalDecayProfile {
    if (observations.length < this.config.minObservations) {
      throw new Error(
        `Insufficient observations: ${observations.length} < ${this.config.minObservations}`
      );
    }

    logger.debug('Estimating half-life', {
      signalId,
      observations: observations.length,
      model: this.config.decayModel,
    });

    const alphaByPeriod = this.groupAlphaByHoldingPeriod(observations);
    const periods = Array.from(alphaByPeriod.keys()).sort((a, b) => a - b);
    
    if (periods.length < 3) {
      throw new Error('Need at least 3 distinct holding periods for decay estimation');
    }

    const avgAlphaByPeriod = periods.map(p => {
      const alphas = alphaByPeriod.get(p)!;
      return alphas.reduce((a, b) => a + b, 0) / alphas.length;
    });

    const initialAlpha = avgAlphaByPeriod[0];
    if (Math.abs(initialAlpha) < 1e-10) {
      throw new Error('Initial alpha is too close to zero for decay estimation');
    }

    const normalizedAlpha = avgAlphaByPeriod.map(a => a / initialAlpha);

    const { decayRate, rSquared, stdError } = this.fitDecayModel(
      periods,
      normalizedAlpha,
      this.config.decayModel
    );

    const halfLife = this.calculateHalfLifeFromRate(decayRate, this.config.decayModel);

    const tCritical = 1.96;
    const halfLifeLower = this.calculateHalfLifeFromRate(
      decayRate + tCritical * stdError,
      this.config.decayModel
    );
    const halfLifeUpper = this.calculateHalfLifeFromRate(
      Math.max(0.001, decayRate - tCritical * stdError),
      this.config.decayModel
    );

    const profile: SignalDecayProfile = {
      signalId,
      decayModel: this.config.decayModel,
      halfLife,
      decayRate,
      asymptote: 0,
      initialStrength: initialAlpha,
      rSquared,
      decayRateStdError: stdError,
      halfLifeConfidenceInterval: [
        Math.min(halfLifeLower, halfLifeUpper),
        Math.max(halfLifeLower, halfLifeUpper),
      ],
      computedAt: new Date(),
    };

    logger.info('Half-life estimated', {
      signalId,
      halfLife: halfLife.toFixed(2),
      decayRate: decayRate.toFixed(4),
      rSquared: rSquared.toFixed(3),
    });

    return profile;
  }

  /**
   * Calculate decay rate for exponential or hyperbolic decay models
   * 
   * @param observations - Historical alpha observations
   * @param modelType - Type of decay model to fit
   * @returns Decay rate and model fit statistics
   */
  calculateDecayRate(
    observations: AlphaObservation[],
    modelType: DecayModelType = this.config.decayModel
  ): { decayRate: number; rSquared: number; modelType: DecayModelType } {
    const alphaByPeriod = this.groupAlphaByHoldingPeriod(observations);
    const periods = Array.from(alphaByPeriod.keys()).sort((a, b) => a - b);

    const avgAlphaByPeriod = periods.map(p => {
      const alphas = alphaByPeriod.get(p)!;
      return alphas.reduce((a, b) => a + b, 0) / alphas.length;
    });

    const initialAlpha = avgAlphaByPeriod[0];
    const normalizedAlpha = avgAlphaByPeriod.map(a => 
      initialAlpha !== 0 ? a / initialAlpha : 0
    );

    const { decayRate, rSquared } = this.fitDecayModel(
      periods,
      normalizedAlpha,
      modelType
    );

    return { decayRate, rSquared, modelType };
  }

  /**
   * Fit a decay curve to historical alpha data
   * Returns the fitted curve points for visualization
   * 
   * @param observations - Historical alpha observations
   * @param signalId - Signal identifier
   * @param numPoints - Number of points to generate on the fitted curve
   * @returns Array of decay curve points
   */
  fitDecayCurve(
    observations: AlphaObservation[],
    signalId: string,
    numPoints: number = 100
  ): DecayCurvePoint[] {
    const profile = this.estimateHalfLife(observations, signalId);
    const maxPeriod = Math.max(...observations.map(o => o.holdingPeriod)) * 1.5;
    const step = maxPeriod / numPoints;

    const curvePoints: DecayCurvePoint[] = [];
    let cumulativeAlpha = 0;

    for (let i = 0; i <= numPoints; i++) {
      const period = i * step;
      const strength = this.calculateDecayedStrength(
        profile.initialStrength,
        period,
        profile.decayRate,
        profile.decayModel
      );
      
      const alpha = strength - profile.asymptote;
      const periodAlpha = i === 0 ? alpha : alpha * step;
      cumulativeAlpha += periodAlpha;

      curvePoints.push({
        period,
        strength,
        alpha,
        cumulativeAlpha,
      });
    }

    return curvePoints;
  }

  /**
   * Predict remaining alpha at a future time point
   * 
   * @param profile - Signal decay profile from estimateHalfLife
   * @param currentTime - Current time since signal generation
   * @param futureTime - Future time to predict alpha for
   * @returns Predicted residual alpha at future time
   */
  predictResidualAlpha(
    profile: SignalDecayProfile,
    currentTime: number,
    futureTime: number
  ): {
    predictedAlpha: number;
    confidenceInterval: [number, number];
    decayFromCurrent: number;
  } {
    if (futureTime < currentTime) {
      throw new Error('Future time must be greater than current time');
    }

    const currentStrength = this.calculateDecayedStrength(
      profile.initialStrength,
      currentTime,
      profile.decayRate,
      profile.decayModel
    );

    const futureStrength = this.calculateDecayedStrength(
      profile.initialStrength,
      futureTime,
      profile.decayRate,
      profile.decayModel
    );

    const predictedAlpha = futureStrength - profile.asymptote;
    const decayFromCurrent = currentStrength > 0 
      ? 1 - (futureStrength / currentStrength) 
      : 0;

    const stdError = profile.decayRateStdError;
    const tCritical = 1.96;
    const timeDiff = futureTime - currentTime;
    const predictionUncertainty = stdError * timeDiff * Math.abs(predictedAlpha);

    return {
      predictedAlpha,
      confidenceInterval: [
        predictedAlpha - tCritical * predictionUncertainty,
        predictedAlpha + tCritical * predictionUncertainty,
      ],
      decayFromCurrent,
    };
  }

  /**
   * Calculate the optimal holding period based on alpha decay and transaction costs
   * Balances capturing alpha against round-trip transaction costs
   * 
   * @param profile - Signal decay profile
   * @param positionSize - Size of the position in dollars
   * @returns Holding period analysis with optimal duration
   */
  getOptimalHoldingPeriod(
    profile: SignalDecayProfile,
    positionSize: number = 100000
  ): HoldingPeriodAnalysis {
    const totalCostBps = 2 * (
      this.config.transactionCostBps +
      this.config.bidAskSpreadBps / 2 +
      this.config.marketImpactBps
    );
    const totalCostRate = totalCostBps / 10000;
    const totalTransactionCosts = positionSize * totalCostRate;

    let optimalPeriod = 0;
    let maxNetAlpha = -Infinity;
    let breakevenPeriod = Infinity;
    let maxProfitableHolding = 0;

    const searchStep = 0.1;
    const maxSearch = this.config.maxLagPeriods * 2;

    for (let period = searchStep; period <= maxSearch; period += searchStep) {
      const strength = this.calculateDecayedStrength(
        profile.initialStrength,
        period,
        profile.decayRate,
        profile.decayModel
      );

      const cumulativeAlpha = this.integrateCumulativeAlpha(
        profile.initialStrength,
        0,
        period,
        profile.decayRate,
        profile.decayModel
      );

      const netAlpha = cumulativeAlpha * positionSize - totalTransactionCosts;

      if (netAlpha > maxNetAlpha) {
        maxNetAlpha = netAlpha;
        optimalPeriod = period;
      }

      if (breakevenPeriod === Infinity && cumulativeAlpha * positionSize >= totalTransactionCosts) {
        breakevenPeriod = period;
      }

      if (netAlpha > 0) {
        maxProfitableHolding = period;
      }
    }

    const grossAlphaAtOptimal = this.integrateCumulativeAlpha(
      profile.initialStrength,
      0,
      optimalPeriod,
      profile.decayRate,
      profile.decayModel
    ) * positionSize;

    const alphaCaptureEfficiency = profile.initialStrength > 0 && grossAlphaAtOptimal > 0
      ? maxNetAlpha / (profile.initialStrength * positionSize)
      : 0;

    const costDelta = 0.01;
    const optimalWithHigherCost = this.findOptimalPeriodWithCost(
      profile,
      positionSize,
      totalCostRate + costDelta
    );
    const costSensitivity = (optimalPeriod - optimalWithHigherCost) / costDelta;

    const annualizedReturn = optimalPeriod > 0
      ? (maxNetAlpha / positionSize) * (this.config.periodsPerYear / optimalPeriod) * 100
      : 0;

    const result: HoldingPeriodAnalysis = {
      optimalDuration: optimalPeriod,
      expectedGrossAlpha: grossAlphaAtOptimal,
      expectedNetAlpha: maxNetAlpha,
      totalTransactionCosts,
      alphaCaptureEfficiency,
      breakevenPeriod: breakevenPeriod === Infinity ? 0 : breakevenPeriod,
      maxProfitableHolding,
      costSensitivity,
      annualizedReturn,
    };

    logger.info('Optimal holding period calculated', {
      optimalPeriod: optimalPeriod.toFixed(1),
      netAlpha: maxNetAlpha.toFixed(2),
      annualizedReturn: `${annualizedReturn.toFixed(2)}%`,
    });

    return result;
  }

  private groupAlphaByHoldingPeriod(
    observations: AlphaObservation[]
  ): Map<number, number[]> {
    const grouped = new Map<number, number[]>();

    for (const obs of observations) {
      const alpha = obs.benchmarkReturn !== undefined
        ? obs.forwardReturn - obs.benchmarkReturn
        : obs.forwardReturn - this.config.riskFreeRate / this.config.periodsPerYear;

      const existing = grouped.get(obs.holdingPeriod) || [];
      existing.push(alpha * obs.signalValue);
      grouped.set(obs.holdingPeriod, existing);
    }

    return grouped;
  }

  private fitDecayModel(
    periods: number[],
    normalizedAlpha: number[],
    modelType: DecayModelType
  ): { decayRate: number; rSquared: number; stdError: number } {
    let xData: number[];
    let yData: number[];

    switch (modelType) {
      case 'exponential':
        xData = periods;
        yData = normalizedAlpha.map(a => Math.log(Math.max(a, 1e-10)));
        break;
      case 'hyperbolic':
        xData = periods.map(p => Math.log(1 + p));
        yData = normalizedAlpha.map(a => Math.log(Math.max(a, 1e-10)));
        break;
      case 'power_law':
        xData = periods.map(p => Math.log(Math.max(p, 0.01)));
        yData = normalizedAlpha.map(a => Math.log(Math.max(a, 1e-10)));
        break;
      case 'linear':
      default:
        xData = periods;
        yData = normalizedAlpha;
    }

    const { slope, intercept, rSquared, slopeStdError } = this.linearRegression(
      xData,
      yData,
      this.config.useWeightedRegression ? normalizedAlpha : undefined
    );

    const decayRate = modelType === 'linear' ? -slope : -slope;

    return {
      decayRate: Math.abs(decayRate),
      rSquared,
      stdError: Math.abs(slopeStdError),
    };
  }

  private linearRegression(
    x: number[],
    y: number[],
    weights?: number[]
  ): { slope: number; intercept: number; rSquared: number; slopeStdError: number } {
    const n = x.length;
    const w = weights || Array(n).fill(1);
    const sumW = w.reduce((a, b) => a + b, 0);

    const sumX = x.reduce((sum, xi, i) => sum + w[i] * xi, 0);
    const sumY = y.reduce((sum, yi, i) => sum + w[i] * yi, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + w[i] * xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi, i) => sum + w[i] * xi * xi, 0);

    const meanX = sumX / sumW;
    const meanY = sumY / sumW;

    const denominator = sumX2 - sumX * sumX / sumW;
    if (Math.abs(denominator) < 1e-10) {
      return { slope: 0, intercept: meanY, rSquared: 0, slopeStdError: Infinity };
    }

    const slope = (sumXY - sumX * sumY / sumW) / denominator;
    const intercept = meanY - slope * meanX;

    const predicted = x.map(xi => slope * xi + intercept);
    const ssRes = y.reduce((sum, yi, i) => sum + w[i] * Math.pow(yi - predicted[i], 2), 0);
    const ssTot = y.reduce((sum, yi, i) => sum + w[i] * Math.pow(yi - meanY, 2), 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    const mse = ssRes / (n - 2);
    const slopeStdError = Math.sqrt(mse / denominator);

    return { slope, intercept, rSquared, slopeStdError };
  }

  private calculateHalfLifeFromRate(
    decayRate: number,
    modelType: DecayModelType
  ): number {
    if (decayRate <= 0) return Infinity;

    switch (modelType) {
      case 'exponential':
        return Math.log(2) / decayRate;
      case 'hyperbolic':
        return Math.exp(Math.log(2) / decayRate) - 1;
      case 'power_law':
        return Math.exp(Math.log(0.5) / -decayRate);
      case 'linear':
        return 0.5 / decayRate;
      default:
        return Math.log(2) / decayRate;
    }
  }

  private calculateDecayedStrength(
    initialStrength: number,
    time: number,
    decayRate: number,
    modelType: DecayModelType
  ): number {
    switch (modelType) {
      case 'exponential':
        return initialStrength * Math.exp(-decayRate * time);
      case 'hyperbolic':
        return initialStrength / Math.pow(1 + time, decayRate);
      case 'power_law':
        return initialStrength * Math.pow(Math.max(time, 0.01), -decayRate);
      case 'linear':
        return Math.max(0, initialStrength * (1 - decayRate * time));
      default:
        return initialStrength * Math.exp(-decayRate * time);
    }
  }

  private integrateCumulativeAlpha(
    initialStrength: number,
    startTime: number,
    endTime: number,
    decayRate: number,
    modelType: DecayModelType
  ): number {
    const numSteps = 100;
    const step = (endTime - startTime) / numSteps;
    let integral = 0;

    for (let i = 0; i < numSteps; i++) {
      const t1 = startTime + i * step;
      const t2 = t1 + step;
      const s1 = this.calculateDecayedStrength(initialStrength, t1, decayRate, modelType);
      const s2 = this.calculateDecayedStrength(initialStrength, t2, decayRate, modelType);
      integral += (s1 + s2) / 2 * step;
    }

    return integral;
  }

  private findOptimalPeriodWithCost(
    profile: SignalDecayProfile,
    positionSize: number,
    costRate: number
  ): number {
    let optimalPeriod = 0;
    let maxNetAlpha = -Infinity;
    const searchStep = 0.1;
    const maxSearch = this.config.maxLagPeriods * 2;

    for (let period = searchStep; period <= maxSearch; period += searchStep) {
      const cumulativeAlpha = this.integrateCumulativeAlpha(
        profile.initialStrength,
        0,
        period,
        profile.decayRate,
        profile.decayModel
      );
      const netAlpha = cumulativeAlpha * positionSize - positionSize * costRate;

      if (netAlpha > maxNetAlpha) {
        maxNetAlpha = netAlpha;
        optimalPeriod = period;
      }
    }

    return optimalPeriod;
  }
}

/**
 * TurnoverOptimizer class
 * Optimizes portfolio turnover to balance alpha capture vs transaction costs
 */
export class TurnoverOptimizer {
  private config: TurnoverConfig;
  private decayAnalyzer: AlphaDecayAnalyzer;

  /**
   * Create a new TurnoverOptimizer
   * @param config - Configuration for turnover optimization
   * @param decayAnalyzer - Optional AlphaDecayAnalyzer instance
   */
  constructor(
    config: Partial<TurnoverConfig> = {},
    decayAnalyzer?: AlphaDecayAnalyzer
  ) {
    this.config = {
      currentTurnover: config.currentTurnover ?? 2.0,
      transactionCostBps: config.transactionCostBps ?? 10,
      marketImpactBps: config.marketImpactBps ?? 5,
      bidAskSpreadBps: config.bidAskSpreadBps ?? 5,
      shortTermTaxRate: config.shortTermTaxRate ?? 0.35,
      longTermTaxRate: config.longTermTaxRate ?? 0.15,
      longTermThresholdDays: config.longTermThresholdDays ?? 365,
      maxTrackingError: config.maxTrackingError,
    };
    this.decayAnalyzer = decayAnalyzer || new AlphaDecayAnalyzer();

    logger.info('TurnoverOptimizer initialized', {
      transactionCostBps: this.config.transactionCostBps,
      shortTermTaxRate: this.config.shortTermTaxRate,
    });
  }

  /**
   * Calculate optimal rebalancing frequency given signal decay and costs
   * 
   * @param decayProfile - Signal decay profile
   * @param expectedAlpha - Expected gross alpha (annual, decimal)
   * @param portfolioSize - Total portfolio size in dollars
   * @returns Optimal turnover and rebalancing frequency
   */
  optimizeRebalanceFrequency(
    decayProfile: SignalDecayProfile,
    expectedAlpha: number,
    portfolioSize: number
  ): TurnoverOptimizationResult {
    const totalCostBps = this.config.transactionCostBps +
      this.config.bidAskSpreadBps / 2 +
      this.config.marketImpactBps;
    const costPerTrade = totalCostBps / 10000;

    let optimalTurnover = 0;
    let maxNetAlpha = -Infinity;
    let optimalFrequency = 0;

    const turnovers = [];
    const netAlphas = [];

    for (let turnover = 0.1; turnover <= 20; turnover += 0.1) {
      const frequency = turnover;
      const periodsBetweenRebalance = 252 / frequency;

      const alphaDecayFactor = this.calculateAlphaDecayFactor(
        decayProfile,
        periodsBetweenRebalance
      );

      const grossAlphaCaptured = expectedAlpha * alphaDecayFactor;
      const transactionCosts = turnover * 2 * costPerTrade;
      const taxCost = this.estimateTaxCost(turnover, grossAlphaCaptured);
      const netAlpha = grossAlphaCaptured - transactionCosts - taxCost;

      turnovers.push(turnover);
      netAlphas.push(netAlpha);

      if (netAlpha > maxNetAlpha) {
        maxNetAlpha = netAlpha;
        optimalTurnover = turnover;
        optimalFrequency = frequency;
      }
    }

    const alphaDecayLoss = expectedAlpha - (expectedAlpha * this.calculateAlphaDecayFactor(
      decayProfile,
      252 / optimalFrequency
    ));

    const grossAlphaAtOptimal = expectedAlpha * this.calculateAlphaDecayFactor(
      decayProfile,
      252 / optimalFrequency
    );
    const costsAtOptimal = optimalTurnover * 2 * costPerTrade;
    const taxAtOptimal = this.estimateTaxCost(optimalTurnover, grossAlphaAtOptimal);

    const volatility = this.estimateTrackingError(optimalTurnover, decayProfile);
    const informationRatio = volatility > 0 ? maxNetAlpha / volatility : 0;

    const taxEfficiency = grossAlphaAtOptimal > 0
      ? 1 - (taxAtOptimal / grossAlphaAtOptimal)
      : 1;

    const turnoverToAlpha = this.calculateSensitivity(
      turnovers,
      netAlphas,
      optimalTurnover,
      'alpha'
    );
    const turnoverToCost = this.calculateSensitivity(
      turnovers,
      netAlphas,
      optimalTurnover,
      'cost'
    );

    const optimalRange = this.findOptimalRange(turnovers, netAlphas, maxNetAlpha * 0.95);

    const result: TurnoverOptimizationResult = {
      optimalTurnover,
      optimalRebalanceFrequency: optimalFrequency,
      expectedGrossAlpha: grossAlphaAtOptimal,
      totalTransactionCosts: costsAtOptimal,
      expectedNetAlpha: maxNetAlpha,
      informationRatio,
      alphaDecayLoss,
      taxEfficiency,
      sensitivity: {
        turnoverToAlpha,
        turnoverToCost,
        optimalTurnoverRange: optimalRange,
      },
    };

    logger.info('Turnover optimization complete', {
      optimalTurnover: optimalTurnover.toFixed(2),
      optimalFrequency: optimalFrequency.toFixed(1),
      netAlpha: `${(maxNetAlpha * 100).toFixed(2)}%`,
      informationRatio: informationRatio.toFixed(2),
    });

    return result;
  }

  /**
   * Estimate expected returns net of all costs
   * 
   * @param turnover - Annual turnover rate
   * @param grossAlpha - Expected gross alpha
   * @param portfolioSize - Portfolio size in dollars
   * @returns Net expected return after all costs
   */
  estimateNetReturns(
    turnover: number,
    grossAlpha: number,
    portfolioSize: number
  ): {
    grossReturn: number;
    transactionCosts: number;
    marketImpact: number;
    taxes: number;
    netReturn: number;
    costBreakdown: { type: string; amount: number }[];
  } {
    const transactionCosts = turnover * 2 * (this.config.transactionCostBps / 10000);
    const spreadCosts = turnover * 2 * (this.config.bidAskSpreadBps / 20000);
    const marketImpact = turnover * 2 * (this.config.marketImpactBps / 10000);
    const taxes = this.estimateTaxCost(turnover, grossAlpha);

    const totalCosts = transactionCosts + spreadCosts + marketImpact + taxes;
    const netReturn = grossAlpha - totalCosts;

    return {
      grossReturn: grossAlpha,
      transactionCosts: transactionCosts + spreadCosts,
      marketImpact,
      taxes,
      netReturn,
      costBreakdown: [
        { type: 'Transaction Costs', amount: transactionCosts * portfolioSize },
        { type: 'Bid-Ask Spread', amount: spreadCosts * portfolioSize },
        { type: 'Market Impact', amount: marketImpact * portfolioSize },
        { type: 'Taxes', amount: taxes * portfolioSize },
      ],
    };
  }

  private calculateAlphaDecayFactor(
    profile: SignalDecayProfile,
    periodsBetweenRebalance: number
  ): number {
    const avgDecay = this.integrateDecay(profile, 0, periodsBetweenRebalance);
    return avgDecay;
  }

  private integrateDecay(
    profile: SignalDecayProfile,
    start: number,
    end: number
  ): number {
    const steps = 100;
    const stepSize = (end - start) / steps;
    let sum = 0;

    for (let i = 0; i < steps; i++) {
      const t = start + i * stepSize;
      let decayedValue: number;

      switch (profile.decayModel) {
        case 'exponential':
          decayedValue = Math.exp(-profile.decayRate * t);
          break;
        case 'hyperbolic':
          decayedValue = 1 / Math.pow(1 + t, profile.decayRate);
          break;
        case 'power_law':
          decayedValue = Math.pow(Math.max(t, 0.01), -profile.decayRate);
          break;
        case 'linear':
          decayedValue = Math.max(0, 1 - profile.decayRate * t);
          break;
        default:
          decayedValue = Math.exp(-profile.decayRate * t);
      }
      sum += decayedValue * stepSize;
    }

    return sum / (end - start);
  }

  private estimateTaxCost(turnover: number, gains: number): number {
    const shortTermFraction = Math.min(1, turnover);
    const longTermFraction = 1 - shortTermFraction;

    return gains * (
      shortTermFraction * this.config.shortTermTaxRate +
      longTermFraction * this.config.longTermTaxRate
    );
  }

  private estimateTrackingError(turnover: number, profile: SignalDecayProfile): number {
    const baseTE = 0.02;
    const turnoverFactor = 1 + turnover * 0.01;
    return baseTE * turnoverFactor;
  }

  private calculateSensitivity(
    turnovers: number[],
    netAlphas: number[],
    optimalPoint: number,
    type: 'alpha' | 'cost'
  ): number {
    const idx = turnovers.findIndex(t => Math.abs(t - optimalPoint) < 0.05);
    if (idx < 1 || idx >= turnovers.length - 1) return 0;

    const delta = (netAlphas[idx + 1] - netAlphas[idx - 1]) / 
                  (turnovers[idx + 1] - turnovers[idx - 1]);
    return delta;
  }

  private findOptimalRange(
    turnovers: number[],
    netAlphas: number[],
    threshold: number
  ): [number, number] {
    let lower = turnovers[0];
    let upper = turnovers[turnovers.length - 1];

    for (let i = 0; i < turnovers.length; i++) {
      if (netAlphas[i] >= threshold) {
        lower = turnovers[i];
        break;
      }
    }

    for (let i = turnovers.length - 1; i >= 0; i--) {
      if (netAlphas[i] >= threshold) {
        upper = turnovers[i];
        break;
      }
    }

    return [lower, upper];
  }
}

/**
 * InformationDecayCurve class
 * Models information content decay and multi-signal aggregation
 */
export class InformationDecayCurve {
  private signals: Map<string, InformationDecayParams>;
  private correlationMatrix: number[][];

  /**
   * Create a new InformationDecayCurve
   */
  constructor() {
    this.signals = new Map();
    this.correlationMatrix = [];

    logger.info('InformationDecayCurve initialized');
  }

  /**
   * Add a signal to the decay curve model
   * 
   * @param params - Signal decay parameters
   */
  addSignal(params: InformationDecayParams): void {
    this.signals.set(params.signalId, params);
    this.updateCorrelationMatrix();

    logger.debug('Signal added to decay model', {
      signalId: params.signalId,
      halfLife: params.halfLife,
      signalQuality: params.signalQuality,
    });
  }

  /**
   * Remove a signal from the model
   * 
   * @param signalId - ID of signal to remove
   */
  removeSignal(signalId: string): void {
    this.signals.delete(signalId);
    this.updateCorrelationMatrix();
  }

  /**
   * Calculate information content at a given time point
   * Information decays while noise accumulates
   * 
   * @param signalId - Signal to evaluate
   * @param time - Time since signal generation
   * @returns Information content remaining (0-1 scale)
   */
  getInformationContent(signalId: string, time: number): number {
    const params = this.signals.get(signalId);
    if (!params) {
      throw new Error(`Signal not found: ${signalId}`);
    }

    const decayFactor = Math.exp(-Math.log(2) * time / params.halfLife);
    const informationRemaining = params.initialInformation * decayFactor;

    const noiseAccumulated = params.noiseRate * time;
    const signalToNoise = informationRemaining / (informationRemaining + noiseAccumulated);

    return signalToNoise * params.signalQuality;
  }

  /**
   * Calculate the signal strength vs staleness tradeoff curve
   * 
   * @param signalId - Signal to analyze
   * @param maxTime - Maximum time to project
   * @param numPoints - Number of curve points
   * @returns Array of time/strength/staleness points
   */
  getSignalStalenessTradeoff(
    signalId: string,
    maxTime: number,
    numPoints: number = 50
  ): {
    time: number;
    strength: number;
    staleness: number;
    effectiveValue: number;
  }[] {
    const params = this.signals.get(signalId);
    if (!params) {
      throw new Error(`Signal not found: ${signalId}`);
    }

    const points: {
      time: number;
      strength: number;
      staleness: number;
      effectiveValue: number;
    }[] = [];

    const step = maxTime / numPoints;

    for (let i = 0; i <= numPoints; i++) {
      const time = i * step;
      const strength = this.getInformationContent(signalId, time);
      const staleness = 1 - Math.exp(-time / params.halfLife);
      const effectiveValue = strength * (1 - staleness);

      points.push({ time, strength, staleness, effectiveValue });
    }

    return points;
  }

  /**
   * Aggregate multiple signals with decay-aware weighting
   * 
   * @param signalIds - IDs of signals to aggregate
   * @param currentTime - Current time since signals were generated
   * @param signalAges - Optional map of signal ages (if different)
   * @returns Aggregated signal decay analysis
   */
  aggregateSignals(
    signalIds: string[],
    currentTime: number,
    signalAges?: Map<string, number>
  ): AggregatedSignalDecay {
    const activeSignals = signalIds
      .map(id => this.signals.get(id))
      .filter((s): s is InformationDecayParams => s !== undefined);

    if (activeSignals.length === 0) {
      throw new Error('No valid signals to aggregate');
    }

    const signalWeights = new Map<string, number>();
    let totalWeight = 0;

    for (const signal of activeSignals) {
      const age = signalAges?.get(signal.signalId) ?? currentTime;
      const content = this.getInformationContent(signal.signalId, age);
      signalWeights.set(signal.signalId, content);
      totalWeight += content;
    }

    for (const [id, weight] of signalWeights) {
      signalWeights.set(id, totalWeight > 0 ? weight / totalWeight : 1 / activeSignals.length);
    }

    let weightedDecayRate = 0;
    for (const signal of activeSignals) {
      const weight = signalWeights.get(signal.signalId) || 0;
      const decayRate = Math.log(2) / signal.halfLife;
      weightedDecayRate += weight * decayRate;
    }

    const effectiveHalfLife = weightedDecayRate > 0 
      ? Math.log(2) / weightedDecayRate 
      : Infinity;

    const maxProjection = Math.max(...activeSignals.map(s => s.halfLife * 3));
    const combinedStrengthCurve = this.projectCombinedStrength(
      activeSignals,
      signalWeights,
      maxProjection
    );

    const avgHalfLife = activeSignals.reduce((sum, s) => sum + s.halfLife, 0) / activeSignals.length;
    const diversificationBenefit = avgHalfLife > 0 
      ? (effectiveHalfLife - avgHalfLife) / avgHalfLife 
      : 0;

    const signalCorrelations = this.getCorrelationSubmatrix(signalIds);

    const result: AggregatedSignalDecay = {
      effectiveHalfLife,
      weightedDecayRate,
      signalWeights,
      combinedStrengthCurve,
      diversificationBenefit: Math.max(0, diversificationBenefit),
      signalCorrelations,
    };

    logger.info('Signals aggregated', {
      numSignals: activeSignals.length,
      effectiveHalfLife: effectiveHalfLife.toFixed(2),
      diversificationBenefit: `${(diversificationBenefit * 100).toFixed(1)}%`,
    });

    return result;
  }

  /**
   * Get decay profiles for all registered signals
   */
  getAllSignals(): InformationDecayParams[] {
    return Array.from(this.signals.values());
  }

  private updateCorrelationMatrix(): void {
    const signals = Array.from(this.signals.values());
    const n = signals.length;

    this.correlationMatrix = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          this.correlationMatrix[i][j] = 1;
        } else {
          const corr = signals[i].regimeCorrelation * signals[j].regimeCorrelation;
          this.correlationMatrix[i][j] = corr;
        }
      }
    }
  }

  private projectCombinedStrength(
    signals: InformationDecayParams[],
    weights: Map<string, number>,
    maxTime: number
  ): DecayCurvePoint[] {
    const points: DecayCurvePoint[] = [];
    const numPoints = 100;
    const step = maxTime / numPoints;

    let cumulativeAlpha = 0;

    for (let i = 0; i <= numPoints; i++) {
      const time = i * step;
      let combinedStrength = 0;

      for (const signal of signals) {
        const weight = weights.get(signal.signalId) || 0;
        const strength = this.getInformationContent(signal.signalId, time);
        combinedStrength += weight * strength;
      }

      const alpha = combinedStrength;
      const periodAlpha = i === 0 ? 0 : alpha * step;
      cumulativeAlpha += periodAlpha;

      points.push({
        period: time,
        strength: combinedStrength,
        alpha,
        cumulativeAlpha,
      });
    }

    return points;
  }

  private getCorrelationSubmatrix(signalIds: string[]): number[][] {
    const signals = Array.from(this.signals.keys());
    const indices = signalIds.map(id => signals.indexOf(id)).filter(i => i >= 0);

    return indices.map(i => 
      indices.map(j => 
        i < this.correlationMatrix.length && j < this.correlationMatrix[i].length
          ? this.correlationMatrix[i][j]
          : i === j ? 1 : 0
      )
    );
  }
}

/**
 * Factory function to create an AlphaDecayAnalyzer with default or custom configuration
 * 
 * @param config - Optional configuration overrides
 * @returns Configured AlphaDecayAnalyzer instance
 */
export function createAlphaDecayAnalyzer(
  config: Partial<AlphaDecayConfig> = {}
): AlphaDecayAnalyzer {
  return new AlphaDecayAnalyzer(config);
}

/**
 * Factory function to create a TurnoverOptimizer with default or custom configuration
 * 
 * @param config - Optional turnover configuration overrides
 * @param decayAnalyzer - Optional AlphaDecayAnalyzer to use
 * @returns Configured TurnoverOptimizer instance
 */
export function createTurnoverOptimizer(
  config: Partial<TurnoverConfig> = {},
  decayAnalyzer?: AlphaDecayAnalyzer
): TurnoverOptimizer {
  return new TurnoverOptimizer(config, decayAnalyzer);
}

/**
 * Factory function to create an InformationDecayCurve
 * 
 * @returns New InformationDecayCurve instance
 */
export function createInformationDecayCurve(): InformationDecayCurve {
  return new InformationDecayCurve();
}
