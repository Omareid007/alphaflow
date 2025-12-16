# Order Lifecycle Documentation

> **Canonical document for the Broker Order → Fill lifecycle model.**

## P1 Implementation Status (Complete)

| Component | Status | Location |
|-----------|--------|----------|
| P1.0 Orders/Fills Schema | DONE | `shared/schema.ts` |
| P1.1 Work Queue Handler | DONE | `server/lib/work-queue.ts` (ORDER_SUBMIT) |
| P1.2 Alpaca WebSocket Stream | DONE | `server/trading/alpaca-stream.ts` |
| P1.3 REST APIs | DONE | `server/routes.ts` (GET/POST orders, fills, sync) |
| P1.4 UI Source Badge | DONE | `client/screens/AdminHubScreen.tsx` (Orders module) |
| P1.5 Admin Consolidation | DONE | `client/screens/AdminHubScreen.tsx` (13+ modules) |

## Overview

This document defines the complete order lifecycle from AI decision to broker fill execution. The system maintains clear separation between:

1. **AI Trade Intents** (`trades` table) - What the AI decided to do
2. **Broker Orders** (`orders` table) - What was submitted to the broker
3. **Fills** (`fills` table) - What actually executed

## Source of Truth

**Alpaca Paper Trading API** is the single source of truth for all live order and position data. The database serves as a cache and audit trail.

## Order Status State Machine

### Canonical Status Values

```
                    ┌─────────────────────────────────────────┐
                    │           ORDER LIFECYCLE               │
                    └─────────────────────────────────────────┘

    [AI Decision]
         │
         ▼
   ┌───────────┐     ┌───────────┐     ┌───────────┐
   │  PLANNED  │ ──> │  QUEUED   │ ──> │ SUBMITTED │
   │ (internal)│     │ (work item│     │ (sent to  │
   └───────────┘     │ created)  │     │  Alpaca)  │
                     └───────────┘     └───────────┘
                                              │
                  ┌───────────────────────────┼───────────────────────────┐
                  │                           │                           │
                  ▼                           ▼                           ▼
         ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
         │   REJECTED    │           │   ACCEPTED    │           │ PENDING_NEW   │
         │ (broker error)│           │  (new/open)   │           │ (in transit)  │
         └───────────────┘           └───────────────┘           └───────────────┘
                                              │
                         ┌────────────────────┼────────────────────┐
                         │                    │                    │
                         ▼                    ▼                    ▼
                ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
                │   CANCELED    │    │PARTIALLY_FILLED│    │    FILLED     │
                │ (user cancel) │    │  (partial)     │    │  (complete)   │
                └───────────────┘    └───────────────┘    └───────────────┘
                                              │
                                              ▼
                                     ┌───────────────┐
                                     │    FILLED     │
                                     │  (complete)   │
                                     └───────────────┘
```

### Alpaca Status to Internal Status Mapping

| Alpaca Status | Internal Status | Description |
|---------------|-----------------|-------------|
| `new` | `new` | Order created but not yet accepted |
| `accepted` | `accepted` | Order accepted by exchange |
| `pending_new` | `pending_new` | Order in transit to exchange |
| `partially_filled` | `partially_filled` | Some shares filled |
| `filled` | `filled` | All shares filled |
| `canceled` | `canceled` | Order canceled by user |
| `rejected` | `rejected` | Order rejected by broker/exchange |
| `expired` | `expired` | Order expired (EOD, GTC timeout) |
| `replaced` | `replaced` | Order replaced by another |
| `pending_cancel` | `pending_cancel` | Cancel request pending |
| `pending_replace` | `pending_replace` | Replace request pending |
| `stopped` | `stopped` | Order stopped (stop order triggered) |
| `suspended` | `suspended` | Order suspended |
| `calculated` | `calculated` | Order being calculated |
| `done_for_day` | `done_for_day` | Order done for today |

## Database Schema

### Orders Table

```sql
CREATE TABLE orders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  broker TEXT NOT NULL,                    -- 'alpaca'
  broker_order_id TEXT NOT NULL UNIQUE,    -- Alpaca order ID
  client_order_id TEXT UNIQUE,             -- Our idempotency key
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,                      -- 'buy' | 'sell'
  type TEXT NOT NULL,                      -- 'market' | 'limit' | 'stop' | 'stop_limit'
  time_in_force TEXT,                      -- 'day' | 'gtc' | 'ioc' | 'fok'
  qty NUMERIC,
  notional NUMERIC,
  limit_price NUMERIC,
  stop_price NUMERIC,
  status TEXT NOT NULL,
  submitted_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  filled_at TIMESTAMP,
  filled_qty NUMERIC,
  filled_avg_price NUMERIC,
  trace_id TEXT,                           -- Links to orchestrator cycle
  decision_id VARCHAR REFERENCES ai_decisions(id),
  trade_intent_id VARCHAR REFERENCES trades(id),
  work_item_id VARCHAR REFERENCES work_items(id),
  raw_json JSONB,                          -- Full Alpaca order snapshot
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX orders_broker_order_id_idx ON orders(broker_order_id);
CREATE INDEX orders_client_order_id_idx ON orders(client_order_id);
CREATE INDEX orders_symbol_idx ON orders(symbol);
CREATE INDEX orders_status_idx ON orders(status);
CREATE INDEX orders_trace_id_idx ON orders(trace_id);
CREATE INDEX orders_decision_id_idx ON orders(decision_id);
```

