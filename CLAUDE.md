# Claude Code Project Configuration

## Project Overview

Trading platform with autonomous strategy management, backtesting, and broker integrations (Alpaca). Futures trading (IBKR) is planned - see `docs/FUTURES_ROADMAP.md`.

## Codebase Metrics (as of Dec 29, 2024)

| Metric                 | Before   | After    | Savings       |
| ---------------------- | -------- | -------- | ------------- |
| Total Workspace        | 2.0 GB   | 1.9 GB   | 100 MB        |
| Source Code            | 535 MB   | 530 MB   | 5 MB          |
| TypeScript/React Files | 501      | 485      | 16 files      |
| Lines of Code          | ~154,138 | ~152,000 | ~2,000        |
| Dependencies           | 104      | 81       | 23 packages   |
| Static Assets          | 3.88 MB  | 400 KB   | 86% reduction |
| Security Vulns         | 8        | 4        | 4 fixed       |

## Cleanup Status

### Completed (Dec 29, 2024)

- [x] Alpaca account mismatch resolved (dotenv override)
- [x] MCP servers configured (initial 7 servers)
- [x] Analysis agents created (initial 4 agents)
- [x] Analysis commands created (initial 4 commands)
- [x] Safety hooks configured
- [x] `.next/` removed from Git tracking (471 files, ~26K lines)
- [x] Old maintenance scripts removed (9 files, 2774 lines)
- [x] Dependency audit completed
- [x] **Next.js upgraded 13.5.1 → 14.2.35** (critical security fix)
- [x] **attached_assets cleaned** (5.1MB → 984KB, 80% reduction)
- [x] Custom skills created (initial 3 skills)

### Phase 3 Cleanup Completed (Dec 29, 2024)

- [x] **Removed 23 unused packages** (104 → 81 dependencies)
- [x] **Removed 16 unused UI components** (accordion, carousel, drawer, form, etc.)
- [x] **Optimized icons** (2.9 MB → 400 KB, 86% reduction via Sharp)
- [x] **Removed unused @types** (@types/decimal.js, @types/p-limit, @types/p-retry, @types/cors)
- [x] **Removed dev screenshots** from attached_assets
- [x] **Installed code quality tools** (knip, sharp)
- [x] **Created image optimization script** (scripts/optimize-images.ts)
- [x] **Added new npm scripts** (clean:code, clean:deps, optimize:images)

### Phase 4 Enhancements (Dec 29, 2024)

- [x] **Added 4 finance MCP servers** (financial-datasets, alpaca-trading, alphavantage, polygon)
- [x] **Removed Docker MCP** (not functional in Replit)
- [x] **Created error boundaries** (`components/error-boundaries/`)
  - `RootErrorBoundary.tsx` - App-wide error catching
  - `ComponentErrorBoundary.tsx` - Granular component isolation
- [x] **Created validation middleware** (`server/middleware/validate.ts`)
- [x] **Removed futures stubs** (51 unimplemented methods)
- [x] **Created futures roadmap** (`docs/FUTURES_ROADMAP.md`)

### Phase 5: Product Discovery System (Dec 29, 2024)

- [x] **Created Product Analyst skill** with 6 subagents and 8 commands
- [x] **Created 8 product analysis commands** (discover-app, analyze-flows, audit-components, etc.)
- [x] **Created 6 product analysis agents** (app-discoverer, ui-analyst, flow-mapper, etc.)
- [x] **Fixed Alpaca MCP configuration** (changed to official alpaca-mcp package)
- [x] **Created comprehensive analysis documentation:**
  - 4 flow documents (backtesting, trading-execution, portfolio-management, admin-operations)
  - 3 gap analysis documents (type-safety, test-coverage, accessibility)
  - Component usage matrix (60+ components inventoried)
- [x] **Created feature specifications:**
  - `specs/features/email-notifications.md` - SendGrid integration
  - `specs/features/futures-trading.md` - IBKR integration plan
  - `specs/features/mobile-responsive.md` - Responsive design
- [x] **Created gap fix specifications:**
  - `specs/gaps/type-safety-fix.md` - 289 `:any` → <20
  - `specs/gaps/test-infrastructure.md` - <5% → 60% coverage
- [x] **Created enhancement proposals:**
  - `proposals/console-log-removal.md` - 7,758 console statements → structured logging
  - `proposals/type-safety-upgrade.md` - Type safety improvement
  - `proposals/test-coverage-plan.md` - Testing roadmap
- [x] **Created product documentation:**
  - `docs/MCP-API-KEYS.md` - API key guide for all MCP servers
  - `docs/product/FEATURE_MATRIX.md` - 54 complete, 15 partial, 10 planned features
  - `docs/product/USER_JOURNEYS.md` - Visual user flow documentation
  - `docs/api/OPENAPI_SPEC.yaml` - Full OpenAPI 3.0 specification

### Phase 6: Structured Logging (Dec 29, 2024)

- [x] **Installed Pino logging stack** (pino, pino-http, pino-pretty)
- [x] **Upgraded `server/utils/logger.ts`** to use Pino internally
- [x] **Migrated console.log statements** in server code to structured logger
- [x] **Added ESLint no-console rule** for server code enforcement
- [x] **Created module-specific child loggers** (trading, autonomous, ai, api, connector)
- [x] **Implemented automatic credential redaction** (API keys, passwords, tokens)

### Phase 7: Claude Code Enhancement (Dec 30, 2024)

