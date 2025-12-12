/**
 * AI Active Trader - Commission Models
 * Fee structure simulation for backtesting
 */

import { createLogger } from '../common';
import type { OrderTicket } from '../algorithm-framework/types';

const logger = createLogger('backtesting-commission-model');

/**
 * Commission calculation result
 */
export interface CommissionResult {
  orderId: string;
  commission: number;
  fees: {
    base: number;
    exchange?: number;
    regulatory?: number;
    clearing?: number;
  };
  breakdown: string;
}

/**
 * CommissionModel interface for fee structures
 */
export interface CommissionModel {
  /** Name of the commission model */
  readonly name: string;
  
  /**
   * Calculate commission for an order
   * @param order - The order to calculate commission for
   * @param fillPrice - The fill price
   * @param fillQuantity - The filled quantity
   * @returns Commission result
   */
  calculate(order: OrderTicket, fillPrice: number, fillQuantity: number): CommissionResult;
}

/**
 * FlatCommission - Fixed per-trade fee
 * Common for many retail brokers
 */
export class FlatCommission implements CommissionModel {
  readonly name = 'FlatCommission';
  private perTradeAmount: number;
  private minimumAmount: number;

  /**
   * Create flat commission model
   * @param perTradeAmount - Fixed fee per trade
   * @param minimumAmount - Minimum commission (defaults to perTradeAmount)
   */
  constructor(perTradeAmount: number = 0, minimumAmount?: number) {
    this.perTradeAmount = perTradeAmount;
    this.minimumAmount = minimumAmount ?? perTradeAmount;
  }

  calculate(order: OrderTicket, fillPrice: number, fillQuantity: number): CommissionResult {
    const commission = Math.max(this.perTradeAmount, this.minimumAmount);

    return {
      orderId: order.id,
      commission,
      fees: {
        base: commission,
      },
      breakdown: `Flat fee: $${commission.toFixed(2)}`,
    };
  }
}

/**
 * PercentageCommission - Percentage of trade value
 * Common for crypto exchanges and international brokers
 */
export class PercentageCommission implements CommissionModel {
  readonly name = 'PercentageCommission';
  private percentageRate: number;
  private minimumAmount: number;
  private maximumAmount: number;

  /**
   * Create percentage commission model
   * @param percentageRate - Commission rate (0.001 = 0.1%)
   * @param minimumAmount - Minimum commission per trade
   * @param maximumAmount - Maximum commission per trade
   */
  constructor(
    percentageRate: number = 0.001,
    minimumAmount: number = 0,
    maximumAmount: number = Infinity
  ) {
    this.percentageRate = percentageRate;
    this.minimumAmount = minimumAmount;
    this.maximumAmount = maximumAmount;
  }

  calculate(order: OrderTicket, fillPrice: number, fillQuantity: number): CommissionResult {
    const tradeValue = fillPrice * fillQuantity;
    let commission = tradeValue * this.percentageRate;
    commission = Math.max(commission, this.minimumAmount);
    commission = Math.min(commission, this.maximumAmount);

    return {
      orderId: order.id,
      commission,
      fees: {
        base: commission,
      },
      breakdown: `${(this.percentageRate * 100).toFixed(3)}% of $${tradeValue.toFixed(2)} = $${commission.toFixed(2)}`,
    };
  }
}

/**
 * PerShareCommission - Per-share fee structure
 * Common for some US brokers
 */
export class PerShareCommission implements CommissionModel {
  readonly name = 'PerShareCommission';
  private perShareRate: number;
  private minimumAmount: number;
  private maximumPercent: number;

  /**
   * Create per-share commission model
   * @param perShareRate - Fee per share
   * @param minimumAmount - Minimum commission per trade
   * @param maximumPercent - Maximum as percentage of trade value
   */
  constructor(
    perShareRate: number = 0.005,
    minimumAmount: number = 1.0,
    maximumPercent: number = 0.01
  ) {
    this.perShareRate = perShareRate;
    this.minimumAmount = minimumAmount;
    this.maximumPercent = maximumPercent;
  }

  calculate(order: OrderTicket, fillPrice: number, fillQuantity: number): CommissionResult {
    const tradeValue = fillPrice * fillQuantity;
    let commission = fillQuantity * this.perShareRate;
    commission = Math.max(commission, this.minimumAmount);
    commission = Math.min(commission, tradeValue * this.maximumPercent);

    return {
      orderId: order.id,
      commission,
      fees: {
        base: commission,
      },
      breakdown: `$${this.perShareRate}/share x ${fillQuantity} shares = $${commission.toFixed(2)}`,
    };
  }
}

/**
 * TieredCommission - Volume-based tier pricing
 * Common for active traders and institutional accounts
 */
export interface CommissionTier {
  minVolume: number;
  maxVolume: number;
  rate: number;
  type: 'percentage' | 'per_share' | 'flat';
}

export class TieredCommission implements CommissionModel {
  readonly name = 'TieredCommission';
  private tiers: CommissionTier[];
  private monthlyVolume: number;
  private minimumAmount: number;

  /**
   * Create tiered commission model
   * @param tiers - Array of commission tiers
   * @param minimumAmount - Minimum commission per trade
   */
  constructor(tiers: CommissionTier[], minimumAmount: number = 0) {
    this.tiers = tiers.sort((a, b) => a.minVolume - b.minVolume);
    this.monthlyVolume = 0;
    this.minimumAmount = minimumAmount;
  }

