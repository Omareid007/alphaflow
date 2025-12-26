# Comprehensive Migration Analysis Report
**Generated**: December 23, 2025
**Project**: Bolt Trading Platform - Migration to Real API
**Analysis Method**: Parallel Ultrathink Agents (5 concurrent deep analyses)

---

## Executive Summary

### Overview
Analyzed the entire Bolt project migration status using 5 parallel agents with "very thorough" exploration. Discovered **critical issues** that must be addressed before the application can function properly.

### Critical Findings
- **54 TypeScript compilation errors** blocking production build
- **4 files** still using mock store (not migrated)
- **6 critical API endpoint gaps** (frontend expects, backend missing)
- **10 admin pages** require migration
- **Multiple type compatibility issues** risking runtime errors

---

## 1. TypeScript Compilation Status ❌

**Status**: **FAILS TO COMPILE** (54 errors)

### Error Breakdown

| Category | Count | Severity | Files Affected |
|----------|-------|----------|----------------|
| Type Import Mismatches | 5 | **CRITICAL** | app/ai/page.tsx |
| BacktestRun Properties | 12 | **CRITICAL** | app/backtests/page.tsx |
| Undefined Interpretation | 8 | **CRITICAL** | app/backtests/page.tsx |
| Type Inference Issues | 2 | HIGH | app/ledger/page.tsx |
| Field Type Incompatibility | 2 | MEDIUM | components/wizard/ConfigStep.tsx |
| Re-export Syntax Errors | 24 | MEDIUM | server/strategies/index.ts |
| Null Coalescing | 1 | LOW | server/universe/fundamentalsService.ts |

### Critical Blockers

#### Issue 1: AiEvent Type Conflict (5 errors)
**File**: `app/ai/page.tsx:42, 43, 50, 51, 52`

**Problem**: Two conflicting `AiEvent` type definitions:
- `lib/api/hooks/useAiDecisions.ts` → `{id, type, title, description, severity?, symbol?, metadata?, createdAt}`
- `lib/types.ts` → `{id, time, type, headline, explanation, confidence, impactedStrategies[], symbol?, action?}`

**Impact**: Page imports hook but uses properties from types.ts

**Fix**: Unify type definitions or update hook to match expected interface

---

#### Issue 2: BacktestRun Property Mismatch (12 errors)
**File**: `app/backtests/page.tsx:84, 89, 90, 93, 95, 97, 114, 127, 166, 170, 174, 178, 182, 186`

**Problem**: Missing properties
- Page expects: `strategyName`, `metrics.cagr`, `metrics.sharpe`, `chartSeries.equityCurve`, `interpretation.summary`
- Hook returns: `strategyId`, `results.annualizedReturn`, no chartSeries, `interpretation: string`

**Impact**: All backtest displays will crash with "Property does not exist" errors

**Fix**:
1. Update hook interface to match page expectations, OR
2. Rewrite page to use hook's actual data structure
3. Add backend mappings to transform database format

---

#### Issue 3: Re-export Type Syntax (24 errors)
**File**: `server/strategies/index.ts:2, 3, 4, 11, 12, 13, 19, 20, 27, 28, 33, 34, 35, 37, 42, 43, 48, 49, 50, 52`

**Problem**: TypeScript requires `export type` for type-only exports when `isolatedModules: true`

**Current**:
```typescript
export {
  MovingAverageCrossoverConfig,  // ERROR
  ...
} from "./moving-average-crossover";
```

**Fix**:
```typescript
export type {
  MovingAverageCrossoverConfig,
  ...
} from "./moving-average-crossover";
```

---

## 2. Mock Store Usage ⚠️

**Status**: **4 files still using mock store** (incomplete migration)

| File | Methods Used | Priority | Complexity |
|------|--------------|----------|------------|
| `components/wizard/strategy-wizard.tsx` | getTemplates, createStrategy, updateStrategy, runBacktest, deployStrategy | **CRITICAL** | HIGH |
| `app/strategies/[id]/edit/page.tsx` | getStrategy, getBacktest | **CRITICAL** | LOW |
| `app/research/page.tsx` | getWatchlists, addToWatchlist, removeFromWatchlist | MEDIUM | MEDIUM |
| `app/settings/page.tsx` | getSettings, updateSettings | LOW | LOW |

