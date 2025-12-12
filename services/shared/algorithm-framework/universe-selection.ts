/**
 * AI Active Trader - Universe Selection Module
 * Determines which securities to include in the trading universe
 */

import { createLogger } from '../common';
import type { Security, AlgorithmContext, UniverseSelectionResult } from './types';

const logger = createLogger('universe-selection');

export interface UniverseFilter {
  name: string;
  type: 'fundamental' | 'technical' | 'liquidity' | 'custom';
  apply: (securities: Security[], context: AlgorithmContext) => Security[];
}

export interface UniverseSelectionConfig {
  mode: 'static' | 'dynamic' | 'scheduled';
  refreshIntervalMs?: number;
  maxSecurities?: number;
  minSecurities?: number;
  filters: UniverseFilter[];
  coarseFilters?: UniverseFilter[];
  fineFilters?: UniverseFilter[];
}

const BUILT_IN_FILTERS: Record<string, UniverseFilter> = {
  minPrice: {
    name: 'minPrice',
    type: 'liquidity',
    apply: (securities, context) => {
      const minPrice = (context.state.parameters.minPrice as number) || 5;
      return securities.filter(s => s.price >= minPrice);
    },
  },

  maxPrice: {
    name: 'maxPrice',
    type: 'liquidity',
    apply: (securities, context) => {
      const maxPrice = (context.state.parameters.maxPrice as number) || 10000;
      return securities.filter(s => s.price <= maxPrice);
    },
  },

  minVolume: {
    name: 'minVolume',
    type: 'liquidity',
    apply: (securities, context) => {
      const minVolume = (context.state.parameters.minVolume as number) || 100000;
      return securities.filter(s => s.volume >= minVolume);
    },
  },

  minMarketCap: {
    name: 'minMarketCap',
    type: 'fundamental',
    apply: (securities, context) => {
      const minCap = (context.state.parameters.minMarketCap as number) || 1e9;
      return securities.filter(s => (s.marketCap || 0) >= minCap);
    },
  },

  sectorFilter: {
    name: 'sectorFilter',
    type: 'fundamental',
    apply: (securities, context) => {
      const sectors = (context.state.parameters.sectors as string[]) || [];
      if (sectors.length === 0) return securities;
      return securities.filter(s => s.sector && sectors.includes(s.sector));
    },
  },

  momentumFilter: {
    name: 'momentumFilter',
    type: 'technical',
    apply: (securities) => {
      return securities.filter(s => {
        if (!s.technicals) return false;
        const { sma20, sma50 } = s.technicals;
        if (!sma20 || !sma50) return true;
        return s.price > sma20 && sma20 > sma50;
      });
    },
  },

  lowVolatilityFilter: {
    name: 'lowVolatilityFilter',
    type: 'technical',
    apply: (securities, context) => {
      const maxVol = (context.state.parameters.maxVolatility as number) || 0.5;
      return securities.filter(s => {
        if (!s.technicals?.volatility30d) return true;
        return s.technicals.volatility30d <= maxVol;
      });
    },
  },

  valueFilter: {
    name: 'valueFilter',
    type: 'fundamental',
    apply: (securities, context) => {
      const maxPE = (context.state.parameters.maxPE as number) || 25;
      return securities.filter(s => {
        if (!s.fundamentals?.peRatio) return true;
        return s.fundamentals.peRatio > 0 && s.fundamentals.peRatio <= maxPE;
      });
    },
  },

  qualityFilter: {
    name: 'qualityFilter',
    type: 'fundamental',
    apply: (securities, context) => {
      const minROE = (context.state.parameters.minROE as number) || 0.1;
      return securities.filter(s => {
        if (!s.fundamentals?.returnOnEquity) return true;
        return s.fundamentals.returnOnEquity >= minROE;
      });
    },
  },

  trendFilter: {
    name: 'trendFilter',
    type: 'technical',
    apply: (securities) => {
      return securities.filter(s => {
        if (!s.technicals?.sma200) return true;
        return s.price > s.technicals.sma200;
      });
    },
  },

  rsiFilter: {
    name: 'rsiFilter',
    type: 'technical',
    apply: (securities, context) => {
      const minRSI = (context.state.parameters.minRSI as number) || 30;
      const maxRSI = (context.state.parameters.maxRSI as number) || 70;
      return securities.filter(s => {
        if (!s.technicals?.rsi14) return true;
        return s.technicals.rsi14 >= minRSI && s.technicals.rsi14 <= maxRSI;
      });
    },
  },
};

export class UniverseSelectionModule {
  private config: UniverseSelectionConfig;
  private customFilters: Map<string, UniverseFilter> = new Map();
  private lastRefresh: number = 0;
  private cachedUniverse: Set<string> = new Set();

  constructor(config: Partial<UniverseSelectionConfig> = {}) {
    this.config = {
      mode: config.mode || 'dynamic',
      refreshIntervalMs: config.refreshIntervalMs || 86400000,
      maxSecurities: config.maxSecurities || 100,
      minSecurities: config.minSecurities || 10,
      filters: config.filters || [],
      coarseFilters: config.coarseFilters || [
        BUILT_IN_FILTERS.minPrice,
        BUILT_IN_FILTERS.minVolume,
      ],
      fineFilters: config.fineFilters || [],
    };
    logger.info('Universe Selection Module initialized', { mode: this.config.mode });
  }

  registerFilter(filter: UniverseFilter): void {
    this.customFilters.set(filter.name, filter);
    logger.info('Custom filter registered', { name: filter.name, type: filter.type });
  }

  getBuiltInFilter(name: string): UniverseFilter | undefined {
    return BUILT_IN_FILTERS[name];
  }

