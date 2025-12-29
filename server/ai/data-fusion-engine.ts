/**
 * Data Fusion Engine - Combine multiple data sources into unified market intelligence
 *
 * Fuses data from:
 * - Market data (Alpaca, Finnhub, CoinGecko, Frankfurter forex)
 * - News and sentiment (NewsAPI, Hugging Face FinBERT, GDELT)
 * - Fundamentals (Valyu.ai, SEC EDGAR, Finnhub metrics)
 * - Short interest (FINRA RegSHO)
 * - Insider activity (SEC EDGAR Form 4)
 * - Macro indicators (FRED)
 *
 * Handles:
 * - Contradicting signals between sources
 * - Missing data graceful degradation
 * - Confidence scoring based on source reliability
 * - Caching and freshness tracking
 *
 * @see docs/AI_MODELS_AND_PROVIDERS.md
 */

import { log } from "../utils/logger";
import { mean, variance, stdDev } from "../utils/money";

export interface MarketDataPoint {
  source: string;
  symbol: string;
  price?: number;
  priceChange?: number;
  priceChangePercent?: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  timestamp: Date;
  reliability: number;
}

export interface SentimentDataPoint {
  source: string;
  symbol?: string;
  sentiment: "positive" | "negative" | "neutral";
  score: number;
  confidence: number;
  headlines?: string[];
  timestamp: Date;
}

export interface FundamentalDataPoint {
  source: string;
  symbol: string;
  eps?: number;
  peRatio?: number;
  pbRatio?: number;
  roe?: number;
  roa?: number;
  revenue?: number;
  revenueGrowth?: number;
  debtToEquity?: number;
  currentRatio?: number;
  freeCashFlow?: number;
  dividendYield?: number;
  grossMargin?: number;
  netProfitMargin?: number;
  beta?: number;
  epsGrowth?: number;
  weekHigh52?: number;
  weekLow52?: number;
  insiderSentiment?: "bullish" | "bearish" | "neutral";
  insiderBuyValue?: number;
  insiderSellValue?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  operatingMargin?: number;
  timestamp: Date;
}

export interface TechnicalDataPoint {
  source: string;
  symbol: string;
  signal: "buy" | "neutral" | "sell";
  buyCount?: number;
  sellCount?: number;
  neutralCount?: number;
  adx?: number;
  isTrending?: boolean;
  support?: number;
  resistance?: number;
  volatility?: number;
  trend?: "bullish" | "bearish" | "neutral";
  timestamp: Date;
}

export interface ShortInterestDataPoint {
  source: string;
  symbol: string;
  shortRatio: number; // Short volume / Total volume
  shortVolume: number;
  totalVolume: number;
  daysToCover?: number;
  shortRatioTrend: "increasing" | "decreasing" | "stable";
  shortSqueezePotential: "high" | "medium" | "low";
  timestamp: Date;
}

export interface ForexDataPoint {
  source: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  change: number;
  changePercent: number;
  high30d?: number;
  low30d?: number;
  trend: "bullish" | "bearish" | "neutral";
  timestamp: Date;
}

export interface MacroDataPoint {
  source: string;
  indicator: string;
  category: string;
  value: number;
  previousValue?: number;
  changePercent?: number;
  impact: "high" | "medium" | "low";
  timestamp: Date;
}

export interface FusedMarketIntelligence {
  symbol: string;
  assetType: "stock" | "crypto" | "unknown";
  
  price: {
    current: number;
    change: number;
    changePercent: number;
    confidence: number;
    sources: string[];
  };

  sentiment: {
    overall: "bullish" | "bearish" | "neutral";
    score: number;
    confidence: number;
    agreementLevel: number;
    sources: string[];
  };

  fundamentals?: {
    eps?: number;
    peRatio?: number;
    pbRatio?: number;
    roe?: number;
    roa?: number;
    revenueGrowth?: number;
    freeCashFlow?: number;
    dividendYield?: number;
    debtToEquity?: number;
    currentRatio?: number;
    grossMargin?: number;
    netProfitMargin?: number;
    beta?: number;
    epsGrowth?: number;
    weekHigh52?: number;
    weekLow52?: number;
    insiderSentiment?: "bullish" | "bearish" | "neutral";
    confidence: number;
    sources: string[];
  };

  technicals?: {
    signal: "buy" | "neutral" | "sell";
    buyCount: number;
    sellCount: number;
    neutralCount: number;
    adx?: number;
    isTrending: boolean;
    support?: number;
    resistance?: number;
    volatility?: number;
    trend: "bullish" | "bearish" | "neutral";
    confidence: number;
    sources: string[];
  };

