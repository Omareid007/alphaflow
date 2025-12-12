/**
 * AI Active Trader - Order Fill Models
 * Simulates order execution for backtesting
 */

import { createLogger } from '../common';
import type { OrderTicket } from '../algorithm-framework/types';
import type { OHLCVBar } from './data-feed';

const logger = createLogger('backtesting-fill-model');

/**
 * Fill result from simulated order execution
 */
export interface FillResult {
  orderId: string;
  symbol: string;
  filledQuantity: number;
  averagePrice: number;
  commission: number;
  slippage: number;
  remainingQuantity: number;
  status: 'filled' | 'partial' | 'rejected';
  reason?: string;
  timestamp: Date;
}

/**
 * Market context for fill simulation
 */
export interface FillContext {
  bar: OHLCVBar;
  previousBar?: OHLCVBar;
  averageDailyVolume?: number;
  bidAskSpread?: number;
  volatility?: number;
}

/**
 * FillModel interface for order fill simulation
 */
export interface FillModel {
  /** Name of the fill model */
  readonly name: string;
  
  /**
   * Simulate order fill
   * @param order - The order to fill
   * @param context - Market context for the fill
   * @returns Fill result
   */
  fill(order: OrderTicket, context: FillContext): FillResult;
}

/**
 * ImmediateFillModel - Fills orders immediately at current price
 * Best for liquid markets or approximations
 */
export class ImmediateFillModel implements FillModel {
  readonly name = 'ImmediateFill';
  private useOpenPrice: boolean;

  /**
   * Create immediate fill model
   * @param useOpenPrice - Use bar open price instead of close
   */
  constructor(useOpenPrice: boolean = false) {
    this.useOpenPrice = useOpenPrice;
  }

  fill(order: OrderTicket, context: FillContext): FillResult {
    const price = this.getFillPrice(order, context);
    
    if (order.type === 'limit') {
      if (order.side === 'buy' && price > (order.limitPrice || Infinity)) {
        return this.rejectOrder(order, context, 'Limit price not reached');
      }
      if (order.side === 'sell' && price < (order.limitPrice || 0)) {
        return this.rejectOrder(order, context, 'Limit price not reached');
      }
    }

    if (order.type === 'stop' || order.type === 'stop_limit') {
      if (order.side === 'buy' && context.bar.high < (order.stopPrice || Infinity)) {
        return this.rejectOrder(order, context, 'Stop price not triggered');
      }
      if (order.side === 'sell' && context.bar.low > (order.stopPrice || 0)) {
        return this.rejectOrder(order, context, 'Stop price not triggered');
      }
    }

    return {
      orderId: order.id,
      symbol: order.symbol,
      filledQuantity: order.quantity,
      averagePrice: price,
      commission: 0,
      slippage: 0,
      remainingQuantity: 0,
      status: 'filled',
      timestamp: context.bar.timestamp,
    };
  }

  private getFillPrice(order: OrderTicket, context: FillContext): number {
    if (order.type === 'limit') {
      return order.limitPrice || context.bar.close;
    }
    
    if (order.type === 'stop' || order.type === 'stop_limit') {
      return order.stopPrice || context.bar.close;
    }

    return this.useOpenPrice ? context.bar.open : context.bar.close;
  }

  private rejectOrder(order: OrderTicket, context: FillContext, reason: string): FillResult {
    return {
      orderId: order.id,
      symbol: order.symbol,
      filledQuantity: 0,
      averagePrice: 0,
      commission: 0,
      slippage: 0,
      remainingQuantity: order.quantity,
      status: 'rejected',
      reason,
      timestamp: context.bar.timestamp,
    };
  }
}

/**
 * RealisticFillModel - Considers volume and spread for fills
 * Models market microstructure more accurately
 */
export class RealisticFillModel implements FillModel {
  readonly name = 'RealisticFill';
  private defaultSpreadBps: number;
  private volumeImpactFactor: number;

