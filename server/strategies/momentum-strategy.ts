import { alpaca, type AlpacaBar } from "../connectors/alpaca";

export interface MomentumStrategyConfig {
  id: string;
  symbol: string;
  lookbackPeriod: number;
  momentumThreshold: number;
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  allocationPct: number;
  riskLimitPct: number;
  universe?: string;
  createdAt: string;
}

export interface MomentumPreset {
  id: string;
  name: string;
  lookbackPeriod: number;
  momentumThreshold: number;
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  allocationPct: number;
  riskLimitPct: number;
  description: string;
}

export const MOMENTUM_PRESETS: MomentumPreset[] = [
  {
    id: "conservative",
    name: "Conservative",
    lookbackPeriod: 20,
    momentumThreshold: 0.03,
    rsiPeriod: 14,
    rsiOverbought: 75,
    rsiOversold: 25,
    allocationPct: 0.05,
    riskLimitPct: 0.03,
    description: "Longer lookback with stricter RSI filters. Fewer but higher-conviction trades.",
  },
  {
    id: "balanced",
    name: "Balanced",
    lookbackPeriod: 14,
    momentumThreshold: 0.02,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    allocationPct: 0.08,
    riskLimitPct: 0.05,
    description: "Classic momentum with RSI confirmation. Good balance of signal quality and frequency.",
  },
  {
    id: "aggressive",
    name: "Aggressive",
    lookbackPeriod: 10,
    momentumThreshold: 0.015,
    rsiPeriod: 10,
    rsiOverbought: 65,
    rsiOversold: 35,
    allocationPct: 0.12,
    riskLimitPct: 0.08,
    description: "Faster signals with looser filters. More trades, captures quick momentum moves.",
  },
];

export const PARAMETER_BOUNDS = {
  lookbackPeriod: { min: 5, max: 30, default: 14 },
  momentumThreshold: { min: 0.005, max: 0.10, default: 0.02 },
  rsiPeriod: { min: 5, max: 21, default: 14 },
  rsiOverbought: { min: 60, max: 85, default: 70 },
  rsiOversold: { min: 15, max: 40, default: 30 },
  allocationPct: { min: 0.02, max: 0.20, default: 0.08 },
  riskLimitPct: { min: 0.02, max: 0.15, default: 0.05 },
};

export const STRATEGY_SCHEMA = {
  id: "momentum_strategy",
  name: "Momentum Strategy",
  description: "A trend-following strategy that trades in the direction of price momentum. Uses rate of change and RSI indicators to identify strong momentum moves. Buys when momentum is positive and RSI confirms, sells when momentum reverses.",
  presets: MOMENTUM_PRESETS,
  parameterBounds: PARAMETER_BOUNDS,
  supportedSymbols: [
    "SPY", "QQQ", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM",
    "V", "UNH", "JNJ", "WMT", "PG", "MA", "HD", "CVX", "ABBV", "MRK",
    "KO", "PEP", "COST", "TMO", "AVGO", "ORCL", "ACN", "MCD", "CSCO", "ABT",
    "AMD", "INTC", "IBM", "CRM", "NFLX", "ADBE", "PYPL", "DIS",
    "BTC/USD", "ETH/USD", "SOL/USD",
  ],
};