  shortInterest?: {
    shortRatio: number;
    daysToCover?: number;
    trend: "increasing" | "decreasing" | "stable";
    squeezePotential: "high" | "medium" | "low";
    confidence: number;
    sources: string[];
  };

  macro?: {
    vix?: number;
    fedFundsRate?: number;
    yieldCurve?: number;
    inflation?: number;
    unemployment?: number;
    marketRegime: "risk_on" | "risk_off" | "neutral";
    confidence: number;
    sources: string[];
  };

  trendStrength: number;
  volatilityIndicator: number;
  signalAgreement: number;
  
  dataQuality: {
    completeness: number;
    freshness: number;
    reliability: number;
  };

  warnings: string[];
  timestamp: Date;
}

export interface FusionInput {
  symbol: string;
  assetType?: "stock" | "crypto";
  marketData?: MarketDataPoint[];
  sentimentData?: SentimentDataPoint[];
  fundamentalData?: FundamentalDataPoint[];
  technicalData?: TechnicalDataPoint[];
  shortInterestData?: ShortInterestDataPoint[];
  macroData?: MacroDataPoint[];
}

const SOURCE_RELIABILITY: Record<string, number> = {
  // Primary market data sources
  alpaca: 0.95,
  finnhub: 0.90,
  coingecko: 0.85,
  coinmarketcap: 0.85,
  twelvedata: 0.85,

  // Fundamental data sources
  valyu: 0.90,
  "sec-edgar": 0.95, // Official SEC filings - highest reliability
  secedgar: 0.95,

  // Short interest data
  finra: 0.90, // Official FINRA RegSHO data

  // Forex data
  frankfurter: 0.90, // ECB-backed exchange rates

  // Sentiment sources
  newsapi: 0.75,
  huggingface: 0.80,
  finbert: 0.80,
  gdelt: 0.80,

  // Macro data
  fred: 0.95, // Federal Reserve Economic Data
};

export function fuseMarketData(input: FusionInput): FusedMarketIntelligence {
  const {
    symbol,
    assetType = "unknown",
    marketData = [],
    sentimentData = [],
    fundamentalData = [],
    technicalData = [],
    shortInterestData = [],
    macroData = [],
  } = input;

  const warnings: string[] = [];
  const now = new Date();

  const fusedPrice = fusePriceData(marketData, warnings);
  const fusedSentiment = fuseSentimentData(sentimentData, warnings);
  const fusedFundamentals = fuseFundamentalData(fundamentalData, warnings);
  const fusedTechnicals = fuseTechnicalData(technicalData, warnings);
  const fusedShortInterest = fuseShortInterestData(shortInterestData, warnings);
  const fusedMacro = fuseMacroData(macroData, warnings);

  const trendStrength = calculateTrendStrength(fusedPrice, fusedSentiment, fusedTechnicals);
  const volatilityIndicator = calculateVolatilityWithTechnicals(marketData, technicalData);
  const signalAgreement = calculateSignalAgreementWithTechnicals(fusedPrice, fusedSentiment, fusedFundamentals, fusedTechnicals);

  const dataQuality = assessDataQuality(marketData, sentimentData, fundamentalData, now);

  log.debug("DataFusion", `Fused data for ${symbol}`, {
    priceSources: fusedPrice.sources.length,
    sentimentSources: fusedSentiment.sources.length,
    fundamentalSources: fusedFundamentals?.sources.length || 0,
    technicalSources: fusedTechnicals?.sources.length || 0,
    shortInterestSources: fusedShortInterest?.sources.length || 0,
    macroSources: fusedMacro?.sources.length || 0,
    signalAgreement: signalAgreement.toFixed(2),
    warnings: warnings.length,
  });

  return {
    symbol,
    assetType,
    price: fusedPrice,
    sentiment: fusedSentiment,
    fundamentals: fusedFundamentals,
    technicals: fusedTechnicals,
    shortInterest: fusedShortInterest,
    macro: fusedMacro,
    trendStrength,
    volatilityIndicator,
    signalAgreement,
    dataQuality,
    warnings,
    timestamp: now,
  };
}

