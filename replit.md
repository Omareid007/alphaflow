# AI Active Trader - Strategy Builder

## Overview
AI Active Trader is a mobile-first application designed for configuring and managing AI-powered paper trading strategies. It integrates real-time market data, news feeds, and advanced AI models to provide explainable trading decisions. The platform supports various trading strategies, real-time data connectivity, and trade execution/monitoring within a simulated paper trading environment, aiming for future real trading capabilities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Current Architecture (Monolith)
The current implementation is a monolithic architecture that will be transformed into microservices.

#### Frontend
- **Framework**: React Native with Expo SDK 54, React Navigation v7, TanStack Query.
- **UI/UX**: Custom themed components supporting dark/light mode, Reanimated 4 for animations, BrandColors palette, typography, spacing, and elevation-based cards.
- **Platform Support**: iOS, Android, and Web.

#### Backend
- **Server Framework**: Express.js with TypeScript, esbuild, and tsx.
- **API Design**: RESTful APIs with JSON responses and centralized error handling.
- **Data Access**: Repository pattern via an `IStorage` interface, Drizzle ORM for PostgreSQL.

#### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect, `drizzle-kit` for migrations, Zod for validation.
- **Core Tables**: `users`, `strategies`, `trades`, `positions`, `aiDecisions`, `agentStatus`.
- **AI Learning Tables**: `ai_decision_features`, `ai_trade_outcomes`, `ai_calibration_log`.

### Target Architecture (Microservices)

The platform is being transformed into an event-driven microservices architecture with 7 core services:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
│                    (Auth, Rate Limiting, Routing)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴──────────────────────────────────────────┐
│                           EVENT BUS (NATS JetStream)                         │
│  market.* │ trade.* │ ai.* │ analytics.* │ orchestrator.* │ system.*        │
└─────────────────────────────────────────────────────────────────────────────┘
         │              │              │              │              │
         ▼              ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   Market    │ │  Trading    │ │     AI      │ │  Analytics  │ │ Orchestrator│
│   Data      │ │   Engine    │ │  Decision   │ │   Service   │ │   Service   │
│   Service   │ │   Service   │ │   Service   │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

#### Service Responsibilities

| Service | Domain | Key Functions |
|---------|--------|---------------|
| **Trading Engine** | Order Execution | Orders, positions, risk enforcement, Alpaca integration |
| **AI Decision** | Intelligence | LLM routing, data fusion, prompt engineering, calibration |
| **Market Data** | Data Ingestion | Alpaca/Finnhub/CoinGecko connectors, caching, streaming |
| **Analytics** | Reporting | P&L calculations, metrics, equity curves, risk analysis |
| **Orchestrator** | Coordination | Trading cycles, saga coordination, strategy scheduling |
| **API Gateway** | Interface | Auth, rate limiting, request routing, aggregation |
| **Event Bus** | Infrastructure | NATS JetStream for async messaging |

### Key Architectural Decisions

#### Current Implementation
- **Monorepo Structure**: `client/`, `server/`, `shared/` for code organization
- **Schema-First Development**: Database schema in `shared/schema.ts` with Zod validation
- **Adapter Pattern**: Abstract interfaces for market data, news, and broker APIs
- **AI Decision Transparency**: All decisions logged with reasoning and confidence scores
- **Adaptive Risk Mode**: Auto-adjusts risk profiles based on market intelligence
- **Pre-Trade Guard**: Validates buying power, market session, symbol tradability
- **AI Learning Feedback Loop**: Records features and outcomes for calibration

#### Microservices Transformation (Phase 1 Complete)
- **Event-Driven Communication**: NATS JetStream for async messaging between services
- **Database per Service**: PostgreSQL with per-service schemas
- **Container Standards**: Node.js 22 Alpine, Kubernetes orchestration
- **Schema Registry**: Event versioning and backward compatibility
- **OpenTelemetry**: Distributed tracing across services
- **Circuit Breakers**: Fault isolation and graceful degradation

### Phase 0 Deliverables (Complete - Dec 2025)
- **NATS JetStream Client**: Real NATS JetStream client with in-memory fallback for development (`services/shared/events/client.ts`)
- **Event Schema Registry**: 22 Zod-validated event schemas for market, trade, AI, analytics, orchestrator, and system events (`services/shared/events/schemas.ts`)
- **Event Types**: Comprehensive TypeScript event type definitions with saga correlation support (`services/shared/events/types.ts`)
- **Smoke Tests**: Verified event bus publish/subscribe, schema validation, and saga correlation (all 8 tests passing)

