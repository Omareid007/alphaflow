# CoinGecko API - Capability Mapping

## Provider Overview
| Attribute | Value |
|-----------|-------|
| **Provider** | CoinGecko |
| **Type** | Crypto Market Data |
| **Plan** | Demo (Free) / Pro Available |
| **Rate Limits** | 10-30 req/min (Demo), 500+ req/min (Pro) |
| **Coverage** | 13M+ tokens, 1600+ exchanges, 240+ networks |
| **Documentation** | https://docs.coingecko.com |

---

## Current Usage Summary

### Actively Used (✅)
| Feature | Implementation | File |
|---------|---------------|------|
| Coin Markets | `getMarkets()` | `server/connectors/coingecko.ts` |
| Simple Price | `getSimplePrice()` | `server/connectors/coingecko.ts` |
| Market Chart | `getMarketChart()` | `server/connectors/coingecko.ts` |
| Trending Coins | `getTrending()` | `server/connectors/coingecko.ts` |
| Global Data | `getGlobalData()` | `server/connectors/coingecko.ts` |
| Coin List | `getCoinList()` | `server/connectors/coingecko.ts` |
| Search | `searchCoins()` | `server/connectors/coingecko.ts` |

### Not Yet Implemented (❌)
| Feature | CoinGecko Endpoint | Impact |
|---------|-------------------|--------|
| **OHLCV Data** | `/coins/{id}/ohlc` | Candlestick charts, technical analysis |
| **Coin Details** | `/coins/{id}` | Full coin info, links, categories |
| **Tickers** | `/coins/{id}/tickers` | Exchange-specific prices |
| **Historical Data** | `/coins/{id}/history` | Point-in-time snapshots |
| **Exchange List** | `/exchanges` | Exchange rankings |
| **Exchange Volume** | `/exchanges/{id}/volume_chart` | Liquidity analysis |
| **Categories** | `/coins/categories` | Sector classification |
| **Asset Platforms** | `/asset_platforms` | Blockchain networks |
| **On-chain DEX Data** | `/onchain/*` | DEX pools, trades, tokens |
| **NFT Data** | `/nfts/*` | NFT floor prices, collections |
| **Derivatives** | `/derivatives` | Futures & perpetuals |
| **Company Holdings** | `/companies/public_treasury/{coin}` | Corporate BTC/ETH holdings |

---

## High-Impact Underused Capabilities

### 1. OHLCV Data (CRITICAL for Technical Analysis)
**Endpoint:** `/coins/{id}/ohlc?vs_currency=usd&days=30`
**Impact:** Enable proper candlestick analysis, not just line charts

```json
[
  [1704067200000, 42123.45, 42890.12, 41890.00, 42567.89],  // [timestamp, O, H, L, C]
  [1704153600000, 42567.89, 43012.34, 42100.00, 42890.12]
]
```

**Granularity by days parameter:**
- 1-2 days → 30 min intervals
- 3-30 days → 4 hour intervals
- 31+ days → 4 day intervals

**Use Cases:**
- Technical indicators: RSI, MACD, Bollinger Bands
- Pattern recognition: Candlestick patterns
- Volume analysis: Volume-price correlation

### 2. Coin Details (COMPREHENSIVE METADATA)
**Endpoint:** `/coins/{id}?localization=false&tickers=false`
**Impact:** Rich metadata for filtering and context

```json
{
  "id": "bitcoin",
  "symbol": "btc",
  "name": "Bitcoin",
  "categories": ["Cryptocurrency", "Layer 1"],
  "description": { "en": "..." },
  "links": { "homepage": [...], "twitter_screen_name": "..." },
  "market_data": {
    "current_price": { "usd": 42567 },
    "ath": { "usd": 69000 },
    "ath_change_percentage": { "usd": -38.3 },
    "market_cap_rank": 1,
    "fully_diluted_valuation": { "usd": 894000000000 },
    "total_supply": 21000000,
    "circulating_supply": 19500000,
    "max_supply": 21000000
  },
  "developer_data": {
    "forks": 36000,
    "stars": 72000,
    "commit_count_4_weeks": 45
  },
  "community_data": {
    "twitter_followers": 5800000
  }
}
```

**Use Cases:**
- Supply analysis: Circulating vs max supply
- Development activity: GitHub metrics
- Community health: Social metrics

### 3. On-Chain DEX Data (20+ endpoints - Pro/Enterprise)
**Base:** `/onchain/networks/{network}/pools/*`
**Impact:** Real-time DEX liquidity, trades, new pools

**Key Endpoints:**
```
/onchain/networks                              # List all DEX networks
/onchain/networks/{network}/dexes              # DEXes on a network
/onchain/networks/{network}/pools              # All pools
/onchain/networks/{network}/pools/{address}    # Pool details
/onchain/networks/{network}/pools/{address}/trades  # Recent trades
/onchain/networks/{network}/pools/{address}/ohlcv/{timeframe}  # Pool OHLCV
/onchain/networks/{network}/trending_pools     # Trending pools
/onchain/networks/{network}/new_pools          # New pools
/onchain/search/pools?query=PEPE               # Search pools
```

**Use Cases (Future):**
- Liquidity analysis: Pool depth, slippage estimation
- New token discovery: Early mover advantage
- DEX arbitrage: Cross-DEX price differences
- Token sentiment: Trading activity patterns

### 4. Categories (SECTOR ANALYSIS)
**Endpoint:** `/coins/categories`
**Impact:** Sector-based trading and diversification

