# Market Data Collector Service

A comprehensive market data aggregation service that collects and formats data from multiple sources for AI analysis.

## Overview

The Market Data Collector is a centralized service that:
- **Aggregates** data from multiple connectors (Alpaca, Finnhub, GDELT, NewsAPI)
- **Calculates** technical indicators from historical price data
- **Enriches** symbol data with news sentiment and market context
- **Caches** data intelligently with multi-tier TTLs
- **Handles** rate limits gracefully with exponential backoff
- **Degrades** gracefully when APIs are unavailable

## Features

### Multi-Source Data Aggregation
- **Alpaca**: Real-time prices, quotes, bars, volume
- **Finnhub**: Fundamentals (P/E, market cap, sector)
- **GDELT**: News sentiment, tone analysis, volume spikes
- **NewsAPI**: Stock-specific news headlines
- **Technical Indicators**: RSI, MACD, SMA, Bollinger Bands, ATR

### Smart Caching
- **Prices**: 30 seconds (real-time responsiveness)
- **News**: 5 minutes (breaking news balance)
- **Fundamentals**: 1 hour (stable data)
- **Market Overview**: 1 minute (broad context)

### Parallel Processing
- Watchlist collection processes symbols in batches
- All data sources called in parallel where possible
- Optimized for minimal latency

### Rate Limit Handling
- Automatic throttling (200ms between requests)
- Exponential backoff on failures (1s, 2s, 4s, 8s)
- Request queuing to prevent overwhelming APIs

## Installation

```typescript
import { marketDataCollector } from "@/server/services/market-data-collector";
```

## API Reference

### `collectForSymbol(symbol: string, companyName?: string): Promise<SymbolDataPackage>`

Collect complete data package for a single symbol.

**Parameters:**
- `symbol` (string): Stock ticker symbol (e.g., "AAPL")
- `companyName` (string, optional): Company name for better news matching

**Returns:** `SymbolDataPackage` with:
- **price**: Current, open, high, low, close, change, changePercent, previousClose
- **volume**: Current, average, ratio
- **technicals**: RSI, MACD, SMA(20/50/200), Bollinger Bands, ATR
- **news**: Headlines, sentiment, articleCount, averageTone, volumeSpike
- **fundamentals**: P/E, marketCap, sector, industry, beta, dividendYield, 52-week range
- **marketContext**: SPY change, VIX, sector performance

**Example:**
```typescript
const data = await marketDataCollector.collectForSymbol("AAPL", "Apple Inc");

console.log(`Current Price: $${data.price.current}`);
console.log(`RSI: ${data.technicals.rsi}`);
console.log(`Sentiment: ${data.news.sentiment}`);
console.log(`P/E Ratio: ${data.fundamentals.pe}`);
```

---

### `collectForWatchlist(symbols: string[]): Promise<SymbolDataPackage[]>`

Collect data for multiple symbols in parallel batches.

**Parameters:**
- `symbols` (string[]): Array of ticker symbols

**Returns:** Array of `SymbolDataPackage` objects

**Example:**
```typescript
const watchlist = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"];
const results = await marketDataCollector.collectForWatchlist(watchlist);

results.forEach(data => {
  console.log(`${data.symbol}: $${data.price.current} (${data.price.changePercent}%)`);
});
```

**Performance:** Processes in batches of 5 to avoid overwhelming APIs. Typical performance: 1-2 seconds per symbol on cold cache, <50ms on hot cache.

---

### `collectMarketOverview(): Promise<MarketOverview>`

Collect broad market overview data (SPY, VIX, sector performance).

**Returns:** `MarketOverview` with:
- **spy**: Price, change, changePercent
- **vix**: Price, change
- **sectors**: Array of sector ETFs with performance
- **marketStatus**: isOpen, session (pre-market/regular/after-hours/closed)

**Example:**
```typescript
const overview = await marketDataCollector.collectMarketOverview();

console.log(`Market is ${overview.marketStatus.session}`);
console.log(`SPY: ${overview.spy.changePercent}%`);
console.log(`VIX: ${overview.vix.price}`);

// Find best performing sector
const topSector = overview.sectors[0];
console.log(`Top Sector: ${topSector.name} (+${topSector.change}%)`);
```

---

### `getLatestSnapshot(symbol: string): Promise<QuickSnapshot>`

Get quick price snapshot without full data collection (fast, minimal API calls).

**Parameters:**
- `symbol` (string): Stock ticker symbol

**Returns:** `QuickSnapshot` with:
- symbol, price, change, changePercent, volume, timestamp

**Example:**
```typescript
const snapshot = await marketDataCollector.getLatestSnapshot("TSLA");
console.log(`TSLA: $${snapshot.price} (${snapshot.changePercent}%)`);
```

**Use Case:** When you only need current price/change, not full analysis data.

---

### Cache Management

#### `clearAllCaches(): void`
Clear all cached data (price, news, fundamentals, market overview).

```typescript
marketDataCollector.clearAllCaches();
```

#### `clearSymbolCache(symbol: string): void`
Clear cache for a specific symbol.

```typescript
marketDataCollector.clearSymbolCache("AAPL");
```

#### `getCacheStats(): CacheStats`
Get cache statistics.

```typescript
const stats = marketDataCollector.getCacheStats();
console.log(`Cached symbols: ${stats.priceCache}`);
console.log(`News entries: ${stats.newsCache}`);
```

## Data Structures

### SymbolDataPackage

