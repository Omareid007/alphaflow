# AI Active Trader - Strategy Builder

## Overview

AI Active Trader is a mobile-first trading application for configuring AI-powered agents to execute paper trading strategies. It integrates real-time market data, news, and OpenAI's language models for explainable trading decisions. The application supports multiple trading strategies (Range Trading, Momentum, Mean Reversion, Breakout) and features real-time data connectors, trade execution, and monitoring in a paper trading environment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React Native with Expo SDK 54, React Navigation v7 for navigation, TanStack Query for server state.
**UI/UX**: Custom themed components supporting dark/light mode, Reanimated 4 for animations. Design system includes BrandColors palette, typography, spacing, and elevation-based cards.
**Platform Support**: iOS, Android, and Web.

### Backend Architecture

**Server Framework**: Express.js with TypeScript, esbuild for bundling, tsx for development.
**API Design**: RESTful endpoints with JSON responses and centralized error handling.
**Data Access**: Repository pattern via an abstract `IStorage` interface, supporting Drizzle ORM for PostgreSQL.

### Database Schema

**ORM**: Drizzle ORM with PostgreSQL dialect, `drizzle-kit` for migrations, and Zod for validation.
**Core Tables**: `users`, `strategies`, `trades`, `positions`, `aiDecisions`, `agentStatus`.

### Key Architectural Decisions

**Monorepo Structure**: `client/`, `server/`, `shared/` directories for simplified type sharing and deployment.
**Schema-First Development**: Database schema defined in `shared/schema.ts` with Zod validation for type safety and reduced duplication.
**Adapter Pattern for External Services**: Abstract interfaces for market data, news, and broker APIs to allow provider swapping.
**Paper Trading First**: System built for paper trading with future support for real trading.
**AI Decision Transparency**: All AI decisions are logged with reasoning, market context, and confidence scores.

## External Dependencies

**Market Data Connectors**: Finnhub, Financial Modeling Prep, Polygon.io, Alpha Vantage (planned, adapter pattern).
**News Data Connectors**: NewsAPI (100 req/day), GDELT (FREE, real-time global news in 100+ languages, updates every 15min).
**AI/LLM Integration**: Multi-provider architecture with OpenAI API (primary), Groq, Together.ai, AIML API, OpenRouter (fallback). LLM Router for intelligent task routing based on complexity and cost.
**Data Sources & Enrichment**: Valyu.ai (9 financial datasets: earnings, ratios, balance sheets, income statements, cash flow, dividends, insider trades, market movers, SEC filings). Hugging Face (FinBERT sentiment analysis). GDELT (real-time global news sentiment). Data Fusion Engine combines 10+ sources with conflict resolution and confidence scoring.
**Brokerage Integration**: Alpaca Paper Trading API (primary target).
**Third-party Services**: `expo-web-browser` (OAuth), `expo-haptics` (tactile feedback), `expo-blur` (iOS blur effects).

## Recent Enhancements (December 2025)

### Enhanced Data Connectors
- **Valyu.ai Full Integration**: Expanded from 3 to 9 financial data endpoints with dedicated caching, natural language parsing, and graceful degradation
- **GDELT Connector (FREE)**: Real-time global news monitoring with sentiment tracking and breaking news detection
- **Data Fusion Engine**: Updated to combine 10+ sources with new fundamental fields (freeCashFlow, dividendYield, debtToEquity, insiderSentiment)

### Risk Management Improvements
- **3% Hard Stop-Loss**: Changed default from 5% based on backtest research (2.11 Sharpe ratio)
- **6% Take-Profit**: Adjusted default for better risk/reward
- **Enforcement Logic**: Hard stop-loss enforced at position sync

### Trading Universe Expansion (December 11, 2025)
- **Stocks**: Expanded from 10 to 50+ symbols across all sectors (tech, finance, healthcare, consumer, energy, industrials)
- **Crypto**: Expanded from 3 to 11 symbols (BTC, ETH, SOL, XRP, DOGE, ADA, DOT, LINK, AVAX, MATIC, LTC)
- **Strategy Support**: All strategy schemas (moving average, momentum, mean reversion) updated with expanded universe

### GDELT Crypto Query Fix
- **Simplified Query Format**: Changed from complex "OR" queries to simple crypto name mapping (e.g., "Bitcoin cryptocurrency" instead of "BTC cryptocurrency OR BTC crypto")
- **Crypto Name Map**: Maps ticker symbols (BTC, ETH, SOL) to full names for better GDELT API compatibility

### OpenAI Function Calling Integration
- **analyzeWithFunctionCalling Method**: New AI analysis method allowing real-time data queries during decision-making
- **Available Tools**: get_news_sentiment (GDELT), get_financial_ratios (Valyu), get_earnings_data (Valyu), get_insider_transactions (Valyu), get_additional_news (NewsAPI), get_market_quote (Finnhub)
- **Graceful Fallback**: Falls back to standard analysis if function calling fails