function fusePriceData(
  data: MarketDataPoint[],
  warnings: string[]
): FusedMarketIntelligence["price"] {
  if (data.length === 0) {
    warnings.push("No price data available");
    return {
      current: 0,
      change: 0,
      changePercent: 0,
      confidence: 0,
      sources: [],
    };
  }

  data.sort((a, b) => (SOURCE_RELIABILITY[a.source] || 0.5) - (SOURCE_RELIABILITY[b.source] || 0.5));
  data.reverse();

  let totalWeight = 0;
  let weightedPrice = 0;
  let weightedChange = 0;
  let weightedChangePercent = 0;
  const sources: string[] = [];

  for (const point of data) {
    if (point.price === undefined) continue;
    
    const weight = point.reliability * (SOURCE_RELIABILITY[point.source] || 0.5);
    weightedPrice += point.price * weight;
    weightedChange += (point.priceChange || 0) * weight;
    weightedChangePercent += (point.priceChangePercent || 0) * weight;
    totalWeight += weight;
    
    if (!sources.includes(point.source)) {
      sources.push(point.source);
    }
  }

  if (totalWeight === 0) {
    warnings.push("No valid price data after filtering");
    return {
      current: 0,
      change: 0,
      changePercent: 0,
      confidence: 0,
      sources: [],
    };
  }

  const prices = data.filter(d => d.price !== undefined).map(d => d.price!);
  const avgPrice = mean(prices).toNumber();
  const priceVarianceValue = variance(prices).toNumber();
  const priceStdDev = stdDev(prices).toNumber();
  const priceConsistency = avgPrice > 0 ? Math.max(0, 1 - (priceStdDev / avgPrice)) : 0;

  if (priceConsistency < 0.95) {
    warnings.push(`Price sources show ${((1 - priceConsistency) * 100).toFixed(1)}% variance`);
  }

  return {
    current: weightedPrice / totalWeight,
    change: weightedChange / totalWeight,
    changePercent: weightedChangePercent / totalWeight,
    confidence: Math.min(1, (totalWeight / data.length) * priceConsistency),
    sources,
  };
}

function fuseSentimentData(
  data: SentimentDataPoint[],
  warnings: string[]
): FusedMarketIntelligence["sentiment"] {
  if (data.length === 0) {
    return {
      overall: "neutral",
      score: 0,
      confidence: 0,
      agreementLevel: 0,
      sources: [],
    };
  }

  let totalWeight = 0;
  let weightedScore = 0;
  const sources: string[] = [];
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;

  for (const point of data) {
    const weight = point.confidence * (SOURCE_RELIABILITY[point.source] || 0.5);
    
    let normalizedScore = point.score;
    if (point.sentiment === "positive") {
      normalizedScore = Math.abs(normalizedScore);
      positiveCount++;
    } else if (point.sentiment === "negative") {
      normalizedScore = -Math.abs(normalizedScore);
      negativeCount++;
    } else {
      neutralCount++;
    }

    weightedScore += normalizedScore * weight;
    totalWeight += weight;

    if (!sources.includes(point.source)) {
      sources.push(point.source);
    }
  }

  const avgScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  let overall: "bullish" | "bearish" | "neutral" = "neutral";
  if (avgScore > 0.15) overall = "bullish";
  else if (avgScore < -0.15) overall = "bearish";

  const totalSentiments = positiveCount + negativeCount + neutralCount;
  const maxCount = Math.max(positiveCount, negativeCount, neutralCount);
  const agreementLevel = totalSentiments > 0 ? maxCount / totalSentiments : 0;

  if (agreementLevel < 0.6 && data.length > 1) {
    warnings.push("Sentiment sources show conflicting signals");
  }

  return {
    overall,
    score: avgScore,
    confidence: Math.min(1, totalWeight / data.length),
    agreementLevel,
    sources,
  };
}

