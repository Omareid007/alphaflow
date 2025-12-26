/**
 * OMAR MOMENTUM OPTIMIZER
 *
 * Runs 1000+ iterations exploring momentum-focused parameter combinations
 * - Momentum lookback periods (5-30 days)
 * - Momentum weight in factor model (0.20-0.35)
 * - Tighter stops for momentum trades (ATR mult 1.0-1.5)
 * - Higher reward ratios (ATR mult 4-6)
 * - Faster RSI periods (7-12)
 */

// ============================================================================
// CONFIGURATION & INTERFACES
// ============================================================================

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

interface MomentumConfig {
  // Momentum-specific parameters
  momentumLookback: number;      // 5-30 days
  momentumWeight: number;         // 0.20-0.35
  rsiPeriod: number;              // 7-12
  atrMultStop: number;            // 1.0-1.5
  atrMultTarget: number;          // 4-6

  // Core trading parameters
  initialCapital: number;
  maxPositionPct: number;
  maxPositions: number;
  buyThreshold: number;
  confidenceMin: number;
  maxDailyLoss: number;

  // Factor weights (momentum gets custom weight)
  technicalWeight: number;
  volatilityWeight: number;
  volumeWeight: number;
  sentimentWeight: number;
}

interface BacktestMetrics {
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  avgHoldingDays: number;
  finalEquity: number;
  cagr: number;
}

interface OptimizationResult {
  config: MomentumConfig;
  metrics: BacktestMetrics;
  score: number; // Composite score for ranking
}

// ============================================================================
// MOMENTUM-FOCUSED UNIVERSE (High Beta, Trending Stocks)
// ============================================================================

const MOMENTUM_UNIVERSE = [
  // High Beta Tech
  "NVDA", "AMD", "TSLA", "META", "NFLX",
  // Growth Tech
  "MSFT", "GOOGL", "AAPL", "AMZN", "CRM",
  // Momentum ETFs
  "QQQ", "TQQQ", "SPY",
  // High Momentum Stocks
  "AVGO", "NOW", "PANW", "MU", "AMAT",
  // Sector Movers
  "XLK", "XLF", "XLE", "XLV",
];

// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

function calculateSMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) result.push(null);
    else result.push(prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function calculateEMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) result.push(null);
    else if (i === period - 1) result.push(prices.slice(0, period).reduce((a, b) => a + b, 0) / period);
    else result.push((prices[i] - result[i - 1]!) * k + result[i - 1]!);
  }
  return result;
}

function calculateRSI(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      let gains = 0, losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const change = prices[j] - prices[j - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }
  return result;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const tr: number[] = [];
  for (let i = 0; i < highs.length; i++) {
    if (i === 0) tr.push(highs[i] - lows[i]);
    else tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) result.push(null);
    else result.push(tr.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function calculateROC(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) result.push(null);
    else result.push(((prices[i] - prices[i - period]) / prices[i - period]) * 100);
  }
  return result;
}

function calculateADX(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < highs.length; i++) {
    if (i < period * 2) result.push(null);
    else {
      let sumPlusDM = 0, sumMinusDM = 0, sumTR = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const upMove = highs[j] - highs[j - 1];
        const downMove = lows[j - 1] - lows[j];
        sumPlusDM += upMove > downMove && upMove > 0 ? upMove : 0;
        sumMinusDM += downMove > upMove && downMove > 0 ? downMove : 0;
        sumTR += Math.max(highs[j] - lows[j], Math.abs(highs[j] - closes[j - 1]), Math.abs(lows[j] - closes[j - 1]));
      }
      const plusDI = sumTR !== 0 ? (sumPlusDM / sumTR) * 100 : 0;
      const minusDI = sumTR !== 0 ? (sumMinusDM / sumTR) * 100 : 0;
      result.push((plusDI + minusDI) !== 0 ? (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100 : 0);
    }
  }
  return result;
}

// ============================================================================
// MOMENTUM SIGNAL GENERATION
// ============================================================================

