# Code Optimization Recommendations

Specific code changes to improve performance after adding database indexes.

---

## 1. Add Response Compression

**File**: `/home/runner/workspace/server/index.ts`

**Current**:
```typescript
const app = express();

// No compression
```

**Optimized**:
```typescript
import compression from 'compression';

const app = express();

// Add compression middleware (BEFORE routes)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,  // Balance between speed and compression
  threshold: 1024,  // Only compress responses > 1KB
}));
```

**Install**:
```bash
npm install compression
npm install --save-dev @types/compression
```

**Impact**: 50-70% smaller payloads, faster transfers

---

## 2. Implement Query Caching

**File**: `/home/runner/workspace/server/storage.ts`

**Add at top**:
```typescript
import NodeCache from 'node-cache';

// Create cache instance
const queryCache = new NodeCache({
  stdTTL: 60,  // 60 second default TTL
  checkperiod: 120,  // Check for expired keys every 2 minutes
  useClones: false,  // Performance optimization (careful with mutations)
});

// Helper to generate cache keys
function getCacheKey(prefix: string, ...args: any[]): string {
  return `${prefix}:${args.join(':')}`;
}
```

**Wrap expensive queries**:

```typescript
// BEFORE:
async getAiDecisions(userId: string, limit: number = 50): Promise<AiDecision[]> {
  return db
    .select()
    .from(aiDecisions)
    .where(eq(aiDecisions.userId, userId))
    .orderBy(desc(aiDecisions.createdAt))
    .limit(limit);
}

// AFTER:
async getAiDecisions(userId: string, limit: number = 50): Promise<AiDecision[]> {
  const cacheKey = getCacheKey('ai_decisions', userId, limit);

  // Check cache first
  const cached = queryCache.get<AiDecision[]>(cacheKey);
  if (cached) {
    console.log(`[Cache HIT] ${cacheKey}`);
    return cached;
  }

  // Cache miss - query database
  console.log(`[Cache MISS] ${cacheKey}`);
  const result = await db
    .select()
    .from(aiDecisions)
    .where(eq(aiDecisions.userId, userId))
    .orderBy(desc(aiDecisions.createdAt))
    .limit(limit);

  // Store in cache
  queryCache.set(cacheKey, result, 60);  // 60 second TTL
  return result;
}
```

**Invalidate cache on writes**:
```typescript
async createAiDecision(decision: InsertAiDecision): Promise<AiDecision> {
  const [created] = await db.insert(aiDecisions).values(decision).returning();

  // Invalidate cache for this user
  const pattern = `ai_decisions:${decision.userId}:*`;
  const keys = queryCache.keys().filter(k => k.startsWith(`ai_decisions:${decision.userId}`));
  keys.forEach(key => queryCache.del(key));

  return created;
}
```

**Install**:
```bash
npm install node-cache
npm install --save-dev @types/node-cache
```

**Impact**: 2-5x improvement on repeated queries

---

## 3. Optimize getTradesFiltered Query

**File**: `/home/runner/workspace/server/storage.ts`

**Current** (Line 198-256):
```typescript
async getTradesFiltered(userId: string, filters: TradeFilters): Promise<{ trades: EnrichedTrade[]; total: number }> {
  // ... conditions setup ...

  // PROBLEM: LEFT JOINs on entire tables
  const result = await db
    .select({
      trade: trades,
      strategy: strategies,
      aiDecision: aiDecisions,
    })
    .from(trades)
    .leftJoin(strategies, eq(strategies.id, trades.strategyId))
    .leftJoin(aiDecisions, eq(aiDecisions.executedTradeId, trades.id))
    .where(whereClause)
    .orderBy(desc(trades.executedAt))
    .limit(limit)
    .offset(offset);

  // ... mapping ...
}
```

