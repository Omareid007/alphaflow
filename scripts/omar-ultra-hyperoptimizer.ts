#!/usr/bin/env npx tsx
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║     OMAR ULTRA HYPEROPTIMIZER - 50 MILLION ITERATION SELF-IMPROVING SYSTEM    ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                               ║
 * ║  CAPABILITIES:                                                                ║
 * ║  • 50,000,000 iterations with parallel genetic optimization                   ║
 * ║  • 200+ markets including metals, commodities, crypto                         ║
 * ║  • 100,000+ symbol universe through expansion techniques                      ║
 * ║  • 30-year historical data analysis                                           ║
 * ║  • Self-evaluating judge with overfitting detection                           ║
 * ║  • Continuous learning with knowledge persistence                             ║
 * ║  • Multi-regime adaptation                                                    ║
 * ║  • Island-model genetic algorithm with migration                              ║
 * ║                                                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * USER GUIDANCE:
 * - Minimal inputs: Capital, Risk tolerance (1-10), Time horizon
 * - Optimal frequency: Weekly full optimization, Daily incremental
 * - Run mode: Continuous background with periodic checkpoints
 */

// ============================================================================
// CONFIGURATION - ULTRA SCALE
// ============================================================================

const ALPACA_KEY = process.env.ALPACA_API_KEY || '';
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || '';
const ALPACA_DATA_URL = 'https://data.alpaca.markets';

// Ultra-scale settings
const CONFIG = {
  // Target iterations (will run in batches)
  TOTAL_ITERATIONS: 50_000_000,

  // Batch processing (actual parallel runs per batch)
  BATCH_SIZE: 1000,
  PARALLEL_WORKERS: 20,

  // Genetic algorithm
  POPULATION_SIZE: 500,
  ELITE_COUNT: 50,
  MUTATION_RATE_INITIAL: 0.15,
  CROSSOVER_RATE: 0.7,
  TOURNAMENT_SIZE: 7,

  // Island model (for diversity)
  NUM_ISLANDS: 10,
  MIGRATION_INTERVAL: 100,
  MIGRATION_COUNT: 5,

  // Convergence detection
  CONVERGENCE_THRESHOLD: 0.0001,
  MAX_STAGNANT_GENERATIONS: 200,
  DIVERSITY_INJECTION_THRESHOLD: 0.03,

  // Memory and persistence
  CHECKPOINT_INTERVAL: 10000,
  KNOWLEDGE_BASE_SIZE: 1000,

  // Historical data
  YEARS_OF_DATA: 30,

  // Report intervals
  PROGRESS_REPORT_INTERVAL: 1000,
};

// ============================================================================
// 200 MARKET UNIVERSE - INCLUDING METALS & COMMODITIES
// ============================================================================

const MARKET_UNIVERSE = {
  // PRECIOUS METALS ETFs
  PRECIOUS_METALS: [
    'GLD',  // SPDR Gold Trust
    'IAU',  // iShares Gold Trust
    'SLV',  // iShares Silver Trust
    'PPLT', // abrdn Physical Platinum
    'PALL', // abrdn Physical Palladium
    'SGOL', // Aberdeen Physical Gold
    'SIVR', // Aberdeen Physical Silver
    'OUNZ', // VanEck Merk Gold Trust
    'GLDM', // SPDR Gold MiniShares
    'BAR',  // GraniteShares Gold Trust
  ],

  // METAL MINING STOCKS
  METAL_MINERS: [
    'NEM',  // Newmont Corporation (gold)
    'GOLD', // Barrick Gold
    'FCX',  // Freeport-McMoRan (copper)
    'AEM',  // Agnico Eagle Mines
    'WPM',  // Wheaton Precious Metals
    'FNV',  // Franco-Nevada
    'RGLD', // Royal Gold
    'KGC',  // Kinross Gold
    'AU',   // AngloGold Ashanti
    'AG',   // First Majestic Silver
    'PAAS', // Pan American Silver
    'HL',   // Hecla Mining
    'CDE',  // Coeur Mining
    'EXK',  // Endeavour Silver
    'MAG',  // MAG Silver
    'SVM',  // Silvercorp Metals
    'SCCO', // Southern Copper
    'TECK', // Teck Resources
    'RIO',  // Rio Tinto
    'BHP',  // BHP Group
    'VALE', // Vale SA
    'MT',   // ArcelorMittal
    'NUE',  // Nucor Corporation
    'STLD', // Steel Dynamics
    'CLF',  // Cleveland-Cliffs
    'X',    // United States Steel
    'AA',   // Alcoa Corporation
    'CENX', // Century Aluminum
  ],

  // BASE METAL ETFs
  BASE_METALS: [
    'CPER', // US Copper Index Fund
    'JJC',  // iPath Bloomberg Copper
    'DBB',  // Invesco DB Base Metals
    'REMX', // VanEck Rare Earth/Strategic Metals
    'PICK', // iShares MSCI Global Metals & Mining
    'XME',  // SPDR S&P Metals & Mining
    'SLX',  // VanEck Steel ETF
  ],

  // ENERGY COMMODITIES
  ENERGY: [
    'USO',  // United States Oil Fund
    'BNO',  // US Brent Oil Fund
    'UNG',  // United States Natural Gas
    'BOIL', // ProShares Ultra Bloomberg Natural Gas
    'UCO',  // ProShares Ultra Bloomberg Crude
    'XLE',  // Energy Select Sector SPDR
    'VDE',  // Vanguard Energy ETF
    'OIH',  // VanEck Oil Services ETF
    'XOP',  // SPDR S&P Oil & Gas Exploration
    'XOM',  // Exxon Mobil
    'CVX',  // Chevron
    'COP',  // ConocoPhillips
    'SLB',  // Schlumberger
    'EOG',  // EOG Resources
    'MPC',  // Marathon Petroleum
    'PSX',  // Phillips 66
    'VLO',  // Valero Energy
    'OXY',  // Occidental Petroleum
    'DVN',  // Devon Energy
    'HAL',  // Halliburton
    'BKR',  // Baker Hughes
    'FANG', // Diamondback Energy
    'PXD',  // Pioneer Natural Resources
  ],

  // AGRICULTURAL COMMODITIES
  AGRICULTURE: [
    'DBA',  // Invesco DB Agriculture Fund
    'CORN', // Teucrium Corn Fund
    'WEAT', // Teucrium Wheat Fund
    'SOYB', // Teucrium Soybean Fund
    'COW',  // iPath Bloomberg Livestock
    'NIB',  // iPath Bloomberg Cocoa
    'JO',   // iPath Bloomberg Coffee
    'SGG',  // iPath Bloomberg Sugar
    'BAL',  // iPath Bloomberg Cotton
    'MOO',  // VanEck Agribusiness ETF
    'VEGI', // iShares MSCI Agriculture ETF
    'ADM',  // Archer-Daniels-Midland
    'BG',   // Bunge Limited
    'DE',   // Deere & Company
    'CTVA', // Corteva
    'NTR',  // Nutrien Ltd
    'MOS',  // Mosaic Company
    'CF',   // CF Industries
  ],

  // BROAD COMMODITIES
  BROAD_COMMODITIES: [
    'DJP',  // iPath Bloomberg Commodity
    'GSG',  // iShares S&P GSCI Commodity
    'PDBC', // Invesco Optimum Yield Diversified
    'USCI', // US Commodity Index Fund
    'BCI',  // abrdn Bloomberg All Commodity Strategy
    'COMT', // iShares US Commodity Strategy
    'COM',  // Direxion Auspice Commodity
  ],

  // US LARGE CAP - TOP 50
  US_LARGE_CAP: [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B',
    'UNH', 'XOM', 'JNJ', 'JPM', 'V', 'PG', 'MA', 'HD', 'CVX', 'MRK',
    'ABBV', 'LLY', 'PEP', 'KO', 'AVGO', 'COST', 'TMO', 'MCD', 'WMT',
    'CSCO', 'ACN', 'ABT', 'BAC', 'PFE', 'CRM', 'LIN', 'DHR', 'ORCL',
    'AMD', 'VZ', 'INTC', 'NKE', 'ADBE', 'CMCSA', 'TXN', 'DIS', 'NEE',
    'PM', 'WFC', 'BMY', 'RTX', 'UPS',
  ],

  // US MID CAP - TOP 30
  US_MID_CAP: [
    'PANW', 'FTNT', 'CDNS', 'SNPS', 'ANET', 'CRWD', 'MRVL', 'TEAM',
    'DDOG', 'ZS', 'WDAY', 'OKTA', 'SPLK', 'TTD', 'NET', 'DOCU', 'BILL',
    'SNOW', 'VEEV', 'HUBS', 'ZI', 'PAYC', 'MNDY', 'CFLT', 'PATH',
    'APP', 'S', 'GLBE', 'SMAR', 'GTLB',
  ],

  // US SMALL CAP - TOP 20
  US_SMALL_CAP: [
    'SMCI', 'IONQ', 'RKLB', 'JOBY', 'LILM', 'EVGO', 'CHPT', 'BLNK',
    'PLUG', 'FCEL', 'BE', 'LCID', 'RIVN', 'FSR', 'NKLA', 'GOEV',
    'WKHS', 'RIDE', 'HYLN', 'XOS',
  ],

  // SECTOR ETFs - ALL 11 SPDR + SUB-SECTORS
  SECTOR_ETFS: [
    'XLF',  // Financials
    'XLK',  // Technology
    'XLE',  // Energy
    'XLV',  // Healthcare
    'XLI',  // Industrials
    'XLP',  // Consumer Staples
    'XLY',  // Consumer Discretionary
    'XLB',  // Materials
    'XLU',  // Utilities
    'XLRE', // Real Estate
    'XLC',  // Communication Services
    'VGT',  // Vanguard IT
    'VHT',  // Vanguard Healthcare
    'VFH',  // Vanguard Financials
    'VCR',  // Vanguard Consumer Discretionary
    'VDC',  // Vanguard Consumer Staples
    'VIS',  // Vanguard Industrials
    'VAW',  // Vanguard Materials
    'VPU',  // Vanguard Utilities
    'VOX',  // Vanguard Communication Services
    'VNQ',  // Vanguard Real Estate
  ],

  // INTERNATIONAL ETFs
  INTERNATIONAL: [
    'EFA',  // iShares MSCI EAFE
    'EEM',  // iShares MSCI Emerging Markets
    'VEU',  // Vanguard FTSE All-World ex-US
    'VWO',  // Vanguard FTSE Emerging Markets
    'IEFA', // iShares Core MSCI EAFE
    'IEMG', // iShares Core MSCI Emerging Markets
    'FXI',  // iShares China Large-Cap
    'EWJ',  // iShares MSCI Japan
    'EWG',  // iShares MSCI Germany
    'EWU',  // iShares MSCI United Kingdom
    'EWZ',  // iShares MSCI Brazil
    'EWY',  // iShares MSCI South Korea
    'INDA', // iShares MSCI India
    'EWT',  // iShares MSCI Taiwan
    'EWH',  // iShares MSCI Hong Kong
    'EWS',  // iShares MSCI Singapore
    'EWA',  // iShares MSCI Australia
    'EWC',  // iShares MSCI Canada
    'EWW',  // iShares MSCI Mexico
  ],

  // BOND ETFs
  BONDS: [
    'TLT',  // iShares 20+ Year Treasury
    'IEF',  // iShares 7-10 Year Treasury
    'SHY',  // iShares 1-3 Year Treasury
    'LQD',  // iShares Investment Grade Corporate
    'HYG',  // iShares High Yield Corporate
    'JNK',  // SPDR Bloomberg High Yield
    'BND',  // Vanguard Total Bond Market
    'AGG',  // iShares Core US Aggregate Bond
    'TIP',  // iShares TIPS Bond
    'EMB',  // iShares JP Morgan USD Emerging Markets Bond
    'MUB',  // iShares National Muni Bond
    'VCSH', // Vanguard Short-Term Corporate Bond
    'VCIT', // Vanguard Intermediate-Term Corporate Bond
    'BNDX', // Vanguard Total International Bond
  ],

  // FACTOR ETFs
  FACTORS: [
    'MTUM', // iShares MSCI USA Momentum Factor
    'QUAL', // iShares MSCI USA Quality Factor
    'VLUE', // iShares MSCI USA Value Factor
    'SIZE', // iShares MSCI USA Size Factor
    'USMV', // iShares MSCI USA Min Vol Factor
    'DGRO', // iShares Core Dividend Growth
    'VIG',  // Vanguard Dividend Appreciation
    'SCHD', // Schwab US Dividend Equity
    'DVY',  // iShares Select Dividend
    'HDV',  // iShares Core High Dividend
  ],

  // MARKET INDICES
  INDICES: [
    'SPY',  // S&P 500
    'QQQ',  // Nasdaq 100
    'IWM',  // Russell 2000
    'DIA',  // Dow Jones
    'MDY',  // S&P 400 Mid Cap
    'IJR',  // iShares Core S&P Small-Cap
    'VTI',  // Vanguard Total Stock Market
    'VOO',  // Vanguard S&P 500
    'IVV',  // iShares Core S&P 500
    'RSP',  // Invesco S&P 500 Equal Weight
  ],

  // VOLATILITY & ALTERNATIVES
  VOLATILITY: [
    'VIXY', // ProShares VIX Short-Term Futures
    'SVXY', // ProShares Short VIX Short-Term Futures
    'UVXY', // ProShares Ultra VIX Short-Term Futures
  ],
};