function generateMomentumSignal(
  index: number,
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
  config: MomentumConfig
): { composite: number; confidence: number } {
  if (index < 50) return { composite: 0, confidence: 0 };

  const price = closes[index];

  // Calculate indicators with custom periods
  const rsi = calculateRSI(closes, config.rsiPeriod);
  const atr = calculateATR(highs, lows, closes, 14);
  const adx = calculateADX(highs, lows, closes, 14);
  const roc = calculateROC(closes, config.momentumLookback);
  const emaFast = calculateEMA(closes, 8);
  const emaSlow = calculateEMA(closes, 21);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);

  // ============ MOMENTUM SCORE ============
  let momentum = 0;

  // ROC with custom lookback
  const rocVal = roc[index];
  if (rocVal !== null) {
    if (rocVal > 15) momentum += 1.0;
    else if (rocVal > 10) momentum += 0.8;
    else if (rocVal > 5) momentum += 0.5;
    else if (rocVal < -10) momentum -= 1.0;
    else if (rocVal < -5) momentum -= 0.5;
  }

  // EMA crossover momentum
  const emaF = emaFast[index];
  const emaS = emaSlow[index];
  if (emaF !== null && emaS !== null) {
    const emaDiff = (emaF - emaS) / emaS * 100;
    if (emaDiff > 4) momentum += 0.9;
    else if (emaDiff > 2) momentum += 0.6;
    else if (emaDiff < -4) momentum -= 0.9;
    else if (emaDiff < -2) momentum -= 0.6;
  }

  // Price vs SMAs (trend strength)
  const s50 = sma50[index];
  const s200 = sma200[index];
  let trendPoints = 0;
  if (s50 !== null && price > s50) trendPoints++;
  if (s200 !== null && price > s200) trendPoints++;
  if (s50 !== null && s200 !== null && s50 > s200) trendPoints++;
  momentum += (trendPoints / 3) * 0.7;

  momentum = Math.max(-1, Math.min(1, momentum));

  // ============ TECHNICAL SCORE ============
  let technical = 0;

  // RSI with custom period
  const rsiVal = rsi[index];
  if (rsiVal !== null) {
    if (rsiVal < 30) technical += 1.0;
    else if (rsiVal < 40) technical += 0.6;
    else if (rsiVal > 70) technical -= 1.0;
    else if (rsiVal > 60) technical -= 0.6;
    else if (rsiVal >= 50 && rsiVal <= 60) technical += 0.3; // Momentum continuation
  }

  // ADX (trend strength)
  const adxVal = adx[index];
  if (adxVal !== null) {
    if (adxVal > 30) technical += 0.5;
    else if (adxVal > 25) technical += 0.3;
  }

  technical = Math.max(-1, Math.min(1, technical));

  // ============ VOLATILITY SCORE ============
  let volatility = 0;
  if (adxVal !== null) {
    if (adxVal > 35) volatility += 0.5; // Strong trend
    else if (adxVal < 20) volatility -= 0.3; // Weak trend
  }

  // ============ VOLUME SCORE ============
  let volume = 0;
  if (index >= 20) {
    const avgVol = volumes.slice(index - 20, index).reduce((a, b) => a + b, 0) / 20;
    const volRatio = volumes[index] / avgVol;
    if (volRatio > 2.0) volume = 0.8;
    else if (volRatio > 1.5) volume = 0.5;
    else if (volRatio < 0.7) volume = -0.3;
  }

  // ============ SENTIMENT SCORE ============
  let sentiment = 0;
  const return5d = index >= 5 ? (price - closes[index - 5]) / closes[index - 5] : 0;
  const return20d = index >= 20 ? (price - closes[index - 20]) / closes[index - 20] : 0;

  if (return20d > 0.08) sentiment += 0.6;
  else if (return20d > 0.04) sentiment += 0.3;
  else if (return20d < -0.08) sentiment -= 0.6;

  if (return5d > 0.03 && return20d > 0) sentiment += 0.4;

  sentiment = Math.max(-1, Math.min(1, sentiment));

  // ============ COMPOSITE WITH MOMENTUM FOCUS ============
  const composite =
    technical * config.technicalWeight +
    momentum * config.momentumWeight +
    volatility * config.volatilityWeight +
    volume * config.volumeWeight +
    sentiment * config.sentimentWeight;

  // ============ CONFIDENCE ============
  const scores = [technical, momentum, volatility, volume, sentiment];
  const posCount = scores.filter(s => s > 0.2).length;
  const alignment = posCount / scores.length;
  const confidence = Math.min(1, alignment * Math.abs(composite) * 2.5);

  return { composite, confidence };
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
}

