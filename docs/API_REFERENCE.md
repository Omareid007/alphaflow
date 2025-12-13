# API Reference

> **Canonical document for REST API endpoints organized by domain.**
>
> Start here: [INDEX.md](INDEX.md) | Related: [ARCHITECTURE.md](ARCHITECTURE.md) (system design), [CONNECTORS_AND_INTEGRATIONS.md](CONNECTORS_AND_INTEGRATIONS.md) (external APIs)

---

## Canonical References

| Topic | Go To |
|-------|-------|
| C4 architecture diagrams | [ARCHITECTURE.md](ARCHITECTURE.md) |
| External API connectors | [CONNECTORS_AND_INTEGRATIONS.md](CONNECTORS_AND_INTEGRATIONS.md) |
| Trading agent runtime | [ORCHESTRATOR_AND_AGENT_RUNTIME.md](ORCHESTRATOR_AND_AGENT_RUNTIME.md) |
| P&L formulas & metrics | [FINANCIAL_METRICS.md](FINANCIAL_METRICS.md) |

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Agent Control](#2-agent-control)
3. [Autonomous Orchestrator](#3-autonomous-orchestrator)
4. [Strategies](#4-strategies)
5. [Trades & Positions](#5-trades--positions)
6. [Analytics](#6-analytics)
7. [AI Decisions](#7-ai-decisions)
8. [Alpaca Broker](#8-alpaca-broker)
9. [Market Data](#9-market-data)
10. [News](#10-news)

---

## 1. Authentication

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/auth/signup` | POST | Create new user account | No |
| `/api/auth/login` | POST | Login and create session | No |
| `/api/auth/logout` | POST | Destroy session | No |
| `/api/auth/me` | GET | Get current user | Yes |

---

## 2. Agent Control

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent/status` | GET | Get agent running status and stats |
| `/api/agent/toggle` | POST | Toggle agent on/off |
| `/api/agent/market-analysis` | GET | Get latest market analysis |
| `/api/agent/market-analysis/refresh` | POST | Force refresh market analysis |
| `/api/agent/dynamic-limits` | GET | Get current dynamic order limits |
| `/api/agent/set-limits` | POST | Update order limits |
| `/api/agent/health` | GET | Health check with uptime info |
| `/api/agent/auto-start` | POST | Enable/disable auto-start |

---

## 3. Autonomous Orchestrator

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/autonomous/state` | GET | Full orchestrator state |
| `/api/autonomous/start` | POST | Start autonomous trading |
| `/api/autonomous/stop` | POST | Stop autonomous trading |
| `/api/autonomous/kill-switch` | POST | Emergency stop all trading |
| `/api/autonomous/risk-limits` | PUT | Update risk parameters |
| `/api/autonomous/mode` | POST | Set mode (autonomous/semi-auto/manual) |
| `/api/autonomous/execution-history` | GET | Get execution history |
| `/api/autonomous/close-position` | POST | Close specific position |
| `/api/autonomous/execute-trades` | POST | Execute pending AI signals |
| `/api/autonomous/open-orders` | GET | Get all open orders |
| `/api/autonomous/cancel-stale-orders` | POST | Cancel old unfilled orders |
| `/api/autonomous/cancel-all-orders` | POST | Cancel all open orders |
| `/api/autonomous/reconcile-positions` | GET | Compare DB vs Alpaca positions |
| `/api/autonomous/sync-positions` | POST | Sync positions from Alpaca to DB |
| `/api/autonomous/close-all-positions` | POST | Liquidate all positions |

---

## 4. Strategies

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/strategies` | GET | List all strategies |
| `/api/strategies/:id` | GET | Get specific strategy |
| `/api/strategies` | POST | Create new strategy |
| `/api/strategies/:id` | PATCH | Update strategy |
| `/api/strategies/:id/toggle` | POST | Activate/deactivate strategy |
| `/api/strategies/:id/start` | POST | Start strategy execution |
| `/api/strategies/:id/stop` | POST | Stop strategy execution |
| `/api/strategies/:id/status` | GET | Get strategy status |
| `/api/strategies/all-schemas` | GET | Get all strategy JSON schemas |
| `/api/strategies/moving-average/schema` | GET | Moving average strategy schema |
| `/api/strategies/moving-average/backtest` | POST | Backtest moving average |
| `/api/strategies/moving-average/ai-validate` | POST | AI validation of MA strategy |
| `/api/strategies/mean-reversion/schema` | GET | Mean reversion schema |
| `/api/strategies/mean-reversion/backtest` | POST | Backtest mean reversion |
| `/api/strategies/momentum/schema` | GET | Momentum strategy schema |
| `/api/strategies/momentum/backtest` | POST | Backtest momentum |

---

## 5. Trades & Positions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/trades` | GET | List trades (with limit) |
| `/api/trades/enriched` | GET | Trades with AI decisions attached |
| `/api/trades/symbols` | GET | Distinct traded symbols |
| `/api/trades/:id` | GET | Get specific trade |
| `/api/trades/:id/enriched` | GET | Trade with AI decision |
| `/api/trades` | POST | Create trade record |
| `/api/positions` | GET | **Primary** - Live Alpaca positions |
| `/api/positions/broker` | GET | Direct broker positions |
| `/api/positions/:id` | GET | Get DB position by ID |
| `/api/positions` | POST | Create position record |
| `/api/positions/:id` | PATCH | Update position |

---

## 6. Analytics

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analytics/summary` | GET | P&L summary (realized + unrealized) |
| `/api/analytics/performance` | GET | Performance metrics |
| `/api/analytics/equity-curve` | GET | Equity over time |

---

## 7. AI Decisions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai-decisions` | GET | List AI decisions |
| `/api/ai-decisions` | POST | Create AI decision |
| `/api/ai/suggest-trades` | POST | Generate AI trade suggestions |

---

## 8. Alpaca Broker

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/alpaca/account` | GET | Account info (balance, equity) |
| `/api/alpaca/positions` | GET | Raw Alpaca positions |
| `/api/alpaca/orders` | GET | All orders |
| `/api/alpaca/orders` | POST | Place new order |
| `/api/alpaca/orders/:orderId` | DELETE | Cancel order |
| `/api/alpaca/assets` | GET | Tradeable assets |
| `/api/alpaca/assets/search` | GET | Search assets |
| `/api/alpaca/bars` | GET | OHLC bar data |
| `/api/alpaca/snapshots` | GET | Latest quotes/trades |
| `/api/alpaca/health` | GET | Alpaca connection health |
| `/api/alpaca/clock` | GET | Market clock |
| `/api/alpaca/market-status` | GET | Market open/closed status |
| `/api/alpaca/portfolio-history` | GET | Historical portfolio values |
| `/api/alpaca/top-stocks` | GET | Top movers (stocks) |
| `/api/alpaca/top-crypto` | GET | Top movers (crypto) |
| `/api/alpaca/top-etfs` | GET | Top ETFs |

---

## 9. Market Data

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/finnhub/quote/:symbol` | GET | Stock quote |
| `/api/finnhub/quotes` | GET | Multiple quotes |
| `/api/coingecko/prices` | GET | Crypto prices |
| `/api/coingecko/markets` | GET | Crypto market data |
| `/api/coingecko/trending` | GET | Trending coins |
| `/api/cmc/listings` | GET | CoinMarketCap listings |
| `/api/cmc/quotes` | GET | CoinMarketCap quotes |
| `/api/cmc/global` | GET | Global crypto metrics |

---

## 10. News

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/news/headlines` | GET | Top financial headlines |
| `/api/news/search` | GET | Search news articles |
| `/api/news/market` | GET | Market-specific news |
| `/api/news/crypto` | GET | Crypto news |
| `/api/news/stock/:symbol` | GET | News for specific stock |

---

## Service Documentation

For detailed API specifications by service, see:

| Service | Documentation |
|---------|---------------|
| API Gateway | [services/API_GATEWAY.md](services/API_GATEWAY.md) |
| Trading Engine | [services/TRADING_ENGINE.md](services/TRADING_ENGINE.md) |
| AI Decision | [services/AI_DECISION.md](services/AI_DECISION.md) |
| Analytics | [services/ANALYTICS.md](services/ANALYTICS.md) |
| Orchestrator | [services/ORCHESTRATOR.md](services/ORCHESTRATOR.md) |
| Market Data | [services/MARKET_DATA.md](services/MARKET_DATA.md) |

---

*Last Updated: December 2025*
