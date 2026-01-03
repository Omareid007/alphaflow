/**
 * OMAR Enhanced Multi-Factor Backtest
 *
 * Comprehensive backtest framework integrating:
 * - Technical indicators (RSI, MACD, Bollinger, Stochastic, ATR, ADX)
 * - Price momentum and regime detection
 * - Volume analysis
 * - Simulated sentiment factors (based on price action proxies)
 * - News impact simulation
 * - Multi-factor scoring model
 *
 * Refactored to use shared modules (~1565 lines -> ~850 lines, 46% reduction)
 */

import {
  // Alpaca API
  fetchAlpacaBars,
  type AlpacaBar,
  // Technical indicators
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateADX,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
} from "./shared/index.js";

// ============================================================================
// DATA STRUCTURES
// ============================================================================

interface BacktestConfig {
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  maxPositionPct: number;
  maxPortfolioExposure: number;

  // Technical indicator parameters
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  smaPeriod: number;
  emaPeriodFast: number;
  emaPeriodSlow: number;
  atrPeriod: number;
  adxPeriod: number;
  stochPeriod: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  bbPeriod: number;
  bbStdDev: number;

  // Risk management
  atrMultiplierStop: number;
  atrMultiplierTarget: number;
  maxDailyLoss: number;

  // Signal thresholds
  buyThreshold: number;
  sellThreshold: number;
  confidenceMinimum: number;

  // Multi-factor weights (must sum to 1)
  technicalWeight: number;
  momentumWeight: number;
  volatilityWeight: number;
  volumeWeight: number;
  sentimentWeight: number;
}

interface Trade {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  shares: number;
  side: "long" | "short";
  pnl: number;
  pnlPct: number;
  exitReason: string;
  holdingDays: number;
  signals: SignalComponents;
}

interface SignalComponents {
  technical: number;
  momentum: number;
  volatility: number;
  volume: number;
  sentiment: number;
  composite: number;
  confidence: number;
  regime: string;
}

interface BacktestResult {
  config: BacktestConfig;
  trades: Trade[];
  metrics: BacktestMetrics;
  equityCurve: { date: string; equity: number }[];
  signalStats: SignalStats;
}