  /**
   * Create realistic fill model
   * @param defaultSpreadBps - Default bid-ask spread in basis points
   * @param volumeImpactFactor - Market impact factor (0.1 = 10% of spread per 1% of volume)
   */
  constructor(defaultSpreadBps: number = 10, volumeImpactFactor: number = 0.1) {
    this.defaultSpreadBps = defaultSpreadBps;
    this.volumeImpactFactor = volumeImpactFactor;
  }

  fill(order: OrderTicket, context: FillContext): FillResult {
    const spread = context.bidAskSpread || (context.bar.close * this.defaultSpreadBps / 10000);
    const halfSpread = spread / 2;

    let basePrice: number;
    if (order.side === 'buy') {
      basePrice = context.bar.close + halfSpread;
    } else {
      basePrice = context.bar.close - halfSpread;
    }

    const volumeRatio = order.quantity / (context.bar.volume || 1);
    const volumeImpact = volumeRatio * this.volumeImpactFactor * spread;
    
    const slippage = order.side === 'buy' ? volumeImpact : -volumeImpact;
    const fillPrice = basePrice + slippage;

    if (order.type === 'limit') {
      if (order.side === 'buy' && fillPrice > (order.limitPrice || Infinity)) {
        return this.rejectOrder(order, context, 'Limit price exceeded after spread/impact');
      }
      if (order.side === 'sell' && fillPrice < (order.limitPrice || 0)) {
        return this.rejectOrder(order, context, 'Limit price not reached after spread/impact');
      }
    }

    if (order.type === 'stop' || order.type === 'stop_limit') {
      const triggered = order.side === 'buy' 
        ? context.bar.high >= (order.stopPrice || 0)
        : context.bar.low <= (order.stopPrice || Infinity);
      
      if (!triggered) {
        return this.rejectOrder(order, context, 'Stop price not triggered');
      }
    }

    return {
      orderId: order.id,
      symbol: order.symbol,
      filledQuantity: order.quantity,
      averagePrice: fillPrice,
      commission: 0,
      slippage: Math.abs(slippage),
      remainingQuantity: 0,
      status: 'filled',
      timestamp: context.bar.timestamp,
    };
  }

  private rejectOrder(order: OrderTicket, context: FillContext, reason: string): FillResult {
    return {
      orderId: order.id,
      symbol: order.symbol,
      filledQuantity: 0,
      averagePrice: 0,
      commission: 0,
      slippage: 0,
      remainingQuantity: order.quantity,
      status: 'rejected',
      reason,
      timestamp: context.bar.timestamp,
    };
  }
}

/**
 * VolumeParticipationFillModel - Limits fills to percentage of bar volume
 * Models realistic execution constraints for large orders
 */
export class VolumeParticipationFillModel implements FillModel {
  readonly name = 'VolumeParticipationFill';
  private maxParticipation: number;
  private defaultSpreadBps: number;
  private priceImpactExponent: number;

  /**
   * Create volume participation fill model
   * @param maxParticipation - Maximum percentage of bar volume (0.1 = 10%)
   * @param defaultSpreadBps - Default bid-ask spread in basis points
   * @param priceImpactExponent - Non-linear impact exponent (1 = linear, 2 = quadratic)
   */
  constructor(
    maxParticipation: number = 0.1,
    defaultSpreadBps: number = 10,
    priceImpactExponent: number = 1.5
  ) {
    this.maxParticipation = maxParticipation;
    this.defaultSpreadBps = defaultSpreadBps;
    this.priceImpactExponent = priceImpactExponent;
  }

