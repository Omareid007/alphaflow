# OpenSpec Implementation Plan - Detailed Execution Guide

**Project**: AlphaFlow Trading Platform
**Date**: 2026-01-02
**Model for Execution**: Claude Sonnet 4.5 (1M context)
**Current Status**: Foundation Complete, Ready for Spec Generation

---

## Executive Summary

OpenSpec has been successfully initialized and configured for the trading platform. The framework will enable **spec-driven development** for maintaining 350+ API endpoints across 8 core capabilities. This document provides a structured plan for completing the OpenSpec integration.

---

## Phase 1: Foundation - COMPLETED ✅

### 1.1 OpenSpec Installation ✅

- ✅ Installed `@fission-ai/openspec@0.17.2` globally
- ✅ Installed `openspec-mcp@latest` globally
- ✅ Initialized OpenSpec in `/home/runner/workspace`
- ✅ Created directory structure:
  ```
  openspec/
  ├── AGENTS.md (15KB - workflow instructions)
  ├── project.md (394 lines - comprehensive project context)
  ├── specs/ (capability specifications - 8 directories created)
  └── changes/ (active change proposals)
  ```

### 1.2 MCP Server Configuration ✅

- ✅ Added OpenSpec MCP server to `.mcp.json` (now 27 total servers)
- ✅ Configuration:
  ```json
  "openspec": {
    "command": "npx",
    "args": ["-y", "openspec-mcp", "--with-dashboard"],
    "env": {
      "OPENSPEC_ROOT": "/home/runner/workspace"
    }
  }
  ```

### 1.3 Claude Code Integration ✅

- ✅ Added OpenSpec instructions to `CLAUDE.md` (lines 1-18)
- ✅ Available slash commands:
  - `/openspec:proposal` - Create new change proposal
  - `/openspec:apply` - Implement approved change
  - `/openspec:archive` - Archive completed change

### 1.4 Project Context Documentation ✅

- ✅ Populated `openspec/project.md` with:
  - Tech stack (Next.js 15, React 19, TypeScript 5.6, Express.js, PostgreSQL)
  - Architecture patterns (REST API, SSE, Drizzle ORM, AI/LLM Gateway)
  - Trading domain concepts (strategies, orders, positions, risk management)
  - API documentation (31 documented, 350+ actual endpoints)
  - Security constraints (FINRA, SEC, PDT rules)
  - External dependencies (Alpaca, SendGrid, 9 LLM providers)
  - 26 MCP servers reference

### 1.5 Research Completed ✅

- ✅ Comprehensive API analysis (54 route files, 350+ endpoints)
- ✅ Identified 8 core capabilities for spec creation
- ✅ Documented existing OpenAPI 3.0.3 spec (31 paths, manually maintained)
- ✅ Analyzed validation patterns (Zod schemas, middleware)
- ✅ Identified 3 background agents for research (all completed)

---

## Phase 2: Capability Specification - IN PROGRESS 🔄

### 2.1 Created Specifications ✅

**Authentication** (`openspec/specs/authentication/spec.md`) - 330 lines

- 10 requirements covering full auth lifecycle
- Session management (7-day cookies, HTTP-only, secure)
- Password reset flow (1-hour tokens, email-based)
- Rate limiting (5 attempts/15 min)
- Admin token fallback for CI/CD
- Email enumeration prevention
- 7 API endpoints documented
- Database schema (users, passwordResetTokens)

### 2.2 Remaining Specifications - TODO 📋

You should complete these 7 capability specifications:

#### 1. Trading & Orders (`openspec/specs/trading-orders/spec.md`)

**Scope**: 80+ endpoints across 9 route files

- Order creation (market, limit, stop, stop-limit, trailing-stop, bracket, OCO)
- Order management (list, get, cancel, update)
- Order status tracking (new, accepted, filled, partially_filled, canceled, rejected)
- Trade execution history
- Time-in-force rules (day, GTC, IOC, FOK)
- Order validation (buying power, position limits, market hours)
- Circuit breaker integration
- Retry handling with deduplication
- Real-time order updates via SSE