export function normalizeMomentumConfig(
  input: Partial<MomentumStrategyConfig>
): MomentumStrategyConfig {
  const preset = MOMENTUM_PRESETS.find(p => p.id === "balanced")!;
  
  let lookbackPeriod = input.lookbackPeriod ?? preset.lookbackPeriod;
  let momentumThreshold = input.momentumThreshold ?? preset.momentumThreshold;
  let rsiPeriod = input.rsiPeriod ?? preset.rsiPeriod;
  let rsiOverbought = input.rsiOverbought ?? preset.rsiOverbought;
  let rsiOversold = input.rsiOversold ?? preset.rsiOversold;
  let allocationPct = input.allocationPct ?? preset.allocationPct;
  let riskLimitPct = input.riskLimitPct ?? preset.riskLimitPct;

  lookbackPeriod = Math.max(PARAMETER_BOUNDS.lookbackPeriod.min, Math.min(PARAMETER_BOUNDS.lookbackPeriod.max, Math.round(lookbackPeriod)));
  momentumThreshold = Math.max(PARAMETER_BOUNDS.momentumThreshold.min, Math.min(PARAMETER_BOUNDS.momentumThreshold.max, momentumThreshold));
  rsiPeriod = Math.max(PARAMETER_BOUNDS.rsiPeriod.min, Math.min(PARAMETER_BOUNDS.rsiPeriod.max, Math.round(rsiPeriod)));
  rsiOverbought = Math.max(PARAMETER_BOUNDS.rsiOverbought.min, Math.min(PARAMETER_BOUNDS.rsiOverbought.max, Math.round(rsiOverbought)));
  rsiOversold = Math.max(PARAMETER_BOUNDS.rsiOversold.min, Math.min(PARAMETER_BOUNDS.rsiOversold.max, Math.round(rsiOversold)));
  allocationPct = Math.max(PARAMETER_BOUNDS.allocationPct.min, Math.min(PARAMETER_BOUNDS.allocationPct.max, allocationPct));
  riskLimitPct = Math.max(PARAMETER_BOUNDS.riskLimitPct.min, Math.min(PARAMETER_BOUNDS.riskLimitPct.max, riskLimitPct));

  if (rsiOversold >= rsiOverbought) {
    rsiOversold = rsiOverbought - 20;
  }

  return {
    id: input.id || `mom_${Date.now()}`,
    symbol: input.symbol?.toUpperCase() || "SPY",
    lookbackPeriod,
    momentumThreshold,
    rsiPeriod,
    rsiOverbought,
    rsiOversold,
    allocationPct,
    riskLimitPct,
    universe: input.universe || "US_EQUITY",
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  side: "long" | "short";
  entryMomentum: number;
  entryRsi: number;
}

export interface BacktestMetrics {
  annualReturnPct: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  totalTrades: number;
  winRatePct: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  avgMomentum: number;
}

export interface MomentumBacktestResult {
  symbol: string;
  config: MomentumStrategyConfig;
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  equityCurve: Array<{ date: string; value: number }>;
  momentumSignals: Array<{ date: string; momentum: number; rsi: number; signal: "buy" | "sell" | "hold" }>;
}

function calculateROC(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      const roc = (prices[i] - prices[i - period]) / prices[i - period];
      result.push(roc);
    }
  }
  return result;
}

function calculateRSI(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      result.push(null);
      continue;
    }

    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    
    gains.push(gain);
    losses.push(loss);

    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    } else {
      const prevRsi = result[i - 1];
      if (prevRsi === null) {
        result.push(null);
        continue;
      }
      
      const prevAvgGain = gains.slice(-period - 1, -1).reduce((a, b) => a + b, 0) / period;
      const prevAvgLoss = losses.slice(-period - 1, -1).reduce((a, b) => a + b, 0) / period;
      
      const currentAvgGain = (prevAvgGain * (period - 1) + gain) / period;
      const currentAvgLoss = (prevAvgLoss * (period - 1) + loss) / period;
      
      const rs = currentAvgLoss === 0 ? 100 : currentAvgGain / currentAvgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }
  return result;
}

function detectMomentumSignals(
  momentum: (number | null)[],
  rsi: (number | null)[],
  config: MomentumStrategyConfig
): Array<{ index: number; type: "buy" | "sell" }> {
  const signals: Array<{ index: number; type: "buy" | "sell" }> = [];
  
  for (let i = 1; i < momentum.length; i++) {
    const prevMom = momentum[i - 1];
    const currMom = momentum[i];
    const currRsi = rsi[i];
    
    if (prevMom === null || currMom === null || currRsi === null) continue;

    if (currMom > config.momentumThreshold && currRsi > config.rsiOversold && currRsi < config.rsiOverbought) {
      if (prevMom <= config.momentumThreshold) {
        signals.push({ index: i, type: "buy" });
      }
    } else if (currMom < -config.momentumThreshold || currRsi >= config.rsiOverbought) {
      if (prevMom >= -config.momentumThreshold && (momentum[i - 1] === null || rsi[i - 1] === null || (rsi[i - 1] !== null && rsi[i - 1]! < config.rsiOverbought))) {
        signals.push({ index: i, type: "sell" });
      }
    }
  }
  
  return signals;
}

