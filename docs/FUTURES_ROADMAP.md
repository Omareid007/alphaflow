# Futures Trading - Enhancement Roadmap

## Status: Planned Feature (Not Implemented)

This document outlines the roadmap for adding futures trading capability to the AI Active Trader platform.

---

## Background

The platform was originally designed with futures trading interfaces that were not implemented. These stubs have been removed to reduce codebase complexity. This document serves as the specification for future implementation.

---

## Planned Brokers

### Tier 1: Interactive Brokers (IBKR)
**Recommended First Implementation**

- **API:** TWS API / IB Gateway
- **Library:** `@stoqey/ib` (Node.js)
- **Features:**
  - Most comprehensive futures support
  - Micro contracts (MES, MNQ, MGC, M2K)
  - Paper trading environment
  - Industry-standard API
  - 24/5 market access

**Connection Requirements:**
- IB Gateway or TWS installed
- API enabled (port 7497 paper, 7496 live)
- Paper trading account for testing

### Tier 2: Tradovate
**Alternative for Futures-Only Trading**

- **API:** REST + WebSocket
- **Features:**
  - Futures-specialized broker
  - Lower margin requirements
  - Modern REST API
  - Competitive commissions

### Tier 3: NinjaTrader
**Desktop Integration** (Lower Priority)

- **API:** ATI (Automated Trading Interface)
- **Limitation:** Requires Windows + NT8 desktop
- **Better for:** Discretionary traders with automation

---

## Implementation Checklist

### Phase 1: IBKR Core (Estimated: 40-60 hours)

- [ ] Install IB Gateway in development environment
- [ ] Create paper trading account
- [ ] Install `@stoqey/ib` dependency
- [ ] Implement connection management
  - [ ] Connect/disconnect
  - [ ] Heartbeat/reconnect logic
  - [ ] Error handling
- [ ] Implement account methods
  - [ ] getAccount()
  - [ ] getPositions()
  - [ ] getOpenOrders()

### Phase 2: Order Management (Estimated: 30-40 hours)

- [ ] Implement order creation
  - [ ] Market orders
  - [ ] Limit orders
  - [ ] Stop orders
  - [ ] Bracket orders (OCO)
- [ ] Implement order modification
  - [ ] Cancel order
  - [ ] Replace order
- [ ] Implement position management
  - [ ] Close position
  - [ ] Scale in/out

### Phase 3: Market Data (Estimated: 20-30 hours)

- [ ] Implement quote retrieval
  - [ ] Real-time quotes
  - [ ] Historical bars
  - [ ] Contract specifications
- [ ] Implement streaming
  - [ ] WebSocket quotes
  - [ ] Order status updates

### Phase 4: Integration (Estimated: 20-30 hours)

- [ ] Integrate with autonomous orchestrator
- [ ] Add futures-specific risk management
  - [ ] Margin requirements
  - [ ] Contract rollover
  - [ ] Position limits
- [ ] Add futures UI components
- [ ] Update backtest engine for futures

---

## Environment Variables (When Implemented)

```bash
# Interactive Brokers
IB_HOST=127.0.0.1
IB_PORT=7497  # 7497 for paper, 7496 for live
IB_CLIENT_ID=0
IB_ACCOUNT_ID=DU123456
FUTURES_BROKER=interactive_brokers
FUTURES_PAPER_TRADING=true

# Tradovate (Optional)
TRADOVATE_API_KEY=your-key
TRADOVATE_SECRET=your-secret
TRADOVATE_ENVIRONMENT=demo
```

---

## Contract Specifications

### Popular Micro Contracts (Recommended for Start)

| Symbol | Name | Exchange | Multiplier | Tick Size |
|--------|------|----------|------------|-----------|
| MES | Micro E-mini S&P 500 | CME | $5 | 0.25 ($1.25) |
| MNQ | Micro E-mini Nasdaq-100 | CME | $2 | 0.25 ($0.50) |
| MGC | Micro Gold | COMEX | $10 | 0.10 ($1.00) |
| M2K | Micro E-mini Russell 2000 | CME | $5 | 0.10 ($0.50) |
| MCL | Micro WTI Crude Oil | NYMEX | $100 | 0.01 ($1.00) |

### Full-Size Contracts (Advanced)

| Symbol | Name | Exchange | Multiplier |
|--------|------|----------|------------|
| ES | E-mini S&P 500 | CME | $50 |
| NQ | E-mini Nasdaq-100 | CME | $20 |
| GC | Gold | COMEX | $100 |
| CL | WTI Crude Oil | NYMEX | $1,000 |

---

## Risk Considerations

### Leverage Management
- Futures have significant leverage (10-20x typical)
- Implement strict position sizing
- Consider maximum 2-5% of account per trade
- Monitor margin requirements continuously

### Rollover Handling
- Track contract expiration dates
- Implement automatic rollover logic
- Handle volume migration to new contract

### Session Management
- Futures trade 23/5 (Sunday 6pm - Friday 5pm ET)
- Handle overnight sessions
- Implement daily settlement logic

---

## Estimated Total Effort

| Phase | Hours | Priority |
|-------|-------|----------|
| Phase 1: IBKR Core | 40-60 | High |
| Phase 2: Orders | 30-40 | High |
| Phase 3: Market Data | 20-30 | Medium |
| Phase 4: Integration | 20-30 | Medium |
| **Total** | **110-160** | |

---

## Dependencies

### Required
- Interactive Brokers account (paper or live)
- IB Gateway or TWS installation
- `@stoqey/ib` npm package

### Optional
- Tradovate account
- NinjaTrader 8 + license

---

## References

- [IB API Documentation](https://interactivebrokers.github.io/tws-api/)
- [@stoqey/ib npm package](https://www.npmjs.com/package/@stoqey/ib)
- [Tradovate API Docs](https://api.tradovate.com/)
- [CME Micro Products](https://www.cmegroup.com/trading/equity-index/us-index/micro-e-mini-equity-index-futures.html)

---

*Last Updated: December 29, 2024*
*Status: Planning Phase - Not Yet Implemented*
