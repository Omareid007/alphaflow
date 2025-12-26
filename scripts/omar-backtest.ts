/**
 * Omar Algorithmic Trading Backtest Framework
 *
 * This script performs comprehensive backtesting by:
 * 1. Fetching historical OHLCV data from Alpaca via fetch API
 * 2. Simulating technical analysis decisions at each point in time
 * 3. Executing virtual trades based on signals
 * 4. Comparing outcomes against actual market movements
 * 5. Iterating to optimize parameters
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

interface BacktestConfig {
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

interface Trade {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  quantity: number;
  side: "buy" | "sell";
  stopLoss: number;
  takeProfit: number;
  exitDate?: string;
  exitPrice?: number;
  exitReason?: "stop_loss" | "take_profit" | "signal" | "end_of_period";
  pnl?: number;
  pnlPct?: number;
  holdingDays?: number;
  reasoning?: string[];
}

interface DailyAnalysis {
  date: string;
  symbol: string;
  price: number;
  rsi: number | null;
  sma: number | null;
  atr: number | null;
  signal: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string[];
}

interface BacktestResult {
  config: BacktestConfig;
  trades: Trade[];
  metrics: {
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
    avgHoldingDays: number;
    finalEquity: number;
    cagr: number;
  };
  equityCurve: { date: string; equity: number }[];
  sampleTrades: Trade[];
}

// ============================================================================
// ALPACA API
// ============================================================================

const ALPACA_BASE_URL = "https://data.alpaca.markets/v2";

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n: number;
  vw: number;
}

async function fetchAlpacaBars(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<AlpacaBar[]> {
  const apiKey = process.env.ALPACA_API_KEY;
  const secretKey = process.env.ALPACA_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error("ALPACA_API_KEY and ALPACA_SECRET_KEY required");
  }

  const bars: AlpacaBar[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      start: startDate,
      end: endDate,
      timeframe: "1Day",
      limit: "1000",
    });
    if (pageToken) params.set("page_token", pageToken);

    const url = `${ALPACA_BASE_URL}/stocks/${symbol}/bars?${params}`;

    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": apiKey,
        "APCA-API-SECRET-KEY": secretKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Error fetching ${symbol}: ${response.status} - ${error}`);
      break;
    }

    const data = await response.json();
    if (data.bars) {
      bars.push(...data.bars);
    }
    pageToken = data.next_page_token;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 250));
  } while (pageToken);

  return bars;
}

// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

function calculateRSI(prices: number[], period: number): (number | null)[] {
  const rsi: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period + 1) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }

  return rsi;
}

function calculateSMA(prices: number[], period: number): (number | null)[] {
  const sma: (number | null)[] = new Array(prices.length).fill(null);
  for (let i = period - 1; i < prices.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += prices[i - j];
    }
    sma[i] = sum / period;
  }
  return sma;
}

function calculateEMA(prices: number[], period: number): (number | null)[] {
  const ema: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period) return ema;

  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  ema[period - 1] = sum / period;

  for (let i = period; i < prices.length; i++) {
    ema[i] = (prices[i] - (ema[i - 1] || 0)) * multiplier + (ema[i - 1] || 0);
  }

  return ema;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
  const atr: (number | null)[] = new Array(highs.length).fill(null);
  if (highs.length < period + 1) return atr;

  const tr: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const highLow = highs[i] - lows[i];
    const highPrevClose = Math.abs(highs[i] - closes[i - 1]);
    const lowPrevClose = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(highLow, highPrevClose, lowPrevClose));
  }

  let atrSum = 0;
  for (let i = 0; i < period; i++) {
    atrSum += tr[i];
  }
  atr[period] = atrSum / period;

  for (let i = period + 1; i < highs.length; i++) {
    atr[i] = ((atr[i - 1] || 0) * (period - 1) + tr[i - 1]) / period;
  }

  return atr;
}

function calculateStochastic(highs: number[], lows: number[], closes: number[], period: number): { k: (number | null)[]; d: (number | null)[] } {
  const k: (number | null)[] = new Array(closes.length).fill(null);
  const d: (number | null)[] = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = 0; j < period; j++) {
      highestHigh = Math.max(highestHigh, highs[i - j]);
      lowestLow = Math.min(lowestLow, lows[i - j]);
    }
    k[i] = highestHigh === lowestLow ? 50 : ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
  }

  for (let i = period + 2; i < closes.length; i++) {
    const k1 = k[i] || 0;
    const k2 = k[i - 1] || 0;
    const k3 = k[i - 2] || 0;
    d[i] = (k1 + k2 + k3) / 3;
  }

  return { k, d };
}

function calculateMACD(prices: number[]): { histogram: (number | null)[] } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);

  const line: (number | null)[] = new Array(prices.length).fill(null);
  for (let i = 25; i < prices.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) {
      line[i] = ema12[i]! - ema26[i]!;
    }
  }

  const validLineValues = line.filter((v): v is number => v !== null);
  const signal = calculateEMA(validLineValues, 9);

  const histogram: (number | null)[] = new Array(prices.length).fill(null);
  let signalIdx = 0;
  for (let i = 25; i < prices.length; i++) {
    if (line[i] !== null && signalIdx < signal.length && signal[signalIdx] !== null) {
      histogram[i] = line[i]! - signal[signalIdx]!;
      signalIdx++;
    }
  }

  return { histogram };
}

function calculateBollingerBands(prices: number[], period: number): { upper: (number | null)[]; lower: (number | null)[]; width: (number | null)[] } {
  const middle = calculateSMA(prices, period);
  const upper: (number | null)[] = new Array(prices.length).fill(null);
  const lower: (number | null)[] = new Array(prices.length).fill(null);
  const width: (number | null)[] = new Array(prices.length).fill(null);

  for (let i = period - 1; i < prices.length; i++) {
    if (middle[i] === null) continue;
    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      sumSq += Math.pow(prices[i - j] - middle[i]!, 2);
    }
    const std = Math.sqrt(sumSq / period);
    upper[i] = middle[i]! + 2 * std;
    lower[i] = middle[i]! - 2 * std;
    width[i] = (upper[i]! - lower[i]!) / middle[i]!;
  }

  return { upper, lower, width };
}

// ============================================================================
// SIGNAL GENERATION
// ============================================================================

interface SignalResult {
  signal: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string[];
  stopLoss?: number;
  takeProfit?: number;
}

function generateSignal(
  index: number,
  prices: number[],
  highs: number[],
  lows: number[],
  rsi: (number | null)[],
  sma: (number | null)[],
  emaFast: (number | null)[],
  emaSlow: (number | null)[],
  atr: (number | null)[],
  stochK: (number | null)[],
  stochD: (number | null)[],
  macdHist: (number | null)[],
  bbUpper: (number | null)[],
  bbLower: (number | null)[],
  config: BacktestConfig
): SignalResult {
  const currentPrice = prices[index];
  const currentRSI = rsi[index];
  const currentSMA = sma[index];
  const currentEMAFast = emaFast[index];
  const currentEMASlow = emaSlow[index];
  const currentATR = atr[index];
  const currentStochK = stochK[index];
  const currentMACDHist = macdHist[index];
  const currentBBLower = bbLower[index];
  const currentBBUpper = bbUpper[index];

  if (currentRSI === null || currentSMA === null || currentATR === null) {
    return { signal: "hold", confidence: 0, reasoning: ["Insufficient data"] };
  }

  let bullishScore = 0;
  let bearishScore = 0;
  const reasoning: string[] = [];

  // RSI Analysis (weight: 20)
  if (currentRSI < config.rsiOversold) {
    bullishScore += 20;
    reasoning.push(`RSI oversold: ${currentRSI.toFixed(1)}`);
  } else if (currentRSI > config.rsiOverbought) {
    bearishScore += 20;
    reasoning.push(`RSI overbought: ${currentRSI.toFixed(1)}`);
  } else if (currentRSI < 45) {
    bullishScore += 8;
  } else if (currentRSI > 55) {
    bearishScore += 8;
  }

  // Price vs SMA (weight: 15)
  if (currentPrice > currentSMA * 1.02) {
    bullishScore += 15;
    reasoning.push(`Price above SMA${config.smaPeriod}`);
  } else if (currentPrice < currentSMA * 0.98) {
    bearishScore += 15;
    reasoning.push(`Price below SMA${config.smaPeriod}`);
  }

  // EMA Crossover (weight: 15)
  if (currentEMAFast !== null && currentEMASlow !== null) {
    if (currentEMAFast > currentEMASlow) {
      bullishScore += 15;
      reasoning.push("EMA bullish alignment");
    } else {
      bearishScore += 15;
    }
  }

  // Stochastic (weight: 12)
  if (currentStochK !== null) {
    if (currentStochK < 20) {
      bullishScore += 12;
      reasoning.push(`Stochastic oversold: ${currentStochK.toFixed(1)}`);
    } else if (currentStochK > 80) {
      bearishScore += 12;
      reasoning.push(`Stochastic overbought: ${currentStochK.toFixed(1)}`);
    }
  }

  // MACD Histogram (weight: 12)
  if (currentMACDHist !== null) {
    if (currentMACDHist > 0) {
      bullishScore += 12;
      reasoning.push("MACD positive");
    } else {
      bearishScore += 12;
    }
  }

  // Bollinger Bands (weight: 10)
  if (currentBBLower !== null && currentBBUpper !== null) {
    if (currentPrice < currentBBLower) {
      bullishScore += 10;
      reasoning.push("Price at lower Bollinger");
    } else if (currentPrice > currentBBUpper) {
      bearishScore += 10;
      reasoning.push("Price at upper Bollinger");
    }
  }

  // Momentum (weight: 8)
  if (index > 5) {
    const momentum5d = ((currentPrice - prices[index - 5]) / prices[index - 5]) * 100;
    if (momentum5d > 3) {
      bullishScore += 8;
      reasoning.push(`5d momentum: +${momentum5d.toFixed(1)}%`);
    } else if (momentum5d < -3) {
      bearishScore += 8;
      reasoning.push(`5d momentum: ${momentum5d.toFixed(1)}%`);
    }
  }

  // Volatility adjustment
  const atrPct = (currentATR / currentPrice) * 100;
  if (atrPct > 4) {
    bearishScore += 8;
  }

  const totalScore = bullishScore + bearishScore;
  const netScore = bullishScore - bearishScore;
  const normalizedScore = totalScore > 0 ? netScore / totalScore : 0;

  const signalStrength = Math.abs(normalizedScore);
  let confidence = 0.35 + (signalStrength * 0.45);
  confidence += Math.min(reasoning.length / 15, 0.15);
  confidence = Math.max(0.30, Math.min(confidence, 0.90));

  let signal: "buy" | "sell" | "hold" = "hold";
  if (normalizedScore > config.buyThreshold && confidence >= config.confidenceMinimum) {
    signal = "buy";
  } else if (normalizedScore < -config.sellThreshold && confidence >= config.confidenceMinimum) {
    signal = "sell";
  }

  const stopLoss = currentPrice - (currentATR * config.atrMultiplierStop);
  const takeProfit = currentPrice + (currentATR * config.atrMultiplierTarget);

  return { signal, confidence, reasoning, stopLoss, takeProfit };
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

async function fetchHistoricalData(
  symbols: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, AlpacaBar[]>> {
  const dataMap = new Map<string, AlpacaBar[]>();

  for (const symbol of symbols) {
    console.log(`Fetching ${symbol}...`);
    const bars = await fetchAlpacaBars(symbol, startDate, endDate);
    if (bars.length > 0) {
      dataMap.set(symbol, bars);
      console.log(`  ${symbol}: ${bars.length} bars`);
    }
  }

  return dataMap;
}

function runBacktest(
  dataMap: Map<string, AlpacaBar[]>,
  config: BacktestConfig
): BacktestResult {
  const trades: Trade[] = [];
  const equityCurve: { date: string; equity: number }[] = [];

  let equity = config.initialCapital;
  let peakEquity = equity;
  let maxDrawdown = 0;
  const openPositions = new Map<string, Trade>();

  for (const symbol of config.symbols) {
    const bars = dataMap.get(symbol);
    if (!bars || bars.length < 50) continue;

    const dates = bars.map(b => b.t.split("T")[0]);
    const opens = bars.map(b => b.o);
    const highs = bars.map(b => b.h);
    const lows = bars.map(b => b.l);
    const closes = bars.map(b => b.c);

    const rsi = calculateRSI(closes, config.rsiPeriod);
    const sma = calculateSMA(closes, config.smaPeriod);
    const emaFast = calculateEMA(closes, config.emaPeriodFast);
    const emaSlow = calculateEMA(closes, config.emaPeriodSlow);
    const atr = calculateATR(highs, lows, closes, config.atrPeriod);
    const stoch = calculateStochastic(highs, lows, closes, 14);
    const macd = calculateMACD(closes);
    const bb = calculateBollingerBands(closes, 20);

    for (let i = 50; i < bars.length - 1; i++) {
      const currentDate = dates[i];
      const currentPrice = closes[i];
      const nextDayOpen = opens[i + 1];

      const signalResult = generateSignal(
        i, closes, highs, lows,
        rsi, sma, emaFast, emaSlow, atr,
        stoch.k, stoch.d, macd.histogram,
        bb.upper, bb.lower,
        config
      );

      const positionKey = symbol;
      const existingPosition = openPositions.get(positionKey);

      if (existingPosition) {
        const dayLow = lows[i];
        const dayHigh = highs[i];

        let exitPrice: number | undefined;
        let exitReason: Trade["exitReason"];

        if (dayLow <= existingPosition.stopLoss) {
          exitPrice = existingPosition.stopLoss;
          exitReason = "stop_loss";
        } else if (dayHigh >= existingPosition.takeProfit) {
          exitPrice = existingPosition.takeProfit;
          exitReason = "take_profit";
        } else if (signalResult.signal === "sell" && existingPosition.side === "buy") {
          exitPrice = currentPrice;
          exitReason = "signal";
        }

        if (exitPrice) {
          existingPosition.exitDate = currentDate;
          existingPosition.exitPrice = exitPrice;
          existingPosition.exitReason = exitReason;
          existingPosition.pnl = (exitPrice - existingPosition.entryPrice) * existingPosition.quantity;
          existingPosition.pnlPct = ((exitPrice - existingPosition.entryPrice) / existingPosition.entryPrice) * 100;
          existingPosition.holdingDays = Math.round(
            (new Date(currentDate).getTime() - new Date(existingPosition.entryDate).getTime()) / (1000 * 60 * 60 * 24)
          );

          equity += existingPosition.pnl;
          trades.push({ ...existingPosition });
          openPositions.delete(positionKey);
        }
      } else if (signalResult.signal === "buy" && signalResult.confidence >= config.confidenceMinimum) {
        const positionSize = equity * config.maxPositionPct;
        const quantity = Math.floor(positionSize / nextDayOpen);

        if (quantity > 0 && equity > positionSize) {
          const trade: Trade = {
            symbol,
            entryDate: dates[i + 1],
            entryPrice: nextDayOpen,
            quantity,
            side: "buy",
            stopLoss: signalResult.stopLoss || nextDayOpen * (1 - config.stopLossPct),
            takeProfit: signalResult.takeProfit || nextDayOpen * (1 + config.takeProfitPct),
            reasoning: signalResult.reasoning,
          };
          openPositions.set(positionKey, trade);
        }
      }

      equityCurve.push({ date: currentDate, equity });
      peakEquity = Math.max(peakEquity, equity);
      const drawdown = (peakEquity - equity) / peakEquity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    // Close remaining positions
    for (const [key, position] of openPositions) {
      if (position.symbol === symbol) {
        const lastBar = bars[bars.length - 1];
        position.exitDate = lastBar.t.split("T")[0];
        position.exitPrice = lastBar.c;
        position.exitReason = "end_of_period";
        position.pnl = (lastBar.c - position.entryPrice) * position.quantity;
        position.pnlPct = ((lastBar.c - position.entryPrice) / position.entryPrice) * 100;
        position.holdingDays = Math.round(
          (new Date(lastBar.t).getTime() - new Date(position.entryDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        equity += position.pnl;
        trades.push({ ...position });
        openPositions.delete(key);
      }
    }
  }

  const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
  const losingTrades = trades.filter(t => (t.pnl || 0) <= 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const avgHoldingDays = trades.length > 0
    ? trades.reduce((sum, t) => sum + (t.holdingDays || 0), 0) / trades.length
    : 0;

  const returns = equityCurve.length > 1 ? equityCurve.slice(1).map((e, i) =>
    (e.equity - equityCurve[i].equity) / equityCurve[i].equity
  ) : [];
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = returns.length > 0 ? Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  ) : 0;
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  const totalDays = equityCurve.length;
  const years = totalDays / 252;
  const cagr = years > 0 ? Math.pow(equity / config.initialCapital, 1 / years) - 1 : 0;

  return {
    config,
    trades,
    metrics: {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      totalPnl,
      totalPnlPct: (totalPnl / config.initialCapital) * 100,
      avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
      maxDrawdown: maxDrawdown * 100,
      sharpeRatio,
      avgHoldingDays,
      finalEquity: equity,
      cagr: cagr * 100,
    },
    equityCurve,
    sampleTrades: trades.slice(0, 10),
  };
}

function calculateScore(metrics: BacktestResult["metrics"]): number {
  const winRateScore = metrics.winRate * 0.25;
  const profitFactorScore = Math.min(metrics.profitFactor, 3) * 10 * 0.20;
  const sharpeScore = Math.max(0, metrics.sharpeRatio) * 10 * 0.25;
  const cagrScore = Math.max(0, metrics.cagr) * 2 * 0.15;
  const drawdownPenalty = Math.max(0, 20 - metrics.maxDrawdown) * 0.15;
  return winRateScore + profitFactorScore + sharpeScore + cagrScore + drawdownPenalty;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("=".repeat(80));
  console.log("OMAR ALGORITHMIC TRADING BACKTEST");
  console.log("=".repeat(80));

  const symbols = ["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA", "META", "AMZN", "AMD", "SPY", "QQQ"];

  const endDate = "2025-12-20";
  const startDate = "2024-01-01";

  console.log(`\nFetching historical data from ${startDate} to ${endDate}...`);
  const dataMap = await fetchHistoricalData(symbols, startDate, endDate);

  if (dataMap.size === 0) {
    console.error("No data fetched. Check API keys.");
    return;
  }

  const parameterSets: Partial<BacktestConfig>[] = [
    // Iteration 1: Conservative baseline
    { rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70, smaPeriod: 20, emaPeriodFast: 12, emaPeriodSlow: 26, atrPeriod: 14, atrMultiplierStop: 2.0, atrMultiplierTarget: 3.0, buyThreshold: 0.3, sellThreshold: 0.3, confidenceMinimum: 0.5, maxPositionPct: 0.05, stopLossPct: 0.03, takeProfitPct: 0.06 },
    // Iteration 2: Aggressive momentum
    { rsiPeriod: 10, rsiOversold: 25, rsiOverbought: 75, smaPeriod: 10, emaPeriodFast: 8, emaPeriodSlow: 21, atrPeriod: 10, atrMultiplierStop: 1.5, atrMultiplierTarget: 4.0, buyThreshold: 0.2, sellThreshold: 0.2, confidenceMinimum: 0.45, maxPositionPct: 0.08, stopLossPct: 0.04, takeProfitPct: 0.08 },
    // Iteration 3: Tight stops
    { rsiPeriod: 14, rsiOversold: 35, rsiOverbought: 65, smaPeriod: 20, emaPeriodFast: 12, emaPeriodSlow: 26, atrPeriod: 14, atrMultiplierStop: 1.2, atrMultiplierTarget: 2.5, buyThreshold: 0.25, sellThreshold: 0.25, confidenceMinimum: 0.55, maxPositionPct: 0.06, stopLossPct: 0.02, takeProfitPct: 0.05 },
    // Iteration 4: Wide targets
    { rsiPeriod: 21, rsiOversold: 30, rsiOverbought: 70, smaPeriod: 50, emaPeriodFast: 12, emaPeriodSlow: 26, atrPeriod: 20, atrMultiplierStop: 2.5, atrMultiplierTarget: 5.0, buyThreshold: 0.35, sellThreshold: 0.35, confidenceMinimum: 0.6, maxPositionPct: 0.05, stopLossPct: 0.05, takeProfitPct: 0.10 },
    // Iteration 5: High confidence only
    { rsiPeriod: 14, rsiOversold: 28, rsiOverbought: 72, smaPeriod: 20, emaPeriodFast: 9, emaPeriodSlow: 21, atrPeriod: 14, atrMultiplierStop: 2.0, atrMultiplierTarget: 3.5, buyThreshold: 0.4, sellThreshold: 0.4, confidenceMinimum: 0.65, maxPositionPct: 0.07, stopLossPct: 0.03, takeProfitPct: 0.07 },
    // Iteration 6: Balanced optimized
    { rsiPeriod: 12, rsiOversold: 32, rsiOverbought: 68, smaPeriod: 15, emaPeriodFast: 10, emaPeriodSlow: 24, atrPeriod: 12, atrMultiplierStop: 1.8, atrMultiplierTarget: 3.2, buyThreshold: 0.28, sellThreshold: 0.28, confidenceMinimum: 0.52, maxPositionPct: 0.065, stopLossPct: 0.028, takeProfitPct: 0.065 },
  ];

  interface Result { iteration: number; config: BacktestConfig; metrics: BacktestResult["metrics"]; score: number; sampleTrades: Trade[] }
  const results: Result[] = [];

  for (let i = 0; i < parameterSets.length; i++) {
    const params = parameterSets[i];
    const config: BacktestConfig = {
      symbols, startDate, endDate, initialCapital: 100000,
      maxPositionPct: params.maxPositionPct || 0.05,
      stopLossPct: params.stopLossPct || 0.03,
      takeProfitPct: params.takeProfitPct || 0.06,
      rsiPeriod: params.rsiPeriod || 14,
      rsiOversold: params.rsiOversold || 30,
      rsiOverbought: params.rsiOverbought || 70,
      smaPeriod: params.smaPeriod || 20,
      emaPeriodFast: params.emaPeriodFast || 12,
      emaPeriodSlow: params.emaPeriodSlow || 26,
      atrPeriod: params.atrPeriod || 14,
      atrMultiplierStop: params.atrMultiplierStop || 2.0,
      atrMultiplierTarget: params.atrMultiplierTarget || 3.0,
      buyThreshold: params.buyThreshold || 0.3,
      sellThreshold: params.sellThreshold || 0.3,
      confidenceMinimum: params.confidenceMinimum || 0.5,
    };

    console.log(`\n${"=".repeat(60)}`);
    console.log(`ITERATION ${i + 1}`);
    console.log(`${"=".repeat(60)}`);

    const result = runBacktest(dataMap, config);
    const score = calculateScore(result.metrics);

    results.push({ iteration: i + 1, config, metrics: result.metrics, score, sampleTrades: result.sampleTrades });

    console.log(`Trades: ${result.metrics.totalTrades} | Win Rate: ${result.metrics.winRate.toFixed(1)}%`);
    console.log(`P&L: $${result.metrics.totalPnl.toFixed(0)} (${result.metrics.totalPnlPct.toFixed(1)}%)`);
    console.log(`Profit Factor: ${result.metrics.profitFactor.toFixed(2)} | Sharpe: ${result.metrics.sharpeRatio.toFixed(2)}`);
    console.log(`Max DD: ${result.metrics.maxDrawdown.toFixed(1)}% | CAGR: ${result.metrics.cagr.toFixed(1)}%`);
    console.log(`Score: ${score.toFixed(2)}`);
  }

  results.sort((a, b) => b.score - a.score);
  const best = results[0];

  console.log(`\n${"=".repeat(80)}`);
  console.log("OPTIMIZATION COMPLETE - BEST RESULT");
  console.log(`${"=".repeat(80)}`);
  console.log(`Iteration: ${best.iteration}`);
  console.log(`Score: ${best.score.toFixed(2)}`);
  console.log(`\nMetrics:`);
  console.log(JSON.stringify(best.metrics, null, 2));
  console.log(`\nConfig:`);
  console.log(JSON.stringify(best.config, null, 2));

  console.log(`\nSample Trades:`);
  best.sampleTrades.slice(0, 5).forEach((t, i) => {
    console.log(`  ${i+1}. ${t.symbol}: ${t.entryDate} @ $${t.entryPrice.toFixed(2)} -> ${t.exitDate} @ $${t.exitPrice?.toFixed(2)} | P&L: $${t.pnl?.toFixed(2)} (${t.exitReason})`);
  });

  console.log("\n=== ALL RESULTS ===");
  results.forEach(r => {
    console.log(`Iter ${r.iteration}: Score=${r.score.toFixed(2)}, WinRate=${r.metrics.winRate.toFixed(1)}%, PF=${r.metrics.profitFactor.toFixed(2)}, Sharpe=${r.metrics.sharpeRatio.toFixed(2)}`);
  });
}

main().catch(console.error);
