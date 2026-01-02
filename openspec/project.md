# Project Context

## Purpose

AI-powered autonomous trading platform with real-time portfolio management, backtesting, and multi-broker integrations. Enables users to create, test, and deploy algorithmic trading strategies with AI-assisted decision-making and risk management.

## Tech Stack

### Frontend

- Next.js 15 (App Router)
- React 19
- TypeScript 5.6
- TailwindCSS 3.4
- Shadcn/UI components
- TanStack Query (React Query) v5
- Recharts for visualization
- Zustand for state management

### Backend

- Node.js 20+
- Express.js 4.21
- TypeScript 5.6
- Drizzle ORM
- PostgreSQL (via DATABASE_URL)
- Zod for validation
- Pino for structured logging

### AI/LLM

- LLM Gateway with multi-provider fallback
  - Anthropic Claude (primary)
  - OpenRouter
  - OpenAI
  - HuggingFace
  - Google Gemini
  - Groq
  - Cohere
  - Mistral
  - Perplexity
- Role-based LLM routing
- Technical analysis fallback for LLM failures

### Broker Integrations

- **Alpaca Markets** (primary - live)
  - Equities trading
  - Crypto trading
  - Real-time market data
  - Paper trading support
- **IBKR (Interactive Brokers)** - planned for futures (see `docs/FUTURES_ROADMAP.md`)

### Infrastructure

- 26 MCP (Model Context Protocol) servers
- Testing: Vitest + Testing Library
- Build: esbuild, tsup
- Git hooks: Husky + lint-staged
- Package manager: npm

## Project Conventions

### Code Style

- **TypeScript Strict Mode**: Enabled, minimize `:any` usage
- **Formatting**: Prettier (automatic via pre-commit hooks)
- **Linting**: ESLint with custom rules
  - `no-console` enforced for `server/**/*.ts` (use Pino logger)
  - Strict type checking
- **Naming Conventions**:
  - Components: PascalCase (e.g., `StrategyWizard.tsx`)
  - Files: kebab-case for utilities, PascalCase for components
  - Routes: kebab-case (e.g., `/api/alpaca-trading`)
  - Database: snake_case for columns

### Architecture Patterns

#### API Layer

- **REST API** with Express.js
- **Route Organization**: Grouped by domain in `server/routes/`
  - Auth: `/api/auth`
  - Trading: `/api/orders`, `/api/positions`, `/api/trades`
  - Strategy: `/api/strategies`, `/api/backtest`
  - Market Data: `/api/market-data`, `/api/news`
  - Admin: `/api/admin/*`
- **Validation**: Zod schemas in `server/validation/` and `shared/schema/`
- **Middleware**: `server/middleware/` for auth, validation, error handling
- **Error Handling**: Standardized errors via `server/lib/standard-errors.ts`

#### Real-time Data

- **Server-Sent Events (SSE)** for live updates
  - `/api/stream/trading` - order updates, fills, positions
  - `/api/stream/portfolio` - portfolio changes
  - `/api/stream/watchlist` - price updates
  - `/api/stream/strategy/:id` - strategy execution events
- **Alpaca WebSocket** for market data

#### Database

- **Drizzle ORM** with PostgreSQL
- **Schema Organization**: Modular schemas in `shared/schema/`
  - `auth.ts` - users, sessions, password reset
  - `orders.ts` - order tracking
  - `strategy-versioning.ts` - strategy management
  - `backtest.ts` - backtest results
  - `monitoring.ts` - system health
- **Migrations**: `migrations/` directory with SQL files

#### Frontend Architecture

- **App Router** (Next.js 15)
- **Server Components** where possible
- **Client Components** for interactivity
- **React Query** for server state
- **Zustand** for UI state
- **Error Boundaries**: Component-level and root-level

#### AI/Autonomous System

- **LLM Gateway** (`server/ai/llmGateway.ts`)
  - Multi-provider fallback chain
  - Role-based routing (analyst, risk-manager, sentiment-analyzer)
  - Automatic retry with exponential backoff
- **Decision Engine** (`server/ai/decision-engine.ts`)
  - AI-powered trade signals
  - Risk assessment
  - Market sentiment analysis
- **Orchestrator** (`server/autonomous/orchestrator.ts`)
  - Strategy execution coordination
  - Order queue management
  - Portfolio rebalancing

#### Risk Management

- **Pre-trade Validation**
  - Position size limits (5% max per position)
  - Sector exposure limits (25% max per sector)
  - Buying power checks
  - Market hours verification
