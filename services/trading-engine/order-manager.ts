/**
 * AI Active Trader - Order Manager
 * Manages order lifecycle and order book for trading engine
 */

import { EventBusClient } from '../shared/events';
import { createLogger } from '../shared/common';
import {
  Order,
  OrderRequest,
  OrderResult,
  OrderStatus,
  OrderSide,
  TimeInForce,
} from './types';

const logger = createLogger('order-manager', 'info');

function generateOrderId(): string {
  return `ord_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export class OrderManager {
  private orders: Map<string, Order> = new Map();
  private eventBus: EventBusClient | null = null;

  setEventBus(eventBus: EventBusClient): void {
    this.eventBus = eventBus;
  }

  async submitOrder(request: OrderRequest): Promise<OrderResult> {
    const orderId = generateOrderId();
    const now = new Date().toISOString();

    const order: Order = {
      orderId,
      symbol: request.symbol.toUpperCase(),
      side: request.side,
      quantity: request.quantity,
      orderType: request.orderType,
      limitPrice: request.limitPrice,
      stopLoss: request.stopLoss,
      takeProfit: request.takeProfit,
      timeInForce: request.timeInForce || 'day',
      status: OrderStatus.PENDING,
      filledQuantity: 0,
      decisionId: request.decisionId,
      createdAt: now,
      updatedAt: now,
    };

    this.orders.set(orderId, order);
    logger.info('Order created', { orderId, symbol: order.symbol, side: order.side });

    try {
      order.status = OrderStatus.SUBMITTED;
      order.updatedAt = new Date().toISOString();

      if (this.eventBus) {
        await this.eventBus.publish('trade.order.submitted', {
          orderId,
          symbol: order.symbol,
          side: order.side,
          type: order.orderType === 'market' ? 'market' : 'limit',
          quantity: order.quantity,
          limitPrice: order.limitPrice,
          timeInForce: order.timeInForce as TimeInForce,
          decisionId: order.decisionId,
        });
      }

      const fillResult = await this.simulateFill(order);

      if (fillResult.filled) {
        order.status = OrderStatus.FILLED;
        order.filledQuantity = order.quantity;
        order.filledPrice = fillResult.price;
        order.updatedAt = new Date().toISOString();

        if (this.eventBus) {
          await this.eventBus.publish('trade.order.filled', {
            orderId,
            symbol: order.symbol,
            side: order.side,
            quantity: order.quantity,
            filledQuantity: order.filledQuantity,
            averagePrice: order.filledPrice!,
            commission: 0,
            filledAt: order.updatedAt,
          });
        }

        logger.info('Order filled', { orderId, price: order.filledPrice });

        return {
          success: true,
          orderId,
          filledQuantity: order.filledQuantity,
          filledPrice: order.filledPrice,
          status: order.status,
        };
      }

      return {
        success: true,
        orderId,
        status: order.status,
      };

    } catch (error) {
      order.status = OrderStatus.FAILED;
      order.updatedAt = new Date().toISOString();

      logger.error('Order submission failed: ' + orderId, error instanceof Error ? error : undefined);

      return {
        success: false,
        orderId,
        error: (error as Error).message,
        status: OrderStatus.FAILED,
      };
    }
  }

  async cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    const order = this.orders.get(orderId);

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.status === OrderStatus.FILLED || order.status === OrderStatus.CANCELED) {
      return { success: false, error: `Cannot cancel order in ${order.status} status` };
    }

    order.status = OrderStatus.CANCELED;
    order.updatedAt = new Date().toISOString();

    if (this.eventBus) {
      await this.eventBus.publish('trade.order.canceled', {
        orderId,
        symbol: order.symbol,
        reason: 'User requested cancellation',
        canceledAt: order.updatedAt,
      });
    }

    logger.info('Order canceled', { orderId });

    return { success: true };
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  getActiveOrders(): Order[] {
    return Array.from(this.orders.values()).filter(
      (order) =>
        order.status === OrderStatus.PENDING ||
        order.status === OrderStatus.SUBMITTED ||
        order.status === OrderStatus.PARTIALLY_FILLED
    );
  }

  getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  private async simulateFill(order: Order): Promise<{ filled: boolean; price?: number }> {
    if (order.orderType === 'market') {
      const simulatedPrice = order.limitPrice || this.getSimulatedMarketPrice(order.symbol);
      return { filled: true, price: simulatedPrice };
    }

    if (order.orderType === 'limit' && order.limitPrice) {
      const marketPrice = this.getSimulatedMarketPrice(order.symbol);
      const shouldFill =
        (order.side === 'buy' && marketPrice <= order.limitPrice) ||
        (order.side === 'sell' && marketPrice >= order.limitPrice);

      if (shouldFill) {
        return { filled: true, price: order.limitPrice };
      }
    }

    return { filled: false };
  }

  private getSimulatedMarketPrice(symbol: string): number {
    const basePrices: Record<string, number> = {
      AAPL: 185.0,
      GOOGL: 140.0,
      MSFT: 375.0,
      AMZN: 155.0,
      TSLA: 250.0,
      SPY: 475.0,
      QQQ: 400.0,
      BTC: 45000.0,
      ETH: 2500.0,
    };

    const basePrice = basePrices[symbol.toUpperCase()] || 100.0;
    const variance = (Math.random() - 0.5) * 0.02;
    return basePrice * (1 + variance);
  }
}
