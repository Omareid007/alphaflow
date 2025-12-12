/**
 * AI Active Trader - Advanced Market Regime Detection
 * Implements HMM-based regime classification and Bayesian changepoint detection
 * 
 * Features:
 * - Hidden Markov Model (HMM) for probabilistic regime inference
 * - Bayesian Online Changepoint Detection (BOCD)
 * - Regime transition probability tracking
 * - Multi-timeframe regime analysis
 * - Regime persistence and stability metrics
 */

import { createLogger } from '../common';

const logger = createLogger('market-regime-ml');

// Enhanced regime types based on market microstructure
export enum MLRegimeType {
  TRENDING_UP = 'trending_up',
  TRENDING_DOWN = 'trending_down',
  MEAN_REVERTING = 'mean_reverting',
  HIGH_VOLATILITY = 'high_volatility',
  LOW_VOLATILITY = 'low_volatility',
  BREAKOUT = 'breakout',
  CONSOLIDATION = 'consolidation',
}

// HMM state representation
export interface HMMState {
  regime: MLRegimeType;
  probability: number;
  meanReturn: number;
  volatility: number;
  persistence: number;
}

// Regime detection result with full probabilistic context
export interface RegimeDetectionResult {
  currentRegime: MLRegimeType;
  confidence: number;
  stateProbabilities: Map<MLRegimeType, number>;
  transitionMatrix: number[][];
  changepointProbability: number;
  regimeDuration: number;
  expectedDuration: number;
  stability: number;
  features: RegimeFeatures;
  timestamp: Date;
}

// Features extracted for regime classification
export interface RegimeFeatures {
  returns: number[];
  volatility: number;
  skewness: number;
  kurtosis: number;
  hurst: number;
  autocorrelation: number;
  trendStrength: number;
  meanReversionSpeed: number;
  volumeProfile: number;
}

// Changepoint detection result
export interface ChangepointResult {
  detected: boolean;
  probability: number;
  location: number;
  previousRegime: MLRegimeType | null;
  newRegime: MLRegimeType | null;
  confidence: number;
}

// Configuration for ML regime detector
export interface MLRegimeConfig {
  numStates: number;
  lookbackPeriod: number;
  minDataPoints: number;
  changepointThreshold: number;
  hazardRate: number;
  emIterations: number;
  convergenceThreshold: number;
  featureWindowSize: number;
}

const DEFAULT_CONFIG: MLRegimeConfig = {
  numStates: 5,
  lookbackPeriod: 252,
  minDataPoints: 30,
  changepointThreshold: 0.7,
  hazardRate: 1 / 50,
  emIterations: 100,
  convergenceThreshold: 1e-6,
  featureWindowSize: 20,
};

/**
 * Hidden Markov Model for regime classification
 * Implements Baum-Welch algorithm for parameter estimation
 * and Viterbi algorithm for state sequence decoding
 */
export class HiddenMarkovModel {
  private numStates: number;
  private transitionMatrix: number[][];
  private emissionMeans: number[];
  private emissionVariances: number[];
  private initialDistribution: number[];
  private stateLabels: MLRegimeType[];
  
  constructor(numStates: number = 5) {
    this.numStates = numStates;
    this.transitionMatrix = this.initializeTransitionMatrix();
    this.emissionMeans = this.initializeEmissionMeans();
    this.emissionVariances = this.initializeEmissionVariances();
    this.initialDistribution = this.initializeInitialDistribution();
    this.stateLabels = [
      MLRegimeType.TRENDING_UP,
      MLRegimeType.TRENDING_DOWN,
      MLRegimeType.MEAN_REVERTING,
      MLRegimeType.HIGH_VOLATILITY,
      MLRegimeType.LOW_VOLATILITY,
    ].slice(0, numStates);
  }

  private initializeTransitionMatrix(): number[][] {
    const matrix: number[][] = [];
    for (let i = 0; i < this.numStates; i++) {
      const row: number[] = [];
      let sum = 0;
      for (let j = 0; j < this.numStates; j++) {
        const val = i === j ? 0.8 : 0.2 / (this.numStates - 1);
        row.push(val);
        sum += val;
      }
      matrix.push(row.map(v => v / sum));
    }
    return matrix;
  }

