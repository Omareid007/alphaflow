# API Budgeting and Caching System

## Overview

AI Active Trader implements a comprehensive API budget management and persistent caching system to ensure responsible usage of external API providers while maintaining system reliability. The system includes:

- **Budget enforcement** with per-provider rate limits
- **Multi-layer caching** (L1 memory + L2 database)
- **Stale data serving** when budgets are exhausted
- **Fallback provider support** for high availability
- **Admin UI** for monitoring and control

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                       callExternal()                             │
│  Unified wrapper for all external API calls                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   L1 Cache   │ →  │   L2 Cache   │ →  │   Budget     │       │
│  │   (Memory)   │    │   (Postgres) │    │   Check      │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         ↓                   ↓                   ↓                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Provider Policy Engine                   │       │
│  │  (Rate limits, cache TTLs, intervals, priorities)    │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

| File | Purpose |
|------|---------|
| `server/lib/callExternal.ts` | Unified wrapper combining budget + cache |
| `server/lib/apiPolicy.ts` | Provider policies and rate limits |
| `server/lib/apiBudget.ts` | Budget checking with DB persistence |
| `server/lib/persistentApiCache.ts` | L1 + L2 caching implementation |
| `client/screens/ApiBudgetScreen.tsx` | Admin UI for monitoring |

## Provider Policies

Each provider has configurable limits:

| Provider | Per-Minute | Per-Day | Per-Week | Cache TTL | Notes |
|----------|------------|---------|----------|-----------|-------|
| Alpaca | 180 | - | - | 30s | Safety margin under 200 |
| Finnhub | 50 | - | - | 1m | Safety margin under 60 |
| TwelveData | 6 | 700 | - | 1m | Strict limits |
| CoinGecko | 10 | 500 | - | 1m | Free tier limits |
| Valyu | - | - | 1 | 7d | Expensive, cached 90 days |
| NewsAPI | - | 80 | - | 1h | Daily quota |
| OpenAI | 60 | - | - | 1h | Token limits separate |
| Groq | 30 | - | - | 1h | 500k tokens/day |
| Together | 60 | - | - | 1h | 800k tokens/day |

## Usage

### Basic API Call

```typescript
import { callExternal } from "./lib/callExternal";

const result = await callExternal(
  () => fetch("https://api.finnhub.io/quote?symbol=AAPL"),
  {
    provider: "finnhub",
    endpoint: "/quote/AAPL",
  }
);

console.log(result.data);
console.log(result.provenance.cacheStatus); // "fresh" | "stale" | "miss"
console.log(result.provenance.budgetRemaining); // remaining calls
```

### With Cache Options

```typescript
const result = await callExternal(
  () => fetchMarketData(),
  {
    provider: "finnhub",
    endpoint: "/market-data",
    cacheKey: "market-data-AAPL-1d", // Custom cache key
    cachePolicy: {
      forceRefresh: true, // Skip cache, fetch fresh
      customTTLMs: 300000, // 5 minute TTL override
    },
  }
);
```

### With Fallback Provider

```typescript
const result = await callExternal(
  () => fetchFromFinnhub(symbol),
  {
    provider: "finnhub",
    endpoint: `/quote/${symbol}`,
    fallbackProvider: "polygon",
    fallbackFetcher: () => fetchFromPolygon(symbol),
  }
);
```

### Budget Control

```typescript
const result = await callExternal(
  () => expensiveBatchCall(),
  {
    provider: "valyu",
    endpoint: "/batch-analysis",
    budgetPolicy: {
      countAsMultiple: 5, // Counts as 5 API calls
    },
  }
);
```

## Admin API Endpoints

### GET /api/admin/provider-status

Returns status of all providers including budget usage and cache info.

```json
{
  "providers": {
    "finnhub": {
      "enabled": true,
      "budgetStatus": {
        "allowed": true,
        "currentCount": 15,
        "limit": 50,
        "windowType": "minute"
      },
      "lastCallTime": 1702654321000,
      "policy": {
        "maxRequestsPerMinute": 50,
        "cacheFreshDurationMs": 60000
      }
    }
  }
}
```

### PATCH /api/admin/provider/:provider/toggle

Enable or disable a provider.

```bash
curl -X PATCH /api/admin/provider/finnhub/toggle \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### POST /api/admin/provider/:provider/force-refresh

Force refresh cached data (requires confirmation for Valyu).

```bash
curl -X POST /api/admin/provider/valyu/force-refresh \
  -H "Content-Type: application/json" \
  -d '{"cacheKey": "market-analysis", "confirmValyu": true}'
```

## Caching Behavior

### Cache Layers

1. **L1 (Memory Cache)**
   - Fast in-memory lookup
   - Cleared on server restart
   - Used for hot data

2. **L2 (Database Cache)**
   - Persists across restarts
   - Stored in `api_cache` table
   - Automatic cleanup of expired entries

### Cache States

- **Fresh**: Data within TTL, served immediately
- **Stale**: Data expired but usable as fallback
- **Miss**: No cached data, must fetch from API

### Stale Data Serving

When budget is exhausted or API fails:
1. Check for stale cached data
2. Serve stale data with provenance indicating "stale"
3. Log warning for monitoring

## Monitoring

### Admin UI

Navigate to Admin > API Budgets & Cache to:
- View real-time budget usage per provider
- Toggle providers on/off
- Force refresh cached data
- Monitor cache TTLs and last call times

### Logging

All operations are logged with context:
- `CallExternal` - Wrapper operations
- `ApiBudget` - Budget checks and updates
- `PersistentCache` - Cache hits/misses

## Configuration

### Updating Provider Policies

```typescript
import { updateProviderPolicy } from "./lib/apiPolicy";

updateProviderPolicy("finnhub", {
  maxRequestsPerMinute: 45, // Reduce limit
  cacheFreshDurationMs: 120000, // Increase cache TTL
});
```

### Disabling a Provider

```typescript
import { disableProvider, enableProvider } from "./lib/apiPolicy";

disableProvider("valyu"); // Disable expensive provider
enableProvider("valyu"); // Re-enable when needed
```

## Best Practices

1. **Always use callExternal()** for external API calls to ensure budget compliance
2. **Set appropriate cache keys** for different data types
3. **Configure fallback providers** for critical data paths
4. **Monitor budget usage** via Admin UI before hitting limits
5. **Use forceRefresh sparingly** especially for expensive providers like Valyu
6. **Test with reduced limits** in development to catch budget issues early

## Error Handling

The system throws when:
- Budget is exhausted and no stale data/fallback available
- Provider is disabled
- API call fails and no fallback available

Handle these gracefully:

```typescript
try {
  const result = await callExternal(fetcher, options);
} catch (error) {
  if (error.message.includes("Budget exhausted")) {
    // Show user-friendly rate limit message
  } else if (error.message.includes("Provider disabled")) {
    // Use alternative data source
  }
}
```
