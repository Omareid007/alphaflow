#!/usr/bin/env npx tsx
/**
 * OMAR SECTOR ROTATION OPTIMIZER
 *
 * Specialized optimization for sector-based trading strategies
 *
 * Focus Areas:
 * 1. Sector ETFs: XLF, XLK, XLE, XLV, XLI, XLP, XLY, XLB, XLU, XLRE
 * 2. Sector rotation timing (weekly, bi-weekly, monthly)
 * 3. Relative strength between sectors
 * 4. Sector momentum correlation
 * 5. Market regime adaptation
 *
 * Tests:
 * - Sector-only portfolios vs mixed portfolios
 * - Top N sectors by momentum
 * - Different rotation frequencies
 * - Regime-based sector selection
 */

// ============= CONFIGURATION =============
const ALPACA_KEY = process.env.ALPACA_API_KEY || "";
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || "";
const ALPACA_DATA_URL = "https://data.alpaca.markets";

// Sector ETFs (SPDR Select Sector Funds)
const SECTOR_ETFS = [
  { symbol: "XLF", name: "Financials" },
  { symbol: "XLK", name: "Technology" },
  { symbol: "XLE", name: "Energy" },
  { symbol: "XLV", name: "Healthcare" },
  { symbol: "XLI", name: "Industrials" },
  { symbol: "XLP", name: "Consumer Staples" },
  { symbol: "XLY", name: "Consumer Discretionary" },
  { symbol: "XLB", name: "Materials" },
  { symbol: "XLU", name: "Utilities" },
  { symbol: "XLRE", name: "Real Estate" },
];

// Market benchmarks
const BENCHMARKS = ["SPY", "QQQ", "IWM"];