- **Circuit Breaker**
  - Auto-suspends trading on rapid losses
  - 60-second cooldown with auto-reset
- **Dynamic Risk Manager**
  - Real-time portfolio risk metrics
  - VaR (Value at Risk) calculation
  - Drawdown tracking

### Testing Strategy

#### Unit Tests

- **Framework**: Vitest
- **Location**: `tests/unit/`
- **Coverage Target**: 60% (currently ~20%)
- **Patterns**:
  - Pure functions: Direct testing
  - Components: React Testing Library
  - Services: Mock dependencies

#### Integration Tests

- **Location**: `tests/integration/`
- **Scope**: Multi-component workflows
- **Patterns**:
  - API endpoint tests
  - Database integration tests
  - External service mocks

#### E2E Tests

- **Location**: `tests/e2e/`
- **Framework**: Playwright MCP
- **Scope**: Critical user workflows

#### Test Organization

```
tests/
├── unit/           # Component, utility tests
├── integration/    # API, database tests
├── e2e/            # End-to-end workflows
├── setup.ts        # Vitest setup
├── setup-react.ts  # React testing setup
└── utils/          # Test helpers
```

### Git Workflow

#### Branching Strategy

- **main**: Production-ready code
- **feature/\***: New features
- **fix/\***: Bug fixes
- **cleanup/\***: Code cleanup/refactoring

#### Commit Conventions

- **Format**: Conventional Commits
  - `feat:` - New feature
  - `fix:` - Bug fix
  - `refactor:` - Code refactoring
  - `docs:` - Documentation
  - `test:` - Tests
  - `chore:` - Build/tooling
- **Example**: `feat: Add real-time SSE updates to Portfolio page`
- **Footer**: Always include Claude Code attribution:

  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>
  ```

#### Pre-commit Hooks

- ESLint auto-fix
- Prettier formatting
- CLAUDE.md size check (<35KB)

## Domain Context

### Trading Concepts

- **Strategy**: Algorithmic trading rules (entry/exit conditions, indicators, risk parameters)
- **Backtest**: Historical simulation of strategy performance
- **Position**: Active holding of an asset
- **Order Types**: Market, Limit, Stop, Stop-Limit, Trailing-Stop, Bracket, OCO
- **Time in Force**: Day, GTC (Good-til-Canceled), IOC, FOK
- **Order Status**: New, Accepted, Filled, PartiallyFilled, Canceled, Rejected, Expired

### Technical Indicators (Backtesting)

- Shared modules in `scripts/shared/technical-indicators.ts`:
  - SMA, EMA, MACD, RSI, Bollinger Bands
  - Stochastic, ATR, ADX, OBV, ROC
  - VWAP, CCI, Williams %R, MFI
- Genetic algorithm optimizers in `scripts/shared/genetic-algorithm.ts`

### AI Decision-Making

- **Signal Generation**: Buy/Sell/Hold recommendations
- **Risk Scoring**: 0-10 scale for trade risk
- **Sentiment Analysis**: Market sentiment from news/social
- **Guard Validation**: Rule-based safety checks before execution

### Rebalancing

- **Target Allocation**: Portfolio weight targets
- **Threshold-Based**: Rebalance when drift exceeds threshold
- **Scheduled**: Time-based rebalancing
- **Tax-Aware**: Minimize realized gains

## Important Constraints

### Regulatory

- **Pattern Day Trader (PDT) Rule**: Minimum $25k equity for >3 day trades per week
- **FINRA Compliance**: Order routing, best execution
- **SEC Regulations**: No market manipulation, insider trading

### Technical

- **Alpaca Rate Limits**:
  - 200 requests/minute (REST API)
  - WebSocket: Real-time data limits
- **PostgreSQL**: DATABASE_URL required
- **Environment Variables**: See `.env` file (takes precedence over Replit Secrets)
- **TypeScript**: Node.js >= 20.19.0 required
- **CLAUDE.md Size**: Must stay under 35KB (enforced by pre-commit hook)

### Business

- **Paper Trading First**: Test strategies before live deployment
- **Risk Limits**: Hard-coded in `server/trading/` (configurable per user planned)
- **AI Costs**: LLM API usage monitored but not billed to users

### Security

- **Authentication**: Session-based with HTTP-only cookies
- **Password Reset**: Email-based with expiring tokens
- **Sanitization**: All user input sanitized (`server/lib/sanitization.ts`)
- **Logging**: Credentials redacted in logs (30+ sensitive field patterns)
- **CORS**: Configured for frontend origin only

## External Dependencies

### Required Services

- **Alpaca Markets API**
  - `ALPACA_API_KEY` and `ALPACA_API_SECRET` (required)
  - `ALPACA_PAPER_API_KEY` for paper trading
  - Endpoints: REST API + WebSocket
  - Documentation: https://docs.alpaca.markets

- **PostgreSQL Database**
  - `DATABASE_URL` (required)
  - Minimum version: PostgreSQL 12+

- **SendGrid** (optional, for email notifications)
  - `SENDGRID_API_KEY`
  - From email: `SENDGRID_FROM_EMAIL`

### LLM Providers (Optional, fallback chain)

1. Anthropic Claude: `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
2. OpenRouter: `AI_INTEGRATIONS_OPENROUTER_API_KEY`
3. OpenAI: `AI_INTEGRATIONS_OPENAI_API_KEY`
4. HuggingFace: `AI_INTEGRATIONS_HUGGINGFACE_API_KEY`
5. Google Gemini: `GOOGLE_GEMINI_API_KEY`
6. Groq: `AI_INTEGRATIONS_GROQ_API_KEY`
7. Cohere: `AI_INTEGRATIONS_COHERE_API_KEY`
8. Mistral: `AI_INTEGRATIONS_MISTRAL_API_KEY`
9. Perplexity: `AI_INTEGRATIONS_PERPLEXITY_API_KEY`

