# Documentation vs Implementation Gap Analysis

> **Audit Date:** December 2025
> **Scope:** Phase 0+1 Infrastructure Audit
> **Goal:** Identify discrepancies between documented features and actual implementation
> **Last Updated:** December 15, 2025

---

## Executive Summary

This audit identified **3 critical gaps** and **2 moderate gaps** between documented architecture and actual implementation. **Two critical gaps have been fixed** (G2, G3). The remaining critical gap (G1) requires the **Orchestrator to use Work Queue** for durable order execution.

---

## Gap Matrix

### Critical Gaps (P0)

| ID | Documented Feature | Doc Reference | Schema | Implementation | Gap Description | Status |
|----|-------------------|---------------|--------|----------------|-----------------|--------|
| **G1** | Orchestrator uses Work Queue for durable order execution | WORK_QUEUE_ARCHITECTURE.md | ✅ work_items, work_item_runs | ❌ NOT USED | `orchestrator.ts` calls `alpaca.createOrder()` directly (~5 locations). Work queue exists but is bypassed. | **OPEN** - Requires refactor |
| **G2** | End-to-end traceId propagation | OBSERVABILITY.md, INDEX.md | ✅ trades.traceId, llm_calls.traceId, ai_decisions.traceId | ✅ FIXED | TraceId now propagated through: orchestrator cycles, background AI batches, strategy runs, manual API calls, paper trading. | **FIXED** - Primary paths complete |
| **G3** | Work Queue worker runs automatically | WORK_QUEUE_ARCHITECTURE.md | N/A | ✅ FIXED | `workQueue.startWorker()` now called in `server/routes.ts` during initialization. | **FIXED** - Worker runs on startup |

### Moderate Gaps (P1)

| ID | Documented Feature | Doc Reference | Schema | Implementation | Gap Description | Impact |
|----|-------------------|---------------|--------|----------------|-----------------|--------|
| **G4** | Orders vs Trades vs Fills distinction | TRADING_SAGA_SEQUENCES.md, SOURCE_OF_TRUTH_CONTRACT.md | ⚠️ trades only | ⚠️ CONFLATED | Only `trades` table exists. No separate `orders` or `fills` tables. `work_items.ORDER_SUBMIT` has `brokerOrderId` but lifecycle unclear. | Data model conflates intent (order) with execution (trade) with confirmation (fill) |
| **G5** | Event-driven saga patterns | TRADING_SAGA_SEQUENCES.md | N/A | ❌ FUTURE STATE | Documents NATS events like `market.quote.received`, `ai.decision.generated` but these don't exist. Orchestrator runs synchronously. | Documentation describes Phase 2 microservices, not current monolith |

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

### G1: Orchestrator Bypasses Work Queue

**Evidence:**
```typescript
// server/autonomous/orchestrator.ts (lines 984, 990, 1008, 1018, 1186)
initialOrder = await alpaca.createOrder(orderParams);
// Direct call - no work queue!
```

**Expected (per WORK_QUEUE_ARCHITECTURE.md):**
```typescript
await workQueue.enqueue({
  type: "ORDER_SUBMIT",
  payload: JSON.stringify(orderParams),
  idempotencyKey: generateIdempotencyKey({...}),
});
```

**Fix Required:** Refactor orchestrator to use work queue for all order operations.

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

## Recommendations

### Phase 0 (Immediate)
1. Verify work queue worker is running at startup
2. Add traceId generation in orchestrator
3. Wire orchestrator to use work queue for ORDER_SUBMIT

### Phase 1 (This Sprint)
1. Implement POSITION_CLOSE and DECISION_EVALUATION work item handlers (defined in schema but not processed)
2. Add traceId to all trades/orders created
3. Document actual data model lifecycle (trades table usage)

### Phase 2 (Future)
1. Consider adding `orders` table if Order→Trade distinction needed
2. Add `fills` table for broker fill confirmations
3. Implement NATS event publishing (per MICROSERVICES_ROADMAP.md)

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