**Key Files**:

- `server/routes/orders.ts`
- `server/routes/trades.ts`
- `server/routes/alpaca-trading.ts`
- `server/trading/unified-order-executor.ts`
- `server/trading/order-retry-handler.ts`
- `shared/schema/orders.ts`

**Requirements to Document**:

- Order submission with multiple types
- Order validation against risk limits
- Order lifecycle management
- Trade execution tracking
- Order cancellation and replacement
- Failed order handling and retry logic
- Real-time order status updates

#### 2. Strategy Management (`openspec/specs/strategy-management/spec.md`)

**Scope**: 30+ endpoints across strategy and backtest routes

- Strategy CRUD operations
- Strategy deployment to production
- Backtest execution with historical data
- Backtest result analysis
- Strategy versioning
- Strategy parameters (entry/exit rules, indicators, risk controls)
- Autonomous strategy execution
- Strategy signal pipeline

**Key Files**:

- `server/routes/strategies.ts`
- `server/routes/backtests.ts`
- `server/autonomous/strategy-signal-pipeline.ts`
- `shared/schema/strategy-versioning.ts`
- `shared/schema/backtest.ts`

**Requirements to Document**:

- Strategy creation with parameters
- Strategy validation rules
- Backtest execution with date ranges
- Backtest metrics (Sharpe, Sortino, max drawdown, win rate)
- Strategy deployment process
- Live strategy monitoring
- Strategy performance tracking

#### 3. Portfolio Management (`openspec/specs/portfolio-management/spec.md`)

**Scope**: 20+ endpoints for positions, portfolio, and rebalancing

- Current portfolio snapshot (equity, buying power, positions)
- Position tracking and reconciliation
- Portfolio history and snapshots
- Allocation and rebalancing
- Risk metrics (VaR, concentration, sector exposure)
- Position sizing rules

**Key Files**:

- `server/routes/positions.ts`
- `server/routes/portfolio-snapshot.ts`
- `server/routes/allocation-rebalance.ts`
- `server/services/position-reconciler.ts`
- `server/services/advanced-rebalancing-service.ts`

**Requirements to Document**:

- Portfolio overview retrieval
- Position list and details
- Position reconciliation with broker
- Rebalancing triggers and execution
- Risk limit enforcement
- Concentration limits

#### 4. Market Data (`openspec/specs/market-data/spec.md`)

**Scope**: 40+ endpoints for quotes, news, and market data

- Real-time quotes (stocks, crypto)
- Historical OHLCV data
- Market news feeds
- Macroeconomic data
- CoinMarketCap integration
- Data fusion intelligence
- Watchlist management

**Key Files**:

- `server/routes/market-data.ts`
- `server/routes/market-quotes.ts`
- `server/routes/stock.ts`
- `server/routes/crypto.ts`
- `server/routes/news.ts`
- `server/routes/watchlist.ts`

**Requirements to Document**:

- Quote retrieval (symbol, price, volume, timestamp)
- Historical data queries
- News feed filtering
- Watchlist CRUD operations
- Real-time price updates via SSE

#### 5. AI Analysis (`openspec/specs/ai-analysis/spec.md`)

**Scope**: 30+ endpoints for AI decision-making

- AI trade signal generation
- Risk assessment scoring
- Sentiment analysis
- LLM provider fallback chain
- Decision logging and audit trail
- Debate consensus mechanism
- AI-powered market analysis

**Key Files**:

- `server/routes/ai-analysis.ts`
- `server/routes/ai-decisions.ts`
- `server/routes/llm.ts`
- `server/routes/debate.ts`
- `server/ai/llmGateway.ts`
- `server/ai/decision-engine.ts`

**Requirements to Document**:

- Signal generation with confidence scores
- Multi-provider LLM fallback
- Risk scoring (0-10 scale)
- Sentiment analysis from news
- Decision audit logging
- AI usage quotas and budgets

#### 6. Admin & System (`openspec/specs/admin-system/spec.md`)