- [x] **Created 6 new skills** (ai-llm-patterns, backtest-framework, market-analysis, npm-dependencies, project-structure, risk-management)
- [x] **Created 4 new agents** (dependency-auditor, change-impact-analyzer, architecture-reviewer, documentation-auditor)
- [x] **Created 4 new commands** (analyze-gap, list-todos, validate-types, check-mcp-status)
- [x] **Optimized MCP configuration** (removed 6 redundant servers, added Context7)
- [x] **Total inventory**: 9 skills, 13 agents, 9 commands, 18 MCP servers
- [x] **Added Context7 MCP** for real-time library documentation

### Phase 8-12: Infrastructure & Quality (Dec 30, 2024)

#### Phase 8: New MCP Servers

- [x] **Added Codacy MCP** for code quality and coverage metrics
- [x] **Added SendGrid MCP** for email notification workflows
- [x] **Total MCP servers**: 20 (18 + Codacy + SendGrid)

#### Phase 9: Test Coverage Infrastructure

- [x] **Extended Vitest coverage** to include `server/` and `shared/` directories
- [x] **Created server test templates** (notification-service.test.ts, email-service.test.ts)
- [x] **Test count**: 238 tests passing (14 test suites)

#### Phase 10: Email Notifications

- [x] **Installed @sendgrid/mail** for email delivery
- [x] **Created `server/lib/email-service.ts`** with SendGrid integration
- [x] **Implemented email channel** in notification-service.ts (was stub)
- [x] **Enabled email in routes** (removed 400 error block)
- [x] **Features**: sendEmail(), sendTradeAlert(), isEmailConfigured()

#### Phase 11: Type Safety Improvements

- [x] **Fixed `server/lib/standard-errors.ts`**: 17 `:any` → 0
  - Added ErrorDetails, ZodIssue, ZodErrorLike, HttpError interfaces
  - Added type guards: isZodError(), isHttpError()
  - Updated asyncHandler with proper Express types
- [x] **Fixed `server/trading/order-retry-handler.ts`**: 22 `as any` → 0
  - Added OrderType, TimeInForce type definitions
  - Created toOrderType(), toTimeInForce() helper functions
  - Updated all rejection handlers with proper type assertions

#### Phase 12: Documentation

- [x] **Updated CLAUDE.md** with Phase 8-12 enhancements
- [x] **Created email-notifications skill** (`~/.claude/skills/email-notifications.md`)

### Phase 13: Claude Code Enhancement v2 (Dec 30, 2024)

#### New Skills (4 files in `~/.claude/skills/`)

- [x] **refactoring-strategies.md** - Extract Method, Extract Class, DI patterns
- [x] **api-documentation.md** - OpenAPI 3.0 generation from Express routes
- [x] **database-migrations.md** - Drizzle ORM migration patterns, rollback
- [x] **security-scanning.md** - SAST, secrets detection, OWASP compliance

#### New Agents (5 files in `~/.claude/agents/`)

- [x] **code-refactoring-planner.md** - Analyze refactoring opportunities
- [x] **api-documentation-generator.md** - Discover routes, generate OpenAPI
- [x] **test-coverage-analyzer.md** - Parse coverage, identify gaps
- [x] **migration-analyzer.md** - Schema diff, safe migrations
- [x] **vulnerability-tracker.md** - CVE tracking, npm audit, remediation

#### New Commands (5 files in `~/.claude/commands/`)

- [x] **refactor-analyze.md** - Find god objects, duplicates, type issues
- [x] **generate-api-docs.md** - Generate OpenAPI from Express routes
- [x] **analyze-coverage.md** - Test coverage gap analysis
- [x] **generate-migration.md** - Database migration generation
- [x] **security-scan.md** - Comprehensive security analysis

#### New MCP Servers (2 additions)

- [x] **vitest** - AI-optimized test runner via `@djankies/vitest-mcp`
- [x] **openapi** - API specification interaction via `@ivotoby/openapi-mcp-server`

#### Updated Totals

- **MCP Servers**: 22 (20 + vitest + openapi)
- **Skills**: 14 (10 + 4 new)
- **Custom Agents**: 5 (in `~/.claude/agents/`)
- **Custom Commands**: 14 (9 + 5 new)

### Phase 14: MCP Expansion & Type Safety (Dec 30, 2024)

#### New MCP Servers

- [x] **yfinance** - Free Yahoo Finance market data via `@mokemokechicken/yfinance-mcp-server`
- [x] **redis** - High-speed caching via `@gongrzhe/server-redis-mcp`
- [x] **Total MCP servers**: 24 (22 + yfinance + redis)

#### Documentation Created

- [x] **docs/SKILLS_GUIDE.md** - Complete guide to 14 skills
- [x] **docs/AGENTS_GUIDE.md** - Guide to 5 custom agents + Task subagents
- [x] **docs/COMMANDS_REFERENCE.md** - Reference for all 14 commands

#### Type Safety Improvements

- [x] **Fixed `server/middleware/audit-logger.ts`**: 11 `:any` → 0
  - Added JsonObject, SanitizedBody, ResponseBody, ErrorResponseBody types
  - Added ErrorWithMessage interface for error handling
  - Updated all filter callbacks with proper AuditLog type
- [x] **Fixed `server/admin/global-search.ts`**: 5 `:any` → 0
  - Imported AiDecision, Trade, Order, Fill, LlmCall types
  - Updated getRelatedEntities return type
- [x] **Fixed `server/routes/alpaca.ts`**: 7 `:any` → 0
  - Added AlpacaOrderParams interface
  - Updated all error handlers with ErrorWithMessage type
- [x] **Type safety reduction**: 82 → 59 `:any` annotations (28% improvement)

### Phase 15: Security & Testing (Dec 30, 2024)

