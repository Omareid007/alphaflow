# Database Fixes - Implementation Checklist

**Start Date:** ___________
**Target Completion:** ___________ (4 days from start)
**Developer:** ___________

---

## Day 1 - CRITICAL FIXES (3 hours)

### [ ] Task 1: Foreign Key Cascades (2 hours)
**File:** `/home/runner/workspace/shared/schema.ts`

- [ ] Line 33: `trades.strategyId`
- [ ] Line 34: `trades.orderId`
- [ ] Line 57: `positions.strategyId`
- [ ] Line 64: `ai_decisions.strategyId`
- [ ] Line 71: `ai_decisions.executedTradeId`
- [ ] Line 114: `ai_decision_features.decisionId`
- [ ] Line 137: `ai_trade_outcomes.decisionId`
- [ ] Line 138: `ai_trade_outcomes.tradeId`
- [ ] Line 156: `ai_trade_outcomes.strategyId`
- [ ] Line 231: `data_source_analysis.decisionId`
- [ ] Line 315: `analysis_feedback.dataSourceAnalysisId`
- [ ] Line 316: `analysis_feedback.tradeOutcomeId`
- [ ] Line 572: `work_items.decisionId`
- [ ] Line 584: `work_item_runs.workItemId`
- [ ] Line 701: `orders.decisionId`
- [ ] Line 702: `orders.tradeIntentId`
- [ ] Line 703: `orders.workItemId`
- [ ] Line 722: `fills.orderId`
- [ ] Line 767: `backtest_runs.strategyId`
- [ ] Line 794: `backtest_trade_events.runId`
- [ ] Line 816: `backtest_equity_curve.runId`
- [ ] Line 871: `admin_settings.updatedBy`
- [ ] Line 1089: `universe_candidates.approvedBy`
- [ ] Line 1115: `allocation_policies.createdBy`
- [ ] Line 1126: `rebalance_runs.policyId`
- [ ] Line 1239: `alert_events.ruleId`
- [ ] Line 1277: `audit_logs.userId`
- [ ] Line 1338: `debate_messages.sessionId`
- [ ] Line 1364: `debate_consensus.sessionId`
- [ ] Line 1371: `debate_consensus.workItemId`
- [ ] Line 1430: `competition_scores.runId`
- [ ] Line 1431: `competition_scores.traderProfileId`
- [ ] Line 1460: `strategy_versions.strategyId`
- [ ] Line 1502: `tool_invocations.debateSessionId`
- [ ] Line 1560: `ai_outcome_links.consensusId`
- [ ] Line 1561: `ai_outcome_links.debateSessionId`
- [ ] Line 1562: `ai_outcome_links.decisionId`
- [ ] Line 1563: `ai_outcome_links.workItemId`
- [ ] Line 1610: `ai_arena_runs.strategyVersionId`
- [ ] Line 1642: `ai_arena_agent_decisions.arenaRunId`
- [ ] Line 1643: `ai_arena_agent_decisions.agentProfileId`

**Testing:**
- [ ] Run migration/db push
- [ ] Test cascade delete works
- [ ] Check no orphaned records

---

### [ ] Task 2: Fix N+1 Query (30 minutes)
**File:** `/home/runner/workspace/server/storage.ts`

- [ ] Replace `getTradesFiltered()` method (lines 189-259)
- [ ] Replace `getEnrichedTrade()` method (lines 266-290)
- [ ] Test query count reduction

**Testing:**
- [ ] Query count reduced from ~82 to ~3
- [ ] Response format unchanged
- [ ] Performance improved

---

### [ ] Task 3: Add Transaction Support (30 minutes)
**File:** `/home/runner/workspace/server/storage.ts`

- [ ] Wrap `syncPositionsFromAlpaca()` in transaction (lines 347-372)
- [ ] Test rollback on failure

**Testing:**
- [ ] Insert failure rolls back delete
- [ ] No data loss on errors

---

## Day 2 - HIGH PRIORITY FIXES (3 hours)

### [ ] Task 4: Add Missing Indexes (1 hour)

- [ ] Create migration file `add_critical_indexes.sql`
- [ ] Add indexes on `trades` table (6 indexes)
- [ ] Add indexes on `positions` table (3 indexes)
- [ ] Add indexes on `ai_decisions` table (5 indexes)
- [ ] Add indexes on `strategies` table (2 indexes)
- [ ] Run migration with CONCURRENTLY

**Testing:**
- [ ] EXPLAIN ANALYZE shows index usage
- [ ] Query performance improved

---