  private initializeEmissionMeans(): number[] {
    return [0.001, -0.001, 0, 0, 0].slice(0, this.numStates);
  }

  private initializeEmissionVariances(): number[] {
    return [0.0004, 0.0004, 0.0002, 0.001, 0.0001].slice(0, this.numStates);
  }

  private initializeInitialDistribution(): number[] {
    return Array(this.numStates).fill(1 / this.numStates);
  }

  // Gaussian emission probability
  private emissionProbability(observation: number, state: number): number {
    const mean = this.emissionMeans[state];
    const variance = this.emissionVariances[state];
    const stdDev = Math.sqrt(variance);
    const exponent = -Math.pow(observation - mean, 2) / (2 * variance);
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
  }

  // Forward algorithm for computing likelihood
  forward(observations: number[]): { alpha: number[][]; scaling: number[] } {
    const T = observations.length;
    const alpha: number[][] = [];
    const scaling: number[] = [];

    // Initialize
    const alpha0: number[] = [];
    let scale0 = 0;
    for (let i = 0; i < this.numStates; i++) {
      const val = this.initialDistribution[i] * this.emissionProbability(observations[0], i);
      alpha0.push(val);
      scale0 += val;
    }
    scaling.push(scale0);
    alpha.push(alpha0.map(v => v / scale0));

    // Recurse
    for (let t = 1; t < T; t++) {
      const alphaT: number[] = [];
      let scaleT = 0;
      for (let j = 0; j < this.numStates; j++) {
        let sum = 0;
        for (let i = 0; i < this.numStates; i++) {
          sum += alpha[t - 1][i] * this.transitionMatrix[i][j];
        }
        const val = sum * this.emissionProbability(observations[t], j);
        alphaT.push(val);
        scaleT += val;
      }
      scaling.push(scaleT);
      alpha.push(alphaT.map(v => v / (scaleT || 1e-10)));
    }

    return { alpha, scaling };
  }

  // Backward algorithm
  backward(observations: number[], scaling: number[]): number[][] {
    const T = observations.length;
    const beta: number[][] = Array(T).fill(null).map(() => []);

    // Initialize
    beta[T - 1] = Array(this.numStates).fill(1 / scaling[T - 1]);

    // Recurse
    for (let t = T - 2; t >= 0; t--) {
      for (let i = 0; i < this.numStates; i++) {
        let sum = 0;
        for (let j = 0; j < this.numStates; j++) {
          sum += this.transitionMatrix[i][j] * 
                 this.emissionProbability(observations[t + 1], j) * 
                 beta[t + 1][j];
        }
        beta[t][i] = sum / scaling[t];
      }
    }

    return beta;
  }

  // Baum-Welch algorithm for parameter estimation (EM)
  fit(observations: number[], maxIterations: number = 100, tolerance: number = 1e-6): void {
    let prevLogLikelihood = -Infinity;

    for (let iter = 0; iter < maxIterations; iter++) {
      const { alpha, scaling } = this.forward(observations);
      const beta = this.backward(observations, scaling);
      const T = observations.length;

      // Compute gamma and xi
      const gamma: number[][] = [];
      const xi: number[][][] = [];

      for (let t = 0; t < T; t++) {
        const gammaT: number[] = [];
        let sum = 0;
        for (let i = 0; i < this.numStates; i++) {
          const val = alpha[t][i] * beta[t][i];
          gammaT.push(val);
          sum += val;
        }
        gamma.push(gammaT.map(v => v / (sum || 1e-10)));
      }

      for (let t = 0; t < T - 1; t++) {
        const xiT: number[][] = [];
        let sum = 0;
        for (let i = 0; i < this.numStates; i++) {
          const xiTI: number[] = [];
          for (let j = 0; j < this.numStates; j++) {
            const val = alpha[t][i] * this.transitionMatrix[i][j] *
                       this.emissionProbability(observations[t + 1], j) * beta[t + 1][j];
            xiTI.push(val);
            sum += val;
          }
          xiT.push(xiTI);
        }
        xi.push(xiT.map(row => row.map(v => v / (sum || 1e-10))));
      }

      // Update parameters
      // Initial distribution
      for (let i = 0; i < this.numStates; i++) {
        this.initialDistribution[i] = gamma[0][i];
      }

      // Transition matrix
      for (let i = 0; i < this.numStates; i++) {
        let gammaSum = 0;
        for (let t = 0; t < T - 1; t++) {
          gammaSum += gamma[t][i];
        }
        for (let j = 0; j < this.numStates; j++) {
          let xiSum = 0;
          for (let t = 0; t < T - 1; t++) {
            xiSum += xi[t][i][j];
          }
          this.transitionMatrix[i][j] = xiSum / (gammaSum || 1e-10);
        }
      }

      // Emission parameters
      for (let i = 0; i < this.numStates; i++) {
        let gammaSum = 0;
        let meanNumerator = 0;
        let varNumerator = 0;

        for (let t = 0; t < T; t++) {
          gammaSum += gamma[t][i];
          meanNumerator += gamma[t][i] * observations[t];
        }

        this.emissionMeans[i] = meanNumerator / (gammaSum || 1e-10);

        for (let t = 0; t < T; t++) {
          varNumerator += gamma[t][i] * Math.pow(observations[t] - this.emissionMeans[i], 2);
        }

        this.emissionVariances[i] = Math.max(1e-8, varNumerator / (gammaSum || 1e-10));
      }

      // Check convergence
      const logLikelihood = scaling.reduce((sum, s) => sum + Math.log(s || 1e-10), 0);
      if (Math.abs(logLikelihood - prevLogLikelihood) < tolerance) {
        logger.debug('HMM converged', { iterations: iter + 1, logLikelihood });
        break;
      }
      prevLogLikelihood = logLikelihood;
    }
  }

