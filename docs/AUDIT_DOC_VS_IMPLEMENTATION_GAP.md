# Documentation vs Implementation Gap Analysis

> **Audit Date:** December 2025
> **Scope:** Phase 0+1 Infrastructure Audit
> **Goal:** Identify discrepancies between documented features and actual implementation
> **Last Updated:** December 15, 2025

---

## Executive Summary

This audit identified **3 critical gaps** and **2 moderate gaps** between documented architecture and actual implementation. **All 3 critical gaps have been fixed** (G1, G2, G3), and **G4 (Orders vs Trades vs Fills) has been fixed** in Phase 2.

### Phase 0+1 Fixes Completed:
- ✅ **G1**: Orchestrator now uses Work Queue for all order operations (durable execution)
- ✅ **G2**: End-to-end traceId propagation across AI decisions, LLM calls, and trades
- ✅ **G3**: Work queue worker starts automatically on server initialization

### Phase 2 Fixes Completed:
- ✅ **G4**: Orders vs Trades vs Fills separation - New `orders` and `fills` tables with proper lifecycle tracking

---

## Gap Matrix

### Critical Gaps (P0)

| ID | Documented Feature | Doc Reference | Schema | Implementation | Gap Description | Status |
|----|-------------------|---------------|--------|----------------|-----------------|--------|
| **G1** | Orchestrator uses Work Queue for durable order execution | WORK_QUEUE_ARCHITECTURE.md | ✅ work_items, work_item_runs | ✅ FIXED | All order operations now go through work queue with idempotency keys, polling, and traceId propagation. | **FIXED** - Full integration |
| **G2** | End-to-end traceId propagation | OBSERVABILITY.md, INDEX.md | ✅ trades.traceId, llm_calls.traceId, ai_decisions.traceId | ✅ FIXED | TraceId now propagated through: orchestrator cycles, background AI batches, strategy runs, manual API calls, paper trading. | **FIXED** - Primary paths complete |
| **G3** | Work Queue worker runs automatically | WORK_QUEUE_ARCHITECTURE.md | N/A | ✅ FIXED | `workQueue.startWorker()` now called in `server/routes.ts` during initialization. | **FIXED** - Worker runs on startup |

### Moderate Gaps (P1)

| ID | Documented Feature | Doc Reference | Schema | Implementation | Gap Description | Status |
|----|-------------------|---------------|--------|----------------|-----------------|--------|
| **G4** | Orders vs Trades vs Fills distinction | TRADING_SAGA_SEQUENCES.md, SOURCE_OF_TRUTH_CONTRACT.md | ✅ orders, fills tables | ✅ FIXED | Added `orders` and `fills` tables. ORDER_SUBMIT and ORDER_SYNC handlers upsert to orders table and create fills for filled orders. | **FIXED** - Full separation |
| **G5** | Event-driven saga patterns | TRADING_SAGA_SEQUENCES.md | N/A | ❌ FUTURE STATE | Documents NATS events like `market.quote.received`, `ai.decision.generated` but these don't exist. Orchestrator runs synchronously. | Documentation describes Phase 3 microservices |

### Verified Working (No Gap)

| Feature | Doc Reference | Implementation | Notes |
|---------|---------------|----------------|-------|
| Work Queue implementation | WORK_QUEUE_ARCHITECTURE.md | ✅ `server/lib/work-queue.ts` | Full implementation with retry, idempotency, dead-letter |
| LLM Gateway with traceId | AI_MODELS_AND_PROVIDERS.md | ✅ `server/ai/llmGateway.ts` | Criticality routing, fallback chains, logs to llm_calls |
| Alpaca as Source of Truth | SOURCE_OF_TRUTH_CONTRACT.md | ✅ `server/routes.ts` | Explicit comments, deprecated fallback endpoints |
| Risk limits enforcement | ORCHESTRATOR_AND_AGENT_RUNTIME.md | ✅ `orchestrator.ts` | Max position size, exposure, kill switch |
| Backtest subsystem | Schema + docs | ✅ `backtest_runs`, `backtest_trade_events`, `backtest_equity_curve` | Complete schema |
| AI Learning feedback loop | Schema | ✅ `ai_decision_features`, `ai_trade_outcomes`, `ai_calibration_log` | ML pipeline ready |

---

## Critical Gap Details

### G1: Orchestrator Uses Work Queue ✅ FIXED

**Status:** Fixed as of December 15, 2025

**Implementation:**
- Added `queueOrderExecution()` helper that enqueues ORDER_SUBMIT work items
- Added `queueOrderCancellation()` helper for ORDER_CANCEL work items
- All order operations now go through work queue with:
  - Idempotency keys (5-minute time buckets for orders, 1-minute for cancellations)
  - Polling mechanism (2s intervals, 60s timeout)
  - TraceId propagation through work item payload
  - Proper result extraction from work item result

**Order Types Covered:**
- Extended hours limit orders
- Bracket orders (with take_profit and stop_loss)
- Default market orders
- Partial close sell orders
- Order cancellations (rebalance, position close)

