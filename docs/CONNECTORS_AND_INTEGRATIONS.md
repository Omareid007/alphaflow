# Connectors & External Integrations

> **Canonical document for external API connectors, integration patterns, and provider capabilities.**
>
> Start here: [INDEX.md](INDEX.md) | Related: [AI_MODELS_AND_PROVIDERS.md](AI_MODELS_AND_PROVIDERS.md) (LLM providers), [ARCHITECTURE.md](ARCHITECTURE.md) (system design)

---

## Canonical References

| Topic | Go To |
|-------|-------|
| LLM providers & routing | [AI_MODELS_AND_PROVIDERS.md](AI_MODELS_AND_PROVIDERS.md) |
| C4 architecture diagrams | [ARCHITECTURE.md](ARCHITECTURE.md) |
| REST API endpoints | [API_REFERENCE.md](API_REFERENCE.md) |
| Trading agent runtime | [ORCHESTRATOR_AND_AGENT_RUNTIME.md](ORCHESTRATOR_AND_AGENT_RUNTIME.md) |
| Observability & tracing | [OBSERVABILITY.md](OBSERVABILITY.md) |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Connector Inventory](#2-connector-inventory)
3. [Common Patterns](#3-common-patterns)
4. [Error Handling](#4-error-handling)
5. [Rate Limiting](#5-rate-limiting)
6. [Testing Connectors](#6-testing-connectors)
7. [Current State (December 2025)](#7-current-state-december-2025)
8. [Enhancements Compared to Previous Version](#8-enhancements-compared-to-previous-version)
9. [Old vs New - Summary of Changes](#9-old-vs-new---summary-of-changes)

---

## 1. Overview

AI Active Trader integrates with multiple external services for market data, trading execution, and news feeds. All connectors follow the **adapter pattern** to provide a consistent interface to the application.

**Architecture principle:** The orchestrator and trading engine interact with connectors through stable interfaces. If an external API changes, only the connector needs updating.

---

## 2. Connector Inventory

### Connector Status Summary

| Connector | Purpose | Status | Provider Doc |
|-----------|---------|--------|--------------|
| Alpaca | Broker, trading execution | Implemented | [ALPACA_CAPABILITIES.md](providers/ALPACA_CAPABILITIES.md) |
| Finnhub | Stock quotes, fundamentals | Implemented | [FINNHUB_CAPABILITIES.md](providers/FINNHUB_CAPABILITIES.md) |
| CoinGecko | Crypto prices | Implemented | [COINGECKO_CAPABILITIES.md](providers/COINGECKO_CAPABILITIES.md) |
| NewsAPI | News headlines | Implemented | - |
| CoinMarketCap | Crypto market data | Implemented | - |
| OpenAI | AI decisions | Implemented | [OPENAI_CAPABILITIES.md](providers/OPENAI_CAPABILITIES.md) |
| Groq | AI fallback | Partially Implemented | - |
| Together.ai | AI fallback | Partially Implemented | - |

**Status Legend:** Implemented | Partially Implemented | Planned | Deprecated

---

### 2.1 Alpaca (Broker)

**Status:** Implemented

**Purpose:** Paper trading execution, account management, position tracking

| Attribute | Value |
|-----------|-------|
| Location | `server/connectors/alpaca.ts` |
| API Base | `https://paper-api.alpaca.markets` |
| Auth | `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` |
| Rate Limit | 200 requests/minute |

**Key Endpoints:**
- `GET /v2/account` - Account info and buying power
- `GET /v2/positions` - Current open positions
- `POST /v2/orders` - Submit orders
- `GET /v2/orders` - Order history

**Usage:**
```typescript
import { alpacaConnector } from "@/connectors/alpaca";

const account = await alpacaConnector.getAccount();
const positions = await alpacaConnector.getPositions();
await alpacaConnector.submitOrder({ symbol, qty, side, type });
```

---

### 2.2 Finnhub (Stock Market Data)

**Status:** Implemented

**Purpose:** Real-time stock quotes, company fundamentals, market status

| Attribute | Value |
|-----------|-------|
| Location | `server/connectors/finnhub.ts` |
| API Base | `https://finnhub.io/api/v1` |
| Auth | `FINNHUB_API_KEY` |
| Rate Limit | 60 calls/minute (free tier) |

**Key Endpoints:**
- `GET /quote` - Current stock price
- `GET /stock/candle` - OHLCV data
- `GET /company-news` - Company-specific news

---

### 2.3 CoinGecko (Crypto Prices)

**Status:** Implemented

**Purpose:** Cryptocurrency price data, market caps, volume

| Attribute | Value |
|-----------|-------|
| Location | `server/connectors/coingecko.ts` |
| API Base | `https://api.coingecko.com/api/v3` |
| Auth | None (free tier) or API key (pro) |
| Rate Limit | 10-50 calls/minute |

**Key Endpoints:**
- `GET /simple/price` - Current prices
- `GET /coins/{id}/market_chart` - Historical data

---

### 2.4 NewsAPI (News Headlines)

**Status:** Implemented

**Purpose:** Real-time news headlines for sentiment analysis

| Attribute | Value |
|-----------|-------|
| Location | `server/connectors/newsapi.ts` |
| API Base | `https://newsapi.org/v2` |
| Auth | `NEWS_API_KEY` |
| Rate Limit | 100 requests/day (free tier) |

**Key Endpoints:**
- `GET /everything` - Search news articles
- `GET /top-headlines` - Top headlines by category

**Note:** Aggressive rate limiting (429 errors). Implement long backoff periods.

---

### 2.5 CoinMarketCap (Crypto Data)

**Status:** Implemented

**Purpose:** Comprehensive cryptocurrency market data

| Attribute | Value |
|-----------|-------|
| Location | `server/connectors/coinmarketcap.ts` |
| API Base | `https://pro-api.coinmarketcap.com` |
| Auth | `COINMARKETCAP_API_KEY` |
| Rate Limit | Varies by plan |

---

## 3. Common Patterns

### 3.1 Adapter Pattern

All connectors expose a consistent interface:

```typescript
interface MarketDataConnector {
  getQuote(symbol: string): Promise<Quote>;
  getHistoricalData(symbol: string, period: string): Promise<OHLCV[]>;
  isAvailable(): Promise<boolean>;
}

interface BrokerConnector {
  getAccount(): Promise<Account>;
  getPositions(): Promise<Position[]>;
  submitOrder(order: OrderRequest): Promise<OrderResult>;
}
```

### 3.2 Retry Logic

All connectors implement exponential backoff:

```typescript
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  throw new Error("Max retries exceeded");
}
```

### 3.3 Logging Pattern

Use `log.connector()` for all external calls:

```typescript
log.connector("Fetching stock quote", { 
  provider: "finnhub", 
  symbol, 
  attempt: 1 
});

const result = await fetchQuote(symbol);

log.connector("Quote fetched successfully", { 
  symbol, 
  price: result.price,
  latencyMs: Date.now() - startTime 
});
```

---

## 4. Error Handling

### 4.1 Error Categories

| Category | HTTP Codes | Handling |
|----------|------------|----------|
| Rate Limited | 429 | Backoff and retry |
| Auth Error | 401, 403 | Log critical, fail operation |
| Server Error | 500-599 | Retry with backoff |
| Client Error | 400-499 | Log and fail (no retry) |
| Network Error | - | Retry with backoff |
| Timeout | - | Retry with backoff |

### 4.2 Graceful Degradation

Connectors must never crash the orchestrator:

```typescript
async function getQuoteSafe(symbol: string): Promise<Quote | null> {
  try {
    return await getQuote(symbol);
  } catch (error) {
    log.warn("Connector", "Failed to fetch quote, returning null", {
      symbol,
      error: String(error)
    });
    return null;
  }
}
```

### 4.3 Circuit Breaker (Recommended)

For connectors with aggressive rate limits:

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private isOpen = false;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen && Date.now() - this.lastFailure < 60000) {
      throw new Error("Circuit breaker open");
    }

    try {
      const result = await fn();
      this.failures = 0;
      this.isOpen = false;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= 3) {
        this.isOpen = true;
        log.warn("Connector", "Circuit breaker opened");
      }
      throw error;
    }
  }
}
```

---

## 5. Rate Limiting

### 5.1 Per-Connector Limits

| Connector | Limit | Strategy |
|-----------|-------|----------|
| Alpaca | 200/min | Throttle requests |
| Finnhub | 60/min | Queue with delay |
| CoinGecko | 10-50/min | Aggressive caching |
| NewsAPI | 100/day | Long cache, sparse calls |
| CoinMarketCap | Varies | Follow plan limits |

### 5.2 Rate Limit State Tracking

```typescript
class RateLimiter {
  private limitedUntil: number = 0;

  async checkLimit(): Promise<boolean> {
    if (Date.now() < this.limitedUntil) {
      const remaining = Math.ceil((this.limitedUntil - Date.now()) / 1000);
      log.warn("Connector", `Rate limited for ${remaining}s more`);
      return false;
    }
    return true;
  }

  setLimited(durationMs: number): void {
    this.limitedUntil = Date.now() + durationMs;
    log.warn("Connector", `Rate limited, backing off for ${durationMs}ms`);
  }
}
```

---

## 6. Testing Connectors

### 6.1 Mock Responses

Create fixture files for common responses:

```typescript
// fixtures/alpaca-positions.json
[
  {
    "symbol": "AAPL",
    "qty": "10",
    "avg_entry_price": "150.00",
    "current_price": "155.00",
    "unrealized_pl": "50.00"
  }
]
```

### 6.2 Integration Tests

Test with mocked HTTP:

```typescript
describe("Alpaca Connector", () => {
  beforeEach(() => {
    fetchMock.mockResponseOnce(JSON.stringify(mockPositions));
  });

  it("should parse positions correctly", async () => {
    const positions = await alpacaConnector.getPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0].symbol).toBe("AAPL");
  });

  it("should handle rate limits gracefully", async () => {
    fetchMock.mockResponseOnce("", { status: 429 });
    const result = await alpacaConnector.getPositionsSafe();
    expect(result).toEqual([]);
  });
});
```

### 6.3 Error Path Testing

Always test failure scenarios:

- Network timeout
- Rate limit (429) response
- Invalid JSON response
- Authentication failure
- Server errors (5xx)

---

## Related Documentation

| Document | Relevance |
|----------|-----------|
| `AGENT_EXECUTION_GUIDE.md` | Section 15: Connectors & External Integrations Governance |
| `OBSERVABILITY.md` | Connector logging category (`log.connector()`) |
| `TESTING.md` | Connector testing patterns |
| `ARCHITECTURE.md` | Connector layer in system design |

---

## 7. Current State (December 2025)

### 7.1 Implemented Connectors

The following connectors are fully implemented in `server/connectors/`:

| Connector | File | Status | Key Features |
|-----------|------|--------|--------------|
| **Alpaca** | `alpaca.ts` | ✅ Production | Full brokerage API, 1000+ lines |
| **Finnhub** | `finnhub.ts` | ✅ Production | Stock quotes, news, company data |
| **CoinGecko** | `coingecko.ts` | ✅ Production | Crypto prices, market data |
| **CoinMarketCap** | `coinmarketcap.ts` | ✅ Production | Crypto rankings, volume |
| **NewsAPI** | `newsapi.ts` | ✅ Production | News headlines with caching |
| **GDELT** | `gdelt.ts` | ✅ Production | Global news sentiment |
| **Valyu.ai** | `valyu.ts` | ✅ Production | Financial ratios, earnings |
| **Hugging Face** | `huggingface.ts` | ✅ Production | FinBERT sentiment analysis |

### 7.2 Alpaca Connector Features

The Alpaca connector (`server/connectors/alpaca.ts`) is the most comprehensive:

**Order Types Supported:**
- Market orders
- Limit orders
- Stop orders
- Stop-limit orders
- Bracket orders (entry + take-profit + stop-loss)
- Trailing stop orders
- OCO (One-Cancels-Other) orders

**Data Interfaces:**
```typescript
export interface AlpacaAccount { id, buying_power, cash, equity, ... }
export interface AlpacaPosition { symbol, qty, avg_entry_price, unrealized_pl, ... }
export interface AlpacaOrder { id, symbol, qty, side, type, status, ... }
export interface AlpacaBar { t, o, h, l, c, v, ... } // OHLCV data
export interface AlpacaSnapshot { latestTrade, latestQuote, minuteBar, ... }
```

### 7.3 Order Execution Flow

Comprehensive order execution with error handling (`server/trading/order-execution-flow.ts`):

**Error Classification:**
```typescript
export enum OrderErrorType {
  VALIDATION_ERROR, INSUFFICIENT_FUNDS, INVALID_SYMBOL,
  MARKET_CLOSED, RATE_LIMITED, NETWORK_ERROR,
  BROKER_REJECTION, POSITION_NOT_FOUND, TIMEOUT, UNKNOWN
}
```

**Recovery Strategies:**
```typescript
export enum RecoveryStrategy {
  NONE, RETRY_IMMEDIATELY, RETRY_WITH_BACKOFF,
  ADJUST_AND_RETRY, CANCEL_AND_REPLACE,
  WAIT_FOR_MARKET_OPEN, CHECK_AND_SYNC, MANUAL_INTERVENTION
}
```

### 7.4 Order Execution Cache

Smart caching to reduce API calls (`server/lib/order-execution-cache.ts`):

| Cache | TTL (Fresh) | TTL (Stale) | Max Entries |
|-------|-------------|-------------|-------------|
| Quick Quotes | 5 seconds | 30 seconds | 500 |
| Tradability | 5 minutes | 60 minutes | 1000 |
| Account Snapshot | 10 seconds | 60 seconds | 1 |

### 7.5 AI Decision Engine Integration

The AI decision engine uses multiple connectors for data fusion:

```typescript
import { gdelt } from "../connectors/gdelt";
import { valyu } from "../connectors/valyu";
import { finnhub } from "../connectors/finnhub";
import { newsapi } from "../connectors/newsapi";
```

**Data Query Tools:**
- `get_news_sentiment` - GDELT news analysis
- `get_financial_ratios` - Valyu.ai fundamentals
- `get_earnings_data` - Valyu.ai earnings
- `get_insider_transactions` - Insider trading activity

---

## 8. Enhancements Compared to Previous Version

| Aspect | Previous | Current |
|--------|----------|---------|
| **Order Types** | Basic market/limit | Full order type matrix (bracket, trailing, OCO) |
| **Error Handling** | Simple try-catch | Classified errors with recovery strategies |
| **Caching** | None | Multi-layer cache with TTL management |
| **Validation** | Basic | Schema-based with type matrix validation |
| **Data Sources** | Alpaca + Finnhub | 8 connectors with data fusion |
| **Sentiment** | None | FinBERT via Hugging Face |
| **Fundamentals** | None | Valyu.ai integration |

### Key Improvements

1. **Order Type Matrix**: Full validation for all order type/side/class combinations
2. **Smart Caching**: Reduces API calls by 60-80% during active trading
3. **Error Classification**: Automatic recovery strategy selection
4. **Data Fusion**: Multiple sources combined for better AI decisions
5. **Circuit Breakers**: Prevent cascade failures from connector issues

---

## 9. Old vs New - Summary of Changes

### Connector Inventory Changes

| Category | Old | New |
|----------|-----|-----|
| Market Data | Alpaca, Finnhub | + CoinGecko, CoinMarketCap |
| News | NewsAPI | + GDELT (global coverage) |
| Fundamentals | None | Valyu.ai (ratios, earnings, SEC filings) |
| Sentiment | None | Hugging Face (FinBERT) |
| Total Connectors | 3 | 8 |

### Architecture Changes

```
# Old Pattern
alpaca.getQuote(symbol) → direct API call → response

# New Pattern
getQuickQuote(symbol) → cache check
  ├─ cache hit → return cached
  └─ cache miss → alpaca.getQuote() → cache result → return
```

### Error Handling Changes

```
# Old Pattern
try { await alpaca.submitOrder(...) }
catch (e) { log.error(e); throw e; }

# New Pattern
try { await alpaca.submitOrder(...) }
catch (e) {
  const classified = classifyError(e);
  switch(classified.recoveryStrategy) {
    case RETRY_WITH_BACKOFF: return retry(...)
    case WAIT_FOR_MARKET_OPEN: return scheduleForOpen(...)
    case MANUAL_INTERVENTION: return notifyUser(...)
  }
}
```

### New Files Added

| File | Purpose |
|------|---------|
| `server/trading/order-types-matrix.ts` | Order type validation |
| `server/trading/order-execution-flow.ts` | Enhanced execution |
| `server/lib/order-execution-cache.ts` | Smart caching |
| `server/connectors/gdelt.ts` | Global news |
| `server/connectors/valyu.ts` | Financial data |
| `server/connectors/huggingface.ts` | Sentiment analysis |

---

## Related Documentation

| Document | Relevance |
|----------|-----------|
| `AGENT_EXECUTION_GUIDE.md` | Section 15: Connectors & External Integrations Governance |
| `OBSERVABILITY.md` | Connector logging category (`log.connector()`) |
| `TESTING.md` | Connector testing patterns |
| `ARCHITECTURE.md` | Connector layer in system design |

---

*Last Updated: December 2025*
*Version: 2.0.0 (Microservices Migration)*