#### Security Improvements

- [x] **Added helmet security headers** to `server/index.ts`
  - Content-Security-Policy with strict directives
  - X-Content-Type-Options, X-Frame-Options, HSTS
  - Cross-Origin Resource Policy configured
- [x] **Added rate limiting to auth routes** via `express-rate-limit`
  - 5 attempts per 15-minute window per IP
  - Applied to `/api/auth/login` and `/api/auth/signup`
  - Structured logging on rate limit exceeded
- [x] **Created comprehensive security audit report**
  - `analysis/security/security-audit-report.md`
  - OWASP Top 10 compliance matrix (9/10 passing)
  - Dependency vulnerability analysis (7 total, 3 high)
  - Remediation plan with priorities

#### Test Coverage Expansion

- [x] **Created 32 tests for `server/connectors/alpaca.ts`**
  - Account, positions, orders CRUD operations
  - Order validation (symbol, qty, prices)
  - Bracket, OCO, OTO, trailing stop orders
  - Cache management and circuit breaker tests
  - Market clock and session detection
- [x] **Created 48 tests for `server/trading/order-execution-flow.ts`**
  - Error classification (8 error types with recovery strategies)
  - Order validation (schema, tradability, price, type/TIF combinations)
  - Order execution (retries, partial fills, cancellations)
  - Expected vs actual outcome analysis (slippage, fill times)
  - Recovery strategies (CHECK_AND_SYNC, ADJUST_AND_RETRY, WAIT_FOR_MARKET_OPEN)
  - Order book cleanup (identify/cleanup unreal orders, reconciliation)
  - Shared order helpers (waitForAlpacaOrderFill, cancelExpiredOrders)
- [x] **Total tests increased**: 206 → 238 → 286 (39% overall increase)

#### Updated Metrics

- **OWASP Compliance**: 9/10 categories passing
- **Security Risk**: Reduced from MEDIUM to LOW-MEDIUM
- **Test Files**: 15 passing test suites

### Phase 16: High-Severity Vulnerability Fix (Dec 30, 2024)

#### CVE-2025-64756 / GHSA-5j98-mcp5-4vw2 - glob Command Injection

- [x] **Researched vulnerability** using parallel agents and web search
  - Affects glob@10.2.0 - 10.4.5 CLI `-c/--cmd` option
  - Command injection via shell metacharacters in filenames
  - Library API (used by eslint-config-next) is NOT affected
- [x] **Applied npm overrides fix** in `package.json`:
  ```json
  "overrides": {
    "glob": "10.5.0"
  }
  ```
- [x] **Fixed ESLint configuration**
  - Removed `eslint.config.js` (incorrectly referenced eslint-config-expo)
  - Updated `.eslintrc.json` with no-console rule for server code
- [x] **Updated security audit report** at `analysis/security/security-audit-report.md`

#### Vulnerability Status Change

| Severity  | Before | After | Change |
| --------- | ------ | ----- | ------ |
| Critical  | 0      | 0     | -      |
| High      | 3      | **0** | ✅ -3  |
| Moderate  | 4      | 4     | -      |
| **Total** | **7**  | **4** | **-3** |

#### Remaining Vulnerabilities (Moderate, Dev-only)

- 4x esbuild vulnerabilities via drizzle-kit
- Only affects development environment
- Not exploitable in production
- Waiting for upstream drizzle-kit update

### Phase 17: Trading-Specific Claude Code Features (Dec 30, 2024)

#### Trading Automation Hooks

- [x] **Added PostToolUse hook** for auto-formatting TypeScript after edits
  - Runs Prettier on `.ts` and `.tsx` files after Edit/Write operations
  - Configured in `.claude/settings.local.json`

#### Trading-Specific Agents (3 files in `~/.claude/agents/`)

- [x] **trade-analyzer.md** - Performance analysis, Sharpe ratio, win rate calculation
  - Uses mcp**postgres**query for trade history
  - Uses mcp\_\_yfinance for market data comparison
  - Provides actionable recommendations
- [x] **risk-monitor.md** - Portfolio risk monitoring, position limits
  - Enforces 5% max position, 25% sector exposure limits
  - Real-time concentration and correlation analysis
  - Pre-trade validation checklist
- [x] **order-debugger.md** - Order execution debugging, 422 error analysis
  - Timeline reconstruction for failed orders
  - Circuit breaker status checking
  - Root cause analysis for common errors

#### Trading-Specific Skills (2 directories in `~/.claude/skills/`)

- [x] **order-execution/SKILL.md** - Safe order execution workflow
  - Pre-trade validation (market hours, symbol, position size)
  - Order placement with proper client_order_id generation
  - Post-trade verification and error recovery
- [x] **backtest-analysis/SKILL.md** - Backtest result analysis
  - Key metrics (Sharpe, Sortino, Calmar, drawdown)
  - Calculation functions with TypeScript examples
  - Walk-forward validation and red flag detection

#### Trading Commands (3 files in `~/.claude/commands/`)

- [x] **/market-status** - Check market hours, trading eligibility
- [x] **/portfolio-health** - Quick portfolio health check with risk metrics
- [x] **/debug-order** - Debug specific order by ID

#### Updated Totals

- **Skills**: 16 (14 + 2 trading-specific)
- **Custom Agents**: 8 (5 + 3 trading-specific)
- **Custom Commands**: 17 (14 + 3 trading-specific)
- **Hooks**: 1 (PostToolUse for auto-formatting)

### Phase 18: Advanced Claude Code Integration (Dec 30, 2024)

#### Advanced Hooks System

