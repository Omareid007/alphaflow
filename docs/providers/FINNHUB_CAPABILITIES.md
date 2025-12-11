# Finnhub API - Capability Mapping

## Provider Overview
| Attribute | Value |
|-----------|-------|
| **Provider** | Finnhub.io |
| **Type** | Market Data & Fundamentals |
| **Plan** | Free Tier |
| **Rate Limits** | 60 req/min (Free), 300+ req/min (Premium) |
| **Documentation** | https://finnhub.io/docs/api |

---

## Current Usage Summary

### Actively Used (✅)
| Feature | Implementation | File |
|---------|---------------|------|
| Stock Quotes | `getQuote()` | `server/connectors/finnhub.ts` |
| Stock Candles | `getCandles()` | `server/connectors/finnhub.ts` |
| Company Profile | `getCompanyProfile()` | `server/connectors/finnhub.ts` |
| Symbol Search | `searchSymbols()` | `server/connectors/finnhub.ts` |
| Market News | `getMarketNews()` | `server/connectors/finnhub.ts` |
| Multiple Quotes | `getMultipleQuotes()` | `server/connectors/finnhub.ts` |

### Not Yet Implemented (❌)
| Feature | Finnhub Endpoint | Impact |
|---------|-----------------|--------|
| **Basic Financials** | `/stock/metric` | P/E, ROE, debt ratios |
| **Financial Statements** | `/stock/financials` | 30yr income/balance/cash flow |
| **Earnings History** | `/stock/earnings` | EPS surprises, trends |
| **EPS Estimates** | `/stock/eps-estimates` | Forward expectations |
| **Revenue Estimates** | `/stock/revenue-estimates` | Growth projections |
| **Price Targets** | `/stock/price-target` | Analyst consensus |
| **Recommendations** | `/stock/recommendation` | Buy/sell ratings |
| **Insider Transactions** | `/stock/insider-transactions` | Insider buys/sells |
| **Economic Calendar** | `/calendar/economic` | GDP, CPI, employment |
| **Economic Data** | `/economic` | Macro indicators |
| **Earnings Calendar** | `/calendar/earnings` | Upcoming earnings |
| **IPO Calendar** | `/calendar/ipo` | Upcoming IPOs |
| **Technical Indicators** | `/scan/technical-indicator` | RSI, MACD, MA signals |
| **Support/Resistance** | `/scan/support-resistance` | Key price levels |
| **Peers** | `/stock/peers` | Similar companies |
| **ESG Scores** | `/stock/esg` | Sustainability metrics |
| **Dividends** | `/stock/dividend` | Dividend history |

---

## High-Impact Underused Capabilities

### 1. Basic Financials (CRITICAL for Valuation)
**Endpoint:** `/stock/metric?symbol=AAPL&metric=all`
**Impact:** Enables value-based filtering and risk assessment

**Returns:**
```json
{
  "metric": {
    "10DayAverageTradingVolume": 89.5,
    "52WeekHigh": 182.94,
    "52WeekLow": 124.17,
    "beta": 1.28,
    "bookValuePerShareQuarterly": 4.14,
    "currentRatio": 1.04,
    "dividendYieldIndicatedAnnual": 0.52,
    "epsBasicExclExtraItemsTTM": 5.89,
    "epsGrowth3Y": 21.8,
    "grossMargin5Y": 39.8,
    "marketCapitalization": 2890000,
    "netProfitMarginTTM": 25.3,
    "peBasicExclExtraTTM": 28.7,
    "priceToBookMRQ": 42.8,
    "roeTTM": 147.2,
    "revenueGrowth3Y": 8.2
  }
}
```

**Use Cases:**
- Universe filtering: P/E < 30, ROE > 15%, currentRatio > 1.0
- Risk scoring: Beta, volatility, debt levels
- Quality screening: Margin stability, growth consistency

### 2. Earnings & EPS Estimates (CRITICAL for Momentum)
**Endpoints:**
- `/stock/earnings?symbol=AAPL` - Historical earnings surprises
- `/stock/eps-estimates?symbol=AAPL&freq=quarterly` - Forward EPS

**Impact:** Predict earnings-driven price moves

```json
// Earnings surprises
{
  "data": [
    { "actual": 1.52, "estimate": 1.43, "surprise": 0.09, "surprisePercent": 6.29 }
  ]
}

// EPS estimates
{
  "data": [
    { "epsAvg": 1.58, "epsHigh": 1.75, "epsLow": 1.42, "numberAnalysts": 28 }
  ]
}
```

**Use Cases:**
- Earnings momentum: Companies consistently beating estimates
- Pre-earnings positioning: Volatility plays
- Post-earnings trading: Trend following after surprises

### 3. Technical Indicators (BUILT-IN SIGNALS)
**Endpoint:** `/scan/technical-indicator?symbol=AAPL&resolution=D`
**Impact:** Pre-calculated signals reduce computation, improve accuracy

```json
{
  "technicalAnalysis": {
    "count": { "buy": 12, "neutral": 7, "sell": 6 },
    "signal": "buy"
  },
  "trend": {
    "adx": 25.4,
    "trending": true
  }
}
```

**Indicators Included:**
- Moving averages: SMA 10/20/30/50/100/200, EMA 10/20/30/50/100/200
- Oscillators: RSI, MACD, Stochastic, Williams %R, CCI
- Volume: OBV, ADL
- Trend: ADX

