import { alpaca, type AlpacaBar } from "../connectors/alpaca";

export interface MovingAverageCrossoverConfig {
  id: string;
  symbol: string;
  fastPeriod: number;
  slowPeriod: number;
  allocationPct: number;
  riskLimitPct: number;
  universe?: string;
  createdAt: string;
}

export interface MovingAveragePreset {
  id: string;
  name: string;
  fastPeriod: number;
  slowPeriod: number;
  allocationPct: number;
  riskLimitPct: number;
  description: string;
}

export const MOVING_AVERAGE_PRESETS: MovingAveragePreset[] = [
  {
    id: "conservative",
    name: "Conservative",
    fastPeriod: 10,
    slowPeriod: 30,
    allocationPct: 0.05,
    riskLimitPct: 0.05,
    description: "Lower risk with wider SMA gaps, smaller positions. Best for beginners.",
  },
  {
    id: "balanced",
    name: "Balanced",
    fastPeriod: 7,
    slowPeriod: 20,
    allocationPct: 0.10,
    riskLimitPct: 0.10,
    description: "Classic 7/20 SMA crossover. Good balance of signals and reliability.",
  },
  {
    id: "aggressive",
    name: "Aggressive",
    fastPeriod: 5,
    slowPeriod: 15,
    allocationPct: 0.15,
    riskLimitPct: 0.15,
    description: "Faster signals with tighter SMAs. More trades, higher volatility.",
  },
];

export const PARAMETER_BOUNDS = {
  fastPeriod: { min: 3, max: 20, default: 7 },
  slowPeriod: { min: 10, max: 60, default: 20 },
  allocationPct: { min: 0.01, max: 0.25, default: 0.10 },
  riskLimitPct: { min: 0.02, max: 0.30, default: 0.10 },
};

export const STRATEGY_SCHEMA = {
  id: "moving_average_crossover",
  name: "Moving Average Crossover (SMA)",
  description: "A simple trend-following strategy that generates buy signals when a short-term moving average crosses above a longer-term moving average, and sell signals when it crosses below. The classic 7/20 SMA version has historically shown ~21% annualized returns in backtests.",
  presets: MOVING_AVERAGE_PRESETS,
  parameterBounds: PARAMETER_BOUNDS,
  supportedSymbols: [
    "SPY", "QQQ", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM",
    "V", "UNH", "JNJ", "WMT", "PG", "MA", "HD", "CVX", "ABBV", "MRK",
    "KO", "PEP", "COST", "TMO", "AVGO", "ORCL", "ACN", "MCD", "CSCO", "ABT",
    "AMD", "INTC", "IBM", "CRM", "NFLX", "ADBE", "PYPL", "DIS",
    "BTC/USD", "ETH/USD", "SOL/USD",
  ],
};

