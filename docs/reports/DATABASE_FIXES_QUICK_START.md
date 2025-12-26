# Database Layer - Critical Fixes Quick Start Guide

This is a condensed action plan for immediate database fixes. See `DATABASE_COMPREHENSIVE_TEST_REPORT.md` for full analysis.

---

## CRITICAL: Do These First (Today)

### 1. Fix Foreign Key Cascades (2 hours)

**File:** `/home/runner/workspace/shared/schema.ts`

**Problem:** All 43 foreign keys are missing cascade behavior, causing orphaned records.

**Fix Pattern:**
```typescript
// BEFORE (WRONG):
strategyId: varchar("strategy_id").references(() => strategies.id)

// AFTER (CORRECT):
strategyId: varchar("strategy_id").references(() => strategies.id, {
  onDelete: "cascade",
  onUpdate: "cascade"
})
```

**Apply to these lines in schema.ts:**
- Line 33: `trades.strategyId`
- Line 34: `trades.orderId`
- Line 57: `positions.strategyId`
- Line 64: `ai_decisions.strategyId`
- Line 71: `ai_decisions.executedTradeId`
- Line 114: `ai_decision_features.decisionId`
- Line 137: `ai_trade_outcomes.decisionId`
- Line 138: `ai_trade_outcomes.tradeId`
- Line 156: `ai_trade_outcomes.strategyId`
- Line 231: `data_source_analysis.decisionId`
- Line 315: `analysis_feedback.dataSourceAnalysisId`
- Line 316: `analysis_feedback.tradeOutcomeId`
- Line 572: `work_items.decisionId`
- Line 584: `work_item_runs.workItemId`
- Line 701: `orders.decisionId`
- Line 702: `orders.tradeIntentId`
- Line 703: `orders.workItemId`
- Line 722: `fills.orderId`
- Line 767: `backtest_runs.strategyId`
- Line 794: `backtest_trade_events.runId`
- Line 816: `backtest_equity_curve.runId`
- Line 871: `admin_settings.updatedBy`
- Line 1089: `universe_candidates.approvedBy`
- Line 1115: `allocation_policies.createdBy`
- Line 1126: `rebalance_runs.policyId`
- Line 1239: `alert_events.ruleId`
- Line 1277: `audit_logs.userId`
- Line 1338: `debate_messages.sessionId`
- Line 1364: `debate_consensus.sessionId`
- Line 1371: `debate_consensus.workItemId`
- Line 1430: `competition_scores.runId`
- Line 1431: `competition_scores.traderProfileId`
- Line 1460: `strategy_versions.strategyId`
- Line 1502: `tool_invocations.debateSessionId`
- Line 1560: `ai_outcome_links.consensusId`
- Line 1561: `ai_outcome_links.debateSessionId`
- Line 1562: `ai_outcome_links.decisionId`
- Line 1563: `ai_outcome_links.workItemId`
- Line 1610: `ai_arena_runs.strategyVersionId`
- Line 1642: `ai_arena_agent_decisions.arenaRunId`
- Line 1643: `ai_arena_agent_decisions.agentProfileId`

**After changes, run:**
```bash
npm run db:push  # or your migration command
```

---

### 2. Fix N+1 Query Problem (30 minutes)

**File:** `/home/runner/workspace/server/storage.ts`

**Problem:** Lines 233-256 make 50+ individual queries instead of 1 query with joins.

**Replace getTradesFiltered method:**

