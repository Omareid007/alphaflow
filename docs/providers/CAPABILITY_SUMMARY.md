# Provider Capability Summary

## Phase 1 Complete: Provider Discovery & Capability Mapping

This document summarizes the gap analysis between current implementation and available provider capabilities.

---

## Executive Summary

### Key Findings

| Provider | Current Usage | Available | Gap |
|----------|--------------|-----------|-----|
| **Alpaca** | 65% | 100% | Bracket/trailing orders unused |
| **Finnhub** | 25% | 100% | Fundamentals, technicals unused |
| **CoinGecko** | 40% | 100% | OHLCV, categories unused |
| **OpenAI** | 35% | 100% | Structured outputs, batch unused |

### Highest-Impact Opportunities

1. **OpenAI Structured Outputs** - Eliminate JSON parsing errors, guarantee schema compliance
2. **Alpaca Bracket Orders** - Atomic entry + take-profit + stop-loss
3. **Finnhub Basic Financials** - P/E, ROE, margins for valuation filtering
4. **OpenAI Batch API** - 50% cost reduction on bulk analysis
5. **Finnhub Technical Indicators** - Pre-calculated RSI, MACD, signals

---

## Current vs Optimal Feature Matrix

### Alpaca (Brokerage)

| Feature | Current | Optimal | Priority |
|---------|---------|---------|----------|
| Account/Positions | ✅ | ✅ | - |
| Market Orders | ✅ | ✅ | - |
| Limit/Stop Orders | ✅ | ✅ | - |
| **Bracket Orders** | ⚠️ Interface only | Full integration | P0 |
| **Trailing Stops** | ⚠️ Interface only | Active use | P0 |
| **OCO Orders** | ❌ | For existing positions | P1 |
| Portfolio History | ⚠️ Implemented | Analytics display | P1 |
| Extended Hours | ❌ | Optional | P3 |

### Finnhub (Market Data)

| Feature | Current | Optimal | Priority |
|---------|---------|---------|----------|
| Stock Quotes | ✅ | ✅ | - |
| Candles (OHLCV) | ✅ | ✅ | - |
| Company Profile | ✅ | ✅ | - |
| Market News | ✅ | ✅ | - |
| **Basic Financials** | ❌ | P/E, ROE, ratios | P0 |
| **Technical Indicators** | ❌ | RSI, MACD, signals | P0 |
| **Earnings History** | ❌ | EPS surprises | P1 |
| **EPS Estimates** | ❌ | Forward guidance | P1 |
| Insider Transactions | ❌ | Alternative signal | P2 |
| Economic Calendar | ❌ | Macro awareness | P2 |

### CoinGecko (Crypto Data)

| Feature | Current | Optimal | Priority |
|---------|---------|---------|----------|
| Market Rankings | ✅ | ✅ | - |
| Simple Price | ✅ | ✅ | - |
| Market Chart | ✅ | ✅ | - |
| Trending | ✅ | ✅ | - |
| **OHLCV Data** | ❌ | Candlestick analysis | P0 |
| **Categories** | ❌ | Sector rotation | P1 |
| Coin Details | ❌ | Rich metadata | P1 |
| Exchange Rankings | ❌ | Liquidity scoring | P2 |
| On-Chain DEX | ❌ | Pro tier (future) | P4 |

### OpenAI (AI/LLM)

| Feature | Current | Optimal | Priority |
|---------|---------|---------|----------|
| Chat Completions | ✅ | ✅ | - |
| Tool Calling | ✅ | ✅ | - |
| **Structured Outputs** | ❌ | `strict: true` | P0 |
| **Batch API** | ❌ | 50% cost savings | P0 |
| Response Format | ❌ | Structured responses | P1 |
| Streaming | ❌ | Real-time UI | P2 |
| Embeddings | ❌ | Pattern matching | P3 |

---

## Implementation Roadmap

### Phase 2: Core Provider Upgrades (Next)

**Sprint 2.1: OpenAI Enhancements**
- [ ] Enable `strict: true` on all tool definitions
- [ ] Add `parallel_tool_calls: false` for structured outputs
- [ ] Validate all tool schemas against OpenAI requirements
- [ ] Create batch processor for universe screening

**Sprint 2.2: Alpaca Order Upgrades**
- [ ] Wire bracket orders to trade executor
- [ ] Add trailing stop logic to position monitoring
- [ ] Implement OCO for legacy positions
- [ ] Surface portfolio history in Analytics

**Sprint 2.3: Finnhub Data Expansion**
- [ ] Add `/stock/metric` for basic financials
- [ ] Add `/scan/technical-indicator` for signals
- [ ] Add `/stock/earnings` for EPS history
- [ ] Integrate financials into Data Fusion Engine

**Sprint 2.4: CoinGecko Enhancements**
- [ ] Add `/coins/{id}/ohlc` for candlesticks
- [ ] Add `/coins/categories` for sector data
- [ ] Build symbol-to-ID mapping utility

### Phase 3: Risk-Adjusted Performance (Future)

- Sharpe ratio calculation using portfolio history
- Max drawdown tracking
- Profit factor metrics
- Walk-forward backtesting

### Phase 4: Universe Selection Service (Future)

- FOCUSED mode: 10-15 curated symbols
- CORE mode: 50+ liquid large/mid caps
- EXPANDED mode: 100+ with small caps

---

## Risk Assessment

### Low Risk (Safe to implement)
- OpenAI structured outputs - additive, backward compatible
- Finnhub new endpoints - additive data sources
- CoinGecko OHLCV - additive data

### Medium Risk (Requires testing)
- Bracket orders - changes order flow, needs paper testing
- Batch API - async processing, needs monitoring

### High Risk (Careful rollout)
- Trailing stops - dynamic order modification
- Extended hours - different liquidity characteristics

---

## Cost Impact

### Current State
- OpenAI: ~$1/day (real-time calls)
- Finnhub: Free tier
- CoinGecko: Free tier
- Alpaca: Free (paper trading)

### After Optimization
- OpenAI: ~$0.50/day (batch API 50% savings)
- Finnhub: Free tier (efficient caching)
- CoinGecko: Free tier (efficient caching)
- Alpaca: Free (paper trading)

**Net savings: ~$15/month on AI costs**

---

## Documentation Links

| Provider | Capability Doc | Status |
|----------|---------------|--------|
| Alpaca | [ALPACA_CAPABILITIES.md](./ALPACA_CAPABILITIES.md) | ✅ Complete |
| Finnhub | [FINNHUB_CAPABILITIES.md](./FINNHUB_CAPABILITIES.md) | ✅ Complete |
| CoinGecko | [COINGECKO_CAPABILITIES.md](./COINGECKO_CAPABILITIES.md) | ✅ Complete |
| OpenAI | [OPENAI_CAPABILITIES.md](./OPENAI_CAPABILITIES.md) | ✅ Complete |

---

## Next Steps

1. **Review this analysis** with stakeholder
2. **Prioritize Phase 2 sprints** based on impact
3. **Create task list** for implementation
4. **Begin with OpenAI structured outputs** (lowest risk, highest impact)

---

*Generated: December 11, 2025*
*Phase 1: Provider Discovery & Capability Mapping - Complete*