### [ ] Task 5: Add Input Validation (2 hours)
**File:** `/home/runner/workspace/server/storage.ts`

Methods to update:
- [ ] `createUser()`
- [ ] `createStrategy()`
- [ ] `createTrade()`
- [ ] `createPosition()`
- [ ] `createAiDecision()`
- [ ] `updateUser()`
- [ ] `updateStrategy()`
- [ ] `updateTrade()`
- [ ] `updatePosition()`
- [ ] `updateAiDecision()`

**Testing:**
- [ ] Invalid data rejected
- [ ] Negative values rejected
- [ ] Empty strings rejected

---

## Day 3 - RELIABILITY FIXES (3 hours)

### [ ] Task 6: Add Error Handling (2 hours)
**File:** `/home/runner/workspace/server/storage.ts`

- [ ] Create error classes (DatabaseError, ValidationError, NotFoundError)
- [ ] Add try-catch to all database operations
- [ ] Add error logging

Methods to update (all 91 async methods):
- [ ] All `get*()` methods
- [ ] All `create*()` methods
- [ ] All `update*()` methods
- [ ] All `delete*()` methods

**Testing:**
- [ ] Errors logged properly
- [ ] Error context included
- [ ] Error propagation works

---

### [ ] Task 7: Fix Bulk Operations (1 hour)
**File:** `/home/runner/workspace/server/storage.ts`

- [ ] Replace `bulkUpsertBrokerAssets()` with ON CONFLICT
- [ ] Add transaction wrapper
- [ ] Test with large datasets

**Testing:**
- [ ] 10k records < 30 seconds
- [ ] Duplicates handled correctly

---

## Day 4 - PRODUCTION READINESS (2 hours)

### [ ] Task 8: Add Graceful Shutdown (30 minutes)

**File:** `/home/runner/workspace/server/db.ts`
- [ ] Add `closePool()` function

**File:** `/home/runner/workspace/server/index.ts`
- [ ] Add SIGTERM handler
- [ ] Add SIGINT handler
- [ ] Test shutdown behavior

**Testing:**
- [ ] Connections closed on SIGTERM
- [ ] No hanging processes

---

### [ ] Task 9: Add Audit Logging (1 hour)
**File:** `/home/runner/workspace/server/storage.ts`

Methods to add logging:
- [ ] `createUser()`
- [ ] `updateUser()`
- [ ] `createStrategy()`
- [ ] `updateStrategy()`
- [ ] `createTrade()`
- [ ] `createPosition()`
- [ ] `deletePosition()`

**Testing:**
- [ ] Audit logs created
- [ ] User context captured

---

### [ ] Task 10: Final Testing (30 minutes)

**Unit Tests:**
- [ ] Foreign key cascade test
- [ ] N+1 query test
- [ ] Transaction rollback test
- [ ] Input validation tests
- [ ] Error handling tests

**Integration Tests:**
- [ ] Concurrent upsert test
- [ ] Connection pool load test
- [ ] Bulk insert test

**Performance Tests:**
- [ ] Before/after query benchmarks
- [ ] Connection pool stress test

---

## Post-Deployment Monitoring

### [ ] Week 1 Monitoring

**Daily Checks:**
- [ ] Check orphaned records query
- [ ] Monitor connection pool health
- [ ] Review slow query log
- [ ] Check error logs

**Queries to Run:**
```sql
-- Orphaned records (should be 0)
SELECT COUNT(*) FROM trades t
LEFT JOIN strategies s ON t.strategy_id = s.id
WHERE t.strategy_id IS NOT NULL AND s.id IS NULL;

-- Connection pool health
SELECT * FROM pg_stat_database WHERE datname = current_database();

-- Slow queries
SELECT query, mean_exec_time FROM pg_stat_statements
WHERE mean_exec_time > 1000 ORDER BY mean_exec_time DESC LIMIT 10;
```

---

## Sign-Off

- [ ] All critical fixes completed
- [ ] All tests passing
- [ ] Performance improvements verified
- [ ] Documentation updated
- [ ] Team briefed on changes

**Completed By:** ___________
**Date:** ___________
**Notes:** ___________________________________________________________

---

## Reference Documents

- Full Analysis: `DATABASE_COMPREHENSIVE_TEST_REPORT.md`
- Quick Start: `DATABASE_FIXES_QUICK_START.md`
- Summary: `DATABASE_TEST_SUMMARY.md`
- This Checklist: `DATABASE_FIXES_CHECKLIST.md`

---

**Total Estimated Time:** 11 hours over 4 days
**Actual Time Spent:** __________ hours
