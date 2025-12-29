export {
  type MovingAverageCrossoverConfig,
  type MovingAveragePreset,
  type PresetId,
  MOVING_AVERAGE_PRESETS,
  ADAPTIVE_DEFAULTS,
  PARAMETER_BOUNDS as MA_PARAMETER_BOUNDS,
  STRATEGY_SCHEMA as MA_STRATEGY_SCHEMA,
  normalizeMovingAverageConfig,
  applyPresetToConfig,
  type BacktestTrade as MABacktestTrade,
  type BacktestMetrics as MABacktestMetrics,
  type MovingAverageBacktestResult,
  backtestMovingAverageStrategy,
} from "./moving-average-crossover";

export {
  ADAPTIVE_THRESHOLDS,
  type AdaptiveRiskDecision,
  type UpdateResult,
  choosePresetFromMarket,
  updateStrategyRiskIfNeeded,
  getAdaptiveRiskStatus,
} from "./adaptive-risk-service";

export {
  type MeanReversionScalperConfig,
  type MeanReversionPreset,
  MEAN_REVERSION_PRESETS,
  PARAMETER_BOUNDS as MRS_PARAMETER_BOUNDS,
  STRATEGY_SCHEMA as MRS_STRATEGY_SCHEMA,
  normalizeMeanReversionConfig,
  type BacktestTrade as MRSBacktestTrade,
  type BacktestMetrics as MRSBacktestMetrics,
  type MeanReversionBacktestResult,
  backtestMeanReversionStrategy,
  type MeanReversionSignal,
  generateMeanReversionSignal,
} from "./mean-reversion-scalper";

export {
  type MomentumStrategyConfig,
  type MomentumPreset,
  MOMENTUM_PRESETS,
  PARAMETER_BOUNDS as MOM_PARAMETER_BOUNDS,
  STRATEGY_SCHEMA as MOM_STRATEGY_SCHEMA,
  normalizeMomentumConfig,
  type BacktestTrade as MOMBacktestTrade,
  type BacktestMetrics as MOMBacktestMetrics,
  type MomentumBacktestResult,
  backtestMomentumStrategy,
  type MomentumSignal,
  generateMomentumSignal,
} from "./momentum-strategy";

import { STRATEGY_SCHEMA as MA_SCHEMA } from "./moving-average-crossover";
import { STRATEGY_SCHEMA as MRS_SCHEMA } from "./mean-reversion-scalper";
import { STRATEGY_SCHEMA as MOM_SCHEMA } from "./momentum-strategy";

export const ALL_STRATEGIES = [MA_SCHEMA, MRS_SCHEMA, MOM_SCHEMA] as const;

export const STRATEGY_TYPES = {
  MOVING_AVERAGE_CROSSOVER: "moving_average_crossover",
  MEAN_REVERSION_SCALPER: "mean_reversion_scalper",
  MOMENTUM_STRATEGY: "momentum_strategy",
} as const;

export type StrategyType = (typeof STRATEGY_TYPES)[keyof typeof STRATEGY_TYPES];

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
