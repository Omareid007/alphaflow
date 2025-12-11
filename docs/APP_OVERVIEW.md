# AI Active Trader - Application Overview

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | React Native (Expo SDK 54), React Navigation v7, TanStack Query |
| **Backend** | Express.js + TypeScript, tsx (dev), esbuild (prod) |
| **Database** | PostgreSQL with Drizzle ORM, drizzle-zod validation |
| **AI** | OpenAI API (with OpenRouter fallback for free models) |
| **Broker** | Alpaca Paper Trading API |
| **Market Data** | Finnhub (stocks), CoinGecko (crypto) |
| **News** | NewsAPI |

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native (Expo)                      │
│  ├── Screens: Dashboard, Analytics, Strategies, Ticker      │
│  └── State: TanStack Query + React hooks                    │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API (port 5000)
┌────────────────────────▼────────────────────────────────────┐
│                    Express.js Server                        │
│  ├── Routes: /api/positions, /api/trades, /api/analytics   │
│  ├── Orchestrator: Autonomous trading agent                 │
│  ├── AI Engine: Decision scoring, market analysis           │
│  └── Connectors: Alpaca, Finnhub, CoinGecko, NewsAPI        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    PostgreSQL Database                      │
│  Tables: users, strategies, trades, positions,              │
│          aiDecisions, agentStatus                           │
└─────────────────────────────────────────────────────────────┘
```

## Entry Points & Main Folders

| Path | Purpose |
|------|---------|
| `client/` | React Native app (screens, components, navigation) |
| `server/` | Express backend (routes, connectors, AI, trading engine) |
| `shared/` | Shared schema & types (schema.ts) |
| `server/autonomous/orchestrator.ts` | Main trading agent logic |
| `server/connectors/alpaca.ts` | Alpaca broker integration |
| `server/ai/` | AI decision engine, market analyzer |

## External Dependencies

| Service | Purpose | Env Variable |
|---------|---------|--------------|
| Alpaca | Paper trading execution, positions, account | `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` |
| Finnhub | Stock quotes, market data | `FINNHUB_API_KEY` |
| CoinGecko | Cryptocurrency prices | (no key required) |
| NewsAPI | Financial news headlines | `NEWS_API_KEY` |
| OpenAI | AI decision analysis | Uses Replit AI integration |
| PostgreSQL | Data persistence | `DATABASE_URL` |

## How to Run

**Development (Replit):**
```bash
npm run all:dev
```
This starts:
- Expo dev server on port 8081
- Express API server on port 5000

**Key Scripts:**
- `npm run expo:dev` - Start Expo only
- `npm run server:dev` - Start Express only
- `npm run db:push` - Push schema to database

## Key Features

1. **Autonomous Trading Agent** - Self-healing orchestrator that auto-starts, manages positions, and executes trades
2. **AI-Powered Decisions** - OpenAI analyzes market conditions and generates trade recommendations with confidence scores
3. **Live Data Sync** - All positions and P&L sourced directly from Alpaca API (no stale data)
4. **Multi-Asset Support** - Stocks (via Alpaca) and crypto (via Alpaca crypto)
5. **Strategy Builder** - Configure trading strategies with customizable parameters
6. **Risk Management** - Dynamic order limits, kill switch, position sizing controls

## Data Flow

1. **Positions**: `/api/positions` → Alpaca API → synced to database
2. **Trades**: Orchestrator executes → Alpaca order → logged to `trades` table
3. **Analytics**: Combines realized P&L (trades table) + unrealized P&L (Alpaca positions)
4. **AI Decisions**: Logged to `aiDecisions` with full reasoning and context

## Notes

- Paper trading only (real trading disabled)
- Database syncs with Alpaca on orchestrator startup and periodically
- 403 errors on position sells = shares held by pending orders (Alpaca behavior, not a bug)