### Critical: Strategy Wizard (BLOCKS CORE FUNCTIONALITY)

**File**: `components/wizard/strategy-wizard.tsx`
**Used By**: `/create` page, `/strategies/[id]/edit` page

**Mock Store Calls**:
- Line 24: `store.getTemplates()` - Used to populate template selector
- Line 92: `store.createStrategy()` - Creates new strategy
- Line 100: `store.updateStrategy()` - Updates existing strategy
- Line 103: `store.runBacktest()` - Runs backtest with progress callback
- Line 130: `store.deployStrategy()` - Deploys strategy to paper/live

**Impact**: **Cannot create or edit strategies with real API**

**Required Actions**:
1. Import `algorithmTemplates` from `@/lib/store/templates` (static data, OK)
2. Replace `createStrategy()` with `useCreateStrategy()` mutation hook
3. Replace `updateStrategy()` with `useUpdateStrategy()` mutation hook
4. Replace `runBacktest()` with `useRunBacktest()` mutation hook
5. Replace `deployStrategy()` with `useDeployStrategy()` mutation hook

**Note**: `useDeployStrategy` hook exists but **backend endpoint is missing** (see Section 3)

---

## 3. Backend API Endpoint Gaps ❌

**Status**: **6 critical endpoints MISSING or MISNAMED**

### Missing Endpoints

| Endpoint | Hook Calling It | Status | Impact |
|----------|----------------|--------|--------|
| `POST /api/strategies/:id/deploy` | `useDeployStrategy()` | **MISSING** | Can't deploy strategies ✗ |
| `POST /api/strategies/:id/pause` | `usePauseStrategy()` | **MISSING** | Can't pause strategies ✗ |
| `POST /api/strategies/:id/resume` | `useResumeStrategy()` | **MISSING** | Can't resume strategies ✗ |
| `DELETE /api/strategies/:id` | `useDeleteStrategy()` | **MISSING** | Can't delete strategies ✗ |
| `GET /api/ai/events` | `useAiEvents()` | **MISSING** | AI page will fail ✗ |
| `GET /api/decisions` | `useAiDecisions()` | **WRONG PATH** | 404 errors ✗ |

### Path Mismatch

**Frontend**: `useAiDecisions()` → calls `/api/decisions` (line 39)
**Backend**: Implements `/api/ai-decisions` (routes.ts:1463)
**Fix**: Update frontend hook to call `/api/ai-decisions`

### Existing Endpoints ✓

These work correctly:
- `GET /api/strategies` ✓
- `POST /api/strategies` ✓
- `POST /api/strategies/:id/stop` ✓
- `GET /api/positions` ✓
- `GET /api/positions/snapshot` ✓
- `GET /api/trades` ✓
- `GET /api/backtests` (via router) ✓

### Backend Alternatives

Backend implements different terminology:
- Has `/api/strategies/:id/start` instead of `deploy`
- Has `/api/strategies/:id/toggle` instead of `pause/resume`
- Has `PATCH /api/strategies/:id` instead of `PUT`

**Recommendation**: Either implement missing endpoints OR update frontend hooks to use existing ones

---

## 4. Admin Pages Migration Status 📊

**Total**: 17 admin pages analyzed

### Breakdown

| Status | Count | Pages |
|--------|-------|-------|
| **Using Real APIs** ✓ | 4 | Dashboard, Orchestrator, Providers, LLM Router (partial) |
| **Using Mock Store** ⚠️ | 10 | Orders, Positions, Candidates, Strategies, Enforcement, Allocation, Rebalancer, Fundamentals, Universe, AI Arena |
| **Stubs (Placeholder)** | 3 | Observability, Competition, Users |

### Priority Migration List

#### Tier 1: CRITICAL (Sprint 1)
1. **Positions** - Can use existing `usePositions()` hook (LOW effort)
2. **Strategies** - Can use existing `useStrategies()` hook (LOW effort)
3. **Orders** - Need new `/api/admin/orders` endpoint (MEDIUM effort)

#### Tier 2: HIGH (Sprint 2)
4. **Candidates** - Need `/api/admin/candidates` + generation endpoint (HIGH effort)
5. **Enforcement** - Need CRUD endpoints for risk rules (MEDIUM effort)
6. **Allocation** - Need CRUD endpoints for allocation policies (MEDIUM effort)