interface Trade {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  shares: number;
  pnl: number;
  pnlPct: number;
  exitReason: string;
  holdingDays: number;
}

function runMomentumBacktest(
  dataMap: Map<string, AlpacaBar[]>,
  config: MomentumConfig
): BacktestMetrics {
  const trades: Trade[] = [];
  const positions = new Map<string, Position>();

  let equity = config.initialCapital;
  let peakEquity = equity;
  let maxDrawdown = 0;

  // Get all dates
  const allDates = new Set<string>();
  for (const bars of dataMap.values()) {
    for (const bar of bars) allDates.add(bar.t.split("T")[0]);
  }
  const sortedDates = Array.from(allDates).sort();

  for (const date of sortedDates) {
    let dailyPnl = 0;

    for (const [symbol, bars] of dataMap) {
      const dateIndex = bars.findIndex(b => b.t.split("T")[0] === date);
      if (dateIndex < 50) continue;

      const bar = bars[dateIndex];
      const closes = bars.map(b => b.c);
      const highs = bars.map(b => b.h);
      const lows = bars.map(b => b.l);
      const volumes = bars.map(b => b.v);

      const signals = generateMomentumSignal(dateIndex, closes, highs, lows, volumes, config);
      const atr = calculateATR(highs, lows, closes, 14)[dateIndex];

      // Check existing position
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
        } else if (signals.composite < -0.15) {
          exitReason = "signal_reversal";
        } else if (bar.c > position.entryPrice * 1.03 && atr !== null) {
          // Trailing stop for momentum
          position.stopLoss = Math.max(position.stopLoss, bar.c - atr * config.atrMultStop);
        }

        if (exitReason) {
          const pnl = (exitPrice - position.entryPrice) * position.shares;
          const holdingDays = Math.floor((new Date(date).getTime() - new Date(position.entryDate).getTime()) / (1000 * 60 * 60 * 24));

          trades.push({
            symbol,
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: date,
            exitPrice,
            shares: position.shares,
            pnl,
            pnlPct: (exitPrice - position.entryPrice) / position.entryPrice * 100,
            exitReason,
            holdingDays,
          });

          equity += pnl;
          dailyPnl += pnl;
          positions.delete(symbol);
        }
      } else {
        // Entry logic - momentum breakout focus
        const canEnter =
          signals.composite > config.buyThreshold &&
          signals.confidence > config.confidenceMin &&
          positions.size < config.maxPositions;

        if (canEnter && atr !== null && atr > 0) {
          const positionSize = equity * config.maxPositionPct;
          const shares = Math.floor(positionSize / bar.c);

          if (shares > 0) {
            positions.set(symbol, {
              symbol,
              shares,
              entryPrice: bar.c,
              entryDate: date,
              stopLoss: bar.c - atr * config.atrMultStop,
              takeProfit: bar.c + atr * config.atrMultTarget,
            });
          }
        }
      }
    }

    // Daily loss check
    if (dailyPnl < -equity * config.maxDailyLoss) {
      for (const [symbol, position] of positions) {
        const bars = dataMap.get(symbol)!;
        const bar = bars.find(b => b.t.split("T")[0] === date);
        if (bar) {
          const pnl = (bar.c - position.entryPrice) * position.shares;
          trades.push({
            symbol,
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: date,
            exitPrice: bar.c,
            shares: position.shares,
            pnl,
            pnlPct: (bar.c - position.entryPrice) / position.entryPrice * 100,
            exitReason: "daily_loss_limit",
            holdingDays: 0,
          });
          equity += pnl;
        }
      }
      positions.clear();
    }

    // Track drawdown
    if (equity > peakEquity) peakEquity = equity;
    maxDrawdown = Math.max(maxDrawdown, (peakEquity - equity) / peakEquity * 100);
  }

  // Close remaining positions
  const lastDate = sortedDates[sortedDates.length - 1];
  for (const [symbol, position] of positions) {
    const bars = dataMap.get(symbol)!;
    const bar = bars.find(b => b.t.split("T")[0] === lastDate);
    if (bar) {
      const pnl = (bar.c - position.entryPrice) * position.shares;
      trades.push({
        symbol,
        entryDate: position.entryDate,
        entryPrice: position.entryPrice,
        exitDate: lastDate,
        exitPrice: bar.c,
        shares: position.shares,
        pnl,
        pnlPct: (bar.c - position.entryPrice) / position.entryPrice * 100,
        exitReason: "end_of_backtest",
        holdingDays: Math.floor((new Date(lastDate).getTime() - new Date(position.entryDate).getTime()) / (1000 * 60 * 60 * 24)),
      });
      equity += pnl;
    }
  }

  // Calculate metrics
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

  const returns = trades.map(t => t.pnlPct / 100);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length) : 0;
  const downReturns = returns.filter(r => r < 0);
  const downStdDev = downReturns.length > 1 ? Math.sqrt(downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downReturns.length) : 1;

  const sharpeRatio = stdDev !== 0 ? (avgReturn * Math.sqrt(252)) / stdDev : 0;
  const sortinoRatio = downStdDev !== 0 ? (avgReturn * Math.sqrt(252)) / downStdDev : 0;
  const years = 2.95;
  const cagr = years > 0 ? (Math.pow(equity / config.initialCapital, 1 / years) - 1) * 100 : 0;
  const calmarRatio = maxDrawdown > 0 ? cagr / maxDrawdown : 0;

  return {
    totalTrades: trades.length,
    winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    totalReturn: (equity - config.initialCapital) / config.initialCapital * 100,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    maxDrawdown,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : 0,
    avgHoldingDays: trades.length > 0 ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length : 0,
    finalEquity: equity,
    cagr,
  };
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchAlpacaBars(symbol: string, startDate: string, endDate: string): Promise<AlpacaBar[]> {
  const ALPACA_KEY = process.env.ALPACA_API_KEY;
  const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;

  if (!ALPACA_KEY || !ALPACA_SECRET) {
    throw new Error("Alpaca API credentials not configured");
  }

  const baseUrl = "https://data.alpaca.markets/v2/stocks";
  const allBars: AlpacaBar[] = [];
  let pageToken: string | null = null;

  do {
    const params = new URLSearchParams({
      start: `${startDate}T00:00:00Z`,
      end: `${endDate}T23:59:59Z`,
      timeframe: "1Day",
      limit: "10000",
    });

    if (pageToken) params.set("page_token", pageToken);

    const url = `${baseUrl}/${symbol}/bars?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
      },
    });

    if (!response.ok) {
      throw new Error(`Alpaca API error: ${response.status}`);
    }

    const data = await response.json();
    allBars.push(...(data.bars || []));
    pageToken = data.next_page_token || null;
  } while (pageToken);

  return allBars;
}

// ============================================================================
// OPTIMIZER
// ============================================================================

async function optimizeMomentumStrategy(): Promise<OptimizationResult[]> {
  console.log("=".repeat(100));
  console.log("OMAR MOMENTUM OPTIMIZER");
  console.log("=".repeat(100));
  console.log(`Universe: ${MOMENTUM_UNIVERSE.length} high-momentum symbols`);
  console.log(`Period: 2022-01-01 to 2025-12-20 (3 years)`);
  console.log("=".repeat(100));

  // Fetch data
  console.log(`\nFetching historical data...`);
  const dataMap = new Map<string, AlpacaBar[]>();
  const startDate = "2022-01-01";
  const endDate = "2025-12-20";

  for (const symbol of MOMENTUM_UNIVERSE) {
    try {
      const bars = await fetchAlpacaBars(symbol, startDate, endDate);
      if (bars.length > 200) {
        dataMap.set(symbol, bars);
        console.log(`${symbol}: ${bars.length} bars`);
      }
    } catch (error) {
      console.log(`${symbol}: ERROR`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nLoaded ${dataMap.size}/${MOMENTUM_UNIVERSE.length} symbols`);
  console.log("\nStarting optimization...\n");

  // Parameter ranges
  const momentumLookbacks = [];
  for (let i = 5; i <= 30; i += 2) momentumLookbacks.push(i);

  const momentumWeights = [];
  for (let w = 0.20; w <= 0.35; w += 0.02) momentumWeights.push(Math.round(w * 100) / 100);

  const rsiPeriods = [7, 8, 9, 10, 11, 12];

  const atrStops = [];
  for (let s = 1.0; s <= 1.5; s += 0.1) atrStops.push(Math.round(s * 10) / 10);

  const atrTargets = [];
  for (let t = 4.0; t <= 6.0; t += 0.5) atrTargets.push(Math.round(t * 10) / 10);

  const buyThresholds = [0.10, 0.12, 0.14, 0.16];
  const confidenceMins = [0.22, 0.25, 0.28, 0.30];

  // Calculate total iterations
  const totalIterations =
    momentumLookbacks.length *
    momentumWeights.length *
    rsiPeriods.length *
    atrStops.length *
    atrTargets.length *
    buyThresholds.length *
    confidenceMins.length;

  console.log(`Total parameter combinations: ${totalIterations}`);
  console.log(`\nParameter ranges:`);
  console.log(`  Momentum Lookback: ${momentumLookbacks[0]}-${momentumLookbacks[momentumLookbacks.length - 1]} (${momentumLookbacks.length} values)`);
  console.log(`  Momentum Weight: ${momentumWeights[0]}-${momentumWeights[momentumWeights.length - 1]} (${momentumWeights.length} values)`);
  console.log(`  RSI Period: ${rsiPeriods[0]}-${rsiPeriods[rsiPeriods.length - 1]} (${rsiPeriods.length} values)`);
  console.log(`  ATR Stop: ${atrStops[0]}-${atrStops[atrStops.length - 1]} (${atrStops.length} values)`);
  console.log(`  ATR Target: ${atrTargets[0]}-${atrTargets[atrTargets.length - 1]} (${atrTargets.length} values)`);
  console.log(`  Buy Threshold: ${buyThresholds[0]}-${buyThresholds[buyThresholds.length - 1]} (${buyThresholds.length} values)`);
  console.log(`  Confidence Min: ${confidenceMins[0]}-${confidenceMins[confidenceMins.length - 1]} (${confidenceMins.length} values)`);
  console.log("\n");

  const results: OptimizationResult[] = [];
  let iteration = 0;
  const startTime = Date.now();

  // Run optimization
  for (const momentumLookback of momentumLookbacks) {
    for (const momentumWeight of momentumWeights) {
      for (const rsiPeriod of rsiPeriods) {
        for (const atrStop of atrStops) {
          for (const atrTarget of atrTargets) {
            for (const buyThreshold of buyThresholds) {
              for (const confidenceMin of confidenceMins) {
                iteration++;

                // Balance remaining weights
                const remainingWeight = 1.0 - momentumWeight;
                const config: MomentumConfig = {
                  momentumLookback,
                  momentumWeight,
                  rsiPeriod,
                  atrMultStop: atrStop,
                  atrMultTarget: atrTarget,
                  initialCapital: 100000,
                  maxPositionPct: 0.08,
                  maxPositions: 12,
                  buyThreshold,
                  confidenceMin,
                  maxDailyLoss: 0.05,
                  technicalWeight: remainingWeight * 0.30,
                  volatilityWeight: remainingWeight * 0.15,
                  volumeWeight: remainingWeight * 0.30,
                  sentimentWeight: remainingWeight * 0.25,
                };

                const metrics = runMomentumBacktest(dataMap, config);

                // Calculate composite score
                // Prioritize: Sharpe > Sortino > Calmar > Win Rate > Return
                const score =
                  metrics.sharpeRatio * 30 +
                  metrics.sortinoRatio * 25 +
                  metrics.calmarRatio * 20 +
                  metrics.winRate * 0.15 +
                  metrics.totalReturn * 0.10;

                results.push({ config, metrics, score });

                // Progress update
                if (iteration % 100 === 0 || iteration === totalIterations) {
                  const elapsed = (Date.now() - startTime) / 1000;
                  const rate = iteration / elapsed;
                  const eta = (totalIterations - iteration) / rate;

                  console.log(
                    `[${iteration}/${totalIterations}] ` +
                    `MomLB=${momentumLookback} MomW=${momentumWeight.toFixed(2)} RSI=${rsiPeriod} ` +
                    `Stop=${atrStop.toFixed(1)} Tgt=${atrTarget.toFixed(1)} | ` +
                    `Sharpe=${metrics.sharpeRatio.toFixed(2)} Sortino=${metrics.sortinoRatio.toFixed(2)} ` +
                    `Win=${metrics.winRate.toFixed(1)}% Ret=${metrics.totalReturn.toFixed(1)}% | ` +
                    `ETA=${Math.floor(eta)}s`
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  return results;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const results = await optimizeMomentumStrategy();

  // Sort by score
  results.sort((a, b) => b.score - a.score);

  console.log("\n" + "=".repeat(100));
  console.log("OPTIMIZATION COMPLETE");
  console.log("=".repeat(100));

  // Top 20 configurations
  console.log("\nTOP 20 MOMENTUM CONFIGURATIONS:\n");

  for (let i = 0; i < Math.min(20, results.length); i++) {
    const r = results[i];
    console.log(`\n--- RANK ${i + 1} (Score: ${r.score.toFixed(2)}) ---`);
    console.log(`Parameters:`);
    console.log(`  Momentum Lookback: ${r.config.momentumLookback} days`);
    console.log(`  Momentum Weight: ${r.config.momentumWeight.toFixed(2)}`);
    console.log(`  RSI Period: ${r.config.rsiPeriod}`);
    console.log(`  ATR Stop: ${r.config.atrMultStop.toFixed(1)}x`);
    console.log(`  ATR Target: ${r.config.atrMultTarget.toFixed(1)}x`);
    console.log(`  Buy Threshold: ${r.config.buyThreshold.toFixed(2)}`);
    console.log(`  Confidence Min: ${r.config.confidenceMin.toFixed(2)}`);
    console.log(`Metrics:`);
    console.log(`  Total Trades: ${r.metrics.totalTrades}`);
    console.log(`  Win Rate: ${r.metrics.winRate.toFixed(2)}%`);
    console.log(`  Total Return: ${r.metrics.totalReturn.toFixed(2)}%`);
    console.log(`  CAGR: ${r.metrics.cagr.toFixed(2)}%`);
    console.log(`  Sharpe Ratio: ${r.metrics.sharpeRatio.toFixed(3)}`);
    console.log(`  Sortino Ratio: ${r.metrics.sortinoRatio.toFixed(3)}`);
    console.log(`  Calmar Ratio: ${r.metrics.calmarRatio.toFixed(3)}`);
    console.log(`  Max Drawdown: ${r.metrics.maxDrawdown.toFixed(2)}%`);
    console.log(`  Profit Factor: ${r.metrics.profitFactor.toFixed(2)}`);
    console.log(`  Avg Holding Days: ${r.metrics.avgHoldingDays.toFixed(1)}`);
    console.log(`  Final Equity: $${r.metrics.finalEquity.toFixed(0)}`);
  }

  // Best configuration
  const best = results[0];
  console.log("\n" + "=".repeat(100));
  console.log("BEST MOMENTUM CONFIGURATION");
  console.log("=".repeat(100));
  console.log(`\nMomentum Lookback: ${best.config.momentumLookback} days`);
  console.log(`Momentum Weight: ${best.config.momentumWeight.toFixed(3)}`);
  console.log(`RSI Period: ${best.config.rsiPeriod}`);
  console.log(`ATR Stop Multiplier: ${best.config.atrMultStop.toFixed(2)}x`);
  console.log(`ATR Target Multiplier: ${best.config.atrMultTarget.toFixed(2)}x`);
  console.log(`Buy Threshold: ${best.config.buyThreshold.toFixed(3)}`);
  console.log(`Confidence Minimum: ${best.config.confidenceMin.toFixed(3)}`);
  console.log(`\nPerformance:`);
  console.log(`  Sharpe Ratio: ${best.metrics.sharpeRatio.toFixed(3)}`);
  console.log(`  Sortino Ratio: ${best.metrics.sortinoRatio.toFixed(3)}`);
  console.log(`  Calmar Ratio: ${best.metrics.calmarRatio.toFixed(3)}`);
  console.log(`  Win Rate: ${best.metrics.winRate.toFixed(2)}%`);
  console.log(`  Total Return: ${best.metrics.totalReturn.toFixed(2)}%`);
  console.log(`  CAGR: ${best.metrics.cagr.toFixed(2)}%`);
  console.log(`  Max Drawdown: ${best.metrics.maxDrawdown.toFixed(2)}%`);
  console.log(`  Profit Factor: ${best.metrics.profitFactor.toFixed(2)}`);
  console.log(`  Total Trades: ${best.metrics.totalTrades}`);
  console.log(`  Avg Holding: ${best.metrics.avgHoldingDays.toFixed(1)} days`);
  console.log(`  Final Equity: $${best.metrics.finalEquity.toFixed(0)}`);
  console.log("\n" + "=".repeat(100));

  // Statistics
  console.log("\nOPTIMIZATION STATISTICS:");
  console.log(`Total configurations tested: ${results.length}`);
  console.log(`Configurations with positive return: ${results.filter(r => r.metrics.totalReturn > 0).length}`);
  console.log(`Configurations with Sharpe > 1.0: ${results.filter(r => r.metrics.sharpeRatio > 1.0).length}`);
  console.log(`Configurations with Sharpe > 1.5: ${results.filter(r => r.metrics.sharpeRatio > 1.5).length}`);
  console.log(`Configurations with win rate > 55%: ${results.filter(r => r.metrics.winRate > 55).length}`);
  console.log(`Configurations with max DD < 15%: ${results.filter(r => r.metrics.maxDrawdown < 15).length}`);

  // Best by individual metrics
  const bestSharpe = results.reduce((a, b) => a.metrics.sharpeRatio > b.metrics.sharpeRatio ? a : b);
  const bestSortino = results.reduce((a, b) => a.metrics.sortinoRatio > b.metrics.sortinoRatio ? a : b);
  const bestCalmar = results.reduce((a, b) => a.metrics.calmarRatio > b.metrics.calmarRatio ? a : b);
  const bestWinRate = results.reduce((a, b) => a.metrics.winRate > b.metrics.winRate ? a : b);
  const bestReturn = results.reduce((a, b) => a.metrics.totalReturn > b.metrics.totalReturn ? a : b);

  console.log(`\nBEST BY METRIC:`);
  console.log(`  Best Sharpe: ${bestSharpe.metrics.sharpeRatio.toFixed(3)} (MomLB=${bestSharpe.config.momentumLookback}, MomW=${bestSharpe.config.momentumWeight.toFixed(2)})`);
  console.log(`  Best Sortino: ${bestSortino.metrics.sortinoRatio.toFixed(3)} (MomLB=${bestSortino.config.momentumLookback}, MomW=${bestSortino.config.momentumWeight.toFixed(2)})`);
  console.log(`  Best Calmar: ${bestCalmar.metrics.calmarRatio.toFixed(3)} (MomLB=${bestCalmar.config.momentumLookback}, MomW=${bestCalmar.config.momentumWeight.toFixed(2)})`);
  console.log(`  Best Win Rate: ${bestWinRate.metrics.winRate.toFixed(2)}% (MomLB=${bestWinRate.config.momentumLookback}, MomW=${bestWinRate.config.momentumWeight.toFixed(2)})`);
  console.log(`  Best Return: ${bestReturn.metrics.totalReturn.toFixed(2)}% (MomLB=${bestReturn.config.momentumLookback}, MomW=${bestReturn.config.momentumWeight.toFixed(2)})`);

  console.log("\n" + "=".repeat(100));
}

main().catch(console.error);
