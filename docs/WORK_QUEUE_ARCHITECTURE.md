# Work Queue Architecture

## Overview

The AI Active Trader platform uses a **durable work queue** to ensure reliable order execution, error recovery, and idempotent operations. This architecture guarantees that trading decisions survive system restarts and provides comprehensive visibility into the execution pipeline.

## Core Principles

### 1. Idempotency
Every order submission uses a unique `idempotency_key` derived from the AI decision that triggered it. This ensures:
- Duplicate orders are never submitted
- Restarts don't cause double-execution
- Each trading decision maps to exactly one order

### 2. Source of Truth
- **Alpaca Paper Trading API** is the authoritative source for all live position and order data
- The work queue tracks execution state and provides audit trails
- Database stores historical snapshots, not live state

### 3. Durable Persistence
All work items are persisted to PostgreSQL before execution, ensuring:
- Crash recovery without data loss
- Full audit trail of all execution attempts
- Dead letter queue for failed items

## Database Schema

### work_items table
```sql
CREATE TABLE work_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR NOT NULL,           -- ORDER_SUBMIT, ORDER_CANCEL, POSITION_CLOSE, ORDER_SYNC, KILL_SWITCH
  status VARCHAR NOT NULL,         -- PENDING, RUNNING, SUCCEEDED, FAILED, DEAD_LETTER
  symbol VARCHAR,
  decision_id VARCHAR,             -- Links to AI decision
  idempotency_key VARCHAR UNIQUE,  -- Prevents duplicate execution
  broker_order_id VARCHAR,         -- Alpaca order ID after submission
  payload JSONB,                   -- Order details
  result JSONB,                    -- Execution result
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_run_at TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### work_item_runs table
```sql
CREATE TABLE work_item_runs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id VARCHAR REFERENCES work_items(id),
  attempt_number INTEGER,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR,                  -- RUNNING, SUCCEEDED, FAILED
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP
);
```

## Work Item Types

| Type | Description | Retry Policy |
|------|-------------|--------------|
| `ORDER_SUBMIT` | Submit new order to Alpaca | 5 attempts, exponential backoff |
| `ORDER_CANCEL` | Cancel existing order | 3 attempts, linear backoff |
| `POSITION_CLOSE` | Close position (full or partial) | 5 attempts, exponential backoff |
| `ORDER_SYNC` | Sync orders from broker | No retry (scheduled task) |
| `KILL_SWITCH` | Emergency stop - cancel all orders | Immediate, no retry |

## Status Lifecycle

```
PENDING → RUNNING → SUCCEEDED
    ↓          ↓
    └──────────┴→ FAILED (retryable) → PENDING (with backoff)
                      ↓
                  DEAD_LETTER (max attempts exceeded or permanent error)
```

## Error Classification

### Transient Errors (Retryable)
- Rate limits (429)
- Network timeouts
- Service unavailable (503)
- Connection reset

### Permanent Errors (Dead Letter)
- Insufficient buying power
- Invalid symbol
- Account restricted
- Order already filled
- Market closed

## Retry Policy

```typescript
const calculateNextRunAt = (attempts: number, baseDelay: number = 2000): Date => {
  const exponentialDelay = baseDelay * Math.pow(2, attempts);
  const jitter = Math.random() * 1000;
  return new Date(Date.now() + exponentialDelay + jitter);
};
```

| Attempt | Delay (approx) |
|---------|----------------|
| 1 | 2s + jitter |
| 2 | 4s + jitter |
| 3 | 8s + jitter |
| 4 | 16s + jitter |
| 5 | 32s + jitter |
| Dead Letter | No more retries |

## Idempotency Key Generation

```typescript
const generateIdempotencyKey = (
  type: WorkItemType,
  symbol: string,
  decisionId?: string
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${type}_${symbol}_${decisionId || "manual"}_${timestamp}_${random}`;
};
```

For order submissions, the `idempotency_key` becomes the `client_order_id` sent to Alpaca, enabling:
- Deduplication at the broker level
- Order linking between our system and Alpaca
- Reconciliation during sync operations

## Admin API Endpoints

### GET /api/admin/work-items
View work queue status and items.

Query Parameters:
- `status` - Filter by status (PENDING, RUNNING, SUCCEEDED, FAILED, DEAD_LETTER)
- `type` - Filter by work item type
- `limit` - Number of items to return (default: 50)

Response:
```json
{
  "items": [...],
  "counts": {
    "PENDING": 0,
    "RUNNING": 0,
    "SUCCEEDED": 42,
    "FAILED": 2,
    "DEAD_LETTER": 1
  },
  "total": 45
}
```

### POST /api/admin/work-items/retry
Retry a failed or dead-lettered work item.

Request:
```json
{
  "id": "work_item_uuid"
}
```

### POST /api/admin/work-items/dead-letter
Manually move a work item to dead letter queue.

Request:
```json
{
  "id": "work_item_uuid",
  "reason": "Manual intervention required"
}
```

### GET /api/admin/orchestrator-health
Get orchestrator health status including queue depth and recent errors.

Response:
```json
{
  "isRunning": true,
  "killSwitchActive": false,
  "lastHeartbeat": "2025-12-15T19:27:00.000Z",
  "queueDepth": {
    "PENDING": 0,
    "RUNNING": 0,
    "FAILED": 2,
    "DEAD_LETTER": 1
  },
  "totalPending": 0,
  "recentErrors": [...],
  "lastUpdated": "2025-12-15T19:27:05.000Z"
}
```

## Integration with Trading Engine

The work queue integrates with the `AlpacaTradingEngine` for order execution:

1. **AI Decision Made** → `DecisionService` generates trading decision
2. **Work Item Created** → `WorkQueue.enqueue()` creates PENDING work item with idempotency key
3. **Processing** → `WorkQueue.processNext()` claims and executes the work item
4. **Alpaca Submission** → Order submitted with `client_order_id` = idempotency key
5. **Result Recorded** → Work item updated with broker order ID and result
6. **Sync Loop** → Periodic `ORDER_SYNC` reconciles broker state

## Kill Switch Integration

When the kill switch is activated:

1. All pending work items are cancelled
2. `KILL_SWITCH` work item is created
3. `alpaca.cancelAllOrders()` is called
4. Optionally, all positions are closed
5. Trading engine is paused

## Monitoring Recommendations

1. **Alert on DEAD_LETTER count > 0** - Requires manual intervention
2. **Monitor PENDING queue depth** - Should not grow continuously
3. **Track FAILED retry patterns** - May indicate systemic issues
4. **Log all KILL_SWITCH activations** - Critical audit trail

## Files

- `server/lib/work-queue.ts` - Work queue implementation
- `shared/schema.ts` - Database schema (work_items, work_item_runs)
- `server/storage.ts` - Database operations
- `server/routes.ts` - Admin API endpoints
- `server/trading/alpaca-trading-engine.ts` - Trading engine integration

## Future Enhancements

1. **NATS JetStream Integration** - For distributed work queue across microservices
2. **Priority Queue** - High-priority orders processed first
3. **Batch Processing** - Group multiple orders for efficiency
4. **Metrics Export** - Prometheus/OpenTelemetry integration
5. **Webhook Notifications** - Alert external systems on failures
