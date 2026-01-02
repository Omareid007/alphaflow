import {
  eq,
  desc,
  and,
  gte,
  lte,
  sql,
  like,
  or,
  inArray,
  type SQL,
} from "drizzle-orm";
import { db } from "./db";
import {
  sanitizeInput,
  sanitizeUserInput,
  sanitizeStrategyInput,
} from "./lib/sanitization";
import { log } from "./utils/logger";
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
  debateSessions,
  debateMessages,
  debateConsensus,
  traderProfiles,
  competitionRuns,
  competitionScores,
  strategyVersions,
  toolInvocations,
  auditLogs,
  passwordResetTokens,
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
  type InsertOrderInput,
  type Fill,
  type InsertFill,
  type DebateSession,
  type InsertDebateSession,
  type DebateMessage,
  type InsertDebateMessage,
  type DebateConsensus,
  type InsertDebateConsensus,
  type TraderProfile,
  type InsertTraderProfile,
  type CompetitionRun,
  type InsertCompetitionRun,
  type CompetitionScore,
  type InsertCompetitionScore,
  type StrategyVersion,
  type InsertStrategyVersion,
  type ToolInvocation,
  type InsertToolInvocation,
  type DebateSessionStatus,
  type AuditLog,
  type InsertAuditLog,
  insertAuditLogSchema,
  type PerformanceSummary,
} from "@shared/schema";

