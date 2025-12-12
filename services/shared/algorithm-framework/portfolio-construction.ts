/**
 * AI Active Trader - Portfolio Construction Module
 * Determines position sizing based on insights
 */

import { createLogger } from '../common';
import type { Insight, PortfolioTarget, AlgorithmContext, PortfolioConstructionResult } from './types';

const logger = createLogger('portfolio-construction');

export interface PortfolioConstructor {
  name: string;
  type: 'equal_weight' | 'market_cap' | 'risk_parity' | 'mean_variance' | 'black_litterman' | 'custom';
  construct: (insights: Insight[], context: AlgorithmContext) => Promise<PortfolioTarget[]>;
}

export interface PortfolioConstructionConfig {
  constructor: PortfolioConstructor;
  rebalanceThreshold: number;
  maxPositionWeight: number;
  minPositionWeight: number;
  maxLongExposure: number;
  maxShortExposure: number;
  targetCashWeight: number;
  concentrationLimit: number;
}

const BUILT_IN_CONSTRUCTORS: Record<string, PortfolioConstructor> = {
  equalWeight: {
    name: 'equalWeight',
    type: 'equal_weight',
    construct: async (insights, context) => {
      const targets: PortfolioTarget[] = [];
      const longInsights = insights.filter(i => i.direction === 'up');
      const shortInsights = insights.filter(i => i.direction === 'down');
      
      if (longInsights.length === 0 && shortInsights.length === 0) {
        return targets;
      }

      const longWeight = longInsights.length > 0 ? 0.9 / longInsights.length : 0;
      const shortWeight = shortInsights.length > 0 ? 0.1 / shortInsights.length : 0;

      for (const insight of longInsights) {
        const security = context.state.securities.get(insight.symbol);
        if (!security) continue;

        const value = context.state.portfolio.equity * longWeight;
        const quantity = Math.floor(value / security.price);

        if (quantity > 0) {
          targets.push({
            symbol: insight.symbol,
            quantity,
            direction: 'long',
            weight: longWeight,
          });
        }
      }

      for (const insight of shortInsights) {
        const security = context.state.securities.get(insight.symbol);
        if (!security) continue;

        const value = context.state.portfolio.equity * shortWeight;
        const quantity = Math.floor(value / security.price);

        if (quantity > 0) {
          targets.push({
            symbol: insight.symbol,
            quantity,
            direction: 'short',
            weight: shortWeight,
          });
        }
      }

      return targets;
    },
  },

  insightWeighted: {
    name: 'insightWeighted',
    type: 'custom',
    construct: async (insights, context) => {
      const targets: PortfolioTarget[] = [];
      const longInsights = insights.filter(i => i.direction === 'up');
      const shortInsights = insights.filter(i => i.direction === 'down');

      const totalLongScore = longInsights.reduce((sum, i) => sum + i.confidence * i.magnitude, 0);
      const totalShortScore = shortInsights.reduce((sum, i) => sum + i.confidence * i.magnitude, 0);

      const longBudget = 0.9 * context.state.portfolio.equity;
      const shortBudget = 0.1 * context.state.portfolio.equity;

      for (const insight of longInsights) {
        const security = context.state.securities.get(insight.symbol);
        if (!security) continue;

        const score = insight.confidence * insight.magnitude;
        const weight = totalLongScore > 0 ? score / totalLongScore : 0;
        const value = longBudget * weight;
        const quantity = Math.floor(value / security.price);

        if (quantity > 0) {
          targets.push({
            symbol: insight.symbol,
            quantity,
            direction: 'long',
            weight: (value / context.state.portfolio.equity),
          });
        }
      }

      for (const insight of shortInsights) {
        const security = context.state.securities.get(insight.symbol);
        if (!security) continue;

        const score = insight.confidence * insight.magnitude;
        const weight = totalShortScore > 0 ? score / totalShortScore : 0;
        const value = shortBudget * weight;
        const quantity = Math.floor(value / security.price);

        if (quantity > 0) {
          targets.push({
            symbol: insight.symbol,
            quantity,
            direction: 'short',
            weight: (value / context.state.portfolio.equity),
          });
        }
      }

      return targets;
    },
  },

  riskParity: {
    name: 'riskParity',
    type: 'risk_parity',
    construct: async (insights, context) => {
      const targets: PortfolioTarget[] = [];
      const validInsights = insights.filter(i => i.direction !== 'flat');

      if (validInsights.length === 0) return targets;

      const volatilities: Map<string, number> = new Map();
      for (const insight of validInsights) {
        const security = context.state.securities.get(insight.symbol);
        const vol = security?.technicals?.volatility30d || 0.2;
        volatilities.set(insight.symbol, vol);
      }

      const inverseVols = validInsights.map(i => 1 / (volatilities.get(i.symbol) || 0.2));
      const totalInverseVol = inverseVols.reduce((a, b) => a + b, 0);

      const targetExposure = 0.9;
      const budgetPerUnit = context.state.portfolio.equity * targetExposure / totalInverseVol;

      for (let i = 0; i < validInsights.length; i++) {
        const insight = validInsights[i];
        const security = context.state.securities.get(insight.symbol);
        if (!security) continue;

        const vol = volatilities.get(insight.symbol) || 0.2;
        const riskWeight = (1 / vol) / totalInverseVol;
        const value = context.state.portfolio.equity * targetExposure * riskWeight;
        const quantity = Math.floor(value / security.price);

        if (quantity > 0) {
          targets.push({
            symbol: insight.symbol,
            quantity,
            direction: insight.direction === 'up' ? 'long' : 'short',
            weight: riskWeight * targetExposure,
          });
        }
      }

      return targets;
    },
  },

  meanVariance: {
    name: 'meanVariance',
    type: 'mean_variance',
    construct: async (insights, context) => {
      const targets: PortfolioTarget[] = [];
      const validInsights = insights.filter(i => i.direction === 'up');

      if (validInsights.length === 0) return targets;

      const returns: number[] = [];
      const risks: number[] = [];

      for (const insight of validInsights) {
        const security = context.state.securities.get(insight.symbol);
        const expectedReturn = insight.magnitude * insight.confidence;
        const vol = security?.technicals?.volatility30d || 0.2;
        
        returns.push(expectedReturn);
        risks.push(vol);
      }

      const sharpeRatios = returns.map((r, i) => r / (risks[i] || 0.2));
      const totalSharpe = sharpeRatios.reduce((a, b) => a + Math.max(0, b), 0);

      const targetExposure = 0.9;

      for (let i = 0; i < validInsights.length; i++) {
        const insight = validInsights[i];
        const security = context.state.securities.get(insight.symbol);
        if (!security) continue;

        const sharpe = Math.max(0, sharpeRatios[i]);
        const weight = totalSharpe > 0 ? sharpe / totalSharpe : 1 / validInsights.length;
        const value = context.state.portfolio.equity * targetExposure * weight;
        const quantity = Math.floor(value / security.price);

        if (quantity > 0) {
          targets.push({
            symbol: insight.symbol,
            quantity,
            direction: 'long',
            weight: weight * targetExposure,
          });
        }
      }

      return targets;
    },
  },

  kellyFraction: {
    name: 'kellyFraction',
    type: 'custom',
    construct: async (insights, context) => {
      const targets: PortfolioTarget[] = [];
      const validInsights = insights.filter(i => i.direction !== 'flat');

      if (validInsights.length === 0) return targets;

      const totalWeight = validInsights.reduce((sum, insight) => {
        const security = context.state.securities.get(insight.symbol);
        const vol = security?.technicals?.volatility30d || 0.2;
        
        const winProb = insight.confidence;
        const avgWinLoss = 1 + insight.magnitude;
        
        const kellyFull = winProb - (1 - winProb) / avgWinLoss;
        const kellyFraction = Math.max(0, Math.min(kellyFull * 0.5, 0.25));
        
        return sum + kellyFraction;
      }, 0);

      for (const insight of validInsights) {
        const security = context.state.securities.get(insight.symbol);
        if (!security) continue;

        const winProb = insight.confidence;
        const avgWinLoss = 1 + insight.magnitude;
        const kellyFull = winProb - (1 - winProb) / avgWinLoss;
        const kellyFraction = Math.max(0, Math.min(kellyFull * 0.5, 0.25));

        const normalizedWeight = totalWeight > 0 ? kellyFraction / totalWeight : 0;
        const cappedWeight = Math.min(normalizedWeight * 0.9, 0.2);
        const value = context.state.portfolio.equity * cappedWeight;
        const quantity = Math.floor(value / security.price);

        if (quantity > 0) {
          targets.push({
            symbol: insight.symbol,
            quantity,
            direction: insight.direction === 'up' ? 'long' : 'short',
            weight: cappedWeight,
          });
        }
      }

      return targets;
    },
  },
};

