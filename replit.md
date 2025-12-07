# AI Active Trader - Strategy Builder

## Overview

AI Active Trader is a mobile-first trading application that enables users to configure AI-powered trading agents to execute paper trading strategies. The system integrates real-time market data, news feeds, and OpenAI's language models to analyze trading opportunities and make explainable trading decisions. Built with React Native (Expo) for cross-platform mobile support and Express.js for the backend API.

The application features a sophisticated architecture supporting multiple trading strategies (Range Trading, Momentum, Mean Reversion, Breakout), real-time data connectors (market data, news, fundamentals), and a complete trade execution and monitoring system running in paper trading mode.

## User Preferences

Preferred communication style: Simple, everyday language.

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

**AI/LLM Integration**:
- Provider: OpenAI API (required)
- Usage: Decision scoring, opportunity analysis, trade explanations
- Features: Function/tool calling for data composition
- Security: API keys stored server-side only, never exposed to client

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