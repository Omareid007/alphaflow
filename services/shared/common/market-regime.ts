/**
 * AI Active Trader - Market Regime Detection
 * Detects market conditions (bull/bear/sideways/volatile) for strategy adaptation.
 * Based on quantitative finance regime detection patterns.
 */

export enum MarketRegime {
  BULL = 'BULL',
  BEAR = 'BEAR',
  SIDEWAYS = 'SIDEWAYS',
  HIGH_VOLATILITY = 'HIGH_VOLATILITY',
  LOW_VOLATILITY = 'LOW_VOLATILITY',
  UNKNOWN = 'UNKNOWN',
}

export interface RegimeIndicators {
  trendStrength: number;
  volatility: number;
  momentum: number;
  volumeProfile: 'increasing' | 'decreasing' | 'stable';
  marketBreadth: number;
}

export interface RegimeAnalysis {
  regime: MarketRegime;
  confidence: number;
  indicators: RegimeIndicators;
  recommendation: 'aggressive' | 'moderate' | 'conservative' | 'defensive';
  riskMultiplier: number;
  positionSizeMultiplier: number;
  detectedAt: Date;
  validUntil: Date;
}

interface PriceData {
  close: number;
  high: number;
  low: number;
  volume: number;
  timestamp: Date;
}

const REGIME_CONFIG = {
  lookbackPeriod: 20,
  volatilityThresholdHigh: 0.03,
  volatilityThresholdLow: 0.01,
  trendThreshold: 0.02,
  momentumPeriod: 14,
  regimeValidityMs: 3600000,
};

export class MarketRegimeDetector {
  private priceHistory: Map<string, PriceData[]> = new Map();
  private currentRegimes: Map<string, RegimeAnalysis> = new Map();
  private globalRegime: RegimeAnalysis | null = null;

  addPriceData(symbol: string, data: PriceData): void {
    let history = this.priceHistory.get(symbol);
    if (!history) {
      history = [];
      this.priceHistory.set(symbol, history);
    }

    history.push(data);

    if (history.length > REGIME_CONFIG.lookbackPeriod * 2) {
      history.shift();
    }
  }

  detectRegime(symbol: string): RegimeAnalysis {
    const history = this.priceHistory.get(symbol);

    if (!history || history.length < REGIME_CONFIG.lookbackPeriod) {
      return this.createDefaultAnalysis();
    }

    const indicators = this.calculateIndicators(history);
    const regime = this.classifyRegime(indicators);
    const confidence = this.calculateConfidence(indicators, regime);
    const recommendation = this.getRecommendation(regime, confidence);
    const { riskMultiplier, positionSizeMultiplier } = this.getMultipliers(regime, confidence);

    const analysis: RegimeAnalysis = {
      regime,
      confidence,
      indicators,
      recommendation,
      riskMultiplier,
      positionSizeMultiplier,
      detectedAt: new Date(),
      validUntil: new Date(Date.now() + REGIME_CONFIG.regimeValidityMs),
    };

    this.currentRegimes.set(symbol, analysis);
    return analysis;
  }

  private calculateIndicators(history: PriceData[]): RegimeIndicators {
    const closes = history.map(h => h.close);
    const volumes = history.map(h => h.volume);

    const volatility = this.calculateVolatility(closes);
    const trendStrength = this.calculateTrendStrength(closes);
    const momentum = this.calculateMomentum(closes);
    const volumeProfile = this.classifyVolumeProfile(volumes);
    const marketBreadth = this.estimateMarketBreadth(history);

    return {
      trendStrength,
      volatility,
      momentum,
      volumeProfile,
      marketBreadth,
    };
  }

