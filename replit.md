# AI Active Trader - Strategy Builder

## Overview
AI Active Trader is a mobile-first application designed for configuring and managing AI-powered paper trading strategies. Its primary goal is to provide explainable trading decisions within a simulated paper trading environment, integrating real-time market data, news feeds, and advanced AI models. The project focuses on AI-driven adaptive risk management and intelligent trading automation, with future plans for real trading capabilities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
The platform is evolving towards an event-driven microservices architecture utilizing NATS JetStream. Key decisions include a monorepo structure, schema-first development with Zod, and an Adapter pattern for external APIs. AI decisions are logged for transparency, and an Adaptive Risk Mode dynamically adjusts to market conditions. The system uses a database per service (PostgreSQL), containerization with Node.js 22 Alpine in Kubernetes, and OpenTelemetry for observability. Fault isolation is achieved through circuit breakers. Alpaca Paper Trading serves as the single source of truth for live position/order data.

### AI and Trading Infrastructure
All LLM calls are routed through a centralized `llmGateway.ts` with criticality-based routing, role-based model chains, automatic fallback, and traceId tracking. The LLM Gateway now includes:
- **Rate Limiting**: Integrated with `server/lib/apiPolicy.ts` for all LLM providers (OpenAI, Claude, OpenRouter, Groq, Together, DeepSeek)
- **DeepSeek Models**: Available via OpenRouter for cost-effective reasoning tasks (`deepseek/deepseek-r1`)
- **Claude Integration**: Primary model for `technical_analyst` and `risk_manager` roles at high criticality
- **Provider Rate Limits**: Configurable per-provider limits with automatic throttling and budget enforcement

A durable, PostgreSQL-backed work queue ensures reliable order execution with idempotency, retries, and a dead-letter queue. The system includes a comprehensive backtesting subsystem and a core trading algorithm framework with portfolio construction and risk management. Data processing capabilities include Order Book Depth Analysis, Market Regime Detection, Multi-Source Sentiment Fusion, and a Technical Indicators Library. Strategies support versioning, A/B testing, and LLM Trading Governance. Feature flags enable gradual rollouts.

### Key Features
- **Universe & Allocation System**: Manages symbols from Alpaca, performs liquidity-based tiering, fundamentals scoring via Finnhub, and includes an allocation policy with a rebalancer service. Dynamic universe selection from 4 sources: base watchlist, approved candidates, recent high-confidence AI decisions, and recently executed trades. Rotation mechanism handles universe caps gracefully. **Fully dynamic - not limited to static/hardcoded lists.**
- **Admin Hub**: A WordPress-style admin panel with 13 modules for comprehensive system management, offering real-time order tracking and source of truth badges.
- **Loss Protection**: Implements strict rules to prevent automatic closure of losing positions unless stop-loss is triggered or an emergency stop at -8% loss, blocking AI sell recommendations on such positions.
- **Advanced Rebalancing Strategy** (`server/services/advanced-rebalancing-service.ts`):
  - **Buy-the-Dip**: Buys underweight positions experiencing dips (>3% underweight, unrealized loss), 10% cash reserve, 2% max individual buy
  - **Partial Take-Profit Levels**: Scale out at 10%, 20%, 35%, 50% profit (25% each level)
  - **Trailing Stop Automation**: Moves stop to breakeven at 8% profit, trails at 5% below high water mark
  - **Market Regime Adaptation**: Adjusts position sizes based on macro conditions (bullish: 1.25x, bearish: 0.5x, volatile: 0.6x)
  - **Kelly Criterion Position Sizing**: Optimal position sizing based on win rate, expected return, and configurable Kelly fraction (default 0.25)
- **AI Debate Arena**: A multi-role AI consensus system with specialized analyst roles (bull, bear, risk_manager, technical_analyst, fundamental_analyst) and a synthesizing judge.
- **MCP-Style Tool Router**: A registry-based internal tool system for broker/data operations with schema validation and audit logging.
- **Competition Mode**: Allows multiple AI trader profiles to compete, tracking performance with metrics like PnL and Sharpe ratio.
- **Strategy Studio**: Web-based strategy configuration with versioning, supporting full spec storage and backtest result linking.
- **Arena Coordinator**: A cost-aware multi-agent debate system with an escalation policy for agent models based on disagreement or confidence levels.
- **Asset Classification Service**: Unifies liquidity, fundamentals, and technical data into coherent per-symbol labels and scores for market cap, volatility, trend strength, and asset class.

### Dynamic Trading Universe
The system maintains a fully dynamic trading universe:
- **Candidates Service** (`server/universe/candidatesService.ts`): Generates candidates from liquidity metrics and fundamentals
- **Bootstrap on Init**: Orchestrator automatically ensures watchlist symbols are in approved candidates
- **Status Workflow**: NEW → WATCHLIST → APPROVED/REJECTED
- **Trading Enforcement**: Only APPROVED candidates can be traded (enforced by `tradingEnforcement.ts`)

