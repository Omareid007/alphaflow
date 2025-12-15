# Symbol Master & Tradability Service

## Overview

The Symbol Master provides a centralized, cached store of tradable assets from the Alpaca broker. The TradabilityService validates symbols before order submission, preventing errors from untradable or invalid symbols.

## Architecture

### Database Schema

```
broker_assets table
├── symbol (PK) - Ticker symbol (e.g., "AAPL", "BTCUSD")
├── assetClass - "us_equity" | "crypto"
├── exchange - Trading exchange
├── name - Full asset name
├── tradable - Whether currently tradable
├── marginable - Margin trading allowed
├── shortable - Short selling allowed
├── fractionable - Fractional shares supported
├── minOrderSize / minTradeIncrement - Size constraints
├── priceIncrement - Tick size
├── status - Asset listing status
├── attributes - JSON metadata
└── syncedAt / createdAt - Timestamps
```

### Two-Tier Caching

1. **Memory Cache (L1)** - 5-minute TTL for hot symbols
   - Fast in-memory Map lookup
   - Cleared on sync operations
   - Reduces database queries for repeated checks

2. **Database Cache (L2)** - Persists across restarts
   - Full asset universe from Alpaca
   - Synced daily via work queue
   - Fallback when memory cache misses

### Tradability Gate

Before any order submission, the execution flow validates:

```
Order Request
    ↓
validateOrderParams()
    ↓
tradabilityService.validateSymbolTradable(symbol)
    ↓
┌─ Memory Cache Hit → Return cached result
│
└─ Miss → Check Database
              ↓
         Found → Cache & Return
              ↓
         Not Found → Fetch from Alpaca API
                          ↓
                     Cache in DB → Return result
```

## API Endpoints

### GET /api/universe/stats
Returns universe statistics:
```json
{
  "total": 15000,
  "tradable": 12500,
  "byAssetClass": {
    "us_equity": 12000,
    "crypto": 500
  },
  "lastSync": "2025-12-15T10:30:00Z"
}
```

### GET /api/universe/symbols
Lists symbols with optional filters:
- `?assetClass=us_equity|crypto`
- `?tradableOnly=true`
- `?limit=1000`

### GET /api/universe/search?q=APPLE
Search symbols by name or ticker.

### GET /api/universe/check/:symbol
Validate a specific symbol's tradability:
```json
{
  "symbol": "AAPL",
  "tradable": true,
  "fractionable": true,
  "marginable": true,
  "shortable": true,
  "assetClass": "us_equity",
  "exchange": "NASDAQ"
}
```

### POST /api/universe/sync
Queue async asset universe sync (via work queue).

### POST /api/universe/sync-now
Immediate sync (use sparingly - API budget impact).

## Work Queue Integration

The `ASSET_UNIVERSE_SYNC` work item type handles scheduled syncs:

```typescript
{
  type: "ASSET_UNIVERSE_SYNC",
  payload: { assetClass: "us_equity" | "crypto" },
  maxAttempts: 3,
  retryBackoff: exponential (2s, 4s, 8s)
}
```

### Sync Process

1. Fetch assets from Alpaca `/v2/assets`
2. Filter by asset class and status
3. Upsert to `broker_assets` table
4. Update `syncedAt` timestamps
5. Clear memory cache

## Order Execution Integration

The tradability gate is enforced in `order-execution-flow.ts`:

```typescript
async validateOrderParams(params: CreateOrderParams) {
  // Schema validation first
  CreateOrderSchema.parse(params);
  
  // Tradability gate
  const check = await tradabilityService.validateSymbolTradable(params.symbol);
  if (!check.tradable) {
    return { valid: false, errors: [`Symbol not tradable: ${check.reason}`] };
  }
  
  // Warnings for special conditions
  if (!check.fractionable && params.notional) {
    warnings.push("Symbol doesn't support fractional trading");
  }
  
  // Continue with order type validation...
}
```

## Error Handling

| Error Type | Handling |
|------------|----------|
| Symbol not in universe | Fetch from Alpaca API, cache result |
| Alpaca API failure | Return `tradable: false` with retry indicator |
| Symbol delisted | Mark as non-tradable in cache |
| Rate limited | Exponential backoff via work queue |

## Best Practices

1. **Batch Symbol Checks** - For lists of symbols, pre-fetch from DB in bulk
2. **Cache Warming** - Sync asset universe on startup/daily
3. **Handle Not Found** - Unknown symbols should fetch from Alpaca once
4. **Monitor Cache Hit Rate** - High miss rate indicates sync issues

## Monitoring

Key metrics to track:
- Cache hit rate (memory vs database vs API)
- Asset universe size and staleness
- Tradability validation failures
- API budget consumption for asset fetches

## Migration Notes

The `broker_assets` table was added to support:
- Pre-submission validation (prevent Alpaca rejections)
- Symbol search and autocomplete features
- Fractional trading capability display
- Market hours and trading constraints
