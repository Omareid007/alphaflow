/**
 * News-Enhanced Decision Engine
 *
 * Extends the AI decision-making with comprehensive news integration:
 * - Sentiment time-series tracking
 * - Sentiment momentum detection
 * - Sentiment decay over time
 * - News-technical signal alignment
 * - Impact scoring for news events
 */

import { log } from "../utils/logger";
import { gdelt } from "../connectors/gdelt";
import { newsapi } from "../connectors/newsapi";
import { calculateCompositeScore, type ScoringInput, type CompositeScore } from "../scoring/multi-factor-scoring-engine";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum SignalStrength {
  STRONG_BUY = 2,
  BUY = 1,
  NEUTRAL = 0,
  SELL = -1,
  STRONG_SELL = -2,
}

export enum DecisionType {
  ENTER_LONG = "enter_long",
  ENTER_SHORT = "enter_short",
  EXIT_LONG = "exit_long",
  EXIT_SHORT = "exit_short",
  SCALE_IN = "scale_in",
  SCALE_OUT = "scale_out",
  TAKE_PROFIT = "take_profit",
  STOP_LOSS = "stop_loss",
  HOLD = "hold",
}

export interface SentimentScore {
  headlineSentiment: number; // -1 to 1
  summarySentiment: number;  // -1 to 1
  combinedScore: number;     // -1 to 1
  confidence: number;        // 0 to 1
  newsId: string;
  timestamp: Date;
  source: string;
  symbols: string[];
}

export interface SentimentHistory {
  symbol: string;
  scores: SentimentScore[];
  momentum: number;          // Rate of change in sentiment
  volatility: number;        // Sentiment volatility
  lastUpdate: Date;
}

export interface TechnicalSignal {
  signal: SignalStrength;
  confidence: number;
  source: string;
  timestamp: Date;
}

export interface EnhancedDecision {
  decisionType: DecisionType;
  symbol: string;
  confidence: number;
  suggestedSize: number;     // Fraction of max position (0-1)
  entryPrice?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  reasoning: {
    sentimentScore: number;
    sentimentConfidence: number;
    sentimentMomentum: number;
    technicalScore: number;
    technicalConfidence: number;
    combinedScore: number;
    newsCount: number;
    latestHeadline?: string;
    alignment: "aligned" | "divergent" | "neutral";
  };
  timestamp: Date;
  isActionable: boolean;
}

export interface NewsEnhancedConfig {
  minConfidence: number;           // Minimum confidence to act (default: 0.6)
  newsWeight: number;              // Weight for news signals (default: 0.3)
  technicalWeight: number;         // Weight for technical signals (default: 0.7)
  sentimentDecayHours: number;     // Hours for sentiment to decay (default: 4)
  momentumWindow: number;          // Number of scores for momentum calc (default: 10)
  minNewsForSignal: number;        // Minimum news items for confidence (default: 2)
  maxSentimentAge: number;         // Max age of sentiment in hours (default: 24)
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: NewsEnhancedConfig = {
  minConfidence: 0.6,
  newsWeight: 0.3,
  technicalWeight: 0.7,
  sentimentDecayHours: 4,
  momentumWindow: 10,
  minNewsForSignal: 2,
  maxSentimentAge: 24,
};

// ============================================================================
// NEWS-ENHANCED DECISION ENGINE
// ============================================================================

export class NewsEnhancedDecisionEngine {
  private config: NewsEnhancedConfig;

  // Sentiment history per symbol
  private sentimentHistory: Map<string, SentimentHistory> = new Map();

  // Technical signals per symbol
  private technicalSignals: Map<string, TechnicalSignal[]> = new Map();

  // Position tracking for context
  private positions: Map<string, { qty: number; avgEntryPrice: number }> = new Map();

  // Decision history
  private decisionHistory: EnhancedDecision[] = [];