  // Viterbi algorithm for most likely state sequence
  viterbi(observations: number[]): { states: number[]; probability: number } {
    const T = observations.length;
    const delta: number[][] = [];
    const psi: number[][] = [];

    // Initialize
    const delta0: number[] = [];
    for (let i = 0; i < this.numStates; i++) {
      delta0.push(Math.log(this.initialDistribution[i]) + 
                  Math.log(this.emissionProbability(observations[0], i) || 1e-10));
    }
    delta.push(delta0);
    psi.push(Array(this.numStates).fill(0));

    // Recurse
    for (let t = 1; t < T; t++) {
      const deltaT: number[] = [];
      const psiT: number[] = [];
      for (let j = 0; j < this.numStates; j++) {
        let maxVal = -Infinity;
        let maxIdx = 0;
        for (let i = 0; i < this.numStates; i++) {
          const val = delta[t - 1][i] + Math.log(this.transitionMatrix[i][j] || 1e-10);
          if (val > maxVal) {
            maxVal = val;
            maxIdx = i;
          }
        }
        deltaT.push(maxVal + Math.log(this.emissionProbability(observations[t], j) || 1e-10));
        psiT.push(maxIdx);
      }
      delta.push(deltaT);
      psi.push(psiT);
    }

    // Backtrack
    const states: number[] = Array(T);
    let maxVal = -Infinity;
    let maxIdx = 0;
    for (let i = 0; i < this.numStates; i++) {
      if (delta[T - 1][i] > maxVal) {
        maxVal = delta[T - 1][i];
        maxIdx = i;
      }
    }
    states[T - 1] = maxIdx;

    for (let t = T - 2; t >= 0; t--) {
      states[t] = psi[t + 1][states[t + 1]];
    }

    return { states, probability: Math.exp(maxVal) };
  }

  // Get current state probabilities
  getStateProbabilities(observations: number[]): Map<MLRegimeType, number> {
    const { alpha, scaling } = this.forward(observations);
    const lastAlpha = alpha[alpha.length - 1];
    
    const probabilities = new Map<MLRegimeType, number>();
    for (let i = 0; i < this.numStates; i++) {
      probabilities.set(this.stateLabels[i], lastAlpha[i]);
    }
    
    return probabilities;
  }

  // Get transition matrix
  getTransitionMatrix(): number[][] {
    return this.transitionMatrix.map(row => [...row]);
  }

  // Get state parameters
  getStateParameters(): HMMState[] {
    return this.stateLabels.map((label, i) => ({
      regime: label,
      probability: this.initialDistribution[i],
      meanReturn: this.emissionMeans[i],
      volatility: Math.sqrt(this.emissionVariances[i]),
      persistence: this.transitionMatrix[i][i],
    }));
  }
}

