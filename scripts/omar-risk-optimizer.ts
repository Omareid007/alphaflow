#!/usr/bin/env npx tsx
/**
 * OMAR RISK MANAGEMENT OPTIMIZER
 *
 * Specialized optimizer focused on risk management parameters:
 * - Position sizing (2-15% per position)
 * - Max portfolio exposure (40-95%)
 * - Max positions (5-40)
 * - ATR stop multipliers (0.5-3.0)
 * - ATR target multipliers (1.5-8.0)
 * - Max daily loss limits (2-10%)
 *
 * PRIMARY OBJECTIVES:
 * - Minimize drawdown
 * - Maximize Calmar ratio (return / max drawdown)
 * - Optimize Sharpe and Sortino ratios
 * - Maintain acceptable win rate
 *
 * Runs 1000+ iterations using grid search + random sampling
 */

// ============= CONFIGURATION =============
const ALPACA_KEY = process.env.ALPACA_API_KEY || '';
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || '';
const ALPACA_DATA_URL = 'https://data.alpaca.markets';

// Risk-focused parameter ranges
const RISK_PARAM_RANGES = {
  maxPositionPct: { min: 0.02, max: 0.15, step: 0.01 },
  maxPortfolioExposure: { min: 0.40, max: 0.95, step: 0.05 },
  maxPositions: { min: 5, max: 40, step: 5 },
  atrMultStop: { min: 0.5, max: 3.0, step: 0.1 },
  atrMultTarget: { min: 1.5, max: 8.0, step: 0.25 },
  maxDailyLoss: { min: 0.02, max: 0.10, step: 0.01 },
};

// Fixed strategy parameters (use proven values from full-power backtest)
const FIXED_STRATEGY_PARAMS = {
  buyThreshold: 0.12,
  confidenceMin: 0.28,
  technicalWeight: 0.20,
  momentumWeight: 0.20,
  volatilityWeight: 0.08,
  volumeWeight: 0.12,
  sentimentWeight: 0.12,
  patternWeight: 0.10,
  breadthWeight: 0.08,
  correlationWeight: 0.10,
};

const TARGET_ITERATIONS = 1200;
const SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE', 'NOW', 'PLTR',
  'JPM', 'BAC', 'GS', 'MS', 'V', 'MA', 'AXP',
  'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'LLY',
  'WMT', 'COST', 'HD', 'NKE', 'MCD', 'SBUX',
  'CAT', 'DE', 'BA', 'HON', 'UPS', 'RTX',
  'XOM', 'CVX', 'COP', 'SLB',
  'SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLK', 'XLE',
];

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface RiskConfig {
  maxPositionPct: number;
  maxPortfolioExposure: number;
  maxPositions: number;
  atrMultStop: number;
  atrMultTarget: number;
  maxDailyLoss: number;
}

interface BacktestMetrics {
  totalReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  avgHoldDays: number;
  profitFactor: number;
  equity: number[];
  dailyReturns: number[];
}

interface OptimizationResult {
  config: RiskConfig;
  metrics: BacktestMetrics;
  score: number;
  rank: number;
}

// ============= DATA FETCHING =============

async function fetchAlpacaBars(symbol: string, start: string, end: string): Promise<AlpacaBar[]> {
  const allBars: AlpacaBar[] = [];
  let pageToken: string | null = null;

  do {
    let url = `${ALPACA_DATA_URL}/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=10000&feed=iex`;
    if (pageToken) url += `&page_token=${pageToken}`;

    const response = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': ALPACA_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET,
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.bars && Array.isArray(data.bars)) allBars.push(...data.bars);
    pageToken = data.next_page_token || null;
  } while (pageToken);

  return allBars;
}

// ============= TECHNICAL INDICATORS =============

function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) result.push(NaN);
    else result.push(data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  for (let i = 0; i < data.length; i++) {
    if (i === 0) result.push(data[0]);
    else result.push((data[i] - result[i - 1]) * k + result[i - 1]);
  }
  return result;
}

function calculateRSI(closes: number[], period: number = 14): number[] {
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  const avgGain = calculateEMA(gains, period);
  const avgLoss = calculateEMA(losses, period);

  const rsi: number[] = [NaN];
  for (let i = 0; i < avgGain.length; i++) {
    if (avgLoss[i] === 0) rsi.push(100);
    else rsi.push(100 - (100 / (1 + avgGain[i] / avgLoss[i])));
  }
  return rsi;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  return calculateEMA(tr, period);
}