### Market Data Providers (via MCP)

- Alpha Vantage MCP
- Polygon.io MCP
- Financial Datasets MCP

### Monitoring (via MCP)

- Codacy (code quality)
- Sentry (error tracking) - planned

## API Documentation

Existing OpenAPI 3.0 specification available at: `docs/api/OPENAPI_SPEC.yaml`

### Core API Endpoints

#### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/update-email` - Update user email

#### Trading

- `POST /api/orders` - Submit order
- `GET /api/orders` - List orders
- `DELETE /api/orders/:id` - Cancel order
- `GET /api/positions` - List positions
- `GET /api/trades` - Trade history
- `POST /api/alpaca-trading/analyze` - AI trade analysis

#### Strategies

- `GET /api/strategies` - List strategies
- `POST /api/strategies` - Create strategy
- `PUT /api/strategies/:id` - Update strategy
- `DELETE /api/strategies/:id` - Delete strategy
- `POST /api/backtest` - Run backtest
- `GET /api/backtest/:id` - Get backtest results

#### Portfolio

- `GET /api/portfolio` - Current portfolio status
- `GET /api/portfolio-snapshot` - Historical snapshot
- `GET /api/positions` - Current positions

#### Market Data

- `GET /api/market-data/quote/:symbol` - Real-time quote
- `GET /api/news` - Market news
- `GET /api/watchlist` - User watchlist

#### Admin

- `GET /api/admin/alpaca-account` - Alpaca account status
- `GET /api/admin/health` - System health check
- `POST /api/admin/clear-cache` - Clear caches
- `POST /api/admin/reset-circuit-breaker` - Reset trading circuit breaker

## Documentation Structure

```
docs/
├── api/
│   └── OPENAPI_SPEC.yaml      # OpenAPI 3.0 specification
├── product/
│   ├── FEATURE_MATRIX.md      # Feature inventory
│   ├── USER_JOURNEYS.md       # User flow documentation
│   └── PRODUCT_ROADMAP_2025.md
├── FUTURES_ROADMAP.md         # IBKR futures integration plan
├── MCP-API-KEYS.md           # MCP configuration guide
└── CHANGELOG.md               # Full development history (Phases 1-22)

analysis/
├── flows/                     # User flow diagrams
├── gaps/                      # Gap analysis (type safety, testing, a11y)
└── components/                # Component inventory

specs/
└── features/                  # Feature specifications
```

## MCP Server Integrations

26 MCP servers configured in `.mcp.json`:

### Development

- TypeScript tools, Prettier, ESLint
- Git operations, GitHub
- Memory (knowledge graph)
- Sequential thinking

### Finance/Trading

- Alpaca Trading (custom)
- Alpha Vantage, Polygon.io
- Financial Datasets
- yFinance

### AI/Research

- Context7 (library documentation)
- Brave Search, Exa Search
- Playwright (browser automation)

### Communication

- Slack, SendGrid

### Code Quality

- Codacy

See `docs/MCP-API-KEYS.md` for configuration details.
