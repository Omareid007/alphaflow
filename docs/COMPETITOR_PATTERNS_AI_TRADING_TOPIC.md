# AI Trading Platform Patterns

> **Reusable patterns adopted from industry best practices for AI-powered trading systems.**

## Overview

This document maps proven AI trading platform patterns to our AI Active Trader implementation. The goal is to provide a single coherent workflow from signal generation through order execution, with full traceability and explainability.

## Core Patterns Adopted

### 1. Modular Microservices/Modules Architecture

**Pattern**: Separate concerns into discrete, independently manageable modules with clear boundaries.

| Module | Purpose | Implementation File(s) |
|--------|---------|------------------------|
| Universe Management | Asset universe sourcing and filtering | `server/universe/alpacaUniverse.ts` |
| Signal Generation | Technical/fundamental signal processing | `server/ai/fusion.ts`, `server/data-processing/` |
| LLM Decision Engine | AI-powered trade decisions | `server/ai/llmGateway.ts` |
| Order Management | Durable order submission/tracking | `server/lib/work-queue.ts` |
| Position Tracking | Live position monitoring | `server/trading/alpaca-stream.ts` |
| Risk Management | Enforcement gates and controls | `server/universe/tradingEnforcement.ts` |
| Observability | Traces, alerts, work queue monitoring | `server/observability/` |

### 2. Broker as Single Source of Truth

**Pattern**: The broker (Alpaca) is authoritative for live order/position data; internal database serves as cache and audit trail.

| Data Type | Source of Truth | Cache Location | Sync Mechanism |
|-----------|-----------------|----------------|----------------|
| Open Orders | Alpaca API | `orders` table | WebSocket + 5-min reconciler |
| Fills | Alpaca API | `fills` table | WebSocket events |
| Positions | Alpaca API | `positions` table | Orchestrator sync |
| Account Balance | Alpaca API | In-memory | Real-time API calls |
| AI Decisions | Internal | `ai_decisions` table | Direct insert |
| Trade Intents | Internal | `trades` table | Direct insert |

**Implementation**: `docs/SOURCE_OF_TRUTH_CONTRACT.md`

### 3. End-to-End Trace Chain (TraceId Propagation)

**Pattern**: Every action carries a trace identifier linking it across the entire lifecycle.

```
Orchestrator Cycle (traceId: cyc-xxxx)
    ├── AI Decision (ai_decisions.traceId)
    │       ├── LLM Calls (llm_calls.traceId)
    │       └── Trade Intent (trades.traceId)
    │               └── Work Item (work_items.payload.traceId)
    │                       └── Broker Order (orders.traceId)
    │                               └── Fills (fills.traceId)
```

**TraceId Prefixes**:
- `cyc-*`: Orchestrator cycles
- `batch-*`: Background AI batches
- `run-*`: Strategy runs
- `api-*`: Manual API calls
- `reconcile-*`: Background reconciliation

**Implementation**: 
- Generation: `server/autonomous/orchestrator.ts`
- Propagation: All handlers pass traceId in context
- Query: `GET /api/admin/trace/:traceId`

### 4. Durable Work Queue with Idempotency

**Pattern**: Critical operations go through a PostgreSQL-backed work queue with retry logic and dead-letter handling.

| Feature | Implementation |
|---------|----------------|
| Idempotency Keys | MD5 hash of (symbol, side, 5-minute bucket) |
| Retry Strategy | Exponential backoff (max 3 attempts) |
| Dead Letter Queue | Failed items after max retries |
| Error Classification | Transient vs permanent failures |

**Work Item Types**:
- `ORDER_SUBMIT`: Submit order to Alpaca
- `ORDER_SYNC`: Reconcile orders/fills from Alpaca

**Implementation**: `server/lib/work-queue.ts`, `docs/WORK_QUEUE_ARCHITECTURE.md`

### 5. LLM Router with Fallback Chains

**Pattern**: Route LLM calls based on criticality with automatic fallback.

| Criticality | Primary Model | Fallback Chain |
|-------------|---------------|----------------|
| Critical | GPT-4 | Claude → Gemini → GPT-3.5 |
| High | GPT-4-mini | Groq → Together |
| Medium | GPT-4-mini | Groq → Together |
| Low | Groq Llama | Together → GPT-3.5 |

**Role-Based Routing**:
- `trade_executor`: Critical (order decisions)
- `technical_analyst`: Medium (market analysis)
- `risk_manager`: High (position sizing)
- `news_analyst`: Low (sentiment analysis)

**Implementation**: `server/ai/llmGateway.ts`, `server/lib/llmRouter.ts`

### 6. Dashboard Timeline View

**Pattern**: Unified activity timeline showing all system events with provenance.

**Timeline Event Categories**:
- `decision`: AI trade decisions
- `order`: Broker order submissions
- `fill`: Execution confirmations
- `position`: Position changes
- `risk`: Risk events/alerts
- `system`: System status changes
- `data_fetch`: Data provider activity

**Implementation**: 
- Endpoint: `GET /api/activity/timeline`
- Component: `client/components/ActivityFlowWidget.tsx`
- Admin: ObservabilityModule Traces tab

### 7. WordPress-Style Admin Hub

**Pattern**: Single admin interface with sidebar navigation covering all system aspects.

| Admin Module | Purpose | Backend Endpoint |
|--------------|---------|------------------|
| Overview | System health dashboard | `/api/connectors/status` |
| Providers & Budgets | API rate limits, cache | `/api/admin/budgets/*` |
| LLM Router | Model config, fallbacks | `/api/admin/router/*` |
| Orchestrator | Pause/resume, run controls | `/api/admin/orchestrator/*` |
| Orders | Order lifecycle, fills | `/api/orders`, `/api/fills` |
| Positions | Live broker positions | `/api/positions` |
| Universe | Asset universe management | `/api/admin/universe/*` |
| Fundamentals | Company data | `/api/admin/fundamentals/*` |
| Candidates | Approval workflow | `/api/admin/candidates/*` |
| Enforcement | Trading gate stats | `/api/admin/enforcement/*` |
| Allocation | Portfolio policies | `/api/admin/allocation/*` |
| Rebalancer | Rebalancing controls | `/api/admin/rebalancer/*` |
| Observability | Traces, queue, alerts | `/api/admin/observability/*` |

**Implementation**: `client/screens/AdminHubScreen.tsx`

## UI/Data Flow Mapping

### Canonical Workflow Screen

The primary user-facing workflow is displayed across these screens:

| Screen | Purpose | Data Source |
|--------|---------|-------------|
| HomeScreen | Portfolio overview | `/api/positions` (Alpaca live) |
| AISuggestedTradesScreen | AI recommendations | `/api/ai-decisions/history` |
| AutoScreen | Auto-trading controls | `/api/strategies` |
| AnalyticsScreen | Performance + ledger | `/api/analytics/summary`, `/api/orders` |
| AdminHubScreen | System administration | Various admin endpoints |

### Orders → Fills → P&L Flow

```
/api/orders (broker-synced)
    └── Each order has brokerOrderId
            └── /api/fills?orderId=xxx
                    └── P&L calculated from fill prices vs entry
```

## Patterns Intentionally NOT Implemented (This Iteration)

| Pattern | Reason |
|---------|--------|
| Multi-broker support | Focus on Alpaca paper trading first |
| Real-money trading | Safety: paper trading only |
| Custom strategy DSL | UI-based strategy builder sufficient |
| High-frequency trading | Focus on swing/position trading |
| Social trading/copy trades | Out of scope |
| Backtesting live integration | Separate backtesting engine exists |
| Mobile push notifications | Focus on in-app experience |
| Multi-user collaboration | Single-user focus |

## File References

### Core Data Flow
- `shared/schema.ts`: Database schema (orders, fills, trades, ai_decisions)
- `shared/types/ui-contracts.ts`: Canonical UI type definitions
- `server/routes.ts`: All API endpoints

### Trading Engine
- `server/trading/alpaca-trading-engine.ts`: Strategy execution
- `server/trading/alpaca-stream.ts`: WebSocket trade updates
- `server/autonomous/orchestrator.ts`: Background orchestration

### Admin Interface
- `client/screens/AdminHubScreen.tsx`: Admin hub (13 modules)
- `client/screens/AnalyticsScreen.tsx`: Analytics with OrdersTable + TradeLedger
- `client/components/OrdersTable.tsx`: Orders display component

### Documentation
- `docs/ORDER_LIFECYCLE.md`: Order state machine
- `docs/SOURCE_OF_TRUTH_CONTRACT.md`: Data authority rules
- `docs/TRADING_SAGA_SEQUENCES.md`: Complete trading sequences
- `docs/ADMIN_ACCESS.md`: Admin access guide

---

*Last updated: December 2025*