  async select(
    availableSecurities: Security[],
    context: AlgorithmContext
  ): Promise<UniverseSelectionResult> {
    const now = Date.now();
    const shouldRefresh = this.config.mode === 'dynamic' &&
      (now - this.lastRefresh) >= (this.config.refreshIntervalMs || 86400000);

    if (this.config.mode === 'static' && this.cachedUniverse.size > 0 && !shouldRefresh) {
      return { additions: [], removals: [] };
    }

    logger.debug('Running universe selection', {
      available: availableSecurities.length,
      currentUniverse: this.cachedUniverse.size,
    });

    let filtered = [...availableSecurities];

    for (const filter of this.config.coarseFilters || []) {
      const before = filtered.length;
      filtered = filter.apply(filtered, context);
      logger.debug('Coarse filter applied', {
        filter: filter.name,
        before,
        after: filtered.length,
      });
    }

    for (const filter of this.config.filters) {
      const filterFn = this.customFilters.get(filter.name) || BUILT_IN_FILTERS[filter.name] || filter;
      const before = filtered.length;
      filtered = filterFn.apply(filtered, context);
      logger.debug('Filter applied', {
        filter: filter.name,
        before,
        after: filtered.length,
      });
    }

    for (const filter of this.config.fineFilters || []) {
      const before = filtered.length;
      filtered = filter.apply(filtered, context);
      logger.debug('Fine filter applied', {
        filter: filter.name,
        before,
        after: filtered.length,
      });
    }

    if (filtered.length > (this.config.maxSecurities || 100)) {
      filtered = this.rankAndSelect(filtered, context);
    }

    const newUniverse = new Set(filtered.map(s => s.symbol));
    const additions: string[] = [];
    const removals: string[] = [];

    for (const symbol of newUniverse) {
      if (!this.cachedUniverse.has(symbol)) {
        additions.push(symbol);
      }
    }

    for (const symbol of this.cachedUniverse) {
      if (!newUniverse.has(symbol)) {
        removals.push(symbol);
      }
    }

    this.cachedUniverse = newUniverse;
    this.lastRefresh = now;

    logger.info('Universe selection complete', {
      total: newUniverse.size,
      additions: additions.length,
      removals: removals.length,
    });

    return { additions, removals };
  }

  private rankAndSelect(securities: Security[], context: AlgorithmContext): Security[] {
    const ranked = securities.map(s => ({
      security: s,
      score: this.calculateScore(s, context),
    }));

    ranked.sort((a, b) => b.score - a.score);

    return ranked
      .slice(0, this.config.maxSecurities || 100)
      .map(r => r.security);
  }

  private calculateScore(security: Security, context: AlgorithmContext): number {
    let score = 0;

    score += Math.min(Math.log10(security.volume) / 10, 1) * 0.2;

    if (security.marketCap) {
      score += Math.min(Math.log10(security.marketCap) / 12, 1) * 0.15;
    }

    if (security.technicals) {
      if (security.technicals.rsi14) {
        const rsiScore = 1 - Math.abs(security.technicals.rsi14 - 50) / 50;
        score += rsiScore * 0.15;
      }

      if (security.technicals.sma50 && security.technicals.sma200) {
        if (security.technicals.sma50 > security.technicals.sma200) {
          score += 0.1;
        }
      }

      if (security.technicals.volatility30d) {
        const volScore = 1 - Math.min(security.technicals.volatility30d, 1);
        score += volScore * 0.1;
      }
    }

    if (security.fundamentals) {
      if (security.fundamentals.returnOnEquity && security.fundamentals.returnOnEquity > 0.15) {
        score += 0.15;
      }
      if (security.fundamentals.earningsGrowth && security.fundamentals.earningsGrowth > 0.1) {
        score += 0.15;
      }
    }

    return score;
  }

  getCurrentUniverse(): string[] {
    return Array.from(this.cachedUniverse);
  }

  setUniverse(symbols: string[]): void {
    this.cachedUniverse = new Set(symbols);
    this.lastRefresh = Date.now();
    logger.info('Universe manually set', { size: symbols.length });
  }

  clearCache(): void {
    this.cachedUniverse.clear();
    this.lastRefresh = 0;
  }
}

export const createMomentumUniverse = (): UniverseSelectionModule => {
  return new UniverseSelectionModule({
    mode: 'dynamic',
    refreshIntervalMs: 86400000,
    maxSecurities: 50,
    coarseFilters: [
      BUILT_IN_FILTERS.minPrice,
      BUILT_IN_FILTERS.minVolume,
      BUILT_IN_FILTERS.minMarketCap,
    ],
    filters: [
      BUILT_IN_FILTERS.momentumFilter,
      BUILT_IN_FILTERS.trendFilter,
    ],
  });
};

export const createValueUniverse = (): UniverseSelectionModule => {
  return new UniverseSelectionModule({
    mode: 'dynamic',
    refreshIntervalMs: 604800000,
    maxSecurities: 30,
    coarseFilters: [
      BUILT_IN_FILTERS.minPrice,
      BUILT_IN_FILTERS.minVolume,
      BUILT_IN_FILTERS.minMarketCap,
    ],
    filters: [
      BUILT_IN_FILTERS.valueFilter,
      BUILT_IN_FILTERS.qualityFilter,
    ],
  });
};

export const createLowVolatilityUniverse = (): UniverseSelectionModule => {
  return new UniverseSelectionModule({
    mode: 'dynamic',
    refreshIntervalMs: 604800000,
    maxSecurities: 40,
    coarseFilters: [
      BUILT_IN_FILTERS.minPrice,
      BUILT_IN_FILTERS.minVolume,
      BUILT_IN_FILTERS.minMarketCap,
    ],
    filters: [
      BUILT_IN_FILTERS.lowVolatilityFilter,
      BUILT_IN_FILTERS.qualityFilter,
    ],
  });
};