**Optimized**:
```typescript
async getTradesFiltered(userId: string, filters: TradeFilters): Promise<{ trades: EnrichedTrade[]; total: number }> {
  const cacheKey = getCacheKey('trades_filtered', userId, JSON.stringify(filters));

  // Check cache
  const cached = queryCache.get<{ trades: EnrichedTrade[]; total: number }>(cacheKey);
  if (cached) return cached;

  // ... conditions setup (same) ...

  // Step 1: Get trades with limit/offset
  const tradesResult = await db
    .select()
    .from(trades)
    .where(whereClause)
    .orderBy(desc(trades.executedAt))
    .limit(limit)
    .offset(offset);

  if (tradesResult.length === 0) {
    return { trades: [], total: 0 };
  }

  // Step 2: Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trades)
    .where(whereClause);

  // Step 3: Collect IDs for batch queries
  const tradeIds = tradesResult.map(t => t.id);
  const strategyIds = [...new Set(tradesResult.map(t => t.strategyId).filter(Boolean))];

  // Step 4: Batch fetch related data
  const [strategiesMap, decisionsMap] = await Promise.all([
    // Fetch strategies
    strategyIds.length > 0
      ? db.select()
          .from(strategies)
          .where(inArray(strategies.id, strategyIds as string[]))
          .then(rows => new Map(rows.map(s => [s.id, s])))
      : Promise.resolve(new Map()),

    // Fetch AI decisions
    db.select()
      .from(aiDecisions)
      .where(inArray(aiDecisions.executedTradeId, tradeIds))
      .then(rows => new Map(rows.map(d => [d.executedTradeId!, d])))
  ]);

  // Step 5: Combine results in memory
  const enrichedTrades: EnrichedTrade[] = tradesResult.map(trade => ({
    ...trade,
    strategyName: trade.strategyId ? (strategiesMap.get(trade.strategyId)?.name ?? null) : null,
    aiDecision: decisionsMap.get(trade.id) ?? null,
  }));

  const result = { trades: enrichedTrades, total: count };

  // Cache result
  queryCache.set(cacheKey, result, 30);  // 30 second TTL

  return result;
}
```

**Why it's faster**:
1. Query trades first (uses index on user_id + executed_at)
2. Batch fetch related data with `IN` clauses (uses indexes)
3. Join in application memory (fast for small result sets)
4. Avoids LEFT JOIN sequential scans

**Impact**: 2-3x improvement on top of indexes

---

## 4. Add Query Performance Logging

**File**: `/home/runner/workspace/server/index.ts`

**Add before routes**:
```typescript
// Query performance monitoring middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Override res.json to capture when response is sent
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - start;

    // Log slow queries
    if (duration > 500) {
      console.warn(`[SLOW QUERY] ${req.method} ${req.path} took ${duration}ms`);
    } else if (duration > 200) {
      console.log(`[Slow] ${req.method} ${req.path} took ${duration}ms`);
    }

    // Add performance header
    res.setHeader('X-Response-Time', `${duration}ms`);

    return originalJson.call(this, body);
  };

  next();
});
```

**Impact**: Visibility into slow endpoints

---

## 5. Optimize Activity Timeline Query

**File**: `/home/runner/workspace/server/routes.ts`

**Current** (Line 1721):
```typescript
app.get("/api/activity/timeline", authMiddleware, async (req, res) => {
  // Complex UNION query with sorting
});
```

**Optimized**:
```typescript
app.get("/api/activity/timeline", authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const cacheKey = `timeline:${req.userId}:${limit}`;

    // Check cache
    const cached = queryCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Fetch trades and decisions in parallel
    const [recentTrades, recentDecisions] = await Promise.all([
      db.select({
        id: trades.id,
        timestamp: trades.executedAt,
        symbol: trades.symbol,
        type: sql<string>`'trade'`,
      })
      .from(trades)
      .where(eq(trades.userId, req.userId!))
      .orderBy(desc(trades.executedAt))
      .limit(limit),

      db.select({
        id: aiDecisions.id,
        timestamp: aiDecisions.createdAt,
        symbol: aiDecisions.symbol,
        type: sql<string>`'decision'`,
      })
      .from(aiDecisions)
      .where(eq(aiDecisions.userId, req.userId!))
      .orderBy(desc(aiDecisions.createdAt))
      .limit(limit),
    ]);

    // Merge and sort in memory
    const timeline = [...recentTrades, ...recentDecisions]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    // Cache for 30 seconds
    queryCache.set(cacheKey, timeline, 30);

    res.json(timeline);
  } catch (error) {
    console.error("Failed to get activity timeline:", error);
    res.status(500).json({ error: "Failed to get activity timeline" });
  }
});
```

