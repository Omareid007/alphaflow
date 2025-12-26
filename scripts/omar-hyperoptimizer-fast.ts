#!/usr/bin/env npx tsx
/**
 * OMAR HYPEROPTIMIZER - FAST PRODUCTION VERSION
 * Optimized for complete execution with quality results
 */

import * as fs from 'fs';

const ALPACA_KEY = process.env.ALPACA_API_KEY || '';
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || '';
const ALPACA_DATA_URL = 'https://data.alpaca.markets';

const RESULTS_FILE = '/home/runner/workspace/hyperoptimizer_final_results.json';

// FAST config - optimized for complete runs
const CONFIG = {
  TOTAL_ITERATIONS: 3000,
  BATCH_SIZE: 25,
  POPULATION_SIZE: 100,
  ELITE_COUNT: 10,
  MUTATION_RATE: 0.18,
  CROSSOVER_RATE: 0.7,
  TOURNAMENT_SIZE: 4,
  NUM_ISLANDS: 4,
  MIGRATION_INTERVAL: 8,
  MIGRATION_COUNT: 2,
  YEARS_OF_DATA: 3,
};

// Core symbols for fast processing
const SYMBOLS = [
  'SPY', 'QQQ', 'IWM', 'DIA',           // Indices
  'GLD', 'SLV',                          // Metals
  'XLF', 'XLK', 'XLE', 'XLV',           // Sectors
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',  // Tech
  'JPM', 'V', 'UNH',                     // Financials/Health
  'XOM', 'CVX',                          // Energy
  'TLT', 'LQD',                          // Bonds
];

// Parameter ranges
const PARAM_RANGES: Record<string, { min: number; max: number; step: number; integer?: boolean }> = {
  maxPositionPct: { min: 0.03, max: 0.12, step: 0.01 },
  maxPositions: { min: 5, max: 20, step: 1, integer: true },
  atrMultStop: { min: 1.0, max: 2.5, step: 0.25 },
  atrMultTarget: { min: 2.0, max: 5.0, step: 0.5 },
  buyThreshold: { min: 0.08, max: 0.20, step: 0.02 },
  confidenceMin: { min: 0.20, max: 0.40, step: 0.05 },
  technicalWeight: { min: 0.10, max: 0.30, step: 0.05 },
  momentumWeight: { min: 0.10, max: 0.30, step: 0.05 },
  volatilityWeight: { min: 0.05, max: 0.15, step: 0.05 },
  volumeWeight: { min: 0.05, max: 0.20, step: 0.05 },
  sentimentWeight: { min: 0.05, max: 0.20, step: 0.05 },
  patternWeight: { min: 0.05, max: 0.15, step: 0.05 },
  rsiPeriod: { min: 10, max: 18, step: 2, integer: true },
  rsiOversold: { min: 25, max: 35, step: 5, integer: true },
  rsiOverbought: { min: 65, max: 75, step: 5, integer: true },
  macdFast: { min: 10, max: 14, step: 2, integer: true },
  macdSlow: { min: 22, max: 28, step: 2, integer: true },
  atrPeriod: { min: 12, max: 16, step: 2, integer: true },
  momentumShort: { min: 4, max: 8, step: 2, integer: true },
  momentumMedium: { min: 15, max: 25, step: 5, integer: true },
};

interface Bar { t: string; o: number; h: number; l: number; c: number; v: number; }
interface Genome {
  id: string; genes: Record<string, number>; fitness: number;
  sharpe: number; sortino: number; calmar: number; winRate: number;
  totalReturn: number; maxDrawdown: number; trades: number;
  generation: number; island: number;
}
interface BacktestResult {
  totalReturn: number; sharpe: number; sortino: number; calmar: number;
  maxDrawdown: number; winRate: number; profitFactor: number;
  trades: number; avgHoldingDays: number;
}

// Technical Indicators (optimized)
function calcSMA(d: number[], p: number): number[] {
  const r: number[] = new Array(d.length); let s = 0;
  for (let i = 0; i < d.length; i++) {
    s += d[i]; if (i >= p) s -= d[i - p];
    r[i] = i >= p - 1 ? s / p : NaN;
  } return r;
}

function calcEMA(d: number[], p: number): number[] {
  const r: number[] = new Array(d.length);
  const m = 2 / (p + 1); r[0] = d[0];
  for (let i = 1; i < d.length; i++) r[i] = (d[i] - r[i - 1]) * m + r[i - 1];
  return r;
}

