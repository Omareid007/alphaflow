import { eq, desc, and, gte, lte, sql, like, or } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  strategies,
  trades,
  positions,
  aiDecisions,
  agentStatus,
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
}

export const storage = new DatabaseStorage();
