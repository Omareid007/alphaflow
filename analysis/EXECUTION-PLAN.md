# Execution Plan for Claude Sonnet 4.5 (1M Context)

## Overview

This document provides a detailed, structured implementation plan for addressing all gaps, enhancements, and improvements identified in the AlphaFlow Trading Platform analysis.

---

## Phase 1: Critical Bug Fixes (Immediate)

### 1.1 Fix AI Decision Quantity Bypass
**File:** `server/routes/autonomous.ts:402`
**Current:** Hardcoded `qty: 1` ignores AI recommendation
**Fix:**
```typescript
// BEFORE
const orderQty = 1; // Hardcoded

// AFTER
const orderQty = decision.suggestedQuantity || 1;
```
**Validation:** Unit test verifying AI quantity is used

### 1.2 Fix API Response Parsing
**File:** `server/connectors/alpaca.ts:463`
**Current:** Crashes if API returns object instead of array
**Fix:**
```typescript
// BEFORE
return response.data;

// AFTER
const data = response.data;
return Array.isArray(data) ? data : data ? [data] : [];
```
**Validation:** Test with mock object/array responses

### 1.3 Fix Transaction Safety
**File:** `server/storage.ts:503`
**Current:** Delete + insert not atomic
**Fix:**
```typescript
await db.transaction(async (tx) => {
  await tx.delete(table).where(condition);
  await tx.insert(table).values(newData);
});
```
**Validation:** Concurrent operation test

---

## Phase 2: Major Improvements (This Sprint)

### 2.1 Remove Console Logging
**Files:** 6 files in `server/connectors/` and `server/trading/`
**Action:**
1. Replace `console.log()` with logger calls
2. Add structured logging with context
3. Implement log levels (debug, info, warn, error)

**Implementation:**
```typescript
// Create server/lib/logger.ts
import { createLogger, format, transports } from 'winston';
export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

// Replace in files
// console.log('message') → logger.info('message', { context })
```

### 2.2 Fix Stale Order Thresholds
**File:** `server/trading/alpaca-trading-engine.ts:415`
**Action:** Implement status-aware timeouts
```typescript
const STALE_THRESHOLDS = {
  new: 60_000,      // 1 minute
  accepted: 300_000, // 5 minutes
  partial_fill: 600_000, // 10 minutes
  pending_cancel: 30_000, // 30 seconds
};
```

### 2.3 Fix Portfolio Value State
**File:** `server/autonomous/rebalancing-manager.ts:199`
**Action:** Update state with actual portfolio value before rebalancing
```typescript
const portfolioValue = await getActualPortfolioValue();
await updateState({ currentPortfolioValue: portfolioValue });
```

### 2.4 Add Missing Database Indexes
**Files:** `shared/schema/*.ts`
**Indexes to add:**
```sql
CREATE INDEX trades_order_id_idx ON trades(order_id);
CREATE INDEX ai_decision_features_decision_id_idx ON ai_decision_features(decision_id);
CREATE INDEX work_item_runs_work_item_id_idx ON work_item_runs(work_item_id);
CREATE INDEX debate_messages_session_id_idx ON debate_messages(session_id);
CREATE INDEX universe_technicals_symbol_ts_idx ON universe_technicals(symbol, timestamp);
```

---

## Phase 3: Feature Completion (Next Sprint)

### 3.1 Futures Trading Interface
**File:** `server/connectors/futures-broker-interface.ts`
**Options:**
1. **Implement:** Connect to Alpaca Crypto/futures API
2. **Deprecate:** Remove interface, document as unsupported
3. **Stub:** Return "feature not available" gracefully

**Recommended:** Option 3 (stub) until demand is validated

### 3.2 Input Validation Enhancement
**Action:** Add Zod validation to all route handlers
```typescript
// For each route in server/routes/*.ts
import { z } from 'zod';

const createOrderSchema = z.object({
  symbol: z.string().min(1).max(10),
  side: z.enum(['buy', 'sell']),
  qty: z.number().positive(),
  type: z.enum(['market', 'limit', 'stop', 'stop_limit']),
  limitPrice: z.number().optional(),
});

router.post('/orders', async (req, res) => {
  const result = createOrderSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }
  // ... proceed with validated data
});
```

### 3.3 Type Safety Improvements
**Action:** Replace `: any` with proper types
**Priority files:**
1. `server/routes/alpaca.ts`
2. `server/trading/alpaca-trading-engine.ts`
3. `server/connectors/alpaca.ts`
4. `server/ai/ai-analyzer.ts`