  constructor(config: Partial<NewsEnhancedConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info("NewsEnhancedDecisionEngine", "Initialized", {
      newsWeight: this.config.newsWeight,
      technicalWeight: this.config.technicalWeight,
      minConfidence: this.config.minConfidence,
    });
  }

  // ==================== SENTIMENT ANALYSIS ====================

  analyzeSentiment(
    headline: string,
    summary: string | undefined,
    newsId: string,
    source: string,
    symbols: string[]
  ): SentimentScore {
    // Simple rule-based sentiment analysis
    // In production, integrate with FinBERT or similar model

    const positiveKeywords = [
      "surge", "soar", "jump", "gain", "rise", "boost", "beat", "exceed",
      "outperform", "upgrade", "bullish", "rally", "breakthrough", "record",
      "profit", "growth", "strong", "positive", "optimistic", "recovery",
    ];

    const negativeKeywords = [
      "plunge", "crash", "drop", "fall", "decline", "miss", "cut", "downgrade",
      "bearish", "selloff", "weakness", "concern", "warning", "risk", "loss",
      "negative", "pessimistic", "recession", "layoff", "lawsuit", "investigation",
    ];

    const headlineLower = headline.toLowerCase();
    const summaryLower = (summary || "").toLowerCase();

    // Count sentiment keywords
    let headlinePositive = 0;
    let headlineNegative = 0;
    let summaryPositive = 0;
    let summaryNegative = 0;

    for (const word of positiveKeywords) {
      if (headlineLower.includes(word)) headlinePositive++;
      if (summaryLower.includes(word)) summaryPositive++;
    }

    for (const word of negativeKeywords) {
      if (headlineLower.includes(word)) headlineNegative++;
      if (summaryLower.includes(word)) summaryNegative++;
    }

    // Calculate sentiment scores (-1 to 1)
    const headlineTotal = headlinePositive + headlineNegative;
    const headlineSentiment = headlineTotal > 0
      ? (headlinePositive - headlineNegative) / headlineTotal
      : 0;

    const summaryTotal = summaryPositive + summaryNegative;
    const summarySentiment = summaryTotal > 0
      ? (summaryPositive - summaryNegative) / summaryTotal
      : 0;

    // Combined score (headline weighted 70%)
    const combinedScore = 0.7 * headlineSentiment + 0.3 * summarySentiment;

    // Confidence based on keyword count
    const totalKeywords = headlineTotal + summaryTotal;
    const confidence = Math.min(totalKeywords / 6, 1); // 6+ keywords = full confidence

    return {
      headlineSentiment,
      summarySentiment,
      combinedScore,
      confidence,
      newsId,
      source,
      symbols,
      timestamp: new Date(),
    };
  }

  updateSentiment(symbol: string, sentiment: SentimentScore): void {
    let history = this.sentimentHistory.get(symbol);

    if (!history) {
      history = {
        symbol,
        scores: [],
        momentum: 0,
        volatility: 0,
        lastUpdate: new Date(),
      };
      this.sentimentHistory.set(symbol, history);
    }

    // Add new score
    history.scores.push(sentiment);
    history.lastUpdate = new Date();

    // Prune old scores
    const maxAge = this.config.maxSentimentAge * 3600000; // to milliseconds
    const cutoff = Date.now() - maxAge;
    history.scores = history.scores.filter(s => s.timestamp.getTime() > cutoff);

    // Calculate momentum (rate of change)
    if (history.scores.length >= 2) {
      const recentScores = history.scores.slice(-this.config.momentumWindow);
      const oldAvg = recentScores.slice(0, Math.floor(recentScores.length / 2))
        .reduce((sum, s) => sum + s.combinedScore, 0) / Math.floor(recentScores.length / 2);
      const newAvg = recentScores.slice(Math.floor(recentScores.length / 2))
        .reduce((sum, s) => sum + s.combinedScore, 0) / (recentScores.length - Math.floor(recentScores.length / 2));

      history.momentum = newAvg - oldAvg;
    }

    // Calculate volatility (standard deviation)
    if (history.scores.length >= 3) {
      const mean = history.scores.reduce((sum, s) => sum + s.combinedScore, 0) / history.scores.length;
      const variance = history.scores.reduce((sum, s) => sum + Math.pow(s.combinedScore - mean, 2), 0) / history.scores.length;
      history.volatility = Math.sqrt(variance);
    }
  }