**Why it's faster**:
1. Two separate indexed queries (faster than UNION)
2. Parallel execution
3. Sorting in memory (fast for small result sets)
4. Caching

**Impact**: 5-10x improvement

---

## 6. Configure Database Connection Pooling

**File**: `/home/runner/workspace/server/db.ts`

**Current**:
```typescript
export const db = drizzle(new Pool({ connectionString: DATABASE_URL }), { schema });
```

**Optimized**:
```typescript
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,  // Maximum number of connections
  min: 2,   // Minimum number of connections
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 2000,  // Fail fast if can't get connection
  maxUses: 7500,  // Recycle connections after 7500 uses
  allowExitOnIdle: true,  // Allow process to exit when idle
});

// Log connection pool events
pool.on('connect', () => {
  console.log('[DB] New connection established');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error:', err);
});

export const db = drizzle(pool, { schema });
```

**Impact**: Better resource management under load

---

## 7. Add Pagination Enforcement

**File**: `/home/runner/workspace/server/routes.ts`

**Create helper function**:
```typescript
// Add at top of file
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function parsePaginationParams(req: Request): { limit: number; offset: number } {
  const limit = Math.min(
    parseInt(req.query.limit as string) || DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  return { limit, offset };
}
```

**Use in routes**:
```typescript
app.get("/api/trades/enriched", authMiddleware, async (req, res) => {
  const { limit, offset } = parsePaginationParams(req);

  // Use validated limit/offset
  const filters = {
    limit,
    offset,
    // ... other filters ...
  };
});
```

**Impact**: Prevent abuse, consistent performance

---

## 8. Install and Configure Monitoring

**Install dependencies**:
```bash
npm install node-cache compression
npm install --save-dev @types/node-cache @types/compression
```

**Create monitoring utility**:

**File**: `/home/runner/workspace/server/utils/performance-monitor.ts`

```typescript
export class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();

  static trackQuery(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
  }

  static getStats() {
    const stats: Record<string, any> = {};

    for (const [name, durations] of this.metrics.entries()) {
      if (durations.length === 0) continue;

      const sorted = [...durations].sort((a, b) => a - b);
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      stats[name] = {
        count: durations.length,
        avg: Math.round(avg * 100) / 100,
        min: Math.min(...durations),
        max: Math.max(...durations),
        p50,
        p95,
        p99,
      };
    }

    return stats;
  }

  static reset() {
    this.metrics.clear();
  }
}
```

**Add endpoint**:
```typescript
app.get("/api/admin/performance-stats", authMiddleware, (req, res) => {
  res.json(PerformanceMonitor.getStats());
});
```

---

## Implementation Checklist

- [ ] Add database indexes (see PERFORMANCE_OPTIMIZATION_QUICKSTART.md)
- [ ] Install compression middleware
- [ ] Install node-cache for query caching
- [ ] Add query performance logging
- [ ] Optimize getTradesFiltered query
- [ ] Optimize activity timeline query
- [ ] Configure connection pooling
- [ ] Add pagination enforcement
- [ ] Add cache invalidation on writes
- [ ] Test performance improvements
- [ ] Monitor cache hit rates

---

## Expected Results After All Optimizations

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| GET /api/trades/enriched | 6272ms | 50-100ms | **60-125x** |
| GET /api/ai-decisions | 1190ms | 20-50ms | **24-60x** |
| GET /api/activity/timeline | 530ms | 10-30ms | **18-53x** |
| Payload size (gzipped) | 80KB | 20KB | **4x smaller** |
| Cache hit rate | 0% | 60-80% | **New capability** |

---

**Priority**: HIGH
**Estimated Time**: 4-6 hours total
**Impact**: 60-125x performance improvement
**Last Updated**: 2025-12-24