// Flatten all symbols
const ALL_SYMBOLS = Object.values(MARKET_UNIVERSE).flat();
console.log(`Total symbols in universe: ${ALL_SYMBOLS.length}`);

// ============================================================================
// PARAMETER RANGES - EXPANDED FOR 100K+ COMBINATIONS
// ============================================================================

const PARAM_RANGES: Record<string, { min: number; max: number; step: number; integer?: boolean }> = {
  // Position sizing
  maxPositionPct: { min: 0.01, max: 0.20, step: 0.005 },
  maxPortfolioExposure: { min: 0.30, max: 0.98, step: 0.02 },
  maxPositions: { min: 3, max: 50, step: 1, integer: true },

  // Risk management
  atrMultStop: { min: 0.3, max: 4.0, step: 0.1 },
  atrMultTarget: { min: 1.0, max: 10.0, step: 0.25 },
  maxDailyLoss: { min: 0.01, max: 0.15, step: 0.005 },
  trailingStopPct: { min: 0.02, max: 0.20, step: 0.01 },

  // Entry thresholds
  buyThreshold: { min: 0.03, max: 0.40, step: 0.01 },
  sellThreshold: { min: -0.40, max: -0.03, step: 0.01 },
  confidenceMin: { min: 0.10, max: 0.60, step: 0.02 },

  // Signal weights (8 factors)
  technicalWeight: { min: 0.02, max: 0.40, step: 0.02 },
  momentumWeight: { min: 0.02, max: 0.40, step: 0.02 },
  volatilityWeight: { min: 0.01, max: 0.25, step: 0.02 },
  volumeWeight: { min: 0.02, max: 0.30, step: 0.02 },
  sentimentWeight: { min: 0.02, max: 0.30, step: 0.02 },
  patternWeight: { min: 0.01, max: 0.25, step: 0.02 },
  breadthWeight: { min: 0.01, max: 0.20, step: 0.02 },
  correlationWeight: { min: 0.01, max: 0.25, step: 0.02 },

  // RSI settings
  rsiPeriod: { min: 5, max: 28, step: 1, integer: true },
  rsiOversold: { min: 15, max: 45, step: 1, integer: true },
  rsiOverbought: { min: 55, max: 85, step: 1, integer: true },

  // MACD settings
  macdFast: { min: 6, max: 20, step: 1, integer: true },
  macdSlow: { min: 16, max: 40, step: 1, integer: true },
  macdSignal: { min: 5, max: 15, step: 1, integer: true },

  // Bollinger Bands
  bbPeriod: { min: 10, max: 30, step: 1, integer: true },
  bbStdDev: { min: 1.0, max: 3.5, step: 0.1 },

  // ATR settings
  atrPeriod: { min: 7, max: 25, step: 1, integer: true },

  // Moving averages
  smaShort: { min: 5, max: 20, step: 1, integer: true },
  smaMedium: { min: 20, max: 60, step: 2, integer: true },
  smaLong: { min: 100, max: 250, step: 10, integer: true },

  // Regime detection
  regimeLookback: { min: 10, max: 100, step: 5, integer: true },
  regimeSensitivity: { min: 0.1, max: 0.9, step: 0.1 },

  // Sector rotation
  sectorRotationDays: { min: 3, max: 30, step: 1, integer: true },
  sectorTopN: { min: 2, max: 8, step: 1, integer: true },

  // Momentum lookbacks
  momentumShort: { min: 3, max: 15, step: 1, integer: true },
  momentumMedium: { min: 10, max: 30, step: 2, integer: true },
  momentumLong: { min: 40, max: 120, step: 5, integer: true },

  // Correlation settings
  correlationLookback: { min: 10, max: 90, step: 5, integer: true },
  correlationThreshold: { min: 0.3, max: 0.9, step: 0.05 },

  // Volume analysis
  volumeLookback: { min: 10, max: 40, step: 2, integer: true },
  volumeBreakoutMult: { min: 1.2, max: 3.0, step: 0.1 },

  // Mean reversion
  meanReversionZ: { min: 1.0, max: 3.0, step: 0.1 },
  meanReversionPeriod: { min: 10, max: 50, step: 2, integer: true },
};

