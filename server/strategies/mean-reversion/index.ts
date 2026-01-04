/**
 * Mean Reversion Strategy
 * Exports algorithm and backtest engine
 */

export {
  generateSignal,
  calculateBollingerBands,
  calculateZScore,
  calculatePositionSize,
  calculateExitLevels,
  type MeanReversionConfig,
  type PriceBar,
  type Signal,
  type Position,
} from "./algorithm";

export {
  runBacktest,
  type BacktestConfig,
  type BacktestResult,
  type Trade,
} from "./backtest";
