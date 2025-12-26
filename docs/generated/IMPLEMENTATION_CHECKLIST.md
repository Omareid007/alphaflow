# Implementation Checklist - Critical Database Fixes

Use this checklist to ensure all fixes are properly implemented and tested.

---

## Pre-Implementation (5 minutes)

- [ ] **Read all documentation files**
  - [ ] `CRITICAL_DATABASE_FIXES_SUMMARY.md` - Overview
  - [ ] `DATABASE_SECURITY_FIXES.md` - Detailed guide
  - [ ] `IMPLEMENTATION_GUIDE.md` - Code examples
  - [ ] `QUICK_START_FIX_GUIDE.md` - Quick reference

- [ ] **Backup database**
  ```bash
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
  ```
  Backup file location: `________________________`

- [ ] **Stop development server**
  ```bash
  pkill -f "tsx watch"
  ```
  Server stopped: Yes / No

- [ ] **Create git branch for fixes**
  ```bash
  git checkout -b fix/database-security-and-performance
  ```
  Branch created: Yes / No

---

## Phase 1: Database Migration (10 minutes)

- [ ] **Review migration script**
  - File: `/home/runner/workspace/migrations/001_add_user_isolation_and_transactions.sql`
  - Reviewed: Yes / No

- [ ] **Run migration**
  ```bash
  psql $DATABASE_URL -f migrations/001_add_user_isolation_and_transactions.sql
  ```
  Migration completed: Yes / No
  Any errors: Yes / No
  If errors, describe: `________________________`

- [ ] **Verify migration**
  ```bash
  psql $DATABASE_URL -f scripts/verify-database-fixes.sql
  ```
  All checks passed: Yes / No

- [ ] **Specific verifications**
  - [ ] trades.user_id column exists: Yes / No
  - [ ] positions.user_id column exists: Yes / No
  - [ ] ai_decisions.user_id column exists: Yes / No
  - [ ] orders.user_id column exists: Yes / No
  - [ ] All columns are NOT NULL: Yes / No
  - [ ] All indexes created: Yes / No
  - [ ] No rows with NULL user_id: Yes / No

---

## Phase 2: Schema Updates (10 minutes)

**File:** `/home/runner/workspace/shared/schema.ts`

- [ ] **Update trades table (line ~29)**
  - [ ] Add `userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull()`
  - [ ] Add index in table options: `index("trades_user_id_idx").on(table.userId)`

- [ ] **Update positions table (line ~46)**
  - [ ] Add `userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull()`
  - [ ] Add index in table options: `index("positions_user_id_idx").on(table.userId)`

- [ ] **Update aiDecisions table (line ~60)**
  - [ ] Add `userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull()`
  - [ ] Add index in table options: `index("ai_decisions_user_id_idx").on(table.userId)`

- [ ] **Update orders table (line ~673)**
  - [ ] Add `userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull()`
  - [ ] Add index in table options: `index("orders_user_id_idx").on(table.userId)`

- [ ] **Test TypeScript compilation**
  ```bash
  npm run build
  ```
  Compiles without errors: Yes / No
  If errors, describe: `________________________`

---

## Phase 3: Storage Layer Updates (30 minutes)

**File:** `/home/runner/workspace/server/storage.ts`

### Interface Updates (IStorage interface, line ~84)

- [ ] `getPositions(userId: string): Promise<Position[]>`
- [ ] `getPosition(userId: string, id: string): Promise<Position | undefined>`
- [ ] `getTrades(userId: string, limit?: number): Promise<Trade[]>`
- [ ] `getTradesFiltered(userId: string, filters: TradeFilters): Promise<...>`
- [ ] `getAiDecisions(userId: string, limit?: number): Promise<AiDecision[]>`
- [ ] `createPosition(userId: string, position: InsertPosition): Promise<Position>`
- [ ] `createTrade(userId: string, trade: InsertTrade): Promise<Trade>`
- [ ] `createAiDecision(userId: string, decision: InsertAiDecision): Promise<AiDecision>`
- [ ] `createOrder(userId: string, order: InsertOrder): Promise<Order>`
- [ ] `updatePosition(userId: string, id: string, updates: ...): Promise<...>`
- [ ] `deletePosition(userId: string, id: string): Promise<boolean>`
- [ ] `getRecentOrders(userId: string, limit?: number): Promise<Order[]>`
- [ ] `syncPositionsFromAlpaca(userId: string, alpacaPositions: ...): Promise<...>`

### Implementation Updates

- [ ] **getPositions (line ~314)**
  - [ ] Add `userId: string` parameter
  - [ ] Add `.where(eq(positions.userId, userId))`

- [ ] **getPosition (line ~318)**
  - [ ] Add `userId: string` parameter
  - [ ] Add userId to where clause: `and(eq(positions.id, id), eq(positions.userId, userId))`

- [ ] **getTrades (line ~185)**
  - [ ] Add `userId: string` parameter
  - [ ] Add `.where(eq(trades.userId, userId))`