  private calculateVolatility(closes: number[]): number {
    if (closes.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateTrendStrength(closes: number[]): number {
    if (closes.length < 2) return 0;

    const first = closes[0];
    const last = closes[closes.length - 1];
    const totalReturn = (last - first) / first;

    const sma = closes.reduce((a, b) => a + b, 0) / closes.length;
    const pricePosition = (last - sma) / sma;

    return (totalReturn + pricePosition) / 2;
  }

  private calculateMomentum(closes: number[]): number {
    if (closes.length < REGIME_CONFIG.momentumPeriod) return 0;

    const lookback = Math.min(REGIME_CONFIG.momentumPeriod, closes.length);
    const oldPrice = closes[closes.length - lookback];
    const currentPrice = closes[closes.length - 1];

    return (currentPrice - oldPrice) / oldPrice;
  }

  private classifyVolumeProfile(volumes: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (volumes.length < 5) return 'stable';

    const halfPoint = Math.floor(volumes.length / 2);
    const firstHalf = volumes.slice(0, halfPoint);
    const secondHalf = volumes.slice(halfPoint);

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = (avgSecond - avgFirst) / avgFirst;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  private estimateMarketBreadth(history: PriceData[]): number {
    if (history.length < 5) return 0.5;

    let advancingDays = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i].close > history[i - 1].close) {
        advancingDays++;
      }
    }

    return advancingDays / (history.length - 1);
  }

  private classifyRegime(indicators: RegimeIndicators): MarketRegime {
    const { trendStrength, volatility, momentum } = indicators;

    if (volatility > REGIME_CONFIG.volatilityThresholdHigh) {
      return MarketRegime.HIGH_VOLATILITY;
    }

    if (volatility < REGIME_CONFIG.volatilityThresholdLow) {
      return MarketRegime.LOW_VOLATILITY;
    }

    if (trendStrength > REGIME_CONFIG.trendThreshold && momentum > 0) {
      return MarketRegime.BULL;
    }

    if (trendStrength < -REGIME_CONFIG.trendThreshold && momentum < 0) {
      return MarketRegime.BEAR;
    }

    return MarketRegime.SIDEWAYS;
  }

  private calculateConfidence(indicators: RegimeIndicators, regime: MarketRegime): number {
    const { trendStrength, volatility, momentum, marketBreadth } = indicators;

    let confidence = 0.5;

    switch (regime) {
      case MarketRegime.BULL:
        confidence = Math.min(0.95, 0.5 + Math.abs(trendStrength) * 5 + momentum * 2 + marketBreadth * 0.3);
        break;
      case MarketRegime.BEAR:
        confidence = Math.min(0.95, 0.5 + Math.abs(trendStrength) * 5 + Math.abs(momentum) * 2 + (1 - marketBreadth) * 0.3);
        break;
      case MarketRegime.HIGH_VOLATILITY:
        confidence = Math.min(0.95, 0.6 + (volatility - REGIME_CONFIG.volatilityThresholdHigh) * 10);
        break;
      case MarketRegime.LOW_VOLATILITY:
        confidence = Math.min(0.95, 0.6 + (REGIME_CONFIG.volatilityThresholdLow - volatility) * 20);
        break;
      case MarketRegime.SIDEWAYS:
        confidence = Math.min(0.85, 0.5 + (1 - Math.abs(trendStrength) * 10));
        break;
    }

    return Math.max(0.3, Math.min(0.95, confidence));
  }

  private getRecommendation(regime: MarketRegime, confidence: number): 'aggressive' | 'moderate' | 'conservative' | 'defensive' {
    if (confidence < 0.5) return 'conservative';

    switch (regime) {
      case MarketRegime.BULL:
        return confidence > 0.7 ? 'aggressive' : 'moderate';
      case MarketRegime.BEAR:
        return 'defensive';
      case MarketRegime.HIGH_VOLATILITY:
        return 'conservative';
      case MarketRegime.LOW_VOLATILITY:
        return 'moderate';
      case MarketRegime.SIDEWAYS:
        return 'conservative';
      default:
        return 'conservative';
    }
  }

