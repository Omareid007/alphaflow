# AI Active Trader - Strategy Builder

## Overview
AI Active Trader is a mobile-first application designed for configuring and managing AI-powered paper trading strategies. Its core purpose is to provide explainable trading decisions within a simulated paper trading environment by integrating real-time market data, news feeds, and advanced AI models. The project aims to leverage AI for adaptive risk management and intelligent trading automation, with future ambitions for real trading capabilities.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (December 2025)

### Phase 0+1 Infrastructure Audit & Fixes
Completed comprehensive documentation vs implementation audit with all critical gaps fixed:

1. **Work Queue Integration (G1 Fixed)**: All order operations (submit, cancel) now route through the durable PostgreSQL-backed work queue with:
   - Idempotency keys (5-minute time buckets for orders)
   - Polling mechanism for synchronous workflow
   - Automatic retry with exponential backoff
   - Dead-letter queue for failed operations

2. **TraceId Propagation (G2 Fixed)**: End-to-end traceability across:
   - Orchestrator cycles (`cyc-*` prefix)
   - Background AI batches (`batch-*` prefix)
   - Strategy runs (`run-*` prefix)
   - Manual API calls (`api-*` prefix)
   - AI decisions, LLM calls, and trades all linked via traceId

3. **Work Queue Worker Startup (G3 Fixed)**: Worker now starts automatically during server initialization in `routes.ts`.

See `docs/AUDIT_DOC_VS_IMPLEMENTATION_GAP.md` for full audit details.

## System Architecture

### Target Architecture
The platform is transitioning from a React Native (Expo) and Express.js (TypeScript) monolith to an event-driven microservices architecture using NATS JetStream for inter-service communication. This architecture includes an API Gateway, Event Bus, Market Data Service, Trading Engine Service, AI Decision Service, Analytics Service, and Orchestrator Service.

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
- **Centralized LLM Gateway**: All LLM calls route through `llmGateway.ts` with criticality-based routing, role-based model chains, automatic fallback, and traceId tracking for full traceability.
- **Durable Work Queue**: PostgreSQL-backed for reliable order execution, featuring idempotency, retry with backoff, error classification, and a dead-letter queue.
- **Backtesting Subsystem**: Comprehensive engine with historical data pipeline, deterministic execution, per-symbol execution queues, pluggable fees/slippage, and complete performance metrics while preventing biases.
- **Algorithm Framework**: Core trading algorithm base class with portfolio construction and risk management. Includes an event-driven backtesting engine with realistic fill/slippage/commission models and performance analytics.
- **Data Processing**: Features Order Book Depth Analyzer, Market Regime Detection, Multi-Source Sentiment Fusion, and a Technical Indicators Library.
- **Strategies**: Supports strategy versioning with A/B testing and LLM Trading Governance.
- **Feature Flags**: Implemented for gradual rollout, traffic splitting, and user targeting.

### UI/UX Decisions
- **Framework**: React Native with Expo SDK 54, React Navigation v7, TanStack Query.
- **Styling**: Custom themed components supporting dark/light mode, Reanimated 4 for animations, BrandColors palette, and elevation-based cards.
- **Platform Support**: iOS, Android, and Web.
- **Information Architecture**: Canonical UI type definitions, unified activity timeline, and proper broker status mapping (Alpaca statuses).

## External Dependencies

- **Market Data Providers**: Finnhub, Polygon.io, Twelve Data, Financial Modeling Prep, Alpha Vantage.
- **News Data Providers**: NewsAPI, GDELT.
- **AI/LLM Integration**: OpenAI API, Groq, Together.ai, AIML API, OpenRouter (via an intelligent LLM Router).
- **Data Sources & Enrichment**: Valyu.ai (financial datasets), Hugging Face (FinBERT sentiment analysis).
- **Brokerage Integration**: Alpaca Paper Trading API.
- **Third-party UI/Utility Libraries**: `expo-web-browser`, `expo-haptics`, `expo-blur`.