/**
 * Bayesian Online Changepoint Detection (BOCD)
 * Detects structural breaks in time series data in real-time
 */
export class BayesianChangepointDetector {
  private hazardRate: number;
  private muPrior: number;
  private kappaPrior: number;
  private alphaPrior: number;
  private betaPrior: number;
  private runLengthDistribution: number[];
  private maxRunLength: number;
  private mu: number[];
  private kappa: number[];
  private alpha: number[];
  private beta: number[];
  
  constructor(hazardRate: number = 1 / 50, maxRunLength: number = 500) {
    this.hazardRate = hazardRate;
    this.maxRunLength = maxRunLength;
    this.muPrior = 0;
    this.kappaPrior = 1;
    this.alphaPrior = 1;
    this.betaPrior = 1;
    this.runLengthDistribution = [1];
    this.mu = [this.muPrior];
    this.kappa = [this.kappaPrior];
    this.alpha = [this.alphaPrior];
    this.beta = [this.betaPrior];
  }

  // Student-t predictive probability
  private studentTPredictive(x: number, idx: number): number {
    const df = 2 * this.alpha[idx];
    const scale = Math.sqrt(this.beta[idx] * (this.kappa[idx] + 1) / 
                           (this.alpha[idx] * this.kappa[idx]));
    const z = (x - this.mu[idx]) / scale;
    
    const logProb = this.logGamma((df + 1) / 2) - this.logGamma(df / 2) -
                    0.5 * Math.log(df * Math.PI) - Math.log(scale) -
                    ((df + 1) / 2) * Math.log(1 + z * z / df);
    
    return Math.exp(logProb);
  }

  private logGamma(x: number): number {
    const coefficients = [
      76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
    ];
    
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    
    for (let j = 0; j < 6; j++) {
      ser += coefficients[j] / ++y;
    }
    
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  // Update with new observation
  update(x: number): number {
    const n = this.runLengthDistribution.length;
    
    // Compute predictive probabilities
    const predProbs: number[] = [];
    for (let i = 0; i < n; i++) {
      predProbs.push(this.studentTPredictive(x, i));
    }
    
    // Growth probabilities
    const growthProbs = this.runLengthDistribution.map((p, i) => 
      p * predProbs[i] * (1 - this.hazardRate)
    );
    
    // Changepoint probability
    let changepointMass = 0;
    for (let i = 0; i < n; i++) {
      changepointMass += this.runLengthDistribution[i] * predProbs[i] * this.hazardRate;
    }
    
    // New run length distribution
    const newDistribution = [changepointMass, ...growthProbs];
    
    // Normalize
    const sum = newDistribution.reduce((a, b) => a + b, 0);
    this.runLengthDistribution = newDistribution.map(p => p / (sum || 1e-10));
    
    // Truncate if too long
    if (this.runLengthDistribution.length > this.maxRunLength) {
      this.runLengthDistribution = this.runLengthDistribution.slice(0, this.maxRunLength);
      const truncSum = this.runLengthDistribution.reduce((a, b) => a + b, 0);
      this.runLengthDistribution = this.runLengthDistribution.map(p => p / truncSum);
    }
    
    // Update sufficient statistics
    const newMu = [this.muPrior];
    const newKappa = [this.kappaPrior];
    const newAlpha = [this.alphaPrior];
    const newBeta = [this.betaPrior];
    
    for (let i = 0; i < Math.min(n, this.maxRunLength - 1); i++) {
      const kNew = this.kappa[i] + 1;
      const mNew = (this.kappa[i] * this.mu[i] + x) / kNew;
      const aNew = this.alpha[i] + 0.5;
      const bNew = this.beta[i] + 
                   (this.kappa[i] * Math.pow(x - this.mu[i], 2)) / (2 * kNew);
      
      newMu.push(mNew);
      newKappa.push(kNew);
      newAlpha.push(aNew);
      newBeta.push(bNew);
    }
    
    this.mu = newMu;
    this.kappa = newKappa;
    this.alpha = newAlpha;
    this.beta = newBeta;
    
    return this.runLengthDistribution[0];
  }

  // Get changepoint probability
  getChangepointProbability(): number {
    return this.runLengthDistribution[0];
  }

  // Get most likely run length
  getMostLikelyRunLength(): number {
    let maxIdx = 0;
    let maxProb = 0;
    for (let i = 0; i < this.runLengthDistribution.length; i++) {
      if (this.runLengthDistribution[i] > maxProb) {
        maxProb = this.runLengthDistribution[i];
        maxIdx = i;
      }
    }
    return maxIdx;
  }

  // Get expected run length
  getExpectedRunLength(): number {
    let expected = 0;
    for (let i = 0; i < this.runLengthDistribution.length; i++) {
      expected += i * this.runLengthDistribution[i];
    }
    return expected;
  }

  // Reset detector
  reset(): void {
    this.runLengthDistribution = [1];
    this.mu = [this.muPrior];
    this.kappa = [this.kappaPrior];
    this.alpha = [this.alphaPrior];
    this.beta = [this.betaPrior];
  }
}

/**
 * Feature extractor for regime classification
 */
export class RegimeFeatureExtractor {
  private windowSize: number;
  
