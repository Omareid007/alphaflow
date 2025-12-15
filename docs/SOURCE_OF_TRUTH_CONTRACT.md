# Source of Truth Contract: Alpaca Paper Trading

## Overview

This document establishes **Alpaca Paper Trading** as the **single source of truth** for all live position and order data in the AI Active Trader platform. The local PostgreSQL database serves as a **cache and audit trail**, not as the authoritative source for live trading state.

## Design Principles

### 1. Alpaca is Primary
- All position and order data displayed in the UI **MUST** come from Alpaca API
- Live market prices, quantities, and P&L are always fetched from Alpaca
- The database stores historical snapshots for auditing, not live state

### 2. Database is Cache/Audit Trail
- Position sync is **write-behind**: Alpaca data synced to DB asynchronously after successful API calls
- Database positions are used **only for**:
  - Historical analysis and reporting
  - Audit trails and compliance logging
  - Fallback **with explicit staleness warning** when Alpaca is unavailable
- DB data is **never authoritative** for live trading decisions

### 3. Explicit Data Source Labeling
All API responses containing position/order data **MUST** include:
```typescript
interface DataSourceMetadata {
  source: 'alpaca_live' | 'cache_stale' | 'unavailable';
  fetchedAt: string;       // ISO timestamp
  cacheAge?: number;       // Milliseconds since last sync (if cache)
  isStale: boolean;        // True if data may not reflect live state
}
```

### 4. No Mixed Engine Usage
- UI-facing endpoints use **only** the Alpaca trading engine
- The local paper-trading-engine is deprecated for live operations
- Legacy `/api/paper/*` endpoints redirect to Alpaca equivalents

## API Endpoint Contract

### Position Endpoints

| Endpoint | Source | Fallback Behavior |
|----------|--------|-------------------|
| `GET /api/positions` | Alpaca Live | Error with `source: 'unavailable'` if Alpaca fails |
| `GET /api/positions/broker` | Alpaca Live | No fallback (Alpaca required) |
| `GET /api/positions/history` | Database | N/A (historical data only) |

### Order Endpoints

| Endpoint | Source | Fallback Behavior |
|----------|--------|-------------------|
| `GET /api/orders` | Alpaca Live | Error with `source: 'unavailable'` |
| `GET /api/orders/:id` | Alpaca Live | No fallback |
| `POST /api/orders` | Alpaca Live | Reject if Alpaca unavailable |

### Account Endpoints

| Endpoint | Source | Fallback Behavior |
|----------|--------|-------------------|
| `GET /api/account` | Alpaca Live | Error with `source: 'unavailable'` |
| `GET /api/portfolio` | Alpaca Live | Error with `source: 'unavailable'` |

## Data Field Mapping

### Alpaca Position → Database Position

| Alpaca Field | DB Field | Type Conversion |
|--------------|----------|-----------------|
| `asset_id` | `id` | Direct (use as primary identifier) |
| `symbol` | `symbol` | Direct (string) |
| `qty` | `quantity` | String → Numeric |
| `avg_entry_price` | `entryPrice` | String → Numeric |
| `current_price` | `currentPrice` | String → Numeric |
| `unrealized_pl` | `unrealizedPnl` | String → Numeric |
| `side` | `side` | 'long' or 'short' based on qty sign |
| `market_value` | `marketValue` | String → Numeric |
| `cost_basis` | `costBasis` | String → Numeric |
| `change_today` | `changeToday` | String → Numeric (percentage) |

### Alpaca Order → Database Order

| Alpaca Field | DB Field | Type Conversion |
|--------------|----------|-----------------|
| `id` | `id` | Direct (UUID string) |
| `symbol` | `symbol` | Direct |
| `qty` | `quantity` | String → Numeric |
| `side` | `side` | Direct ('buy' or 'sell') |
| `type` | `orderType` | Direct |
| `status` | `status` | Direct |
| `filled_avg_price` | `filledPrice` | String → Numeric (nullable) |
| `filled_qty` | `filledQuantity` | String → Numeric |
| `created_at` | `createdAt` | String → Timestamp |
| `filled_at` | `filledAt` | String → Timestamp (nullable) |

## Sync Patterns

### Position Sync Flow
```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ UI Request  │────>│ Alpaca API   │────>│ Return Data  │
└─────────────┘     └──────────────┘     └──────────────┘
                           │
                           │ (async, non-blocking)
                           ▼
                    ┌──────────────┐
                    │ Database     │
                    │ (audit log)  │
                    └──────────────┘
```

### Order Execution Flow
```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ Create Order│────>│ Alpaca API   │────>│ Order Created│
└─────────────┘     └──────────────┘     └──────────────┘
                           │
                           │ (sync, blocking)
                           ▼
                    ┌──────────────┐
                    │ Trade Table  │
                    │ (audit log)  │
                    └──────────────┘
```

## Error Handling

### Alpaca Unavailable
1. Log the error with full context
2. Return error response with `source: 'unavailable'`
3. **DO NOT** return stale DB data without explicit warning
4. UI must display "Live data unavailable" message

### Rate Limiting
1. Alpaca rate limits: 200 requests/minute
2. Use 30-second in-memory cache for frequently accessed data
3. Cache is cleared on any mutation (order create/cancel)

## Migration Path

### Phase 1: Add Source Metadata
- Add `source` field to all position/order API responses
- Keep existing fallback behavior temporarily

### Phase 2: Remove DB Fallback
- Update `/api/positions` to error instead of fallback
- Add UI handling for unavailable state

### Phase 3: Deprecate Paper Engine
- Mark `/api/paper/*` endpoints as deprecated
- Redirect to Alpaca equivalents

### Phase 4: Cleanup
- Remove paper-trading-engine from UI paths
- Keep engine for backtesting only

## Compliance

This contract ensures:
1. **Data Integrity**: Live state always reflects Alpaca's state
2. **Auditability**: All operations logged to database
3. **Transparency**: Users know data source at all times
4. **Reliability**: Clear error handling when Alpaca unavailable

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-15 | Initial contract establishing Alpaca as source of truth |