  calculate(order: OrderTicket, fillPrice: number, fillQuantity: number): CommissionResult {
    const tradeValue = fillPrice * fillQuantity;
    const tier = this.getCurrentTier();

    let commission: number;
    switch (tier.type) {
      case 'percentage':
        commission = tradeValue * tier.rate;
        break;
      case 'per_share':
        commission = fillQuantity * tier.rate;
        break;
      case 'flat':
        commission = tier.rate;
        break;
      default:
        commission = 0;
    }

    commission = Math.max(commission, this.minimumAmount);
    this.monthlyVolume += tradeValue;

    return {
      orderId: order.id,
      commission,
      fees: {
        base: commission,
      },
      breakdown: `Tier ${this.tiers.indexOf(tier) + 1}: ${tier.type} rate ${tier.rate} = $${commission.toFixed(2)}`,
    };
  }

  private getCurrentTier(): CommissionTier {
    for (const tier of this.tiers) {
      if (this.monthlyVolume >= tier.minVolume && this.monthlyVolume < tier.maxVolume) {
        return tier;
      }
    }
    return this.tiers[this.tiers.length - 1];
  }

  /**
   * Reset monthly volume counter
   */
  resetMonthlyVolume(): void {
    this.monthlyVolume = 0;
  }

  /**
   * Get current monthly volume
   */
  getMonthlyVolume(): number {
    return this.monthlyVolume;
  }
}

/**
 * AlpacaCommission - Zero commission for US equities
 * Models Alpaca's commission-free trading
 */
export class AlpacaCommission implements CommissionModel {
  readonly name = 'AlpacaCommission';
  private secFee: number;
  private tafFee: number;
  private finraFee: number;

  /**
   * Create Alpaca commission model
   * Includes regulatory fees (SEC, TAF, FINRA)
   */
  constructor() {
    this.secFee = 0.0000278;
    this.tafFee = 0.000166;
    this.finraFee = 0.000119;
  }

  calculate(order: OrderTicket, fillPrice: number, fillQuantity: number): CommissionResult {
    const tradeValue = fillPrice * fillQuantity;

    let secAmount = 0;
    let tafAmount = 0;
    let finraAmount = 0;

    if (order.side === 'sell') {
      secAmount = Math.max(tradeValue * this.secFee, 0.01);
      
      tafAmount = Math.min(fillQuantity * this.tafFee, 8.30);
      tafAmount = Math.max(tafAmount, 0.01);
    }

    if (order.side === 'sell') {
      finraAmount = Math.min(fillQuantity * this.finraFee, 7.27);
      finraAmount = Math.max(finraAmount, 0.01);
    }

    const totalFees = secAmount + tafAmount + finraAmount;

    return {
      orderId: order.id,
      commission: totalFees,
      fees: {
        base: 0,
        regulatory: secAmount,
        exchange: tafAmount,
        clearing: finraAmount,
      },
      breakdown: order.side === 'sell'
        ? `SEC: $${secAmount.toFixed(4)}, TAF: $${tafAmount.toFixed(4)}, FINRA: $${finraAmount.toFixed(4)}`
        : 'No commission (buy order)',
    };
  }
}

/**
 * CryptoExchangeCommission - Typical crypto exchange fee structure
 * Models maker/taker fee structures
 */
export class CryptoExchangeCommission implements CommissionModel {
  readonly name = 'CryptoExchangeCommission';
  private makerFee: number;
  private takerFee: number;

  /**
   * Create crypto exchange commission model
   * @param makerFee - Maker fee rate (default 0.001 = 0.1%)
   * @param takerFee - Taker fee rate (default 0.002 = 0.2%)
   */
  constructor(makerFee: number = 0.001, takerFee: number = 0.002) {
    this.makerFee = makerFee;
    this.takerFee = takerFee;
  }

  calculate(order: OrderTicket, fillPrice: number, fillQuantity: number): CommissionResult {
    const tradeValue = fillPrice * fillQuantity;
    const isMaker = order.type === 'limit';
    const rate = isMaker ? this.makerFee : this.takerFee;
    const commission = tradeValue * rate;

    return {
      orderId: order.id,
      commission,
      fees: {
        base: commission,
        exchange: 0,
      },
      breakdown: `${isMaker ? 'Maker' : 'Taker'} fee: ${(rate * 100).toFixed(2)}% of $${tradeValue.toFixed(2)} = $${commission.toFixed(2)}`,
    };
  }
}

/**
 * Create zero commission model (for testing)
 */
export function createZeroCommission(): CommissionModel {
  return new FlatCommission(0);
}

/**
 * Create Alpaca-style commission (US equities)
 */
export function createAlpacaCommission(): CommissionModel {
  return new AlpacaCommission();
}

/**
 * Create typical Interactive Brokers tiered commission
 */
export function createIBKRTieredCommission(): CommissionModel {
  return new TieredCommission([
    { minVolume: 0, maxVolume: 300000, rate: 0.0035, type: 'per_share' },
    { minVolume: 300000, maxVolume: 3000000, rate: 0.002, type: 'per_share' },
    { minVolume: 3000000, maxVolume: 20000000, rate: 0.0015, type: 'per_share' },
    { minVolume: 20000000, maxVolume: Infinity, rate: 0.001, type: 'per_share' },
  ], 0.35);
}

/**
 * Create typical crypto exchange commission
 */
export function createCryptoCommission(
  makerFee: number = 0.001,
  takerFee: number = 0.002
): CommissionModel {
  return new CryptoExchangeCommission(makerFee, takerFee);
}