```typescript
interface SymbolDataPackage {
  symbol: string;
  timestamp: Date;

  price: {
    current: number;
    open: number;
    high: number;
    low: number;
    close: number;
    change: number;
    changePercent: number;
    previousClose: number;
  };

  volume: {
    current: number;
    average: number;
    ratio: number;  // Current/Average
  };

  technicals: {
    rsi: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
    bollingerBands: {
      upper: number | null;
      lower: number | null;
      middle: number | null;
    };
    atr: number | null;
  };

  news: {
    headlines: string[];
    sentiment: "bullish" | "bearish" | "neutral";
    articleCount: number;
    averageTone: number;  // GDELT tone (-10 to +10)
    volumeSpike: boolean;  // News volume anomaly
  };

  fundamentals: {
    pe: number | null;
    marketCap: number | null;
    sector: string | null;
    industry: string | null;
    beta: number | null;
    dividendYield: number | null;
    week52High: number | null;
    week52Low: number | null;
  };

  marketContext: {
    spyChange: number;  // S&P 500 change %
    vix: number;  // Volatility index
    sectorPerformance: Record<string, number>;  // Sector ETF changes
  };
}
```

### MarketOverview

```typescript
interface MarketOverview {
  timestamp: Date;

  spy: {
    price: number;
    change: number;
    changePercent: number;
  };

  vix: {
    price: number;
    change: number;
  };

  sectors: {
    symbol: string;
    name: string;
    change: number;
  }[];

  marketStatus: {
    isOpen: boolean;
    session: "pre-market" | "regular" | "after-hours" | "closed";
  };
}
```

## Use Cases

### 1. AI Trading Decision Input

```typescript
const data = await marketDataCollector.collectForSymbol("AAPL");

// AI can now analyze:
// - Price momentum (change, technicals)
// - News sentiment (headlines, tone)
// - Fundamental health (P/E, sector)
// - Market context (SPY correlation, sector rotation)
```

### 2. Portfolio Scanning

```typescript
const portfolio = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"];
const results = await marketDataCollector.collectForWatchlist(portfolio);

// Identify opportunities
const oversold = results.filter(d => d.technicals.rsi && d.technicals.rsi < 30);
const bullishNews = results.filter(d => d.news.sentiment === "bullish");
const highVolume = results.filter(d => d.volume.ratio > 2);
```

### 3. Market Regime Detection

```typescript
const overview = await marketDataCollector.collectMarketOverview();

// Detect market conditions
const isBullish = overview.spy.changePercent > 0 && overview.vix.price < 20;
const isVolatile = overview.vix.price > 30;
const sectorRotation = overview.sectors[0].change - overview.sectors[8].change > 2;
```

### 4. Real-time Monitoring

```typescript
// Quick checks without full data collection
const symbols = ["AAPL", "TSLA", "SPY"];

for (const symbol of symbols) {
  const snapshot = await marketDataCollector.getLatestSnapshot(symbol);

  if (Math.abs(snapshot.changePercent) > 5) {
    console.log(`ALERT: ${symbol} moved ${snapshot.changePercent}%`);
  }
}
```

## Performance Characteristics

| Operation | Cold Cache | Hot Cache | API Calls |
|-----------|------------|-----------|-----------|
| Single Symbol | ~2-3s | <50ms | 4-5 |
| Watchlist (5 symbols) | ~8-10s | <100ms | 15-20 |
| Market Overview | ~1-2s | <20ms | 1-2 |
| Quick Snapshot | ~300ms | <50ms | 1 |

## Error Handling

The service implements graceful degradation:

1. **API Failures**: Returns empty/null data for failed sections
2. **Rate Limits**: Exponential backoff with retries
3. **Partial Data**: Returns best-effort results even if some sources fail
4. **Cache Fallback**: Uses stale cache on new request failures

Example:
```typescript
const data = await marketDataCollector.collectForSymbol("INVALID");

// data.price will be populated if Alpaca succeeds
// data.news will be empty if GDELT/NewsAPI fail
// data.fundamentals will be null if Finnhub unavailable
```

## Technical Indicators

Calculated from 200+ days of historical price data:

- **RSI (14)**: Relative Strength Index (oversold < 30, overbought > 70)
- **MACD**: Moving Average Convergence Divergence
- **SMA (20/50/200)**: Simple Moving Averages
- **Bollinger Bands**: Price volatility bands (2 std dev)
- **ATR (14)**: Average True Range (volatility measure)

## Testing

Run the comprehensive test suite:

```bash
tsx scripts/test-market-data-collector.ts
```

Tests cover:
- Single symbol collection
- Parallel watchlist collection
- Market overview
- Quick snapshots
- Cache behavior
- Cache invalidation

## Integration with AI Systems

The service is designed to feed AI decision engines:

```typescript
import { marketDataCollector } from "@/server/services/market-data-collector";
import { decisionEngine } from "@/server/ai/decision-engine";

// Collect data
const data = await marketDataCollector.collectForSymbol("AAPL");

// Feed to AI
const decision = await decisionEngine.analyze({
  symbol: data.symbol,
  price: data.price.current,
  technicals: data.technicals,
  sentiment: data.news.sentiment,
  marketContext: data.marketContext,
});
```

## Best Practices

1. **Use Watchlist Collection** for multiple symbols (parallelized, batched)
2. **Use Quick Snapshots** for real-time monitoring (minimal API usage)
3. **Leverage Caching** - don't clear caches unnecessarily
4. **Handle Nulls** - fundamentals/technicals may be unavailable
5. **Check Market Status** before making trading decisions

## Dependencies

- `server/connectors/alpaca`: Price data, snapshots, bars
- `server/connectors/finnhub`: Fundamentals, company profiles
- `server/connectors/gdelt`: News sentiment, volume analysis
- `server/connectors/newsapi`: Stock-specific headlines
- `server/lib/technical-indicators`: RSI, MACD, SMA, Bollinger Bands

## License

Internal use only - part of the autonomous trading platform.
