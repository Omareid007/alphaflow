/**
 * Shared Backtest Framework Modules
 *
 * Usage:
 *   import { fetchAlpacaBars, calculateRSI, runBacktest } from "./shared/index.js";
 */

// Core types
export * from "./types.js";

// Alpaca API utilities
export {
  fetchAlpacaBars,
  fetchHistoricalData,
  extractOHLCV,
  SYMBOL_LISTS,
  type AlpacaConfig,
} from "./alpaca-api.js";

// Technical indicators
export {
  calculateRSI,
  calculateSMA,
  calculateEMA,
  calculateWMA,
  calculateATR,
  calculateStochastic,
  calculateMACD,
  calculateBollingerBands,
  calculateKeltnerChannels,
  calculateOBV,
  calculateMFI,
  calculateVWAP,
  calculateADX,
  calculateROC,
  calculateWilliamsR,
  calculateCCI,
} from "./technical-indicators.js";

// Backtest engine
export {
  runBacktest,
  generateSignal,
  calculateIndicators,
  calculateMetrics,
  calculateScore,
  calculateSortino,
  calculateCalmar,
  type SignalGeneratorOptions,
  type IndicatorData,
  type BacktestEngineOptions,
} from "./backtest-engine.js";

// Genetic algorithm
export {
  generateRandomGenome,
  crossover,
  mutate,
  tournamentSelect,
  rouletteSelect,
  rankSelect,
  initializePopulation,
  selectElites,
  migrate,
  evolveGeneration,
  calculateFitness,
  checkConvergence,
  getAdaptiveMutationRate,
  minePatterns,
  normalizeWeights,
  DEFAULT_PARAM_RANGES,
  type LearningInsight,
} from "./genetic-algorithm.js";
