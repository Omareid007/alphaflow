/**
 * Futures Trading Strategy Configuration
 *
 * Comprehensive configuration for trading futures instruments including:
 * - US Index Futures: MES, MNQ, MYM, ES, M2K
 * - Precious Metals: GC, MGC, SI, SIL
 * - International: DAX (FDAX), N225MC
 *
 * Each instrument has optimized parameters based on:
 * - Volatility characteristics
 * - Trading hours and sessions
 * - Correlation profiles
 * - Best practice strategies
 *
 * @see scale/replit-prompts for implementation roadmap
 * @see /server/connectors/futures-broker-interface.ts for broker integration
 */

import { calculateRSI, calculateROC, calculateATR, calculateSMA, calculateEMA, calculateBollingerBands } from "../lib/technical-indicators";
import type { FuturesBroker } from "../connectors/futures-broker-interface";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FuturesInstrument {
  symbol: string;
  name: string;
  exchange: string;
  assetClass: "equity_index" | "precious_metal" | "commodity" | "currency";
  tickSize: number;
  tickValue: number;
  contractSize: number;
  currency: string;
  tradingHours: TradingHours;
  marginRequirement: MarginRequirement;
  volatilityProfile: VolatilityProfile;
  correlations: Record<string, number>;
  recommendedStrategies: StrategyType[];
  strategyParams: FuturesStrategyParams;
}

export interface TradingHours {
  start: string; // ET timezone
  end: string;
  breakStart?: string;
  breakEnd?: string;
  activeSessions: ("asian" | "european" | "us")[];
  bestTradingHours: string[];
}

export interface MarginRequirement {
  initial: number;
  maintenance: number;
  dayTrading?: number;
}

export interface VolatilityProfile {
  averageDailyRange: number; // in points
  averageATR14: number;
  typicalSlippage: number; // in ticks
  spreadTicks: number;
  volatilityLevel: "low" | "moderate" | "high" | "very_high";
}

export type StrategyType =
  | "momentum"
  | "mean_reversion"
  | "breakout"
  | "range_trading"
  | "vwap_reversion"
  | "opening_range_breakout"
  | "trend_following"
  | "scalping"
  | "safe_haven_flow"
  | "correlation_trading";

export interface FuturesStrategyParams {
  // Momentum parameters
  momentumLookback: number;
  momentumThreshold: number;

  // RSI parameters
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;

  // ATR-based stops
  atrPeriod: number;
  atrStopMultiplier: number;
  atrTargetMultiplier: number;

  // Position sizing
  maxPositionPct: number;
  riskPerTradePct: number;

  // Time filters
  preferredTimeframes: string[];
  avoidLowLiquidityPeriods: boolean;

  // Instrument-specific adjustments
  volatilityAdjustment: number; // 1.0 = normal, >1.0 = higher vol
  correlationThreshold: number; // min correlation for pairs trading
}

export interface FuturesPreset {
  id: string;
  name: string;
  description: string;
  params: Partial<FuturesStrategyParams>;
}

// ============================================================================
// US EQUITY INDEX FUTURES CONFIGURATION
// ============================================================================

export const MES_CONFIG: FuturesInstrument = {
  symbol: "MES",
  name: "Micro E-mini S&P 500",
  exchange: "CME",
  assetClass: "equity_index",
  tickSize: 0.25,
  tickValue: 1.25, // $1.25 per tick
  contractSize: 5, // $5 x S&P 500 Index
  currency: "USD",
  tradingHours: {
    start: "18:00",
    end: "17:00",
    breakStart: "17:00",
    breakEnd: "18:00",
    activeSessions: ["asian", "european", "us"],
    bestTradingHours: ["09:30-11:30", "14:00-16:00"],
  },
  marginRequirement: {
    initial: 1500,
    maintenance: 1350,
    dayTrading: 750,
  },
  volatilityProfile: {
    averageDailyRange: 40,
    averageATR14: 25,
    typicalSlippage: 0.5,
    spreadTicks: 1,
    volatilityLevel: "moderate",
  },
  correlations: {
    MNQ: 0.88,
    MYM: 0.96,
    M2K: 0.82,
    GC: 0.15,
    DXY: -0.50,
  },
  recommendedStrategies: ["momentum", "mean_reversion", "vwap_reversion", "opening_range_breakout"],
  strategyParams: {
    momentumLookback: 14,
    momentumThreshold: 0.02,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    atrPeriod: 14,
    atrStopMultiplier: 2.0,
    atrTargetMultiplier: 3.0,
    maxPositionPct: 0.10,
    riskPerTradePct: 0.02,
    preferredTimeframes: ["5m", "15m"],
    avoidLowLiquidityPeriods: true,
    volatilityAdjustment: 1.0,
    correlationThreshold: 0.80,
  },
};