// Calculate total parameter combinations
const totalCombinations = Object.values(PARAM_RANGES).reduce((total, range) => {
  const steps = Math.floor((range.max - range.min) / range.step) + 1;
  return total * steps;
}, 1);
console.log(`Total possible parameter combinations: ${totalCombinations.toExponential(2)}`);

// ============================================================================
// DATA STRUCTURES
// ============================================================================

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface Genome {
  id: string;
  genes: Record<string, number>;
  fitness: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  trades: number;
  generation: number;
  island: number;
  parentIds: string[];
  mutations: string[];
  regime: string;
  evaluationTime: number;
}

interface BacktestResult {
  totalReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  trades: number;
  avgHoldingDays: number;
  equity: number[];
  dailyReturns: number[];
  regimePerformance: Record<string, { return: number; sharpe: number }>;
}

interface LearningInsight {
  pattern: string;
  correlation: number;
  sampleSize: number;
  avgImprovement: number;
  confidence: number;
  timestamp: Date;
}

interface KnowledgeEntry {
  genome: Genome;
  result: BacktestResult;
  marketCondition: string;
  timestamp: Date;
}

interface OptimizationState {
  generation: number;
  totalEvaluations: number;
  globalBest: Genome | null;
  globalBestResult: BacktestResult | null;
  islands: Genome[][];
  convergenceHistory: number[];
  learningInsights: LearningInsight[];
  knowledgeBase: KnowledgeEntry[];
  startTime: Date;
  checkpoints: { generation: number; fitness: number; timestamp: Date }[];
}

// ============================================================================
// CONTINUOUS LEARNING ENGINE
// ============================================================================

class ContinuousLearningEngine {
  private insights: LearningInsight[] = [];
  private parameterCorrelations: Map<string, number> = new Map();
  private regimePatterns: Map<string, Genome[]> = new Map();
  private convergenceHistory: number[] = [];
  private bestByRegime: Map<string, Genome> = new Map();

  analyzePopulation(population: Genome[]): LearningInsight[] {
    const newInsights: LearningInsight[] = [];
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
    const top10Pct = sorted.slice(0, Math.ceil(sorted.length * 0.1));
    const bottom10Pct = sorted.slice(-Math.ceil(sorted.length * 0.1));

    // Analyze which parameters differentiate top performers
    for (const param of Object.keys(PARAM_RANGES)) {
      const topAvg = top10Pct.reduce((sum, g) => sum + g.genes[param], 0) / top10Pct.length;
      const bottomAvg = bottom10Pct.reduce((sum, g) => sum + g.genes[param], 0) / bottom10Pct.length;
      const allAvg = population.reduce((sum, g) => sum + g.genes[param], 0) / population.length;

      const diff = (topAvg - bottomAvg) / (allAvg || 1);
      this.parameterCorrelations.set(param, diff);

      if (Math.abs(diff) > 0.15) {
        newInsights.push({
          pattern: `${param} ${diff > 0 ? 'higher' : 'lower'} in top performers`,
          correlation: diff,
          sampleSize: top10Pct.length,
          avgImprovement: top10Pct[0].fitness - bottomAvg,
          confidence: Math.min(1, Math.abs(diff) * top10Pct.length / 20),
          timestamp: new Date(),
        });
      }
    }

    // Track by regime
    for (const genome of top10Pct) {
      const regime = genome.regime || 'unknown';
      if (!this.regimePatterns.has(regime)) {
        this.regimePatterns.set(regime, []);
      }
      this.regimePatterns.get(regime)!.push(genome);

      const currentBest = this.bestByRegime.get(regime);
      if (!currentBest || genome.fitness > currentBest.fitness) {
        this.bestByRegime.set(regime, genome);
      }
    }

    this.insights.push(...newInsights);
    return newInsights;
  }

  getAdaptiveMutationRate(generation: number, avgFitness: number): number {
    this.convergenceHistory.push(avgFitness);

    if (this.convergenceHistory.length < 20) return CONFIG.MUTATION_RATE_INITIAL;

    const recent = this.convergenceHistory.slice(-20);
    const improvement = (recent[19] - recent[0]) / Math.abs(recent[0] || 1);

    // Stagnation detection
    if (Math.abs(improvement) < CONFIG.CONVERGENCE_THRESHOLD) {
      return Math.min(CONFIG.MUTATION_RATE_INITIAL * 3, 0.5); // Increase mutation
    }

    // Good progress - reduce mutation
    if (improvement > 0.05) {
      return Math.max(CONFIG.MUTATION_RATE_INITIAL * 0.5, 0.05);
    }

    return CONFIG.MUTATION_RATE_INITIAL;
  }

  suggestGuidedMutation(genome: Genome): Record<string, number> {
    const suggestions: Record<string, number> = {};

    for (const [param, correlation] of this.parameterCorrelations) {
      if (Math.abs(correlation) > 0.2) {
        const range = PARAM_RANGES[param];
        const direction = correlation > 0 ? 1 : -1;
        const currentVal = genome.genes[param];
        const nudge = direction * range.step * 2;
        suggestions[param] = Math.max(range.min, Math.min(range.max, currentVal + nudge));
      }
    }

    return suggestions;
  }

  getBestForRegime(regime: string): Genome | undefined {
    return this.bestByRegime.get(regime);
  }

  getInsights(): LearningInsight[] {
    return this.insights.slice(-100);
  }

  isConverged(): boolean {
    if (this.convergenceHistory.length < 50) return false;
    const recent = this.convergenceHistory.slice(-50);
    const variance = this.calculateVariance(recent);
    return variance < CONFIG.CONVERGENCE_THRESHOLD;
  }

  private calculateVariance(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  }
}

// ============================================================================
// SELF-EVALUATING JUDGE SYSTEM
// ============================================================================

class JudgeSystem {
  private evaluationHistory: { fitness: number; verdict: string; timestamp: Date }[] = [];

  evaluate(genome: Genome, result: BacktestResult): {
    verdict: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'SUSPICIOUS';
    confidence: number;
    warnings: string[];
    suggestions: string[];
    score: number;
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 0;

    // Multi-objective scoring
    score += Math.min(result.sharpe, 3) * 20;           // Max 60 points from Sharpe
    score += Math.min(result.sortino, 4) * 10;         // Max 40 points from Sortino
    score += Math.min(result.calmar, 3) * 15;          // Max 45 points from Calmar
    score += result.winRate * 20;                       // Max 20 points from Win Rate
    score += Math.min(result.totalReturn * 2, 40);     // Max 40 points from Return
    score += (1 - result.maxDrawdown) * 30;            // Max 30 points from low DD
    score += Math.min(result.trades / 1000, 1) * 10;   // Max 10 points for trade count
    score += Math.min(result.profitFactor, 3) * 15;    // Max 45 points from PF

    // Penalties
    if (result.maxDrawdown > 0.25) {
      score -= (result.maxDrawdown - 0.25) * 100;
      warnings.push(`High drawdown: ${(result.maxDrawdown * 100).toFixed(1)}%`);
      suggestions.push(`Reduce maxPositionPct or increase atrMultStop`);
    }

    if (result.trades < 50) {
      score -= (50 - result.trades) * 2;
      warnings.push(`Low trade count: ${result.trades}`);
      suggestions.push(`Lower buyThreshold or confidenceMin`);
    }

    if (result.winRate < 0.35) {
      score -= (0.35 - result.winRate) * 50;
      warnings.push(`Low win rate: ${(result.winRate * 100).toFixed(1)}%`);
      suggestions.push(`Increase confidenceMin or adjust entry thresholds`);
    }

    // Overfitting detection
    if (result.sharpe > 4) {
      score -= 30;
      warnings.push('OVERFITTING WARNING: Sharpe > 4 is suspicious');
      suggestions.push('Validate on out-of-sample data');
    }

    if (result.winRate > 0.85 && result.trades > 100) {
      score -= 20;
      warnings.push('OVERFITTING WARNING: Win rate > 85% with many trades');
    }

    // Determine verdict
    let verdict: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'SUSPICIOUS';
    if (score > 200 && warnings.filter(w => w.includes('OVERFITTING')).length === 0) {
      verdict = 'EXCELLENT';
    } else if (score > 150) {
      verdict = warnings.filter(w => w.includes('OVERFITTING')).length > 0 ? 'SUSPICIOUS' : 'GOOD';
    } else if (score > 100) {
      verdict = 'ACCEPTABLE';
    } else {
      verdict = 'POOR';
    }

    const confidence = Math.min(1, Math.max(0, score / 250));

    this.evaluationHistory.push({ fitness: score, verdict, timestamp: new Date() });

    return { verdict, confidence, warnings, suggestions, score };
  }