function fuseFundamentalData(
  data: FundamentalDataPoint[],
  warnings: string[]
): FusedMarketIntelligence["fundamentals"] | undefined {
  if (data.length === 0) {
    return undefined;
  }

  const sources: string[] = [];
  let eps: number | undefined;
  let peRatio: number | undefined;
  let pbRatio: number | undefined;
  let roe: number | undefined;
  let roa: number | undefined;
  let revenueGrowth: number | undefined;
  let freeCashFlow: number | undefined;
  let dividendYield: number | undefined;
  let debtToEquity: number | undefined;
  let currentRatio: number | undefined;
  let grossMargin: number | undefined;
  let netProfitMargin: number | undefined;
  let beta: number | undefined;
  let epsGrowth: number | undefined;
  let weekHigh52: number | undefined;
  let weekLow52: number | undefined;
  let insiderSentiment: "bullish" | "bearish" | "neutral" | undefined;

  let insiderBullishCount = 0;
  let insiderBearishCount = 0;

  for (const point of data) {
    if (point.eps !== undefined && eps === undefined) eps = point.eps;
    if (point.peRatio !== undefined && peRatio === undefined) peRatio = point.peRatio;
    if (point.pbRatio !== undefined && pbRatio === undefined) pbRatio = point.pbRatio;
    if (point.roe !== undefined && roe === undefined) roe = point.roe;
    if (point.roa !== undefined && roa === undefined) roa = point.roa;
    if (point.revenueGrowth !== undefined && revenueGrowth === undefined) revenueGrowth = point.revenueGrowth;
    if (point.freeCashFlow !== undefined && freeCashFlow === undefined) freeCashFlow = point.freeCashFlow;
    if (point.dividendYield !== undefined && dividendYield === undefined) dividendYield = point.dividendYield;
    if (point.debtToEquity !== undefined && debtToEquity === undefined) debtToEquity = point.debtToEquity;
    if (point.currentRatio !== undefined && currentRatio === undefined) currentRatio = point.currentRatio;
    if (point.grossMargin !== undefined && grossMargin === undefined) grossMargin = point.grossMargin;
    if (point.netProfitMargin !== undefined && netProfitMargin === undefined) netProfitMargin = point.netProfitMargin;
    if (point.beta !== undefined && beta === undefined) beta = point.beta;
    if (point.epsGrowth !== undefined && epsGrowth === undefined) epsGrowth = point.epsGrowth;
    if (point.weekHigh52 !== undefined && weekHigh52 === undefined) weekHigh52 = point.weekHigh52;
    if (point.weekLow52 !== undefined && weekLow52 === undefined) weekLow52 = point.weekLow52;
    
    if (point.insiderSentiment) {
      if (point.insiderSentiment === "bullish") insiderBullishCount++;
      else if (point.insiderSentiment === "bearish") insiderBearishCount++;
    }
    
    if (!sources.includes(point.source)) {
      sources.push(point.source);
    }
  }

  if (insiderBullishCount > insiderBearishCount) {
    insiderSentiment = "bullish";
  } else if (insiderBearishCount > insiderBullishCount) {
    insiderSentiment = "bearish";
  } else if (insiderBullishCount > 0 || insiderBearishCount > 0) {
    insiderSentiment = "neutral";
  }

  const coreFields = [eps, peRatio, revenueGrowth].filter(f => f !== undefined).length;
  const valuationFields = [pbRatio, roe, roa].filter(f => f !== undefined).length;
  const marginFields = [grossMargin, netProfitMargin].filter(f => f !== undefined).length;
  const rangeFields = [weekHigh52, weekLow52].filter(f => f !== undefined).length;
  const extendedFields = [freeCashFlow, dividendYield, debtToEquity, currentRatio, beta, epsGrowth, insiderSentiment].filter(f => f !== undefined).length;
  const totalFields = coreFields + valuationFields + marginFields + rangeFields + extendedFields;
  const maxFields = 17;
  const confidence = Math.min(1, totalFields / maxFields);

  if (insiderSentiment === "bearish" && coreFields > 0) {
    warnings.push("Insider activity shows bearish sentiment - insiders selling");
  }

  return {
    eps,
    peRatio,
    pbRatio,
    roe,
    roa,
    revenueGrowth,
    freeCashFlow,
    dividendYield,
    debtToEquity,
    currentRatio,
    grossMargin,
    netProfitMargin,
    beta,
    epsGrowth,
    weekHigh52,
    weekLow52,
    insiderSentiment,
    confidence,
    sources,
  };
}