### Database Schema Enhancements
New tables track AI debate sessions, messages, consensus, trader profiles, competition runs, strategy versions, tool invocations, AI agent profiles, and outcome links for attribution. Additional tables (`universe_technicals`, `macro_indicators`, `asset_classifications`) enrich data for AI decision-making.

### UI/UX
Developed with React Native using Expo SDK 54, React Navigation v7, and TanStack Query. Features custom themed components, dark/light mode support, Reanimated 4 for animations, and BrandColors palette. Supports iOS, Android, and Web platforms.

## External Dependencies

-   **Market Data**: Finnhub, Polygon.io, Twelve Data, Financial Modeling Prep, Alpha Vantage.
-   **Research Data**: AiTrados (OHLC, News, Economic Calendar).
-   **News Data**: NewsAPI, GDELT, AiTrados.
-   **AI/LLM Integration**: OpenAI API, Groq, Together.ai, AIML API, OpenRouter (via LLM Router), Anthropic Claude (via API key or Replit AI Integrations). Claude is now the primary model for technical_analyst and risk_manager roles at high criticality.
-   **Data Sources & Enrichment**: Valyu.ai (financial datasets), Hugging Face (FinBERT sentiment), Jina AI (embeddings, web reader, semantic search, reranking), FRED (Federal Reserve Economic Data).
-   **Brokerage**: Alpaca Paper Trading API.
-   **UI/Utility Libraries**: `expo-web-browser`, `expo-haptics`, `expo-blur`.

### Key Integrations
-   **Jina AI**: Provides embeddings, URL reading, web search, and reranking capabilities.
-   **FRED Connector**: Integrates Federal Reserve Economic Data for macro indicators and market regime detection.
-   **Connector Infrastructure**: A service with priority-based fallback routing (e.g., Stock Prices: Alpaca → Finnhub → TwelveData) and a metrics service for benchmarking connector performance.

### Claude Integration Options
Three methods available for Claude AI access:
1. **Replit AI Integrations** (recommended): No API key needed, uses Replit credits, supports Claude Sonnet 4.5/Opus 4.5/Haiku 4.5
2. **API Key**: Direct Anthropic API access via `ANTHROPIC_API_KEY` environment variable
3. **MCP (Model Context Protocol)**: Only works locally with Claude Desktop - NOT suitable for server-side applications

Current setup uses Replit AI Integrations for both Anthropic and OpenRouter.

## Recent Changes (December 2024)

### Order Execution Consolidation
- **Unified Order Executor** (`server/trading/unified-order-executor.ts`): Single entry point for all order execution with:
  - Queue-based execution by default (via work queue with idempotency)
  - Direct execution fallback with duplicate detection via client_order_id
  - Trading enforcement validation for buy orders
  - Tradability validation for all orders
  - Cancel order support with queue or direct modes

### Strategy Metrics Enhancement
New backtesting metrics added to `BacktestResultsSummary`:
- **Calmar Ratio**: CAGR / MaxDrawdown (target > 0.5)
- **Expectancy**: (WinRate × AvgWin) - (LossRate × AvgLoss)
- **Trades per Month**: Trading frequency based on elapsed calendar days
- **Avg Holding Period Days**: FIFO-based tracking of position entry/exit timestamps

### AI Integrations (Replit)
- **Anthropic**: Claude Opus 4.5, Sonnet 4.5, Haiku 4.5 (via `AI_INTEGRATIONS_ANTHROPIC_*`)
- **OpenRouter**: DeepSeek R1/V3.2, Kimi K2, GLM 4.6, Qwen 3 Max (via `AI_INTEGRATIONS_OPENROUTER_*`)
- **Batch Utilities**: `server/replit_integrations/batch/utils.ts` with rate limiting, retries, SSE streaming

### Cache Architecture
The system uses an `ApiCache` class (`server/lib/api-cache.ts`) with fresh/stale duration pattern:
- **Pre-configured caches**: marketDataCache, stockQuoteCache, cryptoPriceCache, newsCache, assetListCache, portfolioCache
- **Per-connector caches**: Each connector (Finnhub, CoinGecko, Valyu, etc.) maintains its own ApiCache instances
- **TTL Guidelines**:
  - Market data: 30s fresh, 1h stale
  - Stock quotes: 1m fresh, 30m stale
  - News: 5m fresh, 1h stale
  - Static data (company profiles): 1h fresh, 24h stale

### Trading Strategies Implementation Status
| Feature | Status | Location |
|---------|--------|----------|
| Sharpe Ratio | ✅ | execution-engine.ts |
| Sortino Ratio | ✅ | execution-engine.ts |
| Calmar Ratio | ✅ | execution-engine.ts |
| Max Drawdown | ✅ | execution-engine.ts |
| Win Rate / Profit Factor | ✅ | execution-engine.ts |
| Kelly Criterion (0.25 fractional) | ✅ | advanced-rebalancing-service.ts |
| RSI, SMA, ROC, StdDev | ✅ | strategies/*.ts |
| Momentum Strategy | ✅ | momentum-strategy.ts |
| Mean Reversion | ✅ | mean-reversion-scalper.ts |
| Moving Average Crossover | ✅ | moving-average-crossover.ts |