export async function backtestMomentumStrategy(
  config: MomentumStrategyConfig,
  lookbackDays: number = 365
): Promise<MomentumBacktestResult> {
  const normalizedConfig = normalizeMomentumConfig(config);
  
  const now = new Date();
  const from = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  
  let bars: AlpacaBar[];
  try {
    const response = await alpaca.getBars(
      [normalizedConfig.symbol],
      "1Day",
      from.toISOString(),
      now.toISOString(),
      lookbackDays + 50
    );
    bars = response.bars[normalizedConfig.symbol] || [];
  } catch (error) {
    throw new Error(`Failed to fetch historical data for ${normalizedConfig.symbol}: ${(error as Error).message}`);
  }

  if (!bars || bars.length < Math.max(normalizedConfig.lookbackPeriod, normalizedConfig.rsiPeriod) + 10) {
    throw new Error(`Insufficient historical data for ${normalizedConfig.symbol}.`);
  }

  const closePrices = bars.map(bar => bar.c);
  const timestamps = bars.map(bar => Math.floor(new Date(bar.t).getTime() / 1000));
  
  const momentum = calculateROC(closePrices, normalizedConfig.lookbackPeriod);
  const rsi = calculateRSI(closePrices, normalizedConfig.rsiPeriod);
  const signals = detectMomentumSignals(momentum, rsi, normalizedConfig);

  const trades: BacktestTrade[] = [];
  const momentumSignals: Array<{ date: string; momentum: number; rsi: number; signal: "buy" | "sell" | "hold" }> = [];
  
  let position: { entryIndex: number; entryPrice: number; entryMomentum: number; entryRsi: number } | null = null;

  for (let i = 0; i < closePrices.length; i++) {
    const m = momentum[i];
    const r = rsi[i];
    if (m !== null && r !== null) {
      const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
      let signal: "buy" | "sell" | "hold" = "hold";
      
      const matchingSignal = signals.find(s => s.index === i);
      if (matchingSignal) {
        signal = matchingSignal.type;
      }
      
      momentumSignals.push({
        date,
        momentum: Math.round(m * 10000) / 100,
        rsi: Math.round(r * 100) / 100,
        signal,
      });
    }
  }

  for (const signal of signals) {
    const date = new Date(timestamps[signal.index] * 1000).toISOString().split("T")[0];
    const price = closePrices[signal.index];
    const m = momentum[signal.index] || 0;
    const r = rsi[signal.index] || 50;

    if (signal.type === "buy" && !position) {
      position = { 
        entryIndex: signal.index, 
        entryPrice: price,
        entryMomentum: m,
        entryRsi: r,
      };
    } else if (signal.type === "sell" && position) {
      const exitPrice = price;
      const pnlPct = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
      const entryDate = new Date(timestamps[position.entryIndex] * 1000).toISOString().split("T")[0];
      
      trades.push({
        entryDate,
        exitDate: date,
        entryPrice: position.entryPrice,
        exitPrice,
        pnlPct,
        side: "long",
        entryMomentum: position.entryMomentum,
        entryRsi: position.entryRsi,
      });
      
      position = null;
    }
  }

  if (position && closePrices.length > position.entryIndex) {
    const exitPrice = closePrices[closePrices.length - 1];
    const pnlPct = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
    const entryDate = new Date(timestamps[position.entryIndex] * 1000).toISOString().split("T")[0];
    const exitDate = new Date(timestamps[timestamps.length - 1] * 1000).toISOString().split("T")[0];
    
    trades.push({
      entryDate,
      exitDate,
      entryPrice: position.entryPrice,
      exitPrice,
      pnlPct,
      side: "long",
      entryMomentum: position.entryMomentum,
      entryRsi: position.entryRsi,
    });
  }

  const equityCurve: Array<{ date: string; value: number }> = [];
  let equity = 10000;
  let inPosition = false;
  let entryEquity = equity;
  let entryPrice = 0;
  let maxEquity = equity;
  let maxDrawdown = 0;
  const dailyReturns: number[] = [];
  let prevEquity = equity;

  for (let i = 0; i < closePrices.length; i++) {
    const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
    const price = closePrices[i];
    
    const signal = signals.find(s => s.index === i);
    
    if (signal?.type === "buy" && !inPosition) {
      inPosition = true;
      entryPrice = price;
      entryEquity = equity;
    } else if (signal?.type === "sell" && inPosition) {
      const returnPct = (price - entryPrice) / entryPrice;
      equity = entryEquity * (1 + returnPct * normalizedConfig.allocationPct);
      inPosition = false;
    } else if (inPosition) {
      const unrealizedPct = (price - entryPrice) / entryPrice;
      const currentEquity = entryEquity * (1 + unrealizedPct * normalizedConfig.allocationPct);
      equity = currentEquity;
    }
    
    equityCurve.push({ date, value: Math.round(equity * 100) / 100 });
    
    if (equity > maxEquity) maxEquity = equity;
    const drawdown = ((maxEquity - equity) / maxEquity) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    
    if (i > 0) {
      const dailyReturn = (equity - prevEquity) / prevEquity;
      dailyReturns.push(dailyReturn);
    }
    prevEquity = equity;
  }

  const totalReturnPct = ((equity - 10000) / 10000) * 100;
  const tradingDays = closePrices.length;
  const yearsTraded = tradingDays / 252;
  const annualReturnPct = yearsTraded > 0 ? (Math.pow(1 + totalReturnPct / 100, 1 / yearsTraded) - 1) * 100 : 0;

  const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const variance = dailyReturns.length > 0 
    ? dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length 
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  const negativeReturns = dailyReturns.filter(r => r < 0);
  const downsideVariance = negativeReturns.length > 0 
    ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length 
    : 0;
  const downsideStdDev = Math.sqrt(downsideVariance);
  const sortinoRatio = downsideStdDev > 0 ? (avgReturn / downsideStdDev) * Math.sqrt(252) : 0;

  const winningTrades = trades.filter(t => t.pnlPct > 0);
  const losingTrades = trades.filter(t => t.pnlPct <= 0);
  const winRatePct = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
  const avgWinPct = winningTrades.length > 0 
    ? winningTrades.reduce((sum, t) => sum + t.pnlPct, 0) / winningTrades.length 
    : 0;
  const avgLossPct = losingTrades.length > 0 
    ? losingTrades.reduce((sum, t) => sum + t.pnlPct, 0) / losingTrades.length 
    : 0;
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnlPct, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const avgMomentum = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.entryMomentum, 0) / trades.length
    : 0;

  return {
    symbol: normalizedConfig.symbol,
    config: normalizedConfig,
    trades,
    metrics: {
      annualReturnPct: Math.round(annualReturnPct * 100) / 100,
      totalReturnPct: Math.round(totalReturnPct * 100) / 100,
      maxDrawdownPct: Math.round(maxDrawdown * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
      totalTrades: trades.length,
      winRatePct: Math.round(winRatePct * 100) / 100,
      avgWinPct: Math.round(avgWinPct * 100) / 100,
      avgLossPct: Math.round(avgLossPct * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      avgMomentum: Math.round(avgMomentum * 10000) / 100,
    },
    equityCurve,
    momentumSignals,
  };
}

export interface MomentumSignal {
  symbol: string;
  timestamp: Date;
  price: number;
  momentum: number;
  rsi: number;
  signal: "buy" | "sell" | "hold";
  strength: number;
  trend: "bullish" | "bearish" | "neutral";
}

export function generateMomentumSignal(
  prices: number[],
  config: MomentumStrategyConfig
): MomentumSignal | null {
  const requiredLength = Math.max(config.lookbackPeriod, config.rsiPeriod) + 1;
  if (prices.length < requiredLength) {
    return null;
  }

  const currentPrice = prices[prices.length - 1];
  const previousPrice = prices[prices.length - 1 - config.lookbackPeriod];
  const momentum = (currentPrice - previousPrice) / previousPrice;

  const rsi = calculateRSI(prices, config.rsiPeriod);
  const currentRsi = rsi[rsi.length - 1] || 50;

  let signal: "buy" | "sell" | "hold" = "hold";
  let strength = 0;
  let trend: "bullish" | "bearish" | "neutral" = "neutral";

  if (momentum > config.momentumThreshold) {
    trend = "bullish";
    if (currentRsi > config.rsiOversold && currentRsi < config.rsiOverbought) {
      signal = "buy";
      strength = Math.min(1, momentum / (config.momentumThreshold * 3));
    }
  } else if (momentum < -config.momentumThreshold) {
    trend = "bearish";
    if (currentRsi >= config.rsiOverbought) {
      signal = "sell";
      strength = Math.min(1, Math.abs(momentum) / (config.momentumThreshold * 3));
    }
  }

  if (currentRsi >= config.rsiOverbought) {
    signal = "sell";
    strength = Math.max(strength, (currentRsi - config.rsiOverbought) / (100 - config.rsiOverbought));
  }

  return {
    symbol: config.symbol,
    timestamp: new Date(),
    price: currentPrice,
    momentum: Math.round(momentum * 10000) / 100,
    rsi: Math.round(currentRsi * 100) / 100,
    signal,
    strength: Math.round(strength * 100) / 100,
    trend,
  };
}