function fuseTechnicalData(
  data: TechnicalDataPoint[],
  warnings: string[]
): FusedMarketIntelligence["technicals"] | undefined {
  if (data.length === 0) {
    return undefined;
  }

  const sources: string[] = [];
  let totalBuyCount = 0;
  let totalSellCount = 0;
  let totalNeutralCount = 0;
  let adxSum = 0;
  let adxCount = 0;
  let trendingCount = 0;
  let supportSum = 0;
  let supportCount = 0;
  let resistanceSum = 0;
  let resistanceCount = 0;
  let volatilitySum = 0;
  let volatilityCount = 0;
  let bullishTrendCount = 0;
  let bearishTrendCount = 0;

  for (const point of data) {
    if (point.buyCount !== undefined) totalBuyCount += point.buyCount;
    if (point.sellCount !== undefined) totalSellCount += point.sellCount;
    if (point.neutralCount !== undefined) totalNeutralCount += point.neutralCount;
    if (point.adx !== undefined) { adxSum += point.adx; adxCount++; }
    if (point.isTrending) trendingCount++;
    if (point.support !== undefined) { supportSum += point.support; supportCount++; }
    if (point.resistance !== undefined) { resistanceSum += point.resistance; resistanceCount++; }
    if (point.volatility !== undefined) { volatilitySum += point.volatility; volatilityCount++; }
    if (point.trend === "bullish") bullishTrendCount++;
    else if (point.trend === "bearish") bearishTrendCount++;
    
    if (!sources.includes(point.source)) {
      sources.push(point.source);
    }
  }

  const overallSignal: "buy" | "neutral" | "sell" = 
    totalBuyCount > totalSellCount + totalNeutralCount ? "buy" :
    totalSellCount > totalBuyCount + totalNeutralCount ? "sell" : "neutral";

  const trend: "bullish" | "bearish" | "neutral" =
    bullishTrendCount > bearishTrendCount ? "bullish" :
    bearishTrendCount > bullishTrendCount ? "bearish" : "neutral";

  const totalIndicators = totalBuyCount + totalSellCount + totalNeutralCount;
  const confidence = totalIndicators > 0 
    ? Math.max(totalBuyCount, totalSellCount) / totalIndicators 
    : 0;

  if (overallSignal === "sell" && totalSellCount > totalBuyCount * 2) {
    warnings.push("Strong sell signals from technical indicators");
  }

  return {
    signal: overallSignal,
    buyCount: totalBuyCount,
    sellCount: totalSellCount,
    neutralCount: totalNeutralCount,
    adx: adxCount > 0 ? adxSum / adxCount : undefined,
    isTrending: trendingCount > data.length / 2,
    support: supportCount > 0 ? supportSum / supportCount : undefined,
    resistance: resistanceCount > 0 ? resistanceSum / resistanceCount : undefined,
    volatility: volatilityCount > 0 ? volatilitySum / volatilityCount : undefined,
    trend,
    confidence,
    sources,
  };
}

function fuseShortInterestData(
  data: ShortInterestDataPoint[],
  warnings: string[]
): FusedMarketIntelligence["shortInterest"] | undefined {
  if (data.length === 0) {
    return undefined;
  }

  const sources: string[] = [];
  let totalWeight = 0;
  let weightedShortRatio = 0;
  let daysToCoverSum = 0;
  let daysToCoverCount = 0;
  let increasingCount = 0;
  let decreasingCount = 0;
  let highSqueezeCount = 0;
  let mediumSqueezeCount = 0;

  for (const point of data) {
    const weight = SOURCE_RELIABILITY[point.source] || 0.5;
    weightedShortRatio += point.shortRatio * weight;
    totalWeight += weight;

    if (point.daysToCover !== undefined) {
      daysToCoverSum += point.daysToCover;
      daysToCoverCount++;
    }

    if (point.shortRatioTrend === "increasing") increasingCount++;
    else if (point.shortRatioTrend === "decreasing") decreasingCount++;

    if (point.shortSqueezePotential === "high") highSqueezeCount++;
    else if (point.shortSqueezePotential === "medium") mediumSqueezeCount++;

    if (!sources.includes(point.source)) {
      sources.push(point.source);
    }
  }

  const avgShortRatio = totalWeight > 0 ? weightedShortRatio / totalWeight : 0;
  const avgDaysToCover = daysToCoverCount > 0 ? daysToCoverSum / daysToCoverCount : undefined;

  const trend: "increasing" | "decreasing" | "stable" =
    increasingCount > decreasingCount ? "increasing" :
    decreasingCount > increasingCount ? "decreasing" : "stable";

  const squeezePotential: "high" | "medium" | "low" =
    highSqueezeCount > 0 ? "high" :
    mediumSqueezeCount > 0 ? "medium" : "low";

  // Warning for high short interest
  if (avgShortRatio > 0.4) {
    warnings.push(`High short interest: ${(avgShortRatio * 100).toFixed(1)}% of volume is short selling`);
  }

  if (squeezePotential === "high" && trend === "increasing") {
    warnings.push("Potential short squeeze setup detected");
  }

  return {
    shortRatio: avgShortRatio,
    daysToCover: avgDaysToCover,
    trend,
    squeezePotential,
    confidence: Math.min(1, totalWeight / data.length),
    sources,
  };
}

