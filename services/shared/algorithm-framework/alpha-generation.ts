/**
 * AI Active Trader - Alpha Generation Module
 * Generates trading insights/signals with expected returns
 */

import { createLogger } from '../common';
import type { Security, Insight, AlgorithmContext, AlphaResult } from './types';

const logger = createLogger('alpha-generation');

export interface AlphaModel {
  name: string;
  type: 'momentum' | 'mean_reversion' | 'trend' | 'sentiment' | 'ml' | 'composite';
  weight: number;
  generate: (securities: Security[], context: AlgorithmContext) => Promise<Insight[]>;
}

export interface AlphaGenerationConfig {
  models: AlphaModel[];
  insightExpiry: number;
  minConfidence: number;
  maxInsightsPerSymbol: number;
  combineMethod: 'weighted_average' | 'highest_confidence' | 'voting';
}

const generateInsightId = (): string => {
  return `insight_${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

const BUILT_IN_ALPHA_MODELS: Record<string, AlphaModel> = {
  momentum: {
    name: 'momentum',
    type: 'momentum',
    weight: 1.0,
    generate: async (securities, context) => {
      const insights: Insight[] = [];

      for (const security of securities) {
        if (!security.technicals) continue;

        const { sma20, sma50, sma200, rsi14 } = security.technicals;
        
        if (!sma20 || !sma50) continue;

        let direction: 'up' | 'down' | 'flat' = 'flat';
        let magnitude = 0;
        let confidence = 0.5;

        const shortTermTrend = security.price > sma20;
        const mediumTermTrend = sma20 > sma50;
        const longTermTrend = sma200 ? security.price > sma200 : true;

        if (shortTermTrend && mediumTermTrend && longTermTrend) {
          direction = 'up';
          magnitude = (security.price / sma50 - 1) * 2;
          confidence = 0.6;
          
          if (rsi14 && rsi14 > 30 && rsi14 < 70) {
            confidence += 0.1;
          }
        } else if (!shortTermTrend && !mediumTermTrend && !longTermTrend) {
          direction = 'down';
          magnitude = (sma50 / security.price - 1) * 2;
          confidence = 0.6;
        }

        if (direction !== 'flat' && confidence >= 0.5) {
          insights.push({
            id: generateInsightId(),
            symbol: security.symbol,
            direction,
            magnitude: Math.min(Math.abs(magnitude), 1),
            confidence,
            period: 5,
            source: 'momentum',
            generatedAt: context.currentTime,
          });
        }
      }

      return insights;
    },
  },

  meanReversion: {
    name: 'meanReversion',
    type: 'mean_reversion',
    weight: 1.0,
    generate: async (securities, context) => {
      const insights: Insight[] = [];

      for (const security of securities) {
        if (!security.technicals) continue;

        const { rsi14, bollingerUpper, bollingerLower, sma20 } = security.technicals;

        let direction: 'up' | 'down' | 'flat' = 'flat';
        let magnitude = 0;
        let confidence = 0.5;

        if (rsi14 && rsi14 < 30) {
          direction = 'up';
          magnitude = (30 - rsi14) / 30;
          confidence = 0.55 + (30 - rsi14) / 100;
        } else if (rsi14 && rsi14 > 70) {
          direction = 'down';
          magnitude = (rsi14 - 70) / 30;
          confidence = 0.55 + (rsi14 - 70) / 100;
        }

        if (bollingerLower && security.price < bollingerLower && sma20) {
          direction = 'up';
          magnitude = Math.max(magnitude, (bollingerLower - security.price) / security.price);
          confidence = Math.max(confidence, 0.6);
        } else if (bollingerUpper && security.price > bollingerUpper && sma20) {
          direction = 'down';
          magnitude = Math.max(magnitude, (security.price - bollingerUpper) / security.price);
          confidence = Math.max(confidence, 0.6);
        }

        if (direction !== 'flat' && confidence >= 0.5) {
          insights.push({
            id: generateInsightId(),
            symbol: security.symbol,
            direction,
            magnitude: Math.min(magnitude, 1),
            confidence: Math.min(confidence, 0.9),
            period: 3,
            source: 'meanReversion',
            generatedAt: context.currentTime,
          });
        }
      }

      return insights;
    },
  },

  trendFollowing: {
    name: 'trendFollowing',
    type: 'trend',
    weight: 1.0,
    generate: async (securities, context) => {
      const insights: Insight[] = [];

      for (const security of securities) {
        if (!security.technicals) continue;

        const { macdLine, macdSignal, atr14, sma200 } = security.technicals;

        if (macdLine === undefined || macdSignal === undefined) continue;

        let direction: 'up' | 'down' | 'flat' = 'flat';
        let magnitude = 0;
        let confidence = 0.5;

        const macdCrossUp = macdLine > macdSignal && macdLine > 0;
        const macdCrossDown = macdLine < macdSignal && macdLine < 0;
        const aboveSma200 = sma200 ? security.price > sma200 : true;

        if (macdCrossUp && aboveSma200) {
          direction = 'up';
          magnitude = Math.abs(macdLine - macdSignal) / (atr14 || 1);
          confidence = 0.6;
        } else if (macdCrossDown && !aboveSma200) {
          direction = 'down';
          magnitude = Math.abs(macdLine - macdSignal) / (atr14 || 1);
          confidence = 0.6;
        }

        if (direction !== 'flat') {
          insights.push({
            id: generateInsightId(),
            symbol: security.symbol,
            direction,
            magnitude: Math.min(magnitude, 1),
            confidence,
            period: 10,
            source: 'trendFollowing',
            generatedAt: context.currentTime,
          });
        }
      }

      return insights;
    },
  },

  volumeBreakout: {
    name: 'volumeBreakout',
    type: 'momentum',
    weight: 0.8,
    generate: async (securities, context) => {
      const insights: Insight[] = [];
      const avgVolumeMultiplier = (context.state.parameters.volumeBreakoutMultiplier as number) || 2;

      for (const security of securities) {
        if (!security.technicals) continue;

        const { sma20, bollingerUpper, atr14 } = security.technicals;
        
        if (!sma20) continue;

        let direction: 'up' | 'down' | 'flat' = 'flat';
        let magnitude = 0;
        let confidence = 0.5;

        const priceAbove20 = security.price > sma20;
        const nearBreakout = bollingerUpper && security.price > bollingerUpper * 0.98;

        if (priceAbove20 && nearBreakout) {
          direction = 'up';
          magnitude = (security.price / sma20 - 1);
          confidence = 0.55;

          if (atr14 && security.price > sma20 + atr14) {
            confidence += 0.1;
          }
        }

        if (direction !== 'flat') {
          insights.push({
            id: generateInsightId(),
            symbol: security.symbol,
            direction,
            magnitude: Math.min(magnitude, 1),
            confidence,
            period: 5,
            source: 'volumeBreakout',
            generatedAt: context.currentTime,
          });
        }
      }

      return insights;
    },
  },

  fundamentalValue: {
    name: 'fundamentalValue',
    type: 'mean_reversion',
    weight: 0.7,
    generate: async (securities, context) => {
      const insights: Insight[] = [];

      for (const security of securities) {
        if (!security.fundamentals) continue;

        const { peRatio, pbRatio, returnOnEquity, earningsGrowth } = security.fundamentals;

        let direction: 'up' | 'down' | 'flat' = 'flat';
        let magnitude = 0;
        let confidence = 0.5;
        let signals = 0;

        if (peRatio && peRatio > 0 && peRatio < 15) {
          signals++;
          direction = 'up';
        }

        if (pbRatio && pbRatio > 0 && pbRatio < 2) {
          signals++;
          direction = 'up';
        }

        if (returnOnEquity && returnOnEquity > 0.15) {
          signals++;
          direction = 'up';
        }

        if (earningsGrowth && earningsGrowth > 0.1) {
          signals++;
          direction = 'up';
        }

        if (signals >= 2) {
          magnitude = signals / 4;
          confidence = 0.5 + signals * 0.1;

          insights.push({
            id: generateInsightId(),
            symbol: security.symbol,
            direction,
            magnitude,
            confidence: Math.min(confidence, 0.85),
            period: 20,
            source: 'fundamentalValue',
            generatedAt: context.currentTime,
          });
        }
      }

      return insights;
    },
  },
};

export class AlphaGenerationModule {
  private config: AlphaGenerationConfig;
  private customModels: Map<string, AlphaModel> = new Map();
  private activeInsights: Map<string, Insight[]> = new Map();

  constructor(config: Partial<AlphaGenerationConfig> = {}) {
    this.config = {
      models: config.models || [BUILT_IN_ALPHA_MODELS.momentum],
      insightExpiry: config.insightExpiry || 86400000,
      minConfidence: config.minConfidence || 0.5,
      maxInsightsPerSymbol: config.maxInsightsPerSymbol || 3,
      combineMethod: config.combineMethod || 'weighted_average',
    };
    logger.info('Alpha Generation Module initialized', { models: this.config.models.map(m => m.name) });
  }

  registerModel(model: AlphaModel): void {
    this.customModels.set(model.name, model);
    logger.info('Custom alpha model registered', { name: model.name, type: model.type });
  }

  getBuiltInModel(name: string): AlphaModel | undefined {
    return BUILT_IN_ALPHA_MODELS[name];
  }

  async generate(securities: Security[], context: AlgorithmContext): Promise<AlphaResult> {
    this.cleanExpiredInsights(context.currentTime);

    const allInsights: Insight[] = [];
    const models = [
      ...this.config.models,
      ...Array.from(this.customModels.values()),
    ];

    for (const model of models) {
      try {
        const modelInsights = await model.generate(securities, context);
        
        for (const insight of modelInsights) {
          insight.weight = model.weight;
          insight.tag = model.name;
        }
        
        allInsights.push(...modelInsights);
        logger.debug('Model generated insights', { model: model.name, count: modelInsights.length });
      } catch (err) {
        logger.error('Alpha model failed', err as Error, { model: model.name });
      }
    }

    const combinedInsights = this.combineInsights(allInsights);

    const filteredInsights = combinedInsights.filter(i => i.confidence >= this.config.minConfidence);

    for (const insight of filteredInsights) {
      const existing = this.activeInsights.get(insight.symbol) || [];
      existing.push(insight);
      
      if (existing.length > this.config.maxInsightsPerSymbol) {
        existing.sort((a, b) => b.confidence - a.confidence);
        existing.splice(this.config.maxInsightsPerSymbol);
      }
      
      this.activeInsights.set(insight.symbol, existing);
    }

    logger.info('Alpha generation complete', {
      total: filteredInsights.length,
      symbols: new Set(filteredInsights.map(i => i.symbol)).size,
    });

    return { insights: filteredInsights };
  }

  private combineInsights(insights: Insight[]): Insight[] {
    const bySymbol = new Map<string, Insight[]>();
    
    for (const insight of insights) {
      const existing = bySymbol.get(insight.symbol) || [];
      existing.push(insight);
      bySymbol.set(insight.symbol, existing);
    }

    const combined: Insight[] = [];

    for (const [symbol, symbolInsights] of bySymbol) {
      if (symbolInsights.length === 1) {
        combined.push(symbolInsights[0]);
        continue;
      }

      switch (this.config.combineMethod) {
        case 'highest_confidence':
          symbolInsights.sort((a, b) => b.confidence - a.confidence);
          combined.push(symbolInsights[0]);
          break;

        case 'voting': {
          const upVotes = symbolInsights.filter(i => i.direction === 'up').length;
          const downVotes = symbolInsights.filter(i => i.direction === 'down').length;
          const total = symbolInsights.length;
          
          if (upVotes > downVotes && upVotes > total / 2) {
            const upInsights = symbolInsights.filter(i => i.direction === 'up');
            combined.push({
              ...upInsights[0],
              confidence: upVotes / total,
              source: 'voting_combined',
            });
          } else if (downVotes > upVotes && downVotes > total / 2) {
            const downInsights = symbolInsights.filter(i => i.direction === 'down');
            combined.push({
              ...downInsights[0],
              confidence: downVotes / total,
              source: 'voting_combined',
            });
          }
          break;
        }

        case 'weighted_average':
        default: {
          let totalWeight = 0;
          let weightedMagnitude = 0;
          let weightedConfidence = 0;
          let upWeight = 0;
          let downWeight = 0;

          for (const insight of symbolInsights) {
            const weight = insight.weight || 1;
            totalWeight += weight;
            weightedMagnitude += insight.magnitude * weight;
            weightedConfidence += insight.confidence * weight;
            
            if (insight.direction === 'up') upWeight += weight;
            else if (insight.direction === 'down') downWeight += weight;
          }

          const direction = upWeight > downWeight ? 'up' : downWeight > upWeight ? 'down' : 'flat';
          
          if (direction !== 'flat') {
            combined.push({
              id: generateInsightId(),
              symbol,
              direction,
              magnitude: weightedMagnitude / totalWeight,
              confidence: weightedConfidence / totalWeight,
              period: Math.round(symbolInsights.reduce((a, i) => a + i.period, 0) / symbolInsights.length),
              source: 'weighted_combined',
              generatedAt: symbolInsights[0].generatedAt,
            });
          }
          break;
        }
      }
    }

    return combined;
  }

  private cleanExpiredInsights(currentTime: Date): void {
    const cutoff = currentTime.getTime() - this.config.insightExpiry;

    for (const [symbol, insights] of this.activeInsights) {
      const valid = insights.filter(i => i.generatedAt.getTime() > cutoff);
      if (valid.length === 0) {
        this.activeInsights.delete(symbol);
      } else {
        this.activeInsights.set(symbol, valid);
      }
    }
  }

  getActiveInsights(): Insight[] {
    return Array.from(this.activeInsights.values()).flat();
  }

  getInsightsForSymbol(symbol: string): Insight[] {
    return this.activeInsights.get(symbol) || [];
  }

  clearInsights(): void {
    this.activeInsights.clear();
  }
}

export const createMomentumAlpha = (): AlphaGenerationModule => {
  return new AlphaGenerationModule({
    models: [
      BUILT_IN_ALPHA_MODELS.momentum,
      BUILT_IN_ALPHA_MODELS.trendFollowing,
    ],
    combineMethod: 'weighted_average',
    minConfidence: 0.55,
  });
};

export const createMeanReversionAlpha = (): AlphaGenerationModule => {
  return new AlphaGenerationModule({
    models: [
      BUILT_IN_ALPHA_MODELS.meanReversion,
      BUILT_IN_ALPHA_MODELS.fundamentalValue,
    ],
    combineMethod: 'weighted_average',
    minConfidence: 0.5,
  });
};

export const createMultiFactorAlpha = (): AlphaGenerationModule => {
  return new AlphaGenerationModule({
    models: [
      BUILT_IN_ALPHA_MODELS.momentum,
      BUILT_IN_ALPHA_MODELS.meanReversion,
      BUILT_IN_ALPHA_MODELS.trendFollowing,
      BUILT_IN_ALPHA_MODELS.fundamentalValue,
    ],
    combineMethod: 'voting',
    minConfidence: 0.6,
  });
};
