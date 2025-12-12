/**
 * AI Active Trader - Execution Module
 * Handles order generation and execution algorithms
 */

import { createLogger } from '../common';
import type { PortfolioTarget, OrderTicket, AlgorithmContext, ExecutionResult, Security } from './types';

const logger = createLogger('execution');

export interface ExecutionAlgorithm {
  name: string;
  type: 'immediate' | 'twap' | 'vwap' | 'iceberg' | 'smart' | 'custom';
  execute: (targets: PortfolioTarget[], context: AlgorithmContext) => Promise<OrderTicket[]>;
}

export interface ExecutionConfig {
  algorithm: ExecutionAlgorithm;
  maxSlippage: number;
  defaultTimeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  useLimitOrders: boolean;
  limitPriceBuffer: number;
  minOrderValue: number;
  maxOrderValue: number;
  splitLargeOrders: boolean;
  splitThreshold: number;
}

const generateOrderId = (): string => {
  return `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

const BUILT_IN_ALGORITHMS: Record<string, ExecutionAlgorithm> = {
  immediate: {
    name: 'immediate',
    type: 'immediate',
    execute: async (targets, context) => {
      const orders: OrderTicket[] = [];
      const { positions } = context.state.portfolio;

      for (const target of targets) {
        const security = context.state.securities.get(target.symbol);
        if (!security) continue;

        const currentPosition = positions.get(target.symbol);
        const currentQty = currentPosition?.quantity || 0;
        const currentSide = currentPosition?.side || 'long';

        let orderSide: 'buy' | 'sell';
        let orderQty: number;

        if (target.direction === 'flat') {
          if (currentQty === 0) continue;
          orderSide = currentSide === 'long' ? 'sell' : 'buy';
          orderQty = Math.abs(currentQty);
        } else if (target.direction === 'long') {
          if (currentSide === 'short' && currentQty > 0) {
            orders.push({
              id: generateOrderId(),
              symbol: target.symbol,
              type: 'market',
              side: 'buy',
              quantity: currentQty,
              timeInForce: 'day',
              status: 'pending',
              filledQuantity: 0,
              averagePrice: 0,
              submittedAt: context.currentTime,
              tag: 'close_short',
            });
          }
          
          const diff = target.quantity - (currentSide === 'long' ? currentQty : 0);
          if (diff <= 0) continue;
          
          orderSide = 'buy';
          orderQty = diff;
        } else {
          if (currentSide === 'long' && currentQty > 0) {
            orders.push({
              id: generateOrderId(),
              symbol: target.symbol,
              type: 'market',
              side: 'sell',
              quantity: currentQty,
              timeInForce: 'day',
              status: 'pending',
              filledQuantity: 0,
              averagePrice: 0,
              submittedAt: context.currentTime,
              tag: 'close_long',
            });
          }
          
          const diff = target.quantity - (currentSide === 'short' ? currentQty : 0);
          if (diff <= 0) continue;
          
          orderSide = 'sell';
          orderQty = diff;
        }

        if (orderQty > 0) {
          orders.push({
            id: generateOrderId(),
            symbol: target.symbol,
            type: 'market',
            side: orderSide,
            quantity: orderQty,
            timeInForce: 'day',
            status: 'pending',
            filledQuantity: 0,
            averagePrice: 0,
            submittedAt: context.currentTime,
            tag: target.direction,
          });
        }
      }

      return orders;
    },
  },

  limitImmediate: {
    name: 'limitImmediate',
    type: 'immediate',
    execute: async (targets, context) => {
      const orders: OrderTicket[] = [];
      const { positions } = context.state.portfolio;
      const buffer = 0.001;

      for (const target of targets) {
        const security = context.state.securities.get(target.symbol);
        if (!security) continue;

        const currentPosition = positions.get(target.symbol);
        const currentQty = currentPosition?.quantity || 0;
        const currentSide = currentPosition?.side || 'long';

        if (target.direction === 'flat') {
          if (currentQty === 0) continue;
          
          const side: 'buy' | 'sell' = currentSide === 'long' ? 'sell' : 'buy';
          const limitPrice = side === 'buy' 
            ? security.price * (1 + buffer)
            : security.price * (1 - buffer);

          orders.push({
            id: generateOrderId(),
            symbol: target.symbol,
            type: 'limit',
            side,
            quantity: Math.abs(currentQty),
            limitPrice,
            timeInForce: 'day',
            status: 'pending',
            filledQuantity: 0,
            averagePrice: 0,
            submittedAt: context.currentTime,
            tag: 'flatten',
          });
          continue;
        }

        const targetQty = target.quantity;
        const diff = targetQty - (target.direction === currentSide ? currentQty : -currentQty);
        
        if (Math.abs(diff) < 1) continue;

        const side: 'buy' | 'sell' = diff > 0 
          ? (target.direction === 'long' ? 'buy' : 'sell')
          : (target.direction === 'long' ? 'sell' : 'buy');
        
        const limitPrice = side === 'buy'
          ? security.price * (1 + buffer)
          : security.price * (1 - buffer);

        orders.push({
          id: generateOrderId(),
          symbol: target.symbol,
          type: 'limit',
          side,
          quantity: Math.abs(diff),
          limitPrice,
          timeInForce: 'day',
          status: 'pending',
          filledQuantity: 0,
          averagePrice: 0,
          submittedAt: context.currentTime,
          tag: target.direction,
        });
      }

      return orders;
    },
  },

  twap: {
    name: 'twap',
    type: 'twap',
    execute: async (targets, context) => {
      const orders: OrderTicket[] = [];
      const slices = (context.state.parameters.twapSlices as number) || 5;
      const intervalMs = (context.state.parameters.twapIntervalMs as number) || 60000;

      for (const target of targets) {
        const security = context.state.securities.get(target.symbol);
        if (!security) continue;

        if (target.direction === 'flat') continue;

        const sliceQty = Math.max(1, Math.floor(target.quantity / slices));
        const side: 'buy' | 'sell' = target.direction === 'long' ? 'buy' : 'sell';

        for (let i = 0; i < slices; i++) {
          const qty = i === slices - 1 
            ? target.quantity - (sliceQty * (slices - 1))
            : sliceQty;

          if (qty <= 0) continue;

          orders.push({
            id: generateOrderId(),
            symbol: target.symbol,
            type: 'market',
            side,
            quantity: qty,
            timeInForce: 'day',
            status: 'pending',
            filledQuantity: 0,
            averagePrice: 0,
            submittedAt: new Date(context.currentTime.getTime() + i * intervalMs),
            tag: `twap_slice_${i + 1}`,
          });
        }
      }

      return orders;
    },
  },

  vwap: {
    name: 'vwap',
    type: 'vwap',
    execute: async (targets, context) => {
      const orders: OrderTicket[] = [];
      const buckets = (context.state.parameters.vwapBuckets as number) || 6;
      
      const volumeProfile = [0.15, 0.2, 0.25, 0.2, 0.12, 0.08];

      for (const target of targets) {
        const security = context.state.securities.get(target.symbol);
        if (!security) continue;

        if (target.direction === 'flat') continue;

        const side: 'buy' | 'sell' = target.direction === 'long' ? 'buy' : 'sell';
        let remaining = target.quantity;

        for (let i = 0; i < buckets && remaining > 0; i++) {
          const bucketPct = volumeProfile[i] || (1 / buckets);
          const qty = Math.min(remaining, Math.ceil(target.quantity * bucketPct));
          remaining -= qty;

          if (qty <= 0) continue;

          orders.push({
            id: generateOrderId(),
            symbol: target.symbol,
            type: 'market',
            side,
            quantity: qty,
            timeInForce: 'day',
            status: 'pending',
            filledQuantity: 0,
            averagePrice: 0,
            submittedAt: context.currentTime,
            tag: `vwap_bucket_${i + 1}`,
          });
        }
      }

      return orders;
    },
  },

  iceberg: {
    name: 'iceberg',
    type: 'iceberg',
    execute: async (targets, context) => {
      const orders: OrderTicket[] = [];
      const showSize = (context.state.parameters.icebergShowSize as number) || 100;
      const buffer = 0.0005;

      for (const target of targets) {
        const security = context.state.securities.get(target.symbol);
        if (!security) continue;

        if (target.direction === 'flat') continue;

        const side: 'buy' | 'sell' = target.direction === 'long' ? 'buy' : 'sell';
        const limitPrice = side === 'buy'
          ? security.price * (1 + buffer)
          : security.price * (1 - buffer);

        const slices = Math.ceil(target.quantity / showSize);

        for (let i = 0; i < slices; i++) {
          const qty = Math.min(showSize, target.quantity - i * showSize);
          
          if (qty <= 0) continue;

          orders.push({
            id: generateOrderId(),
            symbol: target.symbol,
            type: 'limit',
            side,
            quantity: qty,
            limitPrice,
            timeInForce: 'day',
            status: 'pending',
            filledQuantity: 0,
            averagePrice: 0,
            submittedAt: context.currentTime,
            tag: `iceberg_slice_${i + 1}`,
          });
        }
      }

      return orders;
    },
  },

  smart: {
    name: 'smart',
    type: 'smart',
    execute: async (targets, context) => {
      const orders: OrderTicket[] = [];

      for (const target of targets) {
        const security = context.state.securities.get(target.symbol);
        if (!security) continue;

        const orderValue = target.quantity * security.price;
        const avgDailyVolume = security.volume;
        const participationRate = avgDailyVolume > 0 ? (target.quantity / avgDailyVolume) : 1;

        let algorithm: ExecutionAlgorithm;

        if (participationRate > 0.1) {
          algorithm = BUILT_IN_ALGORITHMS.twap;
        } else if (participationRate > 0.05) {
          algorithm = BUILT_IN_ALGORITHMS.vwap;
        } else if (orderValue > 100000) {
          algorithm = BUILT_IN_ALGORITHMS.iceberg;
        } else {
          algorithm = BUILT_IN_ALGORITHMS.limitImmediate;
        }

        const targetOrders = await algorithm.execute([target], context);
        orders.push(...targetOrders);

        logger.debug('Smart routing decision', {
          symbol: target.symbol,
          participationRate: participationRate.toFixed(4),
          algorithm: algorithm.name,
          orders: targetOrders.length,
        });
      }

      return orders;
    },
  },
};

export class ExecutionModule {
  private config: ExecutionConfig;
  private customAlgorithms: Map<string, ExecutionAlgorithm> = new Map();
  private pendingOrders: Map<string, OrderTicket> = new Map();
  private executedOrders: OrderTicket[] = [];

  constructor(config: Partial<ExecutionConfig> = {}) {
    this.config = {
      algorithm: config.algorithm || BUILT_IN_ALGORITHMS.smart,
      maxSlippage: config.maxSlippage || 0.005,
      defaultTimeInForce: config.defaultTimeInForce || 'day',
      useLimitOrders: config.useLimitOrders !== false,
      limitPriceBuffer: config.limitPriceBuffer || 0.001,
      minOrderValue: config.minOrderValue || 100,
      maxOrderValue: config.maxOrderValue || 100000,
      splitLargeOrders: config.splitLargeOrders !== false,
      splitThreshold: config.splitThreshold || 50000,
    };
    logger.info('Execution Module initialized', { algorithm: this.config.algorithm.name });
  }

  registerAlgorithm(algorithm: ExecutionAlgorithm): void {
    this.customAlgorithms.set(algorithm.name, algorithm);
    logger.info('Custom algorithm registered', { name: algorithm.name, type: algorithm.type });
  }

  getBuiltInAlgorithm(name: string): ExecutionAlgorithm | undefined {
    return BUILT_IN_ALGORITHMS[name];
  }

  async execute(targets: PortfolioTarget[], context: AlgorithmContext): Promise<ExecutionResult> {
    const filteredTargets = this.filterAndValidate(targets, context);

    if (filteredTargets.length === 0) {
      return { orders: [] };
    }

    const algorithm = this.customAlgorithms.get(this.config.algorithm.name) || this.config.algorithm;

    let orders = await algorithm.execute(filteredTargets, context);

    if (this.config.splitLargeOrders) {
      orders = this.splitOrders(orders, context);
    }

    orders = this.applyConstraints(orders, context);

    for (const order of orders) {
      this.pendingOrders.set(order.id, order);
    }

    logger.info('Execution complete', {
      targets: filteredTargets.length,
      orders: orders.length,
      totalValue: orders.reduce((sum, o) => {
        const security = context.state.securities.get(o.symbol);
        return sum + o.quantity * (security?.price || 0);
      }, 0),
    });

    return { orders };
  }

  private filterAndValidate(targets: PortfolioTarget[], context: AlgorithmContext): PortfolioTarget[] {
    return targets.filter(target => {
      const security = context.state.securities.get(target.symbol);
      if (!security) {
        logger.warn('Security not found', { symbol: target.symbol });
        return false;
      }

      const orderValue = target.quantity * security.price;
      if (orderValue < this.config.minOrderValue) {
        logger.debug('Order below minimum value', { symbol: target.symbol, value: orderValue });
        return false;
      }

      if (target.quantity <= 0) {
        return false;
      }

      return true;
    });
  }

  private splitOrders(orders: OrderTicket[], context: AlgorithmContext): OrderTicket[] {
    const result: OrderTicket[] = [];

    for (const order of orders) {
      const security = context.state.securities.get(order.symbol);
      if (!security) {
        result.push(order);
        continue;
      }

      const orderValue = order.quantity * security.price;

      if (orderValue <= this.config.splitThreshold) {
        result.push(order);
        continue;
      }

      const numSplits = Math.ceil(orderValue / this.config.splitThreshold);
      const splitQty = Math.floor(order.quantity / numSplits);

      for (let i = 0; i < numSplits; i++) {
        const qty = i === numSplits - 1
          ? order.quantity - splitQty * (numSplits - 1)
          : splitQty;

        if (qty > 0) {
          result.push({
            ...order,
            id: `${order.id}_split_${i + 1}`,
            quantity: qty,
            tag: `${order.tag || ''}_split_${i + 1}`,
          });
        }
      }
    }

    return result;
  }

  private applyConstraints(orders: OrderTicket[], context: AlgorithmContext): OrderTicket[] {
    return orders.map(order => {
      const security = context.state.securities.get(order.symbol);
      if (!security) return order;

      const orderValue = order.quantity * security.price;
      if (orderValue > this.config.maxOrderValue) {
        const maxQty = Math.floor(this.config.maxOrderValue / security.price);
        return { ...order, quantity: maxQty };
      }

      if (order.type === 'limit' && order.limitPrice) {
        const maxLimit = security.price * (1 + this.config.maxSlippage);
        const minLimit = security.price * (1 - this.config.maxSlippage);

        if (order.side === 'buy' && order.limitPrice > maxLimit) {
          return { ...order, limitPrice: maxLimit };
        }
        if (order.side === 'sell' && order.limitPrice < minLimit) {
          return { ...order, limitPrice: minLimit };
        }
      }

      return order;
    });
  }

  updateOrderStatus(orderId: string, status: OrderTicket['status'], filled?: Partial<OrderTicket>): void {
    const order = this.pendingOrders.get(orderId);
    if (!order) return;

    order.status = status;
    if (filled) {
      order.filledQuantity = filled.filledQuantity ?? order.filledQuantity;
      order.averagePrice = filled.averagePrice ?? order.averagePrice;
      order.filledAt = filled.filledAt;
    }

    if (status === 'filled' || status === 'cancelled' || status === 'rejected') {
      this.pendingOrders.delete(orderId);
      this.executedOrders.push(order);
    }

    logger.debug('Order status updated', { orderId, status });
  }

  getPendingOrders(): OrderTicket[] {
    return Array.from(this.pendingOrders.values());
  }

  getExecutedOrders(): OrderTicket[] {
    return [...this.executedOrders];
  }

  cancelAllPending(): string[] {
    const cancelled: string[] = [];
    for (const [id, order] of this.pendingOrders) {
      order.status = 'cancelled';
      this.executedOrders.push(order);
      cancelled.push(id);
    }
    this.pendingOrders.clear();
    return cancelled;
  }

  clearHistory(): void {
    this.executedOrders = [];
  }
}

export const createImmediateExecution = (): ExecutionModule => {
  return new ExecutionModule({
    algorithm: BUILT_IN_ALGORITHMS.immediate,
    useLimitOrders: false,
  });
};

export const createSmartExecution = (): ExecutionModule => {
  return new ExecutionModule({
    algorithm: BUILT_IN_ALGORITHMS.smart,
    splitLargeOrders: true,
    splitThreshold: 25000,
  });
};

export const createTWAPExecution = (): ExecutionModule => {
  return new ExecutionModule({
    algorithm: BUILT_IN_ALGORITHMS.twap,
    splitLargeOrders: false,
  });
};
