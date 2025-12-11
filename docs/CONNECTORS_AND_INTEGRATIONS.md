# Connectors & External Integrations

> **Purpose**  
> Deep-dive documentation on external API connectors, integration patterns, error handling, and best practices.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Connector Inventory](#2-connector-inventory)
3. [Common Patterns](#3-common-patterns)
4. [Error Handling](#4-error-handling)
5. [Rate Limiting](#5-rate-limiting)
6. [Testing Connectors](#6-testing-connectors)

---

## 1. Overview

AI Active Trader integrates with multiple external services for market data, trading execution, and news feeds. All connectors follow the **adapter pattern** to provide a consistent interface to the application.

**Architecture principle:** The orchestrator and trading engine interact with connectors through stable interfaces. If an external API changes, only the connector needs updating.

---

## 2. Connector Inventory

### 2.1 Alpaca (Broker)

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

*Last Updated: December 2024*