**Scope**: 70+ endpoints for system management

- API usage and provider quotas
- AI configuration (provider enable/disable)
- Module registry and settings
- Trading universe management
- User management and audit logs
- Cache management
- Health checks and diagnostics
- Webhook management
- Notification channels

**Key Files**:

- `server/routes/admin/*.ts` (6 files)
- `server/routes/health.ts`
- `server/routes/cache.ts`
- `server/routes/settings.ts`
- `server/routes/webhooks.ts`
- `server/routes/notifications.ts`

**Requirements to Document**:

- System health monitoring
- Provider management
- Cache clearing operations
- User administration
- Audit log queries
- Notification configuration

#### 7. Real-time Streaming (`openspec/specs/real-time-streaming/spec.md`)

**Scope**: SSE endpoints for live updates

- Order updates stream
- Trade fills stream
- Position changes stream
- Price/quote updates stream
- Alert notifications stream
- Strategy execution events stream
- Correlation IDs for tracing
- Event buffering and replay

**Key Files**:

- `server/routes/stream-trading.ts`
- `server/lib/sse-emitter.ts`

**Requirements to Document**:

- SSE connection establishment
- Event format and structure
- Reconnection handling
- Event ID for replay
- Compression support
- Per-user event filtering

---

## Phase 3: Testing & Validation - TODO 📋

### 3.1 Validate Specifications

For each created spec, run:

```bash
openspec validate --strict
```

Fix any validation errors:

- Ensure all requirements have `SHALL` or `MUST` language
- Verify each requirement has at least one `#### Scenario:` block
- Check scenario formatting (`#### Scenario: Name` not `- Scenario:`)

### 3.2 Test OpenSpec CLI Commands

```bash
# List all specifications
openspec spec list --long

# Show individual spec details
openspec show authentication --type spec

# Validate all specs
openspec validate --strict
```

### 3.3 Test OpenSpec MCP Server

After restarting Claude Code to load the MCP server, test:

```
/openspec:proposal add-futures-trading
```

This should create a new change proposal in `openspec/changes/add-futures-trading/`

---

## Phase 4: Integration with Existing OpenAPI Spec - TODO 📋

### 4.1 OpenAPI Synchronization

The platform has an existing OpenAPI 3.0.3 spec at `docs/api/OPENAPI_SPEC.yaml` covering 31 endpoints. You should:

1. **Compare coverage**:

   ```bash
   # Extract paths from OpenAPI spec
   cat docs/api/OPENAPI_SPEC.yaml | grep "  /" | wc -l  # Shows 31

   # Count OpenSpec requirements
   grep "^### Requirement:" openspec/specs/*/spec.md | wc -l
   ```

2. **Identify gaps**: Endpoints in OpenAPI but not in OpenSpec
3. **Identify new coverage**: Endpoints in OpenSpec but not in OpenAPI
4. **Create migration plan**: Decide whether to:
   - Generate OpenAPI from OpenSpec (recommended)
   - Keep both synchronized manually
   - Deprecate OpenAPI in favor of OpenSpec

### 4.2 Generate OpenAPI from Zod Schemas

Consider using `zod-to-openapi` package to auto-generate OpenAPI spec from existing Zod validation schemas:

```bash
npm install -D zod-to-openapi
```

Then create a script to generate OpenAPI 3.1 from schemas in:

- `shared/schema/*.ts` (16 modules)
- `server/validation/api-schemas.ts`

---

## Phase 5: Documentation & Usage Guides - TODO 📋

### 5.1 Create Change Proposal Example

Create a sample change proposal to demonstrate the workflow:

```bash
mkdir -p openspec/changes/add-email-notifications
```

**Files to create**:

1. `openspec/changes/add-email-notifications/proposal.md`
   - Why: Users need trade execution alerts via email
   - What: Add email notification channel to notification service
   - Impact: Affects authentication (email required), notifications

2. `openspec/changes/add-email-notifications/tasks.md`
   - [ ] Update users table to make email required
   - [ ] Add email notification channel to notification-service
   - [ ] Create email templates for trade alerts
   - [ ] Add email preference settings
   - [ ] Test email delivery

