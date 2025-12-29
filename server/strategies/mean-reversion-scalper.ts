import { alpaca, type AlpacaBar } from "../connectors/alpaca";
import {
  mean,
  stdDev,
  zScore,
  variance,
  sharpeRatio as calcSharpeRatio,
  toDecimal,
} from "../utils/money";

export interface MeanReversionScalperConfig {
  id: string;
  symbol: string;
  lookbackPeriod: number;
  deviationThreshold: number;
  allocationPct: number;
  riskLimitPct: number;
  maxHoldingPeriod: number;
  universe?: string;
  createdAt: string;
}

export interface MeanReversionPreset {
  id: string;
  name: string;
  lookbackPeriod: number;
  deviationThreshold: number;
  allocationPct: number;
  riskLimitPct: number;
  maxHoldingPeriod: number;
  description: string;
}

export const MEAN_REVERSION_PRESETS: MeanReversionPreset[] = [
  {
    id: "conservative",
    name: "Conservative",
    lookbackPeriod: 20,
    deviationThreshold: 2.5,
    allocationPct: 0.03,
    riskLimitPct: 0.02,
    maxHoldingPeriod: 5,
    description:
      "Wider deviation bands, smaller positions. Fewer but higher-probability trades.",
  },
  {
    id: "balanced",
    name: "Balanced",
    lookbackPeriod: 14,
    deviationThreshold: 2.0,
    allocationPct: 0.05,
    riskLimitPct: 0.03,
    maxHoldingPeriod: 3,
    description:
      "Classic 14-period mean reversion with 2 std dev bands. Good balance of frequency and quality.",
  },
  {
    id: "aggressive",
    name: "Aggressive",
    lookbackPeriod: 10,
    deviationThreshold: 1.5,
    allocationPct: 0.08,
    riskLimitPct: 0.05,
    maxHoldingPeriod: 2,
    description:
      "Tighter bands for more frequent scalping. Higher trade frequency, smaller profits per trade.",
  },
];

export const PARAMETER_BOUNDS = {
  lookbackPeriod: { min: 5, max: 50, default: 14 },
  deviationThreshold: { min: 1.0, max: 4.0, default: 2.0 },
  allocationPct: { min: 0.01, max: 0.15, default: 0.05 },
  riskLimitPct: { min: 0.01, max: 0.1, default: 0.03 },
  maxHoldingPeriod: { min: 1, max: 10, default: 3 },
};

export const STRATEGY_SCHEMA = {
  id: "mean_reversion_scalper",
  name: "Mean Reversion Scalper",
  description:
    "A high-frequency strategy that identifies when price deviates significantly from its mean and trades the expected reversion. Buys when price falls below the lower band and sells when it rises above the upper band. Best for range-bound markets.",
  presets: MEAN_REVERSION_PRESETS,
  parameterBounds: PARAMETER_BOUNDS,
  supportedSymbols: [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "NVDA",
    "META",
    "TSLA",
    "JPM",
    "V",
    "UNH",
    "JNJ",
    "WMT",
    "PG",
    "MA",
    "HD",
    "CVX",
    "ABBV",
    "MRK",
    "KO",
    "PEP",
    "COST",
    "TMO",
    "AVGO",
    "ORCL",
    "ACN",
    "MCD",
    "CSCO",
    "ABT",
    "AMD",
    "INTC",
    "IBM",
    "CRM",
    "NFLX",
    "ADBE",
    "PYPL",
    "DIS",
    "BTC/USD",
    "ETH/USD",
    "SOL/USD",
  ],
};