**Use Cases:**
- Momentum strategy: Confirm RSI/MACD signals
- Mean reversion: Identify oversold conditions
- Trend following: ADX trending confirmation

### 4. Insider Transactions (ALTERNATIVE SIGNAL)
**Endpoint:** `/stock/insider-transactions?symbol=AAPL`
**Impact:** Insider buying often precedes price increases

```json
{
  "data": [
    {
      "name": "Tim Cook",
      "share": 750000,
      "change": 100000,
      "transactionCode": "P",  // P=Purchase, S=Sale
      "transactionDate": "2024-01-15",
      "transactionPrice": 185.25
    }
  ]
}
```

**Use Cases:**
- Buy signals: Cluster insider purchases
- Avoid signals: Massive insider selling
- Confidence boost: Insider activity + AI signal alignment

### 5. Economic Calendar & Data (MACRO CONTEXT)
**Endpoints:**
- `/calendar/economic?from=2024-01-01&to=2024-01-31` - Upcoming events
- `/economic?code=MA-USA-656880` - Historical data

**Impact:** Macro-aware trading, avoid volatility events

**Key Indicators:**
- GDP growth rate
- Inflation (CPI, PPI)
- Employment (NFP, unemployment)
- Interest rates (Fed funds)
- Consumer sentiment

**Use Cases:**
- Event calendar: Reduce position sizing before FOMC, CPI
- Trend detection: Economic momentum signals
- Sector rotation: Interest rate sensitivity

### 6. Price Targets & Recommendations
**Endpoints:**
- `/stock/price-target?symbol=AAPL`
- `/stock/recommendation?symbol=AAPL`

**Impact:** Analyst consensus as signal confirmation

```json
// Price targets
{
  "targetHigh": 220,
  "targetLow": 150,
  "targetMean": 195,
  "targetMedian": 195,
  "lastUpdated": "2024-01-15"
}

// Recommendations
{
  "data": [
    { "buy": 30, "hold": 8, "sell": 2, "period": "2024-01" }
  ]
}
```

### 7. Earnings Calendar (EVENT-DRIVEN)
**Endpoint:** `/calendar/earnings?from=2024-01-15&to=2024-01-22`
**Impact:** Avoid or exploit earnings volatility

---

## Capability Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Basic Financials (`/stock/metric`) | HIGH | LOW | P0 |
| Technical Indicators (`/scan/technical-indicator`) | HIGH | LOW | P0 |
| Earnings History | HIGH | LOW | P1 |
| EPS/Revenue Estimates | MEDIUM | LOW | P1 |
| Insider Transactions | MEDIUM | LOW | P1 |
| Economic Calendar | MEDIUM | MEDIUM | P2 |
| Price Targets | LOW | LOW | P2 |
| Recommendations | LOW | LOW | P2 |
| Support/Resistance | MEDIUM | LOW | P2 |
| ESG Scores | LOW | LOW | P3 |

---

## API Endpoints Reference

### Stock Fundamentals
| Endpoint | Method | Current Use | Value |
|----------|--------|-------------|-------|
| `/stock/metric` | GET | ❌ | P/E, ROE, margins |
| `/stock/financials` | GET | ❌ | Full statements (Premium) |
| `/stock/earnings` | GET | ❌ | EPS surprises |
| `/stock/eps-estimates` | GET | ❌ | Forward EPS |
| `/stock/revenue-estimates` | GET | ❌ | Revenue forecasts |
| `/stock/price-target` | GET | ❌ | Analyst targets |
| `/stock/recommendation` | GET | ❌ | Buy/hold/sell |
| `/stock/insider-transactions` | GET | ❌ | Insider activity |
| `/stock/peers` | GET | ❌ | Similar companies |
| `/stock/dividend` | GET | ❌ | Dividend history |
| `/stock/profile2` | GET | ✅ | Company info |

### Market Data
| Endpoint | Method | Current Use | Value |
|----------|--------|-------------|-------|
| `/quote` | GET | ✅ | Real-time price |
| `/stock/candle` | GET | ✅ | OHLCV data |
| `/search` | GET | ✅ | Symbol lookup |

### Calendars
| Endpoint | Method | Current Use | Value |
|----------|--------|-------------|-------|
| `/calendar/earnings` | GET | ❌ | Earnings dates |
| `/calendar/ipo` | GET | ❌ | IPO calendar |
| `/calendar/economic` | GET | ❌ | Macro events |

### Technical Analysis
| Endpoint | Method | Current Use | Value |
|----------|--------|-------------|-------|
| `/scan/technical-indicator` | GET | ❌ | Pre-calculated signals |
| `/scan/support-resistance` | GET | ❌ | Key levels |
| `/scan/pattern` | GET | ❌ | Chart patterns |

### News
| Endpoint | Method | Current Use | Value |
|----------|--------|-------------|-------|
| `/news` | GET | ✅ | Market news |
| `/company-news` | GET | ❌ | Company-specific |

---

## Recommendations

### Immediate Actions (Phase 2)
1. **Add basic financials** - Single API call, massive value
2. **Add technical indicators** - Pre-calculated, reduces complexity
3. **Add earnings history** - Essential for momentum strategies

### Future Enhancements (Phase 3+)
1. Implement economic calendar for macro awareness
2. Add insider transaction signals
3. Build earnings-based trading rules

### Rate Limit Strategy
- Free tier: 60 req/min = 1 req/sec
- Priority caching: Financials (1hr), quotes (1min)
- Background refresh during off-hours
- Consider Premium for expanded universe
