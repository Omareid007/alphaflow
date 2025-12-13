/**
 * AI Active Trader - Feature Flags Smoke Tests
 * Tests for strangler fig pattern traffic routing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FeatureFlagService,
  FeatureFlagConfig,
  resetFeatureFlagService,
} from './feature-flags';

describe('Feature Flag System', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    resetFeatureFlagService();
    service = new FeatureFlagService();
  });

  describe('Flag Configuration', () => {
    it('should initialize with default flags', () => {
      const flags = service.getAllFlags();
      expect(flags.length).toBeGreaterThan(0);

      const marketDataFlag = service.getFlag('market-data-service');
      expect(marketDataFlag).toBeDefined();
      expect(marketDataFlag?.routingTarget).toBe('monolith');
      expect(marketDataFlag?.rolloutPercentage).toBe(0);
    });

    it('should allow custom flag configuration', () => {
      const customService = new FeatureFlagService({
        'custom-feature': {
          description: 'Custom feature flag',
          enabled: true,
          routingTarget: 'microservice',
          rolloutPercentage: 50,
        },
      });

      const flag = customService.getFlag('custom-feature');
      expect(flag).toBeDefined();
      expect(flag?.rolloutPercentage).toBe(50);
    });

    it('should update flag configuration', () => {
      service.setFlag('market-data-service', {
        rolloutPercentage: 25,
      });

      const flag = service.getFlag('market-data-service');
      expect(flag?.rolloutPercentage).toBe(25);
      expect(flag?.updatedAt).toBeDefined();
    });
  });

  describe('Routing Decisions', () => {
    it('should route to monolith when flag is disabled', () => {
      service.setFlag('market-data-service', { enabled: false });

      const decision = service.evaluateRouting('market-data-service', 'user-1');
      expect(decision.target).toBe('monolith');
      expect(decision.reason).toBe('Flag disabled');
    });

    it('should route to monolith when flag not found', () => {
      const decision = service.evaluateRouting('nonexistent-flag', 'user-1');
      expect(decision.target).toBe('monolith');
      expect(decision.reason).toBe('Flag not found');
    });

    it('should route to monolith at 0% rollout', () => {
      service.setFlag('market-data-service', { rolloutPercentage: 0 });

      const decision = service.evaluateRouting('market-data-service', 'user-1');
      expect(decision.target).toBe('monolith');
    });

    it('should route to microservice when routingTarget is microservice at 0% rollout', () => {
      service.setFlag('market-data-service', {
        routingTarget: 'microservice',
        rolloutPercentage: 0,
      });

      const decision = service.evaluateRouting('market-data-service', 'user-1');
      expect(decision.target).toBe('microservice');
      expect(decision.reason).toBe('Default routing (0%)');

      const metrics = service.getMetrics();
      expect(metrics.microserviceRoutings).toBe(1);
      expect(metrics.monolithRoutings).toBe(0);
    });

    it('should route to microservice at 100% rollout', () => {
      service.setFlag('market-data-service', { rolloutPercentage: 100 });

      const decision = service.evaluateRouting('market-data-service', 'user-1');
      expect(decision.target).toBe('microservice');
      expect(decision.reason).toBe('Full rollout (100%)');
    });

    it('should respect user whitelist', () => {
      service.setFlag('trading-engine-service', {
        rolloutPercentage: 0,
        userWhitelist: ['beta-user-1', 'beta-user-2'],
      });

      const whitelistedDecision = service.evaluateRouting('trading-engine-service', 'beta-user-1');
      expect(whitelistedDecision.target).toBe('microservice');
      expect(whitelistedDecision.reason).toBe('User in whitelist');

      const normalDecision = service.evaluateRouting('trading-engine-service', 'regular-user');
      expect(normalDecision.target).toBe('monolith');
    });

    it('should respect user blacklist over whitelist', () => {
      service.setFlag('ai-decision-service', {
        rolloutPercentage: 100,
        userWhitelist: ['user-1'],
        userBlacklist: ['user-1'],
      });

      const decision = service.evaluateRouting('ai-decision-service', 'user-1');
      expect(decision.target).toBe('monolith');
      expect(decision.reason).toBe('User in blacklist');
    });
  });

  describe('Rollout Management', () => {
    it('should set rollout percentage with clamping', () => {
      service.setRolloutPercentage('market-data-service', 150);
      expect(service.getFlag('market-data-service')?.rolloutPercentage).toBe(100);

      service.setRolloutPercentage('market-data-service', -50);
      expect(service.getFlag('market-data-service')?.rolloutPercentage).toBe(0);

      service.setRolloutPercentage('market-data-service', 50);
      expect(service.getFlag('market-data-service')?.rolloutPercentage).toBe(50);
    });

    it('should enable microservice fully', () => {
      service.enableMicroservice('trading-engine-service');

      const flag = service.getFlag('trading-engine-service');
      expect(flag?.routingTarget).toBe('microservice');
      expect(flag?.rolloutPercentage).toBe(100);
    });

    it('should disable microservice', () => {
      service.enableMicroservice('analytics-service');
      service.disableMicroservice('analytics-service');

      const flag = service.getFlag('analytics-service');
      expect(flag?.routingTarget).toBe('monolith');
      expect(flag?.rolloutPercentage).toBe(0);
    });

    it('should generate gradual rollout schedule', () => {
      service.setFlag('market-data-service', { rolloutPercentage: 0 });

      const schedule = service.gradualRollout('market-data-service', 100, 5);
      expect(schedule).toEqual([20, 40, 60, 80, 100]);
    });

    it('should generate rollout schedule from current percentage', () => {
      service.setFlag('market-data-service', { rolloutPercentage: 50 });

      const schedule = service.gradualRollout('market-data-service', 100, 5);
      expect(schedule).toEqual([60, 70, 80, 90, 100]);
    });
  });

  describe('Whitelist Management', () => {
    it('should add users to whitelist', () => {
      service.addToWhitelist('market-data-service', 'beta-tester-1');
      service.addToWhitelist('market-data-service', 'beta-tester-2');

      const flag = service.getFlag('market-data-service');
      expect(flag?.userWhitelist).toContain('beta-tester-1');
      expect(flag?.userWhitelist).toContain('beta-tester-2');
    });

    it('should remove users from whitelist', () => {
      service.addToWhitelist('market-data-service', 'beta-tester-1');
      service.removeFromWhitelist('market-data-service', 'beta-tester-1');

      const flag = service.getFlag('market-data-service');
      expect(flag?.userWhitelist).not.toContain('beta-tester-1');
    });

    it('should add users to blacklist', () => {
      service.addToBlacklist('trading-engine-service', 'problematic-user');

      const flag = service.getFlag('trading-engine-service');
      expect(flag?.userBlacklist).toContain('problematic-user');
    });
  });

  describe('Metrics Tracking', () => {
    it('should track evaluation metrics', () => {
      service.setFlag('market-data-service', { rolloutPercentage: 100 });
      service.setFlag('trading-engine-service', { rolloutPercentage: 0 });

      service.evaluateRouting('market-data-service', 'user-1');
      service.evaluateRouting('market-data-service', 'user-2');
      service.evaluateRouting('trading-engine-service', 'user-3');

      const metrics = service.getMetrics();
      expect(metrics.totalEvaluations).toBe(3);
      expect(metrics.microserviceRoutings).toBe(2);
      expect(metrics.monolithRoutings).toBe(1);
    });

    it('should track whitelist hits', () => {
      service.setFlag('market-data-service', {
        rolloutPercentage: 0,
        userWhitelist: ['vip-user'],
      });

      service.evaluateRouting('market-data-service', 'vip-user');
      service.evaluateRouting('market-data-service', 'regular-user');

      const metrics = service.getMetrics();
      expect(metrics.whitelistHits).toBe(1);
    });

    it('should reset metrics', () => {
      service.evaluateRouting('market-data-service', 'user-1');
      service.resetMetrics();

      const metrics = service.getMetrics();
      expect(metrics.totalEvaluations).toBe(0);
    });
  });

  describe('Percentage-Based Routing', () => {
    it('should distribute traffic based on percentage', () => {
      service.setFlag('market-data-service', { rolloutPercentage: 50 });

      const results = { monolith: 0, microservice: 0 };

      for (let i = 0; i < 100; i++) {
        const decision = service.evaluateRouting('market-data-service', `user-${i}`);
        results[decision.target]++;
      }

      expect(results.monolith).toBeGreaterThan(20);
      expect(results.microservice).toBeGreaterThan(20);
    });

    it('should be consistent for same user', () => {
      service.setFlag('market-data-service', { rolloutPercentage: 50 });

      const firstDecision = service.evaluateRouting('market-data-service', 'consistent-user');
      const secondDecision = service.evaluateRouting('market-data-service', 'consistent-user');

      expect(firstDecision.target).toBe(secondDecision.target);
    });
  });
});
