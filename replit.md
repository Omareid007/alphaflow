# AI Active Trader - Strategy Builder

## Overview
AI Active Trader is a mobile-first application designed for configuring and managing AI-powered paper trading strategies. It integrates real-time market data, news feeds, and advanced AI models to provide explainable trading decisions. The platform supports various trading strategies, real-time data connectivity, and trade execution/monitoring within a simulated paper trading environment, aiming for future real trading capabilities. The project envisions enabling users to leverage AI for sophisticated, data-driven trading strategies with transparency.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React Native with Expo SDK 54, React Navigation v7, TanStack Query.
- **UI/UX**: Custom themed components supporting dark/light mode, Reanimated 4 for animations, BrandColors palette, typography, spacing, and elevation-based cards.
- **Platform Support**: iOS, Android, and Web.

### Backend
- **Server Framework**: Express.js with TypeScript, esbuild, and tsx.
- **API Design**: RESTful APIs with JSON responses and centralized error handling.
- **Data Access**: Repository pattern via an `IStorage` interface, Drizzle ORM for PostgreSQL.

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect, `drizzle-kit` for migrations, Zod for validation.
- **Core Tables**: `users`, `strategies`, `trades`, `positions`, `aiDecisions`, `agentStatus`.
- **AI Learning Tables**: `ai_decision_features` (feature vectors for each decision), `ai_trade_outcomes` (execution metrics and P&L tracking), `ai_calibration_log` (model improvement history and recommendations).

### Key Architectural Decisions
- **Monorepo Structure**: `client/`, `server/`, `shared/` for code organization, type sharing, and simplified deployment.
- **Schema-First Development**: Database schema defined in `shared/schema.ts` with Zod validation.
- **Adapter Pattern for External Services**: Abstract interfaces for market data, news, and broker APIs to ensure flexibility and provider agnosticism.
- **Paper Trading First**: System designed initially for paper trading, with future plans for live trading.
- **AI Decision Transparency**: All AI decisions are logged with detailed reasoning, market context, and confidence scores.
- **Adaptive Risk Mode**: Implemented for strategies like Moving Average Crossover, allowing automatic adjustment of risk profiles (conservative/balanced/aggressive) based on real-time market intelligence (volatility, trend strength, signal agreement, data quality). This includes backend services for preset selection and frontend UI for configuration and status display.
- **Consolidated Order Execution**: Centralized order execution utilities in `server/trading/order-execution-flow.ts` for consistency and reusability across the system.
- **Pre-Trade Guard**: Validates buying power, market session, and symbol tradability before order submission. Extended hours trading uses limit orders with extended_hours flag.
- **AI Learning Feedback Loop**: Records decision features and trade outcomes for continuous calibration. Daily calibration analysis runs automatically to identify patterns in wins/losses.
- **Unified Analytics Endpoint**: `/api/analytics/summary` provides synchronized account, risk, and daily performance data.
- **Stock Universe**: Expanded coverage across all 11 GICS sectors (Technology, Financials, Healthcare, Consumer, Energy, Industrials, Materials, Utilities, Real Estate, Communication Services). ETFs (SPY, QQQ, etc.) removed from all strategy watchlists to avoid Finnhub data gaps.
- **Crypto Trading**: Limited to Alpaca-tradable cryptos (BTC, ETH, SOL, DOGE, SHIB, AVAX).
- **Position Closure Safety**: Orchestrator automatically cancels pending orders for a symbol before closing positions, preventing "insufficient qty available" errors when bracket orders hold shares.

## External Dependencies

- **Market Data**: Finnhub, Financial Modeling Prep, Polygon.io, Alpha Vantage.
- **News Data**: NewsAPI, GDELT (real-time global news).
- **AI/LLM Integration**: OpenAI API (primary), Groq, Together.ai, AIML API, OpenRouter (fallback) via an LLM Router for intelligent task routing and function calling.
- **Data Sources & Enrichment**: Valyu.ai (9 financial datasets), Hugging Face (FinBERT sentiment analysis), GDELT (news sentiment). Data Fusion Engine combines these sources with conflict resolution.
- **Brokerage Integration**: Alpaca Paper Trading API (primary).
- **Third-party Services**: `expo-web-browser` (OAuth), `expo-haptics` (tactile feedback), `expo-blur` (iOS blur effects).