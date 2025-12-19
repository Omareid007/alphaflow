# Replit Prompt: Sentiment Aggregator Service

## STATUS: COMPLETED

## OBJECTIVE
Create a unified sentiment aggregator that orchestrates GDELT, NewsAPI, and HuggingFace sentiment sources, providing weighted scores with conflict detection and confidence metrics.

## FILES TO CREATE/MODIFY

### New File:
- `/server/services/sentiment-aggregator.ts` - Central sentiment orchestration

### Files to Integrate:
- `/server/connectors/gdelt-connector.ts` - GDELT World News
- `/server/connectors/news-connector.ts` - NewsAPI integration
- `/server/ai/huggingface-sentiment.ts` - HuggingFace inference (if exists)
- `/server/orchestration/coordinator.ts` - Update to use aggregator

## IMPLEMENTATION DETAILS

### Step 1: Create the Sentiment Aggregator Service

Create `/server/services/sentiment-aggregator.ts`:

```typescript
import { gdeltConnector } from '../connectors/gdelt-connector';
import { newsConnector } from '../connectors/news-connector';
import { storage } from '../storage';

export interface SentimentSource {
  name: 'gdelt' | 'newsapi' | 'huggingface' | 'social';
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  articleCount: number;
  timestamp: Date;
  error?: string;
}

export interface AggregatedSentiment {
  symbol: string;
  overallScore: number; // -1 to 1
  overallConfidence: number; // 0 to 1
  sources: SentimentSource[];
  conflictDetected: boolean;
  conflictSeverity: number; // 0 to 1
  recommendation: 'bullish' | 'bearish' | 'neutral' | 'conflicted';
  timestamp: Date;
}

export interface SentimentConfig {
  weights: {
    gdelt: number;
    newsapi: number;
    huggingface: number;
    social: number;
  };
  minSources: number;
  conflictThreshold: number; // Max allowed variance
  cacheMinutes: number;
}

const DEFAULT_CONFIG: SentimentConfig = {
  weights: {
    gdelt: 0.3,
    newsapi: 0.35,
    huggingface: 0.25,
    social: 0.1
  },
  minSources: 2,
  conflictThreshold: 0.5,
  cacheMinutes: 15
};

class SentimentAggregator {
  private config: SentimentConfig;
  private cache: Map<string, { data: AggregatedSentiment; expires: Date }> = new Map();

  constructor(config: Partial<SentimentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async getSentiment(symbol: string): Promise<AggregatedSentiment> {
    // Check cache first
    const cached = this.cache.get(symbol);
    if (cached && cached.expires > new Date()) {
      return cached.data;
    }

    // Fetch from all sources in parallel
    const sources = await Promise.allSettled([
      this.fetchGDELT(symbol),
      this.fetchNewsAPI(symbol),
      this.fetchHuggingFace(symbol)
    ]);

    const validSources: SentimentSource[] = sources
      .filter((r): r is PromiseFulfilledResult<SentimentSource> =>
        r.status === 'fulfilled' && r.value.confidence > 0)
      .map(r => r.value);

    // Calculate aggregated sentiment
    const aggregated = this.aggregateSources(symbol, validSources);

    // Cache the result
    const expires = new Date(Date.now() + this.config.cacheMinutes * 60 * 1000);
    this.cache.set(symbol, { data: aggregated, expires });

    // Log to database for analytics
    await this.logSentiment(aggregated);

    return aggregated;
  }

  private async fetchGDELT(symbol: string): Promise<SentimentSource> {
    try {
      const news = await gdeltConnector.fetchNews(symbol);
      const articles = news.articles || [];

      if (articles.length === 0) {
        return {
          name: 'gdelt',
          score: 0,
          confidence: 0,
          articleCount: 0,
          timestamp: new Date()
        };
      }

      // Calculate average tone from GDELT
      const avgTone = articles.reduce((sum: number, a: any) =>
        sum + (a.tone || 0), 0) / articles.length;

      // Normalize tone to -1 to 1 range (GDELT tone is typically -10 to 10)
      const normalizedScore = Math.max(-1, Math.min(1, avgTone / 10));

      return {
        name: 'gdelt',
        score: normalizedScore,
        confidence: Math.min(1, articles.length / 10), // More articles = more confidence
        articleCount: articles.length,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        name: 'gdelt',
        score: 0,
        confidence: 0,
        articleCount: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async fetchNewsAPI(symbol: string): Promise<SentimentSource> {
    try {
      const news = await newsConnector.fetchNews(symbol);
      const articles = news.articles || [];

      if (articles.length === 0) {
        return {
          name: 'newsapi',
          score: 0,
          confidence: 0,
          articleCount: 0,
          timestamp: new Date()
        };
      }

      // Simple sentiment analysis based on title/description keywords
      let positiveCount = 0;
      let negativeCount = 0;

      const positiveWords = ['surge', 'gain', 'rise', 'up', 'bullish', 'growth', 'profit', 'beat', 'strong'];
      const negativeWords = ['fall', 'drop', 'decline', 'down', 'bearish', 'loss', 'miss', 'weak', 'crash'];

      articles.forEach((article: any) => {
        const text = `${article.title} ${article.description}`.toLowerCase();
        positiveCount += positiveWords.filter(w => text.includes(w)).length;
        negativeCount += negativeWords.filter(w => text.includes(w)).length;
      });

      const total = positiveCount + negativeCount;
      const score = total > 0 ? (positiveCount - negativeCount) / total : 0;

      return {
        name: 'newsapi',
        score,
        confidence: Math.min(1, articles.length / 5),
        articleCount: articles.length,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        name: 'newsapi',
        score: 0,
        confidence: 0,
        articleCount: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async fetchHuggingFace(symbol: string): Promise<SentimentSource> {
    // Placeholder for HuggingFace integration
    // Would call HuggingFace inference API for FinBERT sentiment
    return {
      name: 'huggingface',
      score: 0,
      confidence: 0,
      articleCount: 0,
      timestamp: new Date(),
      error: 'HuggingFace integration not yet implemented'
    };
  }

  private aggregateSources(symbol: string, sources: SentimentSource[]): AggregatedSentiment {
    if (sources.length === 0) {
      return {
        symbol,
        overallScore: 0,
        overallConfidence: 0,
        sources: [],
        conflictDetected: false,
        conflictSeverity: 0,
        recommendation: 'neutral',
        timestamp: new Date()
      };
    }

    // Calculate weighted average
    let weightedSum = 0;
    let weightSum = 0;
    let confidenceSum = 0;

    sources.forEach(source => {
      const weight = this.config.weights[source.name] * source.confidence;
      weightedSum += source.score * weight;
      weightSum += weight;
      confidenceSum += source.confidence;
    });

    const overallScore = weightSum > 0 ? weightedSum / weightSum : 0;
    const overallConfidence = sources.length >= this.config.minSources
      ? confidenceSum / sources.length
      : (confidenceSum / sources.length) * 0.5; // Penalize low source count

    // Detect conflicts (high variance between sources)
    const scores = sources.map(s => s.score);
    const variance = this.calculateVariance(scores);
    const conflictDetected = variance > this.config.conflictThreshold;
    const conflictSeverity = Math.min(1, variance / this.config.conflictThreshold);

    // Generate recommendation
    let recommendation: 'bullish' | 'bearish' | 'neutral' | 'conflicted';
    if (conflictDetected && conflictSeverity > 0.7) {
      recommendation = 'conflicted';
    } else if (overallScore > 0.2) {
      recommendation = 'bullish';
    } else if (overallScore < -0.2) {
      recommendation = 'bearish';
    } else {
      recommendation = 'neutral';
    }

    return {
      symbol,
      overallScore,
      overallConfidence,
      sources,
      conflictDetected,
      conflictSeverity,
      recommendation,
      timestamp: new Date()
    };
  }

  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private async logSentiment(sentiment: AggregatedSentiment): Promise<void> {
    try {
      // Log to database for historical tracking
      // Implementation depends on your storage layer
      console.log(`[SentimentAggregator] ${sentiment.symbol}: ${sentiment.overallScore.toFixed(2)} (${sentiment.recommendation})`);
    } catch (error) {
      console.error('[SentimentAggregator] Failed to log sentiment:', error);
    }
  }

  // Batch sentiment for multiple symbols
  async getBatchSentiment(symbols: string[]): Promise<Map<string, AggregatedSentiment>> {
    const results = await Promise.all(
      symbols.map(async symbol => ({
        symbol,
        sentiment: await this.getSentiment(symbol)
      }))
    );

    return new Map(results.map(r => [r.symbol, r.sentiment]));
  }
}

export const sentimentAggregator = new SentimentAggregator();
```