interface BacktestMetrics {
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
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgHoldingDays: number;
  finalEquity: number;
  cagr: number;
  calmarRatio: number;
  avgTradeReturn: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

interface SignalStats {
  avgTechnical: number;
  avgMomentum: number;
  avgVolatility: number;
  avgVolume: number;
  avgSentiment: number;
  avgComposite: number;
  avgConfidence: number;
  regimeCounts: Record<string, number>;
}

// ============================================================================
// SIGNAL GENERATION - MULTI-FACTOR MODEL
// ============================================================================

function detectRegime(
  prices: number[],
  index: number,
  sma20: number | null,
  sma50: number | null,
  adx: number | null
): string {
  if (index < 50 || sma20 === null || sma50 === null) return "unknown";

  const price = prices[index];
  const priceAboveSma20 = price > sma20;
  const priceAboveSma50 = price > sma50;
  const sma20AboveSma50 = sma20 > sma50;
  const isTrending = adx !== null && adx > 25;

  if (priceAboveSma20 && priceAboveSma50 && sma20AboveSma50 && isTrending)
    return "strong_uptrend";
  if (priceAboveSma20 && priceAboveSma50) return "uptrend";
  if (!priceAboveSma20 && !priceAboveSma50 && !sma20AboveSma50 && isTrending)
    return "strong_downtrend";
  if (!priceAboveSma20 && !priceAboveSma50) return "downtrend";
  return "ranging";
}

function calculateTechnicalScore(
  rsi: number | null,
  macdHist: number | null,
  stochK: number | null,
  stochD: number | null,
  price: number,
  bbUpper: number | null,
  bbLower: number | null,
  bbMiddle: number | null,
  config: BacktestConfig
): number {
  let score = 0;
  let factors = 0;

  if (rsi !== null) {
    if (rsi < config.rsiOversold) score += 1.0;
    else if (rsi < 40) score += 0.5;
    else if (rsi > config.rsiOverbought) score -= 1.0;
    else if (rsi > 60) score -= 0.5;
    factors++;
  }

  if (macdHist !== null) {
    if (macdHist > 0.5) score += 1.0;
    else if (macdHist > 0) score += 0.5;
    else if (macdHist < -0.5) score -= 1.0;
    else if (macdHist < 0) score -= 0.5;
    factors++;
  }

  if (stochK !== null && stochD !== null) {
    if (stochK < 20 && stochK > stochD) score += 1.0;
    else if (stochK < 30) score += 0.3;
    else if (stochK > 80 && stochK < stochD) score -= 1.0;
    else if (stochK > 70) score -= 0.3;
    factors++;
  }

  if (bbUpper !== null && bbLower !== null && bbMiddle !== null) {
    const pricePosition = (price - bbLower) / (bbUpper - bbLower);
    if (pricePosition < 0.2) score += 0.8;
    else if (pricePosition < 0.35) score += 0.4;
    else if (pricePosition > 0.8) score -= 0.8;
    else if (pricePosition > 0.65) score -= 0.4;
    factors++;
  }

  return factors > 0 ? score / factors : 0;
}

function calculateMomentumScore(
  prices: number[],
  index: number,
  emaFast: number | null,
  emaSlow: number | null,
  sma20: number | null
): number {
  if (index < 20 || emaFast === null || emaSlow === null) return 0;

  let score = 0;
  const price = prices[index];

  const emaDiff = emaFast - emaSlow;
  const emaDiffPct = (emaDiff / emaSlow) * 100;

  if (emaDiffPct > 2) score += 0.8;
  else if (emaDiffPct > 0.5) score += 0.4;
  else if (emaDiffPct < -2) score -= 0.8;
  else if (emaDiffPct < -0.5) score -= 0.4;

  if (index >= 10) {
    const returnPct = ((price - prices[index - 10]) / prices[index - 10]) * 100;
    if (returnPct > 5) score += 0.6;
    else if (returnPct > 2) score += 0.3;
    else if (returnPct < -5) score -= 0.6;
    else if (returnPct < -2) score -= 0.3;
  }

  if (sma20 !== null) {
    const distFromSma = ((price - sma20) / sma20) * 100;
    if (distFromSma > 5 && distFromSma < 15) score += 0.2;
    else if (distFromSma > 15) score -= 0.3;
    else if (distFromSma < -5 && distFromSma > -15) score -= 0.2;
    else if (distFromSma < -15) score += 0.3;
  }

  return Math.max(-1, Math.min(1, score));
}

function calculateVolatilityScore(
  adx: number | null,
  bbUpper: number | null,
  bbLower: number | null,
  bbMiddle: number | null
): number {
  let score = 0;

  if (adx !== null) {
    if (adx > 40) score += 0.3;
    else if (adx > 25) score += 0.1;
    else if (adx < 15) score -= 0.3;
  }

  if (bbUpper !== null && bbLower !== null && bbMiddle !== null) {
    const bbWidth = ((bbUpper - bbLower) / bbMiddle) * 100;
    if (bbWidth < 5) score += 0.4;
    else if (bbWidth > 15) score -= 0.2;
  }

  return Math.max(-1, Math.min(1, score));
}

function calculateVolumeScore(volumes: number[], index: number): number {
  if (index < 20) return 0;

  const currentVol = volumes[index];
  const avgVol =
    volumes.slice(index - 20, index).reduce((a, b) => a + b, 0) / 20;
  const volRatio = currentVol / avgVol;

  if (volRatio > 2) return 0.5;
  else if (volRatio > 1.5) return 0.3;
  else if (volRatio < 0.5) return -0.3;
  return 0;
}

function calculateSentimentScore(
  prices: number[],
  volumes: number[],
  index: number,
  regime: string
): number {
  if (index < 30) return 0;

  let score = 0;

  const return5d = (prices[index] - prices[index - 5]) / prices[index - 5];
  const return20d = (prices[index] - prices[index - 20]) / prices[index - 20];

  if (return20d > 0.05 && return5d < 0) score += 0.4;
  if (return20d < -0.05 && return5d > 0) score -= 0.4;

  if (regime === "strong_uptrend") score += 0.3;
  else if (regime === "uptrend") score += 0.1;
  else if (regime === "strong_downtrend") score -= 0.3;
  else if (regime === "downtrend") score -= 0.1;

  const avgVol =
    volumes.slice(index - 20, index).reduce((a, b) => a + b, 0) / 20;
  const volRatio = volumes[index] / avgVol;

  if (volRatio > 2.5) {
    const dayReturn = (prices[index] - prices[index - 1]) / prices[index - 1];
    if (dayReturn > 0.02) score += 0.5;
    else if (dayReturn < -0.02) score -= 0.5;
  }

  return Math.max(-1, Math.min(1, score));
}

function generateSignal(
  index: number,
  bars: AlpacaBar[],
  indicators: {
    rsi: (number | null)[];
    sma20: (number | null)[];
    sma50: (number | null)[];
    emaFast: (number | null)[];
    emaSlow: (number | null)[];
    atr: (number | null)[];
    adx: (number | null)[];
    stoch: { k: (number | null)[]; d: (number | null)[] };
    macd: {
      macd: (number | null)[];
      signal: (number | null)[];
      histogram: (number | null)[];
    };
    bb: {
      upper: (number | null)[];
      middle: (number | null)[];
      lower: (number | null)[];
    };
  },
  config: BacktestConfig
): SignalComponents {
  const prices = bars.map((b) => b.c);
  const volumes = bars.map((b) => b.v);
  const price = prices[index];

  const regime = detectRegime(
    prices,
    index,
    indicators.sma20[index],
    indicators.sma50[index],
    indicators.adx[index]
  );

  const technical = calculateTechnicalScore(
    indicators.rsi[index],
    indicators.macd.histogram[index],
    indicators.stoch.k[index],
    indicators.stoch.d[index],
    price,
    indicators.bb.upper[index],
    indicators.bb.lower[index],
    indicators.bb.middle[index],
    config
  );

  const momentum = calculateMomentumScore(
    prices,
    index,
    indicators.emaFast[index],
    indicators.emaSlow[index],
    indicators.sma20[index]
  );
  const volatility = calculateVolatilityScore(
    indicators.adx[index],
    indicators.bb.upper[index],
    indicators.bb.lower[index],
    indicators.bb.middle[index]
  );
  const volume = calculateVolumeScore(volumes, index);
  const sentiment = calculateSentimentScore(prices, volumes, index, regime);

  const composite =
    technical * config.technicalWeight +
    momentum * config.momentumWeight +
    volatility * config.volatilityWeight +
    volume * config.volumeWeight +
    sentiment * config.sentimentWeight;

  const signals = [technical, momentum, volatility, volume, sentiment];
  const positiveCount = signals.filter((s) => s > 0.2).length;
  const negativeCount = signals.filter((s) => s < -0.2).length;
  const alignment = Math.max(positiveCount, negativeCount) / signals.length;
  const confidence = Math.min(1, alignment * Math.abs(composite) * 2);

  return {
    technical,
    momentum,
    volatility,
    volume,
    sentiment,
    composite,
    confidence,
    regime,
  };
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

interface Position {
  symbol: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
  stopLoss: number;
  takeProfit: number;
  side: "long" | "short";
  signals: SignalComponents;
}

function runBacktest(
  dataMap: Map<string, AlpacaBar[]>,
  config: BacktestConfig
): BacktestResult {
  const trades: Trade[] = [];
  const equityCurve: { date: string; equity: number }[] = [];
  const positions = new Map<string, Position>();

  let equity = config.initialCapital;
  let peakEquity = equity;
  let maxDrawdown = 0;
  let dailyPnl = 0;

  const indicatorsMap = new Map<
    string,
    ReturnType<typeof calculateAllIndicators>
  >();
  for (const [symbol, bars] of dataMap) {
    indicatorsMap.set(symbol, calculateAllIndicators(bars, config));
  }

  const allDates = new Set<string>();
  for (const bars of dataMap.values()) {
    for (const bar of bars) allDates.add(bar.t.split("T")[0]);
  }
  const sortedDates = Array.from(allDates).sort();

  const allSignals: SignalComponents[] = [];

  for (const date of sortedDates) {
    dailyPnl = 0;

    for (const [symbol, bars] of dataMap) {
      const indicators = indicatorsMap.get(symbol)!;
      const dateIndex = bars.findIndex((b) => b.t.split("T")[0] === date);

      if (dateIndex < 50) continue;

      const bar = bars[dateIndex];
      const signals = generateSignal(dateIndex, bars, indicators, config);

      const position = positions.get(symbol);

      if (position) {
        let exitReason: string | null = null;
        let exitPrice = bar.c;

        if (bar.l <= position.stopLoss) {
          exitReason = "stop_loss";
          exitPrice = position.stopLoss;
        } else if (bar.h >= position.takeProfit) {
          exitReason = "take_profit";
          exitPrice = position.takeProfit;
        } else if (
          signals.composite < -config.sellThreshold &&
          signals.confidence > config.confidenceMinimum
        ) {
          exitReason = "signal_reversal";
        } else if (bar.c > position.entryPrice * 1.02) {
          const atr = indicators.atr[dateIndex];
          if (atr !== null)
            position.stopLoss = Math.max(
              position.stopLoss,
              bar.c - atr * config.atrMultiplierStop
            );
        }

        if (exitReason) {
          const pnl = (exitPrice - position.entryPrice) * position.shares;
          const pnlPct =
            ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
          const holdingDays = Math.floor(
            (new Date(date).getTime() -
              new Date(position.entryDate).getTime()) /
              (1000 * 60 * 60 * 24)
          );

          trades.push({
            symbol,
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: date,
            exitPrice,
            shares: position.shares,
            side: position.side,
            pnl,
            pnlPct,
            exitReason,
            holdingDays,
            signals: position.signals,
          });

          equity += pnl;
          dailyPnl += pnl;
          positions.delete(symbol);
        }
      } else {
        const canEnter =
          signals.composite > config.buyThreshold &&
          signals.confidence > config.confidenceMinimum &&
          positions.size < 10 &&
          equity -
            Array.from(positions.values()).reduce(
              (sum, p) => sum + p.shares * p.entryPrice,
              0
            ) >
            equity * (1 - config.maxPortfolioExposure);

        if (canEnter) {
          const atr = indicators.atr[dateIndex];
          const positionSize = Math.min(
            equity * config.maxPositionPct,
            equity * 0.5
          );
          const shares = Math.floor(positionSize / bar.c);

          if (shares > 0 && atr !== null) {
            positions.set(symbol, {
              symbol,
              shares,
              entryPrice: bar.c,
              entryDate: date,
              stopLoss: bar.c - atr * config.atrMultiplierStop,
              takeProfit: bar.c + atr * config.atrMultiplierTarget,
              side: "long",
              signals,
            });
            allSignals.push(signals);
          }
        }
      }
    }

    if (dailyPnl < -equity * config.maxDailyLoss) {
      for (const [symbol, position] of positions) {
        const bars = dataMap.get(symbol)!;
        const bar = bars.find((b) => b.t.split("T")[0] === date);
        if (bar) {
          const pnl = (bar.c - position.entryPrice) * position.shares;
          trades.push({
            symbol,
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: date,
            exitPrice: bar.c,
            shares: position.shares,
            side: position.side,
            pnl,
            pnlPct: ((bar.c - position.entryPrice) / position.entryPrice) * 100,
            exitReason: "daily_loss_limit",
            holdingDays: Math.floor(
              (new Date(date).getTime() -
                new Date(position.entryDate).getTime()) /
                (1000 * 60 * 60 * 24)
            ),
            signals: position.signals,
          });
          equity += pnl;
        }
      }
      positions.clear();
    }

    const unrealizedPnl = Array.from(positions.values()).reduce((sum, pos) => {
      const bars = dataMap.get(pos.symbol)!;
      const bar = bars.find((b) => b.t.split("T")[0] === date);
      return sum + (bar ? (bar.c - pos.entryPrice) * pos.shares : 0);
    }, 0);

    const totalEquity = equity + unrealizedPnl;
    equityCurve.push({ date, equity: totalEquity });

    if (totalEquity > peakEquity) peakEquity = totalEquity;
    const drawdown = ((peakEquity - totalEquity) / peakEquity) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  const lastDate = sortedDates[sortedDates.length - 1];
  for (const [symbol, position] of positions) {
    const bars = dataMap.get(symbol)!;
    const bar = bars.find((b) => b.t.split("T")[0] === lastDate);
    if (bar) {
      const pnl = (bar.c - position.entryPrice) * position.shares;
      trades.push({
        symbol,
        entryDate: position.entryDate,
        entryPrice: position.entryPrice,
        exitDate: lastDate,
        exitPrice: bar.c,
        shares: position.shares,
        side: position.side,
        pnl,
        pnlPct: ((bar.c - position.entryPrice) / position.entryPrice) * 100,
        exitReason: "end_of_backtest",
        holdingDays: Math.floor(
          (new Date(lastDate).getTime() -
            new Date(position.entryDate).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
        signals: position.signals,
      });
      equity += pnl;
    }
  }

  const metrics = calculateMetrics(
    trades,
    config.initialCapital,
    equity,
    maxDrawdown,
    equityCurve
  );
  const signalStats = calculateSignalStats(allSignals);

  return { config, trades, metrics, equityCurve, signalStats };
}

function calculateAllIndicators(bars: AlpacaBar[], config: BacktestConfig) {
  const closes = bars.map((b) => b.c);
  const highs = bars.map((b) => b.h);
  const lows = bars.map((b) => b.l);

  return {
    rsi: calculateRSI(closes, config.rsiPeriod),
    sma20: calculateSMA(closes, 20),
    sma50: calculateSMA(closes, 50),
    emaFast: calculateEMA(closes, config.emaPeriodFast),
    emaSlow: calculateEMA(closes, config.emaPeriodSlow),
    atr: calculateATR(highs, lows, closes, config.atrPeriod),
    adx: calculateADX(highs, lows, closes, config.adxPeriod),
    stoch: calculateStochastic(highs, lows, closes, config.stochPeriod),
    macd: calculateMACD(
      closes,
      config.macdFast,
      config.macdSlow,
      config.macdSignal
    ),
    bb: calculateBollingerBands(closes, config.bbPeriod, config.bbStdDev),
  };
}

function calculateMetrics(
  trades: Trade[],
  initialCapital: number,
  finalEquity: number,
  maxDrawdown: number,
  equityCurve: { date: string; equity: number }[]
): BacktestMetrics {
  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl <= 0);

  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push(
      (equityCurve[i].equity - equityCurve[i - 1].equity) /
        equityCurve[i - 1].equity
    );
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
      returns.length
  );
  const downstdDev = Math.sqrt(
    returns.filter((r) => r < 0).reduce((sum, r) => sum + Math.pow(r, 2), 0) /
      returns.filter((r) => r < 0).length || 1
  );

  const sharpeRatio =
    stdDev !== 0 ? (avgReturn * 252) / (stdDev * Math.sqrt(252)) : 0;
  const sortinoRatio =
    downstdDev !== 0 ? (avgReturn * 252) / (downstdDev * Math.sqrt(252)) : 0;

  const startDate = new Date(equityCurve[0]?.date || Date.now());
  const endDate = new Date(
    equityCurve[equityCurve.length - 1]?.date || Date.now()
  );
  const years =
    (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const cagr =
    years > 0
      ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100
      : 0;

  let maxConsecWins = 0,
    maxConsecLosses = 0,
    currentConsecWins = 0,
    currentConsecLosses = 0;
  for (const trade of trades) {
    if (trade.pnl > 0) {
      currentConsecWins++;
      currentConsecLosses = 0;
      maxConsecWins = Math.max(maxConsecWins, currentConsecWins);
    } else {
      currentConsecLosses++;
      currentConsecWins = 0;
      maxConsecLosses = Math.max(maxConsecLosses, currentConsecLosses);
    }
  }

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate:
      trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    totalPnl,
    totalPnlPct: (totalPnl / initialCapital) * 100,
    avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
    avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
    profitFactor:
      totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    maxDrawdown,
    maxDrawdownPct: maxDrawdown,
    sharpeRatio,
    sortinoRatio,
    avgHoldingDays:
      trades.length > 0
        ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length
        : 0,
    finalEquity,
    cagr,
    calmarRatio: maxDrawdown > 0 ? cagr / maxDrawdown : 0,
    avgTradeReturn:
      trades.length > 0
        ? trades.reduce((sum, t) => sum + t.pnlPct, 0) / trades.length
        : 0,
    consecutiveWins: maxConsecWins,
    consecutiveLosses: maxConsecLosses,
  };
}

function calculateSignalStats(signals: SignalComponents[]): SignalStats {
  if (signals.length === 0) {
    return {
      avgTechnical: 0,
      avgMomentum: 0,
      avgVolatility: 0,
      avgVolume: 0,
      avgSentiment: 0,
      avgComposite: 0,
      avgConfidence: 0,
      regimeCounts: {},
    };
  }

  const regimeCounts: Record<string, number> = {};
  for (const sig of signals) {
    regimeCounts[sig.regime] = (regimeCounts[sig.regime] || 0) + 1;
  }

  return {
    avgTechnical:
      signals.reduce((sum, s) => sum + s.technical, 0) / signals.length,
    avgMomentum:
      signals.reduce((sum, s) => sum + s.momentum, 0) / signals.length,
    avgVolatility:
      signals.reduce((sum, s) => sum + s.volatility, 0) / signals.length,
    avgVolume: signals.reduce((sum, s) => sum + s.volume, 0) / signals.length,
    avgSentiment:
      signals.reduce((sum, s) => sum + s.sentiment, 0) / signals.length,
    avgComposite:
      signals.reduce((sum, s) => sum + s.composite, 0) / signals.length,
    avgConfidence:
      signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length,
    regimeCounts,
  };
}

function calculateOptimizationScore(metrics: BacktestMetrics): number {
  const winRateScore = (Math.min(metrics.winRate, 60) / 60) * 25;
  const profitFactorScore = (Math.min(metrics.profitFactor, 3) / 3) * 25;
  const sharpeScore = (Math.min(Math.max(metrics.sharpeRatio, 0), 2) / 2) * 20;
  const cagrScore = (Math.min(Math.max(metrics.cagr, 0), 50) / 50) * 15;
  const drawdownPenalty = (Math.min(metrics.maxDrawdown, 20) / 20) * 15;

  return (
    winRateScore + profitFactorScore + sharpeScore + cagrScore - drawdownPenalty
  );
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("=".repeat(80));
  console.log("OMAR ENHANCED MULTI-FACTOR BACKTEST");
  console.log("=".repeat(80));

  const symbols = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "NVDA",
    "TSLA",
    "META",
    "AMZN",
    "AMD",
    "SPY",
    "QQQ",
    "NFLX",
    "CRM",
  ];
  const startDate = "2024-01-01";
  const endDate = "2025-12-20";

  console.log(`\nFetching historical data from ${startDate} to ${endDate}...`);

  const dataMap = new Map<string, AlpacaBar[]>();
  for (const symbol of symbols) {
    process.stdout.write(`Fetching ${symbol}... `);
    try {
      const bars = await fetchAlpacaBars(symbol, startDate, endDate);
      dataMap.set(symbol, bars);
      console.log(`${bars.length} bars`);
    } catch (error) {
      console.log(`ERROR: ${error}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const configs: BacktestConfig[] = [
    {
      symbols,
      startDate,
      endDate,
      initialCapital: 100000,
      maxPositionPct: 0.05,
      maxPortfolioExposure: 0.6,
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      smaPeriod: 20,
      emaPeriodFast: 12,
      emaPeriodSlow: 26,
      atrPeriod: 14,
      adxPeriod: 14,
      stochPeriod: 14,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      bbPeriod: 20,
      bbStdDev: 2,
      atrMultiplierStop: 2,
      atrMultiplierTarget: 3,
      maxDailyLoss: 0.05,
      buyThreshold: 0.25,
      sellThreshold: 0.25,
      confidenceMinimum: 0.4,
      technicalWeight: 0.35,
      momentumWeight: 0.25,
      volatilityWeight: 0.15,
      volumeWeight: 0.1,
      sentimentWeight: 0.15,
    },
    {
      symbols,
      startDate,
      endDate,
      initialCapital: 100000,
      maxPositionPct: 0.06,
      maxPortfolioExposure: 0.7,
      rsiPeriod: 14,
      rsiOversold: 25,
      rsiOverbought: 75,
      smaPeriod: 20,
      emaPeriodFast: 9,
      emaPeriodSlow: 21,
      atrPeriod: 14,
      adxPeriod: 14,
      stochPeriod: 14,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      bbPeriod: 20,
      bbStdDev: 2,
      atrMultiplierStop: 1.5,
      atrMultiplierTarget: 2.5,
      maxDailyLoss: 0.04,
      buyThreshold: 0.3,
      sellThreshold: 0.3,
      confidenceMinimum: 0.45,
      technicalWeight: 0.5,
      momentumWeight: 0.2,
      volatilityWeight: 0.1,
      volumeWeight: 0.1,
      sentimentWeight: 0.1,
    },
    {
      symbols,
      startDate,
      endDate,
      initialCapital: 100000,
      maxPositionPct: 0.07,
      maxPortfolioExposure: 0.6,
      rsiPeriod: 10,
      rsiOversold: 35,
      rsiOverbought: 65,
      smaPeriod: 20,
      emaPeriodFast: 8,
      emaPeriodSlow: 21,
      atrPeriod: 10,
      adxPeriod: 14,
      stochPeriod: 10,
      macdFast: 8,
      macdSlow: 17,
      macdSignal: 9,
      bbPeriod: 20,
      bbStdDev: 2,
      atrMultiplierStop: 2,
      atrMultiplierTarget: 4,
      maxDailyLoss: 0.05,
      buyThreshold: 0.2,
      sellThreshold: 0.2,
      confidenceMinimum: 0.35,
      technicalWeight: 0.25,
      momentumWeight: 0.4,
      volatilityWeight: 0.1,
      volumeWeight: 0.15,
      sentimentWeight: 0.1,
    },
    {
      symbols,
      startDate,
      endDate,
      initialCapital: 100000,
      maxPositionPct: 0.05,
      maxPortfolioExposure: 0.5,
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      smaPeriod: 20,
      emaPeriodFast: 12,
      emaPeriodSlow: 26,
      atrPeriod: 14,
      adxPeriod: 14,
      stochPeriod: 14,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      bbPeriod: 20,
      bbStdDev: 2,
      atrMultiplierStop: 2,
      atrMultiplierTarget: 3,
      maxDailyLoss: 0.04,
      buyThreshold: 0.3,
      sellThreshold: 0.3,
      confidenceMinimum: 0.5,
      technicalWeight: 0.25,
      momentumWeight: 0.2,
      volatilityWeight: 0.1,
      volumeWeight: 0.15,
      sentimentWeight: 0.3,
    },
    {
      symbols,
      startDate,
      endDate,
      initialCapital: 100000,
      maxPositionPct: 0.04,
      maxPortfolioExposure: 0.4,
      rsiPeriod: 14,
      rsiOversold: 25,
      rsiOverbought: 75,
      smaPeriod: 20,
      emaPeriodFast: 12,
      emaPeriodSlow: 26,
      atrPeriod: 14,
      adxPeriod: 14,
      stochPeriod: 14,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      bbPeriod: 20,
      bbStdDev: 2.5,
      atrMultiplierStop: 2.5,
      atrMultiplierTarget: 3,
      maxDailyLoss: 0.03,
      buyThreshold: 0.35,
      sellThreshold: 0.35,
      confidenceMinimum: 0.55,
      technicalWeight: 0.3,
      momentumWeight: 0.2,
      volatilityWeight: 0.2,
      volumeWeight: 0.15,
      sentimentWeight: 0.15,
    },
    {
      symbols,
      startDate,
      endDate,
      initialCapital: 100000,
      maxPositionPct: 0.08,
      maxPortfolioExposure: 0.8,
      rsiPeriod: 10,
      rsiOversold: 35,
      rsiOverbought: 65,
      smaPeriod: 15,
      emaPeriodFast: 8,
      emaPeriodSlow: 21,
      atrPeriod: 10,
      adxPeriod: 10,
      stochPeriod: 10,
      macdFast: 8,
      macdSlow: 17,
      macdSignal: 9,
      bbPeriod: 15,
      bbStdDev: 1.5,
      atrMultiplierStop: 1.5,
      atrMultiplierTarget: 4,
      maxDailyLoss: 0.06,
      buyThreshold: 0.15,
      sellThreshold: 0.15,
      confidenceMinimum: 0.3,
      technicalWeight: 0.35,
      momentumWeight: 0.3,
      volatilityWeight: 0.1,
      volumeWeight: 0.15,
      sentimentWeight: 0.1,
    },
  ];

  const results: {
    iteration: number;
    result: BacktestResult;
    score: number;
  }[] = [];

  for (let i = 0; i < configs.length; i++) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`ITERATION ${i + 1}`);
    console.log(`${"=".repeat(60)}`);

    const result = runBacktest(dataMap, configs[i]);
    const score = calculateOptimizationScore(result.metrics);

    console.log(
      `Trades: ${result.metrics.totalTrades} | Win Rate: ${result.metrics.winRate.toFixed(1)}%`
    );
    console.log(
      `P&L: $${result.metrics.totalPnl.toFixed(0)} (${result.metrics.totalPnlPct.toFixed(1)}%)`
    );
    console.log(
      `Profit Factor: ${result.metrics.profitFactor.toFixed(2)} | Sharpe: ${result.metrics.sharpeRatio.toFixed(2)} | Sortino: ${result.metrics.sortinoRatio.toFixed(2)}`
    );
    console.log(
      `Max DD: ${result.metrics.maxDrawdown.toFixed(1)}% | CAGR: ${result.metrics.cagr.toFixed(1)}% | Calmar: ${result.metrics.calmarRatio.toFixed(2)}`
    );
    console.log(`Score: ${score.toFixed(2)}`);

    results.push({ iteration: i + 1, result, score });
  }

  results.sort((a, b) => b.score - a.score);
  const best = results[0];

  console.log(`\n${"=".repeat(80)}`);
  console.log("OPTIMIZATION COMPLETE - BEST RESULT");
  console.log(`${"=".repeat(80)}`);
  console.log(`Iteration: ${best.iteration} | Score: ${best.score.toFixed(2)}`);
  console.log(`\nMetrics:`);
  console.log(JSON.stringify(best.result.metrics, null, 2));

  console.log(`\n=== ALL RESULTS RANKED ===`);
  for (const r of results) {
    console.log(
      `Iter ${r.iteration}: Score=${r.score.toFixed(2)}, WinRate=${r.result.metrics.winRate.toFixed(1)}%, PF=${r.result.metrics.profitFactor.toFixed(2)}, Sharpe=${r.result.metrics.sharpeRatio.toFixed(2)}`
    );
  }
}

main().catch(console.error);