- [ ] **getTradesFiltered (line ~189) - CRITICAL N+1 FIX**
  - [ ] Add `userId: string` parameter
  - [ ] Add `eq(trades.userId, userId)` to conditions array
  - [ ] Replace Promise.all loop with JOINs
  - [ ] Use `leftJoin(strategies, eq(trades.strategyId, strategies.id))`
  - [ ] Use `leftJoin(aiDecisions, eq(aiDecisions.executedTradeId, trades.id))`
  - [ ] Map results to EnrichedTrade format

- [ ] **getAiDecisions (line ~374)**
  - [ ] Add `userId: string` parameter
  - [ ] Add `.where(eq(aiDecisions.userId, userId))`

- [ ] **createPosition (line ~323)**
  - [ ] Add `userId: string` parameter
  - [ ] Include userId in values: `{ ...insertPosition, userId }`

- [ ] **createTrade (line ~292)**
  - [ ] Add `userId: string` parameter
  - [ ] Include userId in values: `{ ...insertTrade, userId }`

- [ ] **createAiDecision (line ~378)**
  - [ ] Add `userId: string` parameter
  - [ ] Include userId in values: `{ ...insertDecision, userId }`

- [ ] **createOrder (line ~640)**
  - [ ] Add `userId: string` parameter
  - [ ] Include userId in values: `{ ...order, userId }`

- [ ] **updatePosition (line ~328)**
  - [ ] Add `userId: string` parameter
  - [ ] Add userId to where: `and(eq(positions.id, id), eq(positions.userId, userId))`

- [ ] **deletePosition (line ~337)**
  - [ ] Add `userId: string` parameter
  - [ ] Add userId to where: `and(eq(positions.id, id), eq(positions.userId, userId))`

- [ ] **getRecentOrders (line ~683)**
  - [ ] Add `userId: string` parameter
  - [ ] Add `.where(eq(orders.userId, userId))`

- [ ] **syncPositionsFromAlpaca (line ~347) - TRANSACTION FIX**
  - [ ] Add `userId: string` parameter
  - [ ] Wrap entire function in `db.transaction(async (tx) => { ... })`
  - [ ] Use `tx.delete(positions).where(eq(positions.userId, userId))`
  - [ ] Include userId in all inserts: `{ ...pos, userId }`
  - [ ] Use `tx.insert(positions).values(...)`

- [ ] **Test compilation again**
  ```bash
  npm run build
  ```
  Compiles without errors: Yes / No

---

## Phase 4: Route Handler Updates (20 minutes)

**File:** `/home/runner/workspace/server/routes.ts`

Use search to find all storage calls:
```bash
grep -n "storage\\.get" server/routes.ts
grep -n "storage\\.create" server/routes.ts
grep -n "storage\\.delete" server/routes.ts
grep -n "storage\\.update" server/routes.ts
grep -n "storage\\.sync" server/routes.ts
```

### Update all route handlers to pass req.userId!

- [ ] **Positions routes**
  - [ ] GET /api/positions: `storage.getPositions(req.userId!)`
  - [ ] POST /api/positions: `storage.createPosition(req.userId!, req.body)`
  - [ ] PUT /api/positions/:id: `storage.updatePosition(req.userId!, id, updates)`
  - [ ] DELETE /api/positions/:id: `storage.deletePosition(req.userId!, id)`

- [ ] **Trades routes**
  - [ ] GET /api/trades: `storage.getTrades(req.userId!)`
  - [ ] GET /api/trades (filtered): `storage.getTradesFiltered(req.userId!, filters)`
  - [ ] POST /api/trades: `storage.createTrade(req.userId!, req.body)`

- [ ] **AI Decisions routes**
  - [ ] GET /api/ai-decisions: `storage.getAiDecisions(req.userId!)`
  - [ ] POST /api/ai-decisions: `storage.createAiDecision(req.userId!, req.body)`

- [ ] **Orders routes**
  - [ ] GET /api/orders: `storage.getRecentOrders(req.userId!)`
  - [ ] POST /api/orders: `storage.createOrder(req.userId!, req.body)`

- [ ] **Other routes that sync positions**
  - [ ] Position sync endpoint: `storage.syncPositionsFromAlpaca(req.userId!, positions)`

- [ ] **Search for any remaining storage calls without userId**
  ```bash
  # These should return NO results:
  grep -n "storage\.getPositions()" server/routes.ts
  grep -n "storage\.getTrades()" server/routes.ts
  grep -n "storage\.getAiDecisions()" server/routes.ts
  ```
  All searches return 0 results: Yes / No

- [ ] **Final compilation test**
  ```bash
  npm run build
  ```
  Compiles without errors: Yes / No
  TypeScript errors found: `________________________`

---

## Phase 5: Testing (20 minutes)

- [ ] **Start server**
  ```bash
  npm run dev
  ```
  Server starts successfully: Yes / No

- [ ] **Create test users**
  - User A created: Yes / No (username: `________________`)
  - User B created: Yes / No (username: `________________`)