  getAggregateSentiment(symbol: string): { score: number; confidence: number; momentum: number } {
    const history = this.sentimentHistory.get(symbol);

    if (!history || history.scores.length === 0) {
      return { score: 0, confidence: 0, momentum: 0 };
    }

    const now = Date.now();
    const decayMs = this.config.sentimentDecayHours * 3600000;

    // Time-decayed weighted average
    let weightedSum = 0;
    let weightTotal = 0;

    for (const score of history.scores) {
      const ageHours = (now - score.timestamp.getTime()) / 3600000;
      const decayWeight = Math.exp(-ageHours / this.config.sentimentDecayHours);

      weightedSum += score.combinedScore * score.confidence * decayWeight;
      weightTotal += score.confidence * decayWeight;
    }

    const aggregate = weightTotal > 0 ? weightedSum / weightTotal : 0;

    // Confidence based on number of scores and recency
    const scoreCount = history.scores.length;
    const recencyBonus = history.scores.some(s =>
      now - s.timestamp.getTime() < 3600000 // News in last hour
    ) ? 0.2 : 0;

    const confidence = Math.min(
      (scoreCount / this.config.minNewsForSignal) * 0.5 + recencyBonus,
      1.0
    );

    return {
      score: aggregate,
      confidence,
      momentum: history.momentum,
    };
  }

  // ==================== TECHNICAL SIGNALS ====================

  updateTechnicalSignal(symbol: string, signal: SignalStrength, confidence: number, source: string): void {
    let signals = this.technicalSignals.get(symbol);

    if (!signals) {
      signals = [];
      this.technicalSignals.set(symbol, signals);
    }

    signals.push({
      signal,
      confidence,
      source,
      timestamp: new Date(),
    });

    // Keep only last 30 minutes of signals
    const cutoff = Date.now() - 1800000;
    this.technicalSignals.set(
      symbol,
      signals.filter(s => s.timestamp.getTime() > cutoff)
    );
  }

  getAggregateTechnical(symbol: string): { score: number; confidence: number } {
    const signals = this.technicalSignals.get(symbol);

    if (!signals || signals.length === 0) {
      return { score: 0, confidence: 0 };
    }

    const now = Date.now();
    let weightedSum = 0;
    let weightTotal = 0;

    for (const signal of signals) {
      const ageMinutes = (now - signal.timestamp.getTime()) / 60000;
      if (ageMinutes > 30) continue; // Signals older than 30 min are stale

      const decayWeight = Math.exp(-ageMinutes / 15); // 15 min half-life
      weightedSum += signal.signal * signal.confidence * decayWeight;
      weightTotal += signal.confidence * decayWeight;
    }

    if (weightTotal === 0) {
      return { score: 0, confidence: 0 };
    }

    const aggregate = weightedSum / weightTotal;
    const confidence = Math.min(weightTotal / 2, 1.0);

    return { score: aggregate, confidence };
  }

  // ==================== DECISION MAKING ====================

