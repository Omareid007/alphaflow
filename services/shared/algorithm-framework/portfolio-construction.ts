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

/**
 * Investor view for Black-Litterman model
 */
export interface InvestorView {
  symbol: string;
  expectedReturn: number;
  confidence: number;
}

/**
 * Black-Litterman model configuration
 */
export interface BlackLittermanConfig {
  riskFreeRate: number;
  marketRiskPremium: number;
  tau: number;
  targetExposure: number;
  maxPositionWeight: number;
}

/**
 * Black-Litterman Model for Portfolio Construction
 * 
 * Combines market equilibrium returns with investor views to produce
 * posterior expected returns. This approach addresses the sensitivity
 * of mean-variance optimization to expected return inputs.
 * 
 * @example
 * ```typescript
 * const blModel = new BlackLittermanModel({
 *   riskFreeRate: 0.02,
 *   marketRiskPremium: 0.05,
 *   tau: 0.05
 * });
 * blModel.addView({ symbol: 'AAPL', expectedReturn: 0.15, confidence: 0.8 });
 * const targets = await blModel.construct(insights, context);
 * ```
 */
export class BlackLittermanModel {
  private config: BlackLittermanConfig;
  private views: InvestorView[] = [];
  private logger = createLogger('black-litterman');

  constructor(config: Partial<BlackLittermanConfig> = {}) {
    this.config = {
      riskFreeRate: config.riskFreeRate ?? 0.02,
      marketRiskPremium: config.marketRiskPremium ?? 0.05,
      tau: config.tau ?? 0.05,
      targetExposure: config.targetExposure ?? 0.9,
      maxPositionWeight: config.maxPositionWeight ?? 0.25,
    };
    this.logger.info('Black-Litterman Model initialized', { config: this.config });
  }

  /**
   * Add an investor view to the model
   * @param view - The investor's view on expected return for a symbol
   */
  addView(view: InvestorView): void {
    this.views.push(view);
    this.logger.debug('View added', { symbol: view.symbol, expectedReturn: view.expectedReturn });
  }

  /**
   * Clear all investor views
   */
  clearViews(): void {
    this.views = [];
    this.logger.debug('Views cleared');
  }

  /**
   * Calculate prior equilibrium returns from market capitalization weights
   * @param symbols - List of symbols
   * @param context - Algorithm context with security data
   * @returns Map of symbol to equilibrium return
   */
  private calculatePriorReturns(
    symbols: string[],
    context: AlgorithmContext
  ): Map<string, number> {
    const priorReturns = new Map<string, number>();
    let totalMarketCap = 0;

    for (const symbol of symbols) {
      const security = context.state.securities.get(symbol);
      const marketCap = security?.marketCap || security?.price || 1000;
      totalMarketCap += marketCap;
    }

    for (const symbol of symbols) {
      const security = context.state.securities.get(symbol);
      const marketCap = security?.marketCap || security?.price || 1000;
      const marketWeight = marketCap / totalMarketCap;
      const volatility = security?.technicals?.volatility30d || 0.2;
      const equilibriumReturn = this.config.riskFreeRate + 
        marketWeight * this.config.marketRiskPremium * volatility;
      priorReturns.set(symbol, equilibriumReturn);
    }

    return priorReturns;
  }

  /**
   * Calculate posterior returns by combining prior with investor views
   * @param priorReturns - Equilibrium returns
   * @param symbols - List of symbols
   * @returns Map of symbol to posterior return
   */
  private calculatePosteriorReturns(
    priorReturns: Map<string, number>,
    symbols: string[]
  ): Map<string, number> {
    const posteriorReturns = new Map<string, number>();

    for (const symbol of symbols) {
      const prior = priorReturns.get(symbol) || 0;
      const view = this.views.find(v => v.symbol === symbol);

      if (view) {
        const viewWeight = view.confidence * this.config.tau;
        const priorWeight = 1 - viewWeight;
        const posterior = priorWeight * prior + viewWeight * view.expectedReturn;
        posteriorReturns.set(symbol, posterior);
      } else {
        posteriorReturns.set(symbol, prior);
      }
    }

    return posteriorReturns;
  }

  /**
   * Calculate optimal weights with uncertainty adjustment
   * @param posteriorReturns - Posterior expected returns
   * @param symbols - List of symbols
   * @param context - Algorithm context
   * @returns Map of symbol to optimal weight
   */
  private calculateOptimalWeights(
    posteriorReturns: Map<string, number>,
    symbols: string[],
    context: AlgorithmContext
  ): Map<string, number> {
    const weights = new Map<string, number>();
    let totalScore = 0;

    for (const symbol of symbols) {
      const security = context.state.securities.get(symbol);
      const expectedReturn = posteriorReturns.get(symbol) || 0;
      const volatility = security?.technicals?.volatility30d || 0.2;
      const view = this.views.find(v => v.symbol === symbol);
      const uncertaintyFactor = view ? view.confidence : 0.5;
      const score = (expectedReturn / volatility) * uncertaintyFactor;
      
      if (score > 0) {
        weights.set(symbol, score);
        totalScore += score;
      }
    }

    for (const [symbol, score] of weights) {
      const normalizedWeight = totalScore > 0 ? score / totalScore : 0;
      const cappedWeight = Math.min(normalizedWeight, this.config.maxPositionWeight);
      weights.set(symbol, cappedWeight * this.config.targetExposure);
    }

    return weights;
  }