function fuseMacroData(
  data: MacroDataPoint[],
  warnings: string[]
): FusedMarketIntelligence["macro"] | undefined {
  if (data.length === 0) {
    return undefined;
  }

  const sources: string[] = [];
  let vix: number | undefined;
  let fedFundsRate: number | undefined;
  let yieldCurve: number | undefined;
  let inflation: number | undefined;
  let unemployment: number | undefined;

  for (const point of data) {
    const indicator = point.indicator.toUpperCase();

    if (indicator.includes("VIX") && vix === undefined) {
      vix = point.value;
    } else if ((indicator.includes("FEDFUNDS") || indicator.includes("FED_FUNDS")) && fedFundsRate === undefined) {
      fedFundsRate = point.value;
    } else if ((indicator.includes("T10Y2Y") || indicator.includes("YIELD_CURVE")) && yieldCurve === undefined) {
      yieldCurve = point.value;
    } else if ((indicator.includes("CPI") || indicator.includes("INFLATION")) && inflation === undefined) {
      inflation = point.value;
    } else if ((indicator.includes("UNRATE") || indicator.includes("UNEMPLOYMENT")) && unemployment === undefined) {
      unemployment = point.value;
    }

    if (!sources.includes(point.source)) {
      sources.push(point.source);
    }
  }

  // Determine market regime based on macro indicators
  let marketRegime: "risk_on" | "risk_off" | "neutral" = "neutral";

  if (vix !== undefined) {
    if (vix > 30) {
      marketRegime = "risk_off";
      warnings.push(`Elevated VIX (${vix.toFixed(1)}) indicates high market fear`);
    } else if (vix < 15) {
      marketRegime = "risk_on";
    }
  }

  // Inverted yield curve is risk-off signal
  if (yieldCurve !== undefined && yieldCurve < 0) {
    if (marketRegime === "risk_on") {
      marketRegime = "neutral";
    } else {
      marketRegime = "risk_off";
    }
    warnings.push("Inverted yield curve detected - recession warning signal");
  }

  const fieldsPresent = [vix, fedFundsRate, yieldCurve, inflation, unemployment].filter(f => f !== undefined).length;
  const confidence = Math.min(1, fieldsPresent / 5);

  return {
    vix,
    fedFundsRate,
    yieldCurve,
    inflation,
    unemployment,
    marketRegime,
    confidence,
    sources,
  };
}

function calculateTrendStrength(
  price: FusedMarketIntelligence["price"],
  sentiment: FusedMarketIntelligence["sentiment"],
  technicals?: FusedMarketIntelligence["technicals"]
): number {
  if (price.confidence === 0) return 0;

  const priceDirection = price.changePercent > 0 ? 1 : price.changePercent < 0 ? -1 : 0;
  const sentimentDirection = sentiment.score > 0 ? 1 : sentiment.score < 0 ? -1 : 0;
  const technicalDirection = technicals 
    ? (technicals.signal === "buy" ? 1 : technicals.signal === "sell" ? -1 : 0)
    : 0;

  const priceStrength = Math.min(1, Math.abs(price.changePercent) / 5);
  const sentimentStrength = Math.abs(sentiment.score);
  const technicalStrength = technicals?.confidence || 0;

  const directions = [priceDirection, sentimentDirection];
  const strengths = [priceStrength * price.confidence, sentimentStrength * sentiment.confidence];
  
  if (technicals && technicals.confidence > 0) {
    directions.push(technicalDirection);
    strengths.push(technicalStrength);
  }

  const totalStrength = strengths.reduce((a, b) => a + b, 0);
  const avgDirection = directions.reduce((a, b) => a + b, 0) / directions.length;

  if (Math.abs(avgDirection) > 0.5) {
    return (totalStrength / strengths.length) * Math.sign(avgDirection);
  }

  if (priceDirection === sentimentDirection && priceDirection !== 0) {
    return (priceStrength + sentimentStrength) / 2 * price.confidence * sentiment.confidence;
  }
  
  if (priceDirection !== sentimentDirection && priceDirection !== 0 && sentimentDirection !== 0) {
    return -Math.abs(priceStrength - sentimentStrength) / 2;
  }

  return priceStrength * price.confidence;
}

function calculateVolatility(data: MarketDataPoint[]): number {
  if (data.length === 0) return 0;

  const withRange = data.filter(d => d.high !== undefined && d.low !== undefined && d.price);
  if (withRange.length === 0) return 0;

  let totalVolatility = 0;
  for (const point of withRange) {
    const range = (point.high! - point.low!) / point.price!;
    totalVolatility += range;
  }

  return Math.min(1, totalVolatility / withRange.length);
}

function calculateVolatilityWithTechnicals(
  marketData: MarketDataPoint[],
  technicalData: TechnicalDataPoint[]
): number {
  const baseVolatility = calculateVolatility(marketData);
  
  if (technicalData.length === 0) return baseVolatility;
  
  const technicalVolatilities = technicalData
    .filter(t => t.volatility !== undefined)
    .map(t => t.volatility!);
  
  if (technicalVolatilities.length === 0) return baseVolatility;
  
  const avgTechnicalVolatility = technicalVolatilities.reduce((a, b) => a + b, 0) / technicalVolatilities.length;
  const normalizedTechnicalVolatility = Math.min(1, avgTechnicalVolatility / 100);
  
  return (baseVolatility * 0.6 + normalizedTechnicalVolatility * 0.4);
}