  makeDecision(
    symbol: string,
    currentPrice: number,
    position?: { qty: number; avgEntryPrice: number },
    marketContext?: Record<string, unknown>
  ): EnhancedDecision {
    // Get sentiment signal
    const sentiment = this.getAggregateSentiment(symbol);

    // Get technical signal
    const technical = this.getAggregateTechnical(symbol);

    // Combine signals
    let combinedScore: number;
    let combinedConfidence: number;

    if (sentiment.confidence > 0 && technical.confidence > 0) {
      combinedScore = (
        this.config.newsWeight * sentiment.score * sentiment.confidence +
        this.config.technicalWeight * technical.score * technical.confidence
      ) / (this.config.newsWeight * sentiment.confidence + this.config.technicalWeight * technical.confidence);

      combinedConfidence = (sentiment.confidence + technical.confidence) / 2;
    } else if (technical.confidence > 0) {
      combinedScore = technical.score;
      combinedConfidence = technical.confidence * 0.8; // Reduced without news confirmation
    } else if (sentiment.confidence > 0) {
      combinedScore = sentiment.score;
      combinedConfidence = sentiment.confidence * 0.6; // News alone is less reliable
    } else {
      combinedScore = 0;
      combinedConfidence = 0;
    }

    // Determine signal alignment
    let alignment: "aligned" | "divergent" | "neutral" = "neutral";
    if (sentiment.confidence > 0.3 && technical.confidence > 0.3) {
      const signSentiment = Math.sign(sentiment.score);
      const signTechnical = Math.sign(technical.score);

      if (signSentiment === signTechnical && signSentiment !== 0) {
        alignment = "aligned";
        combinedConfidence *= 1.1; // Boost confidence when aligned
      } else if (signSentiment !== 0 && signTechnical !== 0 && signSentiment !== signTechnical) {
        alignment = "divergent";
        combinedConfidence *= 0.7; // Reduce confidence when divergent
      }
    }

    // Get latest headline for context
    const history = this.sentimentHistory.get(symbol);
    const latestHeadline = history?.scores[history.scores.length - 1]?.newsId;

    // Determine decision type
    const { decisionType, sizeMultiplier } = this.determineDecision(
      combinedScore,
      combinedConfidence,
      position,
      currentPrice
    );

    // Calculate price targets
    const { entryPrice, takeProfitPrice, stopLossPrice } = this.calculatePriceTargets(
      decisionType,
      currentPrice,
      combinedScore,
      position
    );

    const decision: EnhancedDecision = {
      decisionType,
      symbol,
      confidence: Math.min(combinedConfidence, 1),
      suggestedSize: sizeMultiplier,
      entryPrice,
      takeProfitPrice,
      stopLossPrice,
      reasoning: {
        sentimentScore: sentiment.score,
        sentimentConfidence: sentiment.confidence,
        sentimentMomentum: sentiment.momentum,
        technicalScore: technical.score,
        technicalConfidence: technical.confidence,
        combinedScore,
        newsCount: history?.scores.length || 0,
        latestHeadline,
        alignment,
      },
      timestamp: new Date(),
      isActionable: combinedConfidence >= this.config.minConfidence && decisionType !== DecisionType.HOLD,
    };

    // Store in history
    this.decisionHistory.push(decision);
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory = this.decisionHistory.slice(-1000);
    }

    return decision;
  }