  /**
   * Construct portfolio targets using Black-Litterman methodology
   * @param insights - Trading insights
   * @param context - Algorithm context
   * @returns Portfolio targets
   */
  async construct(insights: Insight[], context: AlgorithmContext): Promise<PortfolioTarget[]> {
    const targets: PortfolioTarget[] = [];
    const validInsights = insights.filter(i => i.direction !== 'flat');

    if (validInsights.length === 0) {
      return targets;
    }

    const symbols = validInsights.map(i => i.symbol);
    const priorReturns = this.calculatePriorReturns(symbols, context);
    const posteriorReturns = this.calculatePosteriorReturns(priorReturns, symbols);
    const optimalWeights = this.calculateOptimalWeights(posteriorReturns, symbols, context);

    for (const insight of validInsights) {
      const security = context.state.securities.get(insight.symbol);
      if (!security) continue;

      const weight = optimalWeights.get(insight.symbol) || 0;
      if (weight <= 0) continue;

      const value = context.state.portfolio.equity * weight;
      const quantity = Math.floor(value / security.price);

      if (quantity > 0) {
        targets.push({
          symbol: insight.symbol,
          quantity,
          direction: insight.direction === 'up' ? 'long' : 'short',
          weight,
        });
      }
    }

    this.logger.info('Black-Litterman construction complete', {
      targets: targets.length,
      viewsApplied: this.views.length,
    });

    return targets;
  }

  /**
   * Get current investor views
   */
  getViews(): InvestorView[] {
    return [...this.views];
  }
}

/**
 * Factor exposure configuration
 */
export interface FactorExposure {
  value: number;
  momentum: number;
  quality: number;
  volatility: number;
}

/**
 * Factor-based allocator configuration
 */
export interface FactorBasedAllocatorConfig {
  targetExposures: Partial<FactorExposure>;
  factorLoadingConstraints: {
    minLoading: number;
    maxLoading: number;
  };
  targetExposure: number;
  maxPositionWeight: number;
}

/**
 * Factor-Based Portfolio Allocator
 * 
 * Allocates portfolio weights based on factor exposures including
 * value, momentum, quality, and volatility factors. Supports
 * factor loading constraints and risk attribution.
 * 
 * @example
 * ```typescript
 * const factorAllocator = new FactorBasedAllocator({
 *   targetExposures: { value: 0.3, momentum: 0.4, quality: 0.3 },
 *   factorLoadingConstraints: { minLoading: -0.5, maxLoading: 1.5 }
 * });
 * const targets = await factorAllocator.construct(insights, context);
 * const attribution = factorAllocator.getFactorRiskAttribution();
 * ```
 */
export class FactorBasedAllocator {
  private config: FactorBasedAllocatorConfig;
  private lastFactorAttribution: Map<string, FactorExposure> = new Map();
  private portfolioFactorExposure: FactorExposure = { value: 0, momentum: 0, quality: 0, volatility: 0 };
  private logger = createLogger('factor-allocator');

  constructor(config: Partial<FactorBasedAllocatorConfig> = {}) {
    this.config = {
      targetExposures: config.targetExposures || { value: 0.25, momentum: 0.25, quality: 0.25, volatility: 0.25 },
      factorLoadingConstraints: config.factorLoadingConstraints || { minLoading: -1.0, maxLoading: 2.0 },
      targetExposure: config.targetExposure ?? 0.9,
      maxPositionWeight: config.maxPositionWeight ?? 0.2,
    };
    this.logger.info('Factor-Based Allocator initialized', { config: this.config });
  }

  /**
   * Calculate factor scores for a security
   * @param symbol - Security symbol
   * @param context - Algorithm context
   * @returns Factor exposure for the security
   */
  private calculateFactorScores(symbol: string, context: AlgorithmContext): FactorExposure {
    const security = context.state.securities.get(symbol);
    if (!security) {
      return { value: 0, momentum: 0, quality: 0, volatility: 0 };
    }

    const fundamentals = security.fundamentals || {};
    const technicals = security.technicals || {};

    const valueFactor = this.normalizeScore(
      (1 / (fundamentals.peRatio || 20)) * 100 +
      (1 / (fundamentals.pbRatio || 3)) * 10
    );

    const momentumFactor = this.normalizeScore(
      ((technicals.sma20 || 0) / (technicals.sma50 || 1) - 1) * 100 +
      ((security.price || 0) / (technicals.sma200 || security.price || 1) - 1) * 50
    );

    const qualityFactor = this.normalizeScore(
      (fundamentals.returnOnEquity || 0.1) * 100 +
      (1 / (fundamentals.debtToEquity || 1)) * 50 +
      (fundamentals.earningsGrowth || 0.05) * 100
    );

    const volatilityFactor = this.normalizeScore(
      1 / (technicals.volatility30d || 0.2)
    );

    return {
      value: this.constrainLoading(valueFactor),
      momentum: this.constrainLoading(momentumFactor),
      quality: this.constrainLoading(qualityFactor),
      volatility: this.constrainLoading(volatilityFactor),
    };
  }

