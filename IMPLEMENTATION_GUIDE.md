# Quick Implementation Guide - Database Security Fixes

## File 1: `/shared/schema.ts` - Add userId columns

### trades table (line ~29)
```typescript
export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),  // ADD
  strategyId: varchar("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  quantity: numeric("quantity").notNull(),
  price: numeric("price").notNull(),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  pnl: numeric("pnl"),
  status: text("status").default("completed").notNull(),
  notes: text("notes"),
  traceId: text("trace_id"),
}, (table) => [
  index("trades_user_id_idx").on(table.userId),  // ADD INDEX
]);
```

### positions table (line ~46)
```typescript
export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),  // ADD
  symbol: text("symbol").notNull(),
  quantity: numeric("quantity").notNull(),
  entryPrice: numeric("entry_price").notNull(),
  currentPrice: numeric("current_price"),
  unrealizedPnl: numeric("unrealized_pnl"),
  side: text("side").notNull(),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  strategyId: varchar("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
}, (table) => [
  index("positions_user_id_idx").on(table.userId),  // ADD INDEX
]);
```

### aiDecisions table (line ~60)
```typescript
export const aiDecisions = pgTable("ai_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),  // ADD
  strategyId: varchar("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
  symbol: text("symbol").notNull(),
  action: text("action").notNull(),
  confidence: numeric("confidence"),
  reasoning: text("reasoning"),
  marketContext: text("market_context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  executedTradeId: varchar("executed_trade_id").references(() => trades.id, { onDelete: "set null" }),
  status: text("status").default("pending").notNull(),
  stopLoss: numeric("stop_loss"),
  takeProfit: numeric("take_profit"),
  entryPrice: numeric("entry_price"),
  filledPrice: numeric("filled_price"),
  filledAt: timestamp("filled_at"),
  skipReason: text("skip_reason"),
  traceId: text("trace_id"),
  metadata: text("metadata"),
}, (table) => [
  index("ai_decisions_user_id_idx").on(table.userId),  // ADD INDEX
]);
```

### orders table (line ~673)
Find the orders table and add userId as the second field:
```typescript
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),  // ADD THIS LINE
  broker: text("broker").notNull(),
  // ... rest remains the same
}, (table) => [
  index("orders_user_id_idx").on(table.userId),  // ADD TO BEGINNING OF INDEX ARRAY
  index("orders_broker_order_id_idx").on(table.brokerOrderId),
  // ... rest of indexes
]);
```

---

## File 2: `/server/storage.ts` - Update storage functions

### Update interface (line ~84)
```typescript
export interface IStorage {
  // ... existing methods

  // CHANGE THESE:
  getPositions(userId: string): Promise<Position[]>;  // ADD userId parameter
  getTrades(userId: string, limit?: number): Promise<Trade[]>;  // ADD userId parameter
  getTradesFiltered(userId: string, filters: TradeFilters): Promise<{ trades: EnrichedTrade[]; total: number }>;  // ADD userId
  getAiDecisions(userId: string, limit?: number): Promise<AiDecision[]>;  // ADD userId parameter
  createPosition(userId: string, position: InsertPosition): Promise<Position>;  // ADD userId
  createTrade(userId: string, trade: InsertTrade): Promise<Trade>;  // ADD userId
  createAiDecision(userId: string, decision: InsertAiDecision): Promise<AiDecision>;  // ADD userId
  createOrder(userId: string, order: InsertOrder): Promise<Order>;  // ADD userId
  getRecentOrders(userId: string, limit?: number): Promise<Order[]>;  // ADD userId
  syncPositionsFromAlpaca(userId: string, alpacaPositions: Array<...>): Promise<Position[]>;  // ADD userId
}
```

### Fix getPositions (line ~314)
```typescript
async getPositions(userId: string): Promise<Position[]> {
  return db.select()
    .from(positions)
    .where(eq(positions.userId, userId))  // ADD THIS LINE
    .orderBy(desc(positions.openedAt));
}
```

### Fix getTrades (line ~185)
```typescript
async getTrades(userId: string, limit: number = 50): Promise<Trade[]> {
  return db.select()
    .from(trades)
    .where(eq(trades.userId, userId))  // ADD THIS LINE
    .orderBy(desc(trades.executedAt))
    .limit(limit);
}
```

