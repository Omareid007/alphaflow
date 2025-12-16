# Alpaca Trading API - Capability Mapping

## Provider Overview
| Attribute | Value |
|-----------|-------|
| **Provider** | Alpaca Markets |
| **Type** | Brokerage API |
| **Plan** | Paper Trading (Free) |
| **Rate Limits** | 200 req/min |
| **Documentation** | https://docs.alpaca.markets/ |

---

## Current Usage Summary

### Actively Used (✅)
| Feature | Implementation | File |
|---------|---------------|------|
| Account Info | `getAccount()` | `server/connectors/alpaca.ts` |
| Positions | `getPositions()`, `getPosition()`, `closePosition()` | `server/connectors/alpaca.ts` |
| Orders | `createOrder()`, `getOrders()`, `cancelOrder()` | `server/connectors/alpaca.ts` |
| Market Data Bars | `getBars()` | `server/connectors/alpaca.ts` |
| Snapshots | `getSnapshots()`, `getCryptoSnapshots()` | `server/connectors/alpaca.ts` |
| Assets | `getAssets()`, `getAsset()`, `searchAssets()` | `server/connectors/alpaca.ts` |
| Clock | `getClock()`, `getMarketStatus()` | `server/connectors/alpaca.ts` |
| Portfolio History | `getPortfolioHistory()` | `server/connectors/alpaca.ts` |
| Health Check | `healthCheck()` | `server/connectors/alpaca.ts` |

### Implemented and Active (✅)
| Feature | Implementation | Current Usage |
|---------|---------------|---------------|
| Bracket Orders | `createBracketOrder()` | **Active** - Used by AI trading engine for buy orders. REQUIRES `time_in_force: "day"` |
| Trailing Stop Orders | `createTrailingStopOrder()` | Interface exists, called for sell orders with trailing stop config |
| Stop Loss Orders | `createStopLossOrder()` | Interface exists, available for standalone stop-loss |
| Take Profit Orders | `createTakeProfitOrder()` | Interface exists, available for standalone take-profit |
| OCO Orders | In `CreateOrderParams.order_class` | Type defined, available for use |
| OTO Orders | In `CreateOrderParams.order_class` | Type defined, available for use |

### Not Yet Implemented (❌)
| Feature | Alpaca Capability | Impact |
|---------|------------------|--------|
| Options Trading | Multi-leg options for US equities/ETFs | Portfolio diversification |
| Extended Hours | `extended_hours: true` on orders | Pre/after-market trading |
| Fractional Shares | `notional` parameter | Dollar-based position sizing |
| Order Replacement | Replace orders by ID | Dynamic stop adjustment |
| Watchlists | Create/manage watchlists | Universe organization |
| Account Activities | Trade history, dividends, fees | Audit trail |
| Corporate Actions | Splits, dividends, mergers | Position adjustment |
| Calendar | Trading holidays | Schedule optimization |

---

## High-Impact Underused Capabilities

### 1. Bracket Orders (CRITICAL for Risk Management)
**Current State:** FULLY INTEGRATED with orchestrator and AI trading engine
**Benefit:** Automatic profit-taking AND stop-loss in single atomic operation

**IMPORTANT:** Alpaca requires `time_in_force: "day"` for bracket orders. Using "gtc" results in 422 rejection.

**LIMITATION:** Bracket orders are NOT compatible with extended-hours trading. When `extendedHours=true`, the system falls back to simple market orders without stop-loss/take-profit protection.

```typescript
// Implemented in server/trading/alpaca-trading-engine.ts
await alpaca.createBracketOrder({
  symbol,
  qty,
  side: 'buy',
  type: 'market',
  time_in_force: 'day',  // REQUIRED - "gtc" is rejected!
  take_profit_price: entryPrice * 1.06,  // 6% TP
  stop_loss_price: entryPrice * 0.97,     // 3% SL
});
```

**Integration Status:**
1. AI decisions with `action: buy` automatically create bracket orders
2. OCO relationship ensures only one exit triggers
3. Full logging for success/failure tracking

