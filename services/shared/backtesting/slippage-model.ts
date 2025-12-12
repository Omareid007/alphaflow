/**
 * AI Active Trader - Slippage Models
 * Market impact simulation for backtesting
 */

import { createLogger } from '../common';
import type { OrderTicket } from '../algorithm-framework/types';
import type { OHLCVBar } from './data-feed';

const logger = createLogger('backtesting-slippage-model');

/**
 * Slippage calculation result
 */
export interface SlippageResult {
  orderId: string;
  originalPrice: number;
  adjustedPrice: number;
  slippageAmount: number;
  slippageBps: number;
  reason: string;
}

/**
 * Market context for slippage calculation
 */
export interface SlippageContext {
  bar: OHLCVBar;
  previousBars?: OHLCVBar[];
  averageDailyVolume?: number;
  atr?: number;
  volatility?: number;
}

/**
 * SlippageModel interface for market impact simulation
 */
export interface SlippageModel {
  /** Name of the slippage model */
  readonly name: string;
  
  /**
   * Calculate slippage for an order
   * @param order - The order
   * @param basePrice - The base execution price
   * @param context - Market context
   * @returns Slippage result with adjusted price
   */
  calculate(order: OrderTicket, basePrice: number, context: SlippageContext): SlippageResult;
}

/**
 * FixedSlippage - Constant basis points slippage
 * Simple model for testing and approximations
 */
export class FixedSlippage implements SlippageModel {
  readonly name = 'FixedSlippage';
  private slippageBps: number;

  /**
   * Create fixed slippage model
   * @param slippageBps - Slippage in basis points (10 = 0.1%)
   */
  constructor(slippageBps: number = 10) {
    this.slippageBps = slippageBps;
  }

  calculate(order: OrderTicket, basePrice: number, context: SlippageContext): SlippageResult {
    const slippageRate = this.slippageBps / 10000;
    const slippageAmount = basePrice * slippageRate;

    const adjustedPrice = order.side === 'buy'
      ? basePrice + slippageAmount
      : basePrice - slippageAmount;

    return {
      orderId: order.id,
      originalPrice: basePrice,
      adjustedPrice,
      slippageAmount,
      slippageBps: this.slippageBps,
      reason: `Fixed ${this.slippageBps} bps slippage`,
    };
  }
}

/**
 * ZeroSlippage - No slippage (for testing)
 */
export class ZeroSlippage implements SlippageModel {
  readonly name = 'ZeroSlippage';

  calculate(order: OrderTicket, basePrice: number, context: SlippageContext): SlippageResult {
    return {
      orderId: order.id,
      originalPrice: basePrice,
      adjustedPrice: basePrice,
      slippageAmount: 0,
      slippageBps: 0,
      reason: 'No slippage applied',
    };
  }
}

/**
 * VolumeSlippage - Slippage based on order size vs volume
 * Models market impact from large orders
 */
export class VolumeSlippage implements SlippageModel {
  readonly name = 'VolumeSlippage';
  private baseSlippageBps: number;
  private volumeExponent: number;
  private maxSlippageBps: number;

  /**
   * Create volume-based slippage model
   * @param baseSlippageBps - Base slippage at 1% of ADV
   * @param volumeExponent - Non-linear scaling exponent (1.5 is square-root-like)
   * @param maxSlippageBps - Maximum slippage cap
   */
  constructor(
    baseSlippageBps: number = 5,
    volumeExponent: number = 0.5,
    maxSlippageBps: number = 100
  ) {
    this.baseSlippageBps = baseSlippageBps;
    this.volumeExponent = volumeExponent;
    this.maxSlippageBps = maxSlippageBps;
  }

  calculate(order: OrderTicket, basePrice: number, context: SlippageContext): SlippageResult {
    const adv = context.averageDailyVolume || context.bar.volume * 20;
    const participationRate = order.quantity / adv;

    const scaledSlippage = this.baseSlippageBps * Math.pow(participationRate * 100, this.volumeExponent);
    const slippageBps = Math.min(scaledSlippage, this.maxSlippageBps);
    const slippageRate = slippageBps / 10000;
    const slippageAmount = basePrice * slippageRate;

    const adjustedPrice = order.side === 'buy'
      ? basePrice + slippageAmount
      : basePrice - slippageAmount;

    return {
      orderId: order.id,
      originalPrice: basePrice,
      adjustedPrice,
      slippageAmount,
      slippageBps,
      reason: `Volume impact: ${(participationRate * 100).toFixed(2)}% of ADV = ${slippageBps.toFixed(1)} bps`,
    };
  }
}

/**
 * VolatilitySlippage - Slippage based on ATR/volatility
 * Models higher slippage during volatile periods
 */
export class VolatilitySlippage implements SlippageModel {
  readonly name = 'VolatilitySlippage';
  private baseSlippageBps: number;
  private volatilityMultiplier: number;
  private maxSlippageBps: number;

  /**
   * Create volatility-based slippage model
   * @param baseSlippageBps - Base slippage at normal volatility
   * @param volatilityMultiplier - Scaling factor for volatility
   * @param maxSlippageBps - Maximum slippage cap
   */
  constructor(
    baseSlippageBps: number = 5,
    volatilityMultiplier: number = 1.0,
    maxSlippageBps: number = 50
  ) {
    this.baseSlippageBps = baseSlippageBps;
    this.volatilityMultiplier = volatilityMultiplier;
    this.maxSlippageBps = maxSlippageBps;
  }

