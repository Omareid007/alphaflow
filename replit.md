# AI Active Trader - Strategy Builder

## Overview
AI Active Trader is a mobile-first application for configuring and managing AI-powered paper trading strategies. Its core purpose is to provide explainable trading decisions within a simulated paper trading environment, leveraging real-time market data, news feeds, and advanced AI models. The project emphasizes AI-driven adaptive risk management and intelligent trading automation, with future aspirations for real trading capabilities and significant market potential.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
The platform uses an event-driven microservices architecture with NATS JetStream, a monorepo structure, and schema-first development with Zod. An Adapter pattern handles external APIs. AI decisions are logged for transparency, and an Adaptive Risk Mode adjusts to market conditions. It employs a database per service (PostgreSQL), containerization with Node.js 22 Alpine in Kubernetes, and OpenTelemetry for observability. Fault isolation is managed via circuit breakers. Alpaca Paper Trading is the single source of truth for live position/order data.

### AI and Trading Infrastructure
All LLM calls are routed through a centralized `llmGateway.ts` featuring criticality-based routing, role-based model chains, automatic fallback, and traceId tracking. The gateway includes rate limiting for various LLM providers (OpenAI, Claude, OpenRouter, Groq, Together, DeepSeek), with DeepSeek used for cost-effective reasoning and Claude for high-criticality `technical_analyst` and `risk_manager` roles. A durable, PostgreSQL-backed work queue ensures reliable order execution. The system offers a comprehensive backtesting subsystem, a core trading algorithm framework with portfolio construction, and risk management. Data processing includes Order Book Depth Analysis, Market Regime Detection, Multi-Source Sentiment Fusion, and a Technical Indicators Library. Strategies support versioning, A/B testing, and LLM Trading Governance, with feature flags for gradual rollouts.

### Key Features
-   **Universe & Allocation System**: Manages symbols from Alpaca, performs liquidity-based tiering, fundamentals scoring (Finnhub), and includes an allocation policy with a rebalancer service. Supports dynamic universe selection from multiple sources and handles universe caps.
-   **Admin Hub**: A WordPress-style admin panel with 13 modules for system management, real-time order tracking, and source of truth badges.
-   **Loss Protection**: Prevents automatic closure of losing positions unless stop-loss is triggered or an emergency stop at -8% loss, blocking AI sell recommendations on such positions.
-   **Advanced Rebalancing Strategy**: Implements buy-the-dip, partial take-profit levels, trailing stop automation, market regime adaptation, and Kelly Criterion position sizing.
-   **AI Debate Arena**: A multi-role AI consensus system with specialized analysts (bull, bear, risk_manager, technical_analyst, fundamental_analyst) and a synthesizing judge.
-   **MCP-Style Tool Router**: A registry-based internal tool system for broker/data operations with schema validation and audit logging.
-   **Competition Mode**: Allows multiple AI trader profiles to compete, tracking performance.
-   **Strategy Studio**: Web-based strategy configuration with versioning and backtest result linking.
-   **Arena Coordinator**: A cost-aware multi-agent debate system with an escalation policy.
-   **Asset Classification Service**: Unifies liquidity, fundamentals, and technical data into per-symbol labels and scores.

### Dynamic Trading Universe
The system maintains a fully dynamic trading universe with a `Candidates Service` to generate candidates based on liquidity and fundamentals. Only `APPROVED` candidates can be traded.

### Database Schema Enhancements
New tables track AI debate sessions, messages, consensus, trader profiles, competition runs, strategy versions, tool invocations, AI agent profiles, and outcome links for attribution. Additional tables (`universe_technicals`, `macro_indicators`, `asset_classifications`) enrich data for AI decision-making.

### UI/UX
Developed with React Native using Expo SDK 54, React Navigation v7, and TanStack Query. Features custom themed components, dark/light mode, Reanimated 4 for animations, and BrandColors palette, supporting iOS, Android, and Web platforms.

### API Resilience Infrastructure
Includes enterprise-grade rate limiting (`server/lib/rateLimiter.ts`) using Bottleneck, a Circuit Breaker Registry (`server/lib/circuitBreaker.ts`) for fault isolation, and a Multi-Provider Fallback system (`server/lib/providerFallback.ts`) with priority-based routing and stale cache serving.

### Data Enrichment Scheduler
An automated scheduler (`server/services/enrichment-scheduler.ts`) populates `macro_indicators`, `universe_fundamentals`, and `universe_technicals` tables at defined intervals.

### Technical Indicators Library
A centralized library (`server/lib/technical-indicators.ts`) provides functions for calculating SMA, EMA, RSI, MACD, Bollinger Bands, ATR, StdDev, and ROC.

## External Dependencies

-   **Market Data**: Finnhub, Polygon.io, Twelve Data, Financial Modeling Prep, Alpha Vantage, Binance (for crypto).
-   **Research Data**: AiTrados (OHLC, News, Economic Calendar).
-   **News Data**: NewsAPI, GDELT, AiTrados.
-   **AI/LLM Integration**: OpenAI API, Groq, Together.ai, AIML API, OpenRouter (including DeepSeek), Anthropic Claude (via API key or Replit AI Integrations).
-   **Data Sources & Enrichment**: Valyu.ai (financial datasets), Hugging Face (FinBERT sentiment), Jina AI (embeddings, web reader, semantic search, reranking), FRED (Federal Reserve Economic Data), SEC EDGAR (free fundamental data).
-   **Brokerage**: Alpaca Paper Trading API.
-   **UI/Utility Libraries**: `expo-web-browser`, `expo-haptics`, `expo-blur`.

### Key Integrations
-   **Jina AI**: Provides embeddings, URL reading, web search, and reranking.
-   **FRED Connector**: Integrates Federal Reserve Economic Data.
-   **Connector Infrastructure**: Service with priority-based fallback routing (e.g., Stock Prices: Alpaca → Finnhub → TwelveData) and a metrics service for benchmarking.

### Claude Integration Options
Access to Claude AI is available via Replit AI Integrations (recommended, no API key, uses Replit credits), direct Anthropic API key, or MCP (local only, not for server-side). Current setup utilizes Replit AI Integrations for Anthropic and OpenRouter.