  /**
   * Normalize a raw score to 0-1 range
   */
  private normalizeScore(score: number): number {
    return Math.max(0, Math.min(1, (score + 1) / 2));
  }

  /**
   * Constrain factor loading within allowed bounds
   */
  private constrainLoading(loading: number): number {
    return Math.max(
      this.config.factorLoadingConstraints.minLoading,
      Math.min(this.config.factorLoadingConstraints.maxLoading, loading)
    );
  }

  /**
   * Calculate composite factor score based on target exposures
   */
  private calculateCompositeScore(factors: FactorExposure): number {
    const targets = this.config.targetExposures;
    return (
      (targets.value || 0) * factors.value +
      (targets.momentum || 0) * factors.momentum +
      (targets.quality || 0) * factors.quality +
      (targets.volatility || 0) * factors.volatility
    );
  }

  /**
   * Construct portfolio targets based on factor exposures
   * @param insights - Trading insights
   * @param context - Algorithm context
   * @returns Portfolio targets
   */
  async construct(insights: Insight[], context: AlgorithmContext): Promise<PortfolioTarget[]> {
    const targets: PortfolioTarget[] = [];
    const validInsights = insights.filter(i => i.direction !== 'flat');

    if (validInsights.length === 0) {
      return targets;
    }

    const factorScores = new Map<string, { factors: FactorExposure; composite: number }>();
    let totalComposite = 0;

    for (const insight of validInsights) {
      const factors = this.calculateFactorScores(insight.symbol, context);
      const composite = this.calculateCompositeScore(factors) * insight.confidence;
      
      if (composite > 0) {
        factorScores.set(insight.symbol, { factors, composite });
        totalComposite += composite;
        this.lastFactorAttribution.set(insight.symbol, factors);
      }
    }

    this.portfolioFactorExposure = { value: 0, momentum: 0, quality: 0, volatility: 0 };

    for (const insight of validInsights) {
      const security = context.state.securities.get(insight.symbol);
      const scoreData = factorScores.get(insight.symbol);
      
      if (!security || !scoreData) continue;

      const rawWeight = totalComposite > 0 ? scoreData.composite / totalComposite : 0;
      const weight = Math.min(rawWeight * this.config.targetExposure, this.config.maxPositionWeight);
      const value = context.state.portfolio.equity * weight;
      const quantity = Math.floor(value / security.price);

      if (quantity > 0) {
        targets.push({
          symbol: insight.symbol,
          quantity,
          direction: insight.direction === 'up' ? 'long' : 'short',
          weight,
        });

        this.portfolioFactorExposure.value += weight * scoreData.factors.value;
        this.portfolioFactorExposure.momentum += weight * scoreData.factors.momentum;
        this.portfolioFactorExposure.quality += weight * scoreData.factors.quality;
        this.portfolioFactorExposure.volatility += weight * scoreData.factors.volatility;
      }
    }

    this.logger.info('Factor-based construction complete', {
      targets: targets.length,
      portfolioFactorExposure: this.portfolioFactorExposure,
    });

    return targets;
  }

  /**
   * Get factor risk attribution for each position
   * @returns Map of symbol to factor exposures
   */
  getFactorRiskAttribution(): Map<string, FactorExposure> {
    return new Map(this.lastFactorAttribution);
  }

  /**
   * Get portfolio-level factor exposure
   * @returns Aggregate factor exposure
   */
  getPortfolioFactorExposure(): FactorExposure {
    return { ...this.portfolioFactorExposure };
  }

  /**
   * Update target factor exposures
   * @param exposures - New target exposures
   */
  setTargetExposures(exposures: Partial<FactorExposure>): void {
    this.config.targetExposures = { ...this.config.targetExposures, ...exposures };
    this.logger.info('Target exposures updated', { exposures: this.config.targetExposures });
  }
}

/**
 * Risk parity allocator configuration
 */
export interface RiskParityAllocatorConfig {
  targetExposure: number;
  maxPositionWeight: number;
  riskBudgets: Map<string, number>;
  useInverseVolatility: boolean;
}

/**
 * Risk Parity Portfolio Allocator
 * 
 * Allocates portfolio weights to achieve equal risk contribution
 * from each asset. Uses inverse volatility weighting or custom
 * risk budgets for allocation.
 * 
 * @example
 * ```typescript
 * const riskParity = new RiskParityAllocator({
 *   useInverseVolatility: true,
 *   targetExposure: 0.95
 * });
 * riskParity.setRiskBudget('AAPL', 0.2);
 * const targets = await riskParity.construct(insights, context);
 * ```
 */
export class RiskParityAllocator {
  private config: RiskParityAllocatorConfig;
  private lastRiskContributions: Map<string, number> = new Map();
  private logger = createLogger('risk-parity-allocator');

  constructor(config: Partial<RiskParityAllocatorConfig> = {}) {
    this.config = {
      targetExposure: config.targetExposure ?? 0.9,
      maxPositionWeight: config.maxPositionWeight ?? 0.3,
      riskBudgets: config.riskBudgets || new Map(),
      useInverseVolatility: config.useInverseVolatility ?? true,
    };
    this.logger.info('Risk Parity Allocator initialized', { config: this.config });
  }

