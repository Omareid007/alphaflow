# End-to-End Flow Validation

> **Canonical document for validating the complete trading flow from AI decision to order execution and position management.**
>
> Start here: [INDEX.md](INDEX.md) | Related: [ORCHESTRATOR_AND_AGENT_RUNTIME.md](ORCHESTRATOR_AND_AGENT_RUNTIME.md), [ORDER_LIFECYCLE.md](ORDER_LIFECYCLE.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Complete Flow Diagram](#2-complete-flow-diagram)
3. [Flow Stages](#3-flow-stages)
4. [Data Linkage](#4-data-linkage)
5. [Validation Checkpoints](#5-validation-checkpoints)
6. [API Endpoints](#6-api-endpoints)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Overview

The AI Active Trader system follows a structured flow from market analysis to trade execution. This document validates that each stage is correctly linked and data flows properly through the system.

**Key Components:**
- **Orchestrator**: Coordinates analysis cycles and universe selection
- **AI Decision Engine**: Generates trade recommendations
- **Risk Gate**: Validates orders against risk limits
- **Order Execution Flow**: Submits orders to broker
- **Position Manager**: Tracks open positions

---

## 2. Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI ACTIVE TRADER E2E FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐       │
│  │  Universe  │───▶│   Market   │───▶│    AI      │───▶│   Risk     │       │
│  │  Selection │    │    Data    │    │  Decision  │    │   Gate     │       │
│  └────────────┘    └────────────┘    └────────────┘    └─────┬──────┘       │
│                                                              │               │
│                                                              ▼               │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐       │
│  │  Position  │◀───│    Fill    │◀───│   Order    │◀───│   Order    │       │
│  │   Update   │    │ Confirmation│    │  Submitted │    │  Created   │       │
│  └────────────┘    └────────────┘    └────────────┘    └────────────┘       │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Flow Stages

### 3.1 Universe Selection

**File:** `server/autonomous/orchestrator.ts` - `getAnalysisUniverseSymbols()`

| Source | Priority | Max Contribution |
|--------|----------|------------------|
| Watchlist (`universe_candidates`) | 1.0 | Unlimited |
| Approved Candidates | 1.0 | Unlimited |
| Recent AI Decisions (>0.7 confidence) | 0.8 | 100 |
| Executed Trades (recent fills) | 1.2 (boosted) | 50 |

**Safety Caps:**
- Stocks: 120 symbols per cycle
- Crypto: 20 symbols per cycle

### 3.2 Market Data Fetching

**File:** `server/autonomous/orchestrator.ts` - `fetchMarketData()`

**Provider Chain:**
1. **Alpaca Batch Snapshots** (primary) - 50 symbols per chunk
2. **Finnhub Quotes** (fallback) - Limited to 30 symbols
3. **CoinGecko** (crypto) - For cryptocurrency symbols

**Data Points:**
- Current price
- Daily change percentage
- Volume
- Bid/Ask spread (when available)

### 3.3 AI Decision Generation

**File:** `server/ai/decision-engine.ts`

**Input:**
- Symbol and market data
- News context
- Technical indicators
- Strategy context

**Output (`AiDecision`):**
```typescript
{
  id: string;
  symbol: string;
  action: "buy" | "sell" | "hold";
  confidence: number; // 0.0 - 1.0
  reasoning: string;
  status: "pending" | "approved" | "executed" | "skipped";
  linkedOrderId?: string;
  linkedTradeId?: string;
}
```

### 3.4 Risk Gate

**File:** `server/trading/order-execution-flow.ts`

**Checks:**
- Kill switch status
- Max position count
- Position size limits
- Total exposure limits
- Daily loss limits

**Outcomes:**
- `approved`: Order proceeds to submission
- `rejected`: Order blocked with reason

### 3.5 Order Submission

**File:** `server/connectors/alpaca.ts`

**Order Types:**
- Market orders (default)
- Limit orders (for specific price targets)

**Order Fields:**
```typescript
{
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit";
  time_in_force: "day" | "gtc" | "ioc";
  client_order_id: string; // Links to AiDecision
}
```

### 3.6 Fill Confirmation

**File:** `server/trading/alpaca-stream.ts`

**Events:**
- `new`: Order acknowledged
- `fill`: Order fully executed
- `partial_fill`: Order partially executed
- `canceled`: Order canceled
- `rejected`: Order rejected by broker

### 3.7 Position Update

**File:** `server/storage.ts`

**Updates:**
- Create/update position record
- Update AiDecision with linkedTradeId
- Record trade in trades table

---

## 4. Data Linkage

### 4.1 Linkage Chain

```
AiDecision.id ──▶ Order.aiDecisionId ──▶ Trade.orderId ──▶ Position.symbol
     │                    │                    │
     │                    │                    │
     └─────── linkedOrderId ─────────── linkedTradeId
```

### 4.2 Linkage Fields

| Table | Field | Links To |
|-------|-------|----------|
| `ai_decisions` | `linkedOrderId` | `orders.id` |
| `ai_decisions` | `linkedTradeId` | `trades.id` |
| `orders` | `aiDecisionId` | `ai_decisions.id` |
| `orders` | `clientOrderId` | Alpaca order ID |
| `trades` | `orderId` | `orders.id` |
| `positions` | `symbol` | Symbol match |

### 4.3 Enriched Decision Query

```sql
SELECT 
  d.*,
  o.id as order_id,
  o.status as order_status,
  o.filled_avg_price,
  t.id as trade_id,
  t.quantity as trade_qty,
  p.qty as position_qty,
  p.avg_entry_price
FROM ai_decisions d
LEFT JOIN orders o ON d."linkedOrderId" = o.id OR o."aiDecisionId" = d.id
LEFT JOIN trades t ON d."linkedTradeId" = t.id OR t."orderId" = o.id
LEFT JOIN positions p ON d.symbol = p.symbol
WHERE d.id = ?
```

---

## 5. Validation Checkpoints

### 5.1 Pre-Flight Checks

| Checkpoint | Validation | Expected |
|------------|------------|----------|
| Universe Size | `symbols.length <= 140` | True |
| Market Data | `Object.keys(marketData).length > 0` | True |
| AI Response | `decision.action in ['buy', 'sell', 'hold']` | True |
| Risk Check | `riskResult.approved` | True (for valid trades) |

### 5.2 Post-Execution Checks

| Checkpoint | Validation | Expected |
|------------|------------|----------|
| Order Created | `order.id exists` | True |
| Decision Linked | `decision.linkedOrderId = order.id` | True |
| Fill Recorded | `trade.orderId = order.id` | True |
| Position Updated | `position.qty reflects trade` | True |

### 5.3 Timeline Validation

Each decision should have a complete timeline:

| Stage | Status | When |
|-------|--------|------|
| Decision | Completed | Always (AI generates) |
| Risk Gate | Completed/Failed | After risk check |
| Order | Completed | If risk passed |
| Fill | Completed/Pending | After broker response |
| Position | Completed | After fill |
| Exit | Completed/Pending | When position closed |

---

## 6. API Endpoints

### 6.1 Enriched Decisions

```
GET /api/ai-decisions/enriched?limit=100
```

**Response:**
```json
{
  "enrichedDecisions": [
    {
      "decision": { ... },
      "linkedOrder": { ... },
      "linkedTrade": { ... },
      "linkedPosition": { ... },
      "timeline": [
        { "stage": "decision", "status": "completed", "timestamp": "..." },
        { "stage": "risk_gate", "status": "completed", "timestamp": "..." },
        { "stage": "order", "status": "completed", "timestamp": "..." },
        { "stage": "fill", "status": "completed", "timestamp": "..." },
        { "stage": "position", "status": "completed", "timestamp": "..." },
        { "stage": "exit", "status": "pending", "timestamp": null }
      ]
    }
  ]
}
```

### 6.2 Decision History

```
GET /api/ai-decisions/history?limit=200
```

### 6.3 Orders by Decision

```
GET /api/orders?aiDecisionId=<decision_id>
```

---

## 7. Troubleshooting

### 7.1 Decision Not Linked to Order

**Symptoms:**
- `linkedOrderId` is null
- Decision shows "suggested" status

**Causes:**
- Decision was for "hold" action (no order needed)
- Risk gate rejected the trade
- Order submission failed

**Resolution:**
1. Check decision action (hold = no order)
2. Check orchestrator logs for risk rejection
3. Check Alpaca connector logs for submission errors

### 7.2 Order Not Linked to Trade

**Symptoms:**
- `linkedTradeId` is null
- Order shows "submitted" but no fill

**Causes:**
- Order still pending (market closed)
- Order was canceled
- Order was rejected by broker

**Resolution:**
1. Check order status in Alpaca dashboard
2. Check alpaca-stream logs for fill events
3. Manually reconcile with `/api/orders/reconcile`

### 7.3 Position Mismatch

**Symptoms:**
- Position qty doesn't match expected fills
- Multiple trades for same symbol not aggregated

**Resolution:**
1. Sync positions from broker: `POST /api/positions/sync`
2. Check for partial fills
3. Verify position averaging logic

### 7.4 Universe Not Expanding

**Symptoms:**
- Same symbols analyzed every cycle
- New candidates not included

**Resolution:**
1. Check `universe_candidates` table for approved symbols
2. Verify orchestrator logs show universe sources
3. Check safety caps aren't being hit

---

## When to Update This Document

Update this document when:
- Adding new stages to the execution flow
- Modifying linkage between tables
- Adding new validation checkpoints
- Changing API response formats
- Adding troubleshooting scenarios

---

*Last Updated: December 2025*
*Version: 1.0.0*