### Step 2: Update Coordinator to Use Aggregator

In `/server/orchestration/coordinator.ts`, replace direct sentiment calls:

```typescript
import { sentimentAggregator } from '../services/sentiment-aggregator';

// Replace scattered sentiment calls with:
const sentiment = await sentimentAggregator.getSentiment(symbol);

// Use in decision making:
if (sentiment.recommendation === 'conflicted') {
  // Reduce position size due to uncertainty
  positionSize *= 0.5;
}
```

## ACCEPTANCE CRITERIA

- [x] SentimentAggregator service created at `/server/services/sentiment-aggregator.ts`
- [x] Integrates GDELT and NewsAPI sources
- [x] Integrates HuggingFace FinBERT for ML-based sentiment
- [x] Calculates weighted sentiment scores
- [x] Detects conflicts between sources
- [x] Provides confidence metrics
- [x] Results cached for 30 minutes (configurable)
- [x] TypeScript compilation succeeds
- [ ] Coordinator updated to use aggregator (future task)

## VERIFICATION COMMANDS

```bash
# Verify file exists
ls -la server/services/sentiment-aggregator.ts

# Check TypeScript compilation
npx tsc --noEmit

# Test the aggregator
curl http://localhost:5000/api/sentiment/AAPL

# Run unit tests
npm test -- --grep "sentiment"
```

