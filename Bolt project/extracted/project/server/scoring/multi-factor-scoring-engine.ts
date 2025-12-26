/**
 * MULTI-FACTOR SCORING ENGINE
 *
 * Unified scoring system that combines multiple data sources into a composite score
 * for trading decision support. Based on algo.md specification.
 *
 * Factor Weights (Total: 100%):
 * - Fundamentals: 20%
 * - Technical: 30%
 * - Sentiment: 20%
 * - Macro: 15%
 * - Micro: 10%
 * - Momentum: 5%
 */

import { log } from "../utils/logger";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FactorScore {
  score: number;       // 0-100 normalized score
  weight: number;      // Factor weight (0-1)
  confidence: number;  // Data confidence (0-1)
  components: Record<string, number>; // Individual component scores
  reasoning: string;   // Human-readable explanation
}

export interface CompositeScore {
  symbol: string;
  totalScore: number;           // 0-100 final score
  signal: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  confidence: number;           // 0-1 overall confidence
  factors: {
    fundamental: FactorScore;
    technical: FactorScore;
    sentiment: FactorScore;
    macro: FactorScore;
    micro: FactorScore;
    momentum: FactorScore;
  };
  timestamp: Date;
  dataQuality: "excellent" | "good" | "fair" | "poor";
}

export interface FundamentalData {
  peRatio?: number;
  pbRatio?: number;
  psRatio?: number;
  pegRatio?: number;
  roe?: number;
  roa?: number;
  debtToEquity?: number;
  currentRatio?: number;
  quickRatio?: number;
  grossMargin?: number;
  operatingMargin?: number;
  netMargin?: number;
  fcfMargin?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  fcfGrowth?: number;
  insiderOwnership?: number;
  insiderBuying?: boolean;
  institutionalOwnership?: number;
  earningsSurprise?: number;
}

export interface TechnicalData {
  price: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  ema12?: number;
  ema26?: number;
  rsi14?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  atr14?: number;
  bollingerUpper?: number;
  bollingerLower?: number;
  adx14?: number;
  volume?: number;
  avgVolume?: number;
  high52Week?: number;
  low52Week?: number;
}

export interface SentimentData {
  overallScore?: number;      // -1 to 1
  newsScore?: number;         // -1 to 1
  socialScore?: number;       // -1 to 1
  analystRating?: number;     // 1-5 (1=strong sell, 5=strong buy)
  analystUpgrades?: number;
  analystDowngrades?: number;
  priceTarget?: number;
  articleCount?: number;
}

export interface MacroData {
  vix?: number;
  spyChange?: number;
  sectorPerformance?: number;
  interestRate?: number;
  inflation?: number;
  unemployment?: number;
  gdpGrowth?: number;
  marketBreadth?: number;     // % of stocks positive
}

export interface MicroData {
  daysToEarnings?: number;
  earningsEstimate?: number;
  recentInsiderTrades?: number;
  insiderNetBuying?: boolean;
  priceVs52WeekHigh?: number; // % from high
  priceVs52WeekLow?: number;  // % from low
  shortInterest?: number;
  daysToCovert?: number;
}

export interface MomentumData {
  priceChange1d?: number;
  priceChange5d?: number;
  priceChange1m?: number;
  priceChange3m?: number;
  priceChange6m?: number;
  priceChange1y?: number;
  relativeStrength?: number;  // vs SPY
  volumeChange?: number;
}

export interface ScoringInput {
  symbol: string;
  fundamental?: FundamentalData;
  technical?: TechnicalData;
  sentiment?: SentimentData;
  macro?: MacroData;
  micro?: MicroData;
  momentum?: MomentumData;
  isCrypto?: boolean;
}

// ============================================================================
// FACTOR WEIGHTS
// ============================================================================

const FACTOR_WEIGHTS = {
  fundamental: 0.20,
  technical: 0.30,
  sentiment: 0.20,
  macro: 0.15,
  micro: 0.10,
  momentum: 0.05,
};

// Crypto-adjusted weights (less fundamental emphasis)
const CRYPTO_FACTOR_WEIGHTS = {
  fundamental: 0.05,
  technical: 0.35,
  sentiment: 0.30,
  macro: 0.10,
  micro: 0.05,
  momentum: 0.15,
};

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate fundamental factor score
 */