- [x] **5 hooks configured** in `.claude/settings.local.json`:
  - `PreToolUse` - Order validation before Bash commands
  - `PostToolUse` - Auto-format TypeScript after Edit/Write
  - `UserPromptSubmit` - Market context injection
  - `SessionStart` - Portfolio and market initialization
  - `Stop` - Session cleanup and summary

#### Custom Trading MCP Server

- [x] **Created `mcp-servers/trading-utilities/`** package
  - Full MCP server implementation using @modelcontextprotocol/sdk
  - 5 trading-specific tools:
    | Tool | Purpose |
    |------|---------|
    | `check_portfolio_risk` | Calculate VaR, concentration, sector exposure |
    | `validate_order` | Pre-trade validation against risk limits |
    | `get_live_positions` | Current positions with P&L |
    | `market_status` | Market clock, next open/close |
    | `check_circuit_breaker` | Circuit breaker state |
  - Risk thresholds: 5% position, 25% sector, 5% daily drawdown
  - Registered in `.mcp.json` with environment variables

#### Background Portfolio Monitoring

- [x] **Created `~/.claude/agents/background-portfolio-monitor.md`**
  - Continuous surveillance agent definition
  - 60-second check interval
  - Multi-threshold alert system
- [x] **Created `/home/runner/workspace/scripts/background-monitor.ts`**
  - Polls positions continuously
  - Checks concentration, sector exposure, drawdown
  - Slack webhook integration for alerts

#### Helper Scripts for Hooks

- [x] **`scripts/validate-trading-command.sh`** - Pre-trade validation
- [x] **`scripts/inject-market-context.sh`** - Market context for prompts
- [x] **`scripts/session-init.sh`** - Session initialization
- [x] **`scripts/session-cleanup.sh`** - Session cleanup and logging

#### Updated Totals

| Component       | Before | After                                 |
| --------------- | ------ | ------------------------------------- |
| MCP Servers     | 24     | **25** (+trading-utilities)           |
| Skills          | 16     | 16                                    |
| Custom Agents   | 8      | **9** (+background-portfolio-monitor) |
| Custom Commands | 17     | 17                                    |
| Hooks           | 1      | **5**                                 |

### Phase 19: Strategy Execution Integration (Dec 30, 2024)

#### Phase 7: System Integration (COMPLETED)

- [x] **Task 7.1**: Activated exit rule enforcer in `server/index.ts`
  - Added import and startup call for exitRuleEnforcer
  - 30-second check interval for stop-loss/take-profit enforcement
  - Added graceful shutdown handler
- [x] **Task 7.2**: Exported missing hooks in `lib/api/hooks/index.ts`
  - useStrategyOrders, useExecutionContext, useExecuteStrategyOrder
  - useCloseStrategyPosition, usePreviewPositionSize
  - StrategyOrder, StrategyExecutionContext types
- [x] **Task 7.3**: Added Execution tab to `app/strategies/[id]/page.tsx`
  - StrategyExecutionDashboard component integration
  - Default tab set based on strategy status (paper/live → Execution)
- [x] **Task 7.4**: Linked positions to strategies in `app/portfolio/page.tsx`
  - Positions grouped by strategyId
  - "View Strategy" links for each position group

#### Phase 8: MCP Enhancement (COMPLETED)

- [x] **Task 8.1**: Added 3 strategy monitoring tools to `trading-utilities` MCP server
      | Tool | Input | Output |
      |------|-------|--------|
      | `get_strategy_status` | strategyId | Execution state, recent signals/orders, exit rules |
      | `get_strategy_performance` | strategyId, periodDays | Sharpe, Sortino, drawdown, win rate, profit factor |
      | `debug_order_execution` | orderId | Timeline, failure analysis, fill details, slippage |
- [x] **Task 8.2**: Created `~/.claude/skills/strategy-monitoring.md`
  - MCP tool documentation with inputs/outputs
  - Monitoring workflows (daily check, performance review, order debugging)
  - Red flags and common issues with solutions
- [x] **Task 8.3**: Created `~/.claude/agents/strategy-execution-monitor.md`
  - 6-step workflow for strategy health monitoring
  - Alert thresholds (Critical/Warning/Info levels)
  - Integration points with MCP tools and database queries

#### Phase 9: Documentation & Testing (COMPLETED)

- [x] **Task 9.1**: Updated CLAUDE.md with Phase 7-9 status
- [x] **Task 9.2**: Added integration tests for strategy execution flow
  - `tests/integration/strategy-execution-integration.test.ts` (48 tests)
  - Tests: State transitions, exit rules, performance metrics, order tracking

#### New MCP Tools Added (trading-utilities server)

| Tool                       | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `get_strategy_status`      | Strategy execution state, signals, orders, exit rules     |
| `get_strategy_performance` | Performance metrics (Sharpe, Sortino, win rate, drawdown) |
| `debug_order_execution`    | Order timeline, failure analysis, slippage calculation    |

#### New Types Added (`mcp-servers/trading-utilities/src/types.ts`)

- `StrategyStatus` - Execution state, recent signals/orders, exit rules
- `StrategyPerformance` - Metrics, benchmark comparison, recent trades
- `OrderDebugInfo` - Timeline, execution details, failure analysis
- `AlpacaOrder` - Full Alpaca order response type

#### Updated Totals (Phase 19)

| Component        | Before | After                                |
| ---------------- | ------ | ------------------------------------ |
| MCP Server Tools | 5      | **8** (+3 strategy tools)            |
| Skills           | 16     | **17** (+strategy-monitoring)        |
| Custom Agents    | 9      | **10** (+strategy-execution-monitor) |