  constructor(windowSize: number = 20) {
    this.windowSize = windowSize;
  }

  extract(prices: number[]): RegimeFeatures {
    const returns = this.calculateReturns(prices);
    
    return {
      returns,
      volatility: this.calculateVolatility(returns),
      skewness: this.calculateSkewness(returns),
      kurtosis: this.calculateKurtosis(returns),
      hurst: this.calculateHurstExponent(prices),
      autocorrelation: this.calculateAutocorrelation(returns),
      trendStrength: this.calculateTrendStrength(prices),
      meanReversionSpeed: this.calculateMeanReversionSpeed(prices),
      volumeProfile: 0,
    };
  }

  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateSkewness(returns: number[]): number {
    if (returns.length < 3) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const std = this.calculateVolatility(returns);
    if (std === 0) return 0;
    
    const n = returns.length;
    const m3 = returns.reduce((sum, r) => sum + Math.pow(r - mean, 3), 0) / n;
    return m3 / Math.pow(std, 3);
  }

  private calculateKurtosis(returns: number[]): number {
    if (returns.length < 4) return 3;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const std = this.calculateVolatility(returns);
    if (std === 0) return 3;
    
    const n = returns.length;
    const m4 = returns.reduce((sum, r) => sum + Math.pow(r - mean, 4), 0) / n;
    return m4 / Math.pow(std, 4);
  }

  private calculateHurstExponent(prices: number[]): number {
    if (prices.length < 20) return 0.5;
    
    const returns = this.calculateReturns(prices);
    const n = returns.length;
    const mean = returns.reduce((a, b) => a + b, 0) / n;
    
    // Calculate cumulative deviations
    let cumSum = 0;
    const cumDevs: number[] = [];
    for (const r of returns) {
      cumSum += r - mean;
      cumDevs.push(cumSum);
    }
    
    const range = Math.max(...cumDevs) - Math.min(...cumDevs);
    const std = this.calculateVolatility(returns);
    
    if (std === 0 || range === 0) return 0.5;
    
    // R/S statistic
    const rs = range / std;
    
    // Hurst exponent approximation
    return Math.log(rs) / Math.log(n);
  }

  private calculateAutocorrelation(returns: number[], lag: number = 1): number {
    if (returns.length <= lag) return 0;
    
    const n = returns.length;
    const mean = returns.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = lag; i < n; i++) {
      numerator += (returns[i] - mean) * (returns[i - lag] - mean);
    }
    
    for (let i = 0; i < n; i++) {
      denominator += Math.pow(returns[i] - mean, 2);
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateTrendStrength(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const n = prices.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += prices[i];
      sumXY += i * prices[i];
      sumX2 += i * i;
      sumY2 += prices[i] * prices[i];
    }
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateMeanReversionSpeed(prices: number[]): number {
    if (prices.length < 10) return 0;
    
    // Simple Ornstein-Uhlenbeck parameter estimation
    const returns = this.calculateReturns(prices);
    const n = returns.length;
    
    // Estimate mean-reversion speed (kappa)
    let sumXY = 0;
    let sumX2 = 0;
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    for (let i = 0; i < n; i++) {
      const deviation = prices[i] - mean;
      sumXY += returns[i] * deviation;
      sumX2 += deviation * deviation;
    }
    
    return sumX2 === 0 ? 0 : -sumXY / sumX2;
  }
}

/**
 * Main ML-based Market Regime Detector
 * Combines HMM and Bayesian changepoint detection
 */
export class MLMarketRegimeDetector {
  private config: MLRegimeConfig;
  private hmm: HiddenMarkovModel;
  private changepointDetector: BayesianChangepointDetector;
  private featureExtractor: RegimeFeatureExtractor;
  private priceHistory: Map<string, number[]> = new Map();
  private regimeHistory: Map<string, RegimeDetectionResult[]> = new Map();
  private lastRegimes: Map<string, MLRegimeType> = new Map();
  private regimeStartTimes: Map<string, Date> = new Map();
  