function calculateFundamentalScore(data: FundamentalData | undefined): FactorScore {
  const components: Record<string, number> = {};
  let totalScore = 0;
  let weightSum = 0;
  const weights = {
    valuation: 0.30,
    profitability: 0.25,
    growth: 0.20,
    financialHealth: 0.15,
    ownership: 0.10,
  };

  // Valuation (P/E, P/B, P/S, PEG)
  if (data?.peRatio !== undefined) {
    let peScore = 50;
    if (data.peRatio < 0) peScore = 20; // Negative earnings
    else if (data.peRatio < 10) peScore = 90;
    else if (data.peRatio < 15) peScore = 80;
    else if (data.peRatio < 20) peScore = 70;
    else if (data.peRatio < 25) peScore = 60;
    else if (data.peRatio < 35) peScore = 40;
    else if (data.peRatio < 50) peScore = 30;
    else peScore = 20;
    components.peRatio = peScore;
  }

  if (data?.pbRatio !== undefined) {
    let pbScore = 50;
    if (data.pbRatio < 1) pbScore = 85;
    else if (data.pbRatio < 2) pbScore = 75;
    else if (data.pbRatio < 3) pbScore = 65;
    else if (data.pbRatio < 5) pbScore = 50;
    else if (data.pbRatio < 10) pbScore = 35;
    else pbScore = 20;
    components.pbRatio = pbScore;
  }

  if (data?.pegRatio !== undefined) {
    let pegScore = 50;
    if (data.pegRatio < 0) pegScore = 20;
    else if (data.pegRatio < 1) pegScore = 90;
    else if (data.pegRatio < 1.5) pegScore = 75;
    else if (data.pegRatio < 2) pegScore = 60;
    else if (data.pegRatio < 3) pegScore = 40;
    else pegScore = 25;
    components.pegRatio = pegScore;
  }

  // Combine valuation components
  const valuationComponents = ['peRatio', 'pbRatio', 'pegRatio'].filter(k => components[k] !== undefined);
  if (valuationComponents.length > 0) {
    components.valuation = valuationComponents.reduce((sum, k) => sum + components[k], 0) / valuationComponents.length;
    totalScore += components.valuation * weights.valuation;
    weightSum += weights.valuation;
  }

  // Profitability (margins, ROE, ROA)
  const profitabilityScores: number[] = [];

  if (data?.grossMargin !== undefined) {
    let score = normalize(data.grossMargin, 0, 60, 0, 100);
    profitabilityScores.push(score);
    components.grossMargin = score;
  }

  if (data?.operatingMargin !== undefined) {
    let score = normalize(data.operatingMargin, -10, 30, 0, 100);
    profitabilityScores.push(score);
    components.operatingMargin = score;
  }

  if (data?.roe !== undefined) {
    let score = normalize(data.roe, 0, 30, 0, 100);
    profitabilityScores.push(score);
    components.roe = score;
  }

  if (profitabilityScores.length > 0) {
    components.profitability = profitabilityScores.reduce((a, b) => a + b, 0) / profitabilityScores.length;
    totalScore += components.profitability * weights.profitability;
    weightSum += weights.profitability;
  }

  // Growth (revenue, earnings, FCF growth)
  const growthScores: number[] = [];

  if (data?.revenueGrowth !== undefined) {
    let score = normalize(data.revenueGrowth, -10, 40, 0, 100);
    growthScores.push(score);
    components.revenueGrowth = score;
  }

  if (data?.earningsGrowth !== undefined) {
    let score = normalize(data.earningsGrowth, -20, 50, 0, 100);
    growthScores.push(score);
    components.earningsGrowth = score;
  }

  if (growthScores.length > 0) {
    components.growth = growthScores.reduce((a, b) => a + b, 0) / growthScores.length;
    totalScore += components.growth * weights.growth;
    weightSum += weights.growth;
  }

  // Financial Health (debt, liquidity ratios)
  const healthScores: number[] = [];

  if (data?.debtToEquity !== undefined) {
    let score = 50;
    if (data.debtToEquity < 0.3) score = 90;
    else if (data.debtToEquity < 0.5) score = 80;
    else if (data.debtToEquity < 1) score = 70;
    else if (data.debtToEquity < 1.5) score = 55;
    else if (data.debtToEquity < 2) score = 40;
    else score = 25;
    healthScores.push(score);
    components.debtToEquity = score;
  }

  if (data?.currentRatio !== undefined) {
    let score = normalize(data.currentRatio, 0.5, 3, 0, 100);
    healthScores.push(score);
    components.currentRatio = score;
  }

  if (healthScores.length > 0) {
    components.financialHealth = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
    totalScore += components.financialHealth * weights.financialHealth;
    weightSum += weights.financialHealth;
  }

  // Ownership (insider, institutional)
  const ownershipScores: number[] = [];

  if (data?.insiderBuying !== undefined) {
    ownershipScores.push(data.insiderBuying ? 80 : 40);
    components.insiderBuying = data.insiderBuying ? 80 : 40;
  }

  if (data?.institutionalOwnership !== undefined) {
    let score = normalize(data.institutionalOwnership, 20, 80, 0, 100);
    ownershipScores.push(score);
    components.institutionalOwnership = score;
  }

  if (ownershipScores.length > 0) {
    components.ownership = ownershipScores.reduce((a, b) => a + b, 0) / ownershipScores.length;
    totalScore += components.ownership * weights.ownership;
    weightSum += weights.ownership;
  }

  // Calculate final score
  const finalScore = weightSum > 0 ? totalScore / weightSum : 50;
  const confidence = Math.min(weightSum / 0.8, 1); // 80% of weights = full confidence

  return {
    score: Math.round(finalScore),
    weight: FACTOR_WEIGHTS.fundamental,
    confidence,
    components,
    reasoning: generateFundamentalReasoning(components, finalScore),
  };
}