function calculateMACD(closes: number[]): { histogram: number[] } {
  const emaFast = calculateEMA(closes, 12);
  const emaSlow = calculateEMA(closes, 26);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = calculateEMA(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { histogram };
}

// ============= SIGNAL GENERATION =============

function generateSignal(bars: AlpacaBar[]): { score: number; confidence: number } {
  if (bars.length < 50) return { score: 0, confidence: 0 };

  const closes = bars.map(b => b.c);
  const highs = bars.map(b => b.h);
  const lows = bars.map(b => b.l);
  const volumes = bars.map(b => b.v);

  const rsi = calculateRSI(closes);
  const currentRSI = rsi[rsi.length - 1];
  const macd = calculateMACD(closes);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const current = closes[closes.length - 1];

  let score = 0;
  let factors = 0;

  // Technical
  if (!isNaN(currentRSI)) {
    if (currentRSI < 30) score += 0.4;
    else if (currentRSI > 70) score -= 0.4;
    else score += (50 - currentRSI) / 200;
    factors++;
  }

  // MACD
  const macdCurrent = macd.histogram[macd.histogram.length - 1];
  if (!isNaN(macdCurrent)) {
    if (macdCurrent > 0) score += 0.3;
    else score -= 0.3;
    factors++;
  }

  // Trend
  if (!isNaN(sma20[sma20.length - 1]) && !isNaN(sma50[sma50.length - 1])) {
    if (current > sma20[sma20.length - 1]) score += 0.2;
    if (current > sma50[sma50.length - 1]) score += 0.2;
    factors++;
  }

  // Momentum
  if (closes.length >= 10) {
    const momentum = (closes[closes.length - 1] - closes[closes.length - 10]) / closes[closes.length - 10];
    score += momentum * 2;
    factors++;
  }

  // Volume
  if (volumes.length >= 20) {
    const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    if (volumes[volumes.length - 1] > avgVol * 1.5) score += 0.15;
    factors++;
  }

  score = score / (factors || 1);
  const confidence = Math.min(1, Math.abs(score) * 1.5);

  return { score, confidence };
}

// ============= BACKTEST ENGINE =============

async function runBacktest(
  config: RiskConfig,
  bars: Map<string, AlpacaBar[]>,
  startDate: Date,
  endDate: Date
): Promise<BacktestMetrics> {
  const initialCapital = 100000;
  let capital = initialCapital;
  let peakCapital = capital;

  const trades: { pnl: number; pnlPct: number; holdDays: number }[] = [];
  const equity: number[] = [capital];
  const dailyReturns: number[] = [];
  const positions = new Map<string, { entry: number; shares: number; entryDate: string; stopLoss: number; takeProfit: number }>();

  // Get trading days
  const tradingDays: string[] = [];
  const firstBars = bars.values().next().value;
  if (firstBars) {
    for (const bar of firstBars) {
      const date = new Date(bar.t);
      if (date >= startDate && date <= endDate) tradingDays.push(bar.t);
    }
  }

  let dailyStartCapital = capital;
  let dailyPnl = 0;

  for (let dayIdx = 50; dayIdx < tradingDays.length; dayIdx++) {
    const currentDate = tradingDays[dayIdx];

    // Reset daily P&L tracking
    if (dayIdx > 50 && tradingDays[dayIdx].split('T')[0] !== tradingDays[dayIdx - 1].split('T')[0]) {
      dailyStartCapital = capital;
      dailyPnl = 0;
    }

    // Check exits
    for (const [symbol, pos] of Array.from(positions)) {
      const symbolBars = bars.get(symbol);
      if (!symbolBars) continue;

      const currentBar = symbolBars.find(b => b.t === currentDate);
      if (!currentBar) continue;

      const high = currentBar.h;
      const low = currentBar.l;
      let exitPrice: number | null = null;

      if (low <= pos.stopLoss) exitPrice = pos.stopLoss;
      else if (high >= pos.takeProfit) exitPrice = pos.takeProfit;

      if (exitPrice) {
        const pnl = (exitPrice - pos.entry) * pos.shares;
        const pnlPct = (exitPrice - pos.entry) / pos.entry;
        capital += pos.shares * exitPrice;
        dailyPnl += pnl;

        const holdDays = tradingDays.indexOf(currentDate) - tradingDays.indexOf(pos.entryDate);
        trades.push({ pnl, pnlPct, holdDays });
        positions.delete(symbol);
      }
    }

    // Daily loss limit check
    if (dailyPnl < -dailyStartCapital * config.maxDailyLoss) {
      // Close all positions
      for (const [symbol, pos] of Array.from(positions)) {
        const symbolBars = bars.get(symbol);
        if (!symbolBars) continue;
        const currentBar = symbolBars.find(b => b.t === currentDate);
        if (currentBar) {
          const pnl = (currentBar.c - pos.entry) * pos.shares;
          capital += pos.shares * currentBar.c;
          trades.push({ pnl, pnlPct: pnl / (pos.entry * pos.shares), holdDays: 0 });
        }
      }
      positions.clear();
      dailyPnl = -dailyStartCapital * config.maxDailyLoss;
      continue;
    }

    // Check entries
    const currentExposure = Array.from(positions.values()).reduce((sum, p) => sum + p.shares * p.entry, 0);
    const maxExposure = (capital + currentExposure) * config.maxPortfolioExposure;

    if (positions.size < config.maxPositions && currentExposure < maxExposure) {
      const candidates: { symbol: string; score: number; price: number; atr: number }[] = [];

      for (const [symbol, symbolBars] of bars) {
        if (positions.has(symbol)) continue;

        const barsToDate = symbolBars.filter(b => b.t <= currentDate).slice(-60);
        if (barsToDate.length < 50) continue;

        const signal = generateSignal(barsToDate);
        if (signal.score >= FIXED_STRATEGY_PARAMS.buyThreshold && signal.confidence >= FIXED_STRATEGY_PARAMS.confidenceMin) {
          const currentBar = barsToDate[barsToDate.length - 1];
          const closes = barsToDate.map(b => b.c);
          const highs = barsToDate.map(b => b.h);
          const lows = barsToDate.map(b => b.l);
          const atr = calculateATR(highs, lows, closes);
          candidates.push({ symbol, score: signal.score, price: currentBar.c, atr: atr[atr.length - 1] });
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      for (const candidate of candidates.slice(0, config.maxPositions - positions.size)) {
        const maxPositionSize = capital * config.maxPositionPct;
        const shares = Math.floor(maxPositionSize / candidate.price);

        if (shares > 0 && shares * candidate.price <= capital) {
          const positionValue = shares * candidate.price;
          if (currentExposure + positionValue <= maxExposure) {
            const stopLoss = candidate.price - candidate.atr * config.atrMultStop;
            const takeProfit = candidate.price + candidate.atr * config.atrMultTarget;
            positions.set(candidate.symbol, {
              entry: candidate.price,
              shares,
              entryDate: currentDate,
              stopLoss,
              takeProfit,
            });
            capital -= shares * candidate.price;
          }
        }
      }
    }

    // Update equity
    let currentEquity = capital;
    for (const [symbol, pos] of positions) {
      const symbolBars = bars.get(symbol);
      if (symbolBars) {
        const currentBar = symbolBars.find(b => b.t === currentDate);
        if (currentBar) currentEquity += pos.shares * currentBar.c;
      }
    }

    equity.push(currentEquity);
    peakCapital = Math.max(peakCapital, currentEquity);

    if (equity.length > 1) {
      dailyReturns.push((currentEquity - equity[equity.length - 2]) / equity[equity.length - 2]);
    }
  }

  // Close remaining positions
  for (const [symbol, pos] of positions) {
    const symbolBars = bars.get(symbol);
    if (symbolBars && symbolBars.length > 0) {
      const lastBar = symbolBars[symbolBars.length - 1];
      const pnl = (lastBar.c - pos.entry) * pos.shares;
      trades.push({ pnl, pnlPct: pnl / (pos.entry * pos.shares), holdDays: tradingDays.length - tradingDays.indexOf(pos.entryDate) });
    }
  }

  // Calculate metrics
  const totalReturn = (equity[equity.length - 1] - initialCapital) / initialCapital;
  const maxDrawdown = equity.reduce((maxDD, val, i) => {
    const peak = Math.max(...equity.slice(0, i + 1));
    return Math.max(maxDD, (peak - val) / peak);
  }, 0);

  const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const stdReturn = dailyReturns.length > 1 ? Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length) : 0;
  const sharpe = stdReturn > 0 ? (avgReturn * 252) / (stdReturn * Math.sqrt(252)) : 0;

  const negativeReturns = dailyReturns.filter(r => r < 0);
  const downStd = negativeReturns.length > 1 ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + r * r, 0) / negativeReturns.length) : 0.0001;
  const sortino = downStd > 0 ? (avgReturn * 252) / (downStd * Math.sqrt(252)) : 0;

  const years = tradingDays.length / 252;
  const cagr = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : 0;

  const winRate = trades.length > 0 ? trades.filter(t => t.pnl > 0).length / trades.length : 0;
  const avgHoldDays = trades.length > 0 ? trades.reduce((sum, t) => sum + t.holdDays, 0) / trades.length : 0;

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

  return {
    totalReturn,
    sharpe,
    sortino,
    calmar,
    maxDrawdown,
    winRate,
    totalTrades: trades.length,
    avgHoldDays,
    profitFactor,
    equity,
    dailyReturns,
  };
}