export class PortfolioConstructionModule {
  private config: PortfolioConstructionConfig;
  private customConstructors: Map<string, PortfolioConstructor> = new Map();
  private lastTargets: PortfolioTarget[] = [];

  constructor(config: Partial<PortfolioConstructionConfig> = {}) {
    this.config = {
      constructor: config.constructor || BUILT_IN_CONSTRUCTORS.insightWeighted,
      rebalanceThreshold: config.rebalanceThreshold || 0.05,
      maxPositionWeight: config.maxPositionWeight || 0.2,
      minPositionWeight: config.minPositionWeight || 0.02,
      maxLongExposure: config.maxLongExposure || 1.0,
      maxShortExposure: config.maxShortExposure || 0.3,
      targetCashWeight: config.targetCashWeight || 0.05,
      concentrationLimit: config.concentrationLimit || 0.4,
    };
    logger.info('Portfolio Construction Module initialized', { constructor: this.config.constructor.name });
  }

  registerConstructor(constructor: PortfolioConstructor): void {
    this.customConstructors.set(constructor.name, constructor);
    logger.info('Custom constructor registered', { name: constructor.name, type: constructor.type });
  }

  getBuiltInConstructor(name: string): PortfolioConstructor | undefined {
    return BUILT_IN_CONSTRUCTORS[name];
  }