/**
 * Calculate technical factor score
 */
function calculateTechnicalScore(data: TechnicalData | undefined): FactorScore {
  const components: Record<string, number> = {};
  let totalScore = 0;
  let weightSum = 0;
  const weights = {
    trend: 0.30,
    momentum: 0.25,
    volatility: 0.20,
    volume: 0.15,
    pricePosition: 0.10,
  };

  if (!data?.price) {
    return {
      score: 50,
      weight: FACTOR_WEIGHTS.technical,
      confidence: 0,
      components: {},
      reasoning: "Insufficient technical data",
    };
  }

  // Trend Analysis (SMA alignment)
  const trendScores: number[] = [];

  if (data.sma20 && data.sma50 && data.sma200) {
    let trendScore = 50;
    const price = data.price;

    // Golden alignment: price > SMA20 > SMA50 > SMA200
    if (price > data.sma20 && data.sma20 > data.sma50 && data.sma50 > data.sma200) {
      trendScore = 90;
    }
    // Strong uptrend: price > all SMAs
    else if (price > data.sma20 && price > data.sma50 && price > data.sma200) {
      trendScore = 75;
    }
    // Death cross alignment: price < SMA20 < SMA50 < SMA200
    else if (price < data.sma20 && data.sma20 < data.sma50 && data.sma50 < data.sma200) {
      trendScore = 15;
    }
    // Strong downtrend: price < all SMAs
    else if (price < data.sma20 && price < data.sma50 && price < data.sma200) {
      trendScore = 25;
    }
    // Mixed signals
    else {
      trendScore = 50;
    }

    trendScores.push(trendScore);
    components.smaAlignment = trendScore;
  }

  if (data.adx14) {
    let adxScore = 50;
    if (data.adx14 > 40) adxScore = 80; // Strong trend
    else if (data.adx14 > 25) adxScore = 65; // Moderate trend
    else if (data.adx14 > 20) adxScore = 50; // Weak trend
    else adxScore = 35; // No trend / choppy
    trendScores.push(adxScore);
    components.adx = adxScore;
  }

  if (trendScores.length > 0) {
    components.trend = trendScores.reduce((a, b) => a + b, 0) / trendScores.length;
    totalScore += components.trend * weights.trend;
    weightSum += weights.trend;
  }

  // Momentum (RSI, MACD)
  const momentumScores: number[] = [];

  if (data.rsi14 !== undefined) {
    let rsiScore = 50;
    if (data.rsi14 > 80) rsiScore = 20;      // Extremely overbought
    else if (data.rsi14 > 70) rsiScore = 35; // Overbought
    else if (data.rsi14 > 60) rsiScore = 55; // Slightly bullish
    else if (data.rsi14 > 50) rsiScore = 65; // Neutral bullish
    else if (data.rsi14 > 40) rsiScore = 60; // Neutral
    else if (data.rsi14 > 30) rsiScore = 70; // Slightly oversold (buy zone)
    else if (data.rsi14 > 20) rsiScore = 80; // Oversold (strong buy zone)
    else rsiScore = 85;                       // Extremely oversold
    momentumScores.push(rsiScore);
    components.rsi = rsiScore;
  }

  if (data.macd !== undefined && data.macdSignal !== undefined) {
    let macdScore = 50;
    const macdDiff = data.macd - data.macdSignal;

    if (macdDiff > 0 && data.macdHistogram && data.macdHistogram > 0) {
      macdScore = 75; // Bullish momentum increasing
    } else if (macdDiff > 0) {
      macdScore = 65; // Bullish but slowing
    } else if (macdDiff < 0 && data.macdHistogram && data.macdHistogram < 0) {
      macdScore = 25; // Bearish momentum increasing
    } else if (macdDiff < 0) {
      macdScore = 35; // Bearish but improving
    }

    momentumScores.push(macdScore);
    components.macd = macdScore;
  }

  if (momentumScores.length > 0) {
    components.momentum = momentumScores.reduce((a, b) => a + b, 0) / momentumScores.length;
    totalScore += components.momentum * weights.momentum;
    weightSum += weights.momentum;
  }

  // Volatility (Bollinger Bands, ATR)
  if (data.bollingerUpper && data.bollingerLower && data.price) {
    const bbWidth = (data.bollingerUpper - data.bollingerLower) / data.price;
    const pricePosition = (data.price - data.bollingerLower) / (data.bollingerUpper - data.bollingerLower);

    let volScore = 50;
    // Price near lower band = potential buy
    if (pricePosition < 0.2) volScore = 75;
    // Price near upper band = potential sell
    else if (pricePosition > 0.8) volScore = 30;
    else volScore = 55;

    components.bollinger = volScore;
    components.volatility = volScore;
    totalScore += volScore * weights.volatility;
    weightSum += weights.volatility;
  }

  // Volume Analysis
  if (data.volume && data.avgVolume && data.avgVolume > 0) {
    const volumeRatio = data.volume / data.avgVolume;
    let volScore = 50;

    if (volumeRatio > 2) volScore = 80;      // Very high volume (strong interest)
    else if (volumeRatio > 1.5) volScore = 70;
    else if (volumeRatio > 1) volScore = 60;
    else if (volumeRatio > 0.7) volScore = 50;
    else volScore = 35; // Low volume (weak interest)

    components.volume = volScore;
    totalScore += volScore * weights.volume;
    weightSum += weights.volume;
  }

  // Price Position (52-week range)
  if (data.high52Week && data.low52Week && data.price) {
    const range = data.high52Week - data.low52Week;
    const position = (data.price - data.low52Week) / range;

    let posScore = 50;
    // Near 52-week low = potential value (but check trend)
    if (position < 0.2) posScore = 65; // Near bottom
    else if (position < 0.4) posScore = 60;
    else if (position < 0.6) posScore = 55;
    else if (position < 0.8) posScore = 50;
    else posScore = 40; // Near highs - less upside

    components.pricePosition = posScore;
    totalScore += posScore * weights.pricePosition;
    weightSum += weights.pricePosition;
  }

  const finalScore = weightSum > 0 ? totalScore / weightSum : 50;
  const confidence = Math.min(weightSum / 0.8, 1);

  return {
    score: Math.round(finalScore),
    weight: FACTOR_WEIGHTS.technical,
    confidence,
    components,
    reasoning: generateTechnicalReasoning(components, data, finalScore),
  };
}

