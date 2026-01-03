/**
 * Shared Types for Backtest Framework
 * Consolidated from omar-backtest*.ts scripts
 */

// ============================================================================
// ALPACA DATA TYPES
// ============================================================================

export interface AlpacaBar {
  t: string; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  n: number; // number of trades
  vw: number; // volume-weighted average price
}

// ============================================================================
// BACKTEST CONFIGURATION
// ============================================================================

export interface BacktestConfig {
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  maxPositionPct: number;
  stopLossPct: number;
  takeProfitPct: number;

  // Technical Analysis Parameters
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  smaPeriod: number;
  emaPeriodFast: number;
  emaPeriodSlow: number;
  atrPeriod: number;
  atrMultiplierStop: number;
  atrMultiplierTarget: number;

  // Signal Thresholds
  buyThreshold: number;
  sellThreshold: number;
  confidenceMinimum: number;
}

export const DEFAULT_CONFIG: Partial<BacktestConfig> = {
  initialCapital: 100000,
  maxPositionPct: 0.05,
  stopLossPct: 0.03,
  takeProfitPct: 0.06,
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  smaPeriod: 20,
  emaPeriodFast: 12,
  emaPeriodSlow: 26,
  atrPeriod: 14,
  atrMultiplierStop: 2.0,
  atrMultiplierTarget: 3.0,
  buyThreshold: 0.3,
  sellThreshold: 0.3,
  confidenceMinimum: 0.5,
};

// ============================================================================
// TRADE TYPES
// ============================================================================

export type TradeSide = "buy" | "sell";
export type ExitReason =
  | "stop_loss"
  | "take_profit"
  | "signal"
  | "end_of_period"
  | "trailing_stop";
export type SignalType = "buy" | "sell" | "hold";

export interface Trade {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  quantity: number;
  side: TradeSide;
  stopLoss: number;
  takeProfit: number;
  exitDate?: string;
  exitPrice?: number;
  exitReason?: ExitReason;
  pnl?: number;
  pnlPct?: number;
  holdingDays?: number;
  reasoning?: string[];
}

export interface SignalResult {
  signal: SignalType;
  confidence: number;
  reasoning: string[];
  stopLoss?: number;
  takeProfit?: number;
  scores?: {
    bullish: number;
    bearish: number;
    net: number;
  };
}

// ============================================================================
// ANALYSIS TYPES
// ============================================================================

export interface DailyAnalysis {
  date: string;
  symbol: string;
  price: number;
  rsi: number | null;
  sma: number | null;
  ema: number | null;
  atr: number | null;
  signal: SignalType;
  confidence: number;
  reasoning: string[];
}

// ============================================================================
// METRICS TYPES
// ============================================================================

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPct: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio?: number;
  calmarRatio?: number;
  avgHoldingDays: number;
  finalEquity: number;
  cagr: number;
}

export interface EquityPoint {
  date: string;
  equity: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: Trade[];
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  sampleTrades: Trade[];
}

// ============================================================================
// INDICATOR TYPES
// ============================================================================

export interface StochasticResult {
  k: (number | null)[];
  d: (number | null)[];
}

export interface MACDResult {
  line: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export interface BollingerBandsResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
  width: (number | null)[];
}

// ============================================================================
// GENETIC ALGORITHM TYPES
// ============================================================================

export interface ParamRange {
  min: number;
  max: number;
  step: number;
  integer?: boolean;
  boolean?: boolean;
}

export interface Genome {
  id: string;
  genes: Record<string, number>;
  fitness: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  trades: number;
  generation: number;
  island: number;
  parentIds: string[];
  mutations: string[];
}

export interface GAConfig {
  populationSize: number;
  eliteCount: number;
  mutationRate: number;
  crossoverRate: number;
  generations: number;
  tournamentSize: number;
  numIslands?: number;
  migrationInterval?: number;
  migrationCount?: number;
  convergenceThreshold?: number;
}

export const DEFAULT_GA_CONFIG: GAConfig = {
  populationSize: 100,
  eliteCount: 10,
  mutationRate: 0.15,
  crossoverRate: 0.7,
  generations: 100,
  tournamentSize: 5,
  numIslands: 1,
  migrationInterval: 50,
  migrationCount: 3,
  convergenceThreshold: 0.001,
};

// Legacy interface for backward compatibility
export interface Individual {
  genome: Record<string, number>;
  fitness: number;
}

export interface GeneticAlgorithmConfig extends GAConfig {}

// ============================================================================
// OPTIMIZATION RESULT TYPES
// ============================================================================

export interface OptimizationResult {
  bestGenome: Genome;
  generationHistory: {
    generation: number;
    bestFitness: number;
    avgFitness: number;
    diversity: number;
  }[];
  totalIterations: number;
  elapsedTimeMs: number;
}