function calcRSI(c: number[], p: number): number[] {
  const r: number[] = new Array(c.length).fill(NaN);
  if (c.length < p + 1) return r;
  let ag = 0, al = 0;
  for (let i = 1; i <= p; i++) {
    const ch = c[i] - c[i - 1];
    if (ch > 0) ag += ch; else al -= ch;
  }
  ag /= p; al /= p;
  r[p] = al === 0 ? 100 : 100 - (100 / (1 + ag / al));
  for (let i = p + 1; i < c.length; i++) {
    const ch = c[i] - c[i - 1];
    ag = (ag * (p - 1) + (ch > 0 ? ch : 0)) / p;
    al = (al * (p - 1) + (ch < 0 ? -ch : 0)) / p;
    r[i] = al === 0 ? 100 : 100 - (100 / (1 + ag / al));
  } return r;
}

function calcATR(h: number[], l: number[], c: number[], p: number): number[] {
  const r: number[] = new Array(c.length).fill(NaN);
  const tr: number[] = [h[0] - l[0]];
  for (let i = 1; i < c.length; i++)
    tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
  let atr = 0;
  for (let i = 0; i < p && i < tr.length; i++) atr += tr[i];
  atr /= p; if (p - 1 < r.length) r[p - 1] = atr;
  for (let i = p; i < c.length; i++) { atr = (atr * (p - 1) + tr[i]) / p; r[i] = atr; }
  return r;
}

function calcMACD(c: number[], f: number, s: number, sig: number) {
  const ef = calcEMA(c, f), es = calcEMA(c, s);
  const macd = ef.map((v, i) => v - es[i]);
  const sl = calcEMA(macd.slice(s - 1), sig);
  const hist = macd.slice(s - 1).map((m, i) => m - (sl[i] || 0));
  return { macd, sl, hist };
}

function calcBB(c: number[], p: number, sd: number) {
  const mid = calcSMA(c, p);
  const up: number[] = [], lo: number[] = [];
  for (let i = p - 1; i < c.length; i++) {
    const slice = c.slice(i - p + 1, i + 1);
    const std = Math.sqrt(slice.reduce((s, v) => s + Math.pow(v - mid[i], 2), 0) / p);
    up[i] = mid[i] + sd * std; lo[i] = mid[i] - sd * std;
  }
  return { up, mid, lo };
}

// Genetic operators
function normalizeWeights(g: Record<string, number>): void {
  const wk = ['technicalWeight', 'momentumWeight', 'volatilityWeight', 'volumeWeight', 'sentimentWeight', 'patternWeight'];
  const t = wk.reduce((s, k) => s + (g[k] || 0), 0);
  if (t > 0) for (const k of wk) g[k] = Math.round((g[k] / t) * 100) / 100;
}

function randGenome(gen: number, isl: number): Genome {
  const genes: Record<string, number> = {};
  for (const [p, r] of Object.entries(PARAM_RANGES)) {
    const steps = Math.floor((r.max - r.min) / r.step);
    let v = r.min + Math.floor(Math.random() * (steps + 1)) * r.step;
    if (r.integer) v = Math.round(v);
    genes[p] = v;
  }
  normalizeWeights(genes);
  return { id: `g${gen}-i${isl}-${Math.random().toString(36).substr(2, 6)}`, genes,
    fitness: 0, sharpe: 0, sortino: 0, calmar: 0, winRate: 0,
    totalReturn: 0, maxDrawdown: 0, trades: 0, generation: gen, island: isl };
}

function crossover(p1: Genome, p2: Genome, gen: number, isl: number): Genome {
  const g: Record<string, number> = {};
  for (const p of Object.keys(PARAM_RANGES)) {
    const r = Math.random();
    if (r < 0.4) g[p] = p1.genes[p];
    else if (r < 0.8) g[p] = p2.genes[p];
    else {
      const a = Math.random();
      let v = a * p1.genes[p] + (1 - a) * p2.genes[p];
      const rng = PARAM_RANGES[p];
      v = Math.round(v / rng.step) * rng.step;
      v = Math.max(rng.min, Math.min(rng.max, v));
      if (rng.integer) v = Math.round(v);
      g[p] = v;
    }
  }
  normalizeWeights(g);
  return { id: `g${gen}-i${isl}-${Math.random().toString(36).substr(2, 6)}`, genes: g,
    fitness: 0, sharpe: 0, sortino: 0, calmar: 0, winRate: 0,
    totalReturn: 0, maxDrawdown: 0, trades: 0, generation: gen, island: isl };
}

