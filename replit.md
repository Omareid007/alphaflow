# AI Active Trader - Strategy Builder

## Overview

AI Active Trader is a mobile-first trading application that enables users to configure AI-powered trading agents to execute paper trading strategies. The system integrates real-time market data, news feeds, and OpenAI's language models to analyze trading opportunities and make explainable trading decisions. Built with React Native (Expo) for cross-platform mobile support and Express.js for the backend API.

The application features a sophisticated architecture supporting multiple trading strategies (Range Trading, Momentum, Mean Reversion, Breakout), real-time data connectors (market data, news, fundamentals), and a complete trade execution and monitoring system running in paper trading mode.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (December 2025)

### Multi-Provider LLM & Data Fusion Integration
- **Data Fusion Engine Integration**: AlpacaTradingEngine.analyzeSymbol() now enriches decisions with Hugging Face sentiment and Valyu.ai fundamentals when API keys are available
- **Enhanced Decision Logging**: Full transparency with input snapshots, reasoning chains, alternative options considered, and data source attribution stored in marketContext
- **Optional Enrichment Pattern**: gatherEnrichmentData() method gracefully handles missing API keys, enabling progressive enhancement as providers are configured
- **Type-Safe Data Flow**: Fixed interface mismatches between connectors and fusion engine (MarketDataPoint.reliability, SentimentDataPoint.sentiment, FundamentalDataPoint.symbol)

### Bug Fixes & Reliability Improvements
- **AI Model Fix**: Changed invalid "gpt-5" model to "gpt-4o-mini" in decision-engine.ts - eliminates empty AI responses
- **NewsAPI Circuit Breaker**: Extended cache times to 60min fresh / 24hr stale to handle 100 req/day limit
- **Stale Order Cleanup**: Added cancelStaleOrders() function in orchestrator.ts - cancels orders older than 5 minutes to prevent rebalancing blocks

### Code Quality
- **Centralized Logging**: Migrated all connectors (finnhub, coingecko, alpaca, coinmarketcap, newsapi) and decision-engine from console.* to centralized log.* with correlation IDs
- **Shadow Style Platform Handling**: Fixed deprecated shadow* props using Platform.OS checks (boxShadow on web, shadow* on native)
- **StrategyWizard Refactor**: Extracted context and types to separate context.tsx file, breaking 18 require cycle warnings

### UI Visualization Widgets (December 2025)
- **Data Funnels Widget**: New `client/components/DataFunnelsWidget.tsx` visualizes all data connectors grouped by category:
  - Trading (Alpaca), Market Data (Finnhub, CoinGecko, CoinMarketCap, UAE Markets), News (NewsAPI), Enrichment (Valyu.ai, Hugging Face), AI (OpenAI)
  - Shows connection status, cache sizes, and visual flow leading to "AI Decision Engine"
- **Activity Flow Widget**: New `client/components/ActivityFlowWidget.tsx` provides n8n-style real-time activity visualization:
  - Shows agent status (Active/Stopped) with animated indicator
  - Displays recent AI decisions and trades as connected nodes
  - Includes stats row with total trades and P&L
- **Enhanced /api/connectors/status**: Endpoint now returns `allConnectors[]` array with full status for all 9 data sources

## System Architecture

### Frontend Architecture

**Framework**: React Native with Expo SDK 54
- **Navigation**: React Navigation v7 with bottom tab navigation and native stack navigators
- **State Management**: TanStack Query (React Query) for server state, React hooks for local state
- **UI Components**: Custom themed components with dark/light mode support
- **Animations**: Reanimated 4 for performant native animations
- **Platform Support**: iOS, Android, and Web with platform-specific adaptations

