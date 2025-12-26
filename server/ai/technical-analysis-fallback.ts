/**
 * Technical Analysis Fallback Engine
 *
 * Provides algorithmic trading decisions when all LLM providers are unavailable.
 * Uses technical indicators, price action analysis, and market data to generate
 * trading recommendations without requiring AI inference.
 */

import { log } from "../utils/logger";
import { MarketData, AIDecision, NewsContext } from "./decision-engine";

interface TechnicalIndicators {
  // Core indicators
  rsi: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  bollingerWidth: number | null;

  // Advanced indicators
  stochasticK: number | null;
  stochasticD: number | null;
  williamsR: number | null;
  cci: number | null;
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
  atr: number | null;
  atrPercent: number | null;

  // Derived signals
  pricePosition: "above_sma" | "below_sma" | "at_sma" | null;
  trendStrength: "strong" | "moderate" | "weak" | "none" | null;
  volumeTrend: "increasing" | "decreasing" | "stable" | null;
  volatility: "high" | "medium" | "low" | null;

  // Divergence detection
  rsiDivergence: "bullish" | "bearish" | null;
  macdDivergence: "bullish" | "bearish" | null;
}

interface MarketRegime {
  type: "trending_up" | "trending_down" | "ranging" | "volatile" | "breakout";
  strength: number;
  adaptiveWeights: {
    momentum: number;
    trend: number;
    volatility: number;
    sentiment: number;
  };
}

interface SignalScore {
  signal: "bullish" | "bearish" | "neutral";
  strength: number; // 0-1
  indicators: string[];
}

// Simple price history cache for technical calculations
const priceCache = new Map<string, { prices: number[]; timestamp: Date }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Analysis result cache for stale-while-revalidate pattern
interface CachedAnalysis {
  decision: AIDecision;
  timestamp: Date;
  marketData: MarketData;
}
const analysisCache = new Map<string, CachedAnalysis>();
const ANALYSIS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes fresh
const ANALYSIS_STALE_TTL_MS = 10 * 60 * 1000; // 10 minutes stale-but-usable

export class TechnicalAnalysisFallback {

  /**
   * Get cached analysis if available and fresh enough
   */
  getCachedAnalysis(symbol: string, currentPrice: number): { decision: AIDecision; isStale: boolean } | null {
    const cached = analysisCache.get(symbol);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp.getTime();

    // Check if price has moved significantly (>2%)
    const priceChange = Math.abs(currentPrice - cached.marketData.currentPrice) / cached.marketData.currentPrice;
    if (priceChange > 0.02) {
      log.debug("TechFallback", `Cache invalid for ${symbol} - price moved ${(priceChange * 100).toFixed(1)}%`);
      return null;
    }

    if (age > ANALYSIS_STALE_TTL_MS) {
      analysisCache.delete(symbol);
      return null;
    }

    const isStale = age > ANALYSIS_CACHE_TTL_MS;
    return { decision: cached.decision, isStale };
  }

  /**
   * Cache analysis result
   */
  cacheAnalysis(symbol: string, decision: AIDecision, marketData: MarketData): void {
    analysisCache.set(symbol, {
      decision,
      timestamp: new Date(),
      marketData,
    });
  }

  /**
   * Main entry point - analyze opportunity without LLM
   */
  async analyzeWithoutLLM(
    symbol: string,
    marketData: MarketData,
    newsContext?: NewsContext,
    priceHistory?: number[]
  ): Promise<AIDecision> {
    // Check cache first
    const cached = this.getCachedAnalysis(symbol, marketData.currentPrice);
    if (cached && !cached.isStale) {
      log.info("TechFallback", `Using cached analysis for ${symbol}`, {
        confidence: cached.decision.confidence,
        action: cached.decision.action
      });
      return { ...cached.decision, reasoning: cached.decision.reasoning + " (cached)" };
    }

    log.info("TechFallback", `Analyzing ${symbol} without LLM`, {
      price: marketData.currentPrice,
      change: marketData.priceChangePercent24h,
      usingStaleCache: cached?.isStale || false
    });

    try {
      // Get or estimate price history
      const prices = priceHistory || this.estimatePriceHistory(marketData);

      // Calculate technical indicators
      const indicators = this.calculateIndicators(prices, marketData);

      // Detect market regime for adaptive weighting
      const regime = this.detectMarketRegime(indicators, marketData);

      // Score each signal type
      const momentumScore = this.scoreMomentum(indicators, marketData);
      const trendScore = this.scoreTrend(indicators, marketData);
      const volatilityScore = this.scoreVolatility(indicators, marketData);
      const sentimentScore = this.scoreSentiment(newsContext);

      // Combine scores with adaptive weights based on market regime
      const combinedScore = this.combineScores([
        { score: momentumScore, weight: regime.adaptiveWeights.momentum },
        { score: trendScore, weight: regime.adaptiveWeights.trend },
        { score: volatilityScore, weight: regime.adaptiveWeights.volatility },
        { score: sentimentScore, weight: regime.adaptiveWeights.sentiment },
      ]);

      // Generate decision with enhanced metrics
      const decision = this.generateDecision(combinedScore, marketData, indicators, regime);

      // Cache the result
      this.cacheAnalysis(symbol, decision, marketData);

      log.info("TechFallback", `Analysis complete for ${symbol}`, {
        action: decision.action,
        confidence: decision.confidence,
        combinedSignal: combinedScore.signal,
        regime: regime.type,
        indicatorCount: Object.values(indicators).filter(v => v !== null).length,
      });

      return decision;
    } catch (error) {
      log.error("TechFallback", `Analysis failed for ${symbol}`, { error: String(error) });
      return this.getSafeDefaultDecision(symbol, marketData);
    }
  }