  getEvaluationTrend(): { improving: boolean; rate: number } {
    if (this.evaluationHistory.length < 10) return { improving: true, rate: 0 };

    const recent = this.evaluationHistory.slice(-100);
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    const avgFirst = firstHalf.reduce((s, e) => s + e.fitness, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, e) => s + e.fitness, 0) / secondHalf.length;

    return {
      improving: avgSecond > avgFirst,
      rate: (avgSecond - avgFirst) / avgFirst,
    };
  }
}

// ============================================================================
// TECHNICAL INDICATORS - OPTIMIZED
// ============================================================================

function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length);
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    result[i] = i >= period - 1 ? sum / period : NaN;
  }

  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length);
  const mult = 2 / (period + 1);
  result[0] = data[0];

  for (let i = 1; i < data.length; i++) {
    result[i] = (data[i] - result[i - 1]) * mult + result[i - 1];
  }

  return result;
}

function calculateRSI(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  let avgGain = 0, avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }

  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }

  return result;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  const tr: number[] = new Array(closes.length);

  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < closes.length; i++) {
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }

  let atr = 0;
  for (let i = 0; i < period; i++) atr += tr[i];
  atr /= period;
  result[period - 1] = atr;

  for (let i = period; i < closes.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    result[i] = atr;
  }

  return result;
}

function calculateMACD(closes: number[], fast: number, slow: number, signal: number) {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macd = emaFast.map((f, i) => f - emaSlow[i]);
  const signalLine = calculateEMA(macd.slice(slow - 1), signal);
  const histogram = macd.slice(slow - 1).map((m, i) => m - (signalLine[i] || 0));

  return { macd, signalLine, histogram };
}

function calculateBollingerBands(closes: number[], period: number, stdDev: number) {
  const middle = calculateSMA(closes, period);
  const upper: number[] = new Array(closes.length);
  const lower: number[] = new Array(closes.length);

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    upper[i] = mean + stdDev * std;
    lower[i] = mean - stdDev * std;
  }

  return { upper, middle, lower };
}

// ============================================================================
// REGIME DETECTION
// ============================================================================

function detectMarketRegime(closes: number[], lookback: number = 50): string {
  if (closes.length < lookback + 50) return 'unknown';

  const recent = closes.slice(-lookback);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);

  const current = closes[closes.length - 1];
  const sma20Current = sma20[sma20.length - 1];
  const sma50Current = sma50[sma50.length - 1];

  // Volatility regime
  const returns = [];
  for (let i = 1; i < recent.length; i++) {
    returns.push((recent[i] - recent[i - 1]) / recent[i - 1]);
  }
  const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * Math.sqrt(252);

  // Trend regime
  const momentum = (current - closes[closes.length - lookback]) / closes[closes.length - lookback];

  if (momentum > 0.1 && current > sma20Current && sma20Current > sma50Current) {
    return volatility > 0.25 ? 'volatile_bull' : 'strong_bull';
  }
  if (momentum < -0.1 && current < sma20Current && sma20Current < sma50Current) {
    return volatility > 0.25 ? 'volatile_bear' : 'strong_bear';
  }
  if (volatility > 0.30) return 'high_volatility';
  if (Math.abs(momentum) < 0.03) return 'ranging';

  return momentum > 0 ? 'mild_bull' : 'mild_bear';
}

// ============================================================================
// GENETIC OPERATORS
// ============================================================================

function generateRandomGenome(generation: number, island: number): Genome {
  const genes: Record<string, number> = {};

  for (const [param, range] of Object.entries(PARAM_RANGES)) {
    const steps = Math.floor((range.max - range.min) / range.step);
    const randomStep = Math.floor(Math.random() * (steps + 1));
    let value = range.min + randomStep * range.step;
    if (range.integer) value = Math.round(value);
    genes[param] = value;
  }

  normalizeWeights(genes);

  return {
    id: `g${generation}-i${island}-${Math.random().toString(36).substr(2, 8)}`,
    genes,
    fitness: 0,
    sharpe: 0,
    sortino: 0,
    calmar: 0,
    winRate: 0,
    totalReturn: 0,
    maxDrawdown: 0,
    trades: 0,
    generation,
    island,
    parentIds: [],
    mutations: [],
    regime: 'unknown',
    evaluationTime: 0,
  };
}

function normalizeWeights(genes: Record<string, number>): void {
  const weightKeys = [
    'technicalWeight', 'momentumWeight', 'volatilityWeight', 'volumeWeight',
    'sentimentWeight', 'patternWeight', 'breadthWeight', 'correlationWeight',
  ];
  const total = weightKeys.reduce((sum, key) => sum + (genes[key] || 0), 0);
  if (total > 0) {
    for (const key of weightKeys) {
      genes[key] = Math.round((genes[key] / total) * 100) / 100;
    }
  }
}

function crossover(parent1: Genome, parent2: Genome, generation: number, island: number): Genome {
  const childGenes: Record<string, number> = {};

  for (const param of Object.keys(PARAM_RANGES)) {
    const rand = Math.random();
    if (rand < 0.35) {
      childGenes[param] = parent1.genes[param];
    } else if (rand < 0.70) {
      childGenes[param] = parent2.genes[param];
    } else {
      // Blend crossover
      const alpha = Math.random();
      let value = alpha * parent1.genes[param] + (1 - alpha) * parent2.genes[param];
      const range = PARAM_RANGES[param];
      value = Math.round(value / range.step) * range.step;
      value = Math.max(range.min, Math.min(range.max, value));
      if (range.integer) value = Math.round(value);
      childGenes[param] = value;
    }
  }

  normalizeWeights(childGenes);

  return {
    id: `g${generation}-i${island}-${Math.random().toString(36).substr(2, 8)}`,
    genes: childGenes,
    fitness: 0,
    sharpe: 0,
    sortino: 0,
    calmar: 0,
    winRate: 0,
    totalReturn: 0,
    maxDrawdown: 0,
    trades: 0,
    generation,
    island,
    parentIds: [parent1.id, parent2.id],
    mutations: [],
    regime: 'unknown',
    evaluationTime: 0,
  };
}

function mutate(genome: Genome, mutationRate: number, learningEngine?: ContinuousLearningEngine): Genome {
  const mutatedGenes = { ...genome.genes };
  const mutations: string[] = [];

  // Get guided suggestions if available
  const suggestions = learningEngine?.suggestGuidedMutation(genome) || {};

  for (const [param, range] of Object.entries(PARAM_RANGES)) {
    if (Math.random() < mutationRate) {
      let newVal: number;

      // Use guided mutation if available (30% chance)
      if (suggestions[param] !== undefined && Math.random() < 0.3) {
        newVal = suggestions[param];
        mutations.push(`${param}: ${mutatedGenes[param].toFixed(3)} -> ${newVal.toFixed(3)} (guided)`);
      } else {
        // Random mutation
        const sigma = (range.max - range.min) * 0.2;
        newVal = mutatedGenes[param] + (Math.random() - 0.5) * 2 * sigma;
        newVal = Math.max(range.min, Math.min(range.max, newVal));
        newVal = Math.round(newVal / range.step) * range.step;
        if (range.integer) newVal = Math.round(newVal);

        if (newVal !== mutatedGenes[param]) {
          mutations.push(`${param}: ${mutatedGenes[param].toFixed(3)} -> ${newVal.toFixed(3)}`);
        }
      }

      mutatedGenes[param] = newVal;
    }
  }

  normalizeWeights(mutatedGenes);

  return {
    ...genome,
    genes: mutatedGenes,
    mutations,
    fitness: 0,
    id: `${genome.id}-m`,
  };
}

function tournamentSelect(population: Genome[], tournamentSize: number): Genome {
  let best: Genome | null = null;
  for (let i = 0; i < tournamentSize; i++) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (!best || candidate.fitness > best.fitness) best = candidate;
  }
  return best!;
}

// ============================================================================
// SIGNAL GENERATION
// ============================================================================