  private determineDecision(
    score: number,
    confidence: number,
    position?: { qty: number; avgEntryPrice: number },
    currentPrice?: number
  ): { decisionType: DecisionType; sizeMultiplier: number } {
    const hasPosition = position && position.qty !== 0;
    const isLong = hasPosition && position!.qty > 0;
    const isShort = hasPosition && position!.qty < 0;

    // Check for take profit conditions on existing positions
    if (hasPosition && currentPrice) {
      const entryPrice = position!.avgEntryPrice;
      const unrealizedPnlPct = ((currentPrice - entryPrice) / entryPrice) * 100;

      if (isLong && unrealizedPnlPct >= 2) {
        if (score < 0.5) { // Momentum weakening
          return { decisionType: DecisionType.TAKE_PROFIT, sizeMultiplier: 0.5 };
        }
        if (unrealizedPnlPct >= 5) {
          return { decisionType: DecisionType.TAKE_PROFIT, sizeMultiplier: 0.75 };
        }
      }

      if (isShort && unrealizedPnlPct <= -2) {
        if (score > -0.5) {
          return { decisionType: DecisionType.TAKE_PROFIT, sizeMultiplier: 0.5 };
        }
      }
    }

    // Entry/exit decisions based on score
    if (confidence < this.config.minConfidence) {
      return { decisionType: DecisionType.HOLD, sizeMultiplier: 0 };
    }

    if (score >= 1.5) { // Strong buy
      if (!hasPosition) {
        return { decisionType: DecisionType.ENTER_LONG, sizeMultiplier: 1.0 };
      } else if (isLong) {
        return { decisionType: DecisionType.SCALE_IN, sizeMultiplier: 0.5 };
      } else { // is short
        return { decisionType: DecisionType.EXIT_SHORT, sizeMultiplier: 1.0 };
      }
    } else if (score >= 0.5) { // Buy
      if (!hasPosition) {
        return { decisionType: DecisionType.ENTER_LONG, sizeMultiplier: 0.5 };
      } else if (isShort) {
        return { decisionType: DecisionType.EXIT_SHORT, sizeMultiplier: 0.5 };
      }
      return { decisionType: DecisionType.HOLD, sizeMultiplier: 0 };
    } else if (score <= -1.5) { // Strong sell
      if (!hasPosition) {
        return { decisionType: DecisionType.ENTER_SHORT, sizeMultiplier: 1.0 };
      } else if (isShort) {
        return { decisionType: DecisionType.SCALE_IN, sizeMultiplier: 0.5 };
      } else { // is long
        return { decisionType: DecisionType.EXIT_LONG, sizeMultiplier: 1.0 };
      }
    } else if (score <= -0.5) { // Sell
      if (!hasPosition) {
        return { decisionType: DecisionType.ENTER_SHORT, sizeMultiplier: 0.5 };
      } else if (isLong) {
        return { decisionType: DecisionType.EXIT_LONG, sizeMultiplier: 0.5 };
      }
      return { decisionType: DecisionType.HOLD, sizeMultiplier: 0 };
    }

    return { decisionType: DecisionType.HOLD, sizeMultiplier: 0 };
  }

  private calculatePriceTargets(
    decisionType: DecisionType,
    currentPrice: number,
    score: number,
    position?: { qty: number; avgEntryPrice: number }
  ): { entryPrice?: number; takeProfitPrice?: number; stopLossPrice?: number } {
    if (decisionType === DecisionType.HOLD || decisionType === DecisionType.TAKE_PROFIT) {
      return {};
    }

    // Dynamic targets based on signal strength
    const strength = Math.abs(score);

    if (decisionType === DecisionType.ENTER_LONG || (decisionType === DecisionType.SCALE_IN && score > 0)) {
      const entry = currentPrice;
      const takeProfit = currentPrice * (1 + 0.02 + 0.01 * strength); // 2-4% target
      const stopLoss = currentPrice * (1 - 0.01 - 0.005 * strength);  // 1-2% stop
      return { entryPrice: entry, takeProfitPrice: takeProfit, stopLossPrice: stopLoss };
    }

    if (decisionType === DecisionType.ENTER_SHORT || (decisionType === DecisionType.SCALE_IN && score < 0)) {
      const entry = currentPrice;
      const takeProfit = currentPrice * (1 - 0.02 - 0.01 * strength);
      const stopLoss = currentPrice * (1 + 0.01 + 0.005 * strength);
      return { entryPrice: entry, takeProfitPrice: takeProfit, stopLossPrice: stopLoss };
    }

    return { entryPrice: currentPrice };
  }

  // ==================== NEWS FETCHING ====================

