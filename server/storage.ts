import { eq, desc, and, gte, lte, sql, like, or } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  strategies,
  trades,
  positions,
  aiDecisions,
  agentStatus,
  workItems,
  workItemRuns,
  brokerAssets,
  orders,
  fills,
  type User,
  type InsertUser,
  type Strategy,
  type InsertStrategy,
  type Trade,
  type InsertTrade,
  type Position,
  type InsertPosition,
  type AiDecision,
  type InsertAiDecision,
  type AgentStatus,
  type WorkItem,
  type InsertWorkItem,
  type WorkItemRun,
  type InsertWorkItemRun,
  type WorkItemType,
  type WorkItemStatus,
  type BrokerAsset,
  type InsertBrokerAsset,
  type AssetClass,
  type Order,
  type InsertOrder,
  type Fill,
  type InsertFill,
} from "@shared/schema";

export interface TradeFilters {
  limit?: number;
  offset?: number;
  symbol?: string;
  strategyId?: string;
  pnlDirection?: 'profit' | 'loss' | 'all';
  startDate?: Date;
  endDate?: Date;
}

export interface EnrichedTrade extends Trade {
  aiDecision?: AiDecision | null;
  strategyName?: string | null;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;

  getStrategies(): Promise<Strategy[]>;
  getStrategy(id: string): Promise<Strategy | undefined>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  updateStrategy(id: string, updates: Partial<InsertStrategy>): Promise<Strategy | undefined>;
  toggleStrategy(id: string, isActive: boolean): Promise<Strategy | undefined>;

  getTrades(limit?: number): Promise<Trade[]>;
  getTradesFiltered(filters: TradeFilters): Promise<{ trades: EnrichedTrade[]; total: number }>;
  getTrade(id: string): Promise<Trade | undefined>;
  getEnrichedTrade(id: string): Promise<EnrichedTrade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  getDistinctSymbols(): Promise<string[]>;

  getPositions(): Promise<Position[]>;
  getPosition(id: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: string, updates: Partial<InsertPosition>): Promise<Position | undefined>;
  deletePosition(id: string): Promise<boolean>;

  getAiDecisions(limit?: number): Promise<AiDecision[]>;
  createAiDecision(decision: InsertAiDecision): Promise<AiDecision>;
  updateAiDecision(id: string, updates: Partial<InsertAiDecision>): Promise<AiDecision | undefined>;
  getLatestAiDecisionForSymbol(symbol: string, strategyId?: string): Promise<AiDecision | undefined>;

  getAgentStatus(): Promise<AgentStatus | undefined>;
  updateAgentStatus(updates: Partial<AgentStatus>): Promise<AgentStatus>;