### Phase 20: Missing Routes & Type Safety (Dec 30, 2024)

#### New API Routes Created

- [x] **`server/routes/candidates.ts`** - Stock candidate screening API
  - `GET /api/candidates` - List candidates with status filter
  - `GET /api/candidates/stats` - Candidate statistics
  - `GET /api/candidates/:symbol` - Get specific candidate
  - `POST /api/candidates/generate` - Trigger candidate generation
  - `POST /api/candidates/:symbol/approve` - Approve candidate
  - `POST /api/candidates/:symbol/reject` - Reject candidate
  - `POST /api/candidates/:symbol/watchlist` - Add to watchlist
  - `POST /api/candidates/bulk-approve` - Bulk approve candidates
  - `POST /api/candidates/bulk-reject` - Bulk reject candidates
- [x] **`server/routes/settings.ts`** - User settings API
  - `GET /api/settings` - Get user settings (theme, notifications, risk guardrails)
  - `PUT /api/settings` - Update user settings with deep merge
  - Uses adminSettings table with per-user namespace pattern
- [x] **Updated `/api/ai/sentiment`** in `server/routes/ai-analysis.ts`
  - Replaced mock data with real `sentimentAggregator.batchGetSentiment()`
  - Transforms -1 to 1 score range to -100 to 100 for frontend

#### Type Safety Improvements

- [x] **Fixed `server/routes/notifications.ts`** - Redact channel config types
  - Created `RedactedChannelResponse` interface
  - Updated `redactChannelConfig()` to accept `NotificationChannel` directly
  - Proper type handling for union config types (Telegram, Slack, Discord, Email)

#### Admin Pages Verified (Already Implemented)

- [x] **`app/admin/competition/page.tsx`** (827 lines)
  - Trader profiles tab with create/edit dialogs
  - Competition runs tab with create dialog
  - Leaderboard tab with statistics
  - Full integration with `useCompetition` hooks
- [x] **`app/admin/fundamentals/page.tsx`** (876 lines)
  - Symbol lookup with search
  - Factor catalog with category filtering
  - Stats cards for factor health
  - Full integration with `useFundamentalFactors` hooks
- [x] **`app/admin/strategies/page.tsx`** (1,274 lines)
  - Statistics cards (total, live, paper, paused, stopped)
  - Search and status filtering
  - Strategy table with CRUD operations
  - Deploy, pause, resume, stop dialogs
  - Version management panel
  - Edit and delete confirmation dialogs

#### Routes Registered in `server/routes.ts`

```typescript
app.use("/api/candidates", authMiddleware, candidatesRouter);
app.use("/api/settings", authMiddleware, settingsRouter);
```

### Phase 21: AI Client Type Safety (Dec 30, 2024)

#### Type Safety Improvements - AI Clients

- [x] **Fixed `server/ai/claudeClient.ts`**
  - Added proper `LLMClientError` type guard for error re-throwing
  - Replaced `(error as any).provider` with proper type checking
- [x] **Fixed `server/ai/huggingfaceClient.ts`**
  - Added `UsageInfo` interface for token usage tracking
  - Changed `requestBody: any` to `HuggingFaceTextGenRequest | HuggingFaceChatRequest`
  - Changed `usage: any` to `UsageInfo`
- [x] **Fixed `server/ai/llmGateway.ts`**
  - Added `LLMClient` import
  - Changed `client: any` to `client: LLMClient` in PROVIDER_CLIENTS
- [x] **Fixed `server/ai/roleBasedRouter.ts`**
  - Added `LLMClient` import
  - Changed `client: any` to `client: LLMClient` in PROVIDER_CLIENTS
  - Added proper type handling for `tokensUsed` union type (number | object)

#### Type Safety Metrics

| Metric                 | Before | After | Improvement   |
| ---------------------- | ------ | ----- | ------------- |
| Server `:any` count    | 59     | 24    | 59% reduction |
| AI client `:any` count | 5      | 0     | 100% fixed    |

### Phase 22: Quick Win Integrations & Product Planning (Dec 31, 2024)

#### Product Management Deliverables

- [x] **Created comprehensive product roadmap** (`docs/product/PRODUCT_ROADMAP_2025.md`)
  - 4-phase implementation plan (550 hours total)
  - Phase 1 (P0): 78 hours - Critical fixes
  - Phase 2 (P1): 252 hours - Core features
  - Phase 3 (P2): 148 hours - UX enhancements
  - Phase 4 (P3): 72 hours - Polish & documentation
- [x] **Created Password Reset BRD** (`docs/product/BRD_PASSWORD_RESET.md`)
  - Database schema, API endpoints, email templates
  - 16 tests required (8 unit, 6 integration, 2 E2E)
  - 8-hour implementation plan
- [x] **Created Real-Time Data BRD** (`docs/product/BRD_REALTIME_DATA.md`)
  - SSE architecture, connection management
  - useSSE hook design (150 lines)
  - 35 tests required (20 unit, 10 integration, 5 E2E)
  - 24-hour implementation plan
- [x] **Created Execution Plan** (`docs/EXECUTION_PLAN_SONNET_1M.md`)
  - 5,000+ lines of detailed implementation steps
  - Pre-flight checklist, file modification matrix
  - Testing strategy, deployment checklist
  - Monitoring & rollback plan

#### Quick Win Integrations (Dec 31, 2024)

- [x] **Installed ioredis** (Redis client library for Node.js)
  - High-performance caching layer
  - 9 new dependencies added