### Fix getTradesFiltered (line ~189) - FIXES N+1 QUERY!
```typescript
async getTradesFiltered(userId: string, filters: TradeFilters): Promise<{ trades: EnrichedTrade[]; total: number }> {
  // Build conditions array starting with userId
  const conditions: any[] = [eq(trades.userId, userId)];  // ADD userId FIRST

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

  // Count query
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(trades)
    .where(whereClause);
  const total = Number(countResult[0]?.count ?? 0);

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  // OPTIMIZED: Use JOINs instead of separate queries (N+1 fix!)
  const results = await db
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

  // Map results
  const enrichedTrades: EnrichedTrade[] = results.map(({ trade, strategy, aiDecision }) => ({
    ...trade,
    strategyName: strategy?.name ?? null,
    aiDecision: aiDecision ?? null,
  }));

  return { trades: enrichedTrades, total };
}
```

### Fix getAiDecisions (line ~374)
```typescript
async getAiDecisions(userId: string, limit: number = 20): Promise<AiDecision[]> {
  return db.select()
    .from(aiDecisions)
    .where(eq(aiDecisions.userId, userId))  // ADD THIS LINE
    .orderBy(desc(aiDecisions.createdAt))
    .limit(limit);
}
```

### Fix createPosition (line ~323)
```typescript
async createPosition(userId: string, insertPosition: InsertPosition): Promise<Position> {
  const [position] = await db.insert(positions)
    .values({ ...insertPosition, userId })  // ADD userId
    .returning();
  return position;
}
```

### Fix createTrade (line ~292)
```typescript
async createTrade(userId: string, insertTrade: InsertTrade): Promise<Trade> {
  const [trade] = await db.insert(trades)
    .values({ ...insertTrade, userId })  // ADD userId
    .returning();
  return trade;
}
```

### Fix createAiDecision (line ~378)
```typescript
async createAiDecision(userId: string, insertDecision: InsertAiDecision): Promise<AiDecision> {
  const [decision] = await db.insert(aiDecisions)
    .values({ ...insertDecision, userId })  // ADD userId
    .returning();
  return decision;
}
```

### Fix createOrder (line ~640)
```typescript
async createOrder(userId: string, order: InsertOrder): Promise<Order> {
  const [result] = await db.insert(orders)
    .values({ ...order, userId })  // ADD userId
    .returning();
  return result;
}
```

### Fix getRecentOrders (line ~683)
```typescript
async getRecentOrders(userId: string, limit = 50): Promise<Order[]> {
  return db.select()
    .from(orders)
    .where(eq(orders.userId, userId))  // ADD THIS LINE
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}
```

### Fix syncPositionsFromAlpaca (line ~347) - ADD TRANSACTION!
```typescript
async syncPositionsFromAlpaca(userId: string, alpacaPositions: Array<{
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  unrealized_pl: string;
  side: string;
}>): Promise<Position[]> {
  // WRAP IN TRANSACTION for atomicity
  return await db.transaction(async (tx) => {
    // Delete only this user's positions
    await tx.delete(positions).where(eq(positions.userId, userId));

    if (alpacaPositions.length === 0) {
      return [];
    }

    const positionsToInsert = alpacaPositions.map(pos => ({
      userId,  // ADD userId
      symbol: pos.symbol,
      quantity: pos.qty,
      entryPrice: pos.avg_entry_price,
      currentPrice: pos.current_price,
      unrealizedPnl: pos.unrealized_pl,
      side: pos.side === "long" ? "long" : "short",
    }));

    const insertedPositions = await tx.insert(positions)
      .values(positionsToInsert)
      .returning();

    return insertedPositions;
  });
}
```

### Fix deletePosition (line ~337)
```typescript
async deletePosition(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(positions)
    .where(and(
      eq(positions.id, id),
      eq(positions.userId, userId)  // ADD userId check
    ))
    .returning();
  return result.length > 0;
}
```

### Fix updatePosition (line ~328)
```typescript
async updatePosition(userId: string, id: string, updates: Partial<InsertPosition>): Promise<Position | undefined> {
  const [position] = await db
    .update(positions)
    .set(updates)
    .where(and(
      eq(positions.id, id),
      eq(positions.userId, userId)  // ADD userId check
    ))
    .returning();
  return position;
}
```