/**
 * Calculate sentiment factor score
 */
function calculateSentimentScore(data: SentimentData | undefined): FactorScore {
  const components: Record<string, number> = {};
  let totalScore = 0;
  let weightSum = 0;
  const weights = {
    news: 0.35,
    social: 0.20,
    analyst: 0.30,
    priceTarget: 0.15,
  };

  // News Sentiment
  if (data?.newsScore !== undefined) {
    const newsScore = normalize(data.newsScore, -1, 1, 0, 100);
    components.news = newsScore;
    totalScore += newsScore * weights.news;
    weightSum += weights.news;
  } else if (data?.overallScore !== undefined) {
    const newsScore = normalize(data.overallScore, -1, 1, 0, 100);
    components.news = newsScore;
    totalScore += newsScore * weights.news;
    weightSum += weights.news;
  }

  // Social Sentiment
  if (data?.socialScore !== undefined) {
    const socialScore = normalize(data.socialScore, -1, 1, 0, 100);
    components.social = socialScore;
    totalScore += socialScore * weights.social;
    weightSum += weights.social;
  }

  // Analyst Rating
  if (data?.analystRating !== undefined) {
    const analystScore = normalize(data.analystRating, 1, 5, 0, 100);
    components.analyst = analystScore;
    totalScore += analystScore * weights.analyst;
    weightSum += weights.analyst;

    // Bonus/penalty for recent changes
    if (data.analystUpgrades !== undefined && data.analystDowngrades !== undefined) {
      const netUpgrades = data.analystUpgrades - data.analystDowngrades;
      if (netUpgrades > 0) components.analyst = Math.min(100, components.analyst + 10);
      else if (netUpgrades < 0) components.analyst = Math.max(0, components.analyst - 10);
    }
  }

  // Price Target Analysis
  if (data?.priceTarget !== undefined && data.priceTarget > 0) {
    // This would need current price - mark as available
    components.priceTarget = 50; // Neutral if we don't have current price
    // In practice: (priceTarget / currentPrice - 1) * 100 capped
  }

  const finalScore = weightSum > 0 ? totalScore / weightSum : 50;
  const confidence = Math.min(weightSum / 0.7, 1);

  return {
    score: Math.round(finalScore),
    weight: FACTOR_WEIGHTS.sentiment,
    confidence,
    components,
    reasoning: generateSentimentReasoning(components, finalScore),
  };
}

