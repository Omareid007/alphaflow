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