export function normalizeMeanReversionConfig(
  input: Partial<MeanReversionScalperConfig>
): MeanReversionScalperConfig {
  const preset = MEAN_REVERSION_PRESETS.find((p) => p.id === "balanced")!;

  let lookbackPeriod = input.lookbackPeriod ?? preset.lookbackPeriod;
  let deviationThreshold =
    input.deviationThreshold ?? preset.deviationThreshold;
  let allocationPct = input.allocationPct ?? preset.allocationPct;
  let riskLimitPct = input.riskLimitPct ?? preset.riskLimitPct;
  let maxHoldingPeriod = input.maxHoldingPeriod ?? preset.maxHoldingPeriod;

  lookbackPeriod = Math.max(
    PARAMETER_BOUNDS.lookbackPeriod.min,
    Math.min(PARAMETER_BOUNDS.lookbackPeriod.max, Math.round(lookbackPeriod))
  );
  deviationThreshold = Math.max(
    PARAMETER_BOUNDS.deviationThreshold.min,
    Math.min(PARAMETER_BOUNDS.deviationThreshold.max, deviationThreshold)
  );
  allocationPct = Math.max(
    PARAMETER_BOUNDS.allocationPct.min,
    Math.min(PARAMETER_BOUNDS.allocationPct.max, allocationPct)
  );
  riskLimitPct = Math.max(
    PARAMETER_BOUNDS.riskLimitPct.min,
    Math.min(PARAMETER_BOUNDS.riskLimitPct.max, riskLimitPct)
  );
  maxHoldingPeriod = Math.max(
    PARAMETER_BOUNDS.maxHoldingPeriod.min,
    Math.min(
      PARAMETER_BOUNDS.maxHoldingPeriod.max,
      Math.round(maxHoldingPeriod)
    )
  );

  return {
    id: input.id || `mrs_${Date.now()}`,
    symbol: input.symbol?.toUpperCase() || "AAPL",
    lookbackPeriod,
    deviationThreshold,
    allocationPct,
    riskLimitPct,
    maxHoldingPeriod,
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
  exitReason: "reversion" | "timeout" | "stop_loss";
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
  avgHoldingPeriod: number;
}

export interface MeanReversionBacktestResult {
  symbol: string;
  config: MeanReversionScalperConfig;
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  equityCurve: Array<{ date: string; value: number }>;
  bandCrossings: Array<{
    date: string;
    type: "oversold" | "overbought";
    price: number;
    zScore: number;
  }>;
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

function calculateStdDev(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      result.push(stdDev(slice).toNumber());
    }
  }
  return result;
}

function calculateZScore(
  prices: number[],
  sma: (number | null)[],
  stdDevValues: (number | null)[]
): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    const avg = sma[i];
    const std = stdDevValues[i];
    if (avg === null || std === null || std === 0) {
      result.push(null);
    } else {
      result.push(zScore(prices[i], avg, std).toNumber());
    }
  }
  return result;
}

function detectBandCrossings(
  zScores: (number | null)[],
  threshold: number
): Array<{ index: number; type: "oversold" | "overbought" }> {
  const crossings: Array<{ index: number; type: "oversold" | "overbought" }> =
    [];

  for (let i = 1; i < zScores.length; i++) {
    const prevZ = zScores[i - 1];
    const currZ = zScores[i];

    if (prevZ === null || currZ === null) continue;

    if (prevZ > -threshold && currZ <= -threshold) {
      crossings.push({ index: i, type: "oversold" });
    } else if (prevZ < threshold && currZ >= threshold) {
      crossings.push({ index: i, type: "overbought" });
    }
  }

  return crossings;
}