- [x] **Added Finnhub MCP server** to `.mcp.json`
  - Real-time quotes, fundamentals, news
  - 60 API calls/min free tier
  - Uses `uvx mcp-finnhub` Python package
- [x] **Created Redis caching service** (`server/lib/redis-cache.ts`)
  - 300+ lines of production-ready caching
  - TTL-based expiration (quotes: 1min, fundamentals: 1hr)
  - Automatic connection management with health checks
  - Graceful degradation when Redis unavailable
  - Rate limiting counter support
  - Cache statistics and monitoring
- [x] **Created Integration Setup Guide** (`docs/INTEGRATION_SETUP_GUIDE.md`)
  - 26 MCP servers documented
  - 15 direct API integrations documented
  - Step-by-step setup instructions
  - Free tier limits and costs
  - Testing & troubleshooting guides

#### MCP Server Configuration

- **Total MCP servers**: 26 (25 + Finnhub)
- **Active (no API key required)**: 13 servers
- **Needs API key**: 13 servers
- **Quick Win priorities**:
  - 🔥 Finnhub (60 calls/min free) - Real-time quotes
  - 🔥 AlphaVantage (500 calls/day free) - Fundamentals
  - 🔥 GitHub (unlimited free) - Repository operations
  - 🔥 Slack (unlimited free) - Trade alerts
  - 🔥 Redis (self-hosted free) - Caching

#### Integration Status Update

| Integration  | Status       | Free Tier      | Value             |
| ------------ | ------------ | -------------- | ----------------- |
| Finnhub      | 🔑 Needs Key | 60 calls/min   | Market data       |
| AlphaVantage | 🔑 Needs Key | 500 calls/day  | Fundamentals      |
| GitHub       | 🔑 Needs Key | ✅ Unlimited   | CI/CD automation  |
| Slack        | 🔑 Needs Key | ✅ Unlimited   | Real-time alerts  |
| Redis        | 🔑 Needs Key | ✅ Self-hosted | 5-10x performance |

**Expected Impact**: 5-10x faster API responses, 90% fewer external API calls, $0/month cost

### Remaining Items (Future)

| Item                          | Priority | Notes                                      |
| ----------------------------- | -------- | ------------------------------------------ |
| Backtest script consolidation | Low      | 14 scripts (~8K lines) remaining           |
| Type safety upgrade           | P3       | 24 `:any` remaining (down from 82)         |
| Test coverage expansion       | P1       | Continue adding server tests               |
| esbuild vulnerabilities       | Low      | 4 moderate, dev-only, wait for drizzle-kit |
| Password reset flow           | P1       | Auth endpoints need completion             |
| Missing flow documentation    | P2       | Dashboard, AI Pulse, Research flows        |

## Security Status

### Fixed (Dec 29-30, 2024)

| CVE                 | Severity | Description                                | Fix Method                |
| ------------------- | -------- | ------------------------------------------ | ------------------------- |
| CVE-2025-29927      | Critical | Next.js Middleware Authorization Bypass    | Next.js 14.2.35           |
| CVE-2025-55184      | High     | Next.js DoS via infinite loop              | Next.js 14.2.35           |
| CVE-2025-55183      | Medium   | Next.js Source Code Exposure               | Next.js 14.2.35           |
| CVE-2025-64756      | High     | glob CLI Command Injection                 | npm overrides glob@10.5.0 |
| GHSA-5j98-mcp5-4vw2 | High     | glob CLI Command Injection (same as above) | npm overrides glob@10.5.0 |

### Remaining (Moderate, Dev-only)

| Package                 | Severity | Impact   | Notes                              |
| ----------------------- | -------- | -------- | ---------------------------------- |
| esbuild                 | Moderate | Dev only | Via drizzle-kit, wait for upstream |
| @esbuild-kit/core-utils | Moderate | Dev only | Deprecated, merged into tsx        |
| @esbuild-kit/esm-loader | Moderate | Dev only | Deprecated, merged into tsx        |

**Production Impact:** None - all remaining vulnerabilities are in development dependencies only.

## MCP Servers

Configured in `.mcp.json` (26 servers total, updated Dec 31, 2024):

### Core Servers (No API Key Required)

| Server                | Purpose                         |
| --------------------- | ------------------------------- |
| `postgres`            | Database queries                |
| `sequential-thinking` | Complex problem-solving         |
| `memory`              | Persistent knowledge graph      |
| `filesystem`          | Secure file operations          |
| `git`                 | Git repository operations       |
| `context7`            | Real-time library documentation |
| `ts-morph`            | TypeScript AST refactoring      |
| `playwright`          | Browser automation, E2E testing |
| `vitest`              | AI-optimized test runner        |
| `openapi`             | API specification interaction   |
| `yfinance`            | Yahoo Finance data (free)       |
| `coingecko`           | Cryptocurrency data (free)      |

### Custom MCP Server (Local)

| Server              | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `trading-utilities` | Portfolio risk, order validation, positions |

### API Key Required (Configure When Available)

| Server         | Purpose                       | Env Variable                       |
| -------------- | ----------------------------- | ---------------------------------- |
| `github`       | Repository operations, issues | `GITHUB_PERSONAL_ACCESS_TOKEN`     |
| `slack`        | Trade alerts, notifications   | `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID` |
| `brave-search` | Privacy-focused web search    | `BRAVE_API_KEY`                    |
| `exa`          | AI-powered web search         | `EXA_API_KEY`                      |
| `redis`        | Caching, performance          | `REDIS_HOST`, `REDIS_PORT`         |
| `sendgrid`     | Email notifications           | `SENDGRID_API_KEY`                 |
| `codacy`       | Code quality metrics          | `CODACY_ACCOUNT_TOKEN`             |

