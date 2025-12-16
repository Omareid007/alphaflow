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

### Phase 2: Orders vs Trades vs Fills Separation (G4 Fixed)
Added proper data model separation:

1. **New `orders` table** (22 fields): Stores broker order lifecycle with:
   - brokerOrderId, clientOrderId (unique indexes)
   - Full order parameters (symbol, side, type, qty, prices)
   - Status lifecycle (new, accepted, filled, canceled, etc.)
   - Links to ai_decisions, trades, work_items via foreign keys
   - rawJson for full Alpaca order snapshot

2. **New `fills` table** (12 fields): Stores execution confirmations with:
   - brokerOrderId, brokerFillId (unique)
   - orderId (FK to orders)
   - qty, price, occurredAt
   - traceId for full traceability

3. **Updated handlers**:
   - ORDER_SUBMIT upserts to orders table after Alpaca submission
   - ORDER_SYNC reconciles orders/fills from Alpaca

4. **New API endpoints**:
   - `GET /api/orders` - Orders from database with source metadata
   - `GET /api/orders/:id` - Single order with fills
   - `GET /api/fills` - All fills
   - `GET /api/fills/order/:orderId` - Fills for specific order
   - `POST /api/orders/sync` - Trigger manual sync

5. **Real-time Order Tracking**:
   - Alpaca WebSocket stream processes trade_updates in real-time
   - 5-minute periodic reconciler syncs orders/fills from Alpaca API
   - ON CONFLICT upsert handling prevents race conditions

6. **Order Ledger UI** (`client/components/OrdersTable.tsx`):
   - Displays full order lifecycle with broker status badges
   - Expandable rows show broker order ID and fills
   - Header always renders immediately (loading state inside container)
   - Uses explicit queryFn with getApiUrl() for native client support

See `docs/AUDIT_DOC_VS_IMPLEMENTATION_GAP.md` for full audit details.

### Phase 3: Universe & Allocation System (December 2025)
Comprehensive symbol universe management and portfolio allocation system:

1. **Symbol Universe Source (A)**: Alpaca `/v2/assets` as single source of truth with caching and tradability checks.

2. **Liquidity Infrastructure (B)**: 
   - `universe_liquidity_metrics` table with tier system (A/B/C/D)
   - Default thresholds: Tier A ($50M+ ADTV, $25B+ mktcap), Tier B ($10M+, $5B+)
   - Tier assignments based on volume and market cap metrics

3. **Fundamentals Scoring (C)**:
   - Finnhub connector for company fundamentals
   - Quality-Growth Score (50-point: revenue growth + margins) + Value-Risk Penalty (debt/leverage)
   - `universe_fundamentals` table stores metrics with TTL refresh

4. **Candidates Pipeline (D)**:
   - Status workflow: NEW → WATCHLIST → APPROVED/REJECTED
   - Admin approval required before auto-trading
   - `universe_candidates` table with audit trail (approvedBy, rejectedReason)

5. **Trading Enforcement**:
   - Central gate in work-queue `processOrderSubmit`
   - Blocks all orders for non-APPROVED symbols
   - Short-circuits before tradability check for efficiency

6. **Allocation Policy (E1)**:
   - `allocation_policies` table with admin-editable thresholds
   - Configurable: max position weight, sector weight, liquidity tier, profit-taking threshold

7. **Rebalancer Service (E2)**:
   - Portfolio analysis vs target allocations
   - Profit-taking detection (configurable threshold)
   - Rotation candidate selection from approved symbols
   - Order intents via work queue with enforcement gate
   - Safety: qty capped at position size, NaN validation, null-safe quotes

**API Endpoints**:
- `/api/admin/universe/*` - Universe management
- `/api/admin/liquidity/*` - Liquidity tiers and metrics
- `/api/admin/candidates/*` - Candidates workflow
- `/api/admin/allocation/*` - Policies and runs
- `/api/admin/rebalancer/*` - Rebalancer execution

**Key Files**: `server/universe/alpacaUniverse.ts`, `liquidityService.ts`, `fundamentalsService.ts`, `candidatesService.ts`, `tradingEnforcement.ts`, `allocationService.ts`, `rebalancerService.ts`

### Phase 4: Observability Module Enhancement (December 2025)
Comprehensive observability dashboard with OpenTelemetry integration and alerting:

1. **OpenTelemetry SDK** (`server/observability/otel.ts`):
   - OTLP HTTP exporter for traces (configurable Jaeger/Tempo endpoint)
   - Auto-instrumentation for HTTP, Express, PostgreSQL
   - TraceId propagation throughout request lifecycle