3. `openspec/changes/add-email-notifications/specs/authentication/spec.md`

   ```markdown
   ## MODIFIED Requirements

   ### Requirement: User Registration

   [Include full modified requirement with email as required field]
   ```

4. `openspec/changes/add-email-notifications/specs/admin-system/spec.md`
   ```markdown
   ## ADDED Requirements

   ### Requirement: Email Notification Configuration

   [New requirement for email notification settings]
   ```

### 5.2 Document OpenSpec Workflow

Create `docs/OPENSPEC_WORKFLOW.md` with:

- How to create a change proposal
- How to implement a change
- How to archive a completed change
- Best practices for requirement writing
- Scenario formatting guidelines

### 5.3 Update CLAUDE.md

Add OpenSpec usage section with:

- When to create a proposal vs direct implementation
- How to use OpenSpec slash commands
- Reference to `openspec/AGENTS.md` for full workflow

---

## Phase 6: App Functionality Validation - TODO 📋

### 6.1 Comprehensive Testing

Run the full test suite to ensure no regressions:

```bash
# Type checking
npx tsc --noEmit

# Linting
npx next lint

# Unit + Integration tests
npx vitest run

# Build verification
npm run build
```

### 6.2 API Endpoint Testing

Test critical endpoints:

```bash
# Start server
npm run dev:server

# Test authentication
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'

# Test portfolio
curl http://localhost:5000/api/portfolio \
  -H "Cookie: session=<session-id>"

# Test market data (public)
curl http://localhost:5000/api/stock/quote/AAPL
```

### 6.3 SSE Streaming Testing

Test real-time streaming endpoints:

```bash
curl -N http://localhost:5000/api/stream/trading \
  -H "Cookie: session=<session-id>"
```

Verify event format:

```
id: <event-id>
event: order.updated
data: {"orderId":"...","status":"filled"}
```

### 6.4 Component Testing

Test key UI components:

```bash
# Navigate to app
open http://localhost:3000

# Test pages:
# - /login - Authentication
# - /home - Dashboard with portfolio
# - /strategies - Strategy list
# - /portfolio - Positions and trades
# - /research - Watchlist with real-time quotes
```

---

## Phase 7: Knowledge Graph Integration - TODO 📋

### 7.1 Store OpenSpec Metadata in Memory MCP

Use the Memory MCP to store OpenSpec information for easy retrieval:

```typescript
// Store capability inventory
mcp__memory__create_entities({
  entities: [
    {
      name: "OpenSpec Integration",
      entityType: "project-enhancement",
      observations: [
        "OpenSpec v0.17.2 initialized on 2026-01-02",
        "27 MCP servers now configured",
        "8 capability specs created",
        "350+ API endpoints documented via OpenSpec",
        "Authentication spec: 10 requirements, 7 endpoints",
        "Trading-Orders spec: 80+ endpoints",
        "Real-time streaming: SSE with event replay",
      ],
    },
  ],
});

// Link to project
mcp__memory__create_relations({
  relations: [
    {
      from: "OpenSpec Integration",
      to: "AlphaFlow Trading Platform",
      relationType: "enhances",
    },
  ],
});
```

### 7.2 Query OpenSpec Status

Create a quick reference query:

```typescript
mcp__memory__search_nodes("OpenSpec");
```

Returns all OpenSpec-related entities and observations.

---

## Execution Instructions for Claude Sonnet 4.5 (1M Context)

### Pre-requisites Completed ✅

- OpenSpec CLI installed and initialized
- OpenSpec MCP server configured in `.mcp.json`
- Project context documented in `openspec/project.md`
- Authentication capability spec created
- API analysis complete (see agent output above)

### Your Tasks - Structured Execution Plan

**Step 1: Generate Remaining Capability Specs (6 specs)**

For each of the 6 remaining capabilities:

1. Read the "Key Files" listed in Phase 2.2 above
2. Analyze the route patterns, validation schemas, and middleware
3. Create `openspec/specs/<capability>/spec.md` following the Authentication spec format
4. Include:
   - Overview paragraph
   - 8-15 requirements (depending on capability size)
   - 2-4 scenarios per requirement
   - Security section (rate limits, validation rules)
   - API endpoints table
   - Database schema (if applicable)
   - Error handling section
   - Dependencies list
   - Files reference

5. Validate each spec: `openspec validate <capability> --strict`

**Step 2: Create Sample Change Proposal**

Follow Phase 5.1 to create `openspec/changes/add-email-notifications/` with:

- `proposal.md`
- `tasks.md`
- `specs/authentication/spec.md` (delta)
- `specs/admin-system/spec.md` (delta)

Validate: `openspec validate add-email-notifications --strict`

**Step 3: Test OpenSpec Workflow**

1. Run: `openspec list` - Should show "add-email-notifications"
2. Run: `openspec show add-email-notifications`
3. Run: `openspec validate --strict` - Should pass all checks

**Step 4: Create Documentation**

Create `docs/OPENSPEC_WORKFLOW.md` with:

- OpenSpec workflow overview
- How to create proposals
- How to implement changes
- How to archive completed work
- Reference examples

**Step 5: Run Comprehensive Testing**

Execute Phase 6 validation:

- TypeScript compilation
- Linting
- Test suite
- Build process
- API endpoint smoke tests
- SSE streaming verification

**Step 6: Generate Final Report**

Create `OPENSPEC_INTEGRATION_COMPLETE.md` with:

- Summary of completed work
- Capability specs created (8 total)
- Endpoints documented (350+)
- Change proposals created (1 sample)
- Testing results
- Usage instructions
- Next steps and recommendations

**Step 7: Commit Changes**