function mutate(gn: Genome, rate: number): Genome {
  const g = { ...gn.genes };
  for (const [p, rng] of Object.entries(PARAM_RANGES)) {
    if (Math.random() < rate) {
      const sig = (rng.max - rng.min) * 0.25;
      let v = g[p] + (Math.random() - 0.5) * 2 * sig;
      v = Math.max(rng.min, Math.min(rng.max, v));
      v = Math.round(v / rng.step) * rng.step;
      if (rng.integer) v = Math.round(v);
      g[p] = v;
    }
  }
  normalizeWeights(g);
  return { ...gn, genes: g, fitness: 0, id: `${gn.id}-m` };
}

function tournamentSelect(pop: Genome[], size: number): Genome {
  let best: Genome | null = null;
  for (let i = 0; i < size; i++) {
    const c = pop[Math.floor(Math.random() * pop.length)];
    if (!best || c.fitness > best.fitness) best = c;
  }
  return best!;
}

// Signal generation
function genSignal(bars: Bar[], genes: Record<string, number>, idx: number): { score: number; confidence: number } {
  if (idx < 50) return { score: 0, confidence: 0 };

  const c = bars.slice(0, idx + 1).map(b => b.c);
  const h = bars.slice(0, idx + 1).map(b => b.h);
  const l = bars.slice(0, idx + 1).map(b => b.l);
  const v = bars.slice(0, idx + 1).map(b => b.v);

  const factors: Record<string, number> = {};

  // RSI
  const rsi = calcRSI(c, genes.rsiPeriod || 14);
  const curRSI = rsi[rsi.length - 1];
  if (!isNaN(curRSI)) {
    if (curRSI < (genes.rsiOversold || 30)) factors.tech = 0.7;
    else if (curRSI > (genes.rsiOverbought || 70)) factors.tech = -0.7;
    else factors.tech = (50 - curRSI) / 60;
  } else factors.tech = 0;

  // MACD
  const macd = calcMACD(c, genes.macdFast || 12, genes.macdSlow || 26, 9);
  if (macd.hist.length > 1) {
    const hc = macd.hist[macd.hist.length - 1];
    const hp = macd.hist[macd.hist.length - 2];
    factors.tech += hc > hp ? 0.3 : -0.3;
  }
  factors.tech = Math.max(-1, Math.min(1, factors.tech));

  // Momentum
  const ms = genes.momentumShort || 5, mm = genes.momentumMedium || 20;
  if (c.length > mm) {
    const msv = (c[c.length - 1] - c[c.length - ms - 1]) / c[c.length - ms - 1];
    const mmv = (c[c.length - 1] - c[c.length - mm - 1]) / c[c.length - mm - 1];
    factors.mom = Math.max(-1, Math.min(1, msv * 8 + mmv * 4));
  } else factors.mom = 0;

  // Volatility
  const atr = calcATR(h, l, c, genes.atrPeriod || 14);
  const curATR = atr[atr.length - 1];
  if (!isNaN(curATR)) {
    const atrPct = curATR / c[c.length - 1];
    factors.vol = Math.max(-1, Math.min(1, 0.4 - atrPct * 15));
  } else factors.vol = 0;

  // Volume
  if (v.length > 20) {
    const avgV = v.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    const vr = v[v.length - 1] / avgV;
    factors.volume = Math.max(-1, Math.min(1, (vr - 1) * 0.4));
  } else factors.volume = 0;

  // Sentiment
  const ret = c.length > 5 ? (c[c.length - 1] - c[c.length - 6]) / c[c.length - 6] : 0;
  factors.sent = Math.max(-1, Math.min(1, ret * 8));

  // Pattern (BB-based)
  const bb = calcBB(c, 20, 2);
  const cur = c[c.length - 1];
  if (bb.up[bb.up.length - 1] && bb.lo[bb.lo.length - 1]) {
    if (cur < bb.lo[bb.lo.length - 1]) factors.pat = 0.5;
    else if (cur > bb.up[bb.up.length - 1]) factors.pat = -0.5;
    else factors.pat = 0;
  } else factors.pat = 0;

  // Weighted score
  const score =
    factors.tech * (genes.technicalWeight || 0.2) +
    factors.mom * (genes.momentumWeight || 0.2) +
    factors.vol * (genes.volatilityWeight || 0.1) +
    factors.volume * (genes.volumeWeight || 0.1) +
    factors.sent * (genes.sentimentWeight || 0.1) +
    factors.pat * (genes.patternWeight || 0.1);

  const vals = Object.values(factors);
  const pos = vals.filter(f => f > 0.15).length;
  const neg = vals.filter(f => f < -0.15).length;
  const agr = Math.max(pos, neg) / vals.length;

  return { score, confidence: agr * Math.abs(score) };
}