**Design System**:
- Theme-based color system with BrandColors palette (primary: #0A2463, success: #10B981, error: #EF4444)
- Typography system with defined scales (h1-h4, body, small)
- Spacing constants (xs: 4, sm: 8, md: 12, lg: 16, xl: 20)
- Elevation-based card system (1-3 levels with distinct background colors)

**Module Resolution**: Custom path aliases (@/ for client, @shared/ for shared code)

### Backend Architecture

**Server Framework**: Express.js with TypeScript
- **Build System**: esbuild for production bundling, tsx for development
- **API Design**: RESTful endpoints with JSON responses
- **CORS**: Configured for Replit deployment domains
- **Error Handling**: Centralized error handling with structured error responses

**Data Access Pattern**: Repository pattern via storage interface
- Abstract IStorage interface defines all database operations
- Separation between data access logic and business logic
- Support for transactions and complex queries through Drizzle ORM

### Database Schema

**ORM**: Drizzle ORM with PostgreSQL dialect
- **Migration System**: drizzle-kit for schema management
- **Type Safety**: Full TypeScript types generated from schema
- **Validation**: Zod schemas derived from Drizzle tables via drizzle-zod

**Core Tables**:
- `users`: Authentication (id, username, password)
- `strategies`: Trading strategies (id, name, type, description, isActive, assets[], parameters, timestamps)
- `trades`: Trade execution records (id, strategyId, symbol, side, quantity, price, executedAt, pnl, status, notes)
- `positions`: Active positions (id, symbol, quantity, entryPrice, currentPrice, unrealizedPnl, strategyId, timestamps)
- `aiDecisions`: AI decision log (id, strategyId, symbol, action, confidence, reasoning, marketData, newsContext, timestamp)
- `agentStatus`: Agent state tracking (isRunning, totalTrades, totalPnl, lastHeartbeat, errorMessage)

**Data Types**: Uses PostgreSQL-specific types (varchar with UUID default, numeric for precision, timestamp, boolean, text arrays)

### External Dependencies

**Market Data Connectors** (planned integration):
- Primary options: Finnhub, Financial Modeling Prep, Polygon.io, Alpha Vantage
- Requirements: Real-time price data, OHLC data, volume, fundamentals
- Implementation: Adapter pattern for swappable providers

**News Data Connectors** (planned integration):
- Primary options: NewsAPI, GDELT, Google Programmable Search
- Requirements: Real-time news headlines, sentiment data, categorization
- Implementation: Adapter pattern for swappable providers

**AI/LLM Integration** (Multi-Provider Architecture):
- Primary Provider: OpenAI API (via Replit AI Integrations)
- Additional Providers: Groq (ultra-fast), Together.ai (200+ models), AIML API (400+ models), OpenRouter (fallback)
- LLM Router: Intelligent task routing based on complexity and cost
  - Simple tasks → Groq Llama 3.1 8B ($0.05/1M tokens)
  - Complex reasoning → OpenAI GPT-4o
  - Batch operations → Together.ai
- Architecture: Minimal fetch-based client abstraction, NO external LLM frameworks
- Usage: Decision scoring, opportunity analysis, trade explanations
- Features: Function/tool calling, multi-provider fallback, cost optimization
- Key Files: `server/ai/llmClient.ts`, `server/ai/llmRouter.ts`, `server/ai/groqClient.ts`, `server/ai/togetherClient.ts`, `server/ai/aimlClient.ts`

**Data Sources & Enrichment**:
- Valyu.ai: Structured financial data (earnings, ratios, SEC filings) at $1.50/1k queries
- Hugging Face: FinBERT sentiment analysis, trend scoring as LLM inputs
- Data Fusion Engine: Combines multiple sources with conflict resolution and confidence scoring
- Key Files: `server/connectors/valyu.ts`, `server/connectors/huggingface.ts`, `server/ai/data-fusion-engine.ts`

**Enhanced AI Decision Logging**:
- Input Snapshots: Market data, sentiment, fundamentals captured
- Reasoning Chains: Step-by-step analysis with weights
- Alternatives Considered: Why other actions were rejected
- Provider Attribution: Which LLM made the decision with cost/latency
- Key Files: `server/ai/enhanced-decision-log.ts`

**Brokerage Integration** (planned):
- Paper Trading: Alpaca Paper Trading API (primary target)
- Real Trading: Disabled in MVP, architecture supports future plugin
- Implementation: Adapter pattern for broker-agnostic order execution

**Third-party Services**:
- expo-web-browser: OAuth flows for SSO (Apple Sign-In, Google Sign-In planned)
- expo-haptics: Tactile feedback for trading actions
- expo-blur: iOS-native blur effects for UI chrome

**Development Tools**:
- TypeScript: Full type safety across client, server, and shared code
- ESLint: Code quality with Expo config
- Prettier: Code formatting
- React Compiler: Experimental opt-in for automatic memoization

### Deployment Configuration

**Platform**: Replit deployment
- Environment variables: REPLIT_DEV_DOMAIN, REPLIT_INTERNAL_APP_DOMAIN, DATABASE_URL
- CORS: Dynamic origin whitelisting based on Replit domains
- Proxy: Custom Metro bundler proxy configuration for Expo development
- Build: Static export for web, native builds for iOS/Android

**Security Considerations**:
- API keys stored in environment secrets (DATABASE_URL, future: OPENAI_API_KEY, market data API keys)
- Never expose secrets to client bundle
- Server-side only external API calls
- Rate limiting and retry logic for external APIs
- Paper trading enforced, real trading disabled in codebase

### Key Architectural Decisions

**Monorepo Structure**: Single repository with client/, server/, and shared/ directories
- **Rationale**: Simplifies type sharing, deployment, and development workflow
- **Trade-off**: Requires careful build configuration and module resolution

**Schema-First Development**: Database schema defined in shared/schema.ts with Zod validation
- **Rationale**: Single source of truth for data models across frontend and backend
- **Benefits**: Type safety, automatic validation, reduced duplication

**Adapter Pattern for External Services**: Abstract interfaces for market data, news, and broker APIs
- **Rationale**: Allows swapping providers without rewriting application logic
- **Future-proofing**: Easy to add new data sources or switch to better APIs

**Paper Trading First**: Complete trading system built for paper trading, real trading disabled
- **Rationale**: MVP validation without regulatory/financial risk
- **Architecture**: Designed to support real trading with minimal changes (flip configuration, add real broker adapter)

**AI Decision Transparency**: All AI decisions logged with reasoning, market context, and confidence scores
- **Rationale**: Users need to understand why the agent made each decision
- **Implementation**: Structured aiDecisions table with full context storage

**React Navigation v7**: Native stack and bottom tab navigators with platform-optimized transitions
- **Rationale**: Best-in-class navigation for React Native with native feel
- **Features**: Header blur effects, gesture controls, safe area handling

### Testing Infrastructure

**Unit Tests**: Vitest for server-side testing
- Configuration: `vitest.config.ts` at project root
- Test files: `*.test.ts` pattern
- Run tests: `npx vitest run`
- Current coverage: 39 tests for numeric utilities and P&L calculations
- Test location: `server/utils/numeric.test.ts`

**E2E Tests**: Playwright via `run_test` tool
- Human-executable scenarios documented in `docs/TESTING.md`
- Mobile viewport: 402x874 pixels

### Documentation Structure

| Document | Purpose |
|----------|---------|
| `docs/APP_OVERVIEW.md` | Canonical entry point, complete system documentation |
| `docs/AGENT_EXECUTION_GUIDE.md` | AI agent governance and execution workflow |
| `docs/FINANCIAL_METRICS.md` | P&L formulas, metric→UI mapping |
| `docs/ARCHITECTURE.md` | Mermaid diagrams, data flows, integrations |
| `docs/TESTING.md` | Test strategy, commands, scenarios |
| `docs/AI_MODELS_AND_PROVIDERS.md` | LLM client architecture, provider configuration |
| `docs/DOC_ASSISTANT.md` | Dev-only documentation Q&A tool |
| `docs/CONNECTORS_AND_INTEGRATIONS.md` | External API connector patterns |
| `docs/ORCHESTRATOR_AND_AGENT_RUNTIME.md` | Trading orchestrator deep-dive |