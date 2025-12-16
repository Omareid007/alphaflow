# AI Active Trader - Strategy Builder

## Overview
AI Active Trader is a mobile-first application for configuring and managing AI-powered paper trading strategies. It aims to provide explainable trading decisions within a simulated paper trading environment by integrating real-time market data, news feeds, and advanced AI models. The project focuses on leveraging AI for adaptive risk management and intelligent trading automation, with future ambitions for real trading capabilities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Target Architecture
The platform is transitioning to an event-driven microservices architecture using NATS JetStream, comprising an API Gateway, Event Bus, Market Data Service, Trading Engine Service, AI Decision Service, Analytics Service, and Orchestrator Service.

### Key Architectural Decisions
- **Monorepo Structure**: Organizes `client/`, `server/`, and `shared/` code.
- **Schema-First Development**: Database schema defined in `shared/schema.ts` with Zod validation.
- **Adapter Pattern**: Abstracts external APIs.
- **AI Decision Transparency**: All AI decisions are logged with reasoning and confidence.
- **Adaptive Risk Mode**: Dynamically adjusts risk based on market intelligence.
- **Event-Driven Communication**: NATS JetStream for inter-service messaging.
- **Database per Service**: PostgreSQL with dedicated schemas.
- **Containerization**: Node.js 22 Alpine containers orchestrated with Kubernetes.
- **Observability**: OpenTelemetry for distributed tracing.
- **Fault Isolation**: Circuit breakers for resilience.
- **Alpaca Source of Truth**: Alpaca Paper Trading is the single source of truth for live position/order data; the database serves as a cache and audit trail.
- **Centralized LLM Gateway**: All LLM calls route through `llmGateway.ts` with criticality-based routing, role-based model chains, automatic fallback, and traceId tracking.
- **Durable Work Queue**: PostgreSQL-backed for reliable order execution, featuring idempotency, retry with backoff, error classification, and a dead-letter queue.
- **Backtesting Subsystem**: Comprehensive engine with historical data, deterministic execution, per-symbol queues, pluggable fees/slippage, and performance metrics.
- **Algorithm Framework**: Core trading algorithm base class with portfolio construction and risk management, including an event-driven backtesting engine.
- **Data Processing**: Includes Order Book Depth Analyzer, Market Regime Detection, Multi-Source Sentiment Fusion, and a Technical Indicators Library.
- **Strategies**: Supports strategy versioning with A/B testing and LLM Trading Governance.
- **Feature Flags**: Implemented for gradual rollout, traffic splitting, and user targeting.
- **Orders, Trades, Fills Separation**: Dedicated tables for orders (broker order lifecycle), fills (execution confirmations), and updated handlers for reconciliation.
- **Universe & Allocation System**: Comprehensive symbol universe management from Alpaca, liquidity-based tiering, fundamentals scoring via Finnhub, candidate approval workflow, and an allocation policy with a rebalancer service.
- **Observability Module**: OpenTelemetry integration for traces, a configurable alert system with webhooks, and admin routes for health, traces, work-queue management, and alerts.
- **Admin Hub**: A WordPress-style admin panel with 13 modules for complete system management, including modules for Providers & Budgets, LLM Router, Orders, Positions, Universe, Fundamentals, Candidates, Enforcement, Allocation, Rebalancer, Orchestrator, and Observability. It features real-time order tracking and source of truth badges for clarity.

### Section 3 Deliverables (AI Intelligence Layer)
- **AI Debate Arena** (`server/ai/debateArena.ts`): Multi-role AI consensus system with 5 specialized analyst roles (bull, bear, risk_manager, technical_analyst, fundamental_analyst) plus a synthesizing judge. Each role provides stance, confidence, key signals, risks, and proposed actions. Consensus decisions are logged with full audit trail and can trigger order execution via work queue.
- **MCP-Style Tool Router** (`server/ai/toolRouter.ts`): Registry-based internal tool system for broker/data operations. Features schema validation (Zod), audit logging via tool_invocations table, category-based organization (broker, market_data, analysis), and invocation tracking. Pre-registered tools: getQuote, getBars, listPositions, getAccount, listOrders, getMarketClock.
- **Competition Mode**: Multiple AI trader profiles competing with performance tracking. Schema supports trader profiles with model configurations, risk presets, and universe filters. Competition runs track leaderboard rankings with metrics (PnL, Sharpe, Sortino, max drawdown, win rate).
- **Strategy Studio**: Web-based strategy configuration with versioning. Strategy versions support full spec storage, universe/signals/risk/execution configs, status lifecycle (draft → active → archived), and backtest result linking.

### Section 3 Database Schema
New tables in `shared/schema.ts`:
- `debate_sessions`: Tracks AI debate sessions with symbols, status, market context, duration, and cost
- `debate_messages`: Individual role contributions with stance, confidence, signals, and LLM metadata
- `debate_consensus`: Final synthesized decisions with order intent, risk checks, and dissent tracking
- `trader_profiles`: AI trader configurations for competition mode
- `competition_runs`: Paper/backtest competitions between trader profiles
- `competition_scores`: Performance metrics and rankings per competition
- `strategy_versions`: Versioned strategy configurations with activation history
- `tool_invocations`: Audit log for all tool router invocations

### Section 3 API Routes
- `POST/GET /api/debate/sessions` - Start debates, list sessions
- `GET /api/debate/sessions/:id` - Get debate details with messages and consensus
- `GET /api/tools` - List registered tools by category
- `POST /api/tools/invoke` - Invoke tool with params and tracing
- `GET /api/tools/invocations` - Query tool invocation history
- `GET/POST /api/competition/traders` - Manage trader profiles
- `GET/POST /api/competition/runs` - Manage competition runs
- `GET/POST /api/strategies/versions` - Strategy version management

### UI/UX Decisions
- **Framework**: React Native with Expo SDK 54, React Navigation v7, TanStack Query.
- **Styling**: Custom themed components supporting dark/light mode, Reanimated 4 for animations, BrandColors palette, and elevation-based cards.
- **Platform Support**: iOS, Android, and Web.
- **Information Architecture**: Canonical UI type definitions, unified activity timeline, and proper broker status mapping (Alpaca statuses).

## External Dependencies

- **Market Data Providers**: Finnhub, Polygon.io, Twelve Data, Financial Modeling Prep, Alpha Vantage.
- **Research Data Provider**: AiTrados (OHLC, News, Economic Calendar) - optional provider with endpoint-specific budget tracking.
- **News Data Providers**: NewsAPI, GDELT, AiTrados.
- **AI/LLM Integration**: OpenAI API, Groq, Together.ai, AIML API, OpenRouter (via an intelligent LLM Router).
- **Data Sources & Enrichment**: Valyu.ai (financial datasets), Hugging Face (FinBERT sentiment analysis).
- **Brokerage Integration**: Alpaca Paper Trading API.
- **Third-party UI/Utility Libraries**: `expo-web-browser`, `expo-haptics`, `expo-blur`.