// Backtest
function runBacktest(genome: Genome, barsMap: Map<string, Bar[]>, syms: string[], startIdx: number, endIdx: number): BacktestResult {
  const g = genome.genes;
  const initCap = 100000;
  let cap = initCap;
  const equity: number[] = [cap];
  const dailyRet: number[] = [];
  const trades: { pnl: number; days: number }[] = [];
  const pos: Map<string, { entry: number; shares: number; entryIdx: number; sl: number; tp: number }> = new Map();

  const refBars = barsMap.get('SPY') || barsMap.values().next().value;
  if (!refBars || refBars.length < endIdx) return emptyResult();

  for (let idx = startIdx; idx < Math.min(endIdx, refBars.length); idx++) {
    // Exits
    for (const [sym, p] of pos) {
      const bars = barsMap.get(sym);
      if (!bars || idx >= bars.length) continue;
      const bar = bars[idx];
      let exit: number | null = null;
      if (bar.l <= p.sl) exit = p.sl;
      else if (bar.h >= p.tp) exit = p.tp;
      if (exit) {
        const pnl = (exit - p.entry) * p.shares;
        cap += p.shares * exit;
        trades.push({ pnl, days: idx - p.entryIdx });
        pos.delete(sym);
      }
    }

    // Entries
    if (pos.size < (g.maxPositions || 15)) {
      const cands: { sym: string; score: number; price: number; atr: number }[] = [];
      for (const sym of syms) {
        if (pos.has(sym)) continue;
        const bars = barsMap.get(sym);
        if (!bars || idx >= bars.length || idx < 50) continue;
        const sig = genSignal(bars, g, idx);
        if (sig.score >= (g.buyThreshold || 0.1) && sig.confidence >= (g.confidenceMin || 0.25)) {
          const c = bars.slice(0, idx + 1).map(b => b.c);
          const h = bars.slice(0, idx + 1).map(b => b.h);
          const l = bars.slice(0, idx + 1).map(b => b.l);
          const atr = calcATR(h, l, c, g.atrPeriod || 14);
          const curATR = atr[atr.length - 1];
          if (!isNaN(curATR)) cands.push({ sym, score: sig.score, price: bars[idx].c, atr: curATR });
        }
      }
      cands.sort((a, b) => b.score - a.score);
      for (const cand of cands.slice(0, (g.maxPositions || 15) - pos.size)) {
        const maxSize = cap * (g.maxPositionPct || 0.05);
        const shares = Math.floor(maxSize / cand.price);
        if (shares > 0 && shares * cand.price <= cap) {
          const sl = cand.price - cand.atr * (g.atrMultStop || 1.5);
          const tp = cand.price + cand.atr * (g.atrMultTarget || 3.5);
          pos.set(cand.sym, { entry: cand.price, shares, entryIdx: idx, sl, tp });
          cap -= shares * cand.price;
        }
      }
    }

    // Equity
    let curEq = cap;
    for (const [sym, p] of pos) {
      const bars = barsMap.get(sym);
      if (bars && idx < bars.length) curEq += p.shares * bars[idx].c;
    }
    equity.push(curEq);
    if (equity.length > 1) dailyRet.push((curEq - equity[equity.length - 2]) / equity[equity.length - 2]);
  }

  // Close remaining
  for (const [sym, p] of pos) {
    const bars = barsMap.get(sym);
    if (bars && bars.length > 0) {
      const lastP = bars[Math.min(endIdx - 1, bars.length - 1)].c;
      trades.push({ pnl: (lastP - p.entry) * p.shares, days: endIdx - p.entryIdx });
    }
  }

  // Metrics
  const finalEq = equity[equity.length - 1];
  const totalRet = (finalEq - initCap) / initCap;
  let maxDD = 0, peak = equity[0];
  for (const v of equity) { if (v > peak) peak = v; const dd = (peak - v) / peak; if (dd > maxDD) maxDD = dd; }

  const avgRet = dailyRet.length > 0 ? dailyRet.reduce((a, b) => a + b, 0) / dailyRet.length : 0;
  const stdRet = dailyRet.length > 1 ? Math.sqrt(dailyRet.reduce((s, r) => s + Math.pow(r - avgRet, 2), 0) / dailyRet.length) : 1;
  const sharpe = stdRet > 0 ? (avgRet * 252) / (stdRet * Math.sqrt(252)) : 0;
  const negRet = dailyRet.filter(r => r < 0);
  const downStd = negRet.length > 0 ? Math.sqrt(negRet.reduce((s, r) => s + r * r, 0) / negRet.length) : 1;
  const sortino = downStd > 0 ? (avgRet * 252) / (downStd * Math.sqrt(252)) : 0;
  const years = dailyRet.length / 252;
  const cagr = years > 0 ? Math.pow(1 + totalRet, 1 / years) - 1 : 0;
  const calmar = maxDD > 0 ? cagr / maxDD : 0;
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const grossP = wins.reduce((s, t) => s + t.pnl, 0);
  const grossL = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const pf = grossL > 0 ? grossP / grossL : grossP > 0 ? Infinity : 0;
  const avgDays = trades.length > 0 ? trades.reduce((s, t) => s + t.days, 0) / trades.length : 0;

  return { totalReturn: totalRet, sharpe, sortino, calmar, maxDrawdown: maxDD, winRate, profitFactor: pf, trades: trades.length, avgHoldingDays: avgDays };
}