  private metrics = {
    detectionsPerformed: 0,
    changepointsDetected: 0,
    avgConfidence: 0,
    regimeTransitions: 0,
  };

  constructor(config?: Partial<MLRegimeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.hmm = new HiddenMarkovModel(this.config.numStates);
    this.changepointDetector = new BayesianChangepointDetector(this.config.hazardRate);
    this.featureExtractor = new RegimeFeatureExtractor(this.config.featureWindowSize);
  }

  // Add price data for a symbol
  addPrice(symbol: string, price: number): void {
    const history = this.priceHistory.get(symbol) || [];
    history.push(price);
    
    // Maintain lookback window
    while (history.length > this.config.lookbackPeriod) {
      history.shift();
    }
    
    this.priceHistory.set(symbol, history);
  }

  // Add multiple prices
  addPrices(symbol: string, prices: number[]): void {
    for (const price of prices) {
      this.addPrice(symbol, price);
    }
  }

  // Detect current regime
  detectRegime(symbol: string): RegimeDetectionResult | null {
    const prices = this.priceHistory.get(symbol);
    
    if (!prices || prices.length < this.config.minDataPoints) {
      logger.debug('Insufficient data for regime detection', {
        symbol,
        dataPoints: prices?.length || 0,
        required: this.config.minDataPoints,
      });
      return null;
    }

    const features = this.featureExtractor.extract(prices);
    const returns = features.returns;

    // Fit HMM on recent data
    this.hmm.fit(returns, this.config.emIterations, this.config.convergenceThreshold);

    // Get state probabilities
    const stateProbabilities = this.hmm.getStateProbabilities(returns);
    
    // Get most likely state sequence
    const { states } = this.hmm.viterbi(returns);
    const currentStateIdx = states[states.length - 1];
    
    // Map state index to regime type
    const regimeLabels = [
      MLRegimeType.TRENDING_UP,
      MLRegimeType.TRENDING_DOWN,
      MLRegimeType.MEAN_REVERTING,
      MLRegimeType.HIGH_VOLATILITY,
      MLRegimeType.LOW_VOLATILITY,
    ];
    const currentRegime = this.inferRegimeFromFeatures(features, regimeLabels[currentStateIdx]);

    // Update changepoint detector
    const lastReturn = returns[returns.length - 1];
    const changepointProb = this.changepointDetector.update(lastReturn);
    
    // Check for regime transition
    const previousRegime = this.lastRegimes.get(symbol);
    if (previousRegime && previousRegime !== currentRegime) {
      this.metrics.regimeTransitions++;
      this.regimeStartTimes.set(symbol, new Date());
      
      logger.info('Regime transition detected', {
        symbol,
        from: previousRegime,
        to: currentRegime,
        changepointProb: changepointProb.toFixed(3),
      });
    }
    
    this.lastRegimes.set(symbol, currentRegime);
    
    // Calculate regime duration
    const startTime = this.regimeStartTimes.get(symbol) || new Date();
    if (!this.regimeStartTimes.has(symbol)) {
      this.regimeStartTimes.set(symbol, startTime);
    }
    const regimeDuration = (Date.now() - startTime.getTime()) / (1000 * 60 * 60);
    
    // Calculate expected duration based on transition matrix
    const transitionMatrix = this.hmm.getTransitionMatrix();
    const selfTransition = transitionMatrix[currentStateIdx]?.[currentStateIdx] || 0.5;
    const expectedDuration = 1 / (1 - selfTransition);
    
    // Calculate stability score
    const maxProb = Math.max(...Array.from(stateProbabilities.values()));
    const stability = maxProb * (1 - changepointProb);
    
    // Build result
    const result: RegimeDetectionResult = {
      currentRegime,
      confidence: maxProb,
      stateProbabilities,
      transitionMatrix,
      changepointProbability: changepointProb,
      regimeDuration,
      expectedDuration,
      stability,
      features,
      timestamp: new Date(),
    };

    // Update metrics
    this.metrics.detectionsPerformed++;
    this.metrics.avgConfidence = 
      (this.metrics.avgConfidence * (this.metrics.detectionsPerformed - 1) + maxProb) /
      this.metrics.detectionsPerformed;
    
    if (changepointProb > this.config.changepointThreshold) {
      this.metrics.changepointsDetected++;
    }

    // Store in history
    const history = this.regimeHistory.get(symbol) || [];
    history.push(result);
    if (history.length > 100) history.shift();
    this.regimeHistory.set(symbol, history);

    logger.debug('Regime detected', {
      symbol,
      regime: currentRegime,
      confidence: maxProb.toFixed(3),
      changepointProb: changepointProb.toFixed(3),
      stability: stability.toFixed(3),
    });

    return result;
  }