---

## Phase 4: Architecture Improvements (Backlog)

### 4.1 Table Partitioning
**Tables:** `llmCalls`, `auditLogs`, `toolInvocations`
**Strategy:** Monthly partitioning with automatic archival
```sql
-- Example for llmCalls
CREATE TABLE llm_calls_2024_12 PARTITION OF llm_calls
  FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
```

### 4.2 N+1 Query Optimization
**Pattern:** Batch loading instead of loops
```typescript
// BEFORE (N+1)
for (const decision of decisions) {
  const trade = await getTrade(decision.tradeId);
}

// AFTER (1 query)
const tradeIds = decisions.map(d => d.tradeId).filter(Boolean);
const trades = await getTradesByIds(tradeIds);
const tradeMap = new Map(trades.map(t => [t.id, t]));
```

### 4.3 Unused Component Cleanup
**Components to remove:**
- `components/ui/avatar.tsx` (0 usage)
- `components/ui/breadcrumb.tsx` (0 usage)
- `components/ui/alert-dialog.tsx` (minimal)

---

## Phase 5: Testing & Documentation

### 5.1 Add Unit Tests
**Priority areas:**
1. Order execution flow
2. AI decision processing
3. Backtest calculations
4. Authentication

### 5.2 Add Integration Tests
**Priority flows:**
1. Strategy creation → Backtest → Deploy
2. Order placement → Fill → Position update
3. AI decision → Trade execution → Outcome

### 5.3 Update Documentation
**Files to update:**
- `CLAUDE.md` - Add Product Analyst skill docs
- `README.md` - Update architecture diagram
- `docs/API.md` - Document all endpoints

---

## Implementation Order

| Week | Phase | Tasks |
|------|-------|-------|
| 1 | 1.1-1.3 | Critical bug fixes |
| 2 | 2.1-2.2 | Console logging, thresholds |
| 3 | 2.3-2.4 | Portfolio state, indexes |
| 4 | 3.1-3.2 | Futures stub, validation |
| 5 | 3.3 | Type safety |
| 6+ | 4.x, 5.x | Architecture, testing |

---

## Files to Modify

### Critical (Week 1)
- `server/routes/autonomous.ts:402`
- `server/connectors/alpaca.ts:463`
- `server/storage.ts:503`

### Major (Weeks 2-3)
- `server/connectors/alpaca.ts` (console.log removal)
- `server/trading/ai-analyzer.ts` (console.log removal)
- `server/trading/alpaca-trading-engine.ts` (thresholds)
- `server/autonomous/rebalancing-manager.ts` (state update)
- `shared/schema/*.ts` (indexes via migration)

### Enhancement (Weeks 4-5)
- `server/connectors/futures-broker-interface.ts`
- All files in `server/routes/` (validation)
- Files with `: any` types

---

## Validation Checklist

- [ ] AI quantity recommendation used in orders
- [ ] API response parsing handles all formats
- [ ] Database operations are transactional
- [ ] No console.log in production code
- [ ] Stale order thresholds are status-aware
- [ ] Portfolio value state is updated
- [ ] Database indexes added and verified
- [ ] Input validation on all routes
- [ ] Type safety improved (< 20 any types)
- [ ] Unit tests for critical paths
- [ ] Integration tests for main flows

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Critical bugs | 3 | 0 |
| Console.log in prod | 73+ | 0 |
| `: any` types | 101 | < 20 |
| Validation patterns | 27 | 80+ |
| Test coverage | ~0% | > 60% |
| Missing indexes | 5 | 0 |

---

## Resources

### Documentation Created
- `/analysis/app-structure.md` - Complete app structure
- `/analysis/gap-analysis.md` - All identified gaps
- `/analysis/component-inventory.md` - UI components
- `/analysis/api-database.md` - API & DB schema
- `/analysis/flows/authentication.md` - Auth flow
- `/analysis/flows/strategy-management.md` - Strategy flow

### Skills & Agents Available
- `/discover-app` - App structure discovery
- `/analyze-flows` - User flow mapping
- `/audit-components` - Component audit
- `/find-incomplete` - Gap detection
- `/create-spec` - Specification writing
- `/create-test-plan` - Test plan generation
- `/plan-enhancement` - Enhancement planning

### MCP Servers Configured
- postgres - Database queries
- ts-morph - TypeScript refactoring
- playwright - E2E testing
- sentry - Error tracking
- github - Issue management
- memory - Knowledge persistence