function emptyResult(): BacktestResult {
  return { totalReturn: -1, sharpe: -10, sortino: -10, calmar: -10, maxDrawdown: 1, winRate: 0, profitFactor: 0, trades: 0, avgHoldingDays: 0 };
}

function calcFitness(r: BacktestResult): number {
  if (r.trades < 15) return -1000 + r.trades;
  if (r.maxDrawdown > 0.30) return -400 * r.maxDrawdown;
  return r.sharpe * 25 + r.sortino * 15 + r.calmar * 18 + r.winRate * 15 + r.totalReturn * 12 + (1 - r.maxDrawdown) * 10 + Math.min(r.profitFactor, 3) * 10 + Math.min(r.trades / 200, 1) * 5;
}

// Data loading
async function fetchBars(sym: string, start: string, end: string): Promise<Bar[]> {
  const bars: Bar[] = []; let pt: string | null = null;
  do {
    let url = `${ALPACA_DATA_URL}/v2/stocks/${sym}/bars?timeframe=1Day&start=${start}&end=${end}&limit=10000&feed=iex`;
    if (pt) url += `&page_token=${pt}`;
    try {
      const res = await fetch(url, { headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET } });
      if (!res.ok) return bars;
      const d = await res.json();
      if (d.bars && Array.isArray(d.bars)) bars.push(...d.bars);
      pt = d.next_page_token || null;
    } catch { break; }
  } while (pt);
  return bars;
}

async function loadData(syms: string[], years: number): Promise<Map<string, Bar[]>> {
  const bars = new Map<string, Bar[]>();
  const end = new Date(), start = new Date();
  start.setFullYear(start.getFullYear() - years);
  const startStr = start.toISOString().split('T')[0], endStr = end.toISOString().split('T')[0];

  console.log(`📊 Loading ${syms.length} symbols (${startStr} to ${endStr})...`);

  for (let i = 0; i < syms.length; i += 5) {
    const batch = syms.slice(i, i + 5);
    await Promise.all(batch.map(async (sym) => {
      try {
        const b = await fetchBars(sym, startStr, endStr);
        if (b.length > 100) bars.set(sym, b);
      } catch {}
    }));
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`✅ Loaded ${bars.size} symbols\n`);
  return bars;
}

