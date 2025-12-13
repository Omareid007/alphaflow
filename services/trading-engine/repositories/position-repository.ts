/**
 * AI Active Trader - Position Repository
 * Database repository implementation for positions using trading schema
 */

import { eq, desc, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Repository } from '../../shared/repositories';
import { positions, Position as DbPosition, InsertPosition } from '../../shared/database/trading-schema';

export interface PositionEntity {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  currentPrice?: number | null;
  unrealizedPnl?: number | null;
  unrealizedPnlPercent?: number | null;
  realizedPnl: number;
  totalFees: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  trailingStop?: number | null;
  strategyId?: string | null;
  userId?: string | null;
  broker: string;
  status: string;
  entryOrderId?: string | null;
  exitOrderId?: string | null;
  openedAt: Date;
  closedAt?: Date | null;
  lastUpdatedAt: Date;
}

function dbPositionToEntity(row: DbPosition): PositionEntity {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side,
    quantity: parseFloat(row.quantity),
    entryPrice: parseFloat(row.entryPrice),
    currentPrice: row.currentPrice ? parseFloat(row.currentPrice) : null,
    unrealizedPnl: row.unrealizedPnl ? parseFloat(row.unrealizedPnl) : null,
    unrealizedPnlPercent: row.unrealizedPnlPercent ? parseFloat(row.unrealizedPnlPercent) : null,
    realizedPnl: row.realizedPnl ? parseFloat(row.realizedPnl) : 0,
    totalFees: row.totalFees ? parseFloat(row.totalFees) : 0,
    stopLoss: row.stopLoss ? parseFloat(row.stopLoss) : null,
    takeProfit: row.takeProfit ? parseFloat(row.takeProfit) : null,
    trailingStop: row.trailingStop ? parseFloat(row.trailingStop) : null,
    strategyId: row.strategyId,
    userId: row.userId,
    broker: row.broker || 'paper',
    status: row.status,
    entryOrderId: row.entryOrderId,
    exitOrderId: row.exitOrderId,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    lastUpdatedAt: row.lastUpdatedAt,
  };
}

export class DatabasePositionRepository implements Repository<PositionEntity> {
  constructor(private readonly db: NodePgDatabase<any>) {}