### 2. Trailing Stop Orders (Dynamic Risk Management)
**Current State:** Interface exists but never called
**Benefit:** Lock in profits while letting winners run

```typescript
// After profitable position moves 3%+, convert to trailing stop
await alpaca.createTrailingStopOrder({
  symbol,
  qty,
  side: 'sell',
  trail_percent: 2.0,  // Trail 2% from high
});
```

**Integration Path:**
1. Add profit monitoring to orchestrator cycle
2. When unrealized profit > 3%, create trailing stop
3. Cancel original take-profit order

### 3. OCO Orders (Existing Position Management)
**Current State:** Type defined, never used
**Benefit:** For positions without bracket, add dual exit

```typescript
// For legacy positions without bracket
await alpaca.createOrder({
  symbol,
  qty,
  side: 'sell',
  type: 'limit',
  order_class: 'oco',
  take_profit: { limit_price: targetPrice },
  stop_loss: { stop_price: stopPrice },
});
```

### 4. Portfolio History (Performance Analytics)
**Current State:** Implemented but not displayed in UI
**Benefit:** Time-series equity curve for Sharpe calculation

```typescript
const history = await alpaca.getPortfolioHistory('1M', '1D');
// Returns: equity[], profit_loss[], timestamps[]

// Use for:
// 1. Daily returns calculation
// 2. Sharpe ratio: (mean_return - risk_free) / std(returns)
// 3. Max drawdown tracking
// 4. Equity curve visualization
```

### 5. Account Activities (Realized P&L Accuracy)
**NOT IMPLEMENTED - HIGH VALUE**
```
GET /v2/account/activities
```
Returns all fills, dividends, fees for accurate P&L reconciliation.

---

## Capability Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Bracket Orders Integration | HIGH | LOW | P0 |
| Trailing Stops Integration | HIGH | MEDIUM | P0 |
| OCO for Existing Positions | MEDIUM | LOW | P1 |
| Portfolio History Analytics | HIGH | MEDIUM | P1 |
| Account Activities | MEDIUM | LOW | P2 |
| Extended Hours Trading | LOW | LOW | P3 |
| Fractional Shares | MEDIUM | LOW | P3 |
| Options (future) | HIGH | HIGH | P4 |

---

## API Endpoints Reference

### Trading API (Paper: paper-api.alpaca.markets)
| Endpoint | Method | Current Use |
|----------|--------|-------------|
| `/v2/account` | GET | ✅ Active |
| `/v2/positions` | GET/DELETE | ✅ Active |
| `/v2/orders` | GET/POST/DELETE | ✅ Active |
| `/v2/orders/:id` | GET/DELETE | ✅ Active |
| `/v2/assets` | GET | ✅ Active |
| `/v2/clock` | GET | ✅ Active |
| `/v2/calendar` | GET | ❌ Not used |
| `/v2/account/portfolio/history` | GET | ⚠️ Implemented, not displayed |
| `/v2/account/activities` | GET | ❌ Not implemented |
| `/v2/watchlists` | CRUD | ❌ Not implemented |

### Market Data API (data.alpaca.markets)
| Endpoint | Method | Current Use |
|----------|--------|-------------|
| `/v2/stocks/bars` | GET | ✅ Active |
| `/v2/stocks/snapshots` | GET | ✅ Active |
| `/v1beta3/crypto/us/snapshots` | GET | ✅ Active |
| `/v2/stocks/trades` | GET | ❌ Not used |
| `/v2/stocks/quotes` | GET | ❌ Not used |

---

## Recommendations

### Immediate Actions (Phase 2)
1. **Wire bracket orders** to trade executor - zero additional API calls
2. **Add trailing stop logic** to position monitoring
3. **Surface portfolio history** in Analytics screen

### Future Enhancements (Phase 3+)
1. Implement account activities for audit trail
2. Add extended hours trading option
3. Explore options trading for hedging

### Crypto Limitations
- Bracket/OCO orders NOT supported for crypto
- Only market, limit, stop-limit available
- Time in force: gtc, ioc only
