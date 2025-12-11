/**
 * Data Fusion Engine - Combine multiple data sources into unified market intelligence
 * 
 * Fuses data from:
 * - Market data (Alpaca, Finnhub, CoinGecko)
 * - News and sentiment (NewsAPI, Hugging Face FinBERT)
 * - Fundamentals (Valyu.ai)
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
  revenue?: number;
  revenueGrowth?: number;
  debtToEquity?: number;
  freeCashFlow?: number;
  dividendYield?: number;
  insiderSentiment?: "bullish" | "bearish" | "neutral";
  insiderBuyValue?: number;
  insiderSellValue?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  operatingMargin?: number;
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
    revenueGrowth?: number;
    freeCashFlow?: number;
    dividendYield?: number;
    debtToEquity?: number;
    insiderSentiment?: "bullish" | "bearish" | "neutral";
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
}

const SOURCE_RELIABILITY: Record<string, number> = {
  alpaca: 0.95,
  finnhub: 0.90,
  coingecko: 0.85,
  coinmarketcap: 0.85,
  valyu: 0.90,
  newsapi: 0.75,
  huggingface: 0.80,
  finbert: 0.80,
  gdelt: 0.80,
};

export function fuseMarketData(input: FusionInput): FusedMarketIntelligence {
  const { symbol, assetType = "unknown", marketData = [], sentimentData = [], fundamentalData = [] } = input;
  
  const warnings: string[] = [];
  const now = new Date();

  const fusedPrice = fusePriceData(marketData, warnings);
  const fusedSentiment = fuseSentimentData(sentimentData, warnings);
  const fusedFundamentals = fuseFundamentalData(fundamentalData, warnings);

  const trendStrength = calculateTrendStrength(fusedPrice, fusedSentiment);
  const volatilityIndicator = calculateVolatility(marketData);
  const signalAgreement = calculateSignalAgreement(fusedPrice, fusedSentiment, fusedFundamentals);

  const dataQuality = assessDataQuality(marketData, sentimentData, fundamentalData, now);

  log.debug("DataFusion", `Fused data for ${symbol}`, {
    priceSources: fusedPrice.sources.length,
    sentimentSources: fusedSentiment.sources.length,
    fundamentalSources: fusedFundamentals?.sources.length || 0,
    signalAgreement: signalAgreement.toFixed(2),
    warnings: warnings.length,
  });

  return {
    symbol,
    assetType,
    price: fusedPrice,
    sentiment: fusedSentiment,
    fundamentals: fusedFundamentals,
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
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const priceVariance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
  const priceStdDev = Math.sqrt(priceVariance);
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
  let revenueGrowth: number | undefined;
  let freeCashFlow: number | undefined;
  let dividendYield: number | undefined;
  let debtToEquity: number | undefined;
  let insiderSentiment: "bullish" | "bearish" | "neutral" | undefined;

  let insiderBullishCount = 0;
  let insiderBearishCount = 0;

  for (const point of data) {
    if (point.eps !== undefined && eps === undefined) eps = point.eps;
    if (point.peRatio !== undefined && peRatio === undefined) peRatio = point.peRatio;
    if (point.revenueGrowth !== undefined && revenueGrowth === undefined) revenueGrowth = point.revenueGrowth;
    if (point.freeCashFlow !== undefined && freeCashFlow === undefined) freeCashFlow = point.freeCashFlow;
    if (point.dividendYield !== undefined && dividendYield === undefined) dividendYield = point.dividendYield;
    if (point.debtToEquity !== undefined && debtToEquity === undefined) debtToEquity = point.debtToEquity;
    
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
  const extendedFields = [freeCashFlow, dividendYield, debtToEquity, insiderSentiment].filter(f => f !== undefined).length;
  const confidence = (coreFields + extendedFields * 0.5) / 5;

  if (insiderSentiment === "bearish" && coreFields > 0) {
    warnings.push("Insider activity shows bearish sentiment - insiders selling");
  }

  return {
    eps,
    peRatio,
    revenueGrowth,
    freeCashFlow,
    dividendYield,
    debtToEquity,
    insiderSentiment,
    confidence,
    sources,
  };
}

function calculateTrendStrength(
  price: FusedMarketIntelligence["price"],
  sentiment: FusedMarketIntelligence["sentiment"]
): number {
  if (price.confidence === 0) return 0;

  const priceDirection = price.changePercent > 0 ? 1 : price.changePercent < 0 ? -1 : 0;
  const sentimentDirection = sentiment.score > 0 ? 1 : sentiment.score < 0 ? -1 : 0;

  const priceStrength = Math.min(1, Math.abs(price.changePercent) / 5);
  const sentimentStrength = Math.abs(sentiment.score);

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

  parts.push(`Data Quality: ${(intelligence.dataQuality.completeness * 100).toFixed(0)}% complete, ${(intelligence.dataQuality.freshness * 100).toFixed(0)}% fresh`);

  if (intelligence.warnings.length > 0) {
    parts.push(`Warnings: ${intelligence.warnings.join("; ")}`);
  }

  return parts.join("\n");
}
