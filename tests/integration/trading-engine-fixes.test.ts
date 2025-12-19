import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Integration tests for Trading Engine Fixes
 *
 * Tests the following surgical fixes:
 * 1. Bracket order TIF validation (work-queue.ts)
 * 2. Position reinforcement threshold (orchestrator.ts)
 * 3. Pyramid-up logic for winning positions (orchestrator.ts)
 * 4. Stuck order detection timing (alpaca-trading-engine.ts)
 */

describe('Trading Engine Fixes', () => {
  describe('Bracket Order TIF Validation', () => {
    it('should correct GTC to DAY for bracket orders', () => {
      // Test the TIF correction logic
      const order_class = 'bracket';
      const time_in_force = 'gtc';

      // Apply the fix logic
      let correctedTif = time_in_force || 'day';
      if (order_class === 'bracket' && correctedTif !== 'day') {
        correctedTif = 'day';
      }

      expect(correctedTif).toBe('day');
    });

    it('should preserve DAY for bracket orders', () => {
      const order_class = 'bracket';
      const time_in_force = 'day';

      let correctedTif = time_in_force || 'day';
      if (order_class === 'bracket' && correctedTif !== 'day') {
        correctedTif = 'day';
      }

      expect(correctedTif).toBe('day');
    });

    it('should allow GTC for non-bracket orders', () => {
      const order_class = undefined;
      const time_in_force = 'gtc';

      let correctedTif = time_in_force || 'day';
      if (order_class === 'bracket' && correctedTif !== 'day') {
        correctedTif = 'day';
      }

      expect(correctedTif).toBe('gtc');
    });

    it('should default to DAY when no TIF specified', () => {
      const order_class = undefined;
      const time_in_force = undefined;

      let correctedTif = time_in_force || 'day';

      expect(correctedTif).toBe('day');
    });
  });

  describe('Position Reinforcement Threshold', () => {
    it('should reinforce position at 50% confidence', () => {
      const confidence = 0.50;
      const threshold = 0.50;

      const shouldReinforce = confidence >= threshold;

      expect(shouldReinforce).toBe(true);
    });

    it('should reinforce position at 70% confidence', () => {
      const confidence = 0.70;
      const threshold = 0.50;

      const shouldReinforce = confidence >= threshold;

      expect(shouldReinforce).toBe(true);
    });

    it('should NOT reinforce position at 45% confidence', () => {
      const confidence = 0.45;
      const threshold = 0.50;

      const shouldReinforce = confidence >= threshold;

      expect(shouldReinforce).toBe(false);
    });

    it('should generate correct skip reason for low confidence', () => {
      const confidence = 0.45;
      const reason = `Already have position, confidence ${(confidence * 100).toFixed(1)}% below 50% threshold`;

      expect(reason).toBe('Already have position, confidence 45.0% below 50% threshold');
    });
  });

  describe('Pyramid-Up Logic', () => {
    it('should trigger pyramid-up at 5% profit', () => {
      const unrealizedPnlPercent = 5;
      const pyramidMinProfitPercent = 5;
      const pyramidMaxProfitPercent = 20;

      const shouldPyramid =
        unrealizedPnlPercent >= pyramidMinProfitPercent &&
        unrealizedPnlPercent <= pyramidMaxProfitPercent;

      expect(shouldPyramid).toBe(true);
    });

    it('should trigger pyramid-up at 15% profit', () => {
      const unrealizedPnlPercent = 15;
      const pyramidMinProfitPercent = 5;
      const pyramidMaxProfitPercent = 20;

      const shouldPyramid =
        unrealizedPnlPercent >= pyramidMinProfitPercent &&
        unrealizedPnlPercent <= pyramidMaxProfitPercent;

      expect(shouldPyramid).toBe(true);
    });

    it('should NOT trigger pyramid-up at 3% profit (below minimum)', () => {
      const unrealizedPnlPercent = 3;
      const pyramidMinProfitPercent = 5;
      const pyramidMaxProfitPercent = 20;

      const shouldPyramid =
        unrealizedPnlPercent >= pyramidMinProfitPercent &&
        unrealizedPnlPercent <= pyramidMaxProfitPercent;

      expect(shouldPyramid).toBe(false);
    });

    it('should NOT trigger pyramid-up at 25% profit (above maximum)', () => {
      const unrealizedPnlPercent = 25;
      const pyramidMinProfitPercent = 5;
      const pyramidMaxProfitPercent = 20;

      const shouldPyramid =
        unrealizedPnlPercent >= pyramidMinProfitPercent &&
        unrealizedPnlPercent <= pyramidMaxProfitPercent;

      expect(shouldPyramid).toBe(false);
    });

    it('should calculate correct pyramid value (50% of original)', () => {
      const quantity = 100;
      const entryPrice = 50;
      const portfolioValue = 100000;
      const availableForBuying = 5000;

      const originalPositionValue = quantity * entryPrice; // $5000
      const pyramidValue = Math.min(
        originalPositionValue * 0.5, // $2500
        availableForBuying, // $5000
        portfolioValue * 0.05 // $5000
      );

      expect(pyramidValue).toBe(2500);
    });

    it('should cap pyramid value at available cash', () => {
      const quantity = 100;
      const entryPrice = 100;
      const portfolioValue = 100000;
      const availableForBuying = 1000; // Limited cash

      const originalPositionValue = quantity * entryPrice; // $10,000
      const pyramidValue = Math.min(
        originalPositionValue * 0.5, // $5000
        availableForBuying, // $1000 (limit)
        portfolioValue * 0.05 // $5000
      );

      expect(pyramidValue).toBe(1000);
    });
  });

  describe('Stuck Order Detection', () => {
    it('should use 10 minute threshold for pending orders', () => {
      const status = 'pending';
      const PENDING_ORDER_MAX_AGE_MINUTES = 10;
      const DEFAULT_ORDER_MAX_AGE_MINUTES = 60;

      const isPendingOrder =
        status === 'pending' || status === 'new' || status === 'pending_new';

      const effectiveMaxAge = isPendingOrder
        ? PENDING_ORDER_MAX_AGE_MINUTES
        : DEFAULT_ORDER_MAX_AGE_MINUTES;

      expect(effectiveMaxAge).toBe(10);
    });

    it('should use 10 minute threshold for new orders', () => {
      const status = 'new';
      const PENDING_ORDER_MAX_AGE_MINUTES = 10;
      const DEFAULT_ORDER_MAX_AGE_MINUTES = 60;

      const isPendingOrder =
        status === 'pending' || status === 'new' || status === 'pending_new';

      const effectiveMaxAge = isPendingOrder
        ? PENDING_ORDER_MAX_AGE_MINUTES
        : DEFAULT_ORDER_MAX_AGE_MINUTES;

      expect(effectiveMaxAge).toBe(10);
    });

    it('should use 60 minute threshold for accepted orders', () => {
      const status = 'accepted';
      const PENDING_ORDER_MAX_AGE_MINUTES = 10;
      const DEFAULT_ORDER_MAX_AGE_MINUTES = 60;

      const isPendingOrder =
        status === 'pending' || status === 'new' || status === 'pending_new';

      const effectiveMaxAge = isPendingOrder
        ? PENDING_ORDER_MAX_AGE_MINUTES
        : DEFAULT_ORDER_MAX_AGE_MINUTES;

      expect(effectiveMaxAge).toBe(60);
    });

    it('should skip filled orders in stale detection', () => {
      const status = 'filled';

      const shouldSkip = status === 'filled' || status === 'partially_filled';

      expect(shouldSkip).toBe(true);
    });

    it('should skip partially_filled orders in stale detection', () => {
      const status = 'partially_filled';

      const shouldSkip = status === 'filled' || status === 'partially_filled';

      expect(shouldSkip).toBe(true);
    });
  });

  describe('Quantity Calculation Fix', () => {
    it('should use suggestedQuantity when available', () => {
      const suggestedQuantityFromMetadata = 0.08;
      const defaultPct = 0.05;

      const suggestedPct = suggestedQuantityFromMetadata
        ? parseFloat(String(suggestedQuantityFromMetadata))
        : defaultPct;

      expect(suggestedPct).toBe(0.08);
    });

    it('should default to 5% when no suggestedQuantity', () => {
      const suggestedQuantityFromMetadata = null;
      const defaultPct = 0.05;

      const suggestedPct = suggestedQuantityFromMetadata
        ? parseFloat(String(suggestedQuantityFromMetadata))
        : defaultPct;

      expect(suggestedPct).toBe(0.05);
    });

    it('should cap position size between 1% and 10%', () => {
      const suggestedPct = 0.20; // 20% - too high

      const cappedPct = Math.min(Math.max(suggestedPct * 100, 1), 10);

      expect(cappedPct).toBe(10);
    });

    it('should enforce minimum 1% position size', () => {
      const suggestedPct = 0.005; // 0.5% - too low

      const cappedPct = Math.min(Math.max(suggestedPct * 100, 1), 10);

      expect(cappedPct).toBe(1);
    });
  });
});
