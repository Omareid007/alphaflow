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