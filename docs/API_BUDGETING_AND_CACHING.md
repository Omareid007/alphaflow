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

| Provider | Per-Minute | Per-Hour | Per-Day | Per-Week | Cache TTL | Notes |
|----------|------------|----------|---------|----------|-----------|-------|
| Alpaca | 180 | - | - | - | 30s | Safety margin under 200 |
| Finnhub | 50 | - | - | - | 1m | Safety margin under 60 |
| TwelveData | 6 | - | 700 | - | 1m | Strict limits |
| CoinGecko | 10 | - | 500 | - | 1m | Free tier limits |
| Valyu | - | - | - | 1 | 7d | Expensive, cached 90 days |
| NewsAPI | - | - | 80 | - | 1h | Daily quota |
| OpenAI | 60 | - | - | - | 1h | Token limits separate |
| Groq | 30 | - | - | - | 1h | 500k tokens/day |
| Together | 60 | - | - | - | 1h | 800k tokens/day |
| AiTrados OHLC | - | 100 | 1000 | - | 1m | Research data |
| AiTrados News | - | 50 | 500 | - | 5m | Research data |
| AiTrados Econ | - | 30 | 200 | - | 10m | Economic events |

For full AiTrados configuration, see [DATA_PROVIDER_AITRADOS.md](DATA_PROVIDER_AITRADOS.md).

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

## Connector Integration Status

### Scope
This integration covers **active monolith connectors** in `server/connectors/` that power the production trading engine. The future microservices in `services/*` are pending separate integration work as they approach activation.

### Integrated Connectors
All market data connectors in the active monolith have been refactored to use `callExternal()`:

| Connector | Provider(s) | Status | Notes |
|-----------|-------------|--------|-------|
| `server/connectors/finnhub.ts` | finnhub | ✅ Integrated | L1 ApiCache + callExternal |
| `server/connectors/coingecko.ts` | coingecko | ✅ Integrated | L1 ApiCache + callExternal |
| `server/connectors/newsapi.ts` | newsapi | ✅ Integrated | L1 Map cache + callExternal |
| `server/connectors/polygon.ts` | polygon | ✅ Integrated | L1 ApiCache + callExternal |
| `server/connectors/coinmarketcap.ts` | coinmarketcap | ✅ Integrated | L1 ApiCache + callExternal |
| `server/connectors/huggingface.ts` | huggingface | ✅ Integrated | L1 ApiCache + callExternal |
| `server/connectors/gdelt.ts` | gdelt | ✅ Integrated | L1 ApiCache + callExternal |
| `server/connectors/valyu.ts` | valyu | ✅ Integrated | Retrieval-based budgeting |
| `server/connectors/twelvedata.ts` | twelvedata | ✅ Integrated | L1 ApiCache + callExternal, 6/min 700/day |
| `server/connectors/social-sentiment.ts` | stocktwits, reddit | ✅ Integrated | L1 cache + callExternal per provider |

### Connector Architecture

Each connector uses a two-tier caching strategy:

1. **L1 (ApiCache)**: Fast in-memory cache checked first
2. **L2 (callExternal)**: Database-backed cache + budget enforcement

```
Request → L1 Cache Check → callExternal() → L2 Cache → Budget Check → API Call
           ↓ hit                              ↓ hit        ↓ exceeded
        Return data                       Return data   Return stale/error
```

### Using connectorFetch Helper

The `connectorFetch` helper simplifies callExternal usage:

```typescript
import { connectorFetch, buildCacheKey } from "../lib/connectorClient";

const result = await connectorFetch<QuoteData>(url, {
  provider: "finnhub",
  endpoint: "/quote",
  cacheKey: buildCacheKey("finnhub", "quote", symbol),
  headers: { Accept: "application/json" },
});

// result.data contains the API response
// result.provenance contains cache/budget metadata
```

## Best Practices

1. **Always use callExternal()** for external API calls to ensure budget compliance
2. **Set appropriate cache keys** for different data types
3. **Configure fallback providers** for critical data paths
4. **Monitor budget usage** via Admin UI before hitting limits
5. **Use forceRefresh sparingly** especially for expensive providers like Valyu
6. **Test with reduced limits** in development to catch budget issues early

### Future Work