// Main optimizer
async function runOptimizer() {
  const startTime = Date.now();

  console.log('\n' + '═'.repeat(70));
  console.log('    OMAR HYPEROPTIMIZER - FAST PRODUCTION VERSION');
  console.log('═'.repeat(70));
  console.log(`\n⚙️  Config: ${CONFIG.TOTAL_ITERATIONS} iterations | ${CONFIG.POPULATION_SIZE} population | ${CONFIG.NUM_ISLANDS} islands`);
  console.log(`📈 Universe: ${SYMBOLS.length} symbols | ${CONFIG.YEARS_OF_DATA} years data\n`);

  const bars = await loadData(SYMBOLS, CONFIG.YEARS_OF_DATA);
  if (bars.size < 5) { console.error('❌ Insufficient data'); return; }

  const syms = Array.from(bars.keys());
  const refBars = bars.get('SPY') || bars.values().next().value;
  const startIdx = 50, endIdx = refBars.length;

  console.log(`📅 Trading days: ${endIdx - startIdx}\n`);

  // Initialize islands
  const islands: Genome[][] = [];
  for (let i = 0; i < CONFIG.NUM_ISLANDS; i++) {
    const pop: Genome[] = [];
    for (let j = 0; j < CONFIG.POPULATION_SIZE / CONFIG.NUM_ISLANDS; j++) pop.push(randGenome(0, i));
    islands.push(pop);
  }

  let globalBest: Genome | null = null;
  let globalBestResult: BacktestResult | null = null;
  let totalEvals = 0;

  const maxGens = Math.ceil(CONFIG.TOTAL_ITERATIONS / CONFIG.POPULATION_SIZE);
  console.log(`🧬 Starting evolution (${maxGens} generations)...\n`);

  for (let gen = 0; gen < maxGens; gen++) {
    const genStart = Date.now();

    for (let isl = 0; isl < CONFIG.NUM_ISLANDS; isl++) {
      const island = islands[isl];

      // Evaluate
      for (let b = 0; b < island.length; b += CONFIG.BATCH_SIZE) {
        const batch = island.slice(b, Math.min(b + CONFIG.BATCH_SIZE, island.length));
        await Promise.all(batch.map(async (genome) => {
          if (genome.fitness === 0) {
            try {
              const res = runBacktest(genome, bars, syms, startIdx, endIdx);
              const fit = calcFitness(res);
              genome.fitness = fit;
              genome.sharpe = res.sharpe;
              genome.sortino = res.sortino;
              genome.calmar = res.calmar;
              genome.winRate = res.winRate;
              genome.totalReturn = res.totalReturn;
              genome.maxDrawdown = res.maxDrawdown;
              genome.trades = res.trades;
              totalEvals++;

              if (!globalBest || fit > globalBest.fitness) {
                if (res.sharpe < 4 && (res.winRate < 0.85 || res.trades < 50)) {
                  globalBest = { ...genome };
                  globalBestResult = res;
                  console.log(`\n🏆 NEW BEST [Gen ${gen}] Fitness: ${fit.toFixed(2)} | Sharpe: ${res.sharpe.toFixed(2)} | Return: ${(res.totalReturn * 100).toFixed(1)}% | DD: ${(res.maxDrawdown * 100).toFixed(1)}% | WR: ${(res.winRate * 100).toFixed(0)}% | Trades: ${res.trades}`);
                }
              }
            } catch { genome.fitness = -10000; }
          }
        }));
      }

      // Evolution
      island.sort((a, b) => b.fitness - a.fitness);
      const newPop: Genome[] = [];
      const elite = Math.ceil(CONFIG.ELITE_COUNT / CONFIG.NUM_ISLANDS);
      for (let i = 0; i < elite && i < island.length; i++) newPop.push({ ...island[i], generation: gen + 1 });

      while (newPop.length < island.length) {
        if (Math.random() < CONFIG.CROSSOVER_RATE) {
          const p1 = tournamentSelect(island, CONFIG.TOURNAMENT_SIZE);
          const p2 = tournamentSelect(island, CONFIG.TOURNAMENT_SIZE);
          let child = crossover(p1, p2, gen + 1, isl);
          if (Math.random() < CONFIG.MUTATION_RATE) child = mutate(child, CONFIG.MUTATION_RATE);
          newPop.push(child);
        } else {
          const p = tournamentSelect(island, CONFIG.TOURNAMENT_SIZE);
          newPop.push(mutate(p, CONFIG.MUTATION_RATE * 1.5));
        }
      }
      islands[isl] = newPop;
    }

    // Migration
    if (gen > 0 && gen % CONFIG.MIGRATION_INTERVAL === 0) {
      for (let i = 0; i < CONFIG.NUM_ISLANDS; i++) {
        const src = islands[i], tgt = islands[(i + 1) % CONFIG.NUM_ISLANDS];
        for (let j = 0; j < CONFIG.MIGRATION_COUNT && j < src.length; j++) {
          tgt.push({ ...src[j], fitness: 0 });
        }
        tgt.sort((a, b) => b.fitness - a.fitness);
        tgt.splice(-CONFIG.MIGRATION_COUNT);
      }
    }

    // Progress
    const all = islands.flat();
    const avgFit = all.reduce((s, g) => s + g.fitness, 0) / all.length;
    const bestFit = Math.max(...all.map(g => g.fitness));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = (totalEvals / ((Date.now() - startTime) / 1000)).toFixed(1);
    const pct = ((gen + 1) / maxGens * 100).toFixed(0);

    if (gen % 5 === 0 || gen === maxGens - 1) {
      process.stdout.write(`\r  Gen ${(gen + 1).toString().padStart(3)}/${maxGens} [${pct}%] | Evals: ${totalEvals} | Best: ${bestFit.toFixed(1)} | Avg: ${avgFit.toFixed(1)} | ${rate}/s | ${elapsed}s   `);
    }
  }

  // Final report
  const runtime = (Date.now() - startTime) / 1000;
  console.log('\n\n' + '═'.repeat(70));
  console.log('    OPTIMIZATION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`\n📊 Statistics:`);
  console.log(`   Evaluations: ${totalEvals.toLocaleString()}`);
  console.log(`   Runtime: ${runtime.toFixed(1)}s (${(runtime / 60).toFixed(1)} min)`);
  console.log(`   Rate: ${(totalEvals / runtime).toFixed(1)} evals/sec`);

  if (globalBest && globalBestResult) {
    console.log(`\n🏆 BEST CONFIGURATION:`);
    console.log(`   Fitness:       ${globalBest.fitness.toFixed(4)}`);
    console.log(`   Sharpe:        ${globalBestResult.sharpe.toFixed(4)}`);
    console.log(`   Sortino:       ${globalBestResult.sortino.toFixed(4)}`);
    console.log(`   Calmar:        ${globalBestResult.calmar.toFixed(4)}`);
    console.log(`   Total Return:  ${(globalBestResult.totalReturn * 100).toFixed(2)}%`);
    console.log(`   Max Drawdown:  ${(globalBestResult.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`   Win Rate:      ${(globalBestResult.winRate * 100).toFixed(1)}%`);
    console.log(`   Profit Factor: ${globalBestResult.profitFactor.toFixed(2)}`);
    console.log(`   Trades:        ${globalBestResult.trades}`);
    console.log(`   Avg Hold Days: ${globalBestResult.avgHoldingDays.toFixed(1)}`);

    const g = globalBest.genes;
    console.log(`\n📋 OPTIMAL PARAMETERS:`);
    console.log(`   Position: maxPct=${g.maxPositionPct?.toFixed(2)}, maxPos=${g.maxPositions}`);
    console.log(`   Risk: stopMult=${g.atrMultStop?.toFixed(2)}, targetMult=${g.atrMultTarget?.toFixed(2)}`);
    console.log(`   Entry: buyThresh=${g.buyThreshold?.toFixed(2)}, confMin=${g.confidenceMin?.toFixed(2)}`);
    console.log(`   Weights: tech=${g.technicalWeight?.toFixed(2)}, mom=${g.momentumWeight?.toFixed(2)}, vol=${g.volatilityWeight?.toFixed(2)}, volume=${g.volumeWeight?.toFixed(2)}`);
    console.log(`   Indicators: RSI(${g.rsiPeriod}/${g.rsiOversold}/${g.rsiOverbought}), MACD(${g.macdFast}/${g.macdSlow}), ATR(${g.atrPeriod})`);

    // Save results
    const results = {
      summary: { evaluations: totalEvals, runtime, generations: maxGens },
      best: { fitness: globalBest.fitness, genes: globalBest.genes },
      metrics: globalBestResult,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${RESULTS_FILE}`);
  }

  console.log('\n' + '═'.repeat(70) + '\n');
  return { globalBest, globalBestResult, totalEvals };
}

runOptimizer().catch(console.error);
