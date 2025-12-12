export {
  MovingAverageCrossoverConfig,
  MovingAveragePreset,
  PresetId,
  MOVING_AVERAGE_PRESETS,
  ADAPTIVE_DEFAULTS,
  PARAMETER_BOUNDS as MA_PARAMETER_BOUNDS,
  STRATEGY_SCHEMA as MA_STRATEGY_SCHEMA,
  normalizeMovingAverageConfig,
  applyPresetToConfig,
  BacktestTrade as MABacktestTrade,
  BacktestMetrics as MABacktestMetrics,
  MovingAverageBacktestResult,
  backtestMovingAverageStrategy,
} from "./moving-average-crossover";

export {
  ADAPTIVE_THRESHOLDS,
  AdaptiveRiskDecision,
  UpdateResult,
  choosePresetFromMarket,
  updateStrategyRiskIfNeeded,
  getAdaptiveRiskStatus,
} from "./adaptive-risk-service";

export {
  MeanReversionScalperConfig,
  MeanReversionPreset,
  MEAN_REVERSION_PRESETS,
  PARAMETER_BOUNDS as MRS_PARAMETER_BOUNDS,
  STRATEGY_SCHEMA as MRS_STRATEGY_SCHEMA,
  normalizeMeanReversionConfig,
  BacktestTrade as MRSBacktestTrade,
  BacktestMetrics as MRSBacktestMetrics,
  MeanReversionBacktestResult,
  backtestMeanReversionStrategy,
  MeanReversionSignal,
  generateMeanReversionSignal,
} from "./mean-reversion-scalper";

export {
  MomentumStrategyConfig,
  MomentumPreset,
  MOMENTUM_PRESETS,
  PARAMETER_BOUNDS as MOM_PARAMETER_BOUNDS,
  STRATEGY_SCHEMA as MOM_STRATEGY_SCHEMA,
  normalizeMomentumConfig,
  BacktestTrade as MOMBacktestTrade,
  BacktestMetrics as MOMBacktestMetrics,
  MomentumBacktestResult,
  backtestMomentumStrategy,
  MomentumSignal,
  generateMomentumSignal,
} from "./momentum-strategy";

import { STRATEGY_SCHEMA as MA_SCHEMA } from "./moving-average-crossover";
import { STRATEGY_SCHEMA as MRS_SCHEMA } from "./mean-reversion-scalper";
import { STRATEGY_SCHEMA as MOM_SCHEMA } from "./momentum-strategy";

export const ALL_STRATEGIES = [
  MA_SCHEMA,
  MRS_SCHEMA,
  MOM_SCHEMA,
] as const;

export const STRATEGY_TYPES = {
  MOVING_AVERAGE_CROSSOVER: "moving_average_crossover",
  MEAN_REVERSION_SCALPER: "mean_reversion_scalper",
  MOMENTUM_STRATEGY: "momentum_strategy",
} as const;

export type StrategyType = typeof STRATEGY_TYPES[keyof typeof STRATEGY_TYPES];

export function getStrategySchema(type: StrategyType) {
  switch (type) {
    case STRATEGY_TYPES.MOVING_AVERAGE_CROSSOVER:
      return MA_SCHEMA;
    case STRATEGY_TYPES.MEAN_REVERSION_SCALPER:
      return MRS_SCHEMA;
    case STRATEGY_TYPES.MOMENTUM_STRATEGY:
      return MOM_SCHEMA;
    default:
      return null;
  }
}
