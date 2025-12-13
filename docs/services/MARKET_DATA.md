# Market Data Service Specification

> **Domain:** Data Ingestion & Distribution  
> **Owner:** Platform Team  
> **Status:** Design
>
> [INDEX.md](../INDEX.md) | Canonical: [CONNECTORS_AND_INTEGRATIONS.md](../CONNECTORS_AND_INTEGRATIONS.md), [API_REFERENCE.md](../API_REFERENCE.md), [ARCHITECTURE.md](../ARCHITECTURE.md)

---

## Service Overview

The Market Data Service is responsible for aggregating, normalizing, and distributing market data from multiple providers. It acts as the single source of truth for all market information.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MARKET DATA SERVICE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         CONNECTORS                                       ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          ││
│  │  │ Alpaca  │ │ Finnhub │ │ Polygon │ │CoinGecko│ │ NewsAPI │          ││
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          ││
│  │       │           │           │           │           │                ││
│  │       └───────────┴───────────┴───────────┴───────────┘                ││
│  └──────────────────────────────────┬──────────────────────────────────────┘│
│                                     │                                        │
│                       ┌─────────────▼─────────────┐                         │
│                       │     Normalizer Layer      │                         │
│                       │  (Unified Data Format)    │                         │
│                       └─────────────┬─────────────┘                         │
│                                     │                                        │
│           ┌─────────────────────────┼─────────────────────────┐             │
│           │                         │                         │             │
│  ┌────────▼────────┐    ┌──────────▼──────────┐    ┌─────────▼─────────┐  │
│  │   Redis Cache   │    │   Event Publisher   │    │    REST API       │  │
│  │   (Hot Data)    │    │   (NATS Topics)     │    │   (Query Access)  │  │
│  └─────────────────┘    └─────────────────────┘    └───────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Specification

### REST Endpoints

#### Quotes

```yaml
# Get Latest Quote
GET /api/v1/quotes/:symbol
Response:
  symbol: string
  price: number
  bid: number
  ask: number
  bidSize: number
  askSize: number
  volume: number
  timestamp: string (ISO 8601)
  source: string

# Get Multiple Quotes
GET /api/v1/quotes?symbols=AAPL,TSLA,GOOGL
Response:
  quotes: Quote[]

# Get Quote History (Intraday)
GET /api/v1/quotes/:symbol/history?interval=1m&limit=100
Response:
  symbol: string
  interval: string
  bars: Bar[]
```

#### Bars (OHLCV)

```yaml
# Get Historical Bars
GET /api/v1/bars/:symbol
Query:
  timeframe: "1m" | "5m" | "15m" | "1h" | "1d" | "1w" (required)
  start: string (ISO 8601)
  end: string (ISO 8601)
  limit: number (default: 100, max: 1000)
Response:
  symbol: string
  timeframe: string
  bars: [
    {
      timestamp: string
      open: number
      high: number
      low: number
      close: number
      volume: number
      vwap?: number
    }
  ]

# Get Multi-Symbol Bars
POST /api/v1/bars/multi
Request:
  symbols: string[]
  timeframe: string
  start: string
  end: string
Response:
  data: {
    [symbol: string]: Bar[]
  }
```

#### Technical Indicators

```yaml
# Get Technical Indicators
GET /api/v1/indicators/:symbol
Query:
  indicators: "rsi,macd,sma,ema,bollinger" (comma-separated)
  timeframe: "1m" | "5m" | "15m" | "1h" | "1d"
  period: number (for SMA/EMA)
Response:
  symbol: string
  timeframe: string
  indicators: {
    rsi: { value: number, period: number }
    macd: { macd: number, signal: number, histogram: number }
    sma: { value: number, period: number }
    ema: { value: number, period: number }
    bollinger: { upper: number, middle: number, lower: number }
  }
```

#### News