The following areas are pending integration as they approach production:

| Area | Status | Notes |
|------|--------|-------|
| `services/market-data` | Pending | Microservice uses direct fetch; integrate when activated |
| `services/trading-engine` | Pending | Microservice uses direct fetch; integrate when activated |
| `services/ai-decision` | Pending | LLM routing; integrate when activated |
| Cache age tracking | Pending | Add cache entry timestamps to callExternal for accurate age reporting |

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

## Valyu Retrieval-Based Budgeting

### Why Retrieval-Based?

Valyu charges per **retrieval** (each result returned), not per request. A single API call returning 10 results costs 10x more than one returning 1 result. The retrieval-based budget system tracks `response.results.length` to accurately reflect costs.

### Monthly Budgets by Tier

| Tier | Monthly Limit | Max Price | Sources |
|------|---------------|-----------|---------|
| Web | 2,000 retrievals | $4.00 | All non-Valyu sources |
| Finance | 500 retrievals | $5.00 | `valyu/*` sources (valyu/valyu-earnings-US, valyu/valyu-financial-ratios-US, etc.) |
| Proprietary | 100 retrievals | $10.00 | Sources containing "proprietary" |

### Source Tier Classification

The system automatically classifies sources into tiers:

```typescript
function classifySourceTier(sources?: string[]): "web" | "finance" | "proprietary" {
  // 1. If any source contains "proprietary" → proprietary tier
  // 2. If any source starts with "valyu/" → finance tier
  // 3. Otherwise → web tier
}
```

### Query Shaping Defaults

To control costs, the connector applies these defaults:

- `max_num_results`: 5 (instead of 10)
- `relevance_threshold`: 0.7 (filters low-quality results)
- `max_price`: Capped per tier (web: $4.00, finance: $5.00, proprietary: $10.00)
- **Concurrency**: Maximum 5 concurrent requests via p-limit

### API Endpoints

#### GET /api/admin/valyu-budget

Returns current retrieval usage and limits:

```json
{
  "statuses": [
    {
      "tier": "web",
      "used": 150,
      "limit": 2000,
      "remaining": 1850,
      "resetDate": "2026-01-01T00:00:00.000Z",
      "lastCallTime": 1734305000000
    },
    {
      "tier": "finance",
      "used": 45,
      "limit": 500,
      "remaining": 455,
      "resetDate": "2026-01-01T00:00:00.000Z",
      "lastCallTime": 1734304500000
    },
    {
      "tier": "proprietary",
      "used": 0,
      "limit": 100,
      "remaining": 100,
      "resetDate": "2026-01-01T00:00:00.000Z",
      "lastCallTime": null
    }
  ],
  "config": {
    "webRetrievalsPerMonth": 2000,
    "financeRetrievalsPerMonth": 500,
    "proprietaryRetrievalsPerMonth": 100
  }
}
```

#### PUT /api/admin/valyu-budget

Update monthly limits:

```bash
curl -X PUT /api/admin/valyu-budget \
  -H "Content-Type: application/json" \
  -d '{
    "webRetrievalsPerMonth": 3000,
    "financeRetrievalsPerMonth": 750
  }'
```

### Database Schema

Retrieval counts are persisted in `valyu_retrieval_counters`:

```sql
CREATE TABLE valyu_retrieval_counters (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tier TEXT NOT NULL,        -- 'web' | 'finance' | 'proprietary'
  month_key TEXT NOT NULL,          -- '2025-12' format
  retrieval_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);
```

### Changing Limits

**Via API:**
```typescript
await apiRequest("PUT", "/api/admin/valyu-budget", {
  webRetrievalsPerMonth: 3000,
  financeRetrievalsPerMonth: 1000,
  proprietaryRetrievalsPerMonth: 200,
});
```

**Via Code:**
```typescript
import { updateValyuBudgetConfig } from "./lib/valyuBudget";

updateValyuBudgetConfig({
  webRetrievalsPerMonth: 3000,
  financeRetrievalsPerMonth: 1000,
});
```

### Monitoring

The Admin UI (Admin > API Budgets & Cache) displays:
- Valyu Retrieval Budgets card with per-tier usage bars
- Remaining retrievals per tier
- Last call timestamp per tier
- Monthly reset date