function calculateSignalAgreement(
  price: FusedMarketIntelligence["price"],
  sentiment: FusedMarketIntelligence["sentiment"],
  fundamentals: FusedMarketIntelligence["fundamentals"] | undefined
): number {
  const signals: number[] = [];

  if (price.confidence > 0) {
    signals.push(price.changePercent > 0 ? 1 : price.changePercent < 0 ? -1 : 0);
  }

  if (sentiment.confidence > 0) {
    signals.push(sentiment.score > 0.1 ? 1 : sentiment.score < -0.1 ? -1 : 0);
  }

  if (fundamentals && fundamentals.confidence > 0) {
    let fundamentalSignal = 0;
    if (fundamentals.revenueGrowth !== undefined) {
      fundamentalSignal = fundamentals.revenueGrowth > 0 ? 1 : -1;
    }
    if (fundamentalSignal !== 0) signals.push(fundamentalSignal);
  }

  if (signals.length <= 1) return 1;

  const sum = signals.reduce((a, b) => a + b, 0);
  const agreement = Math.abs(sum) / signals.length;

  return agreement;
}

function calculateSignalAgreementWithTechnicals(
  price: FusedMarketIntelligence["price"],
  sentiment: FusedMarketIntelligence["sentiment"],
  fundamentals: FusedMarketIntelligence["fundamentals"] | undefined,
  technicals: FusedMarketIntelligence["technicals"] | undefined
): number {
  const signals: number[] = [];

  if (price.confidence > 0) {
    signals.push(price.changePercent > 0 ? 1 : price.changePercent < 0 ? -1 : 0);
  }

  if (sentiment.confidence > 0) {
    signals.push(sentiment.score > 0.1 ? 1 : sentiment.score < -0.1 ? -1 : 0);
  }

  if (fundamentals && fundamentals.confidence > 0) {
    let fundamentalSignal = 0;
    if (fundamentals.revenueGrowth !== undefined) {
      fundamentalSignal = fundamentals.revenueGrowth > 0 ? 1 : -1;
    }
    if (fundamentalSignal !== 0) signals.push(fundamentalSignal);
  }

  if (technicals && technicals.confidence > 0) {
    const technicalSignal = technicals.signal === "buy" ? 1 : technicals.signal === "sell" ? -1 : 0;
    if (technicalSignal !== 0) signals.push(technicalSignal);
  }

  if (signals.length <= 1) return 1;

  const sum = signals.reduce((a, b) => a + b, 0);
  const agreement = Math.abs(sum) / signals.length;

  return agreement;
}

function assessDataQuality(
  marketData: MarketDataPoint[],
  sentimentData: SentimentDataPoint[],
  fundamentalData: FundamentalDataPoint[],
  now: Date
): FusedMarketIntelligence["dataQuality"] {
  const hasMarket = marketData.length > 0;
  const hasSentiment = sentimentData.length > 0;
  const hasFundamentals = fundamentalData.length > 0;
  
  const completeness = (Number(hasMarket) + Number(hasSentiment) + Number(hasFundamentals)) / 3;

  const allTimestamps = [
    ...marketData.map(d => d.timestamp),
    ...sentimentData.map(d => d.timestamp),
    ...fundamentalData.map(d => d.timestamp),
  ];

  let freshness = 0;
  if (allTimestamps.length > 0) {
    const avgAge = allTimestamps.reduce((sum, ts) => sum + (now.getTime() - ts.getTime()), 0) / allTimestamps.length;
    const maxFreshAge = 60 * 60 * 1000;
    freshness = Math.max(0, 1 - (avgAge / maxFreshAge));
  }

  const avgReliability = [
    ...marketData.map(d => SOURCE_RELIABILITY[d.source] || 0.5),
    ...sentimentData.map(d => SOURCE_RELIABILITY[d.source] || 0.5),
  ];
  const reliability = avgReliability.length > 0
    ? avgReliability.reduce((a, b) => a + b, 0) / avgReliability.length
    : 0;

  return {
    completeness,
    freshness,
    reliability,
  };
}