2. **Alert System**:
   - `alert_rules` table: Configurable threshold rules (dead_letter_count, llm_error_rate, orchestrator_stale, etc.)
   - `alert_events` table: Audit trail of triggered alerts with webhook delivery status
   - `alertService.ts`: Background evaluator running every 60s, Slack/webhook notifications

3. **Observability Admin Routes** (`/api/admin/observability/*`):
   - `GET /health` - Aggregated health: work queue counts, orchestrator status, LLM metrics
   - `GET /trace/:traceId` - Cross-entity trace lookup (decisions, trades, LLM calls, work items)
   - `GET /work-queue/items` - Work queue items with filtering
   - `POST /work-queue/items/:id/retry` - Retry failed items
   - `GET /alerts/rules` - List alert rules
   - `POST /alerts/rules/:id/toggle` - Enable/disable rules
   - `GET /alerts/events` - Alert event history

4. **Observability UI** (in AdminHubScreen.tsx):
   - Tabbed interface: Health | Traces | Queue | Alerts
   - Health tab: System health grid (Orchestrator, Kill Switch, Dead Letters, Pending Jobs), LLM Performance stats
   - Traces tab: TraceId search with cross-entity results
   - Queue tab: Work queue status, dead letters list, recent items
   - Alerts tab: Alert rules with toggle switches, event history

**Key Files**: `server/observability/otel.ts`, `server/observability/alertService.ts`, `server/observability/routes.ts`, `client/screens/AdminHubScreen.tsx`

### Phase 5: Admin Hub Consolidation (December 2025)
WordPress-style admin panel with 13 modules for complete system management:

1. **Admin Hub Structure** (`client/screens/AdminHubScreen.tsx`):
   - Fixed sidebar navigation with 13 modules
   - Responsive layout with collapsible sidebar for mobile
   - Top bar with current module indicator

2. **Admin Modules**:
   - **Overview**: Dashboard with connector health, data fusion status, API key summary
   - **Providers & Budgets**: API rate limits, cache statistics, budget tracking
   - **LLM Router**: Role configurations, fallback chains, call statistics
   - **Orders**: Full order lifecycle with status filters, broker order details, fills (Source: Alpaca)
   - **Positions**: Live portfolio positions from broker (Source: Alpaca)
   - **Universe**: Asset universe from Alpaca, tradability checks
   - **Fundamentals**: Company fundamental data from Finnhub
   - **Candidates**: Approval workflow for trading candidates (NEW → WATCHLIST → APPROVED/REJECTED)
   - **Enforcement**: Trading enforcement gate statistics
   - **Allocation**: Portfolio allocation policies
   - **Rebalancer**: Portfolio rebalancing controls
   - **Orchestrator**: Strategy orchestration with pause/resume/run-now controls
   - **Observability**: Traces, work queue, alerts (4 sub-tabs)

3. **Orders Module Features**:
   - Status filter buttons (All, New, Filled, Partially Filled, Canceled, Rejected)
   - Sync button to trigger manual order reconciliation from Alpaca
   - Expandable order rows showing broker order ID, trace ID, decision ID, fills
   - Real-time updates via 15-second polling
   - Source badge: "Source: Alpaca (Broker-synced)"

4. **Trace Timeline (Observability Module)**:
   - TraceTimelineView component for chronological Decision→Order→Fill chain
   - Expandable metadata cards with model, provider, cost, broker IDs
   - Status semantics: AI Decisions/Trade Intents use "info"/"pending" (never "success")
   - Broker Orders/Fills use "success"/"error" based on actual broker confirmation

5. **Source of Truth Badges**:
   - **AI Trade Intents** (Analytics screen): "Source: Internal AI Decisions" with hint to Orders tab
   - **Broker Orders** (Orders module): "Source: Alpaca (Broker-synced)" with timestamp
   - Clear semantic distinction: AI intents = what system decided, Broker orders = what happened

6. **Alpaca Trade Updates WebSocket** (`server/trading/alpaca-stream.ts`):
   - Real-time order lifecycle updates via WebSocket
   - Automatic reconnection with exponential backoff
   - Creates fill records for partial/full fills
   - Heartbeat monitoring for connection health

**Access**: Admin Hub accessible via dedicated Admin tab in bottom navigation (only visible for admin users)
**Default Admin**: username: `admintest`, password: `admin1234`
**Documentation**: See `docs/ADMIN_ACCESS.md` for complete access guide

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