  /**
   * Set risk budget for a specific symbol
   * @param symbol - Security symbol
   * @param budget - Risk budget allocation (0-1)
   */
  setRiskBudget(symbol: string, budget: number): void {
    this.config.riskBudgets.set(symbol, Math.max(0, Math.min(1, budget)));
    this.logger.debug('Risk budget set', { symbol, budget });
  }

  /**
   * Clear all custom risk budgets
   */
  clearRiskBudgets(): void {
    this.config.riskBudgets.clear();
    this.logger.debug('Risk budgets cleared');
  }

  /**
   * Calculate volatility for a symbol
   */
  private getVolatility(symbol: string, context: AlgorithmContext): number {
    const security = context.state.securities.get(symbol);
    return security?.technicals?.volatility30d || 0.2;
  }

  /**
   * Calculate inverse volatility weights
   */
  private calculateInverseVolatilityWeights(
    symbols: string[],
    context: AlgorithmContext
  ): Map<string, number> {
    const weights = new Map<string, number>();
    let totalInverseVol = 0;

    for (const symbol of symbols) {
      const vol = this.getVolatility(symbol, context);
      const inverseVol = 1 / vol;
      weights.set(symbol, inverseVol);
      totalInverseVol += inverseVol;
    }

    for (const [symbol, inverseVol] of weights) {
      weights.set(symbol, inverseVol / totalInverseVol);
    }

    return weights;
  }

  /**
   * Calculate risk budget weights
   */
  private calculateRiskBudgetWeights(symbols: string[]): Map<string, number> {
    const weights = new Map<string, number>();
    let totalBudget = 0;

    for (const symbol of symbols) {
      const budget = this.config.riskBudgets.get(symbol) || 1 / symbols.length;
      weights.set(symbol, budget);
      totalBudget += budget;
    }

    for (const [symbol, budget] of weights) {
      weights.set(symbol, budget / totalBudget);
    }

    return weights;
  }

  /**
   * Calculate equal risk contribution weights iteratively
   */
  private calculateEqualRiskContribution(
    symbols: string[],
    context: AlgorithmContext
  ): Map<string, number> {
    const n = symbols.length;
    const volatilities = symbols.map(s => this.getVolatility(s, context));
    
    let weights = new Array(n).fill(1 / n);
    const targetRisk = 1 / n;
    const maxIterations = 50;
    const tolerance = 0.001;

    for (let iter = 0; iter < maxIterations; iter++) {
      const portfolioVol = Math.sqrt(
        weights.reduce((sum, w, i) => sum + w * w * volatilities[i] * volatilities[i], 0)
      );

      const marginalRisks = weights.map((w, i) => 
        w * volatilities[i] * volatilities[i] / portfolioVol
      );

      const totalMarginal = marginalRisks.reduce((a, b) => a + b, 0);
      const riskContributions = marginalRisks.map(mr => mr / totalMarginal);

      let maxDeviation = 0;
      for (let i = 0; i < n; i++) {
        const deviation = Math.abs(riskContributions[i] - targetRisk);
        maxDeviation = Math.max(maxDeviation, deviation);
      }

      if (maxDeviation < tolerance) break;

      for (let i = 0; i < n; i++) {
        weights[i] *= targetRisk / (riskContributions[i] || targetRisk);
      }

      const totalWeight = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / totalWeight);
    }

    const result = new Map<string, number>();
    symbols.forEach((symbol, i) => {
      result.set(symbol, weights[i]);
      this.lastRiskContributions.set(symbol, weights[i]);
    });

    return result;
  }

  /**
   * Construct portfolio targets with risk parity allocation
   * @param insights - Trading insights
   * @param context - Algorithm context
   * @returns Portfolio targets
   */
  async construct(insights: Insight[], context: AlgorithmContext): Promise<PortfolioTarget[]> {
    const targets: PortfolioTarget[] = [];
    const validInsights = insights.filter(i => i.direction !== 'flat');

    if (validInsights.length === 0) {
      return targets;
    }

    const symbols = validInsights.map(i => i.symbol);
    
    let weights: Map<string, number>;
    if (this.config.riskBudgets.size > 0) {
      weights = this.calculateRiskBudgetWeights(symbols);
    } else if (this.config.useInverseVolatility) {
      weights = this.calculateInverseVolatilityWeights(symbols, context);
    } else {
      weights = this.calculateEqualRiskContribution(symbols, context);
    }

    for (const insight of validInsights) {
      const security = context.state.securities.get(insight.symbol);
      if (!security) continue;

      const rawWeight = weights.get(insight.symbol) || 0;
      const weight = Math.min(rawWeight * this.config.targetExposure, this.config.maxPositionWeight);
      const value = context.state.portfolio.equity * weight;
      const quantity = Math.floor(value / security.price);

      if (quantity > 0) {
        targets.push({
          symbol: insight.symbol,
          quantity,
          direction: insight.direction === 'up' ? 'long' : 'short',
          weight,
        });
      }
    }

    this.logger.info('Risk parity construction complete', {
      targets: targets.length,
      method: this.config.riskBudgets.size > 0 ? 'risk_budget' : 
              this.config.useInverseVolatility ? 'inverse_volatility' : 'equal_risk_contribution',
    });

    return targets;
  }

  /**
   * Get last calculated risk contributions
   * @returns Map of symbol to risk contribution
   */
  getRiskContributions(): Map<string, number> {
    return new Map(this.lastRiskContributions);
  }
}