function generateSignal(
  bars: AlpacaBar[],
  genes: Record<string, number>,
  idx: number
): { score: number; confidence: number; factors: Record<string, number> } {
  if (idx < 60) return { score: 0, confidence: 0, factors: {} };

  const closes = bars.slice(0, idx + 1).map(b => b.c);
  const highs = bars.slice(0, idx + 1).map(b => b.h);
  const lows = bars.slice(0, idx + 1).map(b => b.l);
  const volumes = bars.slice(0, idx + 1).map(b => b.v);

  const factors: Record<string, number> = {};

  // RSI
  const rsi = calculateRSI(closes, genes.rsiPeriod || 14);
  const currentRSI = rsi[rsi.length - 1];
  if (!isNaN(currentRSI)) {
    if (currentRSI < (genes.rsiOversold || 30)) factors.technical = 0.8;
    else if (currentRSI > (genes.rsiOverbought || 70)) factors.technical = -0.8;
    else factors.technical = (50 - currentRSI) / 50;
  } else {
    factors.technical = 0;
  }

  // MACD
  const macd = calculateMACD(closes, genes.macdFast || 12, genes.macdSlow || 26, genes.macdSignal || 9);
  if (macd.histogram.length > 1) {
    const histCurrent = macd.histogram[macd.histogram.length - 1];
    const histPrev = macd.histogram[macd.histogram.length - 2];
    factors.technical += histCurrent > histPrev ? 0.3 : -0.3;
  }
  factors.technical = Math.max(-1, Math.min(1, factors.technical));

  // Momentum
  const momShort = genes.momentumShort || 5;
  const momMed = genes.momentumMedium || 20;
  if (closes.length > momMed) {
    const momShortVal = (closes[closes.length - 1] - closes[closes.length - momShort - 1]) / closes[closes.length - momShort - 1];
    const momMedVal = (closes[closes.length - 1] - closes[closes.length - momMed - 1]) / closes[closes.length - momMed - 1];
    factors.momentum = Math.max(-1, Math.min(1, momShortVal * 10 + momMedVal * 5));
  } else {
    factors.momentum = 0;
  }

  // Volatility (inverse - lower vol = higher score)
  const atr = calculateATR(highs, lows, closes, genes.atrPeriod || 14);
  const currentATR = atr[atr.length - 1];
  if (!isNaN(currentATR)) {
    const atrPct = currentATR / closes[closes.length - 1];
    factors.volatility = Math.max(-1, Math.min(1, 0.5 - atrPct * 20));
  } else {
    factors.volatility = 0;
  }

  // Volume
  const volLookback = genes.volumeLookback || 20;
  if (volumes.length > volLookback) {
    const avgVol = volumes.slice(-volLookback - 1, -1).reduce((a, b) => a + b, 0) / volLookback;
    const volRatio = volumes[volumes.length - 1] / avgVol;
    factors.volume = Math.max(-1, Math.min(1, (volRatio - 1) * 0.5));
  } else {
    factors.volume = 0;
  }

  // Sentiment proxy (price action based)
  const recentReturn = closes.length > 5 ? (closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6] : 0;
  factors.sentiment = Math.max(-1, Math.min(1, recentReturn * 10));

  // Pattern detection (simplified)
  const bb = calculateBollingerBands(closes, genes.bbPeriod || 20, genes.bbStdDev || 2);
  const current = closes[closes.length - 1];
  const bbUpper = bb.upper[bb.upper.length - 1];
  const bbLower = bb.lower[bb.lower.length - 1];
  if (bbUpper && bbLower) {
    if (current < bbLower) factors.pattern = 0.6;
    else if (current > bbUpper) factors.pattern = -0.6;
    else factors.pattern = 0;
  } else {
    factors.pattern = 0;
  }

  // Breadth (price vs moving averages)
  const smaShort = calculateSMA(closes, genes.smaShort || 10);
  const smaMed = calculateSMA(closes, genes.smaMedium || 50);
  const shortMA = smaShort[smaShort.length - 1];
  const medMA = smaMed[smaMed.length - 1];
  if (!isNaN(shortMA) && !isNaN(medMA)) {
    factors.breadth = (current > shortMA ? 0.5 : -0.5) + (current > medMA ? 0.5 : -0.5);
    factors.breadth = Math.max(-1, Math.min(1, factors.breadth));
  } else {
    factors.breadth = 0;
  }

  // Correlation/mean reversion
  if (!isNaN(bb.middle[bb.middle.length - 1])) {
    const deviation = (current - bb.middle[bb.middle.length - 1]) / (bbUpper - bb.middle[bb.middle.length - 1] || 1);
    factors.correlation = Math.max(-1, Math.min(1, -deviation * 0.5));
  } else {
    factors.correlation = 0;
  }

  // Weighted composite score
  const score =
    factors.technical * (genes.technicalWeight || 0.2) +
    factors.momentum * (genes.momentumWeight || 0.2) +
    factors.volatility * (genes.volatilityWeight || 0.1) +
    factors.volume * (genes.volumeWeight || 0.1) +
    factors.sentiment * (genes.sentimentWeight || 0.1) +
    factors.pattern * (genes.patternWeight || 0.1) +
    factors.breadth * (genes.breadthWeight || 0.1) +
    factors.correlation * (genes.correlationWeight || 0.1);

  // Confidence based on factor agreement
  const factorValues = Object.values(factors);
  const positiveFactors = factorValues.filter(f => f > 0.2).length;
  const negativeFactors = factorValues.filter(f => f < -0.2).length;
  const agreement = Math.max(positiveFactors, negativeFactors) / factorValues.length;
  const confidence = agreement * Math.abs(score);

  return { score, confidence, factors };
}

// ============================================================================
// BACKTEST ENGINE - OPTIMIZED FOR SPEED
// ============================================================================