// ============= OPTIMIZATION ENGINE =============

function generateRiskConfigs(numConfigs: number): RiskConfig[] {
  const configs: RiskConfig[] = [];

  // Grid search on key parameters (70% of configs)
  const gridCount = Math.floor(numConfigs * 0.7);
  const positionSizes = [0.02, 0.03, 0.04, 0.05, 0.07, 0.10, 0.12, 0.15];
  const exposures = [0.40, 0.50, 0.60, 0.70, 0.80, 0.90];
  const positions = [5, 10, 15, 20, 25, 30, 35, 40];
  const stops = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
  const targets = [1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0];
  const dailyLosses = [0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.10];

  for (let i = 0; i < gridCount; i++) {
    configs.push({
      maxPositionPct: positionSizes[i % positionSizes.length],
      maxPortfolioExposure: exposures[Math.floor(i / positionSizes.length) % exposures.length],
      maxPositions: positions[Math.floor(i / (positionSizes.length * exposures.length)) % positions.length],
      atrMultStop: stops[Math.floor(i / (positionSizes.length * exposures.length * positions.length)) % stops.length],
      atrMultTarget: targets[Math.floor(i / (positionSizes.length * exposures.length * positions.length * stops.length)) % targets.length],
      maxDailyLoss: dailyLosses[Math.floor(i / (positionSizes.length * exposures.length * positions.length * stops.length * targets.length)) % dailyLosses.length],
    });
  }

  // Random sampling for exploration (30% of configs)
  const randomCount = numConfigs - gridCount;
  for (let i = 0; i < randomCount; i++) {
    configs.push({
      maxPositionPct: 0.02 + Math.random() * 0.13,
      maxPortfolioExposure: 0.40 + Math.random() * 0.55,
      maxPositions: 5 + Math.floor(Math.random() * 36),
      atrMultStop: 0.5 + Math.random() * 2.5,
      atrMultTarget: 1.5 + Math.random() * 6.5,
      maxDailyLoss: 0.02 + Math.random() * 0.08,
    });
  }

  return configs;
}