  async findById(id: string): Promise<PositionEntity | null> {
    const result = await this.db
      .select()
      .from(positions)
      .where(eq(positions.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return dbPositionToEntity(result[0]);
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<PositionEntity[]> {
    let query = this.db
      .select()
      .from(positions)
      .orderBy(desc(positions.openedAt));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    const result = await query;
    return result.map(dbPositionToEntity);
  }

  async create(entity: Omit<PositionEntity, 'id' | 'openedAt' | 'lastUpdatedAt'>): Promise<PositionEntity> {
    const insertData: InsertPosition = {
      symbol: entity.symbol,
      side: entity.side,
      quantity: String(entity.quantity),
      entryPrice: String(entity.entryPrice),
      currentPrice: entity.currentPrice != null ? String(entity.currentPrice) : null,
      unrealizedPnl: entity.unrealizedPnl != null ? String(entity.unrealizedPnl) : null,
      unrealizedPnlPercent: entity.unrealizedPnlPercent != null ? String(entity.unrealizedPnlPercent) : null,
      realizedPnl: String(entity.realizedPnl || 0),
      totalFees: String(entity.totalFees || 0),
      stopLoss: entity.stopLoss != null ? String(entity.stopLoss) : null,
      takeProfit: entity.takeProfit != null ? String(entity.takeProfit) : null,
      trailingStop: entity.trailingStop != null ? String(entity.trailingStop) : null,
      strategyId: entity.strategyId,
      userId: entity.userId,
      broker: entity.broker,
      status: entity.status,
      entryOrderId: entity.entryOrderId,
      exitOrderId: entity.exitOrderId,
      closedAt: entity.closedAt,
    };

    const result = await this.db
      .insert(positions)
      .values(insertData)
      .returning();

    return dbPositionToEntity(result[0]);
  }

  async update(id: string, entity: Partial<PositionEntity>): Promise<PositionEntity | null> {
    const updateData: Partial<InsertPosition> = {};

    if (entity.quantity !== undefined) updateData.quantity = String(entity.quantity);
    if (entity.entryPrice !== undefined) updateData.entryPrice = String(entity.entryPrice);
    if (entity.currentPrice !== undefined) updateData.currentPrice = entity.currentPrice != null ? String(entity.currentPrice) : null;
    if (entity.unrealizedPnl !== undefined) updateData.unrealizedPnl = entity.unrealizedPnl != null ? String(entity.unrealizedPnl) : null;
    if (entity.unrealizedPnlPercent !== undefined) updateData.unrealizedPnlPercent = entity.unrealizedPnlPercent != null ? String(entity.unrealizedPnlPercent) : null;
    if (entity.realizedPnl !== undefined) updateData.realizedPnl = String(entity.realizedPnl);
    if (entity.status !== undefined) updateData.status = entity.status;
    if (entity.closedAt !== undefined) updateData.closedAt = entity.closedAt;
    if (entity.exitOrderId !== undefined) updateData.exitOrderId = entity.exitOrderId;

    const result = await this.db
      .update(positions)
      .set({ ...updateData, lastUpdatedAt: new Date() })
      .where(eq(positions.id, id))
      .returning();

    if (result.length === 0) return null;
    return dbPositionToEntity(result[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(positions)
      .where(eq(positions.id, id))
      .returning({ id: positions.id });

    return result.length > 0;
  }

  async findOpenPositions(): Promise<PositionEntity[]> {
    const result = await this.db
      .select()
      .from(positions)
      .where(eq(positions.status, 'open'))
      .orderBy(desc(positions.openedAt));

    return result.map(dbPositionToEntity);
  }

  async findBySymbol(symbol: string): Promise<PositionEntity[]> {
    const result = await this.db
      .select()
      .from(positions)
      .where(eq(positions.symbol, symbol.toUpperCase()))
      .orderBy(desc(positions.openedAt));

    return result.map(dbPositionToEntity);
  }

  async findOpenBySymbolAndSide(symbol: string, side: string): Promise<PositionEntity | null> {
    const result = await this.db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.symbol, symbol.toUpperCase()),
          eq(positions.side, side),
          eq(positions.status, 'open')
        )
      )
      .limit(1);

    if (result.length === 0) return null;
    return dbPositionToEntity(result[0]);
  }
}

export class InMemoryPositionRepository implements Repository<PositionEntity> {
  private positions: Map<string, PositionEntity> = new Map();
  private counter = 0;

  async findById(id: string): Promise<PositionEntity | null> {
    return this.positions.get(id) || null;
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<PositionEntity[]> {
    let result = Array.from(this.positions.values())
      .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());

    if (options?.offset) {
      result = result.slice(options.offset);
    }
    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  async create(entity: Omit<PositionEntity, 'id' | 'openedAt' | 'lastUpdatedAt'>): Promise<PositionEntity> {
    const id = `pos_mem_${++this.counter}_${Date.now()}`;
    const now = new Date();

    const position: PositionEntity = {
      ...entity,
      id,
      openedAt: now,
      lastUpdatedAt: now,
    };

    this.positions.set(id, position);
    return position;
  }

  async update(id: string, entity: Partial<PositionEntity>): Promise<PositionEntity | null> {
    const existing = this.positions.get(id);
    if (!existing) return null;

    const updated: PositionEntity = {
      ...existing,
      ...entity,
      id,
      openedAt: existing.openedAt,
      lastUpdatedAt: new Date(),
    };

    this.positions.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.positions.delete(id);
  }

  clear(): void {
    this.positions.clear();
    this.counter = 0;
  }

  findOpenBySymbolAndSide(symbol: string, side: string): PositionEntity | null {
    const upperSymbol = symbol.toUpperCase();
    for (const position of this.positions.values()) {
      if (position.symbol === upperSymbol && position.side === side && position.status === 'open') {
        return position;
      }
    }
    return null;
  }
}
