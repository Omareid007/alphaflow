# Trading Saga Sequence Diagrams

> **Purpose:** Document the event sequences and compensation flows for key trading operations.

---

## Overview

This document illustrates the saga patterns used in the AI Active Trader platform for coordinating distributed transactions across microservices.

---

## 1. Signal to Execution Saga

The complete flow from market signal detection to order execution.

```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Market  │ │Orchestr-│ │   AI    │ │ Trading │ │Analytics│ │  Event  │
│  Data   │ │  ator   │ │Decision │ │ Engine  │ │ Service │ │   Bus   │
└────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
     │           │           │           │           │           │
     │ market.quote.received │           │           │           │
     │──────────────────────────────────────────────────────────>│
     │           │           │           │           │           │
     │           │<──────────────────────────────────────────────│
     │           │ (subscribe to market.*)                       │
     │           │           │           │           │           │
     │           │ orchestrator.cycle.started                    │
     │           │──────────────────────────────────────────────>│
     │           │           │           │           │           │
     │           │ orchestrator.analysis.requested               │
     │           │──────────────────────────────────────────────>│
     │           │           │           │           │           │
     │           │           │<──────────────────────────────────│
     │           │           │ (receive analysis request)        │
     │           │           │           │           │           │
     │           │           │ [Generate Decision]               │
     │           │           │───────┐   │           │           │
     │           │           │       │   │           │           │
     │           │           │<──────┘   │           │           │
     │           │           │           │           │           │
     │           │           │ ai.decision.generated             │
     │           │           │──────────────────────────────────>│
     │           │           │           │           │           │
     │           │<──────────────────────────────────────────────│
     │           │ (receive decision)    │           │           │
     │           │           │           │           │           │
     │           │ [Validate Risk]       │           │           │
     │           │───────┐               │           │           │
     │           │       │               │           │           │
     │           │<──────┘               │           │           │
     │           │           │           │           │           │
     │           │ orchestrator.trade.requested                  │
     │           │──────────────────────────────────────────────>│
     │           │           │           │           │           │
     │           │           │           │<──────────────────────│
     │           │           │           │ (receive trade req)   │
     │           │           │           │           │           │
     │           │           │           │ [Submit to Alpaca]    │
     │           │           │           │───────┐   │           │
     │           │           │           │       │   │           │
     │           │           │           │<──────┘   │           │
     │           │           │           │           │           │
     │           │           │           │ trade.order.submitted │
     │           │           │           │──────────────────────>│
     │           │           │           │           │           │
     │           │           │           │ [Wait for Fill]       │
     │           │           │           │───────┐   │           │
     │           │           │           │       │   │           │
     │           │           │           │<──────┘   │           │
     │           │           │           │           │           │
     │           │           │           │ trade.order.filled    │
     │           │           │           │──────────────────────>│
     │           │           │           │           │           │
     │           │           │           │           │<──────────│
     │           │           │           │           │ (record)  │
     │           │           │           │           │           │
     │           │           │           │ trade.position.updated│
     │           │           │           │──────────────────────>│
     │           │           │           │           │           │
     │           │<──────────────────────────────────────────────│
     │           │ (confirm execution)   │           │           │
     │           │           │           │           │           │
     │           │ orchestrator.cycle.completed                  │
     │           │──────────────────────────────────────────────>│
     │           │           │           │           │           │
```

### Event Flow Summary

| Step | Event | Publisher | Subscribers |
|------|-------|-----------|-------------|
| 1 | `market.quote.received` | Market Data | Orchestrator, Analytics |
| 2 | `orchestrator.cycle.started` | Orchestrator | Analytics |
| 3 | `orchestrator.analysis.requested` | Orchestrator | AI Decision |
| 4 | `ai.decision.generated` | AI Decision | Orchestrator, Analytics |
| 5 | `trade.order.submitted` | Trading Engine | Orchestrator, Analytics |
| 6 | `trade.order.filled` | Trading Engine | Orchestrator, Analytics |
| 7 | `trade.position.updated` | Trading Engine | Analytics |
| 8 | `orchestrator.cycle.completed` | Orchestrator | Analytics |

---

## 2. Order Execution Saga

Detailed order lifecycle with compensation flows.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Orchestrator│     │Trading Eng. │     │   Alpaca    │     │  Analytics  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ Submit Order      │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ [Pre-Trade Check] │                   │
       │                   │────────┐          │                   │
       │                   │        │          │                   │
       │                   │<───────┘          │                   │
       │                   │                   │                   │
       │                   │ POST /orders      │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │ 200 OK (order_id) │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │ order.submitted   │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │                   │ [WebSocket: new]  │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │                   │ [WebSocket: fill] │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │ order.filled      │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │                   │ Update Position   │                   │
       │                   │───────────────────────────────────────>
       │                   │                   │                   │
       │                   │ position.updated  │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │ Saga Complete     │                   │                   │
       │ ✓                 │                   │                   │
```

### Compensation Flow (Order Rejected)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Orchestrator│     │Trading Eng. │     │   Alpaca    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ Submit Order      │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ POST /orders      │
       │                   │──────────────────>│
       │                   │                   │
       │                   │ 403 Forbidden     │
       │                   │<──────────────────│
       │                   │                   │
       │ order.rejected    │                   │
       │<──────────────────│                   │
       │                   │                   │
       │ [Log Rejection]   │                   │
       │────────┐          │                   │
       │        │          │                   │
       │<───────┘          │                   │
       │                   │                   │
       │ [Update Decision] │                   │
       │──────────────────>│                   │
       │                   │ (mark executed=false)
       │                   │                   │
       │ Saga Failed       │                   │
       │ ✗                 │                   │
```

---

## 3. Position Close Saga

