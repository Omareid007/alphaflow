# AlphaFlow Project Context

## Overview

AlphaFlow is an AI-powered algorithmic trading platform for autonomous and semi-autonomous trading operations.

## Tech Stack

| Layer         | Technology                               |
| ------------- | ---------------------------------------- |
| Frontend      | Next.js 13.5, React 18, TailwindCSS      |
| UI Components | Shadcn UI (do not modify components/ui/) |
| Backend       | Express.js, TypeScript, Port 5000        |
| Database      | PostgreSQL with Drizzle ORM              |
| Trading       | Alpaca Markets API (paper and live)      |
| AI            | Multi-LLM (OpenAI, Claude, Groq, Gemini) |
| Real-time     | WebSockets, SSE                          |

## Key Directories

- app/ - Next.js pages (App Router)
- components/ - React components
- components/ui/ - Shadcn components (DO NOT MODIFY)
- server/ - Express backend
- server/routes/ - API endpoints
- server/services/ - Business logic
- server/integrations/ - External API clients (Alpaca, LLMs)
- lib/ - Frontend utilities
- hooks/ - React hooks
- shared/ - Shared types and schemas
- mcp-servers/ - Custom MCP server for trading

## Conventions

- Components: PascalCase (TradingDashboard.tsx)
- Hooks: camelCase with use prefix (useMarketData.ts)
- Utilities: camelCase (formatCurrency.ts)
- Constants: SCREAMING_SNAKE_CASE
- Git: Conventional commits (feat, fix, docs, chore)

## Quality Gates

All changes must pass:

- npm run build
- npm run typecheck
- npm run lint (warnings OK)

## Current State

- Post-rescue stabilization phase
- Priority: Stability over new features
- All new features REQUIRE OpenSpec proposal

## Domain Knowledge

- Paper trading: Test trades with fake money
- Live trading: Real money trades
- Kill switch: Emergency stop for all trading
- Portfolio: Collection of held positions
- Position: A single stock/asset holding