**Log Evidence:**
```
[Orchestrator] Queuing ORDER_SUBMIT for JPM sell {"traceId":"cyc-cpkzk44z","idempotencyKey":"..."}
[work-queue] Processing ORDER_SUBMIT for JPM sell {"traceId":"cyc-cpkzk44z"}
[work-queue] ORDER_SUBMIT succeeded: 59c3d70d-4339-4bd9-af02-5347d6a03956
[Orchestrator] ORDER_SUBMIT succeeded: 59c3d70d-4339-4bd9-af02-5347d6a03956
```

---

### G2: End-to-End TraceId Propagation ✅ FIXED

**Status:** Fixed as of December 15, 2025

**Implementation:**
- Added `traceId` field to `trades` table schema
- Orchestrator generates `cycleId` as traceId for each analysis cycle
- TraceId passed to `aiDecisionEngine.analyzeOpportunity()` options
- TraceId saved to `ai_decisions` and `trades` tables
- Background AI suggestion batches use shared `batchTraceId`
- Strategy runs use shared `runTraceId` per execution cycle
- Manual API calls and paper trading generate per-request traceId

**Current Flow:**
```
Orchestrator (cycleId/traceId)
     ↓
AI Decision Engine (traceId) → LLM Gateway (traceId) → Trade (traceId)
     ↓                             ↓                       ↓
ai_decisions.traceId          llm_calls.traceId       trades.traceId
```

**Remaining Edge Cases:**
- Some internal calibration/learning routines may still generate fresh traceIds
- Order execution flow handlers for Alpaca fills may need additional wiring

---

### G3: Work Queue Worker Startup ✅ FIXED

**Status:** Fixed as of December 15, 2025

**Implementation:**
```typescript
// server/routes.ts (initialization)
workQueue.startWorker();
log.info("Routes", "Work queue worker started with 5s poll interval");
```

**Verification:** Worker confirmed running in server logs.

---

### G4: Orders vs Trades vs Fills Separation ✅ FIXED

**Status:** Fixed as of December 15, 2025

**Implementation:**

1. **New `orders` table** (22 fields):
   - brokerOrderId (unique), clientOrderId (unique)
   - symbol, side, type, timeInForce, qty, notional
   - limitPrice, stopPrice, status
   - submittedAt, updatedAt, filledAt, filledQty, filledAvgPrice
   - traceId, decisionId (FK), tradeIntentId (FK), workItemId (FK)
   - rawJson (full Alpaca order snapshot)

2. **New `fills` table** (12 fields):
   - brokerOrderId, brokerFillId (unique)
   - orderId (FK to orders)
   - symbol, side, qty, price, occurredAt
   - traceId, rawJson

3. **Updated ORDER_SUBMIT handler**:
   - Upserts order to `orders` table after successful Alpaca submission
   - Links workItemId for full traceability

4. **Updated ORDER_SYNC handler**:
   - Fetches open/closed orders from Alpaca
   - Upserts each to `orders` table
   - Creates fill records for filled orders

5. **New API endpoints**:
   - `GET /api/orders` - Orders from database with source metadata
   - `GET /api/orders/:id` - Single order with fills
   - `GET /api/fills` - All fills
   - `GET /api/fills/order/:orderId` - Fills for specific order
   - `POST /api/orders/sync` - Trigger manual sync

**Data Model Distinction:**
- `trades` table = AI trade intents (what the AI decided to do)
- `orders` table = Broker order lifecycle (what was actually submitted)
- `fills` table = Execution confirmations (what actually happened)

---

## Recommendations

### Phase 0+1 (COMPLETED)
1. ✅ Verify work queue worker is running at startup
2. ✅ Add traceId generation in orchestrator
3. ✅ Wire orchestrator to use work queue for ORDER_SUBMIT
4. ✅ Add traceId to all trades/orders created

### Phase 2 (COMPLETED)
1. ✅ Added `orders` table for Order→Trade distinction
2. ✅ Added `fills` table for broker fill confirmations
3. ✅ ORDER_SUBMIT/ORDER_SYNC handlers upsert to orders table
4. ✅ Created new API endpoints for orders/fills

### Phase 3 (Future)
1. Implement POSITION_CLOSE and DECISION_EVALUATION work item handlers (defined in schema but not processed)
2. Implement NATS event publishing (per MICROSERVICES_ROADMAP.md)
3. UI improvements to display order lifecycle and fills

---

## Files Audited

| File | Purpose | Status |
|------|---------|--------|
| `shared/schema.ts` | Database schema | ✅ Reviewed |
| `server/lib/work-queue.ts` | Work queue implementation | ✅ Reviewed |
| `server/ai/llmGateway.ts` | LLM routing | ✅ Reviewed |
| `server/autonomous/orchestrator.ts` | Trading orchestrator | ⚠️ Has gaps |
| `server/routes.ts` | API routes | ✅ Reviewed |
| `docs/WORK_QUEUE_ARCHITECTURE.md` | Work queue docs | ✅ Reviewed |
| `docs/SOURCE_OF_TRUTH_CONTRACT.md` | SoT contract | ✅ Reviewed |
| `docs/TRADING_SAGA_SEQUENCES.md` | Saga patterns | ✅ Reviewed (future state) |
| `docs/ORCHESTRATOR_AND_AGENT_RUNTIME.md` | Orchestrator docs | ✅ Reviewed |
| `docs/MICROSERVICES_ROADMAP.md` | Migration plan | ✅ Reviewed |

---

*Generated by Phase 0 Infrastructure Audit*