/**
 * Hierarchical Risk Parity configuration
 */
export interface HierarchicalRiskParityConfig {
  targetExposure: number;
  maxPositionWeight: number;
  clusteringMethod: 'single' | 'complete' | 'average';
}

/**
 * Hierarchical Risk Parity (HRP) Portfolio Allocator
 * 
 * Uses correlation-based hierarchical clustering to allocate
 * portfolio weights. More robust than mean-variance optimization
 * as it doesn't require covariance matrix inversion.
 * 
 * @example
 * ```typescript
 * const hrp = new HierarchicalRiskParity({
 *   clusteringMethod: 'single',
 *   targetExposure: 0.9
 * });
 * const targets = await hrp.construct(insights, context);
 * const clusters = hrp.getClusterStructure();
 * ```
 */
export class HierarchicalRiskParity {
  private config: HierarchicalRiskParityConfig;
  private clusterStructure: Map<string, number> = new Map();
  private distanceMatrix: number[][] = [];
  private logger = createLogger('hrp');

  constructor(config: Partial<HierarchicalRiskParityConfig> = {}) {
    this.config = {
      targetExposure: config.targetExposure ?? 0.9,
      maxPositionWeight: config.maxPositionWeight ?? 0.25,
      clusteringMethod: config.clusteringMethod || 'single',
    };
    this.logger.info('Hierarchical Risk Parity initialized', { config: this.config });
  }

  /**
   * Calculate correlation distance between two assets
   */
  private calculateCorrelationDistance(
    symbol1: string,
    symbol2: string,
    context: AlgorithmContext
  ): number {
    const sec1 = context.state.securities.get(symbol1);
    const sec2 = context.state.securities.get(symbol2);

    if (!sec1 || !sec2) return 1;

    const vol1 = sec1.technicals?.volatility30d || 0.2;
    const vol2 = sec2.technicals?.volatility30d || 0.2;
    const sectorMatch = sec1.sector === sec2.sector ? 0.3 : 0;
    const volSimilarity = 1 - Math.abs(vol1 - vol2) / Math.max(vol1, vol2);

    const impliedCorrelation = sectorMatch + 0.3 * volSimilarity;
    return Math.sqrt(2 * (1 - impliedCorrelation));
  }