export const MNQ_CONFIG: FuturesInstrument = {
  symbol: "MNQ",
  name: "Micro E-mini Nasdaq-100",
  exchange: "CME",
  assetClass: "equity_index",
  tickSize: 0.25,
  tickValue: 0.50, // $0.50 per tick
  contractSize: 2, // $2 x Nasdaq-100 Index
  currency: "USD",
  tradingHours: {
    start: "18:00",
    end: "17:00",
    breakStart: "17:00",
    breakEnd: "18:00",
    activeSessions: ["asian", "european", "us"],
    bestTradingHours: ["09:30-11:00", "15:00-16:00"],
  },
  marginRequirement: {
    initial: 1800,
    maintenance: 1620,
    dayTrading: 900,
  },
  volatilityProfile: {
    averageDailyRange: 80,
    averageATR14: 50,
    typicalSlippage: 1.0,
    spreadTicks: 1,
    volatilityLevel: "high",
  },
  correlations: {
    MES: 0.88,
    MYM: 0.82,
    M2K: 0.75,
    GC: -0.05,
    DXY: -0.40,
  },
  recommendedStrategies: ["momentum", "trend_following", "breakout", "scalping"],
  strategyParams: {
    momentumLookback: 10, // Shorter lookback for volatile instrument
    momentumThreshold: 0.025,
    rsiPeriod: 14,
    rsiOverbought: 75, // Higher threshold for trending instrument
    rsiOversold: 25,
    atrPeriod: 14,
    atrStopMultiplier: 2.5, // Wider stops for volatility
    atrTargetMultiplier: 3.5,
    maxPositionPct: 0.08, // Lower position size due to volatility
    riskPerTradePct: 0.015,
    preferredTimeframes: ["1m", "5m", "15m"],
    avoidLowLiquidityPeriods: true,
    volatilityAdjustment: 1.5,
    correlationThreshold: 0.75,
  },
};

export const MYM_CONFIG: FuturesInstrument = {
  symbol: "MYM",
  name: "Micro E-mini Dow",
  exchange: "CME",
  assetClass: "equity_index",
  tickSize: 1.0,
  tickValue: 0.50, // $0.50 per tick
  contractSize: 0.5, // $0.50 x DJIA Index
  currency: "USD",
  tradingHours: {
    start: "18:00",
    end: "17:00",
    breakStart: "17:00",
    breakEnd: "18:00",
    activeSessions: ["asian", "european", "us"],
    bestTradingHours: ["09:30-11:30", "14:00-16:00"],
  },
  marginRequirement: {
    initial: 1000,
    maintenance: 900,
    dayTrading: 500,
  },
  volatilityProfile: {
    averageDailyRange: 150,
    averageATR14: 100,
    typicalSlippage: 2.0,
    spreadTicks: 1,
    volatilityLevel: "moderate",
  },
  correlations: {
    MES: 0.96,
    MNQ: 0.82,
    M2K: 0.80,
    GC: 0.12,
    DXY: -0.45,
  },
  recommendedStrategies: ["mean_reversion", "range_trading", "opening_range_breakout"],
  strategyParams: {
    momentumLookback: 14,
    momentumThreshold: 0.018,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    atrPeriod: 14,
    atrStopMultiplier: 2.0,
    atrTargetMultiplier: 2.5,
    maxPositionPct: 0.12,
    riskPerTradePct: 0.02,
    preferredTimeframes: ["15m", "1h"],
    avoidLowLiquidityPeriods: true,
    volatilityAdjustment: 1.0,
    correlationThreshold: 0.80,
  },
};