```yaml
# Get News
GET /api/v1/news
Query:
  symbols?: string (comma-separated)
  category?: "general" | "earnings" | "merger" | "ipo"
  limit: number (default: 20)
Response:
  news: [
    {
      id: string
      headline: string
      summary: string
      source: string
      url: string
      symbols: string[]
      sentiment?: number (-1 to 1)
      publishedAt: string
    }
  ]

# Get Symbol News
GET /api/v1/news/:symbol
Response:
  news: NewsArticle[]
```

#### Market Status

```yaml
# Get Market Status
GET /api/v1/market/status
Response:
  isOpen: boolean
  session: "pre" | "regular" | "post" | "closed"
  nextOpen: string (ISO 8601)
  nextClose: string (ISO 8601)
  holidays: [
    { date: string, name: string }
  ]

# Get Trading Calendar
GET /api/v1/market/calendar?days=30
Response:
  days: [
    {
      date: string
      open: string
      close: string
      session: "regular" | "early_close"
    }
  ]
```

### WebSocket Streams

```typescript
// Connect to real-time stream
const ws = new WebSocket('wss://market-data-service/stream');

// Subscribe to quotes
ws.send(JSON.stringify({
  action: 'subscribe',
  streams: ['quotes.AAPL', 'quotes.TSLA', 'bars.1m.SPY']
}));

// Receive updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // { stream: 'quotes.AAPL', data: { price: 150.25, ... } }
};

// Unsubscribe
ws.send(JSON.stringify({
  action: 'unsubscribe',
  streams: ['quotes.AAPL']
}));
```

### Event Publications

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `market.quote.received` | New quote from provider | Quote data |
| `market.bar.1m` | 1-minute bar closed | Bar data |
| `market.bar.5m` | 5-minute bar closed | Bar data |
| `market.bar.1d` | Daily bar closed | Bar data |
| `market.news.published` | New news article | Article data |
| `market.session.opened` | Market opened | Session info |
| `market.session.closed` | Market closed | Session info |
| `market.data.stale` | Data source unhealthy | Alert info |

---

## Data Model

### Unified Data Format

```typescript
interface Quote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  volume: number;
  timestamp: Date;
  source: DataSource;
}

interface Bar {
  symbol: string;
  timeframe: Timeframe;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}

interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  content?: string;
  source: string;
  url: string;
  symbols: string[];
  sentiment?: number;  // -1 (bearish) to 1 (bullish)
  publishedAt: Date;
  fetchedAt: Date;
}

enum DataSource {
  ALPACA = 'alpaca',
  FINNHUB = 'finnhub',
  POLYGON = 'polygon',
  COINGECKO = 'coingecko',
  NEWSAPI = 'newsapi'
}

enum Timeframe {
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  H1 = '1h',
  D1 = '1d',
  W1 = '1w'
}
```

### Database Schema

```sql
-- market_data schema
CREATE SCHEMA market_data;

-- Quotes cache (primarily in Redis, DB for history)
CREATE TABLE market_data.quote_history (
  id BIGSERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  price DECIMAL(15, 4) NOT NULL,
  bid DECIMAL(15, 4),
  ask DECIMAL(15, 4),
  volume BIGINT,
  source VARCHAR(20),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE market_data.quote_history_2025_01 
  PARTITION OF market_data.quote_history
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Bars table (aggregated OHLCV)
CREATE TABLE market_data.bars (
  id BIGSERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  timeframe VARCHAR(5) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  open DECIMAL(15, 4) NOT NULL,
  high DECIMAL(15, 4) NOT NULL,
  low DECIMAL(15, 4) NOT NULL,
  close DECIMAL(15, 4) NOT NULL,
  volume BIGINT NOT NULL,
  vwap DECIMAL(15, 4),
  source VARCHAR(20),
  UNIQUE(symbol, timeframe, timestamp)
);

-- News articles
CREATE TABLE market_data.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(100) UNIQUE,
  headline TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  source VARCHAR(50) NOT NULL,
  url TEXT,
  symbols TEXT[] DEFAULT '{}',
  sentiment DECIMAL(4, 3),
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_quotes_symbol_time ON market_data.quote_history(symbol, timestamp);
CREATE INDEX idx_bars_symbol_timeframe ON market_data.bars(symbol, timeframe, timestamp);
CREATE INDEX idx_news_symbols ON market_data.news USING GIN(symbols);
CREATE INDEX idx_news_published ON market_data.news(published_at);
```