export interface TradeFilters {
  limit?: number;
  offset?: number;
  symbol?: string;
  strategyId?: string;
  pnlDirection?: "profit" | "loss" | "all";
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
  getUserByEmail(email: string): Promise<User | undefined>;
  getAdminUser(): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(
    id: string,
    updates: Partial<InsertUser>
  ): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Password reset tokens
  createPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date
  ): Promise<void>;
  getPasswordResetToken(
    token: string
  ): Promise<{ userId: string; expiresAt: Date; used: boolean } | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<number>;

  getStrategies(): Promise<Strategy[]>;
  getActiveStrategies(): Promise<Strategy[]>;
  getStrategy(id: string): Promise<Strategy | undefined>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  updateStrategy(
    id: string,
    updates: Partial<InsertStrategy>
  ): Promise<Strategy | undefined>;
  updateStrategyStatus(
    id: string,
    status: string,
    mode?: string
  ): Promise<Strategy | undefined>;
  toggleStrategy(id: string, isActive: boolean): Promise<Strategy | undefined>;
  deleteStrategy(id: string): Promise<boolean>;
  updateStrategyPerformance(
    id: string,
    performanceSummary: PerformanceSummary
  ): Promise<Strategy | undefined>;

  getTrades(userId?: string, limit?: number): Promise<Trade[]>;
  getTradesFiltered(
    userId: string,
    filters: TradeFilters
  ): Promise<{ trades: EnrichedTrade[]; total: number }>;
  getTrade(id: string): Promise<Trade | undefined>;
  getEnrichedTrade(id: string): Promise<EnrichedTrade | undefined>;
  createTrade(
    trade: Omit<InsertTrade, "userId"> & { userId?: string }
  ): Promise<Trade>;
  getDistinctSymbols(): Promise<string[]>;
  getTradesByStrategy(strategyId: string, limit?: number): Promise<Trade[]>;

  getPositions(userId?: string): Promise<Position[]>;
  getPosition(id: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(
    id: string,
    updates: Partial<InsertPosition>
  ): Promise<Position | undefined>;
  deletePosition(id: string): Promise<boolean>;
  getPositionsByStrategy(strategyId: string): Promise<Position[]>;

  getAiDecisions(userId?: string, limit?: number): Promise<AiDecision[]>;
  createAiDecision(
    decision: Omit<InsertAiDecision, "userId"> & { userId?: string }
  ): Promise<AiDecision>;
  updateAiDecision(
    id: string,
    updates: Partial<InsertAiDecision>
  ): Promise<AiDecision | undefined>;
  getLatestAiDecisionForSymbol(
    symbol: string,
    strategyId?: string
  ): Promise<AiDecision | undefined>;
  getAiDecisionsByStatus(
    userId: string,
    status: string,
    limit?: number
  ): Promise<AiDecision[]>;
  getPendingAiDecisions(userId: string, limit?: number): Promise<AiDecision[]>;
  getOrdersByDecisionId(decisionId: string): Promise<Order[]>;

  getAgentStatus(): Promise<AgentStatus | undefined>;
  updateAgentStatus(updates: Partial<AgentStatus>): Promise<AgentStatus>;

  createOrder(order: InsertOrder): Promise<Order>;
  upsertOrderByBrokerOrderId(
    brokerOrderId: string,
    data: Partial<InsertOrder>
  ): Promise<Order>;
  getOrderByBrokerOrderId(brokerOrderId: string): Promise<Order | undefined>;
  getOrderByClientOrderId(clientOrderId: string): Promise<Order | undefined>;
  getOrderById(id: string): Promise<Order | undefined>;
  getOrdersByStatus(
    userId: string,
    status: string,
    limit?: number
  ): Promise<Order[]>;
  getRecentOrders(userId?: string, limit?: number): Promise<Order[]>;
  // Note: Strategy-order linking requires schema update (orders.strategyId column)
  // This is a stub returning empty array until proper implementation
  getOrdersByStrategy(strategyId: string, limit?: number): Promise<Order[]>;
  createFill(fill: InsertFill): Promise<Fill>;
  getFillsByOrderId(orderId: string): Promise<Fill[]>;
  getFillsByOrderIds(orderIds: string[]): Promise<Fill[]>;
  getFillsByBrokerOrderId(brokerOrderId: string): Promise<Fill[]>;

  // Audit Logging
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getUserAuditLogs(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<AuditLog[]>;
  getResourceAuditLogs(
    resource: string,
    resourceId: string,
    limit?: number
  ): Promise<AuditLog[]>;
  getRecentAuditLogs(limit?: number, offset?: number): Promise<AuditLog[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAdminUser(): Promise<User | undefined> {
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.isAdmin, true))
      .limit(1);
    return adminUser;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.id));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // SECURITY: Sanitize user input to prevent XSS attacks
    const sanitizedUser = sanitizeUserInput(insertUser) as InsertUser;
    const [user] = await db.insert(users).values(sanitizedUser).returning();
    return user;
  }

  async updateUser(
    id: string,
    updates: Partial<InsertUser>
  ): Promise<User | undefined> {
    // SECURITY: Sanitize user input to prevent XSS attacks
    const sanitizedUpdates = sanitizeUserInput(updates) as Partial<InsertUser>;
    const [user] = await db
      .update(users)
      .set(sanitizedUpdates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Password reset token methods
  async createPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date
  ): Promise<void> {
    await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
      used: false,
    });
  }

  async getPasswordResetToken(
    token: string
  ): Promise<{ userId: string; expiresAt: Date; used: boolean } | undefined> {
    const [result] = await db
      .select({
        userId: passwordResetTokens.userId,
        expiresAt: passwordResetTokens.expiresAt,
        used: passwordResetTokens.used,
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return result;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
  }

  async deleteExpiredPasswordResetTokens(): Promise<number> {
    const result = await db
      .delete(passwordResetTokens)
      .where(lte(passwordResetTokens.expiresAt, new Date()))
      .returning();
    return result.length;
  }

  async getStrategies(): Promise<Strategy[]> {
    return db.select().from(strategies).orderBy(desc(strategies.createdAt));
  }

  async getActiveStrategies(): Promise<Strategy[]> {
    return db
      .select()
      .from(strategies)
      .where(inArray(strategies.status, ["paper", "live"]))
      .orderBy(desc(strategies.createdAt));
  }

  async getStrategy(id: string): Promise<Strategy | undefined> {
    const [strategy] = await db
      .select()
      .from(strategies)
      .where(eq(strategies.id, id));
    return strategy;
  }

  async createStrategy(insertStrategy: InsertStrategy): Promise<Strategy> {
    // SECURITY: Sanitize strategy input to prevent XSS attacks
    const sanitizedStrategy = sanitizeStrategyInput(
      insertStrategy
    ) as InsertStrategy;
    const [strategy] = await db
      .insert(strategies)
      .values(sanitizedStrategy)
      .returning();
    return strategy;
  }

  async updateStrategy(
    id: string,
    updates: Partial<InsertStrategy>
  ): Promise<Strategy | undefined> {
    // SECURITY: Sanitize strategy input to prevent XSS attacks
    const sanitizedUpdates = sanitizeStrategyInput(
      updates
    ) as Partial<InsertStrategy>;
    const [strategy] = await db
      .update(strategies)
      .set({ ...sanitizedUpdates, updatedAt: new Date() })
      .where(eq(strategies.id, id))
      .returning();
    return strategy;
  }

  async updateStrategyStatus(
    id: string,
    status: string,
    mode?: string
  ): Promise<Strategy | undefined> {
    const updates: Partial<InsertStrategy> = {
      status: status as InsertStrategy["status"],
    };
    if (mode) {
      updates.mode = mode as InsertStrategy["mode"];
    }
    return this.updateStrategy(id, updates);
  }

  async toggleStrategy(
    id: string,
    isActive: boolean
  ): Promise<Strategy | undefined> {
    return this.updateStrategy(id, { isActive });
  }

  async deleteStrategy(id: string): Promise<boolean> {
    const result = await db
      .delete(strategies)
      .where(eq(strategies.id, id))
      .returning();
    return result.length > 0;
  }

  async updateStrategyPerformance(
    id: string,
    performanceSummary: PerformanceSummary
  ): Promise<Strategy | undefined> {
    const [strategy] = await db
      .update(strategies)
      .set({ performanceSummary, updatedAt: new Date() })
      .where(eq(strategies.id, id))
      .returning();
    return strategy;
  }

  async getTrades(userId?: string, limit: number = 50): Promise<Trade[]> {
    if (userId) {
      return db
        .select()
        .from(trades)
        .where(eq(trades.userId, userId))
        .orderBy(desc(trades.executedAt))
        .limit(limit);
    }
    return db
      .select()
      .from(trades)
      .orderBy(desc(trades.executedAt))
      .limit(limit);
  }

  async getTradesFiltered(
    userId: string,
    filters: TradeFilters
  ): Promise<{ trades: EnrichedTrade[]; total: number }> {
    const conditions: SQL<unknown>[] = [eq(trades.userId, userId)];

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

    if (filters.pnlDirection === "profit") {
      conditions.push(sql`CAST(${trades.pnl} AS numeric) >= 0`);
    } else if (filters.pnlDirection === "loss") {
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

    // FIX N+1 QUERY: Use JOIN instead of individual queries
    const result = await db
      .select({
        trade: trades,
        strategy: strategies,
        aiDecision: aiDecisions,
      })
      .from(trades)
      .leftJoin(strategies, eq(trades.strategyId, strategies.id))
      .leftJoin(aiDecisions, eq(aiDecisions.executedTradeId, trades.id))
      .where(whereClause)
      .orderBy(desc(trades.executedAt))
      .limit(limit)
      .offset(offset);

    const enrichedTrades: EnrichedTrade[] = result.map((row) => ({
      ...row.trade,
      aiDecision: row.aiDecision ?? null,
      strategyName: row.strategy?.name ?? null,
    }));

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

  async createTrade(
    insertTrade: Omit<InsertTrade, "userId"> & { userId?: string }
  ): Promise<Trade> {
    // Auto-fill userId if not provided
    let tradeData = insertTrade as InsertTrade;
    if (!insertTrade.userId) {
      const adminUser = await this.getAdminUser();
      tradeData = { ...insertTrade, userId: adminUser?.id || "system" };
    }
    const [trade] = await db.insert(trades).values(tradeData).returning();
    return trade;
  }

  async updateTrade(
    id: string,
    updates: Partial<InsertTrade>
  ): Promise<Trade | undefined> {
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
    return result.map((r) => r.symbol);
  }

  async getTradesByStrategy(
    strategyId: string,
    limit = 1000
  ): Promise<Trade[]> {
    return db
      .select()
      .from(trades)
      .where(eq(trades.strategyId, strategyId))
      .orderBy(desc(trades.executedAt))
      .limit(limit);
  }

  async getPositions(userId?: string): Promise<Position[]> {
    if (userId) {
      return db
        .select()
        .from(positions)
        .where(eq(positions.userId, userId))
        .orderBy(desc(positions.openedAt));
    }
    return db.select().from(positions).orderBy(desc(positions.openedAt));
  }

  async getPosition(id: string): Promise<Position | undefined> {
    const [position] = await db
      .select()
      .from(positions)
      .where(eq(positions.id, id));
    return position;
  }

  async createPosition(insertPosition: InsertPosition): Promise<Position> {
    const [position] = await db
      .insert(positions)
      .values(insertPosition)
      .returning();
    return position;
  }

  async updatePosition(
    id: string,
    updates: Partial<InsertPosition>
  ): Promise<Position | undefined> {
    const [position] = await db
      .update(positions)
      .set(updates)
      .where(eq(positions.id, id))
      .returning();
    return position;
  }

  async deletePosition(id: string): Promise<boolean> {
    const result = await db
      .delete(positions)
      .where(eq(positions.id, id))
      .returning();
    return result.length > 0;
  }

  async getPositionsByStrategy(strategyId: string): Promise<Position[]> {
    return db
      .select()
      .from(positions)
      .where(eq(positions.strategyId, strategyId))
      .orderBy(desc(positions.openedAt));
  }

  async deleteAllPositions(): Promise<number> {
    const result = await db.delete(positions).returning();
    return result.length;
  }

  async syncPositionsFromAlpaca(
    userId: string,
    alpacaPositions: Array<{
      symbol: string;
      qty: string;
      avg_entry_price: string;
      current_price: string;
      unrealized_pl: string;
      side: string;
    }>
  ): Promise<Position[]> {
    // TRANSACTION FIX: Wrap delete + insert in a transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Delete all positions for this user
      await tx.delete(positions).where(eq(positions.userId, userId));

      if (alpacaPositions.length === 0) {
        return [];
      }

      const positionsToInsert = alpacaPositions.map((pos) => ({
        userId,
        symbol: pos.symbol,
        quantity: pos.qty,
        entryPrice: pos.avg_entry_price,
        currentPrice: pos.current_price,
        unrealizedPnl: pos.unrealized_pl,
        side: pos.side === "long" ? "long" : "short",
      }));

      const insertedPositions = await tx
        .insert(positions)
        .values(positionsToInsert)
        .returning();
      return insertedPositions;
    });
  }

  async getAiDecisions(
    userId?: string,
    limit: number = 20
  ): Promise<AiDecision[]> {
    if (userId) {
      return db
        .select()
        .from(aiDecisions)
        .where(eq(aiDecisions.userId, userId))
        .orderBy(desc(aiDecisions.createdAt))
        .limit(limit);
    }
    return db
      .select()
      .from(aiDecisions)
      .orderBy(desc(aiDecisions.createdAt))
      .limit(limit);
  }

  async createAiDecision(
    insertDecision: Omit<InsertAiDecision, "userId"> & { userId?: string }
  ): Promise<AiDecision> {
    // Auto-fill userId if not provided
    let decisionData = insertDecision as InsertAiDecision;
    if (!insertDecision.userId) {
      const adminUser = await this.getAdminUser();
      decisionData = { ...insertDecision, userId: adminUser?.id || "system" };
    }
    const [decision] = await db
      .insert(aiDecisions)
      .values(decisionData)
      .returning();
    return decision;
  }

  async updateAiDecision(
    id: string,
    updates: Partial<InsertAiDecision>
  ): Promise<AiDecision | undefined> {
    const [decision] = await db
      .update(aiDecisions)
      .set(updates)
      .where(eq(aiDecisions.id, id))
      .returning();
    return decision;
  }

  async getLatestAiDecisionForSymbol(
    symbol: string,
    strategyId?: string
  ): Promise<AiDecision | undefined> {
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

  async getOrdersByDecisionId(decisionId: string): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(eq(orders.decisionId, decisionId))
      .orderBy(desc(orders.submittedAt));
  }

  async getAiDecisionsByStatus(
    userId: string,
    status: string,
    limit: number = 100
  ): Promise<AiDecision[]> {
    return db
      .select()
      .from(aiDecisions)
      .where(
        and(eq(aiDecisions.userId, userId), eq(aiDecisions.status, status))
      )
      .orderBy(desc(aiDecisions.createdAt))
      .limit(limit);
  }

  async getPendingAiDecisions(
    userId: string,
    limit: number = 50
  ): Promise<AiDecision[]> {
    return this.getAiDecisionsByStatus(userId, "pending", limit);
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
      const [status] = await db
        .insert(agentStatus)
        .values({
          isRunning: updates.isRunning ?? false,
          ...updates,
        })
        .returning();
      return status;
    }
  }

  async createWorkItem(item: InsertWorkItem): Promise<WorkItem> {
    const [workItem] = await db.insert(workItems).values(item).returning();
    return workItem;
  }

  async getWorkItem(id: string): Promise<WorkItem | undefined> {
    const [item] = await db
      .select()
      .from(workItems)
      .where(eq(workItems.id, id));
    return item;
  }

  async getWorkItemByIdempotencyKey(key: string): Promise<WorkItem | null> {
    const [item] = await db
      .select()
      .from(workItems)
      .where(eq(workItems.idempotencyKey, key));
    return item || null;
  }

  async updateWorkItem(
    id: string,
    updates: Partial<WorkItem>
  ): Promise<WorkItem | undefined> {
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

    if (
      types &&
      types.length > 0 &&
      !types.includes(item.type as WorkItemType)
    ) {
      return null;
    }

    const [claimed] = await db
      .update(workItems)
      .set({ status: "RUNNING", updatedAt: new Date() })
      .where(and(eq(workItems.id, item.id), eq(workItems.status, "PENDING")))
      .returning();

    return claimed || null;
  }

  async getWorkItemCount(
    status?: WorkItemStatus,
    type?: WorkItemType
  ): Promise<number> {
    const conditions = [];
    if (status) conditions.push(eq(workItems.status, status));
    if (type) conditions.push(eq(workItems.type, type));

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(workItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.count || 0);
  }

  async getWorkItems(
    limit: number = 50,
    status?: WorkItemStatus
  ): Promise<WorkItem[]> {
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
    const conditions = assetClass
      ? [eq(brokerAssets.assetClass, assetClass)]
      : [];

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

  async searchBrokerAssets(
    query: string,
    limit: number = 20
  ): Promise<BrokerAsset[]> {
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

  async upsertOrderByBrokerOrderId(
    brokerOrderId: string,
    data: Partial<InsertOrderInput>
  ): Promise<Order> {
    const existing = await this.getOrderByBrokerOrderId(brokerOrderId);
    if (existing) {
      const [updated] = await db
        .update(orders)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(orders.brokerOrderId, brokerOrderId))
        .returning();
      return updated;
    }
    try {
      const [created] = await db
        .insert(orders)
        .values({ ...data, brokerOrderId } as any)
        .returning();
      return created;
    } catch (error: any) {
      if (error.code === "23505" || error.message?.includes("duplicate")) {
        const [updated] = await db
          .update(orders)
          .set({ ...data, updatedAt: new Date() } as any)
          .where(eq(orders.brokerOrderId, brokerOrderId))
          .returning();
        return updated;
      }
      throw error;
    }
  }

  async getOrderByBrokerOrderId(
    brokerOrderId: string
  ): Promise<Order | undefined> {
    const [result] = await db
      .select()
      .from(orders)
      .where(eq(orders.brokerOrderId, brokerOrderId))
      .limit(1);
    return result;
  }

  async getOrderByClientOrderId(
    clientOrderId: string
  ): Promise<Order | undefined> {
    const [result] = await db
      .select()
      .from(orders)
      .where(eq(orders.clientOrderId, clientOrderId))
      .limit(1);
    return result;
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [result] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);
    return result;
  }

  async getOrdersByStatus(
    userId: string,
    status: string,
    limit = 100
  ): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.status, status)))
      .limit(limit)
      .orderBy(desc(orders.createdAt));
  }

  async getRecentOrders(userId?: string, limit = 50): Promise<Order[]> {
    if (userId) {
      return db
        .select()
        .from(orders)
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt))
        .limit(limit);
    }
    return db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }

  /**
   * Get orders by strategy ID
   * NOTE: This is a stub implementation - orders table doesn't have strategyId column yet.
   * TODO: Add strategyId column to orders schema and implement proper query
   */
  async getOrdersByStrategy(
    _strategyId: string,
    _limit = 50
  ): Promise<Order[]> {
    // Stub implementation - orders are not currently linked to strategies in the database
    // This requires adding a strategyId column to the orders table
    return [];
  }

  async createFill(fill: InsertFill): Promise<Fill> {
    const [result] = await db.insert(fills).values(fill).returning();
    return result;
  }

  async getFillsByOrderId(orderId: string): Promise<Fill[]> {
    return db
      .select()
      .from(fills)
      .where(eq(fills.orderId, orderId))
      .orderBy(desc(fills.occurredAt));
  }

  async getFillsByOrderIds(orderIds: string[]): Promise<Fill[]> {
    if (orderIds.length === 0) return [];
    return db
      .select()
      .from(fills)
      .where(inArray(fills.orderId, orderIds))
      .orderBy(desc(fills.occurredAt));
  }

  async getFillsByBrokerOrderId(brokerOrderId: string): Promise<Fill[]> {
    return db
      .select()
      .from(fills)
      .where(eq(fills.brokerOrderId, brokerOrderId))
      .orderBy(desc(fills.occurredAt));
  }

  // ============================================================================
  // DEBATE ARENA
  // ============================================================================

  async createDebateSession(
    session: InsertDebateSession
  ): Promise<DebateSession> {
    const [result] = await db
      .insert(debateSessions)
      .values(session as any)
      .returning();
    return result;
  }

  async getDebateSession(id: string): Promise<DebateSession | undefined> {
    const [result] = await db
      .select()
      .from(debateSessions)
      .where(eq(debateSessions.id, id));
    return result;
  }

  async getDebateSessions(limit = 50): Promise<DebateSession[]> {
    return db
      .select()
      .from(debateSessions)
      .orderBy(desc(debateSessions.createdAt))
      .limit(limit);
  }

  async updateDebateSession(
    id: string,
    updates: Partial<InsertDebateSession>
  ): Promise<DebateSession | undefined> {
    const [result] = await db
      .update(debateSessions)
      .set(updates as any)
      .where(eq(debateSessions.id, id))
      .returning();
    return result;
  }

  async createDebateMessage(
    message: InsertDebateMessage
  ): Promise<DebateMessage> {
    const [result] = await db
      .insert(debateMessages)
      .values(message as any)
      .returning();
    return result;
  }

  async getDebateMessagesBySession(
    sessionId: string
  ): Promise<DebateMessage[]> {
    return db
      .select()
      .from(debateMessages)
      .where(eq(debateMessages.sessionId, sessionId))
      .orderBy(debateMessages.createdAt);
  }

  async createDebateConsensus(
    consensus: InsertDebateConsensus
  ): Promise<DebateConsensus> {
    const [result] = await db
      .insert(debateConsensus)
      .values(consensus)
      .returning();
    return result;
  }

  async getDebateConsensusBySession(
    sessionId: string
  ): Promise<DebateConsensus | undefined> {
    const [result] = await db
      .select()
      .from(debateConsensus)
      .where(eq(debateConsensus.sessionId, sessionId));
    return result;
  }

  async updateDebateConsensus(
    id: string,
    updates: Partial<InsertDebateConsensus>
  ): Promise<DebateConsensus | undefined> {
    const [result] = await db
      .update(debateConsensus)
      .set(updates)
      .where(eq(debateConsensus.id, id))
      .returning();
    return result;
  }

  // ============================================================================
  // TRADER PROFILES & COMPETITION
  // ============================================================================

  async createTraderProfile(
    profile: InsertTraderProfile
  ): Promise<TraderProfile> {
    const [result] = await db
      .insert(traderProfiles)
      .values(profile as any)
      .returning();
    return result;
  }

  async getTraderProfile(id: string): Promise<TraderProfile | undefined> {
    const [result] = await db
      .select()
      .from(traderProfiles)
      .where(eq(traderProfiles.id, id));
    return result;
  }

  async getTraderProfiles(): Promise<TraderProfile[]> {
    return db
      .select()
      .from(traderProfiles)
      .orderBy(desc(traderProfiles.createdAt));
  }

  async updateTraderProfile(
    id: string,
    updates: Partial<InsertTraderProfile>
  ): Promise<TraderProfile | undefined> {
    const [result] = await db
      .update(traderProfiles)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(traderProfiles.id, id))
      .returning();
    return result;
  }

  async createCompetitionRun(
    run: InsertCompetitionRun
  ): Promise<CompetitionRun> {
    const [result] = await db
      .insert(competitionRuns)
      .values(run as any)
      .returning();
    return result;
  }

  async getCompetitionRun(id: string): Promise<CompetitionRun | undefined> {
    const [result] = await db
      .select()
      .from(competitionRuns)
      .where(eq(competitionRuns.id, id));
    return result;
  }

  async getCompetitionRuns(limit = 20): Promise<CompetitionRun[]> {
    return db
      .select()
      .from(competitionRuns)
      .orderBy(desc(competitionRuns.createdAt))
      .limit(limit);
  }

  async updateCompetitionRun(
    id: string,
    updates: Partial<InsertCompetitionRun>
  ): Promise<CompetitionRun | undefined> {
    const [result] = await db
      .update(competitionRuns)
      .set(updates as any)
      .where(eq(competitionRuns.id, id))
      .returning();
    return result;
  }

  async createCompetitionScore(
    score: InsertCompetitionScore
  ): Promise<CompetitionScore> {
    const [result] = await db
      .insert(competitionScores)
      .values(score)
      .returning();
    return result;
  }

  async getCompetitionScoresByRun(runId: string): Promise<CompetitionScore[]> {
    return db
      .select()
      .from(competitionScores)
      .where(eq(competitionScores.runId, runId))
      .orderBy(competitionScores.rank);
  }

  async updateCompetitionScore(
    id: string,
    updates: Partial<InsertCompetitionScore>
  ): Promise<CompetitionScore | undefined> {
    const [result] = await db
      .update(competitionScores)
      .set(updates)
      .where(eq(competitionScores.id, id))
      .returning();
    return result;
  }

  // ============================================================================
  // STRATEGY VERSIONS
  // ============================================================================

  async createStrategyVersion(
    version: InsertStrategyVersion
  ): Promise<StrategyVersion> {
    const [result] = await db
      .insert(strategyVersions)
      .values(version as any)
      .returning();
    return result;
  }

  async getStrategyVersion(id: string): Promise<StrategyVersion | undefined> {
    const [result] = await db
      .select()
      .from(strategyVersions)
      .where(eq(strategyVersions.id, id));
    return result;
  }

  async getStrategyVersionsByStrategy(
    strategyId: string
  ): Promise<StrategyVersion[]> {
    return db
      .select()
      .from(strategyVersions)
      .where(eq(strategyVersions.strategyId, strategyId))
      .orderBy(desc(strategyVersions.version));
  }

  async getLatestStrategyVersion(
    strategyId: string
  ): Promise<StrategyVersion | undefined> {
    const [result] = await db
      .select()
      .from(strategyVersions)
      .where(eq(strategyVersions.strategyId, strategyId))
      .orderBy(desc(strategyVersions.version))
      .limit(1);
    return result;
  }

  async getNextVersionNumber(strategyId: string): Promise<number> {
    const latest = await this.getLatestStrategyVersion(strategyId);
    return (latest?.version || 0) + 1;
  }

  async updateStrategyVersion(
    id: string,
    updates: Partial<InsertStrategyVersion>
  ): Promise<StrategyVersion | undefined> {
    const [result] = await db
      .update(strategyVersions)
      .set(updates as any)
      .where(eq(strategyVersions.id, id))
      .returning();
    return result;
  }

  async getActiveStrategyVersions(): Promise<StrategyVersion[]> {
    return db
      .select()
      .from(strategyVersions)
      .where(eq(strategyVersions.status, "active"))
      .orderBy(strategyVersions.createdAt);
  }

  // ============================================================================
  // TOOL INVOCATIONS
  // ============================================================================

  async createToolInvocation(
    invocation: InsertToolInvocation
  ): Promise<ToolInvocation> {
    const [result] = await db
      .insert(toolInvocations)
      .values(invocation as any)
      .returning();
    return result;
  }

  async updateToolInvocation(
    id: string,
    updates: Partial<InsertToolInvocation>
  ): Promise<ToolInvocation | undefined> {
    const [result] = await db
      .update(toolInvocations)
      .set(updates as any)
      .where(eq(toolInvocations.id, id))
      .returning();
    return result;
  }

  async getToolInvocationsByTrace(traceId: string): Promise<ToolInvocation[]> {
    return db
      .select()
      .from(toolInvocations)
      .where(eq(toolInvocations.traceId, traceId))
      .orderBy(toolInvocations.createdAt);
  }

  async getToolInvocationsBySession(
    sessionId: string
  ): Promise<ToolInvocation[]> {
    return db
      .select()
      .from(toolInvocations)
      .where(eq(toolInvocations.debateSessionId, sessionId))
      .orderBy(toolInvocations.createdAt);
  }

  async getRecentToolInvocations(limit = 100): Promise<ToolInvocation[]> {
    return db
      .select()
      .from(toolInvocations)
      .orderBy(desc(toolInvocations.createdAt))
      .limit(limit);
  }

  // ============================================================================
  // AUDIT LOGGING
  // ============================================================================

  async createAuditLog(logEntry: InsertAuditLog): Promise<AuditLog> {
    try {
      const [result] = await db.insert(auditLogs).values(logEntry).returning();
      return result;
    } catch (error) {
      log.error("Storage", "Failed to create audit log", { error });
      throw error;
    }
  }

  async getUserAuditLogs(
    userId: string,
    limit = 100,
    offset = 0
  ): Promise<AuditLog[]> {
    try {
      return db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, userId))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      log.error("Storage", "Failed to get user audit logs", { error, userId });
      return [];
    }
  }

  async getResourceAuditLogs(
    resource: string,
    resourceId: string,
    limit = 50
  ): Promise<AuditLog[]> {
    try {
      return db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.resource, resource),
            eq(auditLogs.resourceId, resourceId)
          )
        )
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);
    } catch (error) {
      log.error("Storage", "Failed to get resource audit logs", {
        error,
        resource,
        resourceId,
      });
      return [];
    }
  }

  async getRecentAuditLogs(limit = 100, offset = 0): Promise<AuditLog[]> {
    try {
      return db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      log.error("Storage", "Failed to get recent audit logs", { error });
      return [];
    }
  }
}

export const storage = new DatabaseStorage();