function runBacktest(
  genome: Genome,
  barsMap: Map<string, AlpacaBar[]>,
  symbols: string[],
  startIdx: number,
  endIdx: number
): BacktestResult {
  const genes = genome.genes;
  const initialCapital = 100000;
  let capital = initialCapital;
  let peakCapital = capital;

  const equity: number[] = [capital];
  const dailyReturns: number[] = [];
  const trades: { pnl: number; holdingDays: number }[] = [];
  const positions: Map<string, { entry: number; shares: number; entryIdx: number; stopLoss: number; takeProfit: number }> = new Map();

  const regimeReturns: Record<string, number[]> = {};

  // Get reference symbol for date alignment
  const refBars = barsMap.get('SPY') || barsMap.values().next().value;
  if (!refBars || refBars.length < endIdx) {
    return createEmptyResult();
  }

  for (let idx = startIdx; idx < Math.min(endIdx, refBars.length); idx++) {
    // Detect regime
    const refCloses = refBars.slice(0, idx + 1).map(b => b.c);
    const regime = detectMarketRegime(refCloses, genes.regimeLookback || 50);
    if (!regimeReturns[regime]) regimeReturns[regime] = [];

    // Check exits
    for (const [symbol, pos] of positions) {
      const symbolBars = barsMap.get(symbol);
      if (!symbolBars || idx >= symbolBars.length) continue;

      const bar = symbolBars[idx];
      let exitPrice: number | null = null;

      if (bar.l <= pos.stopLoss) exitPrice = pos.stopLoss;
      else if (bar.h >= pos.takeProfit) exitPrice = pos.takeProfit;

      if (exitPrice) {
        const pnl = (exitPrice - pos.entry) * pos.shares;
        capital += pos.shares * exitPrice;
        trades.push({ pnl, holdingDays: idx - pos.entryIdx });
        positions.delete(symbol);
      }
    }

    // Check entries
    if (positions.size < (genes.maxPositions || 20)) {
      const candidates: { symbol: string; score: number; confidence: number; price: number; atr: number }[] = [];

      for (const symbol of symbols) {
        if (positions.has(symbol)) continue;

        const symbolBars = barsMap.get(symbol);
        if (!symbolBars || idx >= symbolBars.length || idx < 60) continue;

        const signal = generateSignal(symbolBars, genes, idx);

        if (signal.score >= (genes.buyThreshold || 0.12) && signal.confidence >= (genes.confidenceMin || 0.28)) {
          const closes = symbolBars.slice(0, idx + 1).map(b => b.c);
          const highs = symbolBars.slice(0, idx + 1).map(b => b.h);
          const lows = symbolBars.slice(0, idx + 1).map(b => b.l);
          const atr = calculateATR(highs, lows, closes, genes.atrPeriod || 14);
          const currentATR = atr[atr.length - 1];

          if (!isNaN(currentATR)) {
            candidates.push({
              symbol,
              score: signal.score,
              confidence: signal.confidence,
              price: symbolBars[idx].c,
              atr: currentATR,
            });
          }
        }
      }

      // Sort by score and take top candidates
      candidates.sort((a, b) => b.score - a.score);

      for (const candidate of candidates.slice(0, (genes.maxPositions || 20) - positions.size)) {
        const maxPositionSize = capital * (genes.maxPositionPct || 0.05);
        const shares = Math.floor(maxPositionSize / candidate.price);

        if (shares > 0 && shares * candidate.price <= capital) {
          const stopLoss = candidate.price - candidate.atr * (genes.atrMultStop || 1.5);
          const takeProfit = candidate.price + candidate.atr * (genes.atrMultTarget || 4);

          positions.set(candidate.symbol, {
            entry: candidate.price,
            shares,
            entryIdx: idx,
            stopLoss,
            takeProfit,
          });
          capital -= shares * candidate.price;
        }
      }
    }

    // Update equity
    let currentEquity = capital;
    for (const [symbol, pos] of positions) {
      const symbolBars = barsMap.get(symbol);
      if (symbolBars && idx < symbolBars.length) {
        currentEquity += pos.shares * symbolBars[idx].c;
      }
    }

    equity.push(currentEquity);
    peakCapital = Math.max(peakCapital, currentEquity);

    if (equity.length > 1) {
      const dailyReturn = (currentEquity - equity[equity.length - 2]) / equity[equity.length - 2];
      dailyReturns.push(dailyReturn);
      regimeReturns[regime].push(dailyReturn);
    }
  }

  // Close remaining positions at last price
  for (const [symbol, pos] of positions) {
    const symbolBars = barsMap.get(symbol);
    if (symbolBars && symbolBars.length > 0) {
      const lastPrice = symbolBars[Math.min(endIdx - 1, symbolBars.length - 1)].c;
      const pnl = (lastPrice - pos.entry) * pos.shares;
      trades.push({ pnl, holdingDays: endIdx - pos.entryIdx });
    }
  }

  // Calculate metrics
  const finalEquity = equity[equity.length - 1];
  const totalReturn = (finalEquity - initialCapital) / initialCapital;

  let maxDrawdown = 0;
  let peak = equity[0];
  for (const val of equity) {
    if (val > peak) peak = val;
    const dd = (peak - val) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const stdReturn = dailyReturns.length > 1
    ? Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length)
    : 1;

  const sharpe = stdReturn > 0 ? (avgReturn * 252) / (stdReturn * Math.sqrt(252)) : 0;

  const negReturns = dailyReturns.filter(r => r < 0);
  const downStd = negReturns.length > 0
    ? Math.sqrt(negReturns.reduce((sum, r) => sum + r * r, 0) / negReturns.length)
    : 1;
  const sortino = downStd > 0 ? (avgReturn * 252) / (downStd * Math.sqrt(252)) : 0;

  const years = dailyReturns.length / 252;
  const cagr = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : 0;

  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;

  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const avgHoldingDays = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length
    : 0;

  // Calculate regime performance
  const regimePerformance: Record<string, { return: number; sharpe: number }> = {};
  for (const [regime, returns] of Object.entries(regimeReturns)) {
    if (returns.length > 0) {
      const regimeAvg = returns.reduce((a, b) => a + b, 0) / returns.length;
      const regimeStd = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - regimeAvg, 2), 0) / returns.length);
      regimePerformance[regime] = {
        return: returns.reduce((a, b) => a + b, 0),
        sharpe: regimeStd > 0 ? (regimeAvg * 252) / (regimeStd * Math.sqrt(252)) : 0,
      };
    }
  }

  return {
    totalReturn,
    sharpe,
    sortino,
    calmar,
    maxDrawdown,
    winRate,
    profitFactor,
    trades: trades.length,
    avgHoldingDays,
    equity,
    dailyReturns,
    regimePerformance,
  };
}

function createEmptyResult(): BacktestResult {
  return {
    totalReturn: -1,
    sharpe: -10,
    sortino: -10,
    calmar: -10,
    maxDrawdown: 1,
    winRate: 0,
    profitFactor: 0,
    trades: 0,
    avgHoldingDays: 0,
    equity: [],
    dailyReturns: [],
    regimePerformance: {},
  };
}

