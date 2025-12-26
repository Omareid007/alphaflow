# Performance Optimization Quick Start Guide

**IMMEDIATE ACTION REQUIRED** - Run these commands to fix critical performance issues

---

## Step 1: Add Missing Indexes (5 minutes)

Copy and paste this SQL into your database console:

```sql
-- ==========================================
-- CRITICAL: Add Missing Database Indexes
-- Expected improvement: 60-100x faster queries
-- ==========================================

-- AI Decisions indexes (499K rows - CRITICAL)
CREATE INDEX CONCURRENTLY ai_decisions_strategy_id_idx ON ai_decisions(strategy_id);
CREATE INDEX CONCURRENTLY ai_decisions_symbol_idx ON ai_decisions(symbol);
CREATE INDEX CONCURRENTLY ai_decisions_created_at_idx ON ai_decisions(created_at DESC);
CREATE INDEX CONCURRENTLY ai_decisions_status_idx ON ai_decisions(status);
CREATE INDEX CONCURRENTLY ai_decisions_executed_trade_id_idx ON ai_decisions(executed_trade_id);

-- Compound indexes for ai_decisions (CRITICAL)
CREATE INDEX CONCURRENTLY ai_decisions_user_created_idx ON ai_decisions(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY ai_decisions_user_status_created_idx ON ai_decisions(user_id, status, created_at DESC);

-- Trades indexes (10K rows)
CREATE INDEX CONCURRENTLY trades_strategy_id_idx ON trades(strategy_id);
CREATE INDEX CONCURRENTLY trades_symbol_idx ON trades(symbol);
CREATE INDEX CONCURRENTLY trades_executed_at_idx ON trades(executed_at DESC);
CREATE INDEX CONCURRENTLY trades_user_executed_idx ON trades(user_id, executed_at DESC);

-- Positions indexes
CREATE INDEX CONCURRENTLY positions_symbol_idx ON positions(symbol);

-- Orders indexes
CREATE INDEX CONCURRENTLY orders_created_at_idx ON orders(created_at DESC);
```

---

## Step 2: Verify Indexes (2 minutes)

Run this to confirm indexes were created:

```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('trades', 'ai_decisions', 'positions', 'orders')
ORDER BY tablename, indexname;
```

Expected output: Should see all new indexes listed.

---

## Step 3: Test Performance (5 minutes)

Run the database performance test:

```bash
tsx scripts/database-performance-test.ts
```

Expected results:
- "Index Scan" instead of "Seq Scan"
- Query times < 100ms (down from 1000-6000ms)

---

## Step 4: Test API Endpoints (5 minutes)

Run the API performance test:

```bash
tsx scripts/comprehensive-performance-test.ts
```

Expected results:
- `/api/trades/enriched`: <100ms (was 6272ms)
- `/api/ai-decisions`: <50ms (was 1190ms)
- `/api/activity/timeline`: <30ms (was 530ms)

---

## Quick Performance Comparison

| Endpoint | Before | After | Improvement |
|----------|--------|-------|-------------|
| GET /api/trades/enriched | 6272ms | ~100ms | **60x faster** |
| GET /api/ai-decisions | 1190ms | ~50ms | **24x faster** |
| GET /api/activity/timeline | 530ms | ~30ms | **18x faster** |

---

## Troubleshooting

### If indexes fail to create:

```sql
-- Check for blocking queries
SELECT pid, query, state
FROM pg_stat_activity
WHERE state != 'idle';

-- If needed, terminate blocking queries (use with caution)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active' AND query LIKE '%CREATE INDEX%';
```

### If performance doesn't improve:

```sql
-- Verify index is being used
EXPLAIN ANALYZE
SELECT * FROM ai_decisions
WHERE user_id = 'some-user-id'
ORDER BY created_at DESC
LIMIT 100;

-- Look for "Index Scan using ai_decisions_user_created_idx"
-- NOT "Seq Scan on ai_decisions"
```

### Force PostgreSQL to use new indexes:

```sql
-- Analyze tables to update statistics
ANALYZE ai_decisions;
ANALYZE trades;
ANALYZE positions;
ANALYZE orders;

-- Vacuum to clean up
VACUUM ANALYZE;
```

---

## Expected Results

After adding indexes, you should see:

✅ **API Response Times**:
- Most queries < 100ms
- No queries > 500ms
- P95 latency < 100ms

✅ **Database Performance**:
- All queries using index scans
- No sequential scans on large tables
- Query execution times < 50ms

✅ **System Grade**: C → **A**

---

## Next Steps (After Indexes)

1. **Add Response Compression** (15 min)
2. **Implement Query Caching** (1-2 hours)
3. **Optimize JOIN Queries** (1 hour)
4. **Enable pg_stat_statements** (5 min)

See full report: `PERFORMANCE_TEST_RESULTS.md`

---

## Quick Reference: Database Access

```bash
# Access PostgreSQL console
psql $DATABASE_URL

# Or via Replit Database tab
# Click "Console" button
```

---

**Last Updated**: 2025-12-24
**Estimated Time**: 15-20 minutes total
**Impact**: 60-100x performance improvement