```typescript
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

  // Count total
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(trades)
    .where(whereClause);
  const total = Number(countResult[0]?.count ?? 0);

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  // FIXED: Use LEFT JOIN to get everything in ONE query
  const results = await db
    .select({
      // Trade fields
      id: trades.id,
      strategyId: trades.strategyId,
      orderId: trades.orderId,
      symbol: trades.symbol,
      side: trades.side,
      quantity: trades.quantity,
      price: trades.price,
      executedAt: trades.executedAt,
      pnl: trades.pnl,
      status: trades.status,
      notes: trades.notes,
      traceId: trades.traceId,
      // AI Decision (if exists)
      aiDecisionId: aiDecisions.id,
      aiDecisionSymbol: aiDecisions.symbol,
      aiDecisionAction: aiDecisions.action,
      aiDecisionConfidence: aiDecisions.confidence,
      aiDecisionReasoning: aiDecisions.reasoning,
      // Strategy name (if exists)
      strategyName: strategies.name,
    })
    .from(trades)
    .leftJoin(aiDecisions, eq(aiDecisions.executedTradeId, trades.id))
    .leftJoin(strategies, eq(strategies.id, trades.strategyId))
    .where(whereClause)
    .orderBy(desc(trades.executedAt))
    .limit(limit)
    .offset(offset);

  // Transform to EnrichedTrade format
  const enrichedTrades: EnrichedTrade[] = results.map((row) => ({
    id: row.id,
    strategyId: row.strategyId,
    orderId: row.orderId,
    symbol: row.symbol,
    side: row.side,
    quantity: row.quantity,
    price: row.price,
    executedAt: row.executedAt,
    pnl: row.pnl,
    status: row.status,
    notes: row.notes,
    traceId: row.traceId,
    aiDecision: row.aiDecisionId ? {
      id: row.aiDecisionId,
      symbol: row.aiDecisionSymbol!,
      action: row.aiDecisionAction!,
      confidence: row.aiDecisionConfidence,
      reasoning: row.aiDecisionReasoning,
      // ... add other fields as needed
    } : null,
    strategyName: row.strategyName,
  }));

  return { trades: enrichedTrades, total };
}
```

**Same fix for getEnrichedTrade (lines 266-290).**

---

### 3. Add Transaction to syncPositionsFromAlpaca (20 minutes)

**File:** `/home/runner/workspace/server/storage.ts`

**Problem:** Lines 347-372 delete all positions, then insert. If insert fails, all positions are lost!

**Replace method:**

```typescript
async syncPositionsFromAlpaca(alpacaPositions: Array<{
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  unrealized_pl: string;
  side: string;
}>): Promise<Position[]> {
  // Wrap in transaction for atomicity
  return await db.transaction(async (tx) => {
    // Delete within transaction
    await tx.delete(positions);

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

    // Insert within transaction
    const insertedPositions = await tx
      .insert(positions)
      .values(positionsToInsert)
      .returning();

    // Auto-commit if successful, auto-rollback if error
    return insertedPositions;
  });
}
```

---

## HIGH PRIORITY: Do These Next (This Week)

### 4. Add Missing Indexes (1 hour)

**Create new migration file:** `db/migrations/add_critical_indexes.sql`

```sql
-- trades table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_strategy_id ON trades(strategy_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_order_id ON trades(order_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_executed_at ON trades(executed_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_strategy_executed ON trades(strategy_id, executed_at);

-- positions table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_strategy_id ON positions(strategy_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_opened_at ON positions(opened_at);

-- ai_decisions table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_decisions_strategy_id ON ai_decisions(strategy_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_decisions_symbol ON ai_decisions(symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_decisions_status ON ai_decisions(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_decisions_created_at ON ai_decisions(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_decisions_status_created ON ai_decisions(status, created_at);

-- strategies table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_strategies_is_active ON strategies(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_strategies_type ON strategies(type);
```

Run with:
```bash
psql $DATABASE_URL -f db/migrations/add_critical_indexes.sql
```

---

### 5. Add Input Validation (2 hours)

**File:** `/home/runner/workspace/server/storage.ts`

**Add validation helper:**

```typescript
import { ZodSchema } from 'zod';

private validate<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}
```

**Update all create methods:**

```typescript
async createUser(insertUser: InsertUser): Promise<User> {
  // Add validation
  const validated = this.validate(insertUserSchema, insertUser);

  // Business rules
  if (validated.username.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }

  const [user] = await db.insert(users).values(validated).returning();
  return user;
}

async createTrade(insertTrade: InsertTrade): Promise<Trade> {
  // Add validation
  const validated = this.validate(insertTradeSchema, insertTrade);

  // Business rules
  const qty = Number(validated.quantity);
  const price = Number(validated.price);

  if (qty <= 0) {
    throw new Error('Quantity must be positive');
  }

  if (price <= 0) {
    throw new Error('Price must be positive');
  }

  const [trade] = await db.insert(trades).values(validated).returning();
  return trade;
}

// Apply same pattern to all create/update methods
```

