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

## Stability Legend

| Stability | Description |
|-----------|-------------|
| **Stable** | Production-ready, breaking changes only in major versions |
| **Experimental** | Subject to change, use with caution in production |
| **Internal** | For system use only, may change without notice |

---

## 1. Authentication

| Endpoint | Method | Purpose | Auth Required | Stability |
|----------|--------|---------|---------------|-----------|
| `/api/auth/signup` | POST | Create new user account | No | Stable |
| `/api/auth/login` | POST | Login and create session | No | Stable |
| `/api/auth/logout` | POST | Destroy session | No | Stable |
| `/api/auth/me` | GET | Get current user | Yes | Stable |

---

## 2. Agent Control

| Endpoint | Method | Purpose | Stability |
|----------|--------|---------|-----------|
| `/api/agent/status` | GET | Get agent running status and stats | Stable |
| `/api/agent/toggle` | POST | Toggle agent on/off | Stable |
| `/api/agent/market-analysis` | GET | Get latest market analysis | Stable |
| `/api/agent/market-analysis/refresh` | POST | Force refresh market analysis | Stable |
| `/api/agent/dynamic-limits` | GET | Get current dynamic order limits | Experimental |
| `/api/agent/set-limits` | POST | Update order limits | Experimental |
| `/api/agent/health` | GET | Health check with uptime info | Stable |
| `/api/agent/auto-start` | POST | Enable/disable auto-start | Stable |

---

## 3. Autonomous Orchestrator

| Endpoint | Method | Purpose | Stability |
|----------|--------|---------|-----------|
| `/api/autonomous/state` | GET | Full orchestrator state | Stable |
| `/api/autonomous/start` | POST | Start autonomous trading | Stable |
| `/api/autonomous/stop` | POST | Stop autonomous trading | Stable |
| `/api/autonomous/kill-switch` | POST | Emergency stop all trading | Stable |
| `/api/autonomous/risk-limits` | PUT | Update risk parameters | Stable |
| `/api/autonomous/mode` | POST | Set mode (autonomous/semi-auto/manual) | Stable |
| `/api/autonomous/execution-history` | GET | Get execution history | Stable |
| `/api/autonomous/close-position` | POST | Close specific position | Stable |
| `/api/autonomous/execute-trades` | POST | Execute pending AI signals | Experimental |
| `/api/autonomous/open-orders` | GET | Get all open orders | Stable |
| `/api/autonomous/cancel-stale-orders` | POST | Cancel old unfilled orders | Stable |
| `/api/autonomous/cancel-all-orders` | POST | Cancel all open orders | Stable |
| `/api/autonomous/reconcile-positions` | GET | Compare DB vs Alpaca positions | Internal |
| `/api/autonomous/sync-positions` | POST | Sync positions from Alpaca to DB | Internal |
| `/api/autonomous/close-all-positions` | POST | Liquidate all positions | Stable |

---

## 4. Strategies

| Endpoint | Method | Purpose | Stability |
|----------|--------|---------|-----------|
| `/api/strategies` | GET | List all strategies | Stable |
| `/api/strategies/:id` | GET | Get specific strategy | Stable |
| `/api/strategies` | POST | Create new strategy | Stable |
| `/api/strategies/:id` | PATCH | Update strategy | Stable |
| `/api/strategies/:id/toggle` | POST | Activate/deactivate strategy | Stable |
| `/api/strategies/:id/start` | POST | Start strategy execution | Experimental |
| `/api/strategies/:id/stop` | POST | Stop strategy execution | Experimental |
| `/api/strategies/:id/status` | GET | Get strategy status | Stable |
| `/api/strategies/all-schemas` | GET | Get all strategy JSON schemas | Stable |
| `/api/strategies/moving-average/schema` | GET | Moving average strategy schema | Stable |
| `/api/strategies/moving-average/backtest` | POST | Backtest moving average | Experimental |
| `/api/strategies/moving-average/ai-validate` | POST | AI validation of MA strategy | Experimental |
| `/api/strategies/mean-reversion/schema` | GET | Mean reversion schema | Stable |
| `/api/strategies/mean-reversion/backtest` | POST | Backtest mean reversion | Experimental |
| `/api/strategies/momentum/schema` | GET | Momentum strategy schema | Stable |
| `/api/strategies/momentum/backtest` | POST | Backtest momentum | Experimental |