  createOrder(order: InsertOrder): Promise<Order>;
  upsertOrderByBrokerOrderId(brokerOrderId: string, data: Partial<InsertOrder>): Promise<Order>;
  getOrderByBrokerOrderId(brokerOrderId: string): Promise<Order | undefined>;
  getOrderByClientOrderId(clientOrderId: string): Promise<Order | undefined>;
  getOrdersByStatus(status: string, limit?: number): Promise<Order[]>;
  getRecentOrders(limit?: number): Promise<Order[]>;
  createFill(fill: InsertFill): Promise<Fill>;
  getFillsByOrderId(orderId: string): Promise<Fill[]>;
  getFillsByBrokerOrderId(brokerOrderId: string): Promise<Fill[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getStrategies(): Promise<Strategy[]> {
    return db.select().from(strategies).orderBy(desc(strategies.createdAt));
  }

  async getStrategy(id: string): Promise<Strategy | undefined> {
    const [strategy] = await db.select().from(strategies).where(eq(strategies.id, id));
    return strategy;
  }

  async createStrategy(insertStrategy: InsertStrategy): Promise<Strategy> {
    const [strategy] = await db.insert(strategies).values(insertStrategy).returning();
    return strategy;
  }

  async updateStrategy(id: string, updates: Partial<InsertStrategy>): Promise<Strategy | undefined> {
    const [strategy] = await db
      .update(strategies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(strategies.id, id))
      .returning();
    return strategy;
  }

  async toggleStrategy(id: string, isActive: boolean): Promise<Strategy | undefined> {
    return this.updateStrategy(id, { isActive });
  }

  async getTrades(limit: number = 50): Promise<Trade[]> {
    return db.select().from(trades).orderBy(desc(trades.executedAt)).limit(limit);
  }

  async getTradesFiltered(filters: TradeFilters): Promise<{ trades: EnrichedTrade[]; total: number }> {
    const conditions: any[] = [];
    
    if (filters.symbol) {
      conditions.push(eq(trades.symbol, filters.symbol));
    }
    
    if (filters.strategyId) {
      conditions.push(eq(trades.strategyId, filters.strategyId));
    }
    
    if (filters.startDate) {
      conditions.push(gte(trades.executedAt, filters.startDate));
    }
    
    if (filters.endDate) {
      conditions.push(lte(trades.executedAt, filters.endDate));
    }
    
    if (filters.pnlDirection === 'profit') {
      conditions.push(sql`CAST(${trades.pnl} AS numeric) >= 0`);
    } else if (filters.pnlDirection === 'loss') {
      conditions.push(sql`CAST(${trades.pnl} AS numeric) < 0`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(trades)
      .where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);
    
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    
    const tradeResults = await db
      .select()
      .from(trades)
      .where(whereClause)
      .orderBy(desc(trades.executedAt))
      .limit(limit)
      .offset(offset);
    
    const enrichedTrades: EnrichedTrade[] = await Promise.all(
      tradeResults.map(async (trade) => {
        const [aiDecision] = await db
          .select()
          .from(aiDecisions)
          .where(eq(aiDecisions.executedTradeId, trade.id))
          .limit(1);
        
        let strategyName: string | null = null;
        if (trade.strategyId) {
          const [strategy] = await db
            .select()
            .from(strategies)
            .where(eq(strategies.id, trade.strategyId));
          strategyName = strategy?.name ?? null;
        }
        
        return {
          ...trade,
          aiDecision: aiDecision ?? null,
          strategyName,
        };
      })
    );
    
    return { trades: enrichedTrades, total };
  }

  async getTrade(id: string): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id));
    return trade;
  }

  async getEnrichedTrade(id: string): Promise<EnrichedTrade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id));
    if (!trade) return undefined;
    
    const [aiDecision] = await db
      .select()
      .from(aiDecisions)
      .where(eq(aiDecisions.executedTradeId, trade.id))
      .limit(1);
    
    let strategyName: string | null = null;
    if (trade.strategyId) {
      const [strategy] = await db
        .select()
        .from(strategies)
        .where(eq(strategies.id, trade.strategyId));
      strategyName = strategy?.name ?? null;
    }
    
    return {
      ...trade,
      aiDecision: aiDecision ?? null,
      strategyName,
    };
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const [trade] = await db.insert(trades).values(insertTrade).returning();
    return trade;
  }

  async updateTrade(id: string, updates: Partial<InsertTrade>): Promise<Trade | undefined> {
    const [trade] = await db
      .update(trades)
      .set(updates)
      .where(eq(trades.id, id))
      .returning();
    return trade;
  }

  async getDistinctSymbols(): Promise<string[]> {
    const result = await db
      .selectDistinct({ symbol: trades.symbol })
      .from(trades)
      .orderBy(trades.symbol);
    return result.map(r => r.symbol);
  }

  async getPositions(): Promise<Position[]> {
    return db.select().from(positions).orderBy(desc(positions.openedAt));
  }

  async getPosition(id: string): Promise<Position | undefined> {
    const [position] = await db.select().from(positions).where(eq(positions.id, id));
    return position;
  }

  async createPosition(insertPosition: InsertPosition): Promise<Position> {
    const [position] = await db.insert(positions).values(insertPosition).returning();
    return position;
  }

  async updatePosition(id: string, updates: Partial<InsertPosition>): Promise<Position | undefined> {
    const [position] = await db
      .update(positions)
      .set(updates)
      .where(eq(positions.id, id))
      .returning();
    return position;
  }

  async deletePosition(id: string): Promise<boolean> {
    const result = await db.delete(positions).where(eq(positions.id, id)).returning();
    return result.length > 0;
  }

  async deleteAllPositions(): Promise<number> {
    const result = await db.delete(positions).returning();
    return result.length;
  }

  async syncPositionsFromAlpaca(alpacaPositions: Array<{
    symbol: string;
    qty: string;
    avg_entry_price: string;
    current_price: string;
    unrealized_pl: string;
    side: string;
  }>): Promise<Position[]> {
    await this.deleteAllPositions();
    
    if (alpacaPositions.length === 0) {
      return [];
    }

    const positionsToInsert = alpacaPositions.map(pos => ({
      symbol: pos.symbol,
      quantity: pos.qty,
      entryPrice: pos.avg_entry_price,
      currentPrice: pos.current_price,
      unrealizedPnl: pos.unrealized_pl,
      side: pos.side === "long" ? "long" : "short",
    }));

    const insertedPositions = await db.insert(positions).values(positionsToInsert).returning();
    return insertedPositions;
  }

  async getAiDecisions(limit: number = 20): Promise<AiDecision[]> {
    return db.select().from(aiDecisions).orderBy(desc(aiDecisions.createdAt)).limit(limit);
  }

  async createAiDecision(insertDecision: InsertAiDecision): Promise<AiDecision> {
    const [decision] = await db.insert(aiDecisions).values(insertDecision).returning();
    return decision;
  }

  async updateAiDecision(id: string, updates: Partial<InsertAiDecision>): Promise<AiDecision | undefined> {
    const [decision] = await db
      .update(aiDecisions)
      .set(updates)
      .where(eq(aiDecisions.id, id))
      .returning();
    return decision;
  }

  async getLatestAiDecisionForSymbol(symbol: string, strategyId?: string): Promise<AiDecision | undefined> {
    const conditions = [eq(aiDecisions.symbol, symbol.toUpperCase())];
    if (strategyId) {
      conditions.push(eq(aiDecisions.strategyId, strategyId));
    }
    const [decision] = await db
      .select()
      .from(aiDecisions)
      .where(and(...conditions))
      .orderBy(desc(aiDecisions.createdAt))
      .limit(1);
    return decision;
  }

  async getAgentStatus(): Promise<AgentStatus | undefined> {
    const [status] = await db.select().from(agentStatus).limit(1);
    return status;
  }

  async updateAgentStatus(updates: Partial<AgentStatus>): Promise<AgentStatus> {
    const existing = await this.getAgentStatus();
    if (existing) {
      const [status] = await db
        .update(agentStatus)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(agentStatus.id, existing.id))
        .returning();
      return status;
    } else {
      const [status] = await db.insert(agentStatus).values({
        isRunning: updates.isRunning ?? false,
        ...updates,
      }).returning();
      return status;
    }
  }

  async createWorkItem(item: InsertWorkItem): Promise<WorkItem> {
    const [workItem] = await db.insert(workItems).values(item).returning();
    return workItem;
  }

  async getWorkItem(id: string): Promise<WorkItem | undefined> {
    const [item] = await db.select().from(workItems).where(eq(workItems.id, id));
    return item;
  }

  async getWorkItemByIdempotencyKey(key: string): Promise<WorkItem | null> {
    const [item] = await db.select().from(workItems).where(eq(workItems.idempotencyKey, key));
    return item || null;
  }

  async updateWorkItem(id: string, updates: Partial<WorkItem>): Promise<WorkItem | undefined> {
    const [item] = await db
      .update(workItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workItems.id, id))
      .returning();
    return item;
  }

  async claimNextWorkItem(types?: WorkItemType[]): Promise<WorkItem | null> {
    const now = new Date();
    const conditions = [
      eq(workItems.status, "PENDING"),
      lte(workItems.nextRunAt, now),
    ];
    
    const query = db
      .select()
      .from(workItems)
      .where(and(...conditions))
      .orderBy(workItems.nextRunAt)
      .limit(1);
    
    const [item] = await query;
    
    if (!item) return null;
    
    if (types && types.length > 0 && !types.includes(item.type as WorkItemType)) {
      return null;
    }
    
    const [claimed] = await db
      .update(workItems)
      .set({ status: "RUNNING", updatedAt: new Date() })
      .where(and(eq(workItems.id, item.id), eq(workItems.status, "PENDING")))
      .returning();
    
    return claimed || null;
  }

  async getWorkItemCount(status?: WorkItemStatus, type?: WorkItemType): Promise<number> {
    const conditions = [];
    if (status) conditions.push(eq(workItems.status, status));
    if (type) conditions.push(eq(workItems.type, type));
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(workItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    return Number(result[0]?.count || 0);
  }

  async getWorkItems(limit: number = 50, status?: WorkItemStatus): Promise<WorkItem[]> {
    const conditions = status ? [eq(workItems.status, status)] : [];
    
    return db
      .select()
      .from(workItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(workItems.createdAt))
      .limit(limit);
  }

  async createWorkItemRun(run: InsertWorkItemRun): Promise<WorkItemRun> {
    const [itemRun] = await db.insert(workItemRuns).values(run).returning();
    return itemRun;
  }

  async getWorkItemRuns(workItemId: string): Promise<WorkItemRun[]> {
    return db
      .select()
      .from(workItemRuns)
      .where(eq(workItemRuns.workItemId, workItemId))
      .orderBy(desc(workItemRuns.createdAt));
  }

  async getBrokerAsset(symbol: string): Promise<BrokerAsset | undefined> {
    const [asset] = await db
      .select()
      .from(brokerAssets)
      .where(eq(brokerAssets.symbol, symbol.toUpperCase()));
    return asset;
  }

  async getBrokerAssets(
    assetClass?: AssetClass,
    tradableOnly: boolean = false,
    limit: number = 1000
  ): Promise<BrokerAsset[]> {
    const conditions = [];
    if (assetClass) conditions.push(eq(brokerAssets.assetClass, assetClass));
    if (tradableOnly) conditions.push(eq(brokerAssets.tradable, true));
    
    return db
      .select()
      .from(brokerAssets)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(brokerAssets.symbol)
      .limit(limit);
  }

  async upsertBrokerAsset(asset: InsertBrokerAsset): Promise<BrokerAsset> {
    const [existing] = await db
      .select()
      .from(brokerAssets)
      .where(eq(brokerAssets.symbol, asset.symbol.toUpperCase()));
    
    if (existing) {
      const [updated] = await db
        .update(brokerAssets)
        .set({ ...asset, updatedAt: new Date(), lastSyncedAt: new Date() })
        .where(eq(brokerAssets.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(brokerAssets)
      .values({ ...asset, symbol: asset.symbol.toUpperCase() })
      .returning();
    return created;
  }

  async bulkUpsertBrokerAssets(assets: InsertBrokerAsset[]): Promise<number> {
    let count = 0;
    const batchSize = 100;
    
    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize);
      for (const asset of batch) {
        await this.upsertBrokerAsset(asset);
        count++;
      }
    }
    
    return count;
  }

  async getBrokerAssetCount(assetClass?: AssetClass): Promise<number> {
    const conditions = assetClass ? [eq(brokerAssets.assetClass, assetClass)] : [];
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(brokerAssets)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    return Number(result[0]?.count || 0);
  }

  async getLastAssetSyncTime(): Promise<Date | null> {
    const [result] = await db
      .select({ lastSynced: sql<Date>`MAX(last_synced_at)` })
      .from(brokerAssets);
    return result?.lastSynced || null;
  }

  async searchBrokerAssets(query: string, limit: number = 20): Promise<BrokerAsset[]> {
    const searchPattern = `%${query.toUpperCase()}%`;
    return db
      .select()
      .from(brokerAssets)
      .where(
        and(
          eq(brokerAssets.tradable, true),
          or(
            like(brokerAssets.symbol, searchPattern),
            like(sql`UPPER(${brokerAssets.name})`, searchPattern)
          )
        )
      )
      .orderBy(brokerAssets.symbol)
      .limit(limit);
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [result] = await db.insert(orders).values(order).returning();
    return result;
  }

  async upsertOrderByBrokerOrderId(brokerOrderId: string, data: Partial<InsertOrder>): Promise<Order> {
    const existing = await this.getOrderByBrokerOrderId(brokerOrderId);
    if (existing) {
      const [updated] = await db.update(orders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(orders.brokerOrderId, brokerOrderId))
        .returning();
      return updated;
    }
    try {
      const [created] = await db.insert(orders).values({ ...data, brokerOrderId } as InsertOrder).returning();
      return created;
    } catch (error: any) {
      if (error.code === "23505" || error.message?.includes("duplicate")) {
        const [updated] = await db.update(orders)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(orders.brokerOrderId, brokerOrderId))
          .returning();
        return updated;
      }
      throw error;
    }
  }

  async getOrderByBrokerOrderId(brokerOrderId: string): Promise<Order | undefined> {
    const [result] = await db.select().from(orders).where(eq(orders.brokerOrderId, brokerOrderId)).limit(1);
    return result;
  }

  async getOrderByClientOrderId(clientOrderId: string): Promise<Order | undefined> {
    const [result] = await db.select().from(orders).where(eq(orders.clientOrderId, clientOrderId)).limit(1);
    return result;
  }

  async getOrdersByStatus(status: string, limit = 100): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.status, status)).limit(limit).orderBy(desc(orders.createdAt));
  }

  async getRecentOrders(limit = 50): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
  }

  async createFill(fill: InsertFill): Promise<Fill> {
    const [result] = await db.insert(fills).values(fill).returning();
    return result;
  }

  async getFillsByOrderId(orderId: string): Promise<Fill[]> {
    return db.select().from(fills).where(eq(fills.orderId, orderId)).orderBy(desc(fills.occurredAt));
  }

  async getFillsByBrokerOrderId(brokerOrderId: string): Promise<Fill[]> {
    return db.select().from(fills).where(eq(fills.brokerOrderId, brokerOrderId)).orderBy(desc(fills.occurredAt));
  }
}

export const storage = new DatabaseStorage();