/**
 * Calculate macro factor score
 */
function calculateMacroScore(data: MacroData | undefined): FactorScore {
  const components: Record<string, number> = {};
  let totalScore = 0;
  let weightSum = 0;
  const weights = {
    volatility: 0.30,
    marketTrend: 0.30,
    breadth: 0.20,
    economic: 0.20,
  };

  // VIX / Volatility Regime
  if (data?.vix !== undefined) {
    let vixScore = 50;
    if (data.vix < 15) vixScore = 80;       // Low fear = bullish
    else if (data.vix < 20) vixScore = 65;  // Normal
    else if (data.vix < 25) vixScore = 50;  // Elevated
    else if (data.vix < 30) vixScore = 35;  // High fear
    else if (data.vix < 40) vixScore = 25;  // Very high
    else vixScore = 15;                      // Extreme fear

    components.vix = vixScore;
    totalScore += vixScore * weights.volatility;
    weightSum += weights.volatility;
  }

  // Market Trend (SPY performance)
  if (data?.spyChange !== undefined) {
    const trendScore = normalize(data.spyChange, -3, 3, 0, 100);
    components.marketTrend = trendScore;
    totalScore += trendScore * weights.marketTrend;
    weightSum += weights.marketTrend;
  }

  // Market Breadth
  if (data?.marketBreadth !== undefined) {
    const breadthScore = normalize(data.marketBreadth, 30, 70, 0, 100);
    components.breadth = breadthScore;
    totalScore += breadthScore * weights.breadth;
    weightSum += weights.breadth;
  }

  // Economic Indicators (simplified)
  const econScores: number[] = [];

  if (data?.gdpGrowth !== undefined) {
    econScores.push(normalize(data.gdpGrowth, -2, 5, 0, 100));
  }

  if (data?.unemployment !== undefined) {
    econScores.push(normalize(data.unemployment, 8, 3, 0, 100)); // Inverted: lower is better
  }

  if (econScores.length > 0) {
    components.economic = econScores.reduce((a, b) => a + b, 0) / econScores.length;
    totalScore += components.economic * weights.economic;
    weightSum += weights.economic;
  }

  const finalScore = weightSum > 0 ? totalScore / weightSum : 50;
  const confidence = Math.min(weightSum / 0.6, 1);

  return {
    score: Math.round(finalScore),
    weight: FACTOR_WEIGHTS.macro,
    confidence,
    components,
    reasoning: generateMacroReasoning(components, finalScore),
  };
}

/**
 * Calculate micro factor score (company-specific catalysts)
 */
