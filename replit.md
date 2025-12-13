# AI Active Trader - Strategy Builder

## Overview
AI Active Trader is a mobile-first application for configuring and managing AI-powered paper trading strategies. It integrates real-time market data, news feeds, and advanced AI models to provide explainable trading decisions within a simulated paper trading environment, with ambitions for future real trading capabilities. The project's vision is to leverage AI for adaptive risk management and intelligent trading automation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Current Architecture (Monolith)
The current architecture is a monolith built with React Native (Expo) for the frontend and Express.js (TypeScript) for the backend, utilizing Drizzle ORM for PostgreSQL. Key features include custom themed UI, RESTful APIs, and a repository pattern for data access.

### Target Architecture (Microservices)
The platform is transitioning to an event-driven microservices architecture composed of seven core services communicating via NATS JetStream:
- **API Gateway**: Handles authentication, rate limiting, and routing.
- **Event Bus (NATS JetStream)**: Facilitates asynchronous communication between services.
- **Market Data Service**: Ingests, caches, and streams market data.
- **Trading Engine Service**: Manages orders, positions, and risk, integrating with brokerage APIs.
- **AI Decision Service**: Routes LLM requests, fuses data, and generates trading decisions.
- **Analytics Service**: Calculates P&L, metrics, and generates reports.
- **Orchestrator Service**: Coordinates trading cycles, sagas, and strategy scheduling.

### Key Architectural Decisions
- **Monorepo Structure**: Organizes `client/`, `server/`, and `shared/` code.
- **Schema-First Development**: Database schema defined in `shared/schema.ts` with Zod validation.
- **Adapter Pattern**: Abstracts external APIs for market data, news, and brokers.
- **AI Decision Transparency**: Logs all AI decisions with reasoning and confidence.
- **Adaptive Risk Mode**: Dynamically adjusts risk based on market intelligence.
- **Event-Driven Communication**: NATS JetStream for inter-service messaging.
- **Database per Service**: PostgreSQL with dedicated schemas for each microservice.
- **Containerization**: Node.js 22 Alpine containers orchestrated with Kubernetes.
- **Observability**: OpenTelemetry for distributed tracing and performance metrics.
- **Fault Isolation**: Circuit breakers to enhance system resilience.

### Algorithm Framework & Shared Libraries (`services/shared/`)
The platform includes a comprehensive algorithm framework inspired by LEAN, NautilusTrader, and Freqtrade:

- **Algorithm Framework** (`algorithm-framework/`): Core trading algorithm base class with portfolio management, risk management, and order execution.
  - **Portfolio Construction**: Black-Litterman model, Factor-based allocation, Risk Parity, Hierarchical Risk Parity (HRP), Constrained Optimizer.

- **Backtesting Engine** (`backtesting/`): Event-driven simulation engine with:
  - Factory pattern for isolated algorithm instances (`runWithFactory`)
  - Realistic fill, slippage, and commission models
  - Performance analytics (Sharpe, Sortino, max drawdown, win rate)
  - Prorated partial exit handling for accurate cost tracking

- **Analytics** (`analytics/`): Transaction Cost Analysis (TCA) including:
  - Implementation shortfall, market impact, timing cost, spread cost
  - Execution quality scoring (A-F grades)
  - Broker comparison and fee structure analysis

- **Data Processing** (`data/`):
  - Order Book Depth Analyzer (Level 2 data, liquidity estimation, imbalance detection)
  - Market Regime Detection (HMM, BOCD for trend/volatility regimes)
  - Multi-Source Sentiment Fusion (news, social, technical indicators)
  - Technical Indicators Library (SMA, EMA, RSI, MACD, Bollinger, ATR, etc.)

- **Strategies** (`strategies/`):
  - Strategy Versioning with A/B testing, rollback, semantic versioning, branching
  - Alpha Decay Modeling (signal half-life estimation, optimal holding periods)
  - LLM Trading Governance (pre-trade validation, position limits, cooldowns)

- **Common Utilities** (`common/`):
  - Self-Healing Orchestrator with exponential backoff and circuit breakers
  - Structured logging with context propagation

- **Events** (`events/`):
  - Event Sourcing & Journaling for audit trail and replay

- **Feature Flags** (`common/feature-flags.ts`):
  - Strangler fig pattern for traffic splitting between monolith and microservices
  - Rollout percentage control (0-100%)
  - User whitelist/blacklist for beta testing
  - Gradual rollout schedule generation
  - Metrics tracking for routing decisions

### Microservices Migration Progress (December 2025)
**Completed:**
- Phase 0: NATS JetStream integration (9 tests), OpenTelemetry wiring (16 tests)
- Phase 1: Service templates, API Gateway, per-service database schemas
- Phase 2: Dual-write repositories (11 tests), Market Data extraction, Trading Engine persistence (13 tests), Feature flag routing (23 tests)
- Phase 3: AI Decision, Analytics, and Orchestrator service extraction (all standalone with routes and health checks)
- Infrastructure: GitHub Actions CI/CD pipelines, Kubernetes deployment manifests, HashiCorp Vault integration
- API Contracts: OpenAPI 3.1 specs for trading-engine, ai-decision, and market-data services

**Infrastructure Ready:**
- All 6 microservices have standalone Express servers with REST APIs
- Health checks registered at /health/live, /health/ready, /health/startup
- Event bus integration via NATS JetStream
- Docker Compose for local development
- Kubernetes manifests with Vault Agent Injector annotations
- GitHub Actions workflows for build, test, and deploy

### UI/UX Decisions
- **Framework**: React Native with Expo SDK 54, React Navigation v7, TanStack Query.
- **Styling**: Custom themed components supporting dark/light mode, Reanimated 4 for animations, BrandColors palette, and elevation-based cards.
- **Platform Support**: iOS, Android, and Web.

## External Dependencies

- **Market Data Providers**: Finnhub, Polygon.io, Twelve Data, Financial Modeling Prep, Alpha Vantage.
- **News Data Providers**: NewsAPI, GDELT.
- **AI/LLM Integration**: OpenAI API, Groq, Together.ai, AIML API, OpenRouter (via an intelligent LLM Router).
- **Data Sources & Enrichment**: Valyu.ai (financial datasets), Hugging Face (FinBERT sentiment analysis).
- **Brokerage Integration**: Alpaca Paper Trading API.
- **Third-party UI/Utility Libraries**: `expo-web-browser`, `expo-haptics`, `expo-blur`.