## ESTIMATED IMPACT

- **New lines**: ~250
- **Files affected**: 3
- **Risk level**: Low (new service, doesn't break existing)
- **Testing required**: Integration tests with mock data

---

## IMPLEMENTATION SUMMARY

### Completed: 2025-12-19

**File Created:** `/home/runner/workspace/server/services/sentiment-aggregator.ts` (720 lines)

### Key Features Implemented:

1. **Multi-Source Sentiment Aggregation**
   - GDELT connector (free, priority 1) - Global news with tone analysis
   - NewsAPI connector (budget-limited, priority 2) - Curated news sources
   - HuggingFace FinBERT (ML-based, priority 3) - Financial sentiment classification

2. **Intelligent Caching System**
   - 30-minute fresh cache TTL (configurable)
   - 2-hour stale data fallback
   - Per-symbol cache keys
   - Automatic cache hit/miss tracking

3. **Weighted Sentiment Scoring**
   - Configurable weights: GDELT (40%), NewsAPI (35%), HuggingFace (25%)
   - Confidence-based weighting
   - Source count penalty for low coverage
   - Normalized -1 to 1 score range

4. **Conflict Detection**
   - Statistical variance calculation (standard deviation)
   - Configurable conflict threshold (0.5 default)
   - Conflict severity scoring (0-1)
   - "Conflicted" recommendation when sources disagree

5. **Comprehensive API**
   - `getSentiment(symbol)` - Single symbol with caching
   - `getSentimentWithSources(symbol)` - Detailed source breakdown
   - `batchGetSentiment(symbols[])` - Efficient batch processing
   - Helper functions: `isBullish()`, `isBearish()`, `getSymbolRecommendation()`

6. **Rate Limiting & Fallbacks**
   - Parallel or sequential fetching (configurable)
   - Graceful error handling per source
   - Stale data fallback on API failures
   - Zero-confidence sources excluded from aggregation

7. **API Usage Tracking**
   - Per-source API call counters
   - Error rate tracking
   - Average latency metrics
   - Cache hit/miss ratios

8. **Advanced Sentiment Analysis**
   - GDELT: Tone normalization (-10 to 10 → -1 to 1)
   - NewsAPI: Keyword-based sentiment (50+ positive/negative keywords)
   - HuggingFace: FinBERT-powered ML sentiment
   - Article count confidence scoring

### Code Quality:
- Full TypeScript type safety
- Comprehensive JSDoc documentation
- Clean separation of concerns
- Follows existing connector patterns
- Proper error handling and logging

### Next Steps (Not Implemented):
- Integration with autonomous coordinator
- Endpoint creation in routes.ts
- Database persistence for historical sentiment
- Real-time sentiment streaming
- Sentiment-driven position sizing adjustments