// Top stocks by sector for mixed portfolio testing
const SECTOR_STOCKS = {
  XLF: ["JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "AXP"],
  XLK: [
    "AAPL",
    "MSFT",
    "NVDA",
    "GOOGL",
    "META",
    "AVGO",
    "ORCL",
    "AMD",
    "CRM",
    "INTC",
  ],
  XLE: ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO"],
  XLV: ["UNH", "JNJ", "LLY", "ABBV", "MRK", "TMO", "ABT", "PFE", "DHR", "AMGN"],
  XLI: ["CAT", "RTX", "HON", "UPS", "BA", "DE", "GE", "LMT", "MMM", "FDX"],
  XLP: ["PG", "KO", "PEP", "WMT", "COST", "PM", "MO", "MDLZ", "CL", "KMB"],
  XLY: ["AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "TGT", "LOW", "TJX", "F"],
  XLB: ["LIN", "APD", "SHW", "ECL", "NEM", "FCX", "DD", "DOW", "NUE"],
  XLU: ["NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "XEL"],
  XLRE: ["AMT", "PLD", "CCI", "EQIX", "PSA", "WELL", "DLR", "O", "VICI"],
};

// Optimization configurations to test
const OPTIMIZATION_CONFIGS = [
  // Pure sector ETF strategies
  {
    name: "Pure_Sector_Top3_Weekly",
    type: "pure_sector",
    topN: 3,
    rotationDays: 5,
  },
  {
    name: "Pure_Sector_Top3_BiWeekly",
    type: "pure_sector",
    topN: 3,
    rotationDays: 10,
  },
  {
    name: "Pure_Sector_Top3_Monthly",
    type: "pure_sector",
    topN: 3,
    rotationDays: 21,
  },
  {
    name: "Pure_Sector_Top5_Weekly",
    type: "pure_sector",
    topN: 5,
    rotationDays: 5,
  },
  {
    name: "Pure_Sector_Top5_BiWeekly",
    type: "pure_sector",
    topN: 5,
    rotationDays: 10,
  },
  {
    name: "Pure_Sector_Top5_Monthly",
    type: "pure_sector",
    topN: 5,
    rotationDays: 21,
  },

  // Mixed strategies (sector ETFs + stocks)
  {
    name: "Mixed_Top2Sectors_Weekly",
    type: "mixed",
    topN: 2,
    rotationDays: 5,
    stocksPerSector: 3,
  },
  {
    name: "Mixed_Top2Sectors_BiWeekly",
    type: "mixed",
    topN: 2,
    rotationDays: 10,
    stocksPerSector: 3,
  },
  {
    name: "Mixed_Top3Sectors_Weekly",
    type: "mixed",
    topN: 3,
    rotationDays: 5,
    stocksPerSector: 2,
  },
  {
    name: "Mixed_Top3Sectors_BiWeekly",
    type: "mixed",
    topN: 3,
    rotationDays: 10,
    stocksPerSector: 2,
  },

  // Momentum-based strategies
  {
    name: "Momentum_Top3_5Day",
    type: "momentum",
    topN: 3,
    rotationDays: 5,
    lookback: 20,
  },
  {
    name: "Momentum_Top3_10Day",
    type: "momentum",
    topN: 3,
    rotationDays: 10,
    lookback: 20,
  },
  {
    name: "Momentum_Top5_5Day",
    type: "momentum",
    topN: 5,
    rotationDays: 5,
    lookback: 20,
  },
  {
    name: "Momentum_Top3_LongLookback",
    type: "momentum",
    topN: 3,
    rotationDays: 10,
    lookback: 60,
  },

  // Relative strength strategies
  {
    name: "RelativeStrength_Top3_Weekly",
    type: "relative_strength",
    topN: 3,
    rotationDays: 5,
    benchmarkIndex: "SPY",
  },
  {
    name: "RelativeStrength_Top3_BiWeekly",
    type: "relative_strength",
    topN: 3,
    rotationDays: 10,
    benchmarkIndex: "SPY",
  },
  {
    name: "RelativeStrength_Top5_Weekly",
    type: "relative_strength",
    topN: 5,
    rotationDays: 5,
    benchmarkIndex: "SPY",
  },

  // Regime-based strategies
  {
    name: "Regime_Defensive_Monthly",
    type: "regime",
    rotationDays: 21,
    regimeType: "defensive",
  },
  {
    name: "Regime_Cyclical_Monthly",
    type: "regime",
    rotationDays: 21,
    regimeType: "cyclical",
  },
  {
    name: "Regime_Adaptive_BiWeekly",
    type: "regime",
    rotationDays: 10,
    regimeType: "adaptive",
  },
];

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface SectorScore {
  symbol: string;
  name: string;
  score: number;
  momentum: number;
  relativeStrength: number;
  volatility: number;
  trend: number;
}

interface BacktestResult {
  configName: string;
  totalReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  winRate: number;
  trades: number;
  avgHoldingDays: number;
  annualizedReturn: number;
  volatility: number;
  details: {
    sectorExposure: Record<string, number>;
    bestSector: string;
    worstSector: string;
    rotationCount: number;
  };
}

// ============= DATA FETCHER =============

async function fetchAlpacaBars(
  symbol: string,
  start: string,
  end: string
): Promise<AlpacaBar[]> {
  const allBars: AlpacaBar[] = [];
  let pageToken: string | null = null;

  do {
    let url = `${ALPACA_DATA_URL}/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=10000&feed=iex`;
    if (pageToken) url += `&page_token=${pageToken}`;

    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch ${symbol}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (data.bars && Array.isArray(data.bars)) {
      allBars.push(...data.bars);
    }
    pageToken = data.next_page_token || null;
  } while (pageToken);

  return allBars;
}

// ============= TECHNICAL INDICATORS =============

function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) result.push(NaN);
    else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < data.length; i++) {
    if (i === 0) result.push(data[0]);
    else result.push((data[i] - result[i - 1]) * multiplier + result[i - 1]);
  }
  return result;
}

function calculateMomentum(closes: number[], period: number): number {
  if (closes.length < period + 1) return 0;
  return (
    (closes[closes.length - 1] - closes[closes.length - 1 - period]) /
    closes[closes.length - 1 - period]
  );
}