---

## Connector Configuration

### Provider Priority & Fallback

```yaml
providers:
  equities:
    primary: alpaca
    fallbacks: [finnhub, polygon]
    
  crypto:
    primary: alpaca
    fallbacks: [coingecko]
    
  news:
    primary: newsapi
    fallbacks: [finnhub]

connectors:
  alpaca:
    baseUrl: https://data.alpaca.markets
    apiKey: ${ALPACA_API_KEY}
    secretKey: ${ALPACA_SECRET_KEY}
    rateLimit: 200  # requests/min
    timeout: 5000
    
  finnhub:
    baseUrl: https://finnhub.io/api/v1
    apiKey: ${FINNHUB_API_KEY}
    rateLimit: 60
    timeout: 10000
    
  polygon:
    baseUrl: https://api.polygon.io
    apiKey: ${POLYGON_API_KEY}
    rateLimit: 100
    timeout: 10000
    
  coingecko:
    baseUrl: https://api.coingecko.com/api/v3
    rateLimit: 50
    timeout: 15000
    
  newsapi:
    baseUrl: https://newsapi.org/v2
    apiKey: ${NEWS_API_KEY}
    rateLimit: 100  # requests/day
    timeout: 10000
```

---

## Caching Strategy

### Redis Configuration

```yaml
cache:
  redis:
    url: ${REDIS_URL}
    prefix: "mkt:"
    
  ttl:
    quote: 5         # 5 seconds for real-time quotes
    bar_1m: 60       # 1 minute
    bar_5m: 300      # 5 minutes
    bar_1d: 3600     # 1 hour
    news: 900        # 15 minutes
    indicators: 60   # 1 minute
    market_status: 60
    
  keys:
    quote: "mkt:quote:{symbol}"
    bar: "mkt:bar:{timeframe}:{symbol}"
    news: "mkt:news:{symbol}"
    indicators: "mkt:ind:{symbol}:{timeframe}"
```

### Cache Warming

```typescript
// Warm cache on startup for watchlist symbols
async function warmCache() {
  const watchlist = await getActiveWatchlist();
  
  await Promise.all([
    // Fetch latest quotes
    fetchQuotes(watchlist),
    // Fetch recent bars (last hour)
    fetchBars(watchlist, '1m', 60),
    // Fetch recent news
    fetchNews(watchlist)
  ]);
}
```

---

## Configuration

```yaml
market-data:
  server:
    port: 3003
    host: "0.0.0.0"
  
  providers:
    # See connector configuration above
  
  streaming:
    enabled: true
    maxConnections: 1000
    heartbeatInterval: 30000
  
  aggregation:
    enabled: true
    intervals: ["1m", "5m", "15m", "1h", "1d"]
  
  eventBus:
    url: ${NATS_URL}
    publishPrefix: "ai-trader.market"
  
  cache:
    redis:
      url: ${REDIS_URL}
```

---

## Health & Metrics

### Health Endpoint

```json
GET /health
{
  "status": "healthy",
  "checks": {
    "database": "connected",
    "redis": "connected",
    "eventBus": "connected",
    "providers": {
      "alpaca": "available",
      "finnhub": "available",
      "polygon": "unavailable",
      "coingecko": "available"
    }
  },
  "symbolsCached": 150,
  "quotesPerSecond": 45
}
```

### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `market_quotes_total` | Counter | Quotes received per provider |
| `market_quote_latency_ms` | Histogram | Quote fetch latency |
| `market_cache_hits` | Counter | Cache hit rate |
| `market_cache_misses` | Counter | Cache miss rate |
| `market_provider_errors` | Counter | Provider errors |
| `market_websocket_connections` | Gauge | Active WebSocket clients |
| `market_events_published` | Counter | Events sent to NATS |