- [ ] **Test user isolation**
  - [ ] Log in as User A
  - [ ] Create a position for User A
  - [ ] Log in as User B
  - [ ] Verify User B CANNOT see User A's position
  - [ ] Verify User B can create their own position
  - [ ] Log back in as User A
  - [ ] Verify User A still sees only their position

- [ ] **Test N+1 query fix**
  - [ ] Enable database query logging (if possible)
  - [ ] Request /api/trades endpoint
  - [ ] Count database queries in logs
  - [ ] Query count for 50 trades: `_____` (should be 2-3, not 100+)

- [ ] **Test transaction rollback**
  - [ ] Modify syncPositionsFromAlpaca to throw error after delete
  - [ ] Call sync positions endpoint
  - [ ] Verify positions were NOT deleted (transaction rolled back)
  - [ ] Remove test error
  - [ ] Verify normal sync works

- [ ] **Test cascade delete**
  - [ ] Create a test user with positions, trades, orders
  - [ ] Delete the user from database
  - [ ] Verify all user's positions deleted automatically
  - [ ] Verify all user's trades deleted automatically
  - [ ] Verify all user's orders deleted automatically

---

## Phase 6: Performance Verification (10 minutes)

- [ ] **Measure query performance**
  ```sql
  EXPLAIN ANALYZE SELECT * FROM trades WHERE user_id = 'some-user-id' LIMIT 50;
  ```
  Uses index: Yes / No
  Execution time: `_____ms` (should be < 10ms)

- [ ] **Check index usage**
  ```bash
  psql $DATABASE_URL -f scripts/verify-database-fixes.sql
  ```
  Section 7 shows index usage: Yes / No

- [ ] **Load test (optional)**
  - Create 100 trades for User A
  - Request /api/trades endpoint
  - Response time: `_____ms` (should be < 100ms)

---

## Phase 7: Security Verification (10 minutes)

- [ ] **Attempt to access another user's data**
  - [ ] Try to GET /api/positions while logged in as User B
  - [ ] Verify response only shows User B's data
  - [ ] Does NOT show User A's data: Yes / No

- [ ] **Check database directly**
  ```sql
  SELECT user_id, COUNT(*) FROM trades GROUP BY user_id;
  SELECT user_id, COUNT(*) FROM positions GROUP BY user_id;
  ```
  Data properly distributed: Yes / No

- [ ] **Audit logs (if implemented)**
  - [ ] Verify userId appears in audit logs
  - [ ] Verify all operations tracked with userId

---

## Phase 8: Documentation and Cleanup (5 minutes)

- [ ] **Update internal documentation**
  - [ ] Document userId requirement for new endpoints
  - [ ] Document transaction usage patterns
  - [ ] Document N+1 query prevention

- [ ] **Git commit**
  ```bash
  git add .
  git commit -m "fix: add user data isolation, fix N+1 queries, add transactions

  - Added userId to trades, positions, orders, ai_decisions tables
  - Updated all storage functions to filter by userId
  - Fixed N+1 query problem in getTradesFiltered (101 queries -> 2 queries)
  - Added database transactions to syncPositionsFromAlpaca
  - Added indexes on userId for performance
  - Implemented cascade delete on user removal

  BREAKING CHANGE: All storage functions now require userId parameter"
  ```
  Committed: Yes / No

- [ ] **Create pull request (if using PR workflow)**
  PR created: Yes / No
  PR link: `________________________`

---

## Phase 9: Deployment Checklist (Production)

- [ ] **Pre-deployment**
  - [ ] Backup production database
  - [ ] Schedule maintenance window
  - [ ] Notify team of deployment

- [ ] **Deployment**
  - [ ] Run migration on production
  - [ ] Deploy code changes
  - [ ] Restart application
  - [ ] Monitor error logs

- [ ] **Post-deployment**
  - [ ] Run verification script
  - [ ] Test with production users
  - [ ] Monitor performance metrics
  - [ ] Verify no data leakage

---

## Rollback Plan (If Needed)

- [ ] **If issues occur:**
  ```bash
  # Restore database from backup
  psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

  # Revert code changes
  git revert <commit-hash>

  # Restart server
  npm run dev
  ```

---

## Success Criteria

✅ **All items checked** - Ready for production
⚠️ **Some items unchecked** - Review and complete
❌ **Major issues** - Stop and investigate

**Completion Date:** `________________________`
**Completed By:** `________________________`
**Time Taken:** `________________________`

---

## Final Verification

Run this comprehensive check:

```sql
-- Should return all zeros
SELECT
  (SELECT COUNT(*) FROM trades WHERE user_id IS NULL) as trades_null,
  (SELECT COUNT(*) FROM positions WHERE user_id IS NULL) as positions_null,
  (SELECT COUNT(*) FROM ai_decisions WHERE user_id IS NULL) as decisions_null,
  (SELECT COUNT(*) FROM orders WHERE user_id IS NULL) as orders_null;
```

**Result:** All zeros: Yes / No

**IMPLEMENTATION COMPLETE!** 🎉