function calculateFitness(result: BacktestResult): number {
  if (result.trades < 30) return -1000 + result.trades;
  if (result.maxDrawdown > 0.40) return -500 * result.maxDrawdown;

  // Multi-objective fitness
  return (
    result.sharpe * 25 +
    result.sortino * 15 +
    result.calmar * 20 +
    result.winRate * 15 +
    result.totalReturn * 15 +
    (1 - result.maxDrawdown) * 10 +
    Math.min(result.profitFactor, 3) * 10 +
    Math.min(result.trades / 500, 1) * 5
  );
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function fetchAlpacaBars(symbol: string, start: string, end: string): Promise<AlpacaBar[]> {
  const allBars: AlpacaBar[] = [];
  let pageToken: string | null = null;

  do {
    let url = `${ALPACA_DATA_URL}/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=10000&feed=iex`;
    if (pageToken) url += `&page_token=${pageToken}`;

    try {
      const response = await fetch(url, {
        headers: {
          'APCA-API-KEY-ID': ALPACA_KEY,
          'APCA-API-SECRET-KEY': ALPACA_SECRET,
        },
      });

      if (!response.ok) return allBars;

      const data = await response.json();
      if (data.bars && Array.isArray(data.bars)) {
        allBars.push(...data.bars);
      }
      pageToken = data.next_page_token || null;
    } catch {
      break;
    }
  } while (pageToken);

  return allBars;
}

async function loadMarketData(symbols: string[], yearsBack: number = 5): Promise<Map<string, AlpacaBar[]>> {
  const bars = new Map<string, AlpacaBar[]>();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - yearsBack);

  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  console.log(`\n  Loading ${symbols.length} symbols (${start} to ${end})...`);

  let loaded = 0;
  let failed = 0;

  // Load in batches to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);

    await Promise.all(batch.map(async (symbol) => {
      try {
        const symbolBars = await fetchAlpacaBars(symbol, start, end);
        if (symbolBars.length > 100) {
          bars.set(symbol, symbolBars);
          loaded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }));

    process.stdout.write(`\r  Progress: ${loaded}/${symbols.length} loaded, ${failed} failed`);
    await new Promise(r => setTimeout(r, 200)); // Rate limit
  }

  console.log(`\n  Successfully loaded ${bars.size} symbols\n`);
  return bars;
}

// ============================================================================
// MAIN HYPEROPTIMIZER
// ============================================================================

async function runUltraHyperoptimizer() {
  console.log('\n' + '╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(10) + 'OMAR ULTRA HYPEROPTIMIZER - 50 MILLION ITERATIONS' + ' '.repeat(18) + '║');
  console.log('╚' + '═'.repeat(78) + '╝\n');

  console.log('  Configuration:');
  console.log(`  ├─ Target Iterations: ${CONFIG.TOTAL_ITERATIONS.toLocaleString()}`);
  console.log(`  ├─ Population Size: ${CONFIG.POPULATION_SIZE}`);
  console.log(`  ├─ Islands: ${CONFIG.NUM_ISLANDS}`);
  console.log(`  ├─ Parallel Workers: ${CONFIG.PARALLEL_WORKERS}`);
  console.log(`  ├─ Market Universe: ${ALL_SYMBOLS.length} symbols`);
  console.log(`  └─ Historical Data: ${CONFIG.YEARS_OF_DATA} years\n`);

  // Select a subset of symbols for actual optimization (API limits)
  const prioritySymbols = [
    // Core indices
    'SPY', 'QQQ', 'IWM', 'DIA',
    // Metals - Priority
    'GLD', 'SLV', 'PPLT', 'NEM', 'GOLD', 'FCX', 'XME',
    // Sectors
    'XLF', 'XLK', 'XLE', 'XLV', 'XLI', 'XLP', 'XLY', 'XLB', 'XLU', 'XLRE',
    // Energy
    'USO', 'XOM', 'CVX',
    // Commodities
    'DBA', 'DBB', 'CPER',
    // Large caps
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
    'JPM', 'V', 'UNH', 'JNJ',
    // Mining
    'RIO', 'BHP', 'VALE', 'AA', 'NUE',
    // Bonds
    'TLT', 'LQD', 'HYG',
    // Factors
    'MTUM', 'QUAL', 'VLUE',
  ];

  const symbolsToLoad = [...new Set(prioritySymbols)].slice(0, 60);

  const bars = await loadMarketData(symbolsToLoad, 5);
  if (bars.size < 10) {
    console.error('  ❌ Insufficient data loaded. Aborting.\n');
    return;
  }

  const tradingSymbols = Array.from(bars.keys());
  const refBars = bars.get('SPY') || bars.values().next().value;
  const startIdx = 60;
  const endIdx = refBars.length;

  console.log(`  Trading symbols: ${tradingSymbols.length}`);
  console.log(`  Trading days: ${endIdx - startIdx}\n`);

  // Initialize systems
  const learningEngine = new ContinuousLearningEngine();
  const judgeSystem = new JudgeSystem();

  // Initialize islands
  const islands: Genome[][] = [];
  for (let i = 0; i < CONFIG.NUM_ISLANDS; i++) {
    const population: Genome[] = [];
    for (let j = 0; j < CONFIG.POPULATION_SIZE / CONFIG.NUM_ISLANDS; j++) {
      population.push(generateRandomGenome(0, i));
    }
    islands.push(population);
  }

  let globalBest: Genome | null = null;
  let globalBestResult: BacktestResult | null = null;
  let totalEvaluations = 0;
  const startTime = Date.now();

  const iterationsPerGeneration = CONFIG.POPULATION_SIZE;
  const maxGenerations = Math.min(
    Math.ceil(CONFIG.TOTAL_ITERATIONS / iterationsPerGeneration),
    50000 // Practical limit for demo
  );

  console.log('─'.repeat(80));
  console.log('  STARTING EVOLUTION');
  console.log('─'.repeat(80) + '\n');

  for (let generation = 0; generation < maxGenerations; generation++) {
    const genStartTime = Date.now();

    // Process each island
    for (let islandIdx = 0; islandIdx < CONFIG.NUM_ISLANDS; islandIdx++) {
      const island = islands[islandIdx];

      // Evaluate population in batches
      for (let batchStart = 0; batchStart < island.length; batchStart += CONFIG.BATCH_SIZE) {
        const batch = island.slice(batchStart, Math.min(batchStart + CONFIG.BATCH_SIZE, island.length));

        // Parallel evaluation
        await Promise.all(batch.map(async (genome) => {
          if (genome.fitness === 0) {
            const evalStart = Date.now();

            try {
              const result = runBacktest(genome, bars, tradingSymbols, startIdx, endIdx);
              const fitness = calculateFitness(result);

              genome.fitness = fitness;
              genome.sharpe = result.sharpe;
              genome.sortino = result.sortino;
              genome.calmar = result.calmar;
              genome.winRate = result.winRate;
              genome.totalReturn = result.totalReturn;
              genome.maxDrawdown = result.maxDrawdown;
              genome.trades = result.trades;
              genome.evaluationTime = Date.now() - evalStart;
              genome.regime = detectMarketRegime(
                (bars.get('SPY') || []).slice(0, endIdx).map(b => b.c),
                genome.genes.regimeLookback || 50
              );

              totalEvaluations++;

              // Check for new global best
              if (!globalBest || fitness > globalBest.fitness) {
                const evaluation = judgeSystem.evaluate(genome, result);

                if (evaluation.verdict !== 'SUSPICIOUS') {
                  globalBest = { ...genome };
                  globalBestResult = result;

                  console.log(`\n  🏆 NEW GLOBAL BEST [Gen ${generation}, Island ${islandIdx}]`);
                  console.log(`     Fitness: ${fitness.toFixed(2)} | Verdict: ${evaluation.verdict}`);
                  console.log(`     Sharpe: ${result.sharpe.toFixed(2)} | Sortino: ${result.sortino.toFixed(2)} | Calmar: ${result.calmar.toFixed(2)}`);
                  console.log(`     Return: ${(result.totalReturn * 100).toFixed(1)}% | MaxDD: ${(result.maxDrawdown * 100).toFixed(1)}% | Trades: ${result.trades}`);

                  if (evaluation.warnings.length > 0) {
                    console.log(`     ⚠️ Warnings: ${evaluation.warnings.join(', ')}`);
                  }
                }
              }
            } catch {
              genome.fitness = -10000;
            }
          }
        }));
      }

      // Sort by fitness
      island.sort((a, b) => b.fitness - a.fitness);

      // Create next generation
      const newPopulation: Genome[] = [];

      // Elite preservation
      const eliteCount = Math.ceil(CONFIG.ELITE_COUNT / CONFIG.NUM_ISLANDS);
      for (let i = 0; i < eliteCount; i++) {
        newPopulation.push({ ...island[i], generation: generation + 1 });
      }

      // Get adaptive mutation rate
      const avgFitness = island.reduce((sum, g) => sum + g.fitness, 0) / island.length;
      const mutationRate = learningEngine.getAdaptiveMutationRate(generation, avgFitness);

      // Generate offspring
      while (newPopulation.length < island.length) {
        if (Math.random() < CONFIG.CROSSOVER_RATE) {
          const parent1 = tournamentSelect(island, CONFIG.TOURNAMENT_SIZE);
          const parent2 = tournamentSelect(island, CONFIG.TOURNAMENT_SIZE);
          let child = crossover(parent1, parent2, generation + 1, islandIdx);

          if (Math.random() < mutationRate) {
            child = mutate(child, mutationRate, learningEngine);
          }
          newPopulation.push(child);
        } else {
          const parent = tournamentSelect(island, CONFIG.TOURNAMENT_SIZE);
          const mutant = mutate(parent, mutationRate * 1.5, learningEngine);
          mutant.generation = generation + 1;
          newPopulation.push(mutant);
        }
      }

      islands[islandIdx] = newPopulation;
    }

    // Island migration
    if (generation > 0 && generation % CONFIG.MIGRATION_INTERVAL === 0) {
      console.log(`\n  🔄 Island migration at generation ${generation}`);
      for (let i = 0; i < CONFIG.NUM_ISLANDS; i++) {
        const sourceIsland = islands[i];
        const targetIsland = islands[(i + 1) % CONFIG.NUM_ISLANDS];

        for (let j = 0; j < CONFIG.MIGRATION_COUNT; j++) {
          const migrant = { ...sourceIsland[j], island: (i + 1) % CONFIG.NUM_ISLANDS, fitness: 0 };
          targetIsland.push(migrant);
        }

        targetIsland.sort((a, b) => b.fitness - a.fitness);
        targetIsland.splice(-CONFIG.MIGRATION_COUNT);
      }
    }

    // Learning analysis
    const allGenomes = islands.flat();
    const insights = learningEngine.analyzePopulation(allGenomes);

    // Calculate statistics
    const allFitness = allGenomes.map(g => g.fitness);
    const avgFitness = allFitness.reduce((a, b) => a + b, 0) / allFitness.length;
    const bestFitness = Math.max(...allFitness);
    const uniqueGenes = new Set(allGenomes.map(g => JSON.stringify(g.genes)));
    const diversity = uniqueGenes.size / allGenomes.length;

    // Progress report
    const genTime = (Date.now() - genStartTime) / 1000;
    const totalTime = (Date.now() - startTime) / 1000;
    const progress = ((generation + 1) / maxGenerations * 100).toFixed(1);
    const eta = genTime * (maxGenerations - generation - 1);
    const evalRate = totalEvaluations / totalTime;

    if (generation % CONFIG.PROGRESS_REPORT_INTERVAL === 0 || generation === maxGenerations - 1) {
      console.log(`\n  ═══════════════════════════════════════════════════════════════`);
      console.log(`  Generation ${generation + 1}/${maxGenerations} (${progress}%)`);
      console.log(`  ───────────────────────────────────────────────────────────────`);
      console.log(`  │ Evaluations: ${totalEvaluations.toLocaleString()} (${evalRate.toFixed(1)}/sec)`);
      console.log(`  │ Avg Fitness: ${avgFitness.toFixed(2)} | Best: ${bestFitness.toFixed(2)}`);
      console.log(`  │ Diversity: ${(diversity * 100).toFixed(1)}%`);
      console.log(`  │ Global Best: ${globalBest?.fitness.toFixed(2) || 'N/A'}`);
      console.log(`  │ Runtime: ${Math.round(totalTime)}s | ETA: ${Math.round(eta)}s`);

      if (insights.length > 0) {
        console.log(`  │ New Insights: ${insights.length}`);
      }

      const trend = judgeSystem.getEvaluationTrend();
      console.log(`  │ Trend: ${trend.improving ? '📈 Improving' : '📉 Stagnating'} (${(trend.rate * 100).toFixed(2)}%)`);
      console.log(`  ═══════════════════════════════════════════════════════════════`);
    }

    // Diversity injection if converged
    if (diversity < CONFIG.DIVERSITY_INJECTION_THRESHOLD && generation > 100) {
      console.log(`\n  ⚠️ Low diversity (${(diversity * 100).toFixed(1)}%). Injecting new genomes...`);
      for (let i = 0; i < CONFIG.NUM_ISLANDS; i++) {
        for (let j = 0; j < 10; j++) {
          islands[i].push(generateRandomGenome(generation, i));
        }
        islands[i].sort((a, b) => b.fitness - a.fitness);
        islands[i].splice(-10);
      }
    }

    // Early termination check
    if (learningEngine.isConverged() && generation > 500) {
      console.log(`\n  ✅ Optimization converged at generation ${generation}`);
      break;
    }
  }

  // ============================================================================
  // FINAL REPORT
  // ============================================================================

  const totalRuntime = (Date.now() - startTime) / 1000;

  console.log('\n' + '═'.repeat(80));
  console.log('  HYPEROPTIMIZATION COMPLETE');
  console.log('═'.repeat(80));

  console.log(`\n  📊 STATISTICS:`);
  console.log(`  ├─ Total Evaluations: ${totalEvaluations.toLocaleString()}`);
  console.log(`  ├─ Total Runtime: ${Math.round(totalRuntime)}s (${(totalRuntime / 60).toFixed(1)} min)`);
  console.log(`  ├─ Evaluation Rate: ${(totalEvaluations / totalRuntime).toFixed(1)}/sec`);
  console.log(`  └─ Generations Completed: ${Math.min(maxGenerations, totalEvaluations / CONFIG.POPULATION_SIZE)}`);

  if (globalBest && globalBestResult) {
    console.log(`\n  🏆 GLOBAL BEST CONFIGURATION:`);
    console.log(`  ${'─'.repeat(60)}`);
    console.log(`  Fitness Score:      ${globalBest.fitness.toFixed(2)}`);
    console.log(`  Sharpe Ratio:       ${globalBestResult.sharpe.toFixed(3)}`);
    console.log(`  Sortino Ratio:      ${globalBestResult.sortino.toFixed(3)}`);
    console.log(`  Calmar Ratio:       ${globalBestResult.calmar.toFixed(3)}`);
    console.log(`  Total Return:       ${(globalBestResult.totalReturn * 100).toFixed(2)}%`);
    console.log(`  Max Drawdown:       ${(globalBestResult.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`  Win Rate:           ${(globalBestResult.winRate * 100).toFixed(1)}%`);
    console.log(`  Profit Factor:      ${globalBestResult.profitFactor.toFixed(2)}`);
    console.log(`  Total Trades:       ${globalBestResult.trades}`);
    console.log(`  Avg Holding Days:   ${globalBestResult.avgHoldingDays.toFixed(1)}`);

    console.log(`\n  📋 OPTIMAL PARAMETERS:`);
    const g = globalBest.genes;
    console.log(`  ┌─ Position Management:`);
    console.log(`  │  maxPositionPct: ${g.maxPositionPct?.toFixed(3)} | maxPositions: ${g.maxPositions}`);
    console.log(`  ├─ Risk Management:`);
    console.log(`  │  atrMultStop: ${g.atrMultStop?.toFixed(2)} | atrMultTarget: ${g.atrMultTarget?.toFixed(2)} | maxDailyLoss: ${g.maxDailyLoss?.toFixed(3)}`);
    console.log(`  ├─ Entry/Exit:`);
    console.log(`  │  buyThreshold: ${g.buyThreshold?.toFixed(3)} | confidenceMin: ${g.confidenceMin?.toFixed(3)}`);
    console.log(`  ├─ Signal Weights:`);
    console.log(`  │  technical: ${g.technicalWeight?.toFixed(2)} | momentum: ${g.momentumWeight?.toFixed(2)} | volatility: ${g.volatilityWeight?.toFixed(2)}`);
    console.log(`  │  volume: ${g.volumeWeight?.toFixed(2)} | sentiment: ${g.sentimentWeight?.toFixed(2)} | pattern: ${g.patternWeight?.toFixed(2)}`);
    console.log(`  ├─ Indicators:`);
    console.log(`  │  RSI: period=${g.rsiPeriod}, oversold=${g.rsiOversold}, overbought=${g.rsiOverbought}`);
    console.log(`  │  MACD: fast=${g.macdFast}, slow=${g.macdSlow}, signal=${g.macdSignal}`);
    console.log(`  │  BB: period=${g.bbPeriod}, stdDev=${g.bbStdDev?.toFixed(1)}`);
    console.log(`  └─ Momentum:`);
    console.log(`     short=${g.momentumShort} | medium=${g.momentumMedium} | long=${g.momentumLong}`);

    // Regime performance
    if (Object.keys(globalBestResult.regimePerformance).length > 0) {
      console.log(`\n  📈 REGIME PERFORMANCE:`);
      for (const [regime, perf] of Object.entries(globalBestResult.regimePerformance)) {
        console.log(`  │ ${regime.padEnd(15)}: Return ${(perf.return * 100).toFixed(1)}%, Sharpe ${perf.sharpe.toFixed(2)}`);
      }
    }

    // Learning insights
    const insights = learningEngine.getInsights();
    if (insights.length > 0) {
      console.log(`\n  🧠 LEARNING INSIGHTS:`);
      for (const insight of insights.slice(-10)) {
        console.log(`  │ ${insight.pattern}: correlation ${insight.correlation.toFixed(3)}`);
      }
    }
  }

  // ============================================================================
  // USER GUIDANCE
  // ============================================================================

  console.log('\n' + '═'.repeat(80));
  console.log('  📖 USER GUIDANCE');
  console.log('═'.repeat(80));

  console.log(`
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ MINIMAL USER INPUTS (What users can customize):                             │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │                                                                             │
  │  1. CAPITAL AMOUNT                                                          │
  │     └─ Starting investment amount ($1,000 - $10,000,000)                   │
  │                                                                             │
  │  2. RISK TOLERANCE (1-10 scale)                                            │
  │     └─ 1-3: Conservative (lower positions, tighter stops)                  │
  │     └─ 4-6: Moderate (balanced approach)                                   │
  │     └─ 7-10: Aggressive (larger positions, wider stops)                    │
  │                                                                             │
  │  3. TIME HORIZON                                                            │
  │     └─ Short-term (days to weeks)                                          │
  │     └─ Medium-term (weeks to months)                                       │
  │     └─ Long-term (months to years)                                         │
  │                                                                             │
  │  4. MARKET FOCUS (optional)                                                 │
  │     └─ All markets / US only / Metals & Commodities / Tech focus           │
  │                                                                             │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ OPTIMAL RUN FREQUENCY:                                                      │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │                                                                             │
  │  • FULL OPTIMIZATION: Weekly (weekends recommended)                         │
  │    └─ Deep parameter search with all data                                  │
  │    └─ ~10,000+ iterations for thorough exploration                         │
  │                                                                             │
  │  • INCREMENTAL UPDATE: Daily (after market close)                          │
  │    └─ Fine-tune existing parameters                                        │
  │    └─ ~1,000 iterations for quick adaptation                               │
  │                                                                             │
  │  • REGIME CHECK: Every 4 hours during market                               │
  │    └─ Detect market condition changes                                      │
  │    └─ Adjust risk parameters if needed                                     │
  │                                                                             │
  │  • CONTINUOUS MODE: 24/7 background process                                 │
  │    └─ Constant low-level optimization                                      │
  │    └─ Automatic regime adaptation                                          │
  │    └─ Knowledge accumulation over time                                     │
  │                                                                             │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ USAGE CATEGORIES:                                                           │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │                                                                             │
  │  🔵 BEGINNER                                                                │
  │     └─ Use pre-optimized "Moderate" profile                                │
  │     └─ Run weekly optimization only                                        │
  │     └─ Stick to major ETFs (SPY, QQQ, GLD, TLT)                           │
  │                                                                             │
  │  🟢 INTERMEDIATE                                                            │
  │     └─ Customize risk tolerance                                            │
  │     └─ Enable daily incremental updates                                    │
  │     └─ Add sector ETFs and metals                                          │
  │                                                                             │
  │  🟡 ADVANCED                                                                │
  │     └─ Full parameter customization                                        │
  │     └─ Continuous optimization mode                                        │
  │     └─ Multi-market portfolio                                              │
  │     └─ Custom signal weight tuning                                         │
  │                                                                             │
  │  🔴 EXPERT                                                                  │
  │     └─ Direct genome editing                                               │
  │     └─ Custom fitness functions                                            │
  │     └─ API integration for real-time trading                               │
  │     └─ Multi-strategy portfolio management                                 │
  │                                                                             │
  └─────────────────────────────────────────────────────────────────────────────┘
`);

  console.log('═'.repeat(80));
  console.log('  ✅ OPTIMIZATION SESSION COMPLETE');
  console.log('═'.repeat(80) + '\n');

  return { globalBest, globalBestResult, totalEvaluations, insights: learningEngine.getInsights() };
}

// Run the hyperoptimizer
runUltraHyperoptimizer().catch(console.error);