```json
{
  "data": [
    {
      "id": "layer-1",
      "name": "Layer 1",
      "market_cap": 1200000000000,
      "market_cap_change_24h": 2.5,
      "volume_24h": 45000000000,
      "top_3_coins": ["bitcoin", "ethereum", "solana"]
    },
    {
      "id": "defi",
      "name": "Decentralized Finance",
      "market_cap": 89000000000,
      "market_cap_change_24h": -1.2
    }
  ]
}
```

**Use Cases:**
- Sector rotation: Move between L1, DeFi, Gaming
- Correlation analysis: Category-level performance
- Diversification: Ensure exposure across categories

### 5. Exchange Data (LIQUIDITY INTELLIGENCE)
**Endpoints:**
- `/exchanges` - Exchange rankings
- `/exchanges/{id}` - Exchange details
- `/exchanges/{id}/tickers` - All trading pairs

**Impact:** Trade on high-liquidity venues, avoid thin markets

**Use Cases:**
- Liquidity scoring: Prefer high-volume exchanges
- Price discovery: Cross-exchange price comparison
- Risk assessment: Exchange trust scores

### 6. Company Holdings (INSTITUTIONAL FLOWS)
**Endpoint:** `/companies/public_treasury/bitcoin`
**Impact:** Track institutional adoption

```json
{
  "total_holdings": 271400,
  "total_value_usd": 11540000000,
  "companies": [
    {
      "name": "MicroStrategy",
      "symbol": "MSTR",
      "total_holdings": 152800,
      "percentage_of_total_supply": 0.728
    }
  ]
}
```

**Use Cases:**
- Institutional sentiment indicator
- Supply absorption analysis
- Long-term trend confirmation

---

## Capability Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| OHLCV Data | HIGH | LOW | P0 |
| Coin Details | MEDIUM | LOW | P1 |
| Categories | MEDIUM | LOW | P1 |
| Exchange Rankings | LOW | LOW | P2 |
| Historical Snapshots | LOW | LOW | P3 |
| On-Chain DEX (Pro) | HIGH | HIGH | P4 |
| Company Holdings | LOW | LOW | P3 |

---

## API Endpoints Reference

### Coins
| Endpoint | Method | Current Use | Value |
|----------|--------|-------------|-------|
| `/coins/markets` | GET | ✅ | Market rankings |
| `/coins/list` | GET | ✅ | All coin IDs |
| `/coins/{id}` | GET | ❌ | Full details |
| `/coins/{id}/ohlc` | GET | ❌ | OHLCV candlesticks |
| `/coins/{id}/market_chart` | GET | ✅ | Price history |
| `/coins/{id}/history` | GET | ❌ | Point-in-time |
| `/coins/{id}/tickers` | GET | ❌ | Exchange prices |

### Simple
| Endpoint | Method | Current Use | Value |
|----------|--------|-------------|-------|
| `/simple/price` | GET | ✅ | Quick prices |
| `/simple/token_price/{platform}` | GET | ❌ | Token by contract |

### Global
| Endpoint | Method | Current Use | Value |
|----------|--------|-------------|-------|
| `/global` | GET | ✅ | Market overview |
| `/global/decentralized_finance_defi` | GET | ❌ | DeFi metrics |

### Search & Discovery
| Endpoint | Method | Current Use | Value |
|----------|--------|-------------|-------|
| `/search` | GET | ✅ | Find coins |
| `/search/trending` | GET | ✅ | Trending coins |

### Categories
| Endpoint | Method | Current Use | Value |
|----------|--------|-------------|-------|
| `/coins/categories` | GET | ❌ | Sector data |
| `/coins/categories/list` | GET | ❌ | Category IDs |

### Exchanges
| Endpoint | Method | Current Use | Value |
|----------|--------|-------------|-------|
| `/exchanges` | GET | ❌ | Rankings |
| `/exchanges/{id}` | GET | ❌ | Details |
| `/exchanges/{id}/tickers` | GET | ❌ | Trading pairs |

### On-Chain (Pro/Enterprise)
| Endpoint | Method | Current Use | Value |
|----------|--------|-------------|-------|
| `/onchain/networks` | GET | ❌ | Blockchain networks |
| `/onchain/networks/{network}/pools` | GET | ❌ | DEX pools |
| `/onchain/networks/{network}/trending_pools` | GET | ❌ | Hot pools |
| `/onchain/networks/{network}/pools/{address}/ohlcv/*` | GET | ❌ | Pool OHLCV |

---

## Recommendations

### Immediate Actions (Phase 2)
1. **Add OHLCV endpoint** - Essential for technical indicators
2. **Add categories endpoint** - Enable sector analysis
3. **Enrich with coin details** - Better metadata

### Future Enhancements (Phase 3+)
1. Consider Pro API for on-chain DEX data
2. Add exchange volume analysis
3. Implement company holdings tracking

### Rate Limit Strategy
- Demo: 10-30 req/min = strict throttling
- Priority caching: OHLCV (5min), markets (1min)
- Batch coin IDs in simple/price calls
- Background refresh for trending/global

### Symbol Mapping
Current crypto trading universe uses Alpaca symbols (BTC/USD, ETH/USD).
CoinGecko uses IDs (bitcoin, ethereum).

**Mapping needed:**
```typescript
const SYMBOL_TO_COINGECKO_ID = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'XRP': 'ripple',
  'DOGE': 'dogecoin',
  'ADA': 'cardano',
  'DOT': 'polkadot',
  'LINK': 'chainlink',
  'AVAX': 'avalanche-2',
  'MATIC': 'matic-network',
  'LTC': 'litecoin'
};
```