function calculateVolatility(closes: number[], period: number): number {
  if (closes.length < period) return 0;
  const returns = [];
  for (let i = closes.length - period; i < closes.length - 1; i++) {
    returns.push((closes[i + 1] - closes[i]) / closes[i]);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance * 252);
}

function calculateTrend(closes: number[]): number {
  if (closes.length < 50) return 0;
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const current20 = sma20[sma20.length - 1];
  const current50 = sma50[sma50.length - 1];
  if (isNaN(current20) || isNaN(current50)) return 0;
  return current20 > current50 ? 1 : -1;
}

// ============= SECTOR SCORING =============

function scoreSectors(
  bars: Map<string, AlpacaBar[]>,
  benchmarkBars: AlpacaBar[],
  lookback: number = 20
): SectorScore[] {
  const scores: SectorScore[] = [];

  for (const { symbol, name } of SECTOR_ETFS) {
    const sectorBars = bars.get(symbol);
    if (!sectorBars || sectorBars.length < lookback + 10) continue;

    const closes = sectorBars.map((b) => b.c);

    // Momentum score
    const momentum = calculateMomentum(closes, lookback);

    // Relative strength vs benchmark
    let relativeStrength = 0;
    if (benchmarkBars.length >= lookback + 1) {
      const benchmarkCloses = benchmarkBars.map((b) => b.c);
      const benchmarkMomentum = calculateMomentum(benchmarkCloses, lookback);
      relativeStrength = momentum - benchmarkMomentum;
    }

    // Volatility (inverse - lower is better)
    const volatility = calculateVolatility(
      closes,
      Math.min(30, closes.length - 1)
    );

    // Trend strength
    const trend = calculateTrend(closes);

    // Composite score
    const score =
      momentum * 0.4 +
      relativeStrength * 0.3 +
      (1 - volatility) * 0.2 +
      trend * 0.1;

    scores.push({
      symbol,
      name,
      score,
      momentum,
      relativeStrength,
      volatility,
      trend,
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

// ============= REGIME DETECTION =============

function detectMarketRegime(spyBars: AlpacaBar[]): "bull" | "bear" | "neutral" {
  if (spyBars.length < 100) return "neutral";

  const closes = spyBars.map((b) => b.c);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);

  const current = closes[closes.length - 1];
  const sma50Current = sma50[sma50.length - 1];
  const sma200Current = sma200[sma200.length - 1];

  if (isNaN(sma50Current) || isNaN(sma200Current)) return "neutral";

  if (current > sma50Current && sma50Current > sma200Current) return "bull";
  if (current < sma50Current && sma50Current < sma200Current) return "bear";
  return "neutral";
}

function getRegimeBasedSectors(regime: "bull" | "bear" | "neutral"): string[] {
  const defensiveSectors = ["XLU", "XLP", "XLV"]; // Utilities, Staples, Healthcare
  const cyclicalSectors = ["XLK", "XLY", "XLF", "XLI"]; // Tech, Discretionary, Financials, Industrials
  const energyMaterials = ["XLE", "XLB"]; // Energy, Materials

  if (regime === "bull") return [...cyclicalSectors, ...energyMaterials];
  if (regime === "bear") return defensiveSectors;
  return [...defensiveSectors, "XLF", "XLK"]; // Balanced
}

// ============= BACKTEST ENGINE =============

async function runSectorRotationBacktest(
  config: any,
  bars: Map<string, AlpacaBar[]>,
  startDate: Date,
  endDate: Date
): Promise<BacktestResult> {
  const initialCapital = 100000;
  let capital = initialCapital;
  const equity: number[] = [capital];
  const dailyReturns: number[] = [];
  const trades: {
    entry: number;
    exit: number;
    symbol: string;
    days: number;
  }[] = [];
  const sectorExposureCount: Record<string, number> = {};

  // Get SPY for regime detection
  const spyBars = bars.get("SPY") || [];

  // Get trading days
  const allDates: string[] = [];
  const firstBars = bars.get("XLK") || [];
  for (const bar of firstBars) {
    const date = new Date(bar.t);
    if (date >= startDate && date <= endDate) allDates.push(bar.t);
  }

  let positions: Map<
    string,
    { entry: number; shares: number; entryDate: string }
  > = new Map();
  let lastRotationDay = 0;

  for (let dayIdx = 60; dayIdx < allDates.length; dayIdx++) {
    const currentDate = allDates[dayIdx];

    // Check if it's time to rotate
    const daysSinceRotation = dayIdx - lastRotationDay;
    if (daysSinceRotation >= config.rotationDays || positions.size === 0) {
      // Close all positions
      for (const [symbol, pos] of positions) {
        const symbolBars = bars.get(symbol);
        if (symbolBars) {
          const currentBar = symbolBars.find((b) => b.t === currentDate);
          if (currentBar) {
            const exitPrice = currentBar.c;
            const pnl = (exitPrice - pos.entry) * pos.shares;
            capital += pos.shares * exitPrice;
            trades.push({
              entry: pos.entry,
              exit: exitPrice,
              symbol,
              days: dayIdx - allDates.indexOf(pos.entryDate),
            });
          }
        }
      }
      positions.clear();

      // Select new sectors based on strategy
      let selectedSectors: string[] = [];

      if (config.type === "pure_sector" || config.type === "momentum") {
        const barsToDate = new Map<string, AlpacaBar[]>();
        for (const { symbol } of SECTOR_ETFS) {
          const symbolBars = bars.get(symbol);
          if (symbolBars) {
            barsToDate.set(
              symbol,
              symbolBars.filter((b) => b.t <= currentDate)
            );
          }
        }
        const benchmarkBars = spyBars.filter((b) => b.t <= currentDate);
        const scores = scoreSectors(
          barsToDate,
          benchmarkBars,
          config.lookback || 20
        );
        selectedSectors = scores.slice(0, config.topN).map((s) => s.symbol);
      } else if (config.type === "relative_strength") {
        const barsToDate = new Map<string, AlpacaBar[]>();
        for (const { symbol } of SECTOR_ETFS) {
          const symbolBars = bars.get(symbol);
          if (symbolBars) {
            barsToDate.set(
              symbol,
              symbolBars.filter((b) => b.t <= currentDate)
            );
          }
        }
        const benchmarkBars = spyBars.filter((b) => b.t <= currentDate);
        const scores = scoreSectors(barsToDate, benchmarkBars, 20);
        selectedSectors = scores
          .filter((s) => s.relativeStrength > 0)
          .slice(0, config.topN)
          .map((s) => s.symbol);
      } else if (config.type === "regime") {
        const spyToDate = spyBars.filter((b) => b.t <= currentDate);
        const regime = detectMarketRegime(spyToDate);
        const regimeSectors = getRegimeBasedSectors(regime);

        if (config.regimeType === "defensive") {
          selectedSectors = ["XLU", "XLP", "XLV"];
        } else if (config.regimeType === "cyclical") {
          selectedSectors = ["XLK", "XLY", "XLF"];
        } else {
          // Adaptive
          selectedSectors = regimeSectors.slice(0, 3);
        }
      } else if (config.type === "mixed") {
        // Select top sectors, then pick stocks from those sectors
        const barsToDate = new Map<string, AlpacaBar[]>();
        for (const { symbol } of SECTOR_ETFS) {
          const symbolBars = bars.get(symbol);
          if (symbolBars) {
            barsToDate.set(
              symbol,
              symbolBars.filter((b) => b.t <= currentDate)
            );
          }
        }
        const benchmarkBars = spyBars.filter((b) => b.t <= currentDate);
        const scores = scoreSectors(barsToDate, benchmarkBars, 20);
        const topSectors = scores.slice(0, config.topN);

        // Pick stocks from top sectors
        selectedSectors = [];
        for (const sector of topSectors) {
          const stocks =
            SECTOR_STOCKS[sector.symbol as keyof typeof SECTOR_STOCKS] || [];
          selectedSectors.push(...stocks.slice(0, config.stocksPerSector || 2));
        }
      }

      // Open new positions
      if (selectedSectors.length > 0 && capital > 1000) {
        const positionSize = capital / selectedSectors.length;

        for (const symbol of selectedSectors) {
          const symbolBars = bars.get(symbol);
          if (symbolBars) {
            const currentBar = symbolBars.find((b) => b.t === currentDate);
            if (currentBar && currentBar.c > 0) {
              const shares = Math.floor(positionSize / currentBar.c);
              if (shares > 0) {
                positions.set(symbol, {
                  entry: currentBar.c,
                  shares,
                  entryDate: currentDate,
                });
                capital -= shares * currentBar.c;

                // Track sector exposure
                const sectorSymbol =
                  config.type === "mixed"
                    ? Object.keys(SECTOR_STOCKS).find((k) =>
                        (
                          SECTOR_STOCKS[k as keyof typeof SECTOR_STOCKS] || []
                        ).includes(symbol)
                      ) || symbol
                    : symbol;
                sectorExposureCount[sectorSymbol] =
                  (sectorExposureCount[sectorSymbol] || 0) + 1;
              }
            }
          }
        }
      }

      lastRotationDay = dayIdx;
    }

    // Calculate equity
    let currentEquity = capital;
    for (const [symbol, pos] of positions) {
      const symbolBars = bars.get(symbol);
      if (symbolBars) {
        const currentBar = symbolBars.find((b) => b.t === currentDate);
        if (currentBar) {
          currentEquity += pos.shares * currentBar.c;
        }
      }
    }

    equity.push(currentEquity);
    if (equity.length > 1) {
      dailyReturns.push(
        (currentEquity - equity[equity.length - 2]) / equity[equity.length - 2]
      );
    }
  }

  // Close remaining positions
  for (const [symbol, pos] of positions) {
    const symbolBars = bars.get(symbol);
    if (symbolBars && symbolBars.length > 0) {
      const lastBar = symbolBars[symbolBars.length - 1];
      trades.push({
        entry: pos.entry,
        exit: lastBar.c,
        symbol,
        days: allDates.length - allDates.indexOf(pos.entryDate),
      });
    }
  }

  // Calculate metrics
  const totalReturn =
    (equity[equity.length - 1] - initialCapital) / initialCapital;
  const maxDrawdown = equity.reduce((maxDD, val, i) => {
    const peak = Math.max(...equity.slice(0, i + 1));
    return Math.max(maxDD, (peak - val) / peak);
  }, 0);

  const avgReturn =
    dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const stdReturn = Math.sqrt(
    dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
      (dailyReturns.length || 1)
  );
  const sharpe =
    stdReturn > 0 ? (avgReturn * 252) / (stdReturn * Math.sqrt(252)) : 0;

  const negativeReturns = dailyReturns.filter((r) => r < 0);
  const downstdReturn = Math.sqrt(
    negativeReturns.reduce((sum, r) => sum + r * r, 0) /
      (negativeReturns.length || 1)
  );
  const sortino =
    downstdReturn > 0
      ? (avgReturn * 252) / (downstdReturn * Math.sqrt(252))
      : 0;

  const years = allDates.length / 252;
  const cagr = Math.pow(1 + totalReturn, 1 / years) - 1;
  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : 0;

  const winningTrades = trades.filter((t) => t.exit > t.entry).length;
  const winRate = trades.length > 0 ? winningTrades / trades.length : 0;

  const avgHoldingDays =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + t.days, 0) / trades.length
      : 0;

  const volatility = stdReturn * Math.sqrt(252);
  const annualizedReturn = cagr;

  // Find best and worst sectors
  const sortedSectors = Object.entries(sectorExposureCount).sort(
    (a, b) => b[1] - a[1]
  );
  const bestSector = sortedSectors[0]?.[0] || "N/A";
  const worstSector = sortedSectors[sortedSectors.length - 1]?.[0] || "N/A";

  return {
    configName: config.name,
    totalReturn,
    sharpe,
    sortino,
    calmar,
    maxDrawdown,
    winRate,
    trades: trades.length,
    avgHoldingDays,
    annualizedReturn,
    volatility,
    details: {
      sectorExposure: sectorExposureCount,
      bestSector,
      worstSector,
      rotationCount: Math.floor((allDates.length - 60) / config.rotationDays),
    },
  };
}

// ============= MAIN =============

async function loadData(): Promise<Map<string, AlpacaBar[]>> {
  const bars = new Map<string, AlpacaBar[]>();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 3);

  const start = startDate.toISOString().split("T")[0];
  const end = endDate.toISOString().split("T")[0];

  console.log("\n" + "═".repeat(80));
  console.log("  OMAR SECTOR ROTATION OPTIMIZER");
  console.log("═".repeat(80));
  console.log(`\nLoading data: ${start} to ${end}\n`);

  // Load sector ETFs
  const allSymbols = [
    ...SECTOR_ETFS.map((s) => s.symbol),
    ...BENCHMARKS,
    ...Object.values(SECTOR_STOCKS).flat(),
  ];

  let loaded = 0;
  for (const symbol of allSymbols) {
    try {
      const symbolBars = await fetchAlpacaBars(symbol, start, end);
      if (symbolBars.length > 100) {
        bars.set(symbol, symbolBars);
        loaded++;
      }
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      // Skip
    }
    process.stdout.write(`\r  Loaded ${loaded}/${allSymbols.length} symbols`);
  }

  console.log(`\n  Successfully loaded ${bars.size} symbols\n`);
  return bars;
}

async function main() {
  const bars = await loadData();

  if (bars.size < 10) {
    console.error("Insufficient data. Aborting.");
    return;
  }

  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 3);
  const endDate = new Date();

  console.log("─".repeat(80));
  console.log("  RUNNING OPTIMIZATIONS");
  console.log("─".repeat(80));
  console.log(`\n  Testing ${OPTIMIZATION_CONFIGS.length} configurations...\n`);

  const results: BacktestResult[] = [];

  for (let i = 0; i < OPTIMIZATION_CONFIGS.length; i++) {
    const config = OPTIMIZATION_CONFIGS[i];
    process.stdout.write(
      `  [${i + 1}/${OPTIMIZATION_CONFIGS.length}] ${config.name}...`
    );

    try {
      const result = await runSectorRotationBacktest(
        config,
        bars,
        startDate,
        endDate
      );
      results.push(result);
      console.log(
        ` ✓ Sharpe: ${result.sharpe.toFixed(2)}, Return: ${(result.totalReturn * 100).toFixed(1)}%`
      );
    } catch (err) {
      console.log(` ✗ Error: ${err}`);
    }
  }

  // Sort by Sharpe ratio
  results.sort((a, b) => b.sharpe - a.sharpe);

  console.log("\n" + "═".repeat(80));
  console.log("  OPTIMIZATION RESULTS");
  console.log("═".repeat(80));

  console.log("\n  TOP 10 CONFIGURATIONS BY SHARPE RATIO:\n");
  console.log(
    "  Rank | Configuration                    | Sharpe | Sortino | Calmar | Win% | Return  | MaxDD   | Trades"
  );
  console.log("  " + "─".repeat(120));

  for (let i = 0; i < Math.min(10, results.length); i++) {
    const r = results[i];
    console.log(
      `  ${String(i + 1).padStart(4)} | ` +
        `${r.configName.padEnd(32)} | ` +
        `${r.sharpe.toFixed(2).padStart(6)} | ` +
        `${r.sortino.toFixed(2).padStart(7)} | ` +
        `${r.calmar.toFixed(2).padStart(6)} | ` +
        `${(r.winRate * 100).toFixed(1).padStart(4)}% | ` +
        `${(r.totalReturn * 100).toFixed(1).padStart(6)}% | ` +
        `${(r.maxDrawdown * 100).toFixed(1).padStart(6)}% | ` +
        `${String(r.trades).padStart(6)}`
    );
  }

  // Best configuration details
  if (results.length > 0) {
    const best = results[0];
    console.log("\n" + "═".repeat(80));
    console.log("  BEST CONFIGURATION DETAILS");
    console.log("═".repeat(80));
    console.log(`\n  Configuration: ${best.configName}`);
    console.log(`  ${"─".repeat(40)}`);
    console.log(`  Sharpe Ratio:        ${best.sharpe.toFixed(3)}`);
    console.log(`  Sortino Ratio:       ${best.sortino.toFixed(3)}`);
    console.log(`  Calmar Ratio:        ${best.calmar.toFixed(3)}`);
    console.log(
      `  Total Return:        ${(best.totalReturn * 100).toFixed(2)}%`
    );
    console.log(
      `  Annualized Return:   ${(best.annualizedReturn * 100).toFixed(2)}%`
    );
    console.log(
      `  Max Drawdown:        ${(best.maxDrawdown * 100).toFixed(2)}%`
    );
    console.log(
      `  Volatility:          ${(best.volatility * 100).toFixed(2)}%`
    );
    console.log(`  Win Rate:            ${(best.winRate * 100).toFixed(1)}%`);
    console.log(`  Total Trades:        ${best.trades}`);
    console.log(`  Avg Holding Days:    ${best.avgHoldingDays.toFixed(1)}`);
    console.log(`  Rotation Count:      ${best.details.rotationCount}`);

    console.log(`\n  Sector Exposure:`);
    const sortedExposure = Object.entries(best.details.sectorExposure).sort(
      (a, b) => b[1] - a[1]
    );
    for (const [sector, count] of sortedExposure.slice(0, 10)) {
      const sectorName =
        SECTOR_ETFS.find((s) => s.symbol === sector)?.name || sector;
      console.log(
        `    ${sector.padEnd(6)} (${sectorName.padEnd(20)}): ${count} rotations`
      );
    }

    console.log(`\n  Most Used Sector:    ${best.details.bestSector}`);
    console.log(`  Least Used Sector:   ${best.details.worstSector}`);
  }

  // Market regime analysis
  console.log("\n" + "═".repeat(80));
  console.log("  STRATEGY TYPE COMPARISON");
  console.log("═".repeat(80));

  const byType: Record<string, BacktestResult[]> = {};
  for (const result of results) {
    const config = OPTIMIZATION_CONFIGS.find(
      (c) => c.name === result.configName
    );
    if (config) {
      if (!byType[config.type]) byType[config.type] = [];
      byType[config.type].push(result);
    }
  }

  console.log(
    "\n  Type                | Avg Sharpe | Avg Return | Avg MaxDD | Best Config"
  );
  console.log("  " + "─".repeat(100));

  for (const [type, typeResults] of Object.entries(byType)) {
    const avgSharpe =
      typeResults.reduce((sum, r) => sum + r.sharpe, 0) / typeResults.length;
    const avgReturn =
      typeResults.reduce((sum, r) => sum + r.totalReturn, 0) /
      typeResults.length;
    const avgMaxDD =
      typeResults.reduce((sum, r) => sum + r.maxDrawdown, 0) /
      typeResults.length;
    const bestConfig = typeResults.sort((a, b) => b.sharpe - a.sharpe)[0];

    console.log(
      `  ${type.padEnd(19)} | ` +
        `${avgSharpe.toFixed(2).padStart(10)} | ` +
        `${(avgReturn * 100).toFixed(1).padStart(9)}% | ` +
        `${(avgMaxDD * 100).toFixed(1).padStart(8)}% | ` +
        `${bestConfig.configName}`
    );
  }

  console.log("\n" + "═".repeat(80));
  console.log("  OPTIMIZATION COMPLETE");
  console.log("═".repeat(80));
  console.log();
}

main().catch(console.error);