### Phase 1 Deliverables (Complete - Dec 2025)
- **Shared Common Package**: Logger, config, health, telemetry, and secrets management utilities (`services/shared/common/`)
- **Service Template CLI**: Generator script for scaffolding new microservices (`scripts/create-service.ts`)
- **API Gateway**: Express-based gateway with auth, rate limiting, request routing, CORS, and health endpoints (`services/api-gateway/index.ts`)
- **Docker Infrastructure**: 6 service-specific Dockerfiles + base template in `docker/`
- **CI/CD Pipelines**: GitHub Actions workflows for lint, test, build, deploy in `.github/workflows/`
- **NATS JetStream**: Event bus configuration with 6 streams (MARKET, TRADE, AI, ANALYTICS, ORCHESTRATOR, SYSTEM) in `infrastructure/nats/`
- **Service Placeholders**: All 5 core services migrated to Express + shared packages with EventBus integration (`services/*/index.ts`)
- **Shared Event Types**: TypeScript event definitions in `services/shared/events/`
- **Database Schemas**: Per-service PostgreSQL schemas via `docker/init-db/`

### Services Directory Structure (Updated Dec 2025)
All microservices now use the shared packages consistently:
- `services/trading-engine/` - Express + EventBus + Logger + Health (port 3001)
- `services/ai-decision/` - Express + EventBus + Logger + Health (port 3002)
- `services/market-data/` - Express + EventBus + Logger + Health (port 3003)
- `services/analytics/` - Express + EventBus + Logger + Health (port 3004)
- `services/orchestrator/` - Express + EventBus + Logger + Health (port 3005)
- `services/event-bridge/` - n8n webhook bridge with Telegram/Slack support (port 3006)
- `services/api-gateway/` - Auth, rate limiting, routing (port 5000)
- `services/shared/` - Common utilities (events, common packages)

### Phase 3 Deliverables (Complete - Dec 2025)
- **Performance Optimization**: Connection pooling (max 20, min 5), performance metrics tracking, order execution cache with sub-50ms validation (`server/lib/performance-metrics.ts`, `server/lib/order-execution-cache.ts`)
- **n8n Webhook Integration**: Webhook emitter with CRUD endpoints, HMAC signatures, delivery tracking, automatic trade event emissions (`server/lib/webhook-emitter.ts`)
- **Notification System**: Telegram, Slack, Discord support with template-based messaging and authenticated API endpoints (`server/lib/notification-service.ts`)
- **Premium Market Data**: Polygon.io and Twelve Data connectors with technical indicators (RSI, MACD, SMA, EMA, BBands, ATR, Stoch) (`server/connectors/polygon.ts`, `server/connectors/twelvedata.ts`)
- **Social Sentiment**: StockTwits and Reddit integration with aggregate sentiment scoring (`server/connectors/social-sentiment.ts`)

## Architecture Documentation

Comprehensive architecture documentation is available in the `docs/` directory:

### Architecture Decision Records (ADRs)
- `docs/adr/ADR-001-microservices-architecture.md` - Core microservices design
- `docs/adr/ADR-002-event-bus-selection.md` - NATS JetStream selection rationale
- `docs/adr/ADR-003-container-standards.md` - Docker/K8s patterns

### Service Specifications
- `docs/services/TRADING_ENGINE.md` - Order execution service
- `docs/services/AI_DECISION.md` - AI/LLM service
- `docs/services/MARKET_DATA.md` - Data ingestion service
- `docs/services/ANALYTICS.md` - Reporting service
- `docs/services/ORCHESTRATOR.md` - Coordination service
- `docs/services/API_GATEWAY.md` - External interface

### Additional Documentation
- `docs/MICROSERVICES_ROADMAP.md` - Phased implementation plan
- `docs/EVENT_SCHEMA_REGISTRY.md` - Event type definitions
- `docs/N8N_INTEGRATION_GUIDE.md` - Workflow automation
- `docs/COMPETITIVE_BENCHMARKING.md` - Feature comparison with competitors

### Operational Readiness
- `docs/SLA_SLO_TARGETS.md` - Service level objectives and error budgets per service
- `docs/TRADING_SAGA_SEQUENCES.md` - Sequence diagrams for trading sagas with compensation flows
- `docs/DATA_MIGRATION_STRATEGY.md` - Dual-write/CDC migration patterns with 6-week timeline

## External Dependencies

- **Market Data**: Finnhub, Polygon.io, Twelve Data, Financial Modeling Prep, Alpha Vantage.
- **News Data**: NewsAPI, GDELT (real-time global news).
- **AI/LLM Integration**: OpenAI API (primary), Groq, Together.ai, AIML API, OpenRouter (fallback) via an LLM Router for intelligent task routing and function calling.
- **Data Sources & Enrichment**: Valyu.ai (9 financial datasets), Hugging Face (FinBERT sentiment analysis), GDELT (news sentiment). Data Fusion Engine combines these sources with conflict resolution.
- **Brokerage Integration**: Alpaca Paper Trading API (primary).
- **Third-party Services**: `expo-web-browser` (OAuth), `expo-haptics` (tactile feedback), `expo-blur` (iOS blur effects).