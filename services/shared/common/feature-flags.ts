/**
 * AI Active Trader - Feature Flag System
 * Implements strangler fig pattern for gradual migration from monolith to microservices
 */

import { createLogger } from './logger';

const logger = createLogger('feature-flags', 'info');

export type RoutingTarget = 'monolith' | 'microservice';

export interface FeatureFlagConfig {
  name: string;
  description?: string;
  enabled: boolean;
  routingTarget: RoutingTarget;
  rolloutPercentage: number;
  userWhitelist?: string[];
  userBlacklist?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RoutingDecision {
  target: RoutingTarget;
  flagName: string;
  reason: string;
}

export interface FeatureFlagMetrics {
  totalEvaluations: number;
  monolithRoutings: number;
  microserviceRoutings: number;
  whitelistHits: number;
  blacklistHits: number;
  percentageBasedRoutings: number;
}

const DEFAULT_FLAGS: Record<string, FeatureFlagConfig> = {
  'market-data-service': {
    name: 'market-data-service',
    description: 'Route market data requests to microservice',
    enabled: true,
    routingTarget: 'monolith',
    rolloutPercentage: 0,
  },
  'trading-engine-service': {
    name: 'trading-engine-service',
    description: 'Route trading requests to microservice',
    enabled: true,
    routingTarget: 'monolith',
    rolloutPercentage: 0,
  },
  'ai-decision-service': {
    name: 'ai-decision-service',
    description: 'Route AI decision requests to microservice',
    enabled: true,
    routingTarget: 'monolith',
    rolloutPercentage: 0,
  },
  'analytics-service': {
    name: 'analytics-service',
    description: 'Route analytics requests to microservice',
    enabled: true,
    routingTarget: 'monolith',
    rolloutPercentage: 0,
  },
  'orchestrator-service': {
    name: 'orchestrator-service',
    description: 'Route orchestrator requests to microservice',
    enabled: true,
    routingTarget: 'monolith',
    rolloutPercentage: 0,
  },
};

export class FeatureFlagService {
  private flags: Map<string, FeatureFlagConfig> = new Map();
  private metrics: FeatureFlagMetrics = {
    totalEvaluations: 0,
    monolithRoutings: 0,
    microserviceRoutings: 0,
    whitelistHits: 0,
    blacklistHits: 0,
    percentageBasedRoutings: 0,
  };

  constructor(initialFlags?: Record<string, Partial<FeatureFlagConfig>>) {
    Object.entries(DEFAULT_FLAGS).forEach(([name, config]) => {
      const overrides = initialFlags?.[name] || {};
      this.flags.set(name, { ...config, ...overrides, name });
    });

    if (initialFlags) {
      Object.entries(initialFlags).forEach(([name, config]) => {
        if (!this.flags.has(name)) {
          this.flags.set(name, {
            name,
            enabled: true,
            routingTarget: 'monolith',
            rolloutPercentage: 0,
            ...config,
          } as FeatureFlagConfig);
        }
      });
    }

    logger.info('Feature flags initialized', { flagCount: this.flags.size });
  }

  getFlag(name: string): FeatureFlagConfig | undefined {
    return this.flags.get(name);
  }

  getAllFlags(): FeatureFlagConfig[] {
    return Array.from(this.flags.values());
  }

  setFlag(name: string, config: Partial<FeatureFlagConfig>): void {
    const existing = this.flags.get(name);
    const updated: FeatureFlagConfig = {
      name,
      enabled: true,
      routingTarget: 'monolith',
      rolloutPercentage: 0,
      ...existing,
      ...config,
      updatedAt: new Date(),
    };

    this.flags.set(name, updated);
    logger.info('Feature flag updated', { name, config: updated });
  }

  evaluateRouting(flagName: string, userId?: string, requestId?: string): RoutingDecision {
    this.metrics.totalEvaluations++;

    const flag = this.flags.get(flagName);

    if (!flag || !flag.enabled) {
      this.metrics.monolithRoutings++;
      return {
        target: 'monolith',
        flagName,
        reason: flag ? 'Flag disabled' : 'Flag not found',
      };
    }

    if (userId && flag.userBlacklist?.includes(userId)) {
      this.metrics.blacklistHits++;
      this.metrics.monolithRoutings++;
      return {
        target: 'monolith',
        flagName,
        reason: 'User in blacklist',
      };
    }

    if (userId && flag.userWhitelist?.includes(userId)) {
      this.metrics.whitelistHits++;
      this.metrics.microserviceRoutings++;
      return {
        target: 'microservice',
        flagName,
        reason: 'User in whitelist',
      };
    }

    if (flag.rolloutPercentage >= 100) {
      this.metrics.microserviceRoutings++;
      return {
        target: 'microservice',
        flagName,
        reason: 'Full rollout (100%)',
      };
    }

    if (flag.rolloutPercentage <= 0) {
      if (flag.routingTarget === 'microservice') {
        this.metrics.microserviceRoutings++;
      } else {
        this.metrics.monolithRoutings++;
      }
      return {
        target: flag.routingTarget,
        flagName,
        reason: 'Default routing (0%)',
      };
    }

    const hash = this.hashForPercentage(userId || requestId || String(Date.now()));
    const shouldRouteToMicroservice = hash < flag.rolloutPercentage;

    this.metrics.percentageBasedRoutings++;
    if (shouldRouteToMicroservice) {
      this.metrics.microserviceRoutings++;
      return {
        target: 'microservice',
        flagName,
        reason: `Percentage rollout (${flag.rolloutPercentage}%)`,
      };
    } else {
      this.metrics.monolithRoutings++;
      return {
        target: 'monolith',
        flagName,
        reason: `Percentage rollout (${flag.rolloutPercentage}%)`,
      };
    }
  }

  private hashForPercentage(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }

  setRolloutPercentage(flagName: string, percentage: number): void {
    const clamped = Math.max(0, Math.min(100, percentage));
    this.setFlag(flagName, { rolloutPercentage: clamped });
    logger.info('Rollout percentage updated', { flagName, percentage: clamped });
  }

  enableMicroservice(flagName: string): void {
    this.setFlag(flagName, { routingTarget: 'microservice', rolloutPercentage: 100 });
    logger.info('Microservice fully enabled', { flagName });
  }

  disableMicroservice(flagName: string): void {
    this.setFlag(flagName, { routingTarget: 'monolith', rolloutPercentage: 0 });
    logger.info('Microservice disabled', { flagName });
  }

  gradualRollout(flagName: string, targetPercentage: number, steps: number = 10): number[] {
    const current = this.flags.get(flagName)?.rolloutPercentage || 0;
    const increment = (targetPercentage - current) / steps;
    const schedule: number[] = [];

    for (let i = 1; i <= steps; i++) {
      schedule.push(Math.round(current + increment * i));
    }

    return schedule;
  }

  addToWhitelist(flagName: string, userId: string): void {
    const flag = this.flags.get(flagName);
    if (!flag) return;

    const whitelist = new Set(flag.userWhitelist || []);
    whitelist.add(userId);
    this.setFlag(flagName, { userWhitelist: Array.from(whitelist) });
    logger.info('User added to whitelist', { flagName, userId });
  }

  removeFromWhitelist(flagName: string, userId: string): void {
    const flag = this.flags.get(flagName);
    if (!flag || !flag.userWhitelist) return;

    const whitelist = new Set(flag.userWhitelist);
    whitelist.delete(userId);
    this.setFlag(flagName, { userWhitelist: Array.from(whitelist) });
    logger.info('User removed from whitelist', { flagName, userId });
  }

  addToBlacklist(flagName: string, userId: string): void {
    const flag = this.flags.get(flagName);
    if (!flag) return;

    const blacklist = new Set(flag.userBlacklist || []);
    blacklist.add(userId);
    this.setFlag(flagName, { userBlacklist: Array.from(blacklist) });
    logger.info('User added to blacklist', { flagName, userId });
  }

  getMetrics(): FeatureFlagMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      totalEvaluations: 0,
      monolithRoutings: 0,
      microserviceRoutings: 0,
      whitelistHits: 0,
      blacklistHits: 0,
      percentageBasedRoutings: 0,
    };
  }
}

let defaultInstance: FeatureFlagService | null = null;

export function getFeatureFlagService(config?: Record<string, Partial<FeatureFlagConfig>>): FeatureFlagService {
  if (!defaultInstance) {
    defaultInstance = new FeatureFlagService(config);
  }
  return defaultInstance;
}

export function resetFeatureFlagService(): void {
  defaultInstance = null;
}