export async function backtestMeanReversionStrategy(
  config: MeanReversionScalperConfig,
  lookbackDays: number = 365
): Promise<MeanReversionBacktestResult> {
  const normalizedConfig = normalizeMeanReversionConfig(config);

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
    throw new Error(
      `Failed to fetch historical data for ${normalizedConfig.symbol}: ${(error as Error).message}`
    );
  }

  if (!bars || bars.length < normalizedConfig.lookbackPeriod + 10) {
    throw new Error(
      `Insufficient historical data for ${normalizedConfig.symbol}. Need at least ${normalizedConfig.lookbackPeriod + 10} days of data.`
    );
  }

  const closePrices = bars.map((bar) => bar.c);
  const timestamps = bars.map((bar) =>
    Math.floor(new Date(bar.t).getTime() / 1000)
  );

  const sma = calculateSMA(closePrices, normalizedConfig.lookbackPeriod);
  const stdDev = calculateStdDev(closePrices, normalizedConfig.lookbackPeriod);
  const zScores = calculateZScore(closePrices, sma, stdDev);
  const crossings = detectBandCrossings(
    zScores,
    normalizedConfig.deviationThreshold
  );

  const trades: BacktestTrade[] = [];
  const bandCrossings: Array<{
    date: string;
    type: "oversold" | "overbought";
    price: number;
    zScore: number;
  }> = [];

  let position: {
    entryIndex: number;
    entryPrice: number;
    side: "long" | "short";
  } | null = null;

  for (const crossing of crossings) {
    const date = new Date(timestamps[crossing.index] * 1000)
      .toISOString()
      .split("T")[0];
    const price = closePrices[crossing.index];
    const zScore = zScores[crossing.index] || 0;

    bandCrossings.push({ date, type: crossing.type, price, zScore });

    if (crossing.type === "oversold" && !position) {
      position = {
        entryIndex: crossing.index,
        entryPrice: price,
        side: "long",
      };
    } else if (crossing.type === "overbought" && position?.side === "long") {
      const exitPrice = price;
      const pnlPct =
        ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
      const entryDate = new Date(timestamps[position.entryIndex] * 1000)
        .toISOString()
        .split("T")[0];

      trades.push({
        entryDate,
        exitDate: date,
        entryPrice: position.entryPrice,
        exitPrice,
        pnlPct,
        side: "long",
        exitReason: "reversion",
      });

      position = null;
    }
  }

  if (position) {
    for (let i = position.entryIndex + 1; i < closePrices.length; i++) {
      const holdingDays = i - position.entryIndex;

      if (holdingDays >= normalizedConfig.maxHoldingPeriod) {
        const exitPrice = closePrices[i];
        const pnlPct =
          position.side === "long"
            ? ((exitPrice - position.entryPrice) / position.entryPrice) * 100
            : ((position.entryPrice - exitPrice) / position.entryPrice) * 100;
        const entryDate = new Date(timestamps[position.entryIndex] * 1000)
          .toISOString()
          .split("T")[0];
        const exitDate = new Date(timestamps[i] * 1000)
          .toISOString()
          .split("T")[0];

        trades.push({
          entryDate,
          exitDate,
          entryPrice: position.entryPrice,
          exitPrice,
          pnlPct,
          side: position.side,
          exitReason: "timeout",
        });

        position = null;
        break;
      }
    }
  }

  if (position) {
    const exitPrice = closePrices[closePrices.length - 1];
    const pnlPct =
      position.side === "long"
        ? ((exitPrice - position.entryPrice) / position.entryPrice) * 100
        : ((position.entryPrice - exitPrice) / position.entryPrice) * 100;
    const entryDate = new Date(timestamps[position.entryIndex] * 1000)
      .toISOString()
      .split("T")[0];
    const exitDate = new Date(timestamps[timestamps.length - 1] * 1000)
      .toISOString()
      .split("T")[0];

    trades.push({
      entryDate,
      exitDate,
      entryPrice: position.entryPrice,
      exitPrice,
      pnlPct,
      side: position.side,
      exitReason: "timeout",
    });
  }

  const equityCurve: Array<{ date: string; value: number }> = [];
  let equity = 10000;
  let inPosition = false;
  let entryEquity = equity;
  let entryPrice = 0;
  let positionSide: "long" | "short" = "long";
  let maxEquity = equity;
  let maxDrawdown = 0;
  const dailyReturns: number[] = [];
  let prevEquity = equity;
  let holdingDays = 0;

  for (let i = 0; i < closePrices.length; i++) {
    const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
    const price = closePrices[i];
    const z = zScores[i];

    if (
      !inPosition &&
      z !== null &&
      z <= -normalizedConfig.deviationThreshold
    ) {
      inPosition = true;
      entryPrice = price;
      entryEquity = equity;
      positionSide = "long";
      holdingDays = 0;
    } else if (inPosition) {
      holdingDays++;

      const shouldExit =
        (positionSide === "long" && z !== null && z >= 0) ||
        holdingDays >= normalizedConfig.maxHoldingPeriod;

      if (shouldExit) {
        const returnPct =
          positionSide === "long"
            ? (price - entryPrice) / entryPrice
            : (entryPrice - price) / entryPrice;
        equity = entryEquity * (1 + returnPct * normalizedConfig.allocationPct);
        inPosition = false;
      } else {
        const unrealizedPct =
          positionSide === "long"
            ? (price - entryPrice) / entryPrice
            : (entryPrice - price) / entryPrice;
        const currentEquity =
          entryEquity * (1 + unrealizedPct * normalizedConfig.allocationPct);
        equity = currentEquity;
      }
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
  const annualReturnPct =
    yearsTraded > 0
      ? (Math.pow(1 + totalReturnPct / 100, 1 / yearsTraded) - 1) * 100
      : 0;

  const avgReturn = dailyReturns.length > 0 ? mean(dailyReturns).toNumber() : 0;
  const returnVariance =
    dailyReturns.length > 0 ? variance(dailyReturns).toNumber() : 0;
  const stdDevReturns = Math.sqrt(returnVariance);
  const sharpeRatioValue =
    dailyReturns.length > 0
      ? calcSharpeRatio(dailyReturns, 0, 252).toNumber()
      : 0;

  const negativeReturns = dailyReturns.filter((r) => r < 0);
  const downsideVariance =
    negativeReturns.length > 0 ? variance(negativeReturns).toNumber() : 0;
  const downsideStdDev = Math.sqrt(downsideVariance);
  const sortinoRatio =
    downsideStdDev > 0 ? (avgReturn / downsideStdDev) * Math.sqrt(252) : 0;

  const winningTrades = trades.filter((t) => t.pnlPct > 0);
  const losingTrades = trades.filter((t) => t.pnlPct <= 0);
  const winRatePct =
    trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
  const avgWinPct =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnlPct, 0) /
        winningTrades.length
      : 0;
  const avgLossPct =
    losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + t.pnlPct, 0) / losingTrades.length
      : 0;
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnlPct, 0);
  const grossLoss = Math.abs(
    losingTrades.reduce((sum, t) => sum + t.pnlPct, 0)
  );
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const avgHoldingPeriod =
    trades.length > 0
      ? trades.reduce((sum, t) => {
          const entry = new Date(t.entryDate).getTime();
          const exit = new Date(t.exitDate).getTime();
          return sum + (exit - entry) / (1000 * 60 * 60 * 24);
        }, 0) / trades.length
      : 0;

  return {
    symbol: normalizedConfig.symbol,
    config: normalizedConfig,
    trades,
    metrics: {
      annualReturnPct: Math.round(annualReturnPct * 100) / 100,
      totalReturnPct: Math.round(totalReturnPct * 100) / 100,
      maxDrawdownPct: Math.round(maxDrawdown * 100) / 100,
      sharpeRatio: Math.round(sharpeRatioValue * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
      totalTrades: trades.length,
      winRatePct: Math.round(winRatePct * 100) / 100,
      avgWinPct: Math.round(avgWinPct * 100) / 100,
      avgLossPct: Math.round(avgLossPct * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      avgHoldingPeriod: Math.round(avgHoldingPeriod * 100) / 100,
    },
    equityCurve,
    bandCrossings,
  };
}

export interface MeanReversionSignal {
  symbol: string;
  timestamp: Date;
  price: number;
  zScore: number;
  signal: "buy" | "sell" | "hold";
  strength: number;
  upperBand: number;
  lowerBand: number;
  mean: number;
}

export function generateMeanReversionSignal(
  prices: number[],
  config: MeanReversionScalperConfig
): MeanReversionSignal | null {
  if (prices.length < config.lookbackPeriod) {
    return null;
  }

  const recentPrices = prices.slice(-config.lookbackPeriod);
  const meanValue = mean(recentPrices).toNumber();
  const stdDevValue = stdDev(recentPrices).toNumber();

  const currentPrice = prices[prices.length - 1];
  const zScoreValue =
    stdDevValue > 0
      ? zScore(currentPrice, meanValue, stdDevValue).toNumber()
      : 0;

  const upperBand = meanValue + config.deviationThreshold * stdDevValue;
  const lowerBand = meanValue - config.deviationThreshold * stdDevValue;

  let signal: "buy" | "sell" | "hold" = "hold";
  let strength = 0;

  if (zScoreValue <= -config.deviationThreshold) {
    signal = "buy";
    strength = Math.min(
      1,
      Math.abs(zScoreValue) / (config.deviationThreshold * 2)
    );
  } else if (zScoreValue >= config.deviationThreshold) {
    signal = "sell";
    strength = Math.min(
      1,
      Math.abs(zScoreValue) / (config.deviationThreshold * 2)
    );
  }

  return {
    symbol: config.symbol,
    timestamp: new Date(),
    price: currentPrice,
    zScore: Math.round(zScoreValue * 100) / 100,
    signal,
    strength: Math.round(strength * 100) / 100,
    upperBand: Math.round(upperBand * 100) / 100,
    lowerBand: Math.round(lowerBand * 100) / 100,
    mean: Math.round(meanValue * 100) / 100,
  };
}