export const ES_CONFIG: FuturesInstrument = {
  symbol: "ES",
  name: "E-mini S&P 500",
  exchange: "CME",
  assetClass: "equity_index",
  tickSize: 0.25,
  tickValue: 12.50, // $12.50 per tick
  contractSize: 50, // $50 x S&P 500 Index
  currency: "USD",
  tradingHours: {
    start: "18:00",
    end: "17:00",
    breakStart: "17:00",
    breakEnd: "18:00",
    activeSessions: ["asian", "european", "us"],
    bestTradingHours: ["09:30-11:30", "14:00-16:00"],
  },
  marginRequirement: {
    initial: 14000,
    maintenance: 12600,
    dayTrading: 500, // Many brokers offer reduced intraday
  },
  volatilityProfile: {
    averageDailyRange: 40,
    averageATR14: 25,
    typicalSlippage: 0.25,
    spreadTicks: 1,
    volatilityLevel: "moderate",
  },
  correlations: {
    MES: 1.0,
    MNQ: 0.88,
    MYM: 0.96,
    M2K: 0.82,
    GC: 0.15,
  },
  recommendedStrategies: ["momentum", "mean_reversion", "vwap_reversion", "scalping"],
  strategyParams: {
    momentumLookback: 14,
    momentumThreshold: 0.015,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    atrPeriod: 14,
    atrStopMultiplier: 1.5, // Tighter for high liquidity
    atrTargetMultiplier: 2.5,
    maxPositionPct: 0.05, // Lower due to higher notional value
    riskPerTradePct: 0.01,
    preferredTimeframes: ["1m", "5m"],
    avoidLowLiquidityPeriods: false, // High liquidity always
    volatilityAdjustment: 1.0,
    correlationThreshold: 0.85,
  },
};

export const M2K_CONFIG: FuturesInstrument = {
  symbol: "M2K",
  name: "Micro E-mini Russell 2000",
  exchange: "CME",
  assetClass: "equity_index",
  tickSize: 0.10,
  tickValue: 0.50, // $0.50 per tick
  contractSize: 5, // $5 x Russell 2000 Index
  currency: "USD",
  tradingHours: {
    start: "18:00",
    end: "17:00",
    breakStart: "17:00",
    breakEnd: "18:00",
    activeSessions: ["asian", "european", "us"],
    bestTradingHours: ["09:30-10:30", "15:00-16:00"],
  },
  marginRequirement: {
    initial: 1200,
    maintenance: 1080,
    dayTrading: 600,
  },
  volatilityProfile: {
    averageDailyRange: 30,
    averageATR14: 20,
    typicalSlippage: 1.0,
    spreadTicks: 2,
    volatilityLevel: "high",
  },
  correlations: {
    MES: 0.82,
    MNQ: 0.75,
    MYM: 0.80,
    HYG: 0.68, // High yield bonds
    GC: 0.08,
  },
  recommendedStrategies: ["momentum", "mean_reversion", "correlation_trading"],
  strategyParams: {
    momentumLookback: 12,
    momentumThreshold: 0.025,
    rsiPeriod: 14,
    rsiOverbought: 72,
    rsiOversold: 28,
    atrPeriod: 14,
    atrStopMultiplier: 2.5, // Wider for lower liquidity
    atrTargetMultiplier: 3.0,
    maxPositionPct: 0.08,
    riskPerTradePct: 0.015,
    preferredTimeframes: ["15m", "30m"],
    avoidLowLiquidityPeriods: true,
    volatilityAdjustment: 1.3,
    correlationThreshold: 0.70,
  },
};

// ============================================================================
// PRECIOUS METALS FUTURES CONFIGURATION
// ============================================================================

