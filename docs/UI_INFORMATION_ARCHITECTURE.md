# UI Information Architecture

This document defines the canonical data contracts and patterns for UI components in the AI Active Trader platform.

## Overview

The UI layer consumes data from multiple sources:
- **Alpaca Paper Trading** (source of truth for live positions/orders)
- **Database** (audit trail for historical data)
- **AI Decision Engine** (trading recommendations)

## Canonical Data Contracts

All UI data contracts are defined in `shared/types/ui-contracts.ts`.

### Status Mappings

#### Alpaca Order Status (Broker)
The following are actual statuses returned by Alpaca API:
- `new` - Order submitted, not yet accepted
- `accepted` - Broker accepted, awaiting fill
- `pending_new` - Order queued for submission
- `partially_filled` - Some quantity filled
- `filled` - Complete fill
- `done_for_day` - No more fills today
- `canceled` - User canceled
- `expired` - Time expired
- `replaced` - Replaced by another order
- `pending_cancel` - Cancel request pending
- `pending_replace` - Replace request pending
- `stopped` - Order stopped
- `rejected` - Broker rejected
- `suspended` - Order suspended

#### Decision Status (Internal)
Maps internal decision state to display-friendly labels:
- `proposed` - AI suggested but not approved
- `approved` - Approved for execution
- `submitted` - Submitted to broker
- `accepted` - Broker accepted, awaiting fill
- `partially_filled` - Some quantity filled
- `filled` - Fully filled
- `canceled` - Canceled
- `rejected` - Broker rejected
- `skipped` - Skipped due to risk/limits
- `expired` - Time expired

### Timeline Events

The `/api/activity/timeline` endpoint provides a unified view of all activity:

```typescript
interface TimelineEvent {
  id: string;
  ts: string; // ISO timestamp
  category: "decision" | "order" | "fill" | "position" | "risk" | "system" | "data_fetch";
  title: string;
  subtitle: string | null;
  status: "success" | "pending" | "warning" | "error" | "info";
  entityLinks: {
    decisionId?: string;
    brokerOrderId?: string;
    symbol?: string;
    strategyId?: string;
    tradeId?: string;
  };
  provenance: {
    provider: string;
    cacheStatus: "fresh" | "stale" | "miss" | "unknown";
    latencyMs?: number;
  };
  details?: Record<string, unknown>;
}
```

### Ledger Items

For trade history display:

```typescript
interface LedgerItem {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  filledQty: number;
  avgFillPrice: number | null;
  status: "pending" | "filled" | "partial" | "canceled" | "rejected" | "expired";
  brokerOrderId: string;
  submittedAt: string;
  filledAt: string | null;
  strategyId: string | null;
  decisionId: string | null;
  pnl: number | null;
}
```

## API Endpoints

### Activity Timeline
```
GET /api/activity/timeline
```

Query parameters:
- `limit` (number, default: 50) - Number of events to return
- `cursor` (string, optional) - Cursor for pagination
- `category` (string, optional) - Filter by category

Response:
```json
{
  "events": [...],
  "hasMore": true,
  "cursor": "...",
  "meta": {
    "alpacaConnected": true,
    "alpacaStatus": "live",
    "totalEvents": 42,
    "fetchedAt": "2025-12-15T19:00:00.000Z"
  }
}
```

### Analytics Summary
```
GET /api/analytics/summary
```

Returns aggregated analytics with broker-derived counts:
- `totalTrades` - Only counts filled/completed trades (not pending)
- `closedTradesCount` - Sell trades with realized P&L
- `openPositions` - Live from Alpaca
- `unrealizedPnl` - Live from Alpaca positions

## Component Architecture

### ActivityFlowWidget
Location: `client/components/ActivityFlowWidget.tsx`

Uses the unified timeline endpoint to display real-time activity with:
- Category-based icons (decision, order, fill, etc.)
- Status indicators (success, pending, warning, error)
- Provenance badges (data source, cache status)
- Broker connectivity indicator

### AI Suggested Trades Screen
Location: `client/screens/AISuggestedTradesScreen.tsx`

Status display maps to proper broker states:
- Shows FILLED, PENDING, SUBMITTED, ACCEPTED, etc.
- Color-coded status badges
- Supports all Alpaca order statuses

## Source of Truth Contract

Per `docs/SOURCE_OF_TRUTH_CONTRACT.md`:

1. **Live Data** - Always from Alpaca:
   - Current positions
   - Open orders
   - Account balance
   - Unrealized P&L

2. **Historical Data** - From database:
   - Closed trades (audit trail)
   - AI decisions
   - Strategy configuration
   - Realized P&L calculations

3. **Provenance Metadata** - All API responses include:
   - `_source` indicating data freshness
   - `alpacaStatus` for broker connectivity
   - `fetchedAt` timestamp

## Deprecated Patterns

The following patterns are deprecated:
- Using `pending_execution` as a status (use `pending` or `submitted`)
- Fetching trades and decisions separately for activity display (use timeline endpoint)
- Counting all database trades for analytics (filter by filled status)

## Files Changed in Refactoring

1. `shared/types/ui-contracts.ts` - Canonical UI type definitions
2. `server/routes.ts` - Added `/api/activity/timeline` endpoint
3. `client/components/ActivityFlowWidget.tsx` - Uses timeline endpoint
4. `client/screens/AISuggestedTradesScreen.tsx` - Proper status mapping
5. Deleted `client/navigation/MainTabNavigator26.tsx` - Unused duplicate