export function formatForLLM(intelligence: FusedMarketIntelligence): string {
  const parts: string[] = [];

  parts.push(`Symbol: ${intelligence.symbol} (${intelligence.assetType})`);
  parts.push(`Price: $${intelligence.price.current.toFixed(2)} (${intelligence.price.changePercent >= 0 ? "+" : ""}${intelligence.price.changePercent.toFixed(2)}%)`);
  parts.push(`Sentiment: ${intelligence.sentiment.overall.toUpperCase()} (score: ${intelligence.sentiment.score.toFixed(2)}, agreement: ${(intelligence.sentiment.agreementLevel * 100).toFixed(0)}%)`);
  parts.push(`Trend Strength: ${(intelligence.trendStrength * 100).toFixed(0)}%`);
  parts.push(`Signal Agreement: ${(intelligence.signalAgreement * 100).toFixed(0)}%`);

  if (intelligence.fundamentals) {
    const f = intelligence.fundamentals;
    const fundParts: string[] = [];
    if (f.eps !== undefined) fundParts.push(`EPS: $${f.eps.toFixed(2)}`);
    if (f.peRatio !== undefined) fundParts.push(`P/E: ${f.peRatio.toFixed(1)}`);
    if (f.revenueGrowth !== undefined) fundParts.push(`Revenue Growth: ${(f.revenueGrowth * 100).toFixed(1)}%`);
    if (f.freeCashFlow !== undefined) fundParts.push(`FCF: $${(f.freeCashFlow / 1e9).toFixed(2)}B`);
    if (f.dividendYield !== undefined) fundParts.push(`Div Yield: ${f.dividendYield.toFixed(2)}%`);
    if (f.debtToEquity !== undefined) fundParts.push(`D/E: ${f.debtToEquity.toFixed(2)}`);
    if (f.insiderSentiment) fundParts.push(`Insider: ${f.insiderSentiment.toUpperCase()}`);
    if (fundParts.length > 0) {
      parts.push(`Fundamentals: ${fundParts.join(", ")}`);
    }
  }

  if (intelligence.technicals) {
    const t = intelligence.technicals;
    const techParts: string[] = [];
    techParts.push(`Signal: ${t.signal.toUpperCase()}`);
    techParts.push(`Trend: ${t.trend.toUpperCase()}`);
    if (t.adx !== undefined) techParts.push(`ADX: ${t.adx.toFixed(1)}`);
    techParts.push(`Buy/Sell/Neutral: ${t.buyCount}/${t.sellCount}/${t.neutralCount}`);
    if (t.support !== undefined) techParts.push(`Support: $${t.support.toFixed(2)}`);
    if (t.resistance !== undefined) techParts.push(`Resistance: $${t.resistance.toFixed(2)}`);
    parts.push(`Technicals: ${techParts.join(", ")}`);
  }

  if (intelligence.shortInterest) {
    const s = intelligence.shortInterest;
    const shortParts: string[] = [];
    shortParts.push(`Short Ratio: ${(s.shortRatio * 100).toFixed(1)}%`);
    if (s.daysToCover !== undefined) shortParts.push(`Days to Cover: ${s.daysToCover.toFixed(1)}`);
    shortParts.push(`Trend: ${s.trend.toUpperCase()}`);
    shortParts.push(`Squeeze Potential: ${s.squeezePotential.toUpperCase()}`);
    parts.push(`Short Interest: ${shortParts.join(", ")}`);
  }

  if (intelligence.macro) {
    const m = intelligence.macro;
    const macroParts: string[] = [];
    if (m.vix !== undefined) macroParts.push(`VIX: ${m.vix.toFixed(1)}`);
    if (m.fedFundsRate !== undefined) macroParts.push(`Fed Funds: ${m.fedFundsRate.toFixed(2)}%`);
    if (m.yieldCurve !== undefined) macroParts.push(`Yield Curve: ${m.yieldCurve.toFixed(2)}%`);
    if (m.inflation !== undefined) macroParts.push(`Inflation: ${m.inflation.toFixed(1)}%`);
    if (m.unemployment !== undefined) macroParts.push(`Unemployment: ${m.unemployment.toFixed(1)}%`);
    macroParts.push(`Regime: ${m.marketRegime.toUpperCase().replace("_", " ")}`);
    parts.push(`Macro: ${macroParts.join(", ")}`);
  }

  parts.push(`Data Quality: ${(intelligence.dataQuality.completeness * 100).toFixed(0)}% complete, ${(intelligence.dataQuality.freshness * 100).toFixed(0)}% fresh`);

  if (intelligence.warnings.length > 0) {
    parts.push(`Warnings: ${intelligence.warnings.join("; ")}`);
  }

  return parts.join("\n");
}

/**
 * Get source reliability weight for a given source
 */
export function getSourceReliability(source: string): number {
  return SOURCE_RELIABILITY[source.toLowerCase()] || 0.5;
}

/**
 * Get all configured source reliability weights
 */
export function getAllSourceReliabilities(): Record<string, number> {
  return { ...SOURCE_RELIABILITY };
}
