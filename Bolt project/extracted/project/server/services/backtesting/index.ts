export {
  fetchHistoricalBars,
  fetchBarsForSingleSymbol,
  type HistoricalBar,
  type FetchBarsResult,
} from "./historical-data-service";

export {
  runSimulation,
  calculateSlippage,
  calculateFees,
  calculateEquity,
  type StrategySignal,
  type StrategySignalGenerator,
  type SimulationResult,
  type SimulationConfig,
} from "./execution-engine";

export {
  runBacktest,
  getBacktestRun,
  listBacktestRuns,
  type RunBacktestParams,
} from "./backtest-runner";

export {
  createStrategy,
  createMovingAverageCrossoverStrategy,
  createRSIStrategy,
  createBuyAndHoldStrategy,
  type StrategyType,
  type StrategyConfig,
} from "./strategies";

export {
  WalkForwardEngine,
  walkForwardEngine,
  type WalkForwardConfig,
  type ParameterRange,
  type WindowResult,
  type PerformanceMetrics,
  type WalkForwardResult,
} from "./walk-forward-engine";

export {
  analyzeOverfittingRisk,
  calculatePBO,
  calculateDeflatedSharpe,
  calculateConsistencyScore,
  isStrategyOverfit,
  generateOverfittingReport,
  type OverfittingAnalysis,
} from "./overfitting-detector";