  /**
   * Build distance matrix for hierarchical clustering
   */
  private buildDistanceMatrix(symbols: string[], context: AlgorithmContext): number[][] {
    const n = symbols.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const distance = this.calculateCorrelationDistance(symbols[i], symbols[j], context);
        matrix[i][j] = distance;
        matrix[j][i] = distance;
      }
    }

    this.distanceMatrix = matrix;
    return matrix;
  }

  /**
   * Perform hierarchical clustering using linkage method
   */
  private performClustering(
    symbols: string[],
    distanceMatrix: number[][]
  ): number[] {
    const n = symbols.length;
    const order: number[] = Array.from({ length: n }, (_, i) => i);
    
    const clusters: Set<number>[] = order.map(i => new Set([i]));
    const active = new Set(order);

    while (active.size > 1) {
      let minDist = Infinity;
      let merge1 = -1;
      let merge2 = -1;

      const activeArr = Array.from(active);
      for (let i = 0; i < activeArr.length; i++) {
        for (let j = i + 1; j < activeArr.length; j++) {
          const c1 = activeArr[i];
          const c2 = activeArr[j];
          const dist = this.clusterDistance(clusters[c1], clusters[c2], distanceMatrix);
          
          if (dist < minDist) {
            minDist = dist;
            merge1 = c1;
            merge2 = c2;
          }
        }
      }

      if (merge1 >= 0 && merge2 >= 0) {
        for (const idx of clusters[merge2]) {
          clusters[merge1].add(idx);
        }
        active.delete(merge2);
      } else {
        break;
      }
    }

    const sortedOrder: number[] = [];
    for (const idx of active) {
      sortedOrder.push(...clusters[idx]);
    }

    symbols.forEach((symbol, i) => {
      this.clusterStructure.set(symbol, sortedOrder.indexOf(i));
    });

    return sortedOrder;
  }

  /**
   * Calculate distance between two clusters based on linkage method
   */
  private clusterDistance(
    cluster1: Set<number>,
    cluster2: Set<number>,
    distanceMatrix: number[][]
  ): number {
    const distances: number[] = [];

    for (const i of cluster1) {
      for (const j of cluster2) {
        distances.push(distanceMatrix[i][j]);
      }
    }

    switch (this.config.clusteringMethod) {
      case 'single':
        return Math.min(...distances);
      case 'complete':
        return Math.max(...distances);
      case 'average':
      default:
        return distances.reduce((a, b) => a + b, 0) / distances.length;
    }
  }

  /**
   * Recursively allocate weights using bisection
   */
  private allocateWeights(
    symbols: string[],
    order: number[],
    context: AlgorithmContext
  ): Map<string, number> {
    const weights = new Map<string, number>();
    const n = order.length;

    if (n === 0) return weights;
    if (n === 1) {
      weights.set(symbols[order[0]], 1);
      return weights;
    }

    const recursiveAlloc = (indices: number[], weight: number): void => {
      if (indices.length === 0) return;
      if (indices.length === 1) {
        const symbol = symbols[indices[0]];
        const current = weights.get(symbol) || 0;
        weights.set(symbol, current + weight);
        return;
      }

      const mid = Math.floor(indices.length / 2);
      const left = indices.slice(0, mid);
      const right = indices.slice(mid);

      let leftVol = 0;
      let rightVol = 0;

      for (const idx of left) {
        const security = context.state.securities.get(symbols[idx]);
        leftVol += security?.technicals?.volatility30d || 0.2;
      }
      for (const idx of right) {
        const security = context.state.securities.get(symbols[idx]);
        rightVol += security?.technicals?.volatility30d || 0.2;
      }

      leftVol /= left.length;
      rightVol /= right.length;

      const totalVol = leftVol + rightVol;
      const leftWeight = weight * (1 - leftVol / totalVol);
      const rightWeight = weight * (1 - rightVol / totalVol);

      const normFactor = weight / (leftWeight + rightWeight);
      recursiveAlloc(left, leftWeight * normFactor);
      recursiveAlloc(right, rightWeight * normFactor);
    };

    recursiveAlloc(order, 1);
    return weights;
  }

  /**
   * Construct portfolio targets using HRP methodology
   * @param insights - Trading insights
   * @param context - Algorithm context
   * @returns Portfolio targets
   */
  async construct(insights: Insight[], context: AlgorithmContext): Promise<PortfolioTarget[]> {
    const targets: PortfolioTarget[] = [];
    const validInsights = insights.filter(i => i.direction !== 'flat');

    if (validInsights.length === 0) {
      return targets;
    }

    const symbols = validInsights.map(i => i.symbol);
    const distanceMatrix = this.buildDistanceMatrix(symbols, context);
    const order = this.performClustering(symbols, distanceMatrix);
    const weights = this.allocateWeights(symbols, order, context);

    for (const insight of validInsights) {
      const security = context.state.securities.get(insight.symbol);
      if (!security) continue;

      const rawWeight = weights.get(insight.symbol) || 0;
      const weight = Math.min(rawWeight * this.config.targetExposure, this.config.maxPositionWeight);
      const value = context.state.portfolio.equity * weight;
      const quantity = Math.floor(value / security.price);

      if (quantity > 0) {
        targets.push({
          symbol: insight.symbol,
          quantity,
          direction: insight.direction === 'up' ? 'long' : 'short',
          weight,
        });
      }
    }

    this.logger.info('HRP construction complete', {
      targets: targets.length,
      clusters: this.clusterStructure.size,
    });

    return targets;
  }

  /**
   * Get cluster structure from last construction
   * @returns Map of symbol to cluster order
   */
  getClusterStructure(): Map<string, number> {
    return new Map(this.clusterStructure);
  }

  /**
   * Get distance matrix from last construction
   * @returns 2D distance matrix
   */
  getDistanceMatrix(): number[][] {
    return this.distanceMatrix.map(row => [...row]);
  }
}

/**
 * Portfolio constraints configuration
 */
export interface PortfolioConstraints {
  sectorLimits: Map<string, { min: number; max: number }>;
  positionSizeLimits: { min: number; max: number };
  turnoverLimit: number;
  excludedSymbols: Set<string>;
  esgMinScore: number;
}

/**
 * Constrained optimizer configuration
 */
export interface ConstrainedOptimizerConfig {
  constraints: Partial<PortfolioConstraints>;
  targetExposure: number;
  penaltyWeight: number;
}

/**
 * Constrained Portfolio Optimizer
 * 
 * Optimizes portfolio weights subject to multiple constraints including
 * sector concentration, position size limits, turnover, and ESG requirements.
 * 
 * @example
 * ```typescript
 * const optimizer = new ConstrainedOptimizer({
 *   constraints: {
 *     positionSizeLimits: { min: 0.02, max: 0.15 },
 *     turnoverLimit: 0.3,
 *     esgMinScore: 0.6
 *   }
 * });
 * optimizer.setSectorLimit('Technology', 0.05, 0.4);
 * optimizer.excludeSymbol('EXCLUDED_STOCK');
 * const targets = await optimizer.construct(insights, context);
 * ```
 */
export class ConstrainedOptimizer {
  private config: ConstrainedOptimizerConfig;
  private constraints: PortfolioConstraints;
  private previousWeights: Map<string, number> = new Map();
  private constraintViolations: string[] = [];
  private logger = createLogger('constrained-optimizer');