### P&L Calculation Fix (December 11, 2025)
- **Root Cause**: Total P&L was using hardcoded `portfolioValue - 100000` instead of canonical formula
- **Fix Applied**: Changed to `Total P&L = Unrealized P&L + Realized P&L` per FINANCIAL_METRICS.md Section 1.2
- **API Response**: Added `realizedPnl` field to `/api/analytics/summary` for transparency
- **Key Files Modified**: `server/routes.ts`, `client/screens/DashboardScreen.tsx`, `client/screens/AnalyticsScreen.tsx`
- **Reference**: See `docs/FINANCIAL_METRICS.md` Section 8.2 for API response format

### Analytics Screen P&L Breakdown Enhancement (December 11, 2025)
- **Enhanced Metrics Display**: Analytics screen PerformanceMetrics now shows 4 cards: Total P&L, Realized, Unrealized, Win Rate
- **Subtitles Added**: "Realized" shows subtitle "Closed trades", "Unrealized" shows subtitle "Open positions"
- **Transparency Improvement**: Users can now see the breakdown of their P&L from closed trades vs open positions
- **Files Modified**: `client/screens/AnalyticsScreen.tsx` (added metricSubtitle style, updated metrics array)

### Provider Capability Mapping - Phase 1 Complete (December 11, 2025)
- **Documentation Created**: `docs/providers/` directory with comprehensive capability mapping for all major providers
- **Alpaca Capabilities**: Identified bracket orders, trailing stops, OCO as underused (interfaces exist but not integrated)
- **Finnhub Capabilities**: Identified `/stock/metric` (fundamentals), `/scan/technical-indicator` (signals), `/stock/earnings` as HIGH VALUE unused endpoints
- **CoinGecko Capabilities**: Identified `/coins/{id}/ohlc` (OHLCV) and `/coins/categories` as missing
- **OpenAI Capabilities**: Identified `strict: true` structured outputs and Batch API (50% cost savings) as critical gaps
- **Gap Analysis Summary**: Alpaca 65% utilized, Finnhub 25%, CoinGecko 40%, OpenAI 35%
- **Priority Matrix**: P0 items include OpenAI structured outputs, Alpaca bracket orders, Finnhub financials/technicals
- **Key Files**: `docs/providers/CAPABILITY_SUMMARY.md`, `docs/providers/ALPACA_CAPABILITIES.md`, `docs/providers/FINNHUB_CAPABILITIES.md`, `docs/providers/COINGECKO_CAPABILITIES.md`, `docs/providers/OPENAI_CAPABILITIES.md`

### Phase 2 Implementation - P0 Provider Upgrades Complete (December 11, 2025)
- **OpenAI Structured Outputs**: Added `strict: true` to all DATA_QUERY_TOOLS definitions in `server/ai/decision-engine.ts` for guaranteed JSON schema compliance. Added `parallel_tool_calls: false` to ensure sequential tool execution.
- **Finnhub Basic Financials**: New `/stock/metric` endpoint integration with `getBasicFinancials()` and `getKeyMetrics()` methods. Exposes P/E, P/B, ROE, ROA, gross margin, net profit margin, beta, dividend yield, EPS growth, revenue growth, 52-week high/low.
- **Finnhub Technical Indicators**: New `/scan/technical-indicator` endpoint with `getTechnicalIndicator()` and `getTechnicalSignals()` methods. Provides buy/sell/neutral signal counts, ADX trend indicator, and trending status.
- **Alpaca Bracket Orders**: Trade executor in `openPosition()` now uses bracket orders when AI decision includes targetPrice AND stopLoss for stocks. Atomic entry with TP/SL for better risk management.
- **CoinGecko OHLCV**: New `/coins/{id}/ohlc` endpoint with `getOHLC()` and `getOHLCWithIndicators()` methods. Provides candlestick data with derived volatility, trend (bullish/bearish/neutral), support, and resistance levels.
- **Data Fusion Engine Enhanced**: 
  - Extended `FundamentalDataPoint` with 10 new fields (pbRatio, roe, roa, currentRatio, grossMargin, netProfitMargin, beta, epsGrowth, weekHigh52, weekLow52)
  - Added `TechnicalDataPoint` interface for technical analysis fusion
  - Added `technicals` field to `FusedMarketIntelligence` output
  - Updated `fuseFundamentalData()` to emit all new fields
  - Added `fuseTechnicalData()`, `calculateVolatilityWithTechnicals()`, `calculateSignalAgreementWithTechnicals()` functions
  - Enhanced `calculateTrendStrength()` to incorporate technical signals
- **Key Files Modified**: `server/ai/decision-engine.ts`, `server/connectors/finnhub.ts`, `server/connectors/coingecko.ts`, `server/autonomous/orchestrator.ts`, `server/ai/data-fusion-engine.ts`