Full position closure with order cancellation.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Orchestrator│     │Trading Eng. │     │   Alpaca    │     │  Analytics  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ Close Position    │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ [Get Open Orders] │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │ [Orders Found]    │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │                   │ DELETE /orders/*  │                   │
       │                   │──────────────────>│                   │
       │                   │ (cancel brackets) │                   │
       │                   │                   │                   │
       │                   │ 200 OK            │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │ orders.cancelled  │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │                   │ DELETE /position  │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │ 200 OK (close ord)│                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │                   │ [WebSocket: fill] │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │ position.closed   │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │                   │ Record P&L        │                   │
       │                   │───────────────────────────────────────>
       │                   │                   │                   │
       │ Saga Complete ✓   │                   │                   │
```

---

## 4. Portfolio Rebalance Saga

Multi-position rebalancing with drift correction.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Orchestrator│     │Trading Eng. │     │  Analytics  │     │   Alpaca    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ Get Current Weights                   │                   │
       │───────────────────────────────────────>                   │
       │                   │                   │                   │
       │ Weights Response  │                   │                   │
       │<───────────────────────────────────────                   │
       │                   │                   │                   │
       │ [Calculate Drift] │                   │                   │
       │────────┐          │                   │                   │
       │        │          │                   │                   │
       │<───────┘          │                   │                   │
       │                   │                   │                   │
       │ [For each drifted position]          │                   │
       │ ┌─────────────────────────────────────────────────────┐  │
       │ │                 │                   │               │  │
       │ │ Get Position    │                   │               │  │
       │ │────────────────>│                   │               │  │
       │ │                 │                   │               │  │
       │ │ [Check Pending] │                   │               │  │
       │ │                 │──────────────────────────────────>│  │
       │ │                 │                   │               │  │
       │ │                 │ [Cancel if exists]│               │  │
       │ │                 │──────────────────────────────────>│  │
       │ │                 │                   │               │  │
       │ │ Submit Rebal Ord│                   │               │  │
       │ │────────────────>│                   │               │  │
       │ │                 │                   │               │  │
       │ │                 │ POST /orders      │               │  │
       │ │                 │──────────────────────────────────>│  │
       │ │                 │                   │               │  │
       │ │ trade.rebalanced│                   │               │  │
       │ │<────────────────│                   │               │  │
       │ │                 │                   │               │  │
       │ └─────────────────────────────────────────────────────┘  │
       │                   │                   │                   │
       │ rebalance.complete│                   │                   │
       │──────────────────────────────────────>│                   │
       │                   │                   │                   │
```

---

## 5. AI Decision Saga

Decision generation with model fallback chain.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Orchestrator│     │ AI Decision │     │   OpenAI    │     │    Groq     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ Request Decision  │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ [Fuse Data]       │                   │
       │                   │────────┐          │                   │
       │                   │        │          │                   │
       │                   │<───────┘          │                   │
       │                   │                   │                   │
       │                   │ POST /chat/compl  │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │ 429 Rate Limited  │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │                   │ [Fallback]        │                   │
       │                   │──────────────────────────────────────>│
       │                   │                   │                   │
       │                   │ 200 OK (response) │                   │
       │                   │<──────────────────────────────────────│
       │                   │                   │                   │
       │                   │ [Parse & Validate]│                   │
       │                   │────────┐          │                   │
       │                   │        │          │                   │
       │                   │<───────┘          │                   │
       │                   │                   │                   │
       │ decision.generated│                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │                   │ model.switched    │                   │
       │                   │──────────────────────────────────────>│
       │                   │ (publish event)   │                   │
       │                   │                   │                   │
```

---

## 6. Error Recovery Patterns

### Retry with Exponential Backoff

```
┌─────────────┐     ┌─────────────┐
│   Service   │     │  External   │
└──────┬──────┘     └──────┬──────┘
       │                   │
       │ Request           │
       │──────────────────>│
       │                   │
       │ 500 Error         │
       │<──────────────────│
       │                   │
       │ [Wait 1s]         │
       │                   │
       │ Retry 1           │
       │──────────────────>│
       │                   │
       │ 500 Error         │
       │<──────────────────│
       │                   │
       │ [Wait 2s]         │
       │                   │
       │ Retry 2           │
       │──────────────────>│
       │                   │
       │ 200 OK            │
       │<──────────────────│
       │                   │
```

### Circuit Breaker Pattern

```
State: CLOSED
  │
  │ 5 failures in 1 minute
  ▼
State: OPEN ──────────────────┐
  │                           │
  │ After 30 seconds          │
  ▼                           │
State: HALF-OPEN              │
  │         │                 │
  │ Success │ Failure         │
  ▼         └─────────────────┘
State: CLOSED
```

---

## Saga State Machine

```
┌─────────┐
│ PENDING │
└────┬────┘
     │ start()
     ▼
┌─────────┐
│ RUNNING │◄────────────────────┐
└────┬────┘                     │
     │                          │
     ├── step_success() ────────┘
     │
     ├── step_failure()
     │   ▼
     │ ┌──────────────┐
     │ │ COMPENSATING │
     │ └──────┬───────┘
     │        │
     │        ├── compensate_success()
     │        │   ▼
     │        │ ┌────────┐
     │        │ │ FAILED │
     │        │ └────────┘
     │        │
     │        └── compensate_failure()
     │            ▼
     │          ┌─────────────────┐
     │          │ MANUAL_REQUIRED │
     │          └─────────────────┘
     │
     └── all_steps_complete()
         ▼
       ┌───────────┐
       │ COMPLETED │
       └───────────┘
```

---

## Event Correlation

All events in a saga share correlation metadata:

```typescript
interface SagaCorrelation {
  correlationId: string;    // Unique saga instance ID
  causationId: string;      // ID of event that caused this event
  sagaType: string;         // e.g., "order_execution"
  step: number;             // Current step in saga
  totalSteps: number;       // Total steps expected
  startedAt: string;        // Saga start time
  timeout: number;          // Max duration in ms
}
```

### Example Event Chain

```
Event 1: orchestrator.analysis.requested
  correlationId: "saga-abc123"
  causationId: null
  step: 1

Event 2: ai.decision.generated
  correlationId: "saga-abc123"
  causationId: "event-1-id"
  step: 2

Event 3: trade.order.submitted
  correlationId: "saga-abc123"
  causationId: "event-2-id"
  step: 3

Event 4: trade.order.filled
  correlationId: "saga-abc123"
  causationId: "event-3-id"
  step: 4
```