  private getMultipliers(regime: MarketRegime, confidence: number): { riskMultiplier: number; positionSizeMultiplier: number } {
    const baseConfidenceMultiplier = 0.5 + confidence * 0.5;

    switch (regime) {
      case MarketRegime.BULL:
        return {
          riskMultiplier: 1.2 * baseConfidenceMultiplier,
          positionSizeMultiplier: 1.3 * baseConfidenceMultiplier,
        };
      case MarketRegime.BEAR:
        return {
          riskMultiplier: 0.5,
          positionSizeMultiplier: 0.3,
        };
      case MarketRegime.HIGH_VOLATILITY:
        return {
          riskMultiplier: 0.6,
          positionSizeMultiplier: 0.5,
        };
      case MarketRegime.LOW_VOLATILITY:
        return {
          riskMultiplier: 1.0,
          positionSizeMultiplier: 1.0,
        };
      case MarketRegime.SIDEWAYS:
        return {
          riskMultiplier: 0.7,
          positionSizeMultiplier: 0.6,
        };
      default:
        return {
          riskMultiplier: 0.5,
          positionSizeMultiplier: 0.5,
        };
    }
  }

  private createDefaultAnalysis(): RegimeAnalysis {
    return {
      regime: MarketRegime.UNKNOWN,
      confidence: 0,
      indicators: {
        trendStrength: 0,
        volatility: 0,
        momentum: 0,
        volumeProfile: 'stable',
        marketBreadth: 0.5,
      },
      recommendation: 'conservative',
      riskMultiplier: 0.5,
      positionSizeMultiplier: 0.5,
      detectedAt: new Date(),
      validUntil: new Date(Date.now() + REGIME_CONFIG.regimeValidityMs),
    };
  }

  getCurrentRegime(symbol: string): RegimeAnalysis | null {
    const analysis = this.currentRegimes.get(symbol);
    if (!analysis) return null;

    if (new Date() > analysis.validUntil) {
      return this.detectRegime(symbol);
    }

    return analysis;
  }

  getGlobalRegime(): RegimeAnalysis | null {
    return this.globalRegime;
  }

  updateGlobalRegime(symbols: string[]): RegimeAnalysis {
    const regimes = symbols
      .map(s => this.getCurrentRegime(s))
      .filter((r): r is RegimeAnalysis => r !== null);

    if (regimes.length === 0) {
      this.globalRegime = this.createDefaultAnalysis();
      return this.globalRegime;
    }

    const avgConfidence = regimes.reduce((sum, r) => sum + r.confidence, 0) / regimes.length;
    const avgRiskMultiplier = regimes.reduce((sum, r) => sum + r.riskMultiplier, 0) / regimes.length;
    const avgPositionMultiplier = regimes.reduce((sum, r) => sum + r.positionSizeMultiplier, 0) / regimes.length;

    const regimeCounts = new Map<MarketRegime, number>();
    for (const r of regimes) {
      regimeCounts.set(r.regime, (regimeCounts.get(r.regime) || 0) + 1);
    }

    let dominantRegime = MarketRegime.SIDEWAYS;
    let maxCount = 0;
    for (const [regime, count] of regimeCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantRegime = regime;
      }
    }

    this.globalRegime = {
      regime: dominantRegime,
      confidence: avgConfidence,
      indicators: regimes[0].indicators,
      recommendation: this.getRecommendation(dominantRegime, avgConfidence),
      riskMultiplier: avgRiskMultiplier,
      positionSizeMultiplier: avgPositionMultiplier,
      detectedAt: new Date(),
      validUntil: new Date(Date.now() + REGIME_CONFIG.regimeValidityMs),
    };

    return this.globalRegime;
  }

  clear(): void {
    this.priceHistory.clear();
    this.currentRegimes.clear();
    this.globalRegime = null;
  }
}

export function createMarketRegimeDetector(): MarketRegimeDetector {
  return new MarketRegimeDetector();
}