  async construct(insights: Insight[], context: AlgorithmContext): Promise<PortfolioConstructionResult> {
    const constructor = this.customConstructors.get(this.config.constructor.name) || this.config.constructor;

    let targets = await constructor.construct(insights, context);

    targets = this.applyConstraints(targets, context);

    if (!this.shouldRebalance(targets)) {
      logger.debug('Skipping rebalance, within threshold');
      return { targets: this.lastTargets };
    }

    this.lastTargets = targets;

    logger.info('Portfolio construction complete', {
      targets: targets.length,
      longExposure: targets.filter(t => t.direction === 'long').reduce((s, t) => s + (t.weight || 0), 0),
      shortExposure: targets.filter(t => t.direction === 'short').reduce((s, t) => s + (t.weight || 0), 0),
    });

    return { targets };
  }

  private applyConstraints(targets: PortfolioTarget[], context: AlgorithmContext): PortfolioTarget[] {
    let adjusted = targets.map(t => ({ ...t }));

    adjusted = adjusted.map(t => {
      const weight = t.weight || 0;
      if (weight > this.config.maxPositionWeight) {
        const scale = this.config.maxPositionWeight / weight;
        return {
          ...t,
          quantity: Math.floor(t.quantity * scale),
          weight: this.config.maxPositionWeight,
        };
      }
      return t;
    });

    adjusted = adjusted.filter(t => (t.weight || 0) >= this.config.minPositionWeight);

    const longExposure = adjusted
      .filter(t => t.direction === 'long')
      .reduce((sum, t) => sum + (t.weight || 0), 0);

    if (longExposure > this.config.maxLongExposure) {
      const scale = this.config.maxLongExposure / longExposure;
      adjusted = adjusted.map(t => {
        if (t.direction === 'long') {
          return {
            ...t,
            quantity: Math.floor(t.quantity * scale),
            weight: (t.weight || 0) * scale,
          };
        }
        return t;
      });
    }

    const shortExposure = adjusted
      .filter(t => t.direction === 'short')
      .reduce((sum, t) => sum + (t.weight || 0), 0);

    if (shortExposure > this.config.maxShortExposure) {
      const scale = this.config.maxShortExposure / shortExposure;
      adjusted = adjusted.map(t => {
        if (t.direction === 'short') {
          return {
            ...t,
            quantity: Math.floor(t.quantity * scale),
            weight: (t.weight || 0) * scale,
          };
        }
        return t;
      });
    }

    const sorted = adjusted.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    let cumWeight = 0;
    const final: PortfolioTarget[] = [];

    for (const target of sorted) {
      cumWeight += target.weight || 0;
      if (cumWeight <= this.config.concentrationLimit || final.length < 3) {
        final.push(target);
      } else {
        break;
      }
    }

    return final;
  }

  private shouldRebalance(newTargets: PortfolioTarget[]): boolean {
    if (this.lastTargets.length === 0) return true;
    if (newTargets.length !== this.lastTargets.length) return true;

    const lastMap = new Map(this.lastTargets.map(t => [t.symbol, t]));
    
    for (const target of newTargets) {
      const last = lastMap.get(target.symbol);
      if (!last) return true;
      
      const weightDiff = Math.abs((target.weight || 0) - (last.weight || 0));
      if (weightDiff > this.config.rebalanceThreshold) return true;
    }

    return false;
  }

  getCurrentTargets(): PortfolioTarget[] {
    return [...this.lastTargets];
  }

  clearTargets(): void {
    this.lastTargets = [];
  }
}

export const createEqualWeightPortfolio = (): PortfolioConstructionModule => {
  return new PortfolioConstructionModule({
    constructor: BUILT_IN_CONSTRUCTORS.equalWeight,
    maxPositionWeight: 0.1,
    concentrationLimit: 0.5,
  });
};

export const createRiskParityPortfolio = (): PortfolioConstructionModule => {
  return new PortfolioConstructionModule({
    constructor: BUILT_IN_CONSTRUCTORS.riskParity,
    maxPositionWeight: 0.15,
    concentrationLimit: 0.6,
  });
};

export const createMeanVariancePortfolio = (): PortfolioConstructionModule => {
  return new PortfolioConstructionModule({
    constructor: BUILT_IN_CONSTRUCTORS.meanVariance,
    maxPositionWeight: 0.2,
    rebalanceThreshold: 0.03,
  });
};

export const createKellyPortfolio = (): PortfolioConstructionModule => {
  return new PortfolioConstructionModule({
    constructor: BUILT_IN_CONSTRUCTORS.kellyFraction,
    maxPositionWeight: 0.2,
    maxLongExposure: 0.8,
  });
};