  // Infer regime from features with additional heuristics
  private inferRegimeFromFeatures(features: RegimeFeatures, hmmSuggestion: MLRegimeType): MLRegimeType {
    const { hurst, autocorrelation, volatility, trendStrength, meanReversionSpeed } = features;
    
    // High volatility regime
    if (volatility > 0.03) {
      return MLRegimeType.HIGH_VOLATILITY;
    }
    
    // Low volatility regime
    if (volatility < 0.005) {
      return MLRegimeType.LOW_VOLATILITY;
    }
    
    // Mean-reverting regime (H < 0.5 indicates mean reversion)
    if (hurst < 0.4 && meanReversionSpeed > 0.1) {
      return MLRegimeType.MEAN_REVERTING;
    }
    
    // Trending regimes (H > 0.5 indicates trending)
    if (hurst > 0.6 || Math.abs(trendStrength) > 0.7) {
      if (trendStrength > 0) {
        return MLRegimeType.TRENDING_UP;
      } else {
        return MLRegimeType.TRENDING_DOWN;
      }
    }
    
    // Consolidation (low volatility, low trend)
    if (Math.abs(trendStrength) < 0.3 && volatility < 0.015) {
      return MLRegimeType.CONSOLIDATION;
    }
    
    // Breakout detection (high recent volatility spike)
    if (volatility > 0.02 && Math.abs(autocorrelation) > 0.3) {
      return MLRegimeType.BREAKOUT;
    }
    
    return hmmSuggestion;
  }

  // Get changepoint detection result
  detectChangepoint(symbol: string): ChangepointResult {
    const currentProb = this.changepointDetector.getChangepointProbability();
    const runLength = this.changepointDetector.getMostLikelyRunLength();
    
    const history = this.regimeHistory.get(symbol);
    const previousRegime = history && history.length > 1 
      ? history[history.length - 2]?.currentRegime 
      : null;
    const currentRegime = history && history.length > 0
      ? history[history.length - 1]?.currentRegime
      : null;
    
    return {
      detected: currentProb > this.config.changepointThreshold,
      probability: currentProb,
      location: runLength,
      previousRegime,
      newRegime: currentRegime,
      confidence: 1 - currentProb,
    };
  }

  // Get regime transition probabilities
  getTransitionProbabilities(): number[][] {
    return this.hmm.getTransitionMatrix();
  }

  // Get HMM state parameters
  getStateParameters(): HMMState[] {
    return this.hmm.getStateParameters();
  }

  // Get metrics
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  // Get regime history for a symbol
  getRegimeHistory(symbol: string): RegimeDetectionResult[] {
    return this.regimeHistory.get(symbol) || [];
  }

  // Clear all data
  clear(): void {
    this.priceHistory.clear();
    this.regimeHistory.clear();
    this.lastRegimes.clear();
    this.regimeStartTimes.clear();
    this.changepointDetector.reset();
  }