  constructor(config: Partial<ConstrainedOptimizerConfig> = {}) {
    this.constraints = {
      sectorLimits: config.constraints?.sectorLimits || new Map(),
      positionSizeLimits: config.constraints?.positionSizeLimits || { min: 0.01, max: 0.2 },
      turnoverLimit: config.constraints?.turnoverLimit ?? 0.5,
      excludedSymbols: config.constraints?.excludedSymbols || new Set(),
      esgMinScore: config.constraints?.esgMinScore ?? 0,
    };
    this.config = {
      constraints: this.constraints,
      targetExposure: config.targetExposure ?? 0.9,
      penaltyWeight: config.penaltyWeight ?? 1.0,
    };
    this.logger.info('Constrained Optimizer initialized', { config: this.config });
  }

  /**
   * Set sector concentration limits
   * @param sector - Sector name
   * @param min - Minimum allocation
   * @param max - Maximum allocation
   */
  setSectorLimit(sector: string, min: number, max: number): void {
    this.constraints.sectorLimits.set(sector, { min, max });
    this.logger.debug('Sector limit set', { sector, min, max });
  }

  /**
   * Remove sector limit
   * @param sector - Sector name
   */
  removeSectorLimit(sector: string): void {
    this.constraints.sectorLimits.delete(sector);
    this.logger.debug('Sector limit removed', { sector });
  }

  /**
   * Set position size limits
   * @param min - Minimum position weight
   * @param max - Maximum position weight
   */
  setPositionSizeLimits(min: number, max: number): void {
    this.constraints.positionSizeLimits = { min, max };
    this.logger.debug('Position size limits set', { min, max });
  }

  /**
   * Set turnover constraint
   * @param limit - Maximum turnover (0-1)
   */
  setTurnoverLimit(limit: number): void {
    this.constraints.turnoverLimit = Math.max(0, Math.min(1, limit));
    this.logger.debug('Turnover limit set', { limit: this.constraints.turnoverLimit });
  }

  /**
   * Add symbol to exclusion list
   * @param symbol - Symbol to exclude
   */
  excludeSymbol(symbol: string): void {
    this.constraints.excludedSymbols.add(symbol);
    this.logger.debug('Symbol excluded', { symbol });
  }

  /**
   * Remove symbol from exclusion list
   * @param symbol - Symbol to include
   */
  includeSymbol(symbol: string): void {
    this.constraints.excludedSymbols.delete(symbol);
    this.logger.debug('Symbol included', { symbol });
  }

  /**
   * Set minimum ESG score requirement
   * @param minScore - Minimum ESG score (0-1)
   */
  setESGMinScore(minScore: number): void {
    this.constraints.esgMinScore = Math.max(0, Math.min(1, minScore));
    this.logger.debug('ESG minimum score set', { minScore: this.constraints.esgMinScore });
  }

  /**
   * Calculate initial unconstrained weights
   */
  private calculateInitialWeights(
    insights: Insight[],
    context: AlgorithmContext
  ): Map<string, number> {
    const weights = new Map<string, number>();
    let totalScore = 0;

    for (const insight of insights) {
      const score = insight.confidence * insight.magnitude;
      if (score > 0) {
        weights.set(insight.symbol, score);
        totalScore += score;
      }
    }

    for (const [symbol, score] of weights) {
      weights.set(symbol, totalScore > 0 ? score / totalScore : 0);
    }

    return weights;
  }

  /**
   * Apply exclusion constraints
   */
  private applyExclusionConstraints(
    weights: Map<string, number>,
    context: AlgorithmContext
  ): Map<string, number> {
    const filtered = new Map<string, number>();

    for (const [symbol, weight] of weights) {
      if (this.constraints.excludedSymbols.has(symbol)) {
        this.constraintViolations.push(`Excluded: ${symbol}`);
        continue;
      }

      const security = context.state.securities.get(symbol);
      const esgScore = (security?.fundamentals as Record<string, unknown>)?.esgScore as number || 0.5;
      
      if (esgScore < this.constraints.esgMinScore) {
        this.constraintViolations.push(`ESG below threshold: ${symbol} (${esgScore.toFixed(2)})`);
        continue;
      }

      filtered.set(symbol, weight);
    }

    let totalWeight = 0;
    for (const weight of filtered.values()) {
      totalWeight += weight;
    }
    for (const [symbol, weight] of filtered) {
      filtered.set(symbol, totalWeight > 0 ? weight / totalWeight : 0);
    }

    return filtered;
  }

  /**
   * Apply position size constraints
   */
  private applyPositionSizeConstraints(weights: Map<string, number>): Map<string, number> {
    const { min, max } = this.constraints.positionSizeLimits;
    const adjusted = new Map<string, number>();
    const removed: string[] = [];

    for (const [symbol, weight] of weights) {
      if (weight < min) {
        removed.push(symbol);
        this.constraintViolations.push(`Below minimum size: ${symbol}`);
      } else if (weight > max) {
        adjusted.set(symbol, max);
        this.constraintViolations.push(`Capped at maximum: ${symbol}`);
      } else {
        adjusted.set(symbol, weight);
      }
    }

    let totalWeight = 0;
    for (const weight of adjusted.values()) {
      totalWeight += weight;
    }
    for (const [symbol, weight] of adjusted) {
      adjusted.set(symbol, totalWeight > 0 ? weight / totalWeight : 0);
    }

    return adjusted;
  }

