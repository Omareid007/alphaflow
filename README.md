# AlphaFlow Trading Platform

AI-powered trading platform with multi-LLM support, real-time market data, and autonomous trading capabilities.

## Overview

AlphaFlow is a full-stack trading platform that combines:
- **AI Decision Engine**: Multi-provider LLM support (OpenAI, Claude, Groq, Gemini, etc.)
- **Alpaca Integration**: Paper and live trading via Alpaca Markets API
- **Real-Time Data**: Market data from Finnhub, CoinGecko, FRED, and more
- **Autonomous Trading**: AI-driven orchestration with risk management
- **Admin Dashboard**: Complete control panel for monitoring and configuration

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 13.5, React 18, TailwindCSS, Shadcn UI |
| Backend | Express.js, TypeScript, Node.js |
| Database | PostgreSQL with Drizzle ORM |
| AI/ML | OpenAI, Claude, Groq, Gemini, HuggingFace |
| Trading | Alpaca Markets API (Paper & Live) |
| Real-Time | WebSockets, Server-Sent Events |

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Alpaca Markets account (paper trading)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp server/config/.env.example .env
# Edit .env with your API keys

# Push database schema
npm run db:push

# Start development servers
npm run dev
```

The app runs on:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Project Structure

```
/
├── app/                    # Next.js App Router pages
│   ├── admin/             # Admin dashboard pages
│   ├── home/              # Main dashboard
│   ├── strategies/        # Strategy management
│   └── ...
├── server/                 # Express.js backend
│   ├── ai/                # AI/LLM modules
│   ├── trading/           # Trading execution
│   ├── connectors/        # External API integrations
│   ├── routes/            # Modular API routes
│   └── ...
├── shared/                 # Shared code & schema
├── components/             # React components
├── lib/                    # Frontend utilities
├── docs/                   # Documentation
└── tests/                  # Test suites
```

## Key Features

### Trading
- Alpaca paper and live trading
- Smart order routing with retry logic
- Position reconciliation (automatic sync)
- Risk management (stop-loss, position limits)

### AI Integration
- Multi-provider LLM routing (role-based)
- Market condition analysis
- AI decision engine for trading signals
- Debate arena (AI-to-AI discussions)

### Data Sources
- Real-time stock quotes (Alpaca, Finnhub)
- Cryptocurrency data (CoinGecko, CoinMarketCap)
- Macro indicators (FRED)
- News sentiment (NewsAPI, GDELT)
- SEC filings (EDGAR)

### Admin Features
- Kill switch for emergency stops
- Provider health monitoring
- LLM routing configuration
- Audit logging
- System observability

## Documentation

- [Documentation Index](docs/INDEX.md) - Complete documentation guide
- [Architecture](docs/ARCHITECTURE.md) - System architecture
- [API Reference](docs/API_REFERENCE.md) - REST API endpoints
- [Testing](docs/TESTING.md) - Test strategy and commands

## Scripts

```bash
npm run dev           # Start development servers
npm run build         # Build for production
npm run start         # Start production servers
npm run test          # Run test suite
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint
npm run db:push       # Push database schema
```

## Environment Variables

Required variables (see `server/config/.env.example` for full list):

```env
DATABASE_URL=postgresql://...
ALPACA_API_KEY=...
ALPACA_SECRET_KEY=...
ALPACA_TRADING_MODE=paper
```

## Contributing

1. Create a feature branch
2. Make changes
3. Run tests: `npm test`
4. Run typecheck: `npm run typecheck`
5. Submit PR

## License

Private - All rights reserved.
