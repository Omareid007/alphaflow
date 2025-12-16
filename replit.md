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