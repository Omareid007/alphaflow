/**
 * OMAR MOMENTUM OPTIMIZER - FAST VERSION
 *
 * Optimized for speed while still exploring 1000+ momentum-focused configurations
 * Uses grid sampling with key parameter combinations
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
  momentumLookback: number;
  momentumWeight: number;
  rsiPeriod: number;
  atrMultStop: number;
  atrMultTarget: number;
  buyThreshold: number;
  confidenceMin: number;
  initialCapital: number;
  maxPositionPct: number;
  maxPositions: number;
  maxDailyLoss: number;
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
  score: number;
}

// ============================================================================
// MOMENTUM UNIVERSE
// ============================================================================

const MOMENTUM_UNIVERSE = [
  "NVDA",
  "AMD",
  "TSLA",
  "META",
  "NFLX",
  "MSFT",
  "GOOGL",
  "AAPL",
  "AMZN",
  "CRM",
  "QQQ",
  "TQQQ",
  "SPY",
  "AVGO",
  "NOW",
  "PANW",
  "MU",
  "AMAT",
  "XLK",
  "XLF",
  "XLE",
  "XLV",
];

// ============================================================================
// TECHNICAL INDICATORS (Simplified for speed)
// ============================================================================

function calculateSMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) result.push(null);
    else
      result.push(
        prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
      );
  }
  return result;
}

function calculateEMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) result.push(null);
    else if (i === period - 1)
      result.push(prices.slice(0, period).reduce((a, b) => a + b, 0) / period);
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
      let gains = 0,
        losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const change = prices[j] - prices[j - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): (number | null)[] {
  const result: (number | null)[] = [];
  const tr: number[] = [];
  for (let i = 0; i < highs.length; i++) {
    if (i === 0) tr.push(highs[i] - lows[i]);
    else
      tr.push(
        Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - closes[i - 1]),
          Math.abs(lows[i] - closes[i - 1])
        )
      );
  }
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) result.push(null);
    else
      result.push(
        tr.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
      );
  }
  return result;
}

function calculateROC(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) result.push(null);
    else
      result.push(
        ((prices[i] - prices[i - period]) / prices[i - period]) * 100
      );
  }
  return result;
}

// ============================================================================
// CACHED INDICATORS (Compute once per symbol)
// ============================================================================

interface CachedIndicators {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  ema8: (number | null)[];
  ema21: (number | null)[];
  sma50: (number | null)[];
  sma200: (number | null)[];
  atr14: (number | null)[];
  // ROC and RSI will be calculated on demand with varying periods
}

function precalculateIndicators(bars: AlpacaBar[]): CachedIndicators {
  const closes = bars.map((b) => b.c);
  const highs = bars.map((b) => b.h);
  const lows = bars.map((b) => b.l);
  const volumes = bars.map((b) => b.v);

  return {
    closes,
    highs,
    lows,
    volumes,
    ema8: calculateEMA(closes, 8),
    ema21: calculateEMA(closes, 21),
    sma50: calculateSMA(closes, 50),
    sma200: calculateSMA(closes, 200),
    atr14: calculateATR(highs, lows, closes, 14),
  };
}

// ============================================================================
// MOMENTUM SIGNAL
// ============================================================================

function generateMomentumSignal(
  index: number,
  cached: CachedIndicators,
  config: MomentumConfig,
  rsi: (number | null)[],
  roc: (number | null)[]
): { composite: number; confidence: number } {
  if (index < 50) return { composite: 0, confidence: 0 };

  const price = cached.closes[index];

  // MOMENTUM SCORE
  let momentum = 0;

  const rocVal = roc[index];
  if (rocVal !== null) {
    if (rocVal > 15) momentum += 1.0;
    else if (rocVal > 10) momentum += 0.8;
    else if (rocVal > 5) momentum += 0.5;
    else if (rocVal < -10) momentum -= 1.0;
    else if (rocVal < -5) momentum -= 0.5;
  }

  const emaF = cached.ema8[index];
  const emaS = cached.ema21[index];
  if (emaF !== null && emaS !== null) {
    const emaDiff = ((emaF - emaS) / emaS) * 100;
    if (emaDiff > 4) momentum += 0.9;
    else if (emaDiff > 2) momentum += 0.6;
    else if (emaDiff < -4) momentum -= 0.9;
    else if (emaDiff < -2) momentum -= 0.6;
  }

  const s50 = cached.sma50[index];
  const s200 = cached.sma200[index];
  let trendPoints = 0;
  if (s50 !== null && price > s50) trendPoints++;
  if (s200 !== null && price > s200) trendPoints++;
  if (s50 !== null && s200 !== null && s50 > s200) trendPoints++;
  momentum += (trendPoints / 3) * 0.7;

  momentum = Math.max(-1, Math.min(1, momentum));

  // TECHNICAL SCORE
  let technical = 0;

  const rsiVal = rsi[index];
  if (rsiVal !== null) {
    if (rsiVal < 30) technical += 1.0;
    else if (rsiVal < 40) technical += 0.6;
    else if (rsiVal > 70) technical -= 1.0;
    else if (rsiVal > 60) technical -= 0.6;
    else if (rsiVal >= 50 && rsiVal <= 60) technical += 0.3;
  }

  technical = Math.max(-1, Math.min(1, technical));

  // VOLUME SCORE
  let volume = 0;
  if (index >= 20) {
    const avgVol =
      cached.volumes.slice(index - 20, index).reduce((a, b) => a + b, 0) / 20;
    const volRatio = cached.volumes[index] / avgVol;
    if (volRatio > 2.0) volume = 0.8;
    else if (volRatio > 1.5) volume = 0.5;
    else if (volRatio < 0.7) volume = -0.3;
  }

  // SENTIMENT
  let sentiment = 0;
  const return20d =
    index >= 20
      ? (price - cached.closes[index - 20]) / cached.closes[index - 20]
      : 0;
  if (return20d > 0.08) sentiment += 0.6;
  else if (return20d > 0.04) sentiment += 0.3;
  else if (return20d < -0.08) sentiment -= 0.6;

  sentiment = Math.max(-1, Math.min(1, sentiment));

  // COMPOSITE
  const composite =
    technical * config.technicalWeight +
    momentum * config.momentumWeight +
    volume * config.volumeWeight +
    sentiment * config.sentimentWeight;

  // CONFIDENCE
  const scores = [technical, momentum, volume, sentiment];
  const posCount = scores.filter((s) => s > 0.2).length;
  const alignment = posCount / scores.length;
  const confidence = Math.min(1, alignment * Math.abs(composite) * 2.5);

  return { composite, confidence };
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

function runMomentumBacktest(
  cachedData: Map<string, CachedIndicators>,
  allDates: string[],
  config: MomentumConfig
): BacktestMetrics {
  interface Position {
    symbol: string;
    shares: number;
    entryPrice: number;
    entryDate: string;
    stopLoss: number;
    takeProfit: number;
  }

  interface Trade {
    pnl: number;
    pnlPct: number;
    holdingDays: number;
  }

  const trades: Trade[] = [];
  const positions = new Map<string, Position>();
  let equity = config.initialCapital;
  let peakEquity = equity;
  let maxDrawdown = 0;

  // Pre-calculate RSI and ROC for all symbols
  const rsiCache = new Map<string, (number | null)[]>();
  const rocCache = new Map<string, (number | null)[]>();

  for (const [symbol, cached] of cachedData) {
    rsiCache.set(symbol, calculateRSI(cached.closes, config.rsiPeriod));
    rocCache.set(symbol, calculateROC(cached.closes, config.momentumLookback));
  }

  for (const date of allDates) {
    let dailyPnl = 0;

    for (const [symbol, cached] of cachedData) {
      const dateIndex = cached.closes.findIndex((_, i, arr) => {
        return i < allDates.length && allDates[i] === date;
      });

      if (dateIndex < 0 || dateIndex < 50) continue;

      const high = cached.highs[dateIndex];
      const low = cached.lows[dateIndex];
      const close = cached.closes[dateIndex];
      const rsi = rsiCache.get(symbol)!;
      const roc = rocCache.get(symbol)!;

      const signals = generateMomentumSignal(
        dateIndex,
        cached,
        config,
        rsi,
        roc
      );
      const atr = cached.atr14[dateIndex];

      // Check existing position
      const position = positions.get(symbol);
      if (position) {
        let exitReason: string | null = null;
        let exitPrice = close;

        if (low <= position.stopLoss) {
          exitReason = "stop_loss";
          exitPrice = position.stopLoss;
        } else if (high >= position.takeProfit) {
          exitReason = "take_profit";
          exitPrice = position.takeProfit;
        } else if (signals.composite < -0.15) {
          exitReason = "signal_reversal";
        } else if (close > position.entryPrice * 1.03 && atr !== null) {
          position.stopLoss = Math.max(
            position.stopLoss,
            close - atr * config.atrMultStop
          );
        }

        if (exitReason) {
          const pnl = (exitPrice - position.entryPrice) * position.shares;
          const holdingDays = Math.floor(
            (new Date(date).getTime() -
              new Date(position.entryDate).getTime()) /
              86400000
          );

          trades.push({
            pnl,
            pnlPct:
              ((exitPrice - position.entryPrice) / position.entryPrice) * 100,
            holdingDays,
          });

          equity += pnl;
          dailyPnl += pnl;
          positions.delete(symbol);
        }
      } else {
        // Entry logic
        const canEnter =
          signals.composite > config.buyThreshold &&
          signals.confidence > config.confidenceMin &&
          positions.size < config.maxPositions;

        if (canEnter && atr !== null && atr > 0) {
          const positionSize = equity * config.maxPositionPct;
          const shares = Math.floor(positionSize / close);

          if (shares > 0) {
            positions.set(symbol, {
              symbol,
              shares,
              entryPrice: close,
              entryDate: date,
              stopLoss: close - atr * config.atrMultStop,
              takeProfit: close + atr * config.atrMultTarget,
            });
          }
        }
      }
    }

    // Daily loss check
    if (dailyPnl < -equity * config.maxDailyLoss) {
      for (const [symbol, position] of positions) {
        const cached = cachedData.get(symbol)!;
        const dateIndex = cached.closes.findIndex(
          (_, i) => i < allDates.length && allDates[i] === date
        );
        if (dateIndex >= 0) {
          const close = cached.closes[dateIndex];
          const pnl = (close - position.entryPrice) * position.shares;
          trades.push({
            pnl,
            pnlPct: ((close - position.entryPrice) / position.entryPrice) * 100,
            holdingDays: 0,
          });
          equity += pnl;
        }
      }
      positions.clear();
    }

    // Track drawdown
    if (equity > peakEquity) peakEquity = equity;
    maxDrawdown = Math.max(
      maxDrawdown,
      ((peakEquity - equity) / peakEquity) * 100
    );
  }

  // Close remaining positions
  const lastDate = allDates[allDates.length - 1];
  for (const [symbol, position] of positions) {
    const cached = cachedData.get(symbol)!;
    const lastPrice = cached.closes[cached.closes.length - 1];
    const pnl = (lastPrice - position.entryPrice) * position.shares;
    trades.push({
      pnl,
      pnlPct: ((lastPrice - position.entryPrice) / position.entryPrice) * 100,
      holdingDays: Math.floor(
        (new Date(lastDate).getTime() -
          new Date(position.entryDate).getTime()) /
          86400000
      ),
    });
    equity += pnl;
  }

  // Calculate metrics
  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl <= 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

  const returns = trades.map((t) => t.pnlPct / 100);
  const avgReturn =
    returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;
  const stdDev =
    returns.length > 1
      ? Math.sqrt(
          returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
            returns.length
        )
      : 0;
  const downReturns = returns.filter((r) => r < 0);
  const downStdDev =
    downReturns.length > 1
      ? Math.sqrt(
          downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) /
            downReturns.length
        )
      : 1;

  const sharpeRatio = stdDev !== 0 ? (avgReturn * Math.sqrt(252)) / stdDev : 0;
  const sortinoRatio =
    downStdDev !== 0 ? (avgReturn * Math.sqrt(252)) / downStdDev : 0;
  const years = 2.95;
  const cagr =
    years > 0
      ? (Math.pow(equity / config.initialCapital, 1 / years) - 1) * 100
      : 0;
  const calmarRatio = maxDrawdown > 0 ? cagr / maxDrawdown : 0;

  return {
    totalTrades: trades.length,
    winRate:
      trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    totalReturn:
      ((equity - config.initialCapital) / config.initialCapital) * 100,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    maxDrawdown,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : 0,
    avgHoldingDays:
      trades.length > 0
        ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length
        : 0,
    finalEquity: equity,
    cagr,
  };
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchAlpacaBars(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<AlpacaBar[]> {
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
// MAIN OPTIMIZER
// ============================================================================

async function main() {
  console.log("=".repeat(100));
  console.log("OMAR MOMENTUM OPTIMIZER - FAST VERSION");
  console.log("=".repeat(100));

  // Fetch data
  console.log("\nFetching data...");
  const startDate = "2022-01-01";
  const endDate = "2025-12-20";
  const rawData = new Map<string, AlpacaBar[]>();

  for (const symbol of MOMENTUM_UNIVERSE) {
    try {
      const bars = await fetchAlpacaBars(symbol, startDate, endDate);
      if (bars.length > 200) {
        rawData.set(symbol, bars);
        console.log(`${symbol}: ${bars.length} bars`);
      }
    } catch (error) {
      console.log(`${symbol}: ERROR`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nPre-calculating indicators for ${rawData.size} symbols...`);
  const cachedData = new Map<string, CachedIndicators>();
  const allDates = new Set<string>();

  for (const [symbol, bars] of rawData) {
    cachedData.set(symbol, precalculateIndicators(bars));
    for (const bar of bars) allDates.add(bar.t.split("T")[0]);
  }

  const sortedDates = Array.from(allDates).sort();
  console.log(`Total trading days: ${sortedDates.length}`);

  // Parameter grid (optimized for 1000+ combinations)
  const momentumLookbacks = [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29]; // 13 values
  const momentumWeights = [0.2, 0.22, 0.24, 0.26, 0.28, 0.3, 0.32, 0.34]; // 8 values
  const rsiPeriods = [7, 8, 9, 10, 11, 12]; // 6 values
  const atrStops = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5]; // 6 values
  const atrTargets = [4.0, 4.5, 5.0, 5.5, 6.0]; // 5 values

  // Fixed parameters for speed
  const buyThreshold = 0.12;
  const confidenceMin = 0.25;

  const totalIterations =
    momentumLookbacks.length *
    momentumWeights.length *
    rsiPeriods.length *
    atrStops.length *
    atrTargets.length;
  console.log(`\nTotal iterations: ${totalIterations}`);
  console.log("Starting optimization...\n");

  const results: OptimizationResult[] = [];
  let iteration = 0;
  const startTime = Date.now();

  for (const momentumLookback of momentumLookbacks) {
    for (const momentumWeight of momentumWeights) {
      for (const rsiPeriod of rsiPeriods) {
        for (const atrStop of atrStops) {
          for (const atrTarget of atrTargets) {
            iteration++;

            const remainingWeight = 1.0 - momentumWeight;
            const config: MomentumConfig = {
              momentumLookback,
              momentumWeight,
              rsiPeriod,
              atrMultStop: atrStop,
              atrMultTarget: atrTarget,
              buyThreshold,
              confidenceMin,
              initialCapital: 100000,
              maxPositionPct: 0.08,
              maxPositions: 12,
              maxDailyLoss: 0.05,
              technicalWeight: remainingWeight * 0.3,
              volatilityWeight: remainingWeight * 0.15,
              volumeWeight: remainingWeight * 0.3,
              sentimentWeight: remainingWeight * 0.25,
            };

            const metrics = runMomentumBacktest(
              cachedData,
              sortedDates,
              config
            );

            const score =
              metrics.sharpeRatio * 30 +
              metrics.sortinoRatio * 25 +
              metrics.calmarRatio * 20 +
              metrics.winRate * 0.15 +
              metrics.totalReturn * 0.1;

            results.push({ config, metrics, score });

            if (iteration % 100 === 0 || iteration === totalIterations) {
              const elapsed = (Date.now() - startTime) / 1000;
              const rate = iteration / elapsed;
              const eta = (totalIterations - iteration) / rate;

              console.log(
                `[${iteration}/${totalIterations}] ` +
                  `MomLB=${momentumLookback} MomW=${momentumWeight.toFixed(2)} RSI=${rsiPeriod} ` +
                  `Stop=${atrStop.toFixed(1)} Tgt=${atrTarget.toFixed(1)} | ` +
                  `Sharpe=${metrics.sharpeRatio.toFixed(2)} Win=${metrics.winRate.toFixed(1)}% ` +
                  `Ret=${metrics.totalReturn.toFixed(1)}% | ETA=${Math.floor(eta)}s`
              );
            }
          }
        }
      }
    }
  }

  // Sort and display results
  results.sort((a, b) => b.score - a.score);

  console.log("\n" + "=".repeat(100));
  console.log("OPTIMIZATION COMPLETE");
  console.log("=".repeat(100));

  console.log("\nTOP 20 CONFIGURATIONS:\n");
  for (let i = 0; i < Math.min(20, results.length); i++) {
    const r = results[i];
    console.log(`\n--- RANK ${i + 1} (Score: ${r.score.toFixed(2)}) ---`);
    console.log(
      `Parameters: MomLB=${r.config.momentumLookback} MomW=${r.config.momentumWeight.toFixed(2)} RSI=${r.config.rsiPeriod} Stop=${r.config.atrMultStop.toFixed(1)}x Target=${r.config.atrMultTarget.toFixed(1)}x`
    );
    console.log(
      `Metrics: Trades=${r.metrics.totalTrades} Win=${r.metrics.winRate.toFixed(1)}% Ret=${r.metrics.totalReturn.toFixed(1)}% Sharpe=${r.metrics.sharpeRatio.toFixed(2)} Sortino=${r.metrics.sortinoRatio.toFixed(2)} Calmar=${r.metrics.calmarRatio.toFixed(2)} MaxDD=${r.metrics.maxDrawdown.toFixed(1)}%`
    );
  }

  const best = results[0];
  console.log("\n" + "=".repeat(100));
  console.log("BEST MOMENTUM CONFIGURATION");
  console.log("=".repeat(100));
  console.log(`\nMomentum Lookback: ${best.config.momentumLookback} days`);
  console.log(`Momentum Weight: ${best.config.momentumWeight.toFixed(3)}`);
  console.log(`RSI Period: ${best.config.rsiPeriod}`);
  console.log(`ATR Stop: ${best.config.atrMultStop.toFixed(2)}x`);
  console.log(`ATR Target: ${best.config.atrMultTarget.toFixed(2)}x`);
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
  console.log(`  Final Equity: $${best.metrics.finalEquity.toFixed(0)}`);
  console.log("\n" + "=".repeat(100));

  // Statistics
  console.log("\nSTATISTICS:");
  console.log(
    `Positive return configs: ${results.filter((r) => r.metrics.totalReturn > 0).length}`
  );
  console.log(
    `Sharpe > 1.0: ${results.filter((r) => r.metrics.sharpeRatio > 1.0).length}`
  );
  console.log(
    `Win rate > 55%: ${results.filter((r) => r.metrics.winRate > 55).length}`
  );

  const bestSharpe = results.reduce((a, b) =>
    a.metrics.sharpeRatio > b.metrics.sharpeRatio ? a : b
  );
  console.log(
    `\nBest Sharpe: ${bestSharpe.metrics.sharpeRatio.toFixed(3)} (MomLB=${bestSharpe.config.momentumLookback}, MomW=${bestSharpe.config.momentumWeight.toFixed(2)})`
  );
}

main().catch(console.error);
