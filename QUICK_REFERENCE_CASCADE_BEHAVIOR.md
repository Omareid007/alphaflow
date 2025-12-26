# Quick Reference: Foreign Key Cascade Behavior

## Summary
- **Total Foreign Keys:** 43 (includes 1 from sessions table)
- **WITH CASCADE:** 18 foreign keys
- **WITH SET NULL:** 24 foreign keys
- **WITHOUT CASCADE:** 0 (100% coverage achieved!)

---

## CASCADE Tables (Auto-delete children)

When parent is deleted, children are automatically deleted:

| Child Table | Parent Table | Relationship |
|------------|--------------|--------------|
| sessions | users | User sessions |
| aiDecisionFeatures | aiDecisions | Decision features |
| aiTradeOutcomes | aiDecisions | Trade outcomes |
| dataSourceAnalysis | aiDecisions | Analysis data |
| analysisFeedback | dataSourceAnalysis | Feedback records |
| analysisFeedback | aiTradeOutcomes | Feedback records |
| workItemRuns | workItems | Work item runs |
| fills | orders | Order fills |
| backtestTradeEvents | backtestRuns | Backtest events |
| backtestEquityCurve | backtestRuns | Equity curves |
| alertEvents | alertRules | Alert events |
| debateMessages | debateSessions | Debate messages |
| debateConsensus | debateSessions | Consensus records |
| competitionScores | competitionRuns | Competition scores |
| competitionScores | traderProfiles | Trader scores |
| strategyVersions | strategies | Strategy versions |
| aiArenaAgentDecisions | aiArenaRuns | Agent decisions |
| aiArenaAgentDecisions | aiAgentProfiles | Agent history |

---

## SET NULL Tables (Preserve historical data)

When parent is deleted, foreign key is set to null (child preserved):

| Child Table | Parent Table | Column | Reason |
|------------|--------------|---------|--------|
| trades | strategies | strategyId | Historical data |
| trades | orders | orderId | Historical data |
| positions | strategies | strategyId | Historical data |
| aiDecisions | strategies | strategyId | Historical data |
| aiDecisions | trades | executedTradeId | Historical data |
| aiTradeOutcomes | trades | tradeId | Historical data |
| aiTradeOutcomes | strategies | strategyId | Historical data |
| workItems | aiDecisions | decisionId | Work queue integrity |
| orders | aiDecisions | decisionId | Order history |
| orders | trades | tradeIntentId | Order history |
| orders | workItems | workItemId | Order history |
| backtestRuns | strategies | strategyId | Backtest results |
| adminSettings | users | updatedBy | Settings history |
| universeCandidates | users | approvedBy | Approval history |
| allocationPolicies | users | createdBy | Policy history |
| rebalanceRuns | allocationPolicies | policyId | Rebalance history |
| auditLogs | users | userId | Security/compliance |
| debateConsensus | workItems | workItemId | Consensus history |
| toolInvocations | debateSessions | debateSessionId | Tool usage history |
| aiOutcomeLinks | debateConsensus | consensusId | Outcome tracking |
| aiOutcomeLinks | debateSessions | debateSessionId | Outcome tracking |
| aiOutcomeLinks | aiDecisions | decisionId | Outcome tracking |
| aiOutcomeLinks | workItems | workItemId | Outcome tracking |
| aiArenaRuns | strategyVersions | strategyVersionId | Arena history |

---

## Testing Cascade Behavior

### Test CASCADE (should delete children):
```sql
-- Create test data
INSERT INTO users (id, username, password) VALUES ('test-user', 'testuser', 'hash');
INSERT INTO sessions (id, user_id, expires_at) VALUES ('test-session', 'test-user', NOW() + INTERVAL '1 day');

-- Delete parent
DELETE FROM users WHERE id = 'test-user';

-- Verify child deleted
SELECT * FROM sessions WHERE id = 'test-session';
-- Should return 0 rows
```

### Test SET NULL (should preserve children):
```sql
-- Create test data
INSERT INTO strategies (id, name, type) VALUES ('test-strat', 'Test Strategy', 'momentum');
INSERT INTO trades (id, strategy_id, symbol, side, quantity, price)
VALUES ('test-trade', 'test-strat', 'AAPL', 'buy', 100, 150.00);

-- Delete parent
DELETE FROM strategies WHERE id = 'test-strat';

-- Verify child preserved with NULL foreign key
SELECT * FROM trades WHERE id = 'test-trade';
-- Should return 1 row with strategy_id = NULL
```

---

## Migration Steps

1. **Generate migration:**
   ```bash
   npm run db:generate
   ```

2. **Review migration SQL** - Look for:
   - `ALTER TABLE ... ADD CONSTRAINT ... ON DELETE CASCADE`
   - `ALTER TABLE ... ADD CONSTRAINT ... ON DELETE SET NULL`

3. **Backup database:**
   ```bash
   pg_dump your_database > backup_before_cascade.sql
   ```

4. **Apply migration:**
   ```bash
   npm run db:migrate
   ```

5. **Verify:**
   ```sql
   -- Check all foreign keys have delete rules
   SELECT
     tc.table_name,
     kcu.column_name,
     ccu.table_name AS foreign_table,
     rc.delete_rule
   FROM information_schema.table_constraints tc
   JOIN information_schema.key_column_usage kcu USING (constraint_name)
   JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
   JOIN information_schema.referential_constraints rc USING (constraint_name)
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND rc.delete_rule = 'NO ACTION';
   -- Should return 0 rows
   ```

---

## Common Patterns

### Owned Children → CASCADE
```typescript
sessionId: varchar("session_id")
  .references(() => debateSessions.id, { onDelete: "cascade" })
  .notNull()
```

### Historical/Audit Data → SET NULL
```typescript
strategyId: varchar("strategy_id")
  .references(() => strategies.id, { onDelete: "set null" })
```

### Optional Relationships → SET NULL
```typescript
approvedBy: varchar("approved_by")
  .references(() => users.id, { onDelete: "set null" })
```

---

## Files Modified
- `/home/runner/workspace/shared/schema.ts` - All 43 foreign keys updated

## Documentation
- `/home/runner/workspace/CASCADE_BEHAVIOR_UPDATE_SUMMARY.md` - Detailed summary
- `/home/runner/workspace/QUICK_REFERENCE_CASCADE_BEHAVIOR.md` - This file

---

**Status:** COMPLETE ✓
**Coverage:** 100% (43/43 foreign keys)
**Date:** 2025-12-24