export function normalizeMovingAverageConfig(
  input: Partial<MovingAverageCrossoverConfig>
): MovingAverageCrossoverConfig {
  const preset = MOVING_AVERAGE_PRESETS.find(p => p.id === "balanced")!;
  
  let fastPeriod = input.fastPeriod ?? preset.fastPeriod;
  let slowPeriod = input.slowPeriod ?? preset.slowPeriod;
  let allocationPct = input.allocationPct ?? preset.allocationPct;
  let riskLimitPct = input.riskLimitPct ?? preset.riskLimitPct;

  fastPeriod = Math.max(PARAMETER_BOUNDS.fastPeriod.min, Math.min(PARAMETER_BOUNDS.fastPeriod.max, Math.round(fastPeriod)));
  slowPeriod = Math.max(PARAMETER_BOUNDS.slowPeriod.min, Math.min(PARAMETER_BOUNDS.slowPeriod.max, Math.round(slowPeriod)));
  allocationPct = Math.max(PARAMETER_BOUNDS.allocationPct.min, Math.min(PARAMETER_BOUNDS.allocationPct.max, allocationPct));
  riskLimitPct = Math.max(PARAMETER_BOUNDS.riskLimitPct.min, Math.min(PARAMETER_BOUNDS.riskLimitPct.max, riskLimitPct));

  if (fastPeriod >= slowPeriod) {
    fastPeriod = Math.max(PARAMETER_BOUNDS.fastPeriod.min, slowPeriod - 5);
  }

  return {
    id: input.id || `ma_${Date.now()}`,
    symbol: input.symbol?.toUpperCase() || "SPY",
    fastPeriod,
    slowPeriod,
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
  side: "long";
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
}

export interface MovingAverageBacktestResult {
  symbol: string;
  config: MovingAverageCrossoverConfig;
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  equityCurve: Array<{ date: string; value: number }>;
  smaCrossoverPoints: Array<{ date: string; type: "bullish" | "bearish"; price: number }>;
}

function calculateSMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

function detectCrossovers(
  fastSMA: (number | null)[],
  slowSMA: (number | null)[]
): Array<{ index: number; type: "bullish" | "bearish" }> {
  const crossovers: Array<{ index: number; type: "bullish" | "bearish" }> = [];
  
  for (let i = 1; i < fastSMA.length; i++) {
    const prevFast = fastSMA[i - 1];
    const currFast = fastSMA[i];
    const prevSlow = slowSMA[i - 1];
    const currSlow = slowSMA[i];
    
    if (prevFast === null || currFast === null || prevSlow === null || currSlow === null) {
      continue;
    }

    if (prevFast <= prevSlow && currFast > currSlow) {
      crossovers.push({ index: i, type: "bullish" });
    } else if (prevFast >= prevSlow && currFast < currSlow) {
      crossovers.push({ index: i, type: "bearish" });
    }
  }
  
  return crossovers;
}

export async function backtestMovingAverageStrategy(
  config: MovingAverageCrossoverConfig,
  lookbackDays: number = 365
): Promise<MovingAverageBacktestResult> {
  const normalizedConfig = normalizeMovingAverageConfig(config);
  
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

  if (!bars || bars.length < normalizedConfig.slowPeriod + 10) {
    throw new Error(`Insufficient historical data for ${normalizedConfig.symbol}. Need at least ${normalizedConfig.slowPeriod + 10} days of data.`);
  }

  const closePrices = bars.map(bar => bar.c);
  const timestamps = bars.map(bar => Math.floor(new Date(bar.t).getTime() / 1000));
  
  const fastSMA = calculateSMA(closePrices, normalizedConfig.fastPeriod);
  const slowSMA = calculateSMA(closePrices, normalizedConfig.slowPeriod);
  const crossovers = detectCrossovers(fastSMA, slowSMA);

  const trades: BacktestTrade[] = [];
  const smaCrossoverPoints: Array<{ date: string; type: "bullish" | "bearish"; price: number }> = [];
  let position: { entryIndex: number; entryPrice: number } | null = null;

  for (const crossover of crossovers) {
    const date = new Date(timestamps[crossover.index] * 1000).toISOString().split("T")[0];
    const price = closePrices[crossover.index];
    
    smaCrossoverPoints.push({ date, type: crossover.type, price });

    if (crossover.type === "bullish" && !position) {
      position = { entryIndex: crossover.index, entryPrice: price };
    } else if (crossover.type === "bearish" && position) {
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
    
    const crossover = crossovers.find(c => c.index === i);
    
    if (crossover?.type === "bullish" && !inPosition) {
      inPosition = true;
      entryPrice = price;
      entryEquity = equity;
    } else if (crossover?.type === "bearish" && inPosition) {
      const returnPct = (price - entryPrice) / entryPrice;
      equity = entryEquity * (1 + returnPct * normalizedConfig.allocationPct * 10);
      inPosition = false;
    } else if (inPosition) {
      const unrealizedPct = (price - entryPrice) / entryPrice;
      const currentEquity = entryEquity * (1 + unrealizedPct * normalizedConfig.allocationPct * 10);
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
    },
    equityCurve,
    smaCrossoverPoints,
  };
}