### Finance-Specific MCP Servers

| Server               | Purpose                                    | Env Variable                          |
| -------------------- | ------------------------------------------ | ------------------------------------- |
| `finnhub`            | Real-time quotes, fundamentals, news (NEW) | `FINNHUB_API_KEY`                     |
| `financial-datasets` | Income statements, balance sheets, prices  | `FINANCIAL_DATASETS_API_KEY`          |
| `alpaca-trading`     | Direct MCP trading via Alpaca              | `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` |
| `alphavantage`       | 100+ financial APIs, fundamentals          | `ALPHAVANTAGE_API_KEY`                |
| `polygon`            | Real-time market data, options             | `POLYGON_API_KEY`                     |
| `octagon`            | SEC filings, financial research            | `OCTAGON_API_KEY`                     |

### Removed Servers (Dec 30, 2024)

- `puppeteer` (redundant with playwright)
- `sqlite` (using PostgreSQL)
- `fetch` (built-in capabilities)
- `time` (trivial)
- `sentry` (requires OAuth)
- `stripe` (not needed)

## Custom Skills (16 total)

Located in `~/.claude/skills/`:
| Skill | Purpose |
|-------|---------|
| `trading-platform` | Broker integration, trade execution |
| `typescript-patterns` | Type safety, async patterns |
| `testing-patterns` | Unit/integration/E2E testing |
| `ai-llm-patterns` | LLM Gateway, 9-provider fallbacks |
| `backtest-framework` | Shared modules, genetic algorithms |
| `market-analysis` | Indicators, regime detection |
| `npm-dependencies` | Dependency auditing, security |
| `project-structure` | Codebase navigation, imports |
| `risk-management` | Position sizing, pre-trade validation |
| `email-notifications` | SendGrid integration, trade alerts |
| `refactoring-strategies` | Extract Method, DI patterns |
| `api-documentation` | OpenAPI 3.0 generation |
| `database-migrations` | Drizzle ORM migrations |
| `security-scanning` | SAST, OWASP compliance |
| `order-execution` | Safe order execution workflow (NEW) |
| `backtest-analysis` | Backtest result analysis (NEW) |

## Product Analysis System

PM & UI/UX discovery system using specialized agents and commands (listed in Available Analysis Tools section).

### Analysis Output Directories

| Directory      | Contents                                             |
| -------------- | ---------------------------------------------------- |
| `./analysis/`  | Discovery results, gap analysis, component inventory |
| `./specs/`     | Feature specifications, gap fix specs                |
| `./proposals/` | Enhancement plans, upgrade proposals                 |
| `./docs/`      | Product documentation, API specs                     |

## Backtest Script Migration (Dec 29, 2024)

### Completed Migrations

| Script                       | Before | After | Savings |
| ---------------------------- | ------ | ----- | ------- |
| omar-backtest.ts             | 779    | 247   | 68%     |
| omar-momentum-optimizer.ts   | 805    | 669   | 17%     |
| omar-hyperoptimizer.ts       | 957    | 682   | 29%     |
| omar-backtest-enhanced.ts    | 1,565  | 731   | 53%     |
| omar-weight-optimizer.ts     | 1,335  | 853   | 36%     |
| omar-ultra-hyperoptimizer.ts | 1,843  | 865   | 53%     |

**Total: 3,237 lines saved (44% average reduction)**

### Shared Modules Created

Located in `scripts/shared/`:

- `types.ts` - AlpacaBar, BacktestConfig, Trade, Genome, ParamRange
- `alpaca-api.ts` - fetchAlpacaBars, fetchHistoricalData, SYMBOL_LISTS
- `technical-indicators.ts` - 16 indicators (RSI, SMA, EMA, ATR, MACD, BB, etc.)
- `backtest-engine.ts` - runBacktest, calculateMetrics, generateSignal
- `genetic-algorithm.ts` - crossover, mutate, tournamentSelect, normalizeWeights

### Remaining Scripts (Lower Priority)

14 scripts (~8,000 lines) can use same migration pattern when needed

## Environment Configuration

### Critical: Alpaca Credentials

The `.env` file takes precedence over Replit Secrets via `dotenv.config({ override: true })`.

Verify with: `GET /api/admin/alpaca-account`

## Structured Logging

### Overview

The platform uses **Pino** for high-performance structured JSON logging with automatic credential redaction.

### Usage

```typescript
import { log } from "../utils/logger";

// Standard logging (backward compatible API)
log.info("Trading", "Order placed", { symbol: "AAPL", quantity: 100 });
log.warn("Alpaca", "Rate limit approaching", { remaining: 5 });
log.error("AI", "Provider failed", { provider: "openai", error });

// Module-specific loggers (direct Pino child loggers)
import { tradingLogger, autonomousLogger, aiLogger } from "../utils/logger";

tradingLogger.info({ symbol: "AAPL", price: 150.25 }, "Position opened");
autonomousLogger.debug({ cycleId: "cyc-abc123" }, "Cycle started");
```

### Features

| Feature         | Description                                               |
| --------------- | --------------------------------------------------------- |
| JSON output     | Production logs are structured JSON for log aggregation   |
| Pretty printing | Development logs are colorized and human-readable         |
| Auto-redaction  | API keys, passwords, tokens automatically censored        |
| Correlation IDs | Request/cycle IDs for distributed tracing                 |
| Module loggers  | Child loggers for trading, autonomous, ai, api, connector |

### Automatic Redaction

These fields are automatically redacted to `[REDACTED]`:

- `alpacaApiKey`, `alpacaSecretKey`, `apiKey`, `secretKey`
- `password`, `token`, `accessToken`, `refreshToken`
- `authorization`, `cookie`, `session`, `jwt`
- Nested patterns: `*.apiKey`, `*.password`, `body.token`

### ESLint Enforcement

The `no-console` rule is enabled for `server/**/*.ts` files. Use the structured logger instead:

```typescript
// ❌ Bad - will trigger ESLint warning
console.log("Order placed:", orderId);

// ✅ Good - use structured logger
log.info("Trading", "Order placed", { orderId });
```

## Available Analysis Tools

### Commands (17 total, use with `/`)

| Command               | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `/analyze-project`    | Full project analysis                                        |
| `/health-check`       | Quick project health check                                   |
| `/find-issues`        | Find all issues in code                                      |
| `/generate-spec`      | Generate documentation/specs                                 |
| `/generate-tests`     | Auto-generate tests from code                                |
| `/analyze-gap`        | Deep-dive gap analysis (type-safety, testing, accessibility) |
| `/list-todos`         | Extract TODO/FIXME/HACK comments                             |
| `/validate-types`     | TypeScript strict validation, `:any` detection               |
| `/check-mcp-status`   | Verify MCP server configurations                             |
| `/refactor-analyze`   | Find god objects, duplicates, type issues                    |
| `/generate-api-docs`  | Generate OpenAPI from Express routes                         |
| `/analyze-coverage`   | Test coverage gap analysis                                   |
| `/generate-migration` | Database migration generation                                |
| `/security-scan`      | Comprehensive security analysis                              |
| `/market-status`      | Check market hours, trading eligibility (NEW)                |
| `/portfolio-health`   | Quick portfolio health check with risk metrics (NEW)         |
| `/debug-order`        | Debug specific order by ID (NEW)                             |

### Task Tool Subagents (via Task tool)

| Subagent Type       | Category      | Purpose                             |
| ------------------- | ------------- | ----------------------------------- |
| `general-purpose`   | utility       | Multi-step tasks, code search       |
| `Explore`           | discovery     | Codebase exploration, file patterns |
| `Plan`              | planning      | Implementation planning             |
| `claude-code-guide` | documentation | Claude Code/SDK documentation       |

### Custom Agents (9 files in `~/.claude/agents/`)

| Agent                          | Purpose                                 |
| ------------------------------ | --------------------------------------- |
| `code-refactoring-planner`     | Analyze refactoring opportunities       |
| `api-documentation-generator`  | Discover routes, generate OpenAPI       |
| `test-coverage-analyzer`       | Parse coverage, identify gaps           |
| `migration-analyzer`           | Schema diff, safe migrations            |
| `vulnerability-tracker`        | CVE tracking, npm audit, remediation    |
| `trade-analyzer`               | Trading performance analysis            |
| `risk-monitor`                 | Portfolio risk monitoring               |
| `order-debugger`               | Order execution debugging               |
| `background-portfolio-monitor` | Continuous portfolio surveillance (NEW) |

## Non-Destructive Operation Rules

1. **Always create backup branch** before destructive operations
2. **Use `git rm --cached`** to untrack files without deleting locally
3. **Archive before delete** for assets and documentation
4. **Run tests** after each cleanup phase
5. **Commit frequently** with clear messages

## Quick Commands

```bash
# Build and test
npm run build
npm run lint
npx tsc --noEmit

# Security audit
npm audit

# Code quality (new)
npm run clean:code      # Run knip for unused code detection
npm run clean:deps      # Run depcheck for unused dependencies
npm run optimize:images # Optimize PNG icons with Sharp

# Dependency check
npx depcheck --json > /tmp/depcheck.json

# Find large files
find . -type f -size +1M -not -path "./.next/*" -not -path "./node_modules/*" | xargs ls -lh

# Check bundle sizes
npx bundle-phobia-cli [package-name]
```

## Documentation Structure

### Analysis Documents

| Directory              | Contents                                                         |
| ---------------------- | ---------------------------------------------------------------- |
| `analysis/flows/`      | User flow documentation (backtesting, trading, portfolio, admin) |
| `analysis/gaps/`       | Gap analysis (type-safety, test-coverage, accessibility)         |
| `analysis/components/` | Component usage matrix                                           |

### Specifications

| Directory         | Contents                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| `specs/features/` | Feature specs (email-notifications, futures-trading, mobile-responsive) |
| `specs/gaps/`     | Gap fix specs (type-safety-fix, test-infrastructure)                    |

### Proposals

| Directory    | Contents                                                                             |
| ------------ | ------------------------------------------------------------------------------------ |
| `proposals/` | Enhancement proposals (console-log-removal, type-safety-upgrade, test-coverage-plan) |

### Product Documentation

| Directory       | Contents                            |
| --------------- | ----------------------------------- |
| `docs/product/` | Feature matrix, user journeys       |
| `docs/api/`     | OpenAPI specification               |
| `docs/`         | MCP API keys guide, futures roadmap |

## Configuration Locations

| File                             | Purpose                                 |
| -------------------------------- | --------------------------------------- |
| `~/.claude/settings.local.json`  | Hooks configuration (5 hook types)      |
| `~/.claude/agents/`              | Custom agents (9 total)                 |
| `~/.claude/commands/`            | Custom commands (17 total)              |
| `~/.claude/skills/`              | Custom skills (16 total)                |
| `.mcp.json`                      | MCP server configuration (25 servers)   |
| `.env`                           | Environment variables (source of truth) |
| `mcp-servers/trading-utilities/` | Custom trading MCP server (5 tools)     |