export const GC_CONFIG: FuturesInstrument = {
  symbol: "GC",
  name: "Gold Futures",
  exchange: "CME",
  assetClass: "precious_metal",
  tickSize: 0.10,
  tickValue: 10.00, // $10 per tick
  contractSize: 100, // 100 troy ounces
  currency: "USD",
  tradingHours: {
    start: "18:00",
    end: "17:00",
    breakStart: "17:00",
    breakEnd: "18:00",
    activeSessions: ["asian", "european", "us"],
    bestTradingHours: ["08:20-11:00", "13:00-14:30"], // NY session + London fix times
  },
  marginRequirement: {
    initial: 11000,
    maintenance: 10000,
    dayTrading: 5500,
  },
  volatilityProfile: {
    averageDailyRange: 25, // in dollars
    averageATR14: 18,
    typicalSlippage: 0.20,
    spreadTicks: 1,
    volatilityLevel: "moderate",
  },
  correlations: {
    MGC: 1.0,
    SI: 0.78,
    DXY: -0.70,
    MES: 0.15,
    TIP: -0.80, // Real yields inverse
  },
  recommendedStrategies: ["trend_following", "range_trading", "safe_haven_flow", "breakout"],
  strategyParams: {
    momentumLookback: 20, // Longer for trending instrument
    momentumThreshold: 0.012,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    atrPeriod: 14,
    atrStopMultiplier: 2.0,
    atrTargetMultiplier: 3.5,
    maxPositionPct: 0.08,
    riskPerTradePct: 0.015,
    preferredTimeframes: ["1h", "4h", "1D"],
    avoidLowLiquidityPeriods: true,
    volatilityAdjustment: 0.8, // Less volatile than equities
    correlationThreshold: 0.60,
  },
};

export const MGC_CONFIG: FuturesInstrument = {
  symbol: "MGC",
  name: "Micro Gold Futures",
  exchange: "CME",
  assetClass: "precious_metal",
  tickSize: 0.10,
  tickValue: 1.00, // $1 per tick
  contractSize: 10, // 10 troy ounces
  currency: "USD",
  tradingHours: {
    start: "18:00",
    end: "17:00",
    breakStart: "17:00",
    breakEnd: "18:00",
    activeSessions: ["asian", "european", "us"],
    bestTradingHours: ["08:20-11:00", "13:00-14:30"],
  },
  marginRequirement: {
    initial: 1300,
    maintenance: 1200,
    dayTrading: 650,
  },
  volatilityProfile: {
    averageDailyRange: 25,
    averageATR14: 18,
    typicalSlippage: 0.30,
    spreadTicks: 2,
    volatilityLevel: "moderate",
  },
  correlations: {
    GC: 1.0,
    SI: 0.78,
    DXY: -0.70,
    MES: 0.15,
  },
  recommendedStrategies: ["trend_following", "range_trading", "safe_haven_flow"],
  strategyParams: {
    ...GC_CONFIG.strategyParams,
    atrStopMultiplier: 2.2, // Slightly wider for micro
    maxPositionPct: 0.12, // Can take larger position with micro
  },
};

export const SI_CONFIG: FuturesInstrument = {
  symbol: "SI",
  name: "Silver Futures",
  exchange: "CME",
  assetClass: "precious_metal",
  tickSize: 0.005,
  tickValue: 25.00, // $25 per tick
  contractSize: 5000, // 5,000 troy ounces
  currency: "USD",
  tradingHours: {
    start: "18:00",
    end: "17:00",
    breakStart: "17:00",
    breakEnd: "18:00",
    activeSessions: ["asian", "european", "us"],
    bestTradingHours: ["08:25-12:00"],
  },
  marginRequirement: {
    initial: 12000,
    maintenance: 11000,
    dayTrading: 6000,
  },
  volatilityProfile: {
    averageDailyRange: 0.60, // in dollars
    averageATR14: 0.45,
    typicalSlippage: 0.01,
    spreadTicks: 2,
    volatilityLevel: "very_high",
  },
  correlations: {
    GC: 0.78,
    DXY: -0.60,
    HG: 0.55, // Copper (industrial demand)
    MES: 0.20,
  },
  recommendedStrategies: ["momentum", "breakout", "correlation_trading"],
  strategyParams: {
    momentumLookback: 12, // Shorter for volatile instrument
    momentumThreshold: 0.03,
    rsiPeriod: 14,
    rsiOverbought: 75, // Wider bands for volatility
    rsiOversold: 25,
    atrPeriod: 14,
    atrStopMultiplier: 3.0, // Wide stops for volatility
    atrTargetMultiplier: 4.0,
    maxPositionPct: 0.05, // Lower position size due to high volatility
    riskPerTradePct: 0.01,
    preferredTimeframes: ["15m", "1h"],
    avoidLowLiquidityPeriods: true,
    volatilityAdjustment: 2.0, // Very volatile
    correlationThreshold: 0.65,
  },
};

// ============================================================================
// INTERNATIONAL FUTURES CONFIGURATION
// ============================================================================

export const DAX_CONFIG: FuturesInstrument = {
  symbol: "FDAX",
  name: "DAX Futures",
  exchange: "EUREX",
  assetClass: "equity_index",
  tickSize: 0.5,
  tickValue: 12.50, // EUR 12.50 per tick
  contractSize: 25, // EUR 25 x DAX Index
  currency: "EUR",
  tradingHours: {
    start: "01:00", // ET
    end: "22:00",
    activeSessions: ["european", "us"],
    bestTradingHours: ["03:00-05:30", "08:30-11:30"], // EU open + US overlap
  },
  marginRequirement: {
    initial: 20000, // EUR
    maintenance: 18000,
    dayTrading: 10000,
  },
  volatilityProfile: {
    averageDailyRange: 200, // points
    averageATR14: 140,
    typicalSlippage: 2.0,
    spreadTicks: 1,
    volatilityLevel: "very_high",
  },
  correlations: {
    MES: 0.78,
    EURUSD: 0.50,
    MNQ: 0.72,
    STOXX50: 0.92,
  },
  recommendedStrategies: ["momentum", "opening_range_breakout", "trend_following"],
  strategyParams: {
    momentumLookback: 10,
    momentumThreshold: 0.02,
    rsiPeriod: 14,
    rsiOverbought: 72,
    rsiOversold: 28,
    atrPeriod: 14,
    atrStopMultiplier: 2.5,
    atrTargetMultiplier: 3.5,
    maxPositionPct: 0.06,
    riskPerTradePct: 0.012,
    preferredTimeframes: ["5m", "15m"],
    avoidLowLiquidityPeriods: true,
    volatilityAdjustment: 1.8,
    correlationThreshold: 0.70,
  },
};

export const N225MC_CONFIG: FuturesInstrument = {
  symbol: "N225MC",
  name: "Nikkei 225 Micro",
  exchange: "CME/JPX",
  assetClass: "equity_index",
  tickSize: 5,
  tickValue: 2500, // JPY 500 per tick (micro)
  contractSize: 500, // JPY 500 x Nikkei 225
  currency: "JPY",
  tradingHours: {
    start: "17:00", // ET
    end: "06:15",
    activeSessions: ["asian"],
    bestTradingHours: ["19:00-03:00"], // Tokyo session
  },
  marginRequirement: {
    initial: 6000, // Approx USD
    maintenance: 5400,
    dayTrading: 3000,
  },
  volatilityProfile: {
    averageDailyRange: 350, // points
    averageATR14: 250,
    typicalSlippage: 10,
    spreadTicks: 2,
    volatilityLevel: "high",
  },
  correlations: {
    MES: 0.68,
    USDJPY: -0.72, // Inverse - weak yen = stronger Nikkei
    MNQ: 0.62,
  },
  recommendedStrategies: ["momentum", "correlation_trading", "trend_following"],
  strategyParams: {
    momentumLookback: 14,
    momentumThreshold: 0.018,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    atrPeriod: 14,
    atrStopMultiplier: 2.0,
    atrTargetMultiplier: 3.0,
    maxPositionPct: 0.08,
    riskPerTradePct: 0.015,
    preferredTimeframes: ["15m", "30m"],
    avoidLowLiquidityPeriods: true,
    volatilityAdjustment: 1.2,
    correlationThreshold: 0.65,
  },
};