---

### 6. Add Error Handling (2 hours)

**Create error classes:**

```typescript
// server/errors/database-errors.ts
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, undefined, context);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DatabaseError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, undefined, { resource, id });
    this.name = 'NotFoundError';
  }
}
```

**Update all methods with try-catch:**

```typescript
async getUser(id: string): Promise<User | undefined> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  } catch (error) {
    console.error('[Storage] Failed to get user', { userId: id, error });
    throw new DatabaseError('Failed to retrieve user', error, { userId: id });
  }
}

async createTrade(insertTrade: InsertTrade): Promise<Trade> {
  try {
    const validated = this.validate(insertTradeSchema, insertTrade);
    const [trade] = await db.insert(trades).values(validated).returning();
    return trade;
  } catch (error) {
    console.error('[Storage] Failed to create trade', { error });
    throw new DatabaseError('Failed to create trade', error);
  }
}
```

---

### 7. Fix Bulk Operations (1 hour)

**File:** `/home/runner/workspace/server/storage.ts`

**Replace bulkUpsertBrokerAssets (lines 589-602):**

```typescript
async bulkUpsertBrokerAssets(assets: InsertBrokerAsset[]): Promise<number> {
  if (assets.length === 0) return 0;

  return await db.transaction(async (tx) => {
    // PostgreSQL's ON CONFLICT for true bulk upsert
    await tx.insert(brokerAssets)
      .values(assets.map(a => ({ ...a, symbol: a.symbol.toUpperCase() })))
      .onConflictDoUpdate({
        target: brokerAssets.symbol,
        set: {
          alpacaId: sql`EXCLUDED.alpaca_id`,
          name: sql`EXCLUDED.name`,
          assetClass: sql`EXCLUDED.asset_class`,
          exchange: sql`EXCLUDED.exchange`,
          status: sql`EXCLUDED.status`,
          tradable: sql`EXCLUDED.tradable`,
          marginable: sql`EXCLUDED.marginable`,
          shortable: sql`EXCLUDED.shortable`,
          easyToBorrow: sql`EXCLUDED.easy_to_borrow`,
          fractionable: sql`EXCLUDED.fractionable`,
          minOrderSize: sql`EXCLUDED.min_order_size`,
          minTradeIncrement: sql`EXCLUDED.min_trade_increment`,
          priceIncrement: sql`EXCLUDED.price_increment`,
          updatedAt: new Date(),
          lastSyncedAt: new Date(),
        },
      });

    return assets.length;
  });
}
```

---

### 8. Add Graceful Shutdown (15 minutes)

**File:** `/home/runner/workspace/server/db.ts`

**Add shutdown handler:**

```typescript
// Add export function
export async function closePool() {
  try {
    console.log('[DB Pool] Closing connection pool...');
    await pool.end();
    console.log('[DB Pool] Closed gracefully');
  } catch (error) {
    console.error('[DB Pool] Error closing pool:', error);
    throw error;
  }
}
```

**File:** `/home/runner/workspace/server/index.ts`

**Add at the end:**

```typescript
import { closePool } from './db';

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  try {
    // Close database connections
    await closePool();

    // Close HTTP server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

---

## MEDIUM PRIORITY: Do These Soon (Next Sprint)

### 9. Add Unique Constraints

**Migration file:** `db/migrations/add_unique_constraints.sql`

```sql
-- Only one position per symbol
ALTER TABLE positions ADD CONSTRAINT positions_symbol_unique UNIQUE(symbol);

