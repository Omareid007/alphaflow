# Application Structure Analysis

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Frontend Framework | Next.js | 14.2.35 |
| UI Library | React | 18.2.0 |
| State Management | React Query | 5.90.7 |
| Styling | TailwindCSS | 3.3.3 |
| Components | Radix UI + shadcn/ui | Latest |
| Backend | Express.js | 4.21.2 |
| Database | PostgreSQL | 8.16.3 |
| ORM | Drizzle | 0.39.3 |
| AI SDK | @anthropic-ai/sdk | 0.71.2 |
| Language | TypeScript | 5.2.2 |

## Route Structure

### Frontend Routes (26 pages)

| Route | Purpose | Auth | Status |
|-------|---------|------|--------|
| `/` | Redirect to /home | No | Complete |
| `/login` | Authentication | No | Complete |
| `/home` | Dashboard | Yes | Complete |
| `/strategies` | Strategy list | Yes | Complete |
| `/strategies/[id]` | Strategy detail | Yes | Complete |
| `/strategies/[id]/edit` | Strategy editor | Yes | Complete |
| `/create` | Create strategy wizard | Yes | Complete |
| `/portfolio` | Holdings & P&L | Yes | Complete |
| `/backtests` | Backtest results | Yes | Complete |
| `/ledger` | Trade history | Yes | Complete |
| `/research` | Market research | Yes | Complete |
| `/ai` | AI pulse dashboard | Yes | Complete |
| `/settings` | User preferences | Yes | Complete |
| `/admin` | Admin dashboard | Admin | Complete |
| `/admin/providers` | LLM providers | Admin | Complete |
| `/admin/orchestrator` | Job queue | Admin | Complete |
| `/admin/ai-arena` | AI competition | Admin | Complete |
| `/admin/orders` | Order management | Admin | Complete |
| `/admin/positions` | Position tracking | Admin | Complete |
| `/admin/universe` | Universe config | Admin | Complete |

### API Routes (50+ endpoints)

#### Authentication
- `POST /api/auth/signup` - Register
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user

#### Strategies
- `GET/POST /api/strategies` - List/Create
- `GET/PUT/DELETE /api/strategies/:id` - CRUD
- `POST /api/strategies/:id/deploy` - Deploy
- `POST /api/strategies/:id/pause` - Pause
- `POST /api/strategies/:id/resume` - Resume
- `POST /api/strategies/:id/stop` - Stop

#### Trading
- `GET/POST /api/orders` - Orders
- `GET/POST /api/positions` - Positions
- `GET /api/trades` - Trade history
- `POST /api/alpaca-trading/execute` - Execute trade
- `POST /api/alpaca-trading/close/:symbol` - Close position

#### Backtesting
- `GET/POST /api/backtests` - Backtests
- `GET /api/backtests/:id` - Results
- `GET /api/backtests/:id/equity-curve` - Equity data
- `GET /api/backtests/:id/trades` - Trade events

#### Market Data
- `GET /api/market-quotes` - Live quotes
- `GET /api/stock/:symbol` - Stock data
- `GET /api/crypto/:symbol` - Crypto data
- `GET /api/news` - Market news

## Component Architecture

### Layout (3 components)
- `AppShell` - Main wrapper with auth
- `Sidebar` - Navigation menu
- `AdminSidebar` - Admin navigation

### UI Primitives (33 components)
- Button, Input, Card, Dialog, Select
- Checkbox, Switch, Slider, Tabs
- Badge, Progress, Table, Toast
- Chart, Avatar, Skeleton, Tooltip

### Trading Components (14 components)
- StrategyWizard, TemplateSelector
- BacktestProgress, BacktestResults
- PerformanceCharts, MetricsGrid
- AIInterpretation, BacktestActions

### Admin Components (6 components)
- ProviderForm, BasicInfoTab, AuthTab
- LimitsTab, ReliabilityTab, MonitoringTab

## Database Schema (35+ tables)

### Core Domains
- Authentication (users, sessions, auditLogs)
- Trading (strategies, trades, positions, orders)
- AI Decisions (aiDecisions, features, outcomes)
- Orchestration (agentStatus, workItems, arenaRuns)
- Backtesting (backtestRuns, equityCurve, tradeEvents)
- Market Data (universe, technicals, fundamentals)
- Monitoring (llmCalls, connectorMetrics, alerts)

## External Integrations

| Service | Purpose |
|---------|---------|
| Alpaca | Stock trading broker |
| OpenAI/OpenRouter | LLM providers |
| Finnhub | Market data |
| CoinGecko | Crypto data |
| FRED | Economic indicators |