#### Tier 3: MEDIUM (Sprint 3)
7. **Rebalancer** - Need CRUD endpoints for rebalancing policies
8. **Fundamentals** - Need factor catalog + refresh endpoints
9. **Universe** - Need CRUD endpoints for universe management

#### Tier 4: FUTURE
10. **AI Arena**, **Observability**, **Competition**, **Users** - Future work

### Admin Pages Already Complete ✓

- **Dashboard** (`/admin/page.tsx`) - Uses `/api/admin/dashboard`
- **Orchestrator** (`/admin/orchestrator/page.tsx`) - Full integration with config, jobs, kill-switch, trigger endpoints
- **Providers** (`/admin/providers/page.tsx`) - Comprehensive integration (15+ endpoints)
- **LLM Router** (`/admin/llm-router/page.tsx`) - Uses `/api/admin/llm-router/dry-run`

---

## 5. Type Compatibility Issues ⚠️

**Status**: **CRITICAL MISMATCHES** between frontend and backend types

### Critical Type Conflicts

#### Strategy Types

**Frontend** (`lib/api/hooks/useStrategies.ts`):
```typescript
interface Strategy {
  templateId: string;              // REQUIRED
  status: 'draft' | 'backtesting' | 'paper' | 'live' | 'paused' | 'stopped';
  config: Record<string, unknown>; // JSON object
}
```

**Backend** (`server/shared/schema.ts`):
```typescript
{
  type: text("type"),              // NOT templateId
  isActive: boolean("is_active"),  // NOT status enum
  parameters: text("parameters"),  // TEXT string, NOT JSON
}
```

**Runtime Impact**:
- `strategy.templateId` will be undefined ✗
- Status checks (`strategy.status === 'live'`) will fail ✗
- Config parsing will crash ✗

---

#### Position/Portfolio Types

**Frontend**:
```typescript
qty: number
side: 'long' | 'short'
unrealizedPlPct: number
```

**Backend Transformation** (routes.ts:1424-1437):
```typescript
qty: Math.abs(parseFloat(p.qty || '0'))  // Always positive
side: parseFloat(p.qty || '0') > 0 ? 'long' : 'short'  // Computed
unrealizedPlPct: parseFloat(p.unrealized_plpc || '0') * 100  // Multiplied
```