```bash
git add openspec/ docs/OPENSPEC_WORKFLOW.md OPENSPEC_INTEGRATION_COMPLETE.md .mcp.json CLAUDE.md
git commit -m "$(cat <<'EOF'
feat: Complete OpenSpec integration for spec-driven development

## Summary
Integrate OpenSpec framework for maintaining 350+ API endpoints across
8 core capabilities with structured change proposals and automated validation.

## New Features

### OpenSpec Framework
- Initialize OpenSpec v0.17.2 with Claude Code support
- Add OpenSpec MCP server (27th MCP server)
- Create comprehensive project context (394 lines)

### Capability Specifications (8 specs created)
- Authentication: 10 requirements, 7 endpoints
- Trading & Orders: 15 requirements, 80+ endpoints
- Strategy Management: 12 requirements, 30+ endpoints
- Portfolio Management: 10 requirements, 20+ endpoints
- Market Data: 8 requirements, 40+ endpoints
- AI Analysis: 10 requirements, 30+ endpoints
- Admin & System: 15 requirements, 70+ endpoints
- Real-time Streaming: 6 requirements, SSE endpoints

### Documentation
- OpenSpec workflow guide
- Sample change proposal (email notifications)
- Integration completion report

### Configuration
- Update .mcp.json with OpenSpec MCP server
- Add OpenSpec instructions to CLAUDE.md
- Create 8 capability directories

## Coverage
- Documented: 350+ API endpoints (up from 31)
- Specifications: 8 capability specs
- Change proposals: 1 sample proposal
- Validation: All specs pass strict validation

## Usage

Create change proposal:
\`\`\`bash
openspec init
/openspec:proposal add-new-feature
\`\`\`

Implement change:
\`\`\`bash
/openspec:apply add-new-feature
\`\`\`

Archive completed:
\`\`\`bash
openspec archive add-new-feature --yes
\`\`\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Key Files Reference

### Created Files

- `openspec/project.md` (394 lines) - Project context
- `openspec/specs/authentication/spec.md` (330 lines) - Auth spec
- `OPENSPEC_IMPLEMENTATION_PLAN.md` (this file) - Execution plan
- `.mcp.json` - Updated with OpenSpec MCP (line 143-149)
- `CLAUDE.md` - Updated with OpenSpec instructions (lines 1-18)

### Files to Create

- `openspec/specs/trading-orders/spec.md`
- `openspec/specs/strategy-management/spec.md`
- `openspec/specs/portfolio-management/spec.md`
- `openspec/specs/market-data/spec.md`
- `openspec/specs/ai-analysis/spec.md`
- `openspec/specs/admin-system/spec.md`
- `openspec/specs/real-time-streaming/spec.md`
- `openspec/changes/add-email-notifications/proposal.md`
- `openspec/changes/add-email-notifications/tasks.md`
- `openspec/changes/add-email-notifications/specs/authentication/spec.md`
- `openspec/changes/add-email-notifications/specs/admin-system/spec.md`
- `docs/OPENSPEC_WORKFLOW.md`
- `OPENSPEC_INTEGRATION_COMPLETE.md`

### Files to Reference

- `server/routes/*.ts` (54 files) - API routes
- `server/middleware/*.ts` (6 files) - Middleware
- `shared/schema/*.ts` (16 files) - Database schemas
- `server/validation/api-schemas.ts` - Request/response validation
- `docs/api/OPENAPI_SPEC.yaml` - Existing OpenAPI spec
- `openspec/AGENTS.md` - OpenSpec workflow instructions

---

## Success Criteria

✅ **Foundation**:

- OpenSpec installed and initialized
- MCP server configured
- Project context documented

🔄 **Specifications** (Execute Now):

- [ ] 7 capability specs created (1/8 complete)
- [ ] All specs validate with `--strict`
- [ ] 350+ endpoints documented

🔄 **Testing** (Execute Now):

- [ ] All specs validated
- [ ] Sample change proposal created
- [ ] OpenSpec CLI commands tested
- [ ] Comprehensive app testing passed

🔄 **Documentation** (Execute Now):

- [ ] OpenSpec workflow guide created
- [ ] Integration completion report created
- [ ] CLAUDE.md updated

🔄 **Commit** (Execute Now):

- [ ] All changes committed with detailed message
- [ ] Git push completed

---

## Tools & Resources

### OpenSpec CLI Commands

```bash
openspec spec list --long      # List all specifications
openspec list                  # List active changes
openspec show <item>           # Display spec or change
openspec validate --strict     # Validate all specs
openspec archive <change> -y   # Archive completed change
```

### OpenSpec Slash Commands (Claude Code)

```
/openspec:proposal <name>  # Create change proposal
/openspec:apply <name>     # Implement change
/openspec:archive <name>   # Archive change
```

### Memory MCP Queries

```typescript
mcp__memory__search_nodes("OpenSpec")  # Find OpenSpec entities
mcp__memory__read_graph()              # Full knowledge graph
```

### Validation Commands

```bash
npx tsc --noEmit           # TypeScript check
npx next lint               # ESLint
npx vitest run              # Tests
npm run build               # Build verification
```

---

## Next Steps After Completion

1. **Generate OpenAPI from OpenSpec**: Use `zod-to-openapi` to auto-generate OpenAPI 3.1 spec
2. **Add Swagger UI**: Serve at `/api-docs` for interactive documentation
3. **SDK Generation**: Generate TypeScript/JavaScript SDKs from OpenAPI spec
4. **CI/CD Integration**: Add OpenSpec validation to pre-commit hooks
5. **API Versioning**: Plan `/api/v2/` endpoints for breaking changes

---

## Contact & Support

- **OpenSpec Documentation**: https://github.com/Fission-AI/OpenSpec
- **OpenSpec MCP**: https://lobehub.com/mcp/lumiaqian-openspec-mcp
- **Project CLAUDE.md**: `/home/runner/workspace/CLAUDE.md`
- **OpenSpec AGENTS.md**: `/home/runner/workspace/openspec/AGENTS.md`

---

**This plan is ready for execution by Claude Sonnet 4.5 (1M context). All pre-requisites are completed. Execute Steps 1-7 sequentially to complete the OpenSpec integration.**