// ============================================================================
// STRATEGY PRESETS BY INSTRUMENT TYPE
// ============================================================================

export const EQUITY_INDEX_PRESETS: FuturesPreset[] = [
  {
    id: "index_scalper",
    name: "Index Scalper",
    description: "Fast-paced scalping on liquid index futures. 1-5 minute holds.",
    params: {
      momentumLookback: 8,
      momentumThreshold: 0.01,
      rsiPeriod: 9,
      rsiOverbought: 65,
      rsiOversold: 35,
      atrStopMultiplier: 1.5,
      atrTargetMultiplier: 2.0,
      maxPositionPct: 0.05,
      riskPerTradePct: 0.005,
      preferredTimeframes: ["1m", "3m"],
    },
  },
  {
    id: "index_momentum",
    name: "Index Momentum",
    description: "Momentum-based trading on index futures. 15-60 minute holds.",
    params: {
      momentumLookback: 14,
      momentumThreshold: 0.02,
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
      atrStopMultiplier: 2.0,
      atrTargetMultiplier: 3.0,
      maxPositionPct: 0.10,
      riskPerTradePct: 0.015,
      preferredTimeframes: ["15m", "30m"],
    },
  },
  {
    id: "index_swing",
    name: "Index Swing Trader",
    description: "Swing trading on index futures. Multi-hour to multi-day holds.",
    params: {
      momentumLookback: 20,
      momentumThreshold: 0.025,
      rsiPeriod: 14,
      rsiOverbought: 75,
      rsiOversold: 25,
      atrStopMultiplier: 2.5,
      atrTargetMultiplier: 4.0,
      maxPositionPct: 0.08,
      riskPerTradePct: 0.02,
      preferredTimeframes: ["1h", "4h"],
    },
  },
];

export const PRECIOUS_METAL_PRESETS: FuturesPreset[] = [
  {
    id: "gold_trend",
    name: "Gold Trend Follower",
    description: "Trend-following strategy for gold futures. Medium-term holds.",
    params: {
      momentumLookback: 20,
      momentumThreshold: 0.015,
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
      atrStopMultiplier: 2.0,
      atrTargetMultiplier: 4.0,
      maxPositionPct: 0.08,
      riskPerTradePct: 0.015,
      preferredTimeframes: ["1h", "4h", "1D"],
    },
  },
  {
    id: "gold_range",
    name: "Gold Range Trader",
    description: "Mean reversion strategy for range-bound gold markets.",
    params: {
      momentumLookback: 14,
      momentumThreshold: 0.01,
      rsiPeriod: 14,
      rsiOverbought: 75,
      rsiOversold: 25,
      atrStopMultiplier: 1.5,
      atrTargetMultiplier: 2.5,
      maxPositionPct: 0.10,
      riskPerTradePct: 0.012,
      preferredTimeframes: ["15m", "1h"],
    },
  },
  {
    id: "silver_momentum",
    name: "Silver Momentum",
    description: "Aggressive momentum strategy for volatile silver moves.",
    params: {
      momentumLookback: 10,
      momentumThreshold: 0.03,
      rsiPeriod: 12,
      rsiOverbought: 75,
      rsiOversold: 25,
      atrStopMultiplier: 3.0,
      atrTargetMultiplier: 4.5,
      maxPositionPct: 0.05,
      riskPerTradePct: 0.01,
      preferredTimeframes: ["15m", "30m"],
    },
  },
];