-- Only one agent_status record
-- (First, ensure only one exists)
DELETE FROM agent_status WHERE id NOT IN (
  SELECT MIN(id) FROM agent_status
);
ALTER TABLE agent_status ADD CONSTRAINT agent_status_singleton CHECK (id = (SELECT MIN(id) FROM agent_status));
```

---

### 10. Add Audit Logging

**Update all mutation methods:**

```typescript
async createStrategy(insertStrategy: InsertStrategy): Promise<Strategy> {
  const validated = this.validate(insertStrategySchema, insertStrategy);

  const [strategy] = await db.insert(strategies).values(validated).returning();

  // Add audit log
  await this.createAuditLog({
    action: 'create',
    resource: 'strategies',
    resourceId: strategy.id,
    method: 'POST',
    path: '/api/strategies',
  });

  return strategy;
}
```

---

## Testing Checklist

After making changes, run these tests:

### 1. Foreign Key Cascade Test
```typescript
// Test that deleting strategy cascades to trades
const strategy = await storage.createStrategy({...});
const trade = await storage.createTrade({ strategyId: strategy.id, ... });

await db.delete(strategies).where(eq(strategies.id, strategy.id));

const orphaned = await storage.getTrade(trade.id);
console.assert(!orphaned, 'Trade should be deleted');
```

### 2. N+1 Query Test
```typescript
// Monitor query count
let queryCount = 0;
const originalQuery = db.execute;
db.execute = (...args) => {
  queryCount++;
  return originalQuery.apply(db, args);
};

await storage.getTradesFiltered({ limit: 50 });

console.assert(queryCount <= 3, `Should be max 3 queries, got ${queryCount}`);
```

### 3. Transaction Rollback Test
```typescript
const countBefore = (await storage.getPositions()).length;

try {
  // This should fail and rollback
  await storage.syncPositionsFromAlpaca([{ /* invalid */ }]);
} catch (error) {
  // Expected
}

const countAfter = (await storage.getPositions()).length;
console.assert(countBefore === countAfter, 'Positions should be unchanged');
```

### 4. Performance Test
```bash
# Before fixes
time curl http://localhost:3000/api/trades?limit=100

# After fixes (should be 50-100x faster)
time curl http://localhost:3000/api/trades?limit=100
```

---

## Monitoring After Deployment

Add these monitoring queries:

```sql
-- Check for orphaned records
SELECT
  (SELECT COUNT(*) FROM trades t
   LEFT JOIN strategies s ON t.strategy_id = s.id
   WHERE t.strategy_id IS NOT NULL AND s.id IS NULL) as orphaned_trades,

  (SELECT COUNT(*) FROM ai_decisions ad
   LEFT JOIN strategies s ON ad.strategy_id = s.id
   WHERE ad.strategy_id IS NOT NULL AND s.id IS NULL) as orphaned_decisions;

-- Check connection pool health
SELECT
  numbackends as active_connections,
  xact_commit as transactions_committed,
  xact_rollback as transactions_rolled_back
FROM pg_stat_database
WHERE datname = current_database();

-- Check slow queries
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000  -- > 1 second
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Quick Reference

**Priority Order:**
1. Foreign key cascades (prevents data loss)
2. N+1 query fix (prevents performance issues)
3. Transaction support (prevents data loss)
4. Missing indexes (prevents slow queries)
5. Input validation (prevents bad data)
6. Error handling (better debugging)
7. Bulk operations (better performance)
8. Graceful shutdown (prevents connection leaks)

**Files to Change:**
- `/home/runner/workspace/shared/schema.ts` (cascades, indexes)
- `/home/runner/workspace/server/storage.ts` (queries, validation, transactions)
- `/home/runner/workspace/server/db.ts` (shutdown)
- `/home/runner/workspace/server/index.ts` (shutdown handlers)

**Estimated Total Time:** 8-10 hours spread over 3 days

**Risk Level of Changes:**
- Foreign keys: Medium (test thoroughly)
- N+1 fix: Low (performance only)
- Transactions: Low (adds safety)
- Indexes: Low (can run CONCURRENTLY)

---

See `DATABASE_COMPREHENSIVE_TEST_REPORT.md` for full details and additional fixes.