  /**
   * Estimate price history from available data when full history isn't available
   */
  private estimatePriceHistory(marketData: MarketData): number[] {
    const { currentPrice, high24h, low24h, priceChange24h } = marketData;
    const prices: number[] = [];

    // Create synthetic 20-period history based on available data
    const previousPrice = priceChange24h !== undefined
      ? currentPrice - priceChange24h
      : currentPrice;

    const range = (high24h ?? currentPrice * 1.02) - (low24h ?? currentPrice * 0.98);
    const volatility = range / currentPrice;

    // Generate 20 synthetic prices
    for (let i = 0; i < 20; i++) {
      const progress = i / 19;
      const base = previousPrice + (currentPrice - previousPrice) * progress;
      // Add some noise based on volatility
      const noise = (Math.random() - 0.5) * volatility * base * 0.5;
      prices.push(base + noise);
    }

    // Ensure last price is current
    prices[prices.length - 1] = currentPrice;

    return prices;
  }

  /**
   * Calculate technical indicators from price data
   */
  private calculateIndicators(prices: number[], marketData: MarketData): TechnicalIndicators {
    const currentPrice = marketData.currentPrice;
    const high24h = marketData.high24h ?? currentPrice * 1.02;
    const low24h = marketData.low24h ?? currentPrice * 0.98;

    // Core indicators
    const rsi = this.calculateRSI(prices);
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = prices.length >= 50 ? this.calculateSMA(prices, 50) : null;
    const sma200 = prices.length >= 200 ? this.calculateSMA(prices, 200) : null;
    const macd = this.calculateMACD(prices);
    const bollinger = this.calculateBollinger(prices);

    // Advanced indicators
    const stochastic = this.calculateStochastic(prices, high24h, low24h);
    const williamsR = this.calculateWilliamsR(prices, high24h, low24h);
    const cci = this.calculateCCI(prices, high24h, low24h);
    const adxData = this.calculateADX(prices, high24h, low24h);
    const atr = this.calculateATR(prices, high24h, low24h);

    // Divergence detection
    const rsiDivergence = this.detectRSIDivergence(prices, rsi);
    const macdDivergence = this.detectMACDDivergence(prices, macd.histogram);

    // Trend strength from ADX
    const trendStrength = this.determineTrendStrength(adxData.adx);

    return {
      // Core
      rsi,
      sma20,
      sma50,
      sma200,
      ema12: this.calculateEMA(prices, 12),
      ema26: this.calculateEMA(prices, 26),
      macdLine: macd.line,
      macdSignal: macd.signal,
      macdHistogram: macd.histogram,
      bollingerUpper: bollinger.upper,
      bollingerLower: bollinger.lower,
      bollingerWidth: bollinger.width,

      // Advanced
      stochasticK: stochastic.k,
      stochasticD: stochastic.d,
      williamsR,
      cci,
      adx: adxData.adx,
      plusDI: adxData.plusDI,
      minusDI: adxData.minusDI,
      atr,
      atrPercent: atr !== null ? (atr / currentPrice) * 100 : null,

      // Derived
      pricePosition: this.determinePricePosition(currentPrice, sma20),
      trendStrength,
      volumeTrend: this.estimateVolumeTrend(marketData),
      volatility: this.estimateVolatility(marketData),

      // Divergences
      rsiDivergence,
      macdDivergence,
    };
  }

  /**
   * Calculate Stochastic Oscillator (%K and %D)
   */
  private calculateStochastic(
    prices: number[],
    high24h: number,
    low24h: number,
    period: number = 14
  ): { k: number | null; d: number | null } {
    if (prices.length < period) return { k: null, d: null };

    const recentPrices = prices.slice(-period);
    const highestHigh = Math.max(high24h, ...recentPrices);
    const lowestLow = Math.min(low24h, ...recentPrices);
    const currentPrice = prices[prices.length - 1];

    if (highestHigh === lowestLow) return { k: 50, d: 50 };

    const k = ((currentPrice - lowestLow) / (highestHigh - lowestLow)) * 100;

    // Calculate %D as 3-period SMA of %K (simplified)
    const d = k * 0.85 + 7.5; // Approximation without full K history

    return { k, d };
  }

  /**
   * Calculate Williams %R
   */
  private calculateWilliamsR(
    prices: number[],
    high24h: number,
    low24h: number,
    period: number = 14
  ): number | null {
    if (prices.length < period) return null;

    const recentPrices = prices.slice(-period);
    const highestHigh = Math.max(high24h, ...recentPrices);
    const lowestLow = Math.min(low24h, ...recentPrices);
    const currentPrice = prices[prices.length - 1];

    if (highestHigh === lowestLow) return -50;

    return ((highestHigh - currentPrice) / (highestHigh - lowestLow)) * -100;
  }

  /**
   * Calculate Commodity Channel Index (CCI)
   */
  private calculateCCI(
    prices: number[],
    high24h: number,
    low24h: number,
    period: number = 20
  ): number | null {
    if (prices.length < period) return null;

    const currentPrice = prices[prices.length - 1];
    const typicalPrice = (high24h + low24h + currentPrice) / 3;

    // Calculate SMA of typical price (approximated)
    const sma = this.calculateSMA(prices, period);
    if (sma === null) return null;

    // Mean deviation (simplified)
    const recentPrices = prices.slice(-period);
    const meanDeviation = recentPrices.reduce((sum, p) => sum + Math.abs(p - sma), 0) / period;

    if (meanDeviation === 0) return 0;

    return (typicalPrice - sma) / (0.015 * meanDeviation);
  }

  /**
   * Calculate Average Directional Index (ADX) with +DI and -DI
   */
  private calculateADX(
    prices: number[],
    high24h: number,
    low24h: number,
    period: number = 14
  ): { adx: number | null; plusDI: number | null; minusDI: number | null } {
    if (prices.length < period + 1) return { adx: null, plusDI: null, minusDI: null };

    // Simplified ADX calculation using price movements
    let plusDM = 0;
    let minusDM = 0;
    let tr = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const currentHigh = Math.max(prices[i], prices[i] * 1.01);
      const currentLow = Math.min(prices[i], prices[i] * 0.99);
      const prevHigh = Math.max(prices[i - 1], prices[i - 1] * 1.01);
      const prevLow = Math.min(prices[i - 1], prices[i - 1] * 0.99);
      const prevClose = prices[i - 1];

      // True Range
      const trueRange = Math.max(
        currentHigh - currentLow,
        Math.abs(currentHigh - prevClose),
        Math.abs(currentLow - prevClose)
      );
      tr += trueRange;

      // Directional Movement
      const upMove = currentHigh - prevHigh;
      const downMove = prevLow - currentLow;

      if (upMove > downMove && upMove > 0) {
        plusDM += upMove;
      }
      if (downMove > upMove && downMove > 0) {
        minusDM += downMove;
      }
    }

    if (tr === 0) return { adx: 0, plusDI: 0, minusDI: 0 };