---

## File 3: `/server/routes.ts` - Update route handlers

Find all route handlers that use storage functions and add `req.userId!`:

### Positions routes
```typescript
// GET /api/positions
app.get("/api/positions", authMiddleware, async (req, res) => {
  const positions = await storage.getPositions(req.userId!);  // ADD req.userId!
  res.json(positions);
});

// POST /api/positions
app.post("/api/positions", authMiddleware, async (req, res) => {
  const position = await storage.createPosition(req.userId!, req.body);  // ADD req.userId!
  res.json(position);
});

// DELETE /api/positions/:id
app.delete("/api/positions/:id", authMiddleware, async (req, res) => {
  const success = await storage.deletePosition(req.userId!, req.params.id);  // ADD req.userId!
  res.json({ success });
});
```

### Trades routes
```typescript
// GET /api/trades
app.get("/api/trades", authMiddleware, async (req, res) => {
  const trades = await storage.getTrades(req.userId!);  // ADD req.userId!
  res.json(trades);
});

// POST /api/trades (if exists)
app.post("/api/trades", authMiddleware, async (req, res) => {
  const trade = await storage.createTrade(req.userId!, req.body);  // ADD req.userId!
  res.json(trade);
});
```

### AI Decisions routes
```typescript
// GET /api/ai-decisions
app.get("/api/ai-decisions", authMiddleware, async (req, res) => {
  const decisions = await storage.getAiDecisions(req.userId!);  // ADD req.userId!
  res.json(decisions);
});

// POST /api/ai-decisions (if exists)
app.post("/api/ai-decisions", authMiddleware, async (req, res) => {
  const decision = await storage.createAiDecision(req.userId!, req.body);  // ADD req.userId!
  res.json(decision);
});
```

### Orders routes
```typescript
// GET /api/orders
app.get("/api/orders", authMiddleware, async (req, res) => {
  const orders = await storage.getRecentOrders(req.userId!);  // ADD req.userId!
  res.json(orders);
});

// POST /api/orders (if exists)
app.post("/api/orders", authMiddleware, async (req, res) => {
  const order = await storage.createOrder(req.userId!, req.body);  // ADD req.userId!
  res.json(order);
});
```

---

## Search and Replace Guide

Use these patterns to find all locations that need updating:

### Find storage calls without userId:
```bash
grep -r "storage\.getPositions()" server/
grep -r "storage\.getTrades()" server/
grep -r "storage\.getAiDecisions()" server/
grep -r "storage\.createPosition(" server/
grep -r "storage\.createTrade(" server/
grep -r "storage\.createOrder(" server/
grep -r "storage\.deletePosition(" server/
grep -r "storage\.getRecentOrders()" server/
```

### Test the changes:
```bash
# Run TypeScript compiler
npm run build

# If errors about userId missing, that's where you need to add it!
```

---

## Migration Steps

1. **Stop the server** (tsx watch process)
2. **Backup database**: `pg_dump $DATABASE_URL > backup.sql`
3. **Run migration**: `psql $DATABASE_URL -f migrations/001_add_user_isolation_and_transactions.sql`
4. **Update schema.ts** with userId columns
5. **Update storage.ts** with userId parameters
6. **Update routes.ts** to pass req.userId
7. **Test compilation**: `npm run build`
8. **Restart server**
9. **Test with multiple users**

---

## Verification

After implementation, verify:

```sql
-- Check all tables have userId
SELECT COUNT(*) FROM trades WHERE user_id IS NULL;  -- Should be 0
SELECT COUNT(*) FROM positions WHERE user_id IS NULL;  -- Should be 0
SELECT COUNT(*) FROM ai_decisions WHERE user_id IS NULL;  -- Should be 0
SELECT COUNT(*) FROM orders WHERE user_id IS NULL;  -- Should be 0

-- Check indexes exist
SELECT tablename, indexname FROM pg_indexes
WHERE tablename IN ('trades', 'positions', 'ai_decisions', 'orders')
AND indexname LIKE '%user_id%';
```

**Expected output:** 4+ indexes with user_id
