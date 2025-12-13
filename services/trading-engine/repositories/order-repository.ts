/**
 * AI Active Trader - Order Repository
 * Database repository implementation for orders using trading schema
 */

import { eq, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Repository } from '../../shared/repositories';
import { orders, Order as DbOrder, InsertOrder } from '../../shared/database/trading-schema';

export interface OrderEntity {
  id: string;
  externalId?: string | null;
  symbol: string;
  side: string;
  orderType: string;
  quantity: number;
  limitPrice?: number | null;
  stopPrice?: number | null;
  filledQuantity: number;
  filledPrice?: number | null;
  status: string;
  timeInForce: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
  decisionId?: string | null;
  strategyId?: string | null;
  userId?: string | null;
  broker: string;
  fees: number;
  slippage?: number | null;
  errorMessage?: string | null;
  submittedAt: Date;
  filledAt?: Date | null;
  canceledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function dbOrderToEntity(row: DbOrder): OrderEntity {
  return {
    id: row.id,
    externalId: row.externalId,
    symbol: row.symbol,
    side: row.side,
    orderType: row.orderType,
    quantity: parseFloat(row.quantity),
    limitPrice: row.limitPrice ? parseFloat(row.limitPrice) : null,
    stopPrice: row.stopPrice ? parseFloat(row.stopPrice) : null,
    filledQuantity: row.filledQuantity ? parseFloat(row.filledQuantity) : 0,
    filledPrice: row.filledPrice ? parseFloat(row.filledPrice) : null,
    status: row.status,
    timeInForce: row.timeInForce || 'day',
    stopLoss: row.stopLoss ? parseFloat(row.stopLoss) : null,
    takeProfit: row.takeProfit ? parseFloat(row.takeProfit) : null,
    decisionId: row.decisionId,
    strategyId: row.strategyId,
    userId: row.userId,
    broker: row.broker || 'paper',
    fees: row.fees ? parseFloat(row.fees) : 0,
    slippage: row.slippage ? parseFloat(row.slippage) : null,
    errorMessage: row.errorMessage,
    submittedAt: row.submittedAt,
    filledAt: row.filledAt,
    canceledAt: row.canceledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DatabaseOrderRepository implements Repository<OrderEntity> {
  constructor(private readonly db: NodePgDatabase<any>) {}

  async findById(id: string): Promise<OrderEntity | null> {
    const result = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return dbOrderToEntity(result[0]);
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<OrderEntity[]> {
    let query = this.db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    const result = await query;
    return result.map(dbOrderToEntity);
  }

  async create(entity: Omit<OrderEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<OrderEntity> {
    const insertData: InsertOrder = {
      symbol: entity.symbol,
      side: entity.side,
      orderType: entity.orderType,
      quantity: String(entity.quantity),
      limitPrice: entity.limitPrice != null ? String(entity.limitPrice) : null,
      stopPrice: entity.stopPrice != null ? String(entity.stopPrice) : null,
      filledQuantity: String(entity.filledQuantity || 0),
      filledPrice: entity.filledPrice != null ? String(entity.filledPrice) : null,
      status: entity.status,
      timeInForce: entity.timeInForce,
      stopLoss: entity.stopLoss != null ? String(entity.stopLoss) : null,
      takeProfit: entity.takeProfit != null ? String(entity.takeProfit) : null,
      decisionId: entity.decisionId,
      strategyId: entity.strategyId,
      userId: entity.userId,
      broker: entity.broker,
      fees: String(entity.fees || 0),
      slippage: entity.slippage != null ? String(entity.slippage) : null,
      errorMessage: entity.errorMessage,
      submittedAt: entity.submittedAt,
      filledAt: entity.filledAt,
      canceledAt: entity.canceledAt,
      externalId: entity.externalId,
    };

    const result = await this.db
      .insert(orders)
      .values(insertData)
      .returning();

    return dbOrderToEntity(result[0]);
  }

  async update(id: string, entity: Partial<OrderEntity>): Promise<OrderEntity | null> {
    const updateData: Partial<InsertOrder> = {};

    if (entity.symbol !== undefined) updateData.symbol = entity.symbol;
    if (entity.side !== undefined) updateData.side = entity.side;
    if (entity.orderType !== undefined) updateData.orderType = entity.orderType;
    if (entity.quantity !== undefined) updateData.quantity = String(entity.quantity);
    if (entity.limitPrice !== undefined) updateData.limitPrice = entity.limitPrice != null ? String(entity.limitPrice) : null;
    if (entity.filledQuantity !== undefined) updateData.filledQuantity = String(entity.filledQuantity);
    if (entity.filledPrice !== undefined) updateData.filledPrice = entity.filledPrice != null ? String(entity.filledPrice) : null;
    if (entity.status !== undefined) updateData.status = entity.status;
    if (entity.errorMessage !== undefined) updateData.errorMessage = entity.errorMessage;
    if (entity.filledAt !== undefined) updateData.filledAt = entity.filledAt;
    if (entity.canceledAt !== undefined) updateData.canceledAt = entity.canceledAt;

    const result = await this.db
      .update(orders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    if (result.length === 0) return null;
    return dbOrderToEntity(result[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(orders)
      .where(eq(orders.id, id))
      .returning({ id: orders.id });

    return result.length > 0;
  }

  async findByStatus(status: string, limit?: number): Promise<OrderEntity[]> {
    let query = this.db
      .select()
      .from(orders)
      .where(eq(orders.status, status))
      .orderBy(desc(orders.createdAt));

    if (limit) {
      query = query.limit(limit) as typeof query;
    }

    const result = await query;
    return result.map(dbOrderToEntity);
  }

  async findBySymbol(symbol: string, limit?: number): Promise<OrderEntity[]> {
    let query = this.db
      .select()
      .from(orders)
      .where(eq(orders.symbol, symbol.toUpperCase()))
      .orderBy(desc(orders.createdAt));

    if (limit) {
      query = query.limit(limit) as typeof query;
    }

    const result = await query;
    return result.map(dbOrderToEntity);
  }
}

export class InMemoryOrderRepository implements Repository<OrderEntity> {
  private orders: Map<string, OrderEntity> = new Map();
  private counter = 0;

  async findById(id: string): Promise<OrderEntity | null> {
    return this.orders.get(id) || null;
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<OrderEntity[]> {
    let result = Array.from(this.orders.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (options?.offset) {
      result = result.slice(options.offset);
    }
    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  async create(entity: Omit<OrderEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<OrderEntity> {
    const id = `ord_mem_${++this.counter}_${Date.now()}`;
    const now = new Date();

    const order: OrderEntity = {
      ...entity,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.orders.set(id, order);
    return order;
  }

  async update(id: string, entity: Partial<OrderEntity>): Promise<OrderEntity | null> {
    const existing = this.orders.get(id);
    if (!existing) return null;

    const updated: OrderEntity = {
      ...existing,
      ...entity,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    this.orders.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.orders.delete(id);
  }

  clear(): void {
    this.orders.clear();
    this.counter = 0;
  }
}