---

## 5. Trades & Positions

| Endpoint | Method | Purpose | Stability |
|----------|--------|---------|-----------|
| `/api/trades` | GET | List trades (with limit) | Stable |
| `/api/trades/enriched` | GET | Trades with AI decisions attached | Stable |
| `/api/trades/symbols` | GET | Distinct traded symbols | Stable |
| `/api/trades/:id` | GET | Get specific trade | Stable |
| `/api/trades/:id/enriched` | GET | Trade with AI decision | Stable |
| `/api/trades` | POST | Create trade record | Stable |
| `/api/positions` | GET | **Primary** - Live Alpaca positions | Stable |
| `/api/positions/broker` | GET | Direct broker positions | Stable |
| `/api/positions/:id` | GET | Get DB position by ID | Stable |
| `/api/positions` | POST | Create position record | Internal |
| `/api/positions/:id` | PATCH | Update position | Internal |

---

## 6. Analytics

| Endpoint | Method | Purpose | Stability |
|----------|--------|---------|-----------|
| `/api/analytics/summary` | GET | P&L summary (realized + unrealized) | Stable |
| `/api/analytics/performance` | GET | Performance metrics | Stable |
| `/api/analytics/equity-curve` | GET | Equity over time | Stable |

---

## 7. AI Decisions

| Endpoint | Method | Purpose | Stability |
|----------|--------|---------|-----------|
| `/api/ai-decisions` | GET | List AI decisions | Stable |
| `/api/ai-decisions` | POST | Create AI decision | Internal |
| `/api/ai/suggest-trades` | POST | Generate AI trade suggestions | Stable |

---

## 8. Alpaca Broker

| Endpoint | Method | Purpose | Stability |
|----------|--------|---------|-----------|
| `/api/alpaca/account` | GET | Account info (balance, equity) | Stable |
| `/api/alpaca/positions` | GET | Raw Alpaca positions | Stable |
| `/api/alpaca/orders` | GET | All orders | Stable |
| `/api/alpaca/orders` | POST | Place new order | Stable |
| `/api/alpaca/orders/:orderId` | DELETE | Cancel order | Stable |
| `/api/alpaca/assets` | GET | Tradeable assets | Stable |
| `/api/alpaca/assets/search` | GET | Search assets | Stable |
| `/api/alpaca/bars` | GET | OHLC bar data | Stable |
| `/api/alpaca/snapshots` | GET | Latest quotes/trades | Stable |
| `/api/alpaca/health` | GET | Alpaca connection health | Stable |
| `/api/alpaca/clock` | GET | Market clock | Stable |
| `/api/alpaca/market-status` | GET | Market open/closed status | Stable |
| `/api/alpaca/portfolio-history` | GET | Historical portfolio values | Stable |
| `/api/alpaca/top-stocks` | GET | Top movers (stocks) | Stable |
| `/api/alpaca/top-crypto` | GET | Top movers (crypto) | Stable |
| `/api/alpaca/top-etfs` | GET | Top ETFs | Stable |

---

## 9. Market Data

| Endpoint | Method | Purpose | Stability |
|----------|--------|---------|-----------|
| `/api/finnhub/quote/:symbol` | GET | Stock quote | Stable |
| `/api/finnhub/quotes` | GET | Multiple quotes | Stable |
| `/api/coingecko/prices` | GET | Crypto prices | Stable |
| `/api/coingecko/markets` | GET | Crypto market data | Stable |
| `/api/coingecko/trending` | GET | Trending coins | Stable |
| `/api/cmc/listings` | GET | CoinMarketCap listings | Stable |
| `/api/cmc/quotes` | GET | CoinMarketCap quotes | Stable |
| `/api/cmc/global` | GET | Global crypto metrics | Stable |

---

## 10. News

| Endpoint | Method | Purpose | Stability |
|----------|--------|---------|-----------|
| `/api/news/headlines` | GET | Top financial headlines | Stable |
| `/api/news/search` | GET | Search news articles | Stable |
| `/api/news/market` | GET | Market-specific news | Stable |
| `/api/news/crypto` | GET | Crypto news | Stable |
| `/api/news/stock/:symbol` | GET | News for specific stock | Stable |

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