function calculateScore(metrics: BacktestMetrics): number {
  // Heavy emphasis on low drawdown and high Calmar
  if (metrics.totalTrades < 30) return -1000;
  if (metrics.maxDrawdown > 0.35) return -500;

  const drawdownPenalty = metrics.maxDrawdown * 100;
  const calmarBonus = metrics.calmar * 150;
  const sharpeBonus = metrics.sharpe * 80;
  const sortinoBonus = metrics.sortino * 60;
  const returnBonus = metrics.totalReturn * 50;
  const winRateBonus = metrics.winRate * 40;
  const profitFactorBonus = Math.min(metrics.profitFactor * 20, 100);

  return calmarBonus + sharpeBonus + sortinoBonus + returnBonus + winRateBonus + profitFactorBonus - drawdownPenalty;
}

// ============= MAIN =============

async function loadData(): Promise<Map<string, AlpacaBar[]>> {
  const bars = new Map<string, AlpacaBar[]>();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2); // 2 year backtest

  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  console.log(`\nLoading historical data for ${SYMBOLS.length} symbols...`);
  console.log(`Period: ${start} to ${end}`);

  let loaded = 0;
  for (const symbol of SYMBOLS) {
    try {
      const symbolBars = await fetchAlpacaBars(symbol, start, end);
      if (symbolBars.length > 100) {
        bars.set(symbol, symbolBars);
        loaded++;
      }
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      // Skip errors
    }
    process.stdout.write(`\r  Loaded ${loaded}/${SYMBOLS.length} symbols`);
  }

  console.log(`\n  Successfully loaded ${bars.size} symbols\n`);
  return bars;
}