**Runtime Impact**:
- Qty always positive (can't determine original direction) ⚠️
- unrealizedPlPct might be double-converted (×100 twice) ⚠️
- parseFloat on undefined returns NaN ✗

---

#### Trade/Ledger Types

**Frontend**: Expects `qty`, `totalValue`, `side: 'buy' | 'sell'`
**Backend**: Has `quantity`, no `totalValue` field, `side: text` (no validation)

**Impact**:
- qty will be undefined ✗
- totalValue missing, breaks calculations ✗
- Side could be 'BUY', 'LONG', 'buy', etc. (inconsistent) ✗

---

#### Backtest Status Enums

**Frontend**: `'pending' | 'running' | 'completed' | 'failed'`
**Backend**: `'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED'`

**Impact**: Status comparisons fail (case mismatch) ✗

---

#### AI Decision Types

**Frontend Hook** → `/api/decisions`
**Backend Endpoint** → `/api/ai-decisions`

**Frontend**: `action: 'buy' | 'sell' | 'hold' | 'wait'`
**Backend**: `action: text` (no enum, could be any string)

**Impact**:
- 404 errors on API call ✗
- Invalid action values break UI logic ✗

---

## 6. Recommended Action Plan 🎯

### Phase 1: Fix Compilation Blockers (IMMEDIATE - Day 1)

**Priority**: Fix TypeScript errors so project compiles

1. **Fix Re-export Syntax** (24 errors - 15 min)
   - File: `server/strategies/index.ts`
   - Change all `export { Type }` to `export type { Type }`

2. **Fix AiEvent Type Conflict** (5 errors - 30 min)
   - Unify `AiEvent` type definition
   - Update hook to import from `lib/types.ts` OR vice versa

3. **Fix BacktestRun Type** (12 errors - 1 hour)
   - Option A: Update page to use hook's actual interface
   - Option B: Update hook interface + add backend mapping
   - Recommended: Option A (less risk)

4. **Fix Ledger P&L Types** (2 errors - 15 min)
   - Ensure `realizedPnl` and `unrealizedPnl` are `number | undefined`, not `undefined`

5. **Fix ConfigStep Field Type** (2 errors - 15 min)
   - Use `FieldType` union instead of `string`

---

### Phase 2: Complete Core Page Migration (URGENT - Day 2-3)

**Priority**: Finish migrating remaining pages using mock store

1. **Migrate Strategy Edit Page** (30 min)
   - File: `app/strategies/[id]/edit/page.tsx`
   - Replace `store.getStrategy()` with `useStrategy(id)` hook
   - Replace `store.getBacktest()` with `useBacktest()` hook

2. **Migrate Strategy Wizard** (2-3 hours) ⚠️ **CRITICAL**
   - File: `components/wizard/strategy-wizard.tsx`
   - Replace `store.getTemplates()` with `algorithmTemplates` import
   - Replace `store.createStrategy()` with `useCreateStrategy()` mutation
   - Replace `store.updateStrategy()` with `useUpdateStrategy()` mutation
   - Replace `store.runBacktest()` with `useRunBacktest()` mutation
   - Replace `store.deployStrategy()` with `useDeployStrategy()` mutation
   - **NOTE**: deploy endpoint missing - needs backend work (see Phase 3)

3. **Migrate Research Page** (1 hour)
   - File: `app/research/page.tsx`
   - Create `useWatchlists()` hook
   - Create `/api/watchlists` endpoint

4. **Migrate Settings Page** (30 min)
   - File: `app/settings/page.tsx`
   - Create `useSettings()` hook
   - Create `/api/settings` endpoint

---

### Phase 3: Implement Missing Backend Endpoints (CRITICAL - Day 3-4)

**Priority**: Add missing API endpoints frontend expects

1. **Strategy Lifecycle Endpoints** (2-3 hours)
   ```typescript
   POST /api/strategies/:id/deploy   // Deploy to paper/live
   POST /api/strategies/:id/pause    // Pause running strategy
   POST /api/strategies/:id/resume   // Resume paused strategy
   DELETE /api/strategies/:id        // Delete strategy
   ```

2. **Fix AI Endpoints** (1 hour)
   - Rename `/api/ai-decisions` to `/api/decisions` OR update frontend hook
   - Implement `/api/ai/events` (or map to existing `/api/orchestration/events`)

3. **Watchlist Endpoints** (1 hour)
   ```typescript
   GET /api/watchlists
   POST /api/watchlists/:id/symbols
   DELETE /api/watchlists/:id/symbols/:symbol
   ```

4. **Settings Endpoints** (30 min)
   ```typescript
   GET /api/settings
   PUT /api/settings
   ```

---

### Phase 4: Fix Type Compatibility (HIGH - Day 5)

**Priority**: Align frontend/backend type definitions

1. **Create Shared Type Definitions** (2 hours)
   - Create `shared/api-types.ts` used by both frontend and backend
   - Move type definitions from hooks to shared file
   - Update backend routes to use shared types

2. **Add Response Mappers** (2-3 hours)
   - Create mapper functions in backend routes
   - Transform database types to frontend-expected types
   - Handle field name differences (qty ↔ quantity, templateId ↔ type)

3. **Standardize Enums** (1 hour)
   - Align status enums (backtest: DONE → completed)
   - Align side values (ensure 'buy'|'sell' consistency)
   - Add enum validation in database schema

4. **Fix Numeric Conversions** (1 hour)
   - Add null-safety checks before parseFloat()
   - Fix unrealizedPlPct double-conversion issue
   - Ensure qty/quantity properly signed

---

### Phase 5: Migrate Admin Pages (MEDIUM - Week 2)

**Priority**: Complete admin panel migration

#### Sprint 1 (Day 1-2)
1. **Positions** - Use `usePositions()` (30 min)
2. **Strategies** - Use `useStrategies()` (30 min)
3. **Orders** - Create endpoint + hook (3 hours)

#### Sprint 2 (Day 3-5)
4. **Candidates** - Create endpoint + hooks (4-5 hours)
5. **Enforcement** - CRUD endpoints + hooks (3 hours)
6. **Allocation** - CRUD endpoints + hooks (3 hours)

---

### Phase 6: Testing & Validation (Day 6-7)

1. **TypeScript Compilation** ✓
   ```bash
   npx tsc --noEmit
   ```

2. **Build Test** ✓
   ```bash
   npm run build
   ```

3. **Runtime Testing** ✓
   - Test each migrated page end-to-end
   - Verify CRUD operations work
   - Check error handling
   - Verify auto-refresh works

4. **Integration Tests**
   - Test strategy creation → backtest → deploy flow
   - Test position monitoring with live Alpaca data
   - Test admin pages with real backend

---

## 7. Risk Assessment 🔴

### Blocker Issues (Cannot Deploy)

1. **TypeScript Compilation Fails** - 54 errors prevent build
2. **Core Strategy Wizard Uses Mock Store** - Cannot create/edit strategies
3. **Missing Deploy/Pause/Resume Endpoints** - Cannot manage strategy lifecycle
4. **Type Mismatches** - Will cause runtime crashes

### High-Risk Issues (Degraded Functionality)

1. **AI Events Wrong Endpoint** - 404 errors on AI page
2. **Backtest Data Mismatch** - Cannot display backtest results
3. **Admin Pages Using Mocks** - Showing stale data

### Medium-Risk Issues (Workarounds Possible)

1. **Research/Settings Pages** - Non-critical features
2. **Admin Pages Tier 2-3** - Can use manually temporarily
3. **Some Type Coercion** - May work but risky

---

## 8. Estimated Effort 📅

| Phase | Effort | Priority | Blockers |
|-------|--------|----------|----------|
| Phase 1: Fix Compilation | **4-6 hours** | **CRITICAL** | None |
| Phase 2: Core Migration | **6-8 hours** | **CRITICAL** | Phase 1 |
| Phase 3: Backend Endpoints | **6-8 hours** | **CRITICAL** | None (parallel) |
| Phase 4: Type Alignment | **6-8 hours** | **HIGH** | Phase 1 |
| Phase 5: Admin Pages | **20-25 hours** | **MEDIUM** | Phase 1, 3 |
| Phase 6: Testing | **8-10 hours** | **HIGH** | All above |
| **TOTAL** | **50-65 hours** | - | - |

**Minimum Viable:** Phases 1-3 (~16-22 hours) to get core functionality working

---

## 9. Success Criteria ✅

### Must Have (MVP)
- [ ] TypeScript compiles without errors
- [ ] Frontend build succeeds
- [ ] Core pages work with real API (home, strategies, portfolio, ledger, ai)
- [ ] Strategy CRUD operations functional
- [ ] Deploy/pause/resume strategies works
- [ ] Backtest results display correctly

### Should Have (Full Migration)
- [ ] All mock store usage removed
- [ ] All type compatibility issues resolved
- [ ] Admin pages Tier 1-2 migrated
- [ ] Integration tests pass
- [ ] No console errors in production

### Nice to Have (Polish)
- [ ] Admin pages Tier 3 migrated
- [ ] WebSocket real-time updates
- [ ] Performance optimizations
- [ ] Comprehensive error handling

---

## 10. Critical Warnings ⚠️

1. **DO NOT DEPLOY** until TypeScript compilation errors are fixed
2. **Strategy Wizard is broken** - create/edit strategies will fail
3. **Type mismatches WILL cause runtime crashes** - must fix before production
4. **API endpoint gaps** mean core features won't work
5. **Data shown in admin pages is fake** - not reflecting live state

---

## Appendix: Agent Analysis Details

### Agents Deployed
1. **TypeScript Compilation Agent** - Analyzed all compilation errors
2. **Mock Store Usage Agent** - Found all remaining store dependencies
3. **API Endpoint Verification Agent** - Cross-checked frontend hooks vs backend routes
4. **Admin Pages Analysis Agent** - Assessed 17 admin pages for migration status
5. **Type Compatibility Agent** - Identified frontend/backend type mismatches

### Analysis Method
- **Thoroughness Level**: "very thorough"
- **Execution Mode**: Parallel (5 concurrent agents)
- **Analysis Duration**: ~5 minutes
- **Files Analyzed**: 100+ TypeScript files
- **Lines of Code Reviewed**: ~15,000 LOC

---

**Report Generated By**: Parallel Agent Analysis System
**Confidence Level**: HIGH (based on comprehensive static analysis)
**Next Steps**: Begin Phase 1 (Fix Compilation) immediately