export const INTERNATIONAL_PRESETS: FuturesPreset[] = [
  {
    id: "dax_session",
    name: "DAX Session Trader",
    description: "European session momentum trading on DAX futures.",
    params: {
      momentumLookback: 12,
      momentumThreshold: 0.02,
      rsiPeriod: 14,
      rsiOverbought: 72,
      rsiOversold: 28,
      atrStopMultiplier: 2.5,
      atrTargetMultiplier: 3.5,
      maxPositionPct: 0.06,
      riskPerTradePct: 0.012,
      preferredTimeframes: ["5m", "15m"],
    },
  },
  {
    id: "nikkei_overnight",
    name: "Nikkei Overnight",
    description: "Overnight gap trading based on US session close.",
    params: {
      momentumLookback: 14,
      momentumThreshold: 0.018,
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
      atrStopMultiplier: 2.0,
      atrTargetMultiplier: 3.0,
      maxPositionPct: 0.08,
      riskPerTradePct: 0.015,
      preferredTimeframes: ["15m", "1h"],
    },
  },
];

// ============================================================================
// INSTRUMENT REGISTRY
// ============================================================================

export const FUTURES_INSTRUMENTS: Record<string, FuturesInstrument> = {
  // US Equity Indices
  MES: MES_CONFIG,
  MNQ: MNQ_CONFIG,
  MYM: MYM_CONFIG,
  ES: ES_CONFIG,
  M2K: M2K_CONFIG,

  // Precious Metals
  GC: GC_CONFIG,
  MGC: MGC_CONFIG,
  SI: SI_CONFIG,

  // International
  FDAX: DAX_CONFIG,
  DAX: DAX_CONFIG, // Alias
  N225MC: N225MC_CONFIG,
  NIKKEI: N225MC_CONFIG, // Alias
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get configuration for a futures instrument
 */
export function getFuturesConfig(symbol: string): FuturesInstrument | undefined {
  return FUTURES_INSTRUMENTS[symbol.toUpperCase()];
}

/**
 * Get all supported futures symbols
 */
export function getSupportedFuturesSymbols(): string[] {
  return Object.keys(FUTURES_INSTRUMENTS).filter(s => !["DAX", "NIKKEI"].includes(s)); // Exclude aliases
}

/**
 * Get instruments by asset class
 */
export function getInstrumentsByClass(assetClass: FuturesInstrument["assetClass"]): FuturesInstrument[] {
  return Object.values(FUTURES_INSTRUMENTS).filter(i => i.assetClass === assetClass);
}

/**
 * Get recommended preset for an instrument
 */
export function getRecommendedPreset(symbol: string): FuturesPreset | undefined {
  const config = getFuturesConfig(symbol);
  if (!config) return undefined;

  switch (config.assetClass) {
    case "equity_index":
      return EQUITY_INDEX_PRESETS.find(p => p.id === "index_momentum");
    case "precious_metal":
      return symbol.includes("G") ?
        PRECIOUS_METAL_PRESETS.find(p => p.id === "gold_trend") :
        PRECIOUS_METAL_PRESETS.find(p => p.id === "silver_momentum");
    default:
      return EQUITY_INDEX_PRESETS[1];
  }
}

/**
 * Check if market is in active trading hours
 */
export function isActiveTradingSession(symbol: string, currentTimeET: Date): boolean {
  const config = getFuturesConfig(symbol);
  if (!config) return false;

  const hours = currentTimeET.getHours();
  const minutes = currentTimeET.getMinutes();
  const timeString = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

  // Check if in best trading hours
  for (const range of config.tradingHours.bestTradingHours) {
    const [start, end] = range.split("-");
    if (timeString >= start && timeString <= end) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate position size based on instrument volatility
 */
export function calculateFuturesPositionSize(
  symbol: string,
  accountEquity: number,
  riskAmount: number
): { contracts: number; notionalValue: number } {
  const config = getFuturesConfig(symbol);
  if (!config) {
    return { contracts: 0, notionalValue: 0 };
  }

  // Use ATR-based position sizing
  const atrInDollars = config.volatilityProfile.averageATR14 * config.tickValue / config.tickSize;
  const stopDistance = atrInDollars * config.strategyParams.atrStopMultiplier;

  // Calculate contracts based on risk
  const contracts = Math.floor(riskAmount / stopDistance);
  const notionalValue = contracts * config.contractSize * config.volatilityProfile.averageATR14 * 10; // Approximate

  // Apply max position constraint
  const maxContracts = Math.floor((accountEquity * config.strategyParams.maxPositionPct) / config.marginRequirement.initial);

  return {
    contracts: Math.min(contracts, maxContracts),
    notionalValue,
  };
}

/**
 * Get correlation matrix for a set of symbols
 */
export function getCorrelationMatrix(symbols: string[]): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};

  for (const sym1 of symbols) {
    matrix[sym1] = {};
    const config1 = getFuturesConfig(sym1);

    for (const sym2 of symbols) {
      if (sym1 === sym2) {
        matrix[sym1][sym2] = 1.0;
      } else if (config1?.correlations[sym2]) {
        matrix[sym1][sym2] = config1.correlations[sym2];
      } else {
        // Check reverse correlation
        const config2 = getFuturesConfig(sym2);
        matrix[sym1][sym2] = config2?.correlations[sym1] || 0;
      }
    }
  }

  return matrix;
}

// ============================================================================
// EXPORT STRATEGY SCHEMA
// ============================================================================

export const FUTURES_STRATEGY_SCHEMA = {
  id: "futures_strategy",
  name: "Futures Trading Strategy",
  description: "Multi-instrument futures trading strategy supporting US index futures, precious metals, and international indices. Includes instrument-specific parameters and volatility-adjusted position sizing.",
  instruments: getSupportedFuturesSymbols(),
  presets: {
    equity_index: EQUITY_INDEX_PRESETS,
    precious_metal: PRECIOUS_METAL_PRESETS,
    international: INTERNATIONAL_PRESETS,
  },
  parameterBounds: {
    momentumLookback: { min: 5, max: 30, default: 14 },
    momentumThreshold: { min: 0.005, max: 0.05, default: 0.02 },
    rsiPeriod: { min: 5, max: 21, default: 14 },
    rsiOverbought: { min: 60, max: 85, default: 70 },
    rsiOversold: { min: 15, max: 40, default: 30 },
    atrPeriod: { min: 7, max: 21, default: 14 },
    atrStopMultiplier: { min: 1.0, max: 4.0, default: 2.0 },
    atrTargetMultiplier: { min: 1.5, max: 5.0, default: 3.0 },
    maxPositionPct: { min: 0.02, max: 0.20, default: 0.08 },
    riskPerTradePct: { min: 0.005, max: 0.03, default: 0.015 },
  },
};

// ============================================================================
// BROKER INTEGRATION
// ============================================================================

/**
 * Futures broker instance placeholder
 * To enable futures trading:
 * 1. Import and initialize a futures broker:
 *    import { createFuturesBroker } from "../connectors/futures-broker-interface";
 *    export const futuresBroker = createFuturesBroker("interactive_brokers", { ... });
 * 2. Connect to the broker:
 *    await futuresBroker.connect();
 * 3. Use the broker instance for trading operations
 */
export let futuresBroker: FuturesBroker | null = null;

/**
 * Initialize futures broker connection
 * @example
 * ```typescript
 * import { createFuturesBroker } from "../connectors/futures-broker-interface";
 *
 * export async function initializeFuturesBroker() {
 *   futuresBroker = createFuturesBroker("interactive_brokers", {
 *     apiKey: process.env.IB_API_KEY,
 *     apiSecret: process.env.IB_API_SECRET,
 *     accountId: process.env.IB_ACCOUNT_ID,
 *     paperTrading: true
 *   });
 *   await futuresBroker.connect();
 *   console.log("Futures broker connected");
 * }
 * ```
 */
export function setFuturesBroker(broker: FuturesBroker): void {
  futuresBroker = broker;
}

/**
 * Get the current futures broker instance
 */
export function getFuturesBroker(): FuturesBroker | null {
  return futuresBroker;
}

/**
 * Check if futures trading is available
 */
export function isFuturesTradingAvailable(): boolean {
  return futuresBroker !== null && futuresBroker.isConnected();
}