async function runRiskOptimizer() {
  console.log('═'.repeat(80));
  console.log('  OMAR RISK MANAGEMENT OPTIMIZER');
  console.log('═'.repeat(80));
  console.log('\n  Focus: LOW DRAWDOWN | HIGH CALMAR RATIO');
  console.log(`  Target Iterations: ${TARGET_ITERATIONS}\n`);

  const bars = await loadData();
  if (bars.size < 10) {
    console.error('  ERROR: Insufficient data. Aborting.');
    return;
  }

  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);
  const endDate = new Date();

  console.log('  Generating risk configurations...');
  const configs = generateRiskConfigs(TARGET_ITERATIONS);
  console.log(`  Generated ${configs.length} configurations\n`);

  console.log('─'.repeat(80));
  console.log('  STARTING OPTIMIZATION');
  console.log('─'.repeat(80));

  const results: OptimizationResult[] = [];
  let bestScore = -Infinity;
  let bestConfig: RiskConfig | null = null;
  let bestMetrics: BacktestMetrics | null = null;

  const startTime = Date.now();

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];

    try {
      const metrics = await runBacktest(config, bars, startDate, endDate);
      const score = calculateScore(metrics);

      results.push({ config, metrics, score, rank: 0 });

      if (score > bestScore) {
        bestScore = score;
        bestConfig = config;
        bestMetrics = metrics;

        console.log(`\n  🏆 NEW BEST (Iteration ${i + 1}/${configs.length})`);
        console.log(`     Score: ${score.toFixed(2)}`);
        console.log(`     Calmar: ${metrics.calmar.toFixed(3)} | Sharpe: ${metrics.sharpe.toFixed(3)} | Sortino: ${metrics.sortino.toFixed(3)}`);
        console.log(`     Return: ${(metrics.totalReturn * 100).toFixed(2)}% | MaxDD: ${(metrics.maxDrawdown * 100).toFixed(2)}%`);
        console.log(`     Win Rate: ${(metrics.winRate * 100).toFixed(1)}% | Trades: ${metrics.totalTrades}`);
      }

      if ((i + 1) % 50 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = (i + 1) / elapsed;
        const remaining = (configs.length - i - 1) / rate;
        console.log(`\n  Progress: ${i + 1}/${configs.length} (${((i + 1) / configs.length * 100).toFixed(1)}%)`);
        console.log(`  ETA: ${Math.round(remaining)}s | Best Score: ${bestScore.toFixed(2)}`);
      }
    } catch (err) {
      // Skip failed backtests
    }
  }

  // Rank results
  results.sort((a, b) => b.score - a.score);
  results.forEach((r, idx) => r.rank = idx + 1);

  console.log('\n' + '═'.repeat(80));
  console.log('  OPTIMIZATION COMPLETE');
  console.log('═'.repeat(80));

  if (bestConfig && bestMetrics) {
    console.log(`\n  🏆 OPTIMAL RISK CONFIGURATION FOUND:`);
    console.log(`  ${'─'.repeat(40)}`);
    console.log(`\n  RISK METRICS:`);
    console.log(`  ├─ Max Drawdown: ${(bestMetrics.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`  ├─ Calmar Ratio: ${bestMetrics.calmar.toFixed(3)}`);
    console.log(`  ├─ Sharpe Ratio: ${bestMetrics.sharpe.toFixed(3)}`);
    console.log(`  ├─ Sortino Ratio: ${bestMetrics.sortino.toFixed(3)}`);
    console.log(`  ├─ Win Rate: ${(bestMetrics.winRate * 100).toFixed(1)}%`);
    console.log(`  └─ Profit Factor: ${bestMetrics.profitFactor.toFixed(2)}`);

    console.log(`\n  PERFORMANCE METRICS:`);
    console.log(`  ├─ Total Return: ${(bestMetrics.totalReturn * 100).toFixed(2)}%`);
    console.log(`  ├─ Total Trades: ${bestMetrics.totalTrades}`);
    console.log(`  └─ Avg Hold Days: ${bestMetrics.avgHoldDays.toFixed(1)}`);

    console.log(`\n  OPTIMAL RISK PARAMETERS:`);
    console.log(`  ├─ Position Size: ${(bestConfig.maxPositionPct * 100).toFixed(1)}% per position`);
    console.log(`  ├─ Portfolio Exposure: ${(bestConfig.maxPortfolioExposure * 100).toFixed(0)}% max`);
    console.log(`  ├─ Max Positions: ${bestConfig.maxPositions}`);
    console.log(`  ├─ ATR Stop: ${bestConfig.atrMultStop.toFixed(2)}x`);
    console.log(`  ├─ ATR Target: ${bestConfig.atrMultTarget.toFixed(2)}x`);
    console.log(`  └─ Daily Loss Limit: ${(bestConfig.maxDailyLoss * 100).toFixed(1)}%`);

    console.log(`\n  CODE-READY CONFIGURATION:`);
    console.log(`  ${'─'.repeat(40)}`);
    console.log(`  const optimalRiskConfig = {`);
    console.log(`    maxPositionPct: ${bestConfig.maxPositionPct.toFixed(3)},`);
    console.log(`    maxPortfolioExposure: ${bestConfig.maxPortfolioExposure.toFixed(2)},`);
    console.log(`    maxPositions: ${bestConfig.maxPositions},`);
    console.log(`    atrMultStop: ${bestConfig.atrMultStop.toFixed(2)},`);
    console.log(`    atrMultTarget: ${bestConfig.atrMultTarget.toFixed(2)},`);
    console.log(`    maxDailyLoss: ${bestConfig.maxDailyLoss.toFixed(3)},`);
    console.log(`  };`);

    console.log(`\n  TOP 10 CONFIGURATIONS BY SCORE:`);
    console.log(`  ${'─'.repeat(40)}`);
    for (let i = 0; i < Math.min(10, results.length); i++) {
      const r = results[i];
      console.log(`\n  #${i + 1} - Score: ${r.score.toFixed(2)}`);
      console.log(`     Calmar: ${r.metrics.calmar.toFixed(2)} | DD: ${(r.metrics.maxDrawdown * 100).toFixed(1)}% | Sharpe: ${r.metrics.sharpe.toFixed(2)}`);
      console.log(`     Pos: ${(r.config.maxPositionPct * 100).toFixed(1)}% | MaxPos: ${r.config.maxPositions} | Stop: ${r.config.atrMultStop.toFixed(1)}x | Target: ${r.config.atrMultTarget.toFixed(1)}x`);
    }

    console.log(`\n  ANALYSIS BY PARAMETER:`);
    console.log(`  ${'─'.repeat(40)}`);

    const top20 = results.slice(0, 20);
    console.log(`\n  Top 20 Average Position Size: ${(top20.reduce((s, r) => s + r.config.maxPositionPct, 0) / 20 * 100).toFixed(1)}%`);
    console.log(`  Top 20 Average Exposure: ${(top20.reduce((s, r) => s + r.config.maxPortfolioExposure, 0) / 20 * 100).toFixed(0)}%`);
    console.log(`  Top 20 Average Max Positions: ${Math.round(top20.reduce((s, r) => s + r.config.maxPositions, 0) / 20)}`);
    console.log(`  Top 20 Average ATR Stop: ${(top20.reduce((s, r) => s + r.config.atrMultStop, 0) / 20).toFixed(2)}x`);
    console.log(`  Top 20 Average ATR Target: ${(top20.reduce((s, r) => s + r.config.atrMultTarget, 0) / 20).toFixed(2)}x`);
    console.log(`  Top 20 Average Daily Loss: ${(top20.reduce((s, r) => s + r.config.maxDailyLoss, 0) / 20 * 100).toFixed(1)}%`);
    console.log(`  Top 20 Average Max Drawdown: ${(top20.reduce((s, r) => s + r.metrics.maxDrawdown, 0) / 20 * 100).toFixed(2)}%`);
    console.log(`  Top 20 Average Calmar: ${(top20.reduce((s, r) => s + r.metrics.calmar, 0) / 20).toFixed(2)}`);
  }

  console.log(`\n${'═'.repeat(80)}\n`);

  return { bestConfig, bestMetrics, allResults: results };
}

runRiskOptimizer().catch(console.error);