### Fills Table

```sql
CREATE TABLE fills (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  broker TEXT NOT NULL,
  broker_order_id TEXT NOT NULL,           -- Links to Alpaca order
  broker_fill_id TEXT UNIQUE,              -- Alpaca fill ID (if provided)
  order_id VARCHAR REFERENCES orders(id),  -- Links to our orders table
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  trace_id TEXT,
  raw_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX fills_broker_order_id_idx ON fills(broker_order_id);
CREATE INDEX fills_order_id_idx ON fills(order_id);
CREATE INDEX fills_symbol_idx ON fills(symbol);
CREATE INDEX fills_trace_id_idx ON fills(trace_id);
```

## API Endpoints

### Order Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/orders` | GET | List orders from database with source metadata |
| `/api/orders/:id` | GET | Single order with associated fills |
| `/api/orders/sync` | POST | Trigger manual sync from Alpaca |

### Fill Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fills` | GET | List all fills |
| `/api/fills/order/:orderId` | GET | Fills for specific order |

### Example Response

```json
{
  "orders": [
    {
      "id": "4ae7c65c-675f-412f-861a-83684b8eedde",
      "broker": "alpaca",
      "brokerOrderId": "e26bd245-c524-485e-ad0d-4f82f0498e27",
      "clientOrderId": "566738af601ab5b6d4dc8cce17fc05cf",
      "symbol": "JPM",
      "side": "sell",
      "type": "market",
      "status": "canceled",
      "submittedAt": "2025-12-16T05:05:10.949Z",
      "traceId": "reconcile-1765874219975",
      "workItemId": "a75f42c5-8fff-4105-b155-2afdbb3a2c12",
      "rawJson": { ... }
    }
  ],
  "source": "database",
  "fetchedAt": "2025-12-16T08:45:00.000Z"
}
```

## Sync Mechanisms

### 1. Work Queue ORDER_SUBMIT Handler

When an order is submitted:
1. Work queue creates ORDER_SUBMIT work item with idempotency key
2. Handler calls Alpaca POST /v2/orders
3. On success, upserts to `orders` table with broker response
4. Links workItemId for full traceability

### 2. Work Queue ORDER_SYNC Handler (Background Reconciliation)

Runs periodically (5-minute interval):
1. Fetches open orders from Alpaca: GET /v2/orders?status=open
2. Fetches recent closed orders: GET /v2/orders?status=closed&after={24h_ago}
3. Upserts each order to `orders` table (by brokerOrderId)
4. Creates fill records for filled orders
5. Updates traceId with reconcile prefix

### 3. WebSocket Trade Updates (Real-time)

Alpaca WebSocket stream at `server/trading/alpaca-stream.ts`:
1. Subscribes to trade_updates channel
2. Receives real-time order status changes (new, fill, partial_fill, canceled, etc.)
3. Upserts order to database
4. Creates fill record for fill/partial_fill events

## Traceability Chain

Every order can be traced back to its origin:

```
Orchestrator Cycle (traceId: cyc-xxxx)
    │
    ├── AI Decision (ai_decisions.traceId)
    │       │
    │       ├── LLM Calls (llm_calls.traceId)
    │       │
    │       └── Trade Intent (trades.traceId)
    │               │
    │               └── Work Item (work_items.id, payload.traceId)
    │                       │
    │                       └── Broker Order (orders.traceId, orders.workItemId)
    │                               │
    │                               └── Fills (fills.traceId, fills.orderId)
```

## UI Representation

### Orders Module in Admin Hub

The Admin Hub includes an Orders module showing:
- Status filter buttons (All, New, Filled, Partially Filled, Canceled, Rejected)
- Sync button to trigger manual reconciliation
- Expandable order rows showing:
  - Broker Order ID
  - Trace ID (clickable for full trace view)
  - Decision ID (links to AI decision)
  - Associated fills with qty and price

### Portfolio Screen

Shows positions from Alpaca with:
- Real-time price updates
- P&L calculations
- Open orders for each position

## Files

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Orders and fills table definitions |
| `server/lib/work-queue.ts` | ORDER_SUBMIT and ORDER_SYNC handlers |
| `server/trading/alpaca-stream.ts` | WebSocket trade updates listener |
| `server/routes.ts` | API endpoints for orders and fills |
| `client/screens/AdminHubScreen.tsx` | Orders module UI |

---

*Last updated: December 2025*