function calculateMicroScore(data: MicroData | undefined): FactorScore {
  const components: Record<string, number> = {};
  let totalScore = 0;
  let weightSum = 0;
  const weights = {
    earnings: 0.35,
    insider: 0.30,
    priceRange: 0.20,
    shortInterest: 0.15,
  };

  // Earnings Catalyst
  if (data?.daysToEarnings !== undefined) {
    let earningsScore = 50;
    // Earnings coming up - could be catalyst
    if (data.daysToEarnings <= 7) earningsScore = 70;
    else if (data.daysToEarnings <= 14) earningsScore = 60;
    else if (data.daysToEarnings <= 30) earningsScore = 55;
    else earningsScore = 50;

    components.earnings = earningsScore;
    totalScore += earningsScore * weights.earnings;
    weightSum += weights.earnings;
  }

  // Insider Activity
  if (data?.insiderNetBuying !== undefined) {
    const insiderScore = data.insiderNetBuying ? 75 : 35;
    components.insider = insiderScore;
    totalScore += insiderScore * weights.insider;
    weightSum += weights.insider;
  }

  // Price vs 52-Week Range
  if (data?.priceVs52WeekHigh !== undefined && data?.priceVs52WeekLow !== undefined) {
    const fromHigh = Math.abs(data.priceVs52WeekHigh);
    const fromLow = data.priceVs52WeekLow;

    let rangeScore = 50;
    // Good: Far from highs but recovered from lows
    if (fromHigh > 20 && fromLow > 20) rangeScore = 65; // Room to run
    else if (fromHigh < 5) rangeScore = 40; // Near highs - limited upside
    else if (fromLow < 10) rangeScore = 55; // Near lows - risky but could be value

    components.priceRange = rangeScore;
    totalScore += rangeScore * weights.priceRange;
    weightSum += weights.priceRange;
  }

  // Short Interest
  if (data?.shortInterest !== undefined) {
    let shortScore = 50;
    // High short interest = potential squeeze but also bearish sentiment
    if (data.shortInterest > 30) shortScore = 60; // Squeeze potential
    else if (data.shortInterest > 20) shortScore = 55;
    else if (data.shortInterest > 10) shortScore = 50;
    else if (data.shortInterest > 5) shortScore = 55;
    else shortScore = 60; // Low short = less bearish bets

    components.shortInterest = shortScore;
    totalScore += shortScore * weights.shortInterest;
    weightSum += weights.shortInterest;
  }

  const finalScore = weightSum > 0 ? totalScore / weightSum : 50;
  const confidence = Math.min(weightSum / 0.5, 1);

  return {
    score: Math.round(finalScore),
    weight: FACTOR_WEIGHTS.micro,
    confidence,
    components,
    reasoning: generateMicroReasoning(components, finalScore),
  };
}

/**
 * Calculate momentum factor score
 */
