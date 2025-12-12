/**
 * AI Active Trader - Position Manager
 * Manages open positions and P&L tracking for trading engine
 */

import { EventBusClient } from '../shared/events';
import { createLogger } from '../shared/common';
import { Position, PositionSide } from './types';

const logger = createLogger('position-manager', 'info');

function generatePositionId(): string {
  return `pos_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export class PositionManager {
  private positions: Map<string, Position> = new Map();
  private eventBus: EventBusClient | null = null;

  setEventBus(eventBus: EventBusClient): void {
    this.eventBus = eventBus;
  }

  async openPosition(
    symbol: string,
    side: PositionSide,
    quantity: number,
    price: number
  ): Promise<Position> {
    const existingPosition = this.findPositionBySymbol(symbol, side);

    if (existingPosition) {
      const totalQuantity = existingPosition.quantity + quantity;
      const avgPrice =
        (existingPosition.entryPrice * existingPosition.quantity + price * quantity) /
        totalQuantity;

      existingPosition.quantity = totalQuantity;
      existingPosition.entryPrice = avgPrice;
      existingPosition.updatedAt = new Date().toISOString();

      logger.info('Position averaged', {
        positionId: existingPosition.positionId,
        symbol,
        newQuantity: totalQuantity,
        avgPrice,
      });

      return existingPosition;
    }

    const positionId = generatePositionId();
    const now = new Date().toISOString();

    const position: Position = {
      positionId,
      symbol: symbol.toUpperCase(),
      side,
      quantity,
      entryPrice: price,
      currentPrice: price,
      unrealizedPnl: 0,
      openedAt: now,
      updatedAt: now,
    };

    this.positions.set(positionId, position);

    if (this.eventBus) {
      await this.eventBus.publish('trade.position.opened', {
        positionId,
        symbol: position.symbol,
        side: side === 'long' ? 'buy' : 'sell',
        quantity,
        entryPrice: price,
        openedAt: now,
      });
    }

    logger.info('Position opened', { positionId, symbol, side, quantity, price });

    return position;
  }

  async closePosition(
    positionId: string,
    exitPrice?: number
  ): Promise<{ success: boolean; realizedPnl?: number; error?: string }> {
    const position = this.positions.get(positionId);

    if (!position) {
      return { success: false, error: 'Position not found' };
    }

    const closePrice = exitPrice || position.currentPrice || position.entryPrice;
    const pnlMultiplier = position.side === 'long' ? 1 : -1;
    const realizedPnl = (closePrice - position.entryPrice) * position.quantity * pnlMultiplier;

    const closedAt = new Date().toISOString();

    if (this.eventBus) {
      await this.eventBus.publish('trade.position.closed', {
        positionId,
        symbol: position.symbol,
        side: position.side === 'long' ? 'buy' : 'sell',
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        exitPrice: closePrice,
        realizedPnl,
        closedAt,
      });
    }

    this.positions.delete(positionId);

    logger.info('Position closed', { positionId, realizedPnl });

    return { success: true, realizedPnl };
  }

  async partialClosePosition(
    positionId: string,
    quantityToClose: number,
    exitPrice?: number
  ): Promise<{ success: boolean; realizedPnl?: number; remainingQuantity?: number; error?: string }> {
    const position = this.positions.get(positionId);

    if (!position) {
      return { success: false, error: 'Position not found' };
    }

    if (quantityToClose >= position.quantity) {
      return this.closePosition(positionId, exitPrice);
    }

    const closePrice = exitPrice || position.currentPrice || position.entryPrice;
    const pnlMultiplier = position.side === 'long' ? 1 : -1;
    const realizedPnl = (closePrice - position.entryPrice) * quantityToClose * pnlMultiplier;

    position.quantity -= quantityToClose;
    position.updatedAt = new Date().toISOString();

    logger.info('Position partially closed', {
      positionId,
      closedQuantity: quantityToClose,
      remainingQuantity: position.quantity,
      realizedPnl,
    });

    return { success: true, realizedPnl, remainingQuantity: position.quantity };
  }

  updatePrice(positionId: string, currentPrice: number): void {
    const position = this.positions.get(positionId);

    if (!position) {
      return;
    }

    position.currentPrice = currentPrice;
    const pnlMultiplier = position.side === 'long' ? 1 : -1;
    position.unrealizedPnl =
      (currentPrice - position.entryPrice) * position.quantity * pnlMultiplier;
    position.updatedAt = new Date().toISOString();
  }

  updatePriceBySymbol(symbol: string, currentPrice: number): void {
    const upperSymbol = symbol.toUpperCase();
    for (const position of this.positions.values()) {
      if (position.symbol === upperSymbol) {
        this.updatePrice(position.positionId, currentPrice);
      }
    }
  }

  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getPositionsBySymbol(symbol: string): Position[] {
    const upperSymbol = symbol.toUpperCase();
    return Array.from(this.positions.values()).filter((p) => p.symbol === upperSymbol);
  }

  getTotalUnrealizedPnl(): number {
    return Array.from(this.positions.values()).reduce(
      (sum, p) => sum + (p.unrealizedPnl || 0),
      0
    );
  }

  getTotalExposure(): number {
    return Array.from(this.positions.values()).reduce(
      (sum, p) => sum + p.quantity * (p.currentPrice || p.entryPrice),
      0
    );
  }

  getPositionCount(): number {
    return this.positions.size;
  }

  private findPositionBySymbol(symbol: string, side: PositionSide): Position | undefined {
    const upperSymbol = symbol.toUpperCase();
    return Array.from(this.positions.values()).find(
      (p) => p.symbol === upperSymbol && p.side === side
    );
  }
}