  /**
   * Apply sector concentration constraints
   */
  private applySectorConstraints(
    weights: Map<string, number>,
    context: AlgorithmContext
  ): Map<string, number> {
    const sectorWeights = new Map<string, number>();
    const symbolsBySector = new Map<string, string[]>();

    for (const [symbol, weight] of weights) {
      const security = context.state.securities.get(symbol);
      const sector = security?.sector || 'Unknown';
      
      sectorWeights.set(sector, (sectorWeights.get(sector) || 0) + weight);
      
      if (!symbolsBySector.has(sector)) {
        symbolsBySector.set(sector, []);
      }
      symbolsBySector.get(sector)!.push(symbol);
    }

    const adjusted = new Map(weights);

    for (const [sector, limit] of this.constraints.sectorLimits) {
      const currentWeight = sectorWeights.get(sector) || 0;
      const symbols = symbolsBySector.get(sector) || [];

      if (currentWeight > limit.max && symbols.length > 0) {
        const scale = limit.max / currentWeight;
        for (const symbol of symbols) {
          const weight = adjusted.get(symbol) || 0;
          adjusted.set(symbol, weight * scale);
        }
        this.constraintViolations.push(`Sector ${sector} capped at ${limit.max}`);
      }
    }

    let totalWeight = 0;
    for (const weight of adjusted.values()) {
      totalWeight += weight;
    }
    for (const [symbol, weight] of adjusted) {
      adjusted.set(symbol, totalWeight > 0 ? weight / totalWeight : 0);
    }

    return adjusted;
  }

  /**
   * Apply turnover constraints
   */
  private applyTurnoverConstraints(weights: Map<string, number>): Map<string, number> {
    if (this.previousWeights.size === 0) {
      return weights;
    }

    let totalTurnover = 0;
    const allSymbols = new Set([...weights.keys(), ...this.previousWeights.keys()]);

    for (const symbol of allSymbols) {
      const newWeight = weights.get(symbol) || 0;
      const oldWeight = this.previousWeights.get(symbol) || 0;
      totalTurnover += Math.abs(newWeight - oldWeight);
    }

    totalTurnover /= 2;

    if (totalTurnover <= this.constraints.turnoverLimit) {
      return weights;
    }

    const scale = this.constraints.turnoverLimit / totalTurnover;
    const adjusted = new Map<string, number>();

    for (const symbol of allSymbols) {
      const newWeight = weights.get(symbol) || 0;
      const oldWeight = this.previousWeights.get(symbol) || 0;
      const adjustedWeight = oldWeight + (newWeight - oldWeight) * scale;
      
      if (adjustedWeight > 0.001) {
        adjusted.set(symbol, adjustedWeight);
      }
    }

    this.constraintViolations.push(`Turnover limited from ${(totalTurnover * 100).toFixed(1)}% to ${(this.constraints.turnoverLimit * 100).toFixed(1)}%`);

    return adjusted;
  }

  /**
   * Construct portfolio targets with all constraints applied
   * @param insights - Trading insights
   * @param context - Algorithm context
   * @returns Portfolio targets
   */
  async construct(insights: Insight[], context: AlgorithmContext): Promise<PortfolioTarget[]> {
    this.constraintViolations = [];
    const targets: PortfolioTarget[] = [];
    const validInsights = insights.filter(i => i.direction !== 'flat');

    if (validInsights.length === 0) {
      return targets;
    }

    let weights = this.calculateInitialWeights(validInsights, context);
    weights = this.applyExclusionConstraints(weights, context);
    weights = this.applyPositionSizeConstraints(weights);
    weights = this.applySectorConstraints(weights, context);
    weights = this.applyTurnoverConstraints(weights);

    for (const insight of validInsights) {
      const security = context.state.securities.get(insight.symbol);
      const rawWeight = weights.get(insight.symbol);
      
      if (!security || !rawWeight || rawWeight <= 0) continue;

      const weight = rawWeight * this.config.targetExposure;
      const value = context.state.portfolio.equity * weight;
      const quantity = Math.floor(value / security.price);

      if (quantity > 0) {
        targets.push({
          symbol: insight.symbol,
          quantity,
          direction: insight.direction === 'up' ? 'long' : 'short',
          weight,
        });
      }
    }

    this.previousWeights = weights;

    this.logger.info('Constrained optimization complete', {
      targets: targets.length,
      violations: this.constraintViolations.length,
    });

    return targets;
  }

  /**
   * Get constraint violations from last construction
   * @returns Array of violation messages
   */
  getConstraintViolations(): string[] {
    return [...this.constraintViolations];
  }

  /**
   * Get current constraints configuration
   * @returns Current constraints
   */
  getConstraints(): PortfolioConstraints {
    return {
      sectorLimits: new Map(this.constraints.sectorLimits),
      positionSizeLimits: { ...this.constraints.positionSizeLimits },
      turnoverLimit: this.constraints.turnoverLimit,
      excludedSymbols: new Set(this.constraints.excludedSymbols),
      esgMinScore: this.constraints.esgMinScore,
    };
  }

  /**
   * Clear previous weights (resets turnover tracking)
   */
  clearHistory(): void {
    this.previousWeights.clear();
    this.constraintViolations = [];
    this.logger.debug('History cleared');
  }
}