  calculate(order: OrderTicket, basePrice: number, context: SlippageContext): SlippageResult {
    let volatilityFactor = 1.0;

    if (context.atr) {
      const atrPercent = (context.atr / basePrice) * 100;
      volatilityFactor = atrPercent * this.volatilityMultiplier;
    } else if (context.volatility) {
      volatilityFactor = context.volatility * this.volatilityMultiplier * 100;
    } else if (context.previousBars && context.previousBars.length >= 14) {
      const atr = this.calculateATR(context.previousBars, 14);
      const atrPercent = (atr / basePrice) * 100;
      volatilityFactor = atrPercent * this.volatilityMultiplier;
    }

    const slippageBps = Math.min(
      this.baseSlippageBps * volatilityFactor,
      this.maxSlippageBps
    );
    const slippageRate = slippageBps / 10000;
    const slippageAmount = basePrice * slippageRate;

    const adjustedPrice = order.side === 'buy'
      ? basePrice + slippageAmount
      : basePrice - slippageAmount;

    return {
      orderId: order.id,
      originalPrice: basePrice,
      adjustedPrice,
      slippageAmount,
      slippageBps,
      reason: `Volatility factor ${volatilityFactor.toFixed(2)}x = ${slippageBps.toFixed(1)} bps`,
    };
  }

  private calculateATR(bars: OHLCVBar[], period: number): number {
    if (bars.length < period + 1) return 0;

    const trueRanges: number[] = [];
    for (let i = 1; i < bars.length; i++) {
      const high = bars[i].high;
      const low = bars[i].low;
      const prevClose = bars[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    const recentTR = trueRanges.slice(-period);
    return recentTR.reduce((sum, tr) => sum + tr, 0) / period;
  }
}

/**
 * CompositeSlippage - Combines multiple slippage models
 */
export class CompositeSlippage implements SlippageModel {
  readonly name = 'CompositeSlippage';
  private models: SlippageModel[];
  private weights: number[];

  /**
   * Create composite slippage model
   * @param models - Array of slippage models
   * @param weights - Weights for each model (normalized automatically)
   */
  constructor(models: SlippageModel[], weights?: number[]) {
    this.models = models;
    
    if (weights && weights.length === models.length) {
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      this.weights = weights.map(w => w / totalWeight);
    } else {
      this.weights = models.map(() => 1 / models.length);
    }
  }

  calculate(order: OrderTicket, basePrice: number, context: SlippageContext): SlippageResult {
    let totalSlippage = 0;
    const reasons: string[] = [];

    for (let i = 0; i < this.models.length; i++) {
      const result = this.models[i].calculate(order, basePrice, context);
      totalSlippage += result.slippageAmount * this.weights[i];
      reasons.push(`${this.models[i].name}: ${result.slippageBps.toFixed(1)} bps`);
    }

    const adjustedPrice = order.side === 'buy'
      ? basePrice + totalSlippage
      : basePrice - totalSlippage;

    const slippageBps = (totalSlippage / basePrice) * 10000;

    return {
      orderId: order.id,
      originalPrice: basePrice,
      adjustedPrice,
      slippageAmount: totalSlippage,
      slippageBps,
      reason: `Composite: ${reasons.join(', ')}`,
    };
  }
}

/**
 * SpreadBasedSlippage - Half spread + additional impact
 * Models crossing the bid-ask spread
 */
export class SpreadBasedSlippage implements SlippageModel {
  readonly name = 'SpreadBasedSlippage';
  private defaultSpreadBps: number;
  private additionalImpactBps: number;

  /**
   * Create spread-based slippage model
   * @param defaultSpreadBps - Default bid-ask spread in bps
   * @param additionalImpactBps - Additional market impact in bps
   */
  constructor(defaultSpreadBps: number = 10, additionalImpactBps: number = 2) {
    this.defaultSpreadBps = defaultSpreadBps;
    this.additionalImpactBps = additionalImpactBps;
  }

  calculate(order: OrderTicket, basePrice: number, context: SlippageContext): SlippageResult {
    const spreadFromBar = context.bar.high > 0 && context.bar.low > 0
      ? ((context.bar.high - context.bar.low) / context.bar.close) * 10000 * 0.5
      : this.defaultSpreadBps;

    const estimatedSpreadBps = Math.min(spreadFromBar, this.defaultSpreadBps * 3);
    const halfSpreadBps = estimatedSpreadBps / 2;
    const totalSlippageBps = halfSpreadBps + this.additionalImpactBps;

    const slippageRate = totalSlippageBps / 10000;
    const slippageAmount = basePrice * slippageRate;

    const adjustedPrice = order.side === 'buy'
      ? basePrice + slippageAmount
      : basePrice - slippageAmount;

    return {
      orderId: order.id,
      originalPrice: basePrice,
      adjustedPrice,
      slippageAmount,
      slippageBps: totalSlippageBps,
      reason: `Half spread (${halfSpreadBps.toFixed(1)} bps) + impact (${this.additionalImpactBps} bps)`,
    };
  }
}

/**
 * Create zero slippage model (for testing)
 */
export function createZeroSlippage(): SlippageModel {
  return new ZeroSlippage();
}

/**
 * Create fixed slippage model
 */
export function createFixedSlippage(bps: number = 10): SlippageModel {
  return new FixedSlippage(bps);
}

/**
 * Create volume-based slippage model
 */
export function createVolumeSlippage(baseBps: number = 5): SlippageModel {
  return new VolumeSlippage(baseBps);
}

/**
 * Create volatility-based slippage model
 */
export function createVolatilitySlippage(baseBps: number = 5): SlippageModel {
  return new VolatilitySlippage(baseBps);
}

/**
 * Create realistic slippage model (composite of volume and volatility)
 */
export function createRealisticSlippage(): SlippageModel {
  return new CompositeSlippage(
    [
      new SpreadBasedSlippage(10, 2),
      new VolumeSlippage(3, 0.5, 50),
    ],
    [0.6, 0.4]
  );
}
