# AiTrados Data Provider

## Overview

AiTrados is an **optional research data provider** for AI Active Trader, supplying OHLC market data, financial news, and economic calendar events. It is designed for research, analysis triggers, and fallback data - **NOT** for trade execution.

**Source of Truth**: Alpaca remains the execution source of truth. AiTrados data informs AI decisions but does not directly control trading.

## Endpoints Used

### 1. Latest OHLC Bars
```
GET /api/v2/{schema_asset}/bars/{country_symbol}/{interval}/latest
```
**Schema Assets**: `us_equity`, `crypto`, `forex`, `commodity`, `index`
**Intervals**: `1min`, `5min`, `15min`, `30min`, `1hour`, `4hour`, `1day`, `1week`

### 2. News List
```
GET /api/v2/news/list
```
**Parameters**: `symbols`, `limit`, `pageToken`, `from`, `to`, `sources`

### 3. Economic Calendar Events
```
GET /api/v2/economic_calendar/event
```
**Parameters**: `eventId`, `country`, `from`, `to`, `importance`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AITRADOS_API_KEY` | API key (required) | - |
| `AITRADOS_BASE_URL` | Base API URL | `https://api.aitrados.com` |
| `AITRADOS_ENABLED` | Enable/disable provider | `true` |

### Per-Endpoint Rate Limits

#### OHLC Endpoint
| Variable | Description | Default |
|----------|-------------|---------|
| `AITRADOS_OHLC_RATE_LIMIT_PER_HOUR` | Max requests per hour | 100 |
| `AITRADOS_OHLC_RATE_LIMIT_PER_DAY` | Max requests per day | 1000 |
| `AITRADOS_OHLC_MIN_INTERVAL_MS` | Min interval between calls | 500ms |
| `AITRADOS_OHLC_CACHE_FRESH_MS` | Cache fresh TTL | 60s |
| `AITRADOS_OHLC_CACHE_STALE_MS` | Cache stale TTL | 15min |

#### News Endpoint
| Variable | Description | Default |
|----------|-------------|---------|
| `AITRADOS_NEWS_RATE_LIMIT_PER_HOUR` | Max requests per hour | 50 |
| `AITRADOS_NEWS_RATE_LIMIT_PER_DAY` | Max requests per day | 500 |
| `AITRADOS_NEWS_MIN_INTERVAL_MS` | Min interval between calls | 1000ms |
| `AITRADOS_NEWS_CACHE_FRESH_MS` | Cache fresh TTL | 5min |
| `AITRADOS_NEWS_CACHE_STALE_MS` | Cache stale TTL | 30min |

#### Economic Events Endpoint
| Variable | Description | Default |
|----------|-------------|---------|
| `AITRADOS_ECON_RATE_LIMIT_PER_HOUR` | Max requests per hour | 30 |
| `AITRADOS_ECON_RATE_LIMIT_PER_DAY` | Max requests per day | 200 |
| `AITRADOS_ECON_MIN_INTERVAL_MS` | Min interval between calls | 2000ms |
| `AITRADOS_ECON_CACHE_FRESH_MS` | Cache fresh TTL | 10min |
| `AITRADOS_ECON_CACHE_STALE_MS` | Cache stale TTL | 60min |

## Usage

### Basic Usage

```typescript
import { getLatestOhlc, getNewsList, getEconomicEvents } from "../providers/aitrados";

// Get latest OHLC for a symbol
const ohlc = await getLatestOhlc("AAPL", "1day", "us_equity");
console.log(ohlc.normalized); // NormalizedOhlcData

// Get recent news
const news = await getNewsList({ symbols: ["AAPL", "MSFT"], limit: 10 });
console.log(news.normalized); // NormalizedNewsData[]

// Get economic events
const events = await getEconomicEvents({ country: "US", importance: "high" });
console.log(events.normalized); // NormalizedEconomicEvent[]
```

### Service Status

```typescript
import { getServiceStatus, clearL1Caches, isAitradosEnabled } from "../providers/aitrados";

// Check service status
const status = getServiceStatus();
console.log(status.enabled, status.configured, status.l1CacheStats);

// Clear L1 caches manually if needed
clearL1Caches();
```

### Test Connection

```typescript
import { testConnection } from "../providers/aitrados";

const result = await testConnection();
if (result.success) {
  console.log(`Connection OK, latency: ${result.latencyMs}ms`);
} else {
  console.log(`Connection failed: ${result.error}`);
}
```

## Budgets & Caching Policy

### Multi-Layer Caching

1. **L1 Cache (Memory)**: Fast in-memory cache per endpoint class
   - OHLC: 60s fresh, 15min stale
   - News: 5min fresh, 30min stale
   - Econ: 10min fresh, 60min stale

2. **L2 Cache (Database)**: Persistent cache via `callExternal()`
   - Survives server restarts
   - Automatic TTL enforcement

### Budget Enforcement

All AiTrados calls flow through the unified budget system:

```
L1 Cache Check → callExternal() → L2 Cache → Budget Check → API Call
      ↓ hit           ↓             ↓ hit        ↓ exceeded
   Return data    L2 Check      Return data   Return stale/error
```

When budget is exhausted:
1. Stale cached data is served if available
2. Error is thrown if no cached data exists

### Monitoring

Check budget status via Admin API:
```bash
curl /api/admin/provider-status | jq '.providers.aitrados_ohlc'
```

## File Structure

```
server/providers/aitrados/
├── index.ts              # Re-exports all modules
├── aitradosSchemas.ts    # Zod validation schemas
├── aitradosEndpoints.ts  # URL builders and params
├── aitradosClient.ts     # Typed fetch wrapper with L1 cache
└── aitradosService.ts    # High-level service methods
```

## Data Normalization

All responses are normalized to internal formats for consistency:

### NormalizedOhlcData
```typescript
{
  symbol: string;
  interval: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  source: "aitrados";
}
```

### NormalizedNewsData
```typescript
{
  id: string;
  headline: string;
  summary?: string;
  source: string;
  publishedAt: Date;
  symbols: string[];
  sentiment?: { score?: number; label?: "positive" | "negative" | "neutral" };
  source_provider: "aitrados";
}
```

### NormalizedEconomicEvent
```typescript
{
  id: string;
  name: string;
  country: string;
  scheduledAt: Date;
  actual?: number | null;
  forecast?: number | null;
  previous?: number | null;
  importance?: "low" | "medium" | "high";
  source_provider: "aitrados";
}
```

## Admin UI Integration

AiTrados status and controls are available in:
- **Admin > Providers & Budgets**: View budget usage, cache stats, enable/disable
- **Provider Status Endpoint**: `GET /api/admin/provider-status`

## Error Handling

Common errors:
- `AITRADOS_API_KEY is not configured` - Set the API key secret
- `AiTrados provider is disabled` - Enable via `AITRADOS_ENABLED=true`
- `Budget exhausted` - Wait for rate limit window to reset

## Future Enhancements

### WebSocket Ingest (Planned)
- Real-time OHLC streaming
- Live news feed
- Economic event alerts
- `market_events` table for event persistence

### Event Triggers (Planned)
- Trigger analysis cycles on significant events
- Configurable cooldowns and caps
- Event-driven research pack updates