  async fetchAndProcessNews(symbol: string, isCrypto: boolean = false): Promise<number> {
    let newsCount = 0;

    try {
      // Fetch from GDELT - uses analyzeSymbolSentiment which returns topHeadlines
      const gdeltResult = await gdelt.analyzeSymbolSentiment(symbol);

      if (gdeltResult && gdeltResult.topHeadlines) {
        for (const headline of gdeltResult.topHeadlines.slice(0, 5)) {
          const sentiment = this.analyzeSentiment(
            headline,
            undefined,
            `gdelt-${symbol}-${Date.now()}`,
            "gdelt",
            [symbol]
          );
          this.updateSentiment(symbol, sentiment);
          newsCount++;
        }
      }
    } catch (error) {
      log.debug("NewsEnhancedDecisionEngine", `GDELT fetch error for ${symbol}: ${error}`);
    }

    try {
      // Fetch from NewsAPI - searchNews returns NewsArticle[] directly
      const articles = await newsapi.searchNews(
        isCrypto ? `${symbol} crypto cryptocurrency` : `${symbol} stock market`,
        "relevancy",
        5
      );

      if (articles && articles.length > 0) {
        for (const article of articles) {
          const sentiment = this.analyzeSentiment(
            article.title || "",
            article.description ?? undefined,
            article.url || String(Date.now()),
            "newsapi",
            [symbol]
          );
          this.updateSentiment(symbol, sentiment);
          newsCount++;
        }
      }
    } catch (error) {
      log.debug("NewsEnhancedDecisionEngine", `NewsAPI fetch error for ${symbol}: ${error}`);
    }

    return newsCount;
  }

  // ==================== INTEGRATION WITH EXISTING SYSTEM ====================

  async makeEnhancedDecision(
    symbol: string,
    currentPrice: number,
    marketData?: Record<string, unknown>,
    position?: { qty: number; avgEntryPrice: number }
  ): Promise<{
    enhanced: EnhancedDecision;
    composite?: CompositeScore;
  }> {
    // Fetch fresh news
    const isCrypto = symbol.includes("/");
    await this.fetchAndProcessNews(symbol, isCrypto);

    // Make enhanced decision
    const enhanced = this.makeDecision(symbol, currentPrice, position, marketData);

    // Calculate composite score for integration with multi-factor scoring
    let composite: CompositeScore | undefined;
    try {
      const scoringInput: ScoringInput = {
        symbol,
        sentiment: {
          overallScore: enhanced.reasoning.sentimentScore,
        },
        technical: {
          price: currentPrice,
        },
        isCrypto,
      };

      composite = calculateCompositeScore(scoringInput);
    } catch (error) {
      log.debug("NewsEnhancedDecisionEngine", `Composite score error: ${error}`);
    }

    return { enhanced, composite };
  }

  // ==================== POSITION TRACKING ====================

  updatePosition(symbol: string, qty: number, avgEntryPrice: number): void {
    if (qty === 0) {
      this.positions.delete(symbol);
    } else {
      this.positions.set(symbol, { qty, avgEntryPrice });
    }
  }

  // ==================== STATUS & METRICS ====================

  getStatus(): {
    symbolsTracked: number;
    totalSentimentScores: number;
    totalTechnicalSignals: number;
    decisionsInHistory: number;
    config: NewsEnhancedConfig;
  } {
    let totalSentiment = 0;
    let totalTechnical = 0;

    for (const history of this.sentimentHistory.values()) {
      totalSentiment += history.scores.length;
    }

    for (const signals of this.technicalSignals.values()) {
      totalTechnical += signals.length;
    }

    return {
      symbolsTracked: this.sentimentHistory.size,
      totalSentimentScores: totalSentiment,
      totalTechnicalSignals: totalTechnical,
      decisionsInHistory: this.decisionHistory.length,
      config: this.config,
    };
  }

  getSentimentSummary(symbol: string): SentimentHistory | undefined {
    return this.sentimentHistory.get(symbol);
  }

  getRecentDecisions(limit: number = 10): EnhancedDecision[] {
    return this.decisionHistory.slice(-limit);
  }
}

// Export singleton instance
export const newsEnhancedDecisionEngine = new NewsEnhancedDecisionEngine();