  fill(order: OrderTicket, context: FillContext): FillResult {
    const maxFillQty = Math.floor(context.bar.volume * this.maxParticipation);
    
    if (maxFillQty === 0) {
      return {
        orderId: order.id,
        symbol: order.symbol,
        filledQuantity: 0,
        averagePrice: 0,
        commission: 0,
        slippage: 0,
        remainingQuantity: order.quantity,
        status: 'rejected',
        reason: 'Insufficient volume for execution',
        timestamp: context.bar.timestamp,
      };
    }

    const filledQty = Math.min(order.quantity, maxFillQty);
    const remainingQty = order.quantity - filledQty;

    const participationRate = filledQty / context.bar.volume;
    const spread = context.bidAskSpread || (context.bar.close * this.defaultSpreadBps / 10000);
    const impactMultiplier = Math.pow(participationRate / this.maxParticipation, this.priceImpactExponent);
    const priceImpact = spread * impactMultiplier;

    let fillPrice: number;
    if (order.side === 'buy') {
      fillPrice = context.bar.close + (spread / 2) + priceImpact;
    } else {
      fillPrice = context.bar.close - (spread / 2) - priceImpact;
    }

    if (order.type === 'limit') {
      if (order.side === 'buy' && fillPrice > (order.limitPrice || Infinity)) {
        const limitFilledQty = this.calculateLimitFill(order, context, spread);
        if (limitFilledQty === 0) {
          return this.rejectOrder(order, context, 'Limit price exceeded');
        }
        return {
          orderId: order.id,
          symbol: order.symbol,
          filledQuantity: limitFilledQty,
          averagePrice: order.limitPrice || fillPrice,
          commission: 0,
          slippage: 0,
          remainingQuantity: order.quantity - limitFilledQty,
          status: limitFilledQty < order.quantity ? 'partial' : 'filled',
          timestamp: context.bar.timestamp,
        };
      }
    }

    if (order.type === 'stop' || order.type === 'stop_limit') {
      const triggered = order.side === 'buy'
        ? context.bar.high >= (order.stopPrice || 0)
        : context.bar.low <= (order.stopPrice || Infinity);

      if (!triggered) {
        return this.rejectOrder(order, context, 'Stop price not triggered');
      }
    }

    return {
      orderId: order.id,
      symbol: order.symbol,
      filledQuantity: filledQty,
      averagePrice: fillPrice,
      commission: 0,
      slippage: priceImpact,
      remainingQuantity: remainingQty,
      status: remainingQty > 0 ? 'partial' : 'filled',
      timestamp: context.bar.timestamp,
    };
  }

  private calculateLimitFill(order: OrderTicket, context: FillContext, spread: number): number {
    const limitPrice = order.limitPrice || 0;
    const availableSlippage = order.side === 'buy' 
      ? limitPrice - context.bar.close
      : context.bar.close - limitPrice;

    if (availableSlippage < spread / 2) {
      return 0;
    }

    const maxImpact = availableSlippage - spread / 2;
    const maxParticipationRate = Math.pow(
      maxImpact / spread,
      1 / this.priceImpactExponent
    ) * this.maxParticipation;

    return Math.min(
      order.quantity,
      Math.floor(context.bar.volume * maxParticipationRate)
    );
  }

  private rejectOrder(order: OrderTicket, context: FillContext, reason: string): FillResult {
    return {
      orderId: order.id,
      symbol: order.symbol,
      filledQuantity: 0,
      averagePrice: 0,
      commission: 0,
      slippage: 0,
      remainingQuantity: order.quantity,
      status: 'rejected',
      reason,
      timestamp: context.bar.timestamp,
    };
  }
}

/**
 * Create the default fill model
 */
export function createDefaultFillModel(): FillModel {
  return new RealisticFillModel();
}

/**
 * Create an immediate fill model (for testing or liquid markets)
 */
export function createImmediateFillModel(useOpenPrice: boolean = false): FillModel {
  return new ImmediateFillModel(useOpenPrice);
}

/**
 * Create a volume-constrained fill model (for realistic large order execution)
 */
export function createVolumeParticipationFillModel(
  maxParticipation: number = 0.1
): FillModel {
  return new VolumeParticipationFillModel(maxParticipation);
}