function calculateMomentumScore(data: MomentumData | undefined): FactorScore {
  const components: Record<string, number> = {};
  let totalScore = 0;
  let weightSum = 0;
  const weights = {
    shortTerm: 0.30,
    mediumTerm: 0.40,
    longTerm: 0.20,
    relativeStrength: 0.10,
  };

  // Short-term momentum (1-5 days)
  const shortTermChanges: number[] = [];
  if (data?.priceChange1d !== undefined) shortTermChanges.push(data.priceChange1d);
  if (data?.priceChange5d !== undefined) shortTermChanges.push(data.priceChange5d);

  if (shortTermChanges.length > 0) {
    const avgShort = shortTermChanges.reduce((a, b) => a + b, 0) / shortTermChanges.length;
    const shortScore = normalize(avgShort, -5, 5, 0, 100);
    components.shortTerm = shortScore;
    totalScore += shortScore * weights.shortTerm;
    weightSum += weights.shortTerm;
  }

  // Medium-term momentum (1-3 months)
  const medTermChanges: number[] = [];
  if (data?.priceChange1m !== undefined) medTermChanges.push(data.priceChange1m);
  if (data?.priceChange3m !== undefined) medTermChanges.push(data.priceChange3m);

  if (medTermChanges.length > 0) {
    const avgMed = medTermChanges.reduce((a, b) => a + b, 0) / medTermChanges.length;
    const medScore = normalize(avgMed, -15, 25, 0, 100);
    components.mediumTerm = medScore;
    totalScore += medScore * weights.mediumTerm;
    weightSum += weights.mediumTerm;
  }

  // Long-term momentum (6-12 months)
  const longTermChanges: number[] = [];
  if (data?.priceChange6m !== undefined) longTermChanges.push(data.priceChange6m);
  if (data?.priceChange1y !== undefined) longTermChanges.push(data.priceChange1y);

  if (longTermChanges.length > 0) {
    const avgLong = longTermChanges.reduce((a, b) => a + b, 0) / longTermChanges.length;
    const longScore = normalize(avgLong, -30, 50, 0, 100);
    components.longTerm = longScore;
    totalScore += longScore * weights.longTerm;
    weightSum += weights.longTerm;
  }

  // Relative Strength (vs market)
  if (data?.relativeStrength !== undefined) {
    const rsScore = normalize(data.relativeStrength, -20, 20, 0, 100);
    components.relativeStrength = rsScore;
    totalScore += rsScore * weights.relativeStrength;
    weightSum += weights.relativeStrength;
  }

  const finalScore = weightSum > 0 ? totalScore / weightSum : 50;
  const confidence = Math.min(weightSum / 0.7, 1);

  return {
    score: Math.round(finalScore),
    weight: FACTOR_WEIGHTS.momentum,
    confidence,
    components,
    reasoning: generateMomentumReasoning(components, finalScore),
  };
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate composite multi-factor score for a symbol
 */
export function calculateCompositeScore(input: ScoringInput): CompositeScore {
  const weights = input.isCrypto ? CRYPTO_FACTOR_WEIGHTS : FACTOR_WEIGHTS;

  // Calculate individual factor scores
  const factors = {
    fundamental: calculateFundamentalScore(input.fundamental),
    technical: calculateTechnicalScore(input.technical),
    sentiment: calculateSentimentScore(input.sentiment),
    macro: calculateMacroScore(input.macro),
    micro: calculateMicroScore(input.micro),
    momentum: calculateMomentumScore(input.momentum),
  };

  // Apply weights
  factors.fundamental.weight = weights.fundamental;
  factors.technical.weight = weights.technical;
  factors.sentiment.weight = weights.sentiment;
  factors.macro.weight = weights.macro;
  factors.micro.weight = weights.micro;
  factors.momentum.weight = weights.momentum;

  // Calculate weighted total score
  let weightedSum = 0;
  let totalWeight = 0;
  let weightedConfidence = 0;

  for (const [name, factor] of Object.entries(factors)) {
    const effectiveWeight = factor.weight * factor.confidence;
    weightedSum += factor.score * effectiveWeight;
    totalWeight += effectiveWeight;
    weightedConfidence += factor.confidence * factor.weight;
  }

  const totalScore = totalWeight > 0 ? weightedSum / totalWeight : 50;
  const confidence = weightedConfidence;

  // Determine signal based on score
  let signal: CompositeScore["signal"];
  if (totalScore >= 75) signal = "strong_buy";
  else if (totalScore >= 60) signal = "buy";
  else if (totalScore >= 40) signal = "hold";
  else if (totalScore >= 25) signal = "sell";
  else signal = "strong_sell";

  // Determine data quality
  let dataQuality: CompositeScore["dataQuality"];
  const avgConfidence = Object.values(factors).reduce((sum, f) => sum + f.confidence, 0) / 6;
  if (avgConfidence >= 0.8) dataQuality = "excellent";
  else if (avgConfidence >= 0.6) dataQuality = "good";
  else if (avgConfidence >= 0.4) dataQuality = "fair";
  else dataQuality = "poor";

  const result: CompositeScore = {
    symbol: input.symbol,
    totalScore: Math.round(totalScore),
    signal,
    confidence,
    factors,
    timestamp: new Date(),
    dataQuality,
  };

  log.debug("MultiFactorScoring", `Composite score for ${input.symbol}: ${result.totalScore} (${result.signal})`, {
    symbol: input.symbol,
    score: result.totalScore,
    signal: result.signal,
    confidence: result.confidence.toFixed(2),
    dataQuality: result.dataQuality,
  });

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize a value from one range to another
 */
function normalize(value: number, minIn: number, maxIn: number, minOut: number, maxOut: number): number {
  const normalized = (value - minIn) / (maxIn - minIn);
  const clamped = Math.max(0, Math.min(1, normalized));
  return minOut + clamped * (maxOut - minOut);
}

function generateFundamentalReasoning(components: Record<string, number>, score: number): string {
  const parts: string[] = [];

  if (components.valuation !== undefined) {
    if (components.valuation > 70) parts.push("attractively valued");
    else if (components.valuation < 40) parts.push("expensive valuation");
  }

  if (components.profitability !== undefined) {
    if (components.profitability > 70) parts.push("strong profitability");
    else if (components.profitability < 40) parts.push("weak margins");
  }

  if (components.growth !== undefined) {
    if (components.growth > 70) parts.push("high growth");
    else if (components.growth < 40) parts.push("slow growth");
  }

  if (parts.length === 0) return `Fundamental score: ${score}`;
  return parts.join(", ");
}

function generateTechnicalReasoning(components: Record<string, number>, data: TechnicalData | undefined, score: number): string {
  const parts: string[] = [];

  if (components.trend !== undefined) {
    if (components.trend > 70) parts.push("strong uptrend");
    else if (components.trend < 40) parts.push("downtrend");
  }

  if (components.rsi !== undefined && data?.rsi14 !== undefined) {
    if (data.rsi14 > 70) parts.push("overbought");
    else if (data.rsi14 < 30) parts.push("oversold");
  }

  if (components.macd !== undefined) {
    if (components.macd > 65) parts.push("bullish MACD");
    else if (components.macd < 35) parts.push("bearish MACD");
  }

  if (parts.length === 0) return `Technical score: ${score}`;
  return parts.join(", ");
}

function generateSentimentReasoning(components: Record<string, number>, score: number): string {
  const parts: string[] = [];

  if (components.news !== undefined) {
    if (components.news > 70) parts.push("positive news sentiment");
    else if (components.news < 40) parts.push("negative news");
  }

  if (components.analyst !== undefined) {
    if (components.analyst > 70) parts.push("bullish analyst ratings");
    else if (components.analyst < 40) parts.push("bearish analyst outlook");
  }

  if (parts.length === 0) return `Sentiment score: ${score}`;
  return parts.join(", ");
}

function generateMacroReasoning(components: Record<string, number>, score: number): string {
  const parts: string[] = [];

  if (components.vix !== undefined) {
    if (components.vix > 70) parts.push("low volatility environment");
    else if (components.vix < 40) parts.push("high market fear");
  }

  if (components.marketTrend !== undefined) {
    if (components.marketTrend > 70) parts.push("strong market");
    else if (components.marketTrend < 40) parts.push("weak market");
  }

  if (parts.length === 0) return `Macro score: ${score}`;
  return parts.join(", ");
}

function generateMicroReasoning(components: Record<string, number>, score: number): string {
  const parts: string[] = [];

  if (components.earnings !== undefined && components.earnings > 60) {
    parts.push("earnings catalyst approaching");
  }

  if (components.insider !== undefined) {
    if (components.insider > 65) parts.push("insider buying");
    else if (components.insider < 40) parts.push("insider selling");
  }

  if (parts.length === 0) return `Micro score: ${score}`;
  return parts.join(", ");
}

function generateMomentumReasoning(components: Record<string, number>, score: number): string {
  const parts: string[] = [];

  if (components.shortTerm !== undefined) {
    if (components.shortTerm > 70) parts.push("short-term momentum positive");
    else if (components.shortTerm < 40) parts.push("short-term weakness");
  }

  if (components.mediumTerm !== undefined) {
    if (components.mediumTerm > 70) parts.push("strong medium-term trend");
    else if (components.mediumTerm < 40) parts.push("medium-term downtrend");
  }

  if (parts.length === 0) return `Momentum score: ${score}`;
  return parts.join(", ");
}

// ============================================================================
// BATCH SCORING
// ============================================================================

/**
 * Calculate scores for multiple symbols in batch
 */
export async function calculateBatchScores(inputs: ScoringInput[]): Promise<CompositeScore[]> {
  return inputs.map(input => calculateCompositeScore(input));
}

/**
 * Get top N candidates by score
 */
export function getTopCandidates(scores: CompositeScore[], n: number, minScore: number = 55): CompositeScore[] {
  return scores
    .filter(s => s.totalScore >= minScore && s.dataQuality !== "poor")
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, n);
}

/**
 * Filter candidates by signal type
 */
export function filterBySignal(
  scores: CompositeScore[],
  signals: CompositeScore["signal"][]
): CompositeScore[] {
  return scores.filter(s => signals.includes(s.signal));
}

// Export for use in other modules
export default {
  calculateCompositeScore,
  calculateBatchScores,
  getTopCandidates,
  filterBySignal,
};