    const plusDI = (plusDM / tr) * 100;
    const minusDI = (minusDM / tr) * 100;

    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI + 0.001) * 100;

    // ADX is smoothed DX (simplified)
    const adx = dx * 0.9;

    return { adx, plusDI, minusDI };
  }

  /**
   * Calculate Average True Range (ATR)
   */
  private calculateATR(
    prices: number[],
    high24h: number,
    low24h: number,
    period: number = 14
  ): number | null {
    if (prices.length < period + 1) return null;

    let atrSum = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const currentHigh = prices[i] * 1.005; // Estimate intraday high
      const currentLow = prices[i] * 0.995;  // Estimate intraday low
      const prevClose = prices[i - 1];

      const trueRange = Math.max(
        currentHigh - currentLow,
        Math.abs(currentHigh - prevClose),
        Math.abs(currentLow - prevClose)
      );
      atrSum += trueRange;
    }

    return atrSum / period;
  }

  /**
   * Detect RSI divergence (price making new highs/lows but RSI not confirming)
   */
  private detectRSIDivergence(
    prices: number[],
    currentRSI: number | null
  ): "bullish" | "bearish" | null {
    if (currentRSI === null || prices.length < 10) return null;

    const recentPrices = prices.slice(-10);
    const midPrice = recentPrices[4];
    const currentPrice = recentPrices[recentPrices.length - 1];

    // Bullish divergence: price making lower lows, RSI making higher lows
    if (currentPrice < midPrice && currentRSI > 35) {
      return "bullish";
    }

    // Bearish divergence: price making higher highs, RSI making lower highs
    if (currentPrice > midPrice && currentRSI < 65) {
      return "bearish";
    }

    return null;
  }

  /**
   * Detect MACD divergence
   */
  private detectMACDDivergence(
    prices: number[],
    macdHistogram: number | null
  ): "bullish" | "bearish" | null {
    if (macdHistogram === null || prices.length < 10) return null;

    const recentPrices = prices.slice(-10);
    const midPrice = recentPrices[4];
    const currentPrice = recentPrices[recentPrices.length - 1];

    // Bullish divergence: price down, MACD histogram rising
    if (currentPrice < midPrice && macdHistogram > 0) {
      return "bullish";
    }

    // Bearish divergence: price up, MACD histogram falling
    if (currentPrice > midPrice && macdHistogram < 0) {
      return "bearish";
    }

    return null;
  }

  /**
   * Determine trend strength from ADX value
   */
  private determineTrendStrength(adx: number | null): "strong" | "moderate" | "weak" | "none" | null {
    if (adx === null) return null;
    if (adx >= 40) return "strong";
    if (adx >= 25) return "moderate";
    if (adx >= 15) return "weak";
    return "none";
  }

  /**
   * Detect market regime for adaptive weighting
   */
  private detectMarketRegime(indicators: TechnicalIndicators, marketData: MarketData): MarketRegime {
    const volatility = indicators.volatility;
    const adx = indicators.adx ?? 20;
    const bbWidth = indicators.bollingerWidth ?? 0.04;
    const priceChange = Math.abs(marketData.priceChangePercent24h ?? 0);

    let type: MarketRegime["type"] = "ranging";
    let strength = 0.5;

    // Volatile market
    if (volatility === "high" || bbWidth > 0.08) {
      type = "volatile";
      strength = Math.min(bbWidth * 10, 1);
    }
    // Strong trend
    else if (adx >= 30) {
      const plusDI = indicators.plusDI ?? 0;
      const minusDI = indicators.minusDI ?? 0;
      type = plusDI > minusDI ? "trending_up" : "trending_down";
      strength = Math.min(adx / 50, 1);
    }
    // Breakout detection
    else if (priceChange > 4 && adx >= 20) {
      type = "breakout";
      strength = Math.min(priceChange / 10, 1);
    }
    // Ranging market
    else {
      type = "ranging";
      strength = 1 - (adx / 30);
    }

    // Adaptive weights based on regime
    const adaptiveWeights = this.getAdaptiveWeights(type, volatility);

    return { type, strength, adaptiveWeights };
  }

  /**
   * Get adaptive weights based on market regime
   */
  private getAdaptiveWeights(
    regime: MarketRegime["type"],
    volatility: "high" | "medium" | "low" | null
  ): MarketRegime["adaptiveWeights"] {
    // Default weights
    const defaults = { momentum: 0.35, trend: 0.30, volatility: 0.15, sentiment: 0.20 };

    switch (regime) {
      case "trending_up":
      case "trending_down":
        // In trends, favor momentum and trend signals
        return { momentum: 0.40, trend: 0.35, volatility: 0.10, sentiment: 0.15 };

      case "volatile":
        // In volatile markets, reduce all but increase volatility awareness
        return { momentum: 0.25, trend: 0.25, volatility: 0.30, sentiment: 0.20 };

      case "breakout":
        // Breakouts favor momentum heavily
        return { momentum: 0.45, trend: 0.30, volatility: 0.10, sentiment: 0.15 };

      case "ranging":
        // Ranging markets need balance, more sentiment
        return { momentum: 0.30, trend: 0.25, volatility: 0.15, sentiment: 0.30 };

      default:
        return defaults;
    }
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(prices: number[], period: number = 14): number | null {
    if (prices.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(prices: number[], period: number): number | null {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(prices: number[], period: number): number | null {
    if (prices.length < period) return null;

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Calculate MACD with proper EMA9 signal line
   */
  private calculateMACD(prices: number[]): { line: number | null; signal: number | null; histogram: number | null } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);

    if (ema12 === null || ema26 === null) {
      return { line: null, signal: null, histogram: null };
    }

    const line = ema12 - ema26;

    // Calculate proper signal line using EMA9 of MACD line values
    // We need to build a history of MACD line values
    if (prices.length >= 35) {
      const macdHistory: number[] = [];
      for (let i = 26; i <= prices.length; i++) {
        const slice = prices.slice(0, i);
        const e12 = this.calculateEMA(slice, 12);
        const e26 = this.calculateEMA(slice, 26);
        if (e12 !== null && e26 !== null) {
          macdHistory.push(e12 - e26);
        }
      }

      // Calculate EMA9 of MACD history for signal line
      if (macdHistory.length >= 9) {
        const multiplier = 2 / (9 + 1);
        let ema = macdHistory.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
        for (let i = 9; i < macdHistory.length; i++) {
          ema = (macdHistory[i] - ema) * multiplier + ema;
        }
        const signal = ema;
        const histogram = line - signal;
        return { line, signal, histogram };
      }
    }

    // Fallback for insufficient data: approximate with smoothing
    const signal = line * 0.85;
    const histogram = line - signal;

    return { line, signal, histogram };
  }

  /**
   * Calculate Bollinger Bands with width metric
   */
  private calculateBollinger(prices: number[], period: number = 20): { upper: number | null; lower: number | null; width: number | null } {
    const sma = this.calculateSMA(prices, period);
    if (sma === null || prices.length < period) {
      return { upper: null, lower: null, width: null };
    }

    const slice = prices.slice(-period);
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = sma + (stdDev * 2);
    const lower = sma - (stdDev * 2);
    const width = (upper - lower) / sma; // Normalized width as percentage

    return { upper, lower, width };
  }

  /**
   * Determine price position relative to SMA
   */
  private determinePricePosition(price: number, sma: number | null): "above_sma" | "below_sma" | "at_sma" | null {
    if (sma === null) return null;
    const threshold = sma * 0.005; // 0.5% threshold
    if (price > sma + threshold) return "above_sma";
    if (price < sma - threshold) return "below_sma";
    return "at_sma";
  }

  /**
   * Estimate volume trend from available data
   */
  private estimateVolumeTrend(marketData: MarketData): "increasing" | "decreasing" | "stable" | null {
    // Without historical volume data, use price change as proxy
    const changePercent = marketData.priceChangePercent24h ?? 0;
    if (Math.abs(changePercent) > 3) return "increasing";
    if (Math.abs(changePercent) < 1) return "stable";
    return "stable";
  }

  /**
   * Estimate volatility from price range
   */
  private estimateVolatility(marketData: MarketData): "high" | "medium" | "low" | null {
    const { currentPrice, high24h, low24h } = marketData;
    if (high24h === undefined || low24h === undefined) return null;

    const range = (high24h - low24h) / currentPrice;
    if (range > 0.05) return "high";      // >5% range
    if (range > 0.02) return "medium";    // 2-5% range
    return "low";                          // <2% range
  }

  /**
   * Score momentum indicators (enhanced with Stochastic, Williams %R, CCI)
   */
  private scoreMomentum(indicators: TechnicalIndicators, marketData: MarketData): SignalScore {
    const signals: string[] = [];
    let bullishPoints = 0;
    let bearishPoints = 0;

    // RSI signals (weight: 2)
    if (indicators.rsi !== null) {
      if (indicators.rsi < 30) {
        bullishPoints += 3;
        signals.push("RSI oversold (<30)");
      } else if (indicators.rsi > 70) {
        bearishPoints += 3;
        signals.push("RSI overbought (>70)");
      } else if (indicators.rsi < 40) {
        bullishPoints += 1;
        signals.push("RSI approaching oversold");
      } else if (indicators.rsi > 60) {
        bearishPoints += 1;
        signals.push("RSI elevated");
      }
    }

    // Stochastic signals (weight: 2)
    if (indicators.stochasticK !== null && indicators.stochasticD !== null) {
      if (indicators.stochasticK < 20 && indicators.stochasticD < 20) {
        bullishPoints += 2;
        signals.push("Stochastic oversold");
      } else if (indicators.stochasticK > 80 && indicators.stochasticD > 80) {
        bearishPoints += 2;
        signals.push("Stochastic overbought");
      }
      // Stochastic crossover
      if (indicators.stochasticK > indicators.stochasticD && indicators.stochasticK < 50) {
        bullishPoints += 1;
        signals.push("Stochastic bullish crossover");
      } else if (indicators.stochasticK < indicators.stochasticD && indicators.stochasticK > 50) {
        bearishPoints += 1;
        signals.push("Stochastic bearish crossover");
      }
    }

    // Williams %R signals (weight: 1)
    if (indicators.williamsR !== null) {
      if (indicators.williamsR > -20) {
        bearishPoints += 1;
        signals.push("Williams %R overbought");
      } else if (indicators.williamsR < -80) {
        bullishPoints += 1;
        signals.push("Williams %R oversold");
      }
    }

    // CCI signals (weight: 1)
    if (indicators.cci !== null) {
      if (indicators.cci > 100) {
        bearishPoints += 1;
        signals.push("CCI overbought (>100)");
      } else if (indicators.cci < -100) {
        bullishPoints += 1;
        signals.push("CCI oversold (<-100)");
      }
    }

    // MACD signals (weight: 2)
    if (indicators.macdHistogram !== null) {
      if (indicators.macdHistogram > 0) {
        bullishPoints += 2;
        signals.push("MACD histogram positive");
      } else {
        bearishPoints += 2;
        signals.push("MACD histogram negative");
      }
      // MACD line crossing signal
      if (indicators.macdLine !== null && indicators.macdSignal !== null) {
        if (indicators.macdLine > indicators.macdSignal && indicators.macdHistogram > 0) {
          bullishPoints += 1;
          signals.push("MACD bullish crossover");
        } else if (indicators.macdLine < indicators.macdSignal && indicators.macdHistogram < 0) {
          bearishPoints += 1;
          signals.push("MACD bearish crossover");
        }
      }
    }

    // Divergence signals (high weight - leading indicators)
    if (indicators.rsiDivergence === "bullish") {
      bullishPoints += 3;
      signals.push("RSI bullish divergence detected");
    } else if (indicators.rsiDivergence === "bearish") {
      bearishPoints += 3;
      signals.push("RSI bearish divergence detected");
    }

    if (indicators.macdDivergence === "bullish") {
      bullishPoints += 2;
      signals.push("MACD bullish divergence");
    } else if (indicators.macdDivergence === "bearish") {
      bearishPoints += 2;
      signals.push("MACD bearish divergence");
    }

    // Price change momentum
    const changePercent = marketData.priceChangePercent24h ?? 0;
    if (changePercent > 3) {
      bullishPoints += 2;
      signals.push(`Strong bullish momentum (+${changePercent.toFixed(1)}%)`);
    } else if (changePercent > 1) {
      bullishPoints += 1;
      signals.push(`Positive momentum (+${changePercent.toFixed(1)}%)`);
    } else if (changePercent < -3) {
      bearishPoints += 2;
      signals.push(`Strong bearish momentum (${changePercent.toFixed(1)}%)`);
    } else if (changePercent < -1) {
      bearishPoints += 1;
      signals.push(`Negative momentum (${changePercent.toFixed(1)}%)`);
    }

    const totalPoints = bullishPoints + bearishPoints;
    const strength = totalPoints > 0 ? Math.abs(bullishPoints - bearishPoints) / (totalPoints + 3) : 0;

    return {
      signal: bullishPoints > bearishPoints ? "bullish" : bearishPoints > bullishPoints ? "bearish" : "neutral",
      strength: Math.min(strength, 1),
      indicators: signals,
    };
  }

  /**
   * Score trend indicators (enhanced with ADX, SMA200, multi-timeframe)
   */
  private scoreTrend(indicators: TechnicalIndicators, marketData: MarketData): SignalScore {
    const signals: string[] = [];
    let bullishPoints = 0;
    let bearishPoints = 0;

    // Price vs SMA20 (short-term trend)
    if (indicators.pricePosition === "above_sma") {
      bullishPoints += 2;
      signals.push("Price above SMA20");
    } else if (indicators.pricePosition === "below_sma") {
      bearishPoints += 2;
      signals.push("Price below SMA20");
    }

    // Price vs SMA50 (medium-term trend)
    if (indicators.sma50 !== null) {
      const price = marketData.currentPrice;
      if (price > indicators.sma50 * 1.02) {
        bullishPoints += 2;
        signals.push("Price above SMA50");
      } else if (price < indicators.sma50 * 0.98) {
        bearishPoints += 2;
        signals.push("Price below SMA50");
      }
    }

    // Price vs SMA200 (long-term trend - major signal)
    if (indicators.sma200 !== null) {
      const price = marketData.currentPrice;
      if (price > indicators.sma200) {
        bullishPoints += 3;
        signals.push("Price above SMA200 (long-term bullish)");
      } else {
        bearishPoints += 3;
        signals.push("Price below SMA200 (long-term bearish)");
      }
    }

    // ADX trend strength and direction (high weight)
    if (indicators.adx !== null && indicators.plusDI !== null && indicators.minusDI !== null) {
      const trendStrength = indicators.trendStrength;

      if (trendStrength === "strong" || trendStrength === "moderate") {
        if (indicators.plusDI > indicators.minusDI) {
          bullishPoints += trendStrength === "strong" ? 4 : 2;
          signals.push(`ADX ${indicators.adx.toFixed(0)} - Strong uptrend (+DI>${-1}DI)`);
        } else {
          bearishPoints += trendStrength === "strong" ? 4 : 2;
          signals.push(`ADX ${indicators.adx.toFixed(0)} - Strong downtrend (-DI>+DI)`);
        }
      } else if (trendStrength === "weak" || trendStrength === "none") {
        signals.push(`ADX ${indicators.adx.toFixed(0)} - Ranging/weak trend`);
      }
    }

    // EMA crossover (12 vs 26)
    if (indicators.ema12 !== null && indicators.ema26 !== null) {
      if (indicators.ema12 > indicators.ema26) {
        bullishPoints += 2;
        signals.push("EMA12 > EMA26 (bullish alignment)");
      } else {
        bearishPoints += 2;
        signals.push("EMA12 < EMA26 (bearish alignment)");
      }
    }

    // Bollinger band position
    if (indicators.bollingerLower !== null && indicators.bollingerUpper !== null) {
      const price = marketData.currentPrice;
      if (price < indicators.bollingerLower) {
        bullishPoints += 2;
        signals.push("Price at lower Bollinger (oversold)");
      } else if (price > indicators.bollingerUpper) {
        bearishPoints += 2;
        signals.push("Price at upper Bollinger (overbought)");
      }

      // Bollinger squeeze detection (low volatility before breakout)
      if (indicators.bollingerWidth !== null && indicators.bollingerWidth < 0.03) {
        signals.push("Bollinger squeeze - potential breakout");
      }
    }

    const totalPoints = bullishPoints + bearishPoints;
    const strength = totalPoints > 0 ? Math.abs(bullishPoints - bearishPoints) / (totalPoints + 4) : 0;

    return {
      signal: bullishPoints > bearishPoints ? "bullish" : bearishPoints > bullishPoints ? "bearish" : "neutral",
      strength: Math.min(strength, 1),
      indicators: signals,
    };
  }

  /**
   * Score volatility conditions (enhanced with ATR analysis)
   */
  private scoreVolatility(indicators: TechnicalIndicators, marketData: MarketData): SignalScore {
    const signals: string[] = [];
    let riskAdjustment = 0; // Negative means more cautious

    // ATR-based volatility assessment
    if (indicators.atrPercent !== null) {
      if (indicators.atrPercent > 5) {
        riskAdjustment -= 3;
        signals.push(`Very high ATR volatility (${indicators.atrPercent.toFixed(1)}%)`);
      } else if (indicators.atrPercent > 3) {
        riskAdjustment -= 2;
        signals.push(`High ATR volatility (${indicators.atrPercent.toFixed(1)}%)`);
      } else if (indicators.atrPercent > 1.5) {
        riskAdjustment -= 1;
        signals.push(`Moderate ATR volatility (${indicators.atrPercent.toFixed(1)}%)`);
      } else if (indicators.atrPercent < 1) {
        riskAdjustment += 1;
        signals.push(`Low ATR volatility (${indicators.atrPercent.toFixed(1)}%) - stable`);
      }
    }

    // Price range volatility
    if (indicators.volatility === "high") {
      riskAdjustment -= 2;
      signals.push("High 24h price range volatility");
    } else if (indicators.volatility === "low") {
      riskAdjustment += 1;
      signals.push("Low 24h range - stable conditions");
    }

    // Bollinger width volatility indicator
    if (indicators.bollingerWidth !== null) {
      if (indicators.bollingerWidth > 0.08) {
        riskAdjustment -= 2;
        signals.push("Wide Bollinger bands - high volatility");
      } else if (indicators.bollingerWidth < 0.02) {
        riskAdjustment += 1;
        signals.push("Tight Bollinger bands - low volatility");
      }
    }

    if (indicators.volumeTrend === "increasing") {
      signals.push("Volume increasing - confirming movement");
    }

    return {
      signal: riskAdjustment > 0 ? "bullish" : riskAdjustment < 0 ? "bearish" : "neutral",
      strength: Math.abs(riskAdjustment) / 5,
      indicators: signals,
    };
  }

  /**
   * Score sentiment from news context
   */
  private scoreSentiment(newsContext?: NewsContext): SignalScore {
    if (!newsContext) {
      return { signal: "neutral", strength: 0, indicators: ["No news data"] };
    }

    const signals: string[] = [];
    let sentimentScore = 0;

    if (newsContext.sentiment === "bullish") {
      sentimentScore = 1;
      signals.push("Bullish news sentiment");
    } else if (newsContext.sentiment === "bearish") {
      sentimentScore = -1;
      signals.push("Bearish news sentiment");
    }

    if (newsContext.headlines && newsContext.headlines.length > 0) {
      signals.push(`${newsContext.headlines.length} recent headlines`);
    }

    return {
      signal: sentimentScore > 0 ? "bullish" : sentimentScore < 0 ? "bearish" : "neutral",
      strength: Math.abs(sentimentScore) * 0.5,
      indicators: signals,
    };
  }

  /**
   * Combine multiple signal scores with weights
   */
  private combineScores(
    scores: Array<{ score: SignalScore; weight: number }>
  ): SignalScore {
    let weightedBullish = 0;
    let weightedBearish = 0;
    const allIndicators: string[] = [];

    for (const { score, weight } of scores) {
      if (score.signal === "bullish") {
        weightedBullish += score.strength * weight;
      } else if (score.signal === "bearish") {
        weightedBearish += score.strength * weight;
      }
      allIndicators.push(...score.indicators);
    }

    const netSignal = weightedBullish - weightedBearish;
    const strength = Math.abs(netSignal);

    return {
      signal: netSignal > 0.1 ? "bullish" : netSignal < -0.1 ? "bearish" : "neutral",
      strength: Math.min(strength, 1),
      indicators: allIndicators,
    };
  }

  /**
   * Generate final decision from combined scores (enhanced with regime and ATR)
   */
  private generateDecision(
    combinedScore: SignalScore,
    marketData: MarketData,
    indicators: TechnicalIndicators,
    regime: MarketRegime
  ): AIDecision {
    const { signal, strength, indicators: usedIndicators } = combinedScore;

    // Adaptive threshold based on market regime
    const actionThreshold = regime.type === "volatile" ? 0.35 :
                           regime.type === "trending_up" || regime.type === "trending_down" ? 0.15 :
                           regime.type === "breakout" ? 0.20 : 0.25;

    // Map signal to action with adaptive thresholds
    let action: "buy" | "sell" | "hold";
    if (signal === "bullish" && strength > actionThreshold) {
      action = "buy";
    } else if (signal === "bearish" && strength > actionThreshold) {
      action = "sell";
    } else {
      action = "hold";
    }

    // Enhanced confidence calculation with multiple factors
    const confidence = this.calculateDynamicConfidence(
      strength,
      indicators,
      regime,
      usedIndicators.length
    );

    // Determine risk level based on ATR volatility and regime
    const riskLevel = this.calculateRiskLevel(indicators, regime);

    // Generate enhanced reasoning with regime context
    const reasoning = this.generateReasoning(action, usedIndicators, signal, strength, regime);

    // Calculate ATR-based stop loss and target (only for buy/sell)
    let stopLoss: number | undefined;
    let targetPrice: number | undefined;
    let suggestedQuantity: number | undefined;

    if (action === "buy") {
      const { stop, target } = this.calculateATRBasedTargets(marketData, indicators, riskLevel);
      stopLoss = stop;
      targetPrice = target;
      suggestedQuantity = this.calculateDynamicPositionSize(confidence, riskLevel, indicators);
    } else if (action === "sell") {
      // For sell signals, suggest taking profits based on strength
      suggestedQuantity = strength > 0.5 ? 0.50 : strength > 0.3 ? 0.35 : 0.25;
    }

    return {
      action,
      confidence,
      reasoning,
      riskLevel,
      suggestedQuantity,
      targetPrice,
      stopLoss,
    };
  }

  /**
   * Calculate dynamic confidence based on multiple factors
   */
  private calculateDynamicConfidence(
    signalStrength: number,
    indicators: TechnicalIndicators,
    regime: MarketRegime,
    indicatorCount: number
  ): number {
    // Base confidence from signal strength (35-65% range)
    let confidence = 0.35 + (signalStrength * 0.30);

    // Indicator coverage bonus (more indicators = more confident)
    const totalPossibleIndicators = 20;
    const coverageRatio = indicatorCount / totalPossibleIndicators;
    confidence += coverageRatio * 0.10;

    // Regime-specific adjustments
    if (regime.type === "trending_up" || regime.type === "trending_down") {
      confidence += 0.08; // Trends are more predictable
    } else if (regime.type === "volatile") {
      confidence -= 0.10; // Volatile markets are unpredictable
    } else if (regime.type === "breakout") {
      confidence += 0.05; // Breakouts have momentum
    }

    // ADX trend strength confirmation
    if (indicators.adx !== null) {
      if (indicators.adx >= 40) {
        confidence += 0.08; // Strong trend = high confidence
      } else if (indicators.adx >= 25) {
        confidence += 0.04;
      } else if (indicators.adx < 15) {
        confidence -= 0.05; // No trend = lower confidence
      }
    }

    // Multiple oscillator agreement bonus
    const oscillatorAgreement = this.checkOscillatorAgreement(indicators);
    confidence += oscillatorAgreement * 0.10;

    // Volatility penalty
    if (indicators.atrPercent !== null) {
      if (indicators.atrPercent > 5) {
        confidence -= 0.10;
      } else if (indicators.atrPercent > 3) {
        confidence -= 0.05;
      }
    }

    // Cap confidence: 40% min, 88% max for algorithmic decisions
    return Math.max(0.40, Math.min(confidence, 0.88));
  }

  /**
   * Check if multiple oscillators agree on signal
   */
  private checkOscillatorAgreement(indicators: TechnicalIndicators): number {
    let bullishCount = 0;
    let bearishCount = 0;
    let total = 0;

    // RSI
    if (indicators.rsi !== null) {
      total++;
      if (indicators.rsi < 40) bullishCount++;
      else if (indicators.rsi > 60) bearishCount++;
    }

    // Stochastic
    if (indicators.stochasticK !== null) {
      total++;
      if (indicators.stochasticK < 30) bullishCount++;
      else if (indicators.stochasticK > 70) bearishCount++;
    }

    // Williams %R
    if (indicators.williamsR !== null) {
      total++;
      if (indicators.williamsR < -70) bullishCount++;
      else if (indicators.williamsR > -30) bearishCount++;
    }

    // CCI
    if (indicators.cci !== null) {
      total++;
      if (indicators.cci < -50) bullishCount++;
      else if (indicators.cci > 50) bearishCount++;
    }

    if (total === 0) return 0;
    return Math.max(bullishCount, bearishCount) / total;
  }

  /**
   * Calculate risk level from multiple volatility indicators
   */
  private calculateRiskLevel(
    indicators: TechnicalIndicators,
    regime: MarketRegime
  ): "low" | "medium" | "high" {
    let riskScore = 0;

    // ATR-based risk
    if (indicators.atrPercent !== null) {
      if (indicators.atrPercent > 4) riskScore += 3;
      else if (indicators.atrPercent > 2.5) riskScore += 2;
      else if (indicators.atrPercent > 1.5) riskScore += 1;
    }

    // Volatility category
    if (indicators.volatility === "high") riskScore += 2;
    else if (indicators.volatility === "medium") riskScore += 1;

    // Regime-based risk
    if (regime.type === "volatile") riskScore += 2;
    else if (regime.type === "breakout") riskScore += 1;
    else if (regime.type === "ranging") riskScore += 1;

    // Trend strength reduces risk
    if (indicators.trendStrength === "strong") riskScore -= 1;
    else if (indicators.trendStrength === "none") riskScore += 1;

    if (riskScore >= 5) return "high";
    if (riskScore >= 2) return "medium";
    return "low";
  }

  /**
   * Calculate ATR-based stop loss and target price
   */
  private calculateATRBasedTargets(
    marketData: MarketData,
    indicators: TechnicalIndicators,
    riskLevel: "low" | "medium" | "high"
  ): { stop: number; target: number } {
    const currentPrice = marketData.currentPrice;
    const atr = indicators.atr;

    if (atr !== null && atr > 0) {
      // ATR-based stops: 2x ATR for stop, 3x ATR for target (1.5 R:R)
      const atrMultiplier = riskLevel === "high" ? 2.5 : riskLevel === "medium" ? 2.0 : 1.5;
      const targetMultiplier = riskLevel === "high" ? 3.0 : riskLevel === "medium" ? 3.5 : 4.0;

      const stop = currentPrice - (atr * atrMultiplier);
      const target = currentPrice + (atr * targetMultiplier);

      return { stop, target };
    }

    // Fallback to percentage-based stops
    const stopPercent = riskLevel === "high" ? 0.05 : riskLevel === "medium" ? 0.04 : 0.03;
    const targetPercent = riskLevel === "high" ? 0.06 : riskLevel === "medium" ? 0.07 : 0.08;

    return {
      stop: currentPrice * (1 - stopPercent),
      target: currentPrice * (1 + targetPercent),
    };
  }

  /**
   * Calculate dynamic position size based on confidence and risk
   */
  private calculateDynamicPositionSize(
    confidence: number,
    riskLevel: "low" | "medium" | "high",
    indicators: TechnicalIndicators
  ): number {
    // Base position size by risk level
    const baseSize = riskLevel === "low" ? 0.10 : riskLevel === "medium" ? 0.06 : 0.03;

    // Confidence multiplier (0.7x to 1.3x)
    const confidenceMultiplier = 0.7 + (confidence * 0.6);

    // Volatility adjustment
    let volatilityAdjustment = 1.0;
    if (indicators.atrPercent !== null) {
      if (indicators.atrPercent > 4) volatilityAdjustment = 0.6;
      else if (indicators.atrPercent > 2.5) volatilityAdjustment = 0.8;
      else if (indicators.atrPercent < 1) volatilityAdjustment = 1.2;
    }

    // Trend strength bonus
    let trendBonus = 1.0;
    if (indicators.trendStrength === "strong") trendBonus = 1.15;
    else if (indicators.trendStrength === "moderate") trendBonus = 1.05;

    const finalSize = baseSize * confidenceMultiplier * volatilityAdjustment * trendBonus;

    // Cap at 15% max, 2% min
    return Math.max(0.02, Math.min(finalSize, 0.15));
  }

  /**
   * Generate human-readable reasoning with regime context
   */
  private generateReasoning(
    action: "buy" | "sell" | "hold",
    indicators: string[],
    signal: string,
    strength: number,
    regime: MarketRegime
  ): string {
    const signalStrength = strength > 0.5 ? "strong" : strength > 0.25 ? "moderate" : "weak";
    const topIndicators = indicators.slice(0, 4).join(", ");
    const regimeDesc = this.getRegimeDescription(regime);

    if (action === "buy") {
      return `${signalStrength.charAt(0).toUpperCase() + signalStrength.slice(1)} bullish signal detected. ${regimeDesc}. Key indicators: ${topIndicators}. (Enhanced algorithmic analysis)`;
    } else if (action === "sell") {
      return `${signalStrength.charAt(0).toUpperCase() + signalStrength.slice(1)} bearish signal detected. ${regimeDesc}. Key indicators: ${topIndicators}. (Enhanced algorithmic analysis)`;
    } else {
      return `Mixed signals in ${regime.type} market. ${topIndicators}. Holding position recommended. (Enhanced algorithmic analysis)`;
    }
  }

  /**
   * Get human-readable regime description
   */
  private getRegimeDescription(regime: MarketRegime): string {
    switch (regime.type) {
      case "trending_up":
        return "Market in confirmed uptrend";
      case "trending_down":
        return "Market in confirmed downtrend";
      case "volatile":
        return "High volatility environment";
      case "breakout":
        return "Potential breakout detected";
      case "ranging":
        return "Ranging/consolidation market";
      default:
        return "Market conditions analyzed";
    }
  }

  /**
   * Safe default when everything fails
   */
  private getSafeDefaultDecision(symbol: string, marketData: MarketData): AIDecision {
    return {
      action: "hold",
      confidence: 0.40,
      reasoning: `Technical analysis fallback for ${symbol} at $${marketData.currentPrice.toFixed(2)}. Insufficient data for confident signal. Holding for safety.`,
      riskLevel: "medium",
    };
  }

  /**
   * Check if this fallback should be used
   */
  shouldUseFallback(llmError?: string): boolean {
    if (!llmError) return false;
    const errorLower = llmError.toLowerCase();
    return (
      errorLower.includes("401") ||  // Unauthorized - invalid/not approved API key
      errorLower.includes("402") ||  // Payment required - out of credits
      errorLower.includes("403") ||  // Forbidden - access denied
      errorLower.includes("429") ||  // Rate limit exceeded
      errorLower.includes("rate limit") ||
      errorLower.includes("budget") ||
      errorLower.includes("credits") ||
      errorLower.includes("payment") ||
      errorLower.includes("all providers failed") ||
      errorLower.includes("unavailable") ||
      errorLower.includes("not approved") ||
      errorLower.includes("api key") ||
      errorLower.includes("authentication")
    );
  }
}

export const technicalAnalysisFallback = new TechnicalAnalysisFallback();