  // Clear data for specific symbol
  clearSymbol(symbol: string): void {
    this.priceHistory.delete(symbol);
    this.regimeHistory.delete(symbol);
    this.lastRegimes.delete(symbol);
    this.regimeStartTimes.delete(symbol);
  }
}

// Trading signal based on regime
export interface RegimeTradingSignal {
  symbol: string;
  regime: MLRegimeType;
  action: 'long' | 'short' | 'neutral' | 'reduce';
  confidence: number;
  positionSizeMultiplier: number;
  stopLossMultiplier: number;
  takeProfitMultiplier: number;
  reasoning: string;
}

// Generate trading signals based on regime
export function generateRegimeSignal(
  symbol: string,
  detection: RegimeDetectionResult
): RegimeTradingSignal {
  const { currentRegime, confidence, stability, changepointProbability } = detection;
  
  // Don't trade during regime uncertainty
  if (confidence < 0.5 || changepointProbability > 0.7) {
    return {
      symbol,
      regime: currentRegime,
      action: 'neutral',
      confidence,
      positionSizeMultiplier: 0.3,
      stopLossMultiplier: 2.0,
      takeProfitMultiplier: 1.0,
      reasoning: 'High regime uncertainty - reducing exposure',
    };
  }

  switch (currentRegime) {
    case MLRegimeType.TRENDING_UP:
      return {
        symbol,
        regime: currentRegime,
        action: 'long',
        confidence,
        positionSizeMultiplier: 1.0 + stability * 0.5,
        stopLossMultiplier: 1.5,
        takeProfitMultiplier: 3.0,
        reasoning: 'Trending up regime - momentum strategy favored',
      };

    case MLRegimeType.TRENDING_DOWN:
      return {
        symbol,
        regime: currentRegime,
        action: 'short',
        confidence,
        positionSizeMultiplier: 0.7 + stability * 0.3,
        stopLossMultiplier: 1.5,
        takeProfitMultiplier: 2.5,
        reasoning: 'Trending down regime - short or defensive',
      };

    case MLRegimeType.MEAN_REVERTING:
      return {
        symbol,
        regime: currentRegime,
        action: 'neutral',
        confidence,
        positionSizeMultiplier: 0.8,
        stopLossMultiplier: 1.0,
        takeProfitMultiplier: 1.5,
        reasoning: 'Mean-reverting regime - fade extremes',
      };

    case MLRegimeType.HIGH_VOLATILITY:
      return {
        symbol,
        regime: currentRegime,
        action: 'reduce',
        confidence,
        positionSizeMultiplier: 0.3,
        stopLossMultiplier: 2.5,
        takeProfitMultiplier: 2.0,
        reasoning: 'High volatility - reduce position sizes',
      };

    case MLRegimeType.LOW_VOLATILITY:
      return {
        symbol,
        regime: currentRegime,
        action: 'neutral',
        confidence,
        positionSizeMultiplier: 1.2,
        stopLossMultiplier: 0.8,
        takeProfitMultiplier: 1.2,
        reasoning: 'Low volatility - increase position sizes cautiously',
      };

    case MLRegimeType.BREAKOUT:
      return {
        symbol,
        regime: currentRegime,
        action: detection.features.trendStrength > 0 ? 'long' : 'short',
        confidence: confidence * 0.8,
        positionSizeMultiplier: 0.5,
        stopLossMultiplier: 1.2,
        takeProfitMultiplier: 2.5,
        reasoning: 'Breakout detected - small position with momentum',
      };

    case MLRegimeType.CONSOLIDATION:
      return {
        symbol,
        regime: currentRegime,
        action: 'neutral',
        confidence,
        positionSizeMultiplier: 0.5,
        stopLossMultiplier: 1.0,
        takeProfitMultiplier: 1.0,
        reasoning: 'Consolidation - wait for breakout signal',
      };

    default:
      return {
        symbol,
        regime: currentRegime,
        action: 'neutral',
        confidence: 0.5,
        positionSizeMultiplier: 0.5,
        stopLossMultiplier: 1.5,
        takeProfitMultiplier: 1.5,
        reasoning: 'Unknown regime - conservative positioning',
      };
  }
}

// Factory function
export function createMLMarketRegimeDetector(
  config?: Partial<MLRegimeConfig>
): MLMarketRegimeDetector {
  return new MLMarketRegimeDetector(config);
}
