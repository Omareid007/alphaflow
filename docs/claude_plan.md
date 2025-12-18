# AI Active Trader - Comprehensive Development Plan

> **Created:** December 2025
> **Version:** 1.0
> **Status:** Active Development

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Critical Issues & Bug Fixes](#critical-issues--bug-fixes)
4. [Infrastructure Improvements](#infrastructure-improvements)
5. [Test Coverage Plan](#test-coverage-plan)
6. [MCP Integration Opportunities](#mcp-integration-opportunities)
7. [Prioritized Roadmap](#prioritized-roadmap)
8. [Implementation Guidelines](#implementation-guidelines)

---

## Executive Summary

**AI Active Trader** is an autonomous paper trading platform with AI-powered decision support. The platform is in active production with an ongoing microservices migration (currently using strangler fig pattern).

### Key Findings

| Category | Status | Severity |
|----------|--------|----------|
| Critical Bugs | 7 issues | CRITICAL |
| High Priority Issues | 11 issues | HIGH |
| Medium Priority Issues | 9 issues | MEDIUM |
| Test Coverage | ~0.1% (3 files / ~300+ files) | CRITICAL |
| Infrastructure Gaps | 8 major gaps | HIGH |
| MCP Opportunities | 12+ integrations identified | ENHANCEMENT |

### Immediate Actions Required

1. **Security**: Fix hardcoded admin credentials in bootstrap
2. **Trading Logic**: Fix quantity calculation (hardcoded to 1)
3. **Database**: Add missing foreign key constraints and indexes
4. **Testing**: Create test framework and critical path tests
5. **Configuration**: Create `.env.example` and document all variables

---

## Current State Analysis

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (React Native/Expo)               │
│  Dashboard │ Strategies │ Analytics │ Admin Hub (17 modules) │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST API
┌─────────────────────────▼───────────────────────────────────┐
│                     SERVER (Express.js)                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ AI Decision  │ │  Trading     │ │  Orchestrator        │ │
│  │ Engine       │ │  Engine      │ │  (Autonomous Agent)  │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              CONNECTORS (13 Integrations)             │   │
│  │ Alpaca │ Finnhub │ CoinGecko │ NewsAPI │ OpenAI │ ... │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                  PostgreSQL (Drizzle ORM)                    │
│  40+ tables: users, strategies, trades, positions, orders    │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, React Native 0.81, Expo 54, TanStack Query |
| Backend | Express.js, Node.js, TypeScript 5.9 |
| Database | PostgreSQL, Drizzle ORM |
| AI/LLM | OpenAI, Groq, Together, AIML, OpenRouter |
| Data | Alpaca, Finnhub, CoinGecko, NewsAPI, Polygon, GDELT |
| Infrastructure | Docker, Kubernetes, NATS JetStream, OpenTelemetry |

### Codebase Metrics

- **Total Source Files:** ~321 TypeScript/JavaScript files
- **Database Tables:** 40+
- **API Endpoints:** 50+
- **External Integrations:** 13
- **Test Files:** 3 (0.1% coverage)
- **Documentation Files:** 47+

---

## Critical Issues & Bug Fixes

### CRITICAL Severity (Fix Immediately)

#### 1. Hardcoded Admin Credentials
**Location:** `server/routes.ts:222-242`
```typescript
// VULNERABILITY: Hardcoded password visible in source
const hashedPassword = await bcrypt.hash("admin1234", 10);
await storage.createUser({ username: "admintest", password: hashedPassword, isAdmin: true });
```
**Fix:** Remove hardcoded credentials, use environment variable for initial admin setup, or create admin via CLI command.

#### 2. Trade Quantity Hardcoded to 1
**Location:** `server/routes.ts:653-697`
```typescript
// BUG: Ignores AI-suggested quantity
quantity: 1,  // HARDCODED - ignores decision.suggestedQuantity!
```
**Fix:** Use `decision.suggestedQuantity` with proper validation and fallback.

#### 3. Unsafe Type Coercion on Trade Side
**Location:** `server/routes.ts:673-674`
```typescript
// BUG: "hold" action would create invalid order
side: decision.action as "buy" | "sell",
```
**Fix:** Add type guard to reject "hold" actions before order creation.

#### 4. Race Condition in Throttle State
**Location:** `server/lib/fetchWithBudgetAndCache.ts:42-55`
```typescript
// BUG: No locking - concurrent requests bypass throttle
const throttleState: Map<string, number> = new Map();
```
**Fix:** Implement mutex/lock mechanism or use distributed rate limiting with Redis.

#### 5. Missing Request Body Validation
**Location:** `server/routes.ts:554-625`
- Direct property access without Zod validation
- Type confusion attacks possible

**Fix:** Add Zod schema validation for all route handlers.

#### 6. Session CSRF Vulnerability
**Location:** `server/routes.ts:91-124`
- In-memory sessions lost on restart
- No CSRF token validation on state-changing operations

**Fix:** Implement CSRF tokens, consider session storage in Redis/DB.

#### 7. Stale Cache on All Errors
**Location:** `server/lib/fetchWithBudgetAndCache.ts:154-185`
- Doesn't distinguish recoverable vs unrecoverable errors
- Could serve 24+ hour old data

**Fix:** Add error classification, TTL checks, and cache invalidation.

### HIGH Severity (Fix This Sprint)

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 1 | Position quantity calculation silently fails | `alpaca-trading-engine.ts:923-929` | Add logging, return error status |
| 2 | Wash trade prevention incomplete | `alpaca-trading-engine.ts:963-979` | Check existing positions not just pending orders |
| 3 | Missing foreign key constraints | `shared/schema.ts` | Add `.onDelete()` clauses |
| 4 | Missing database indexes | `shared/schema.ts:200-210, 519-553` | Add composite indexes |
| 5 | Symbol parameter injection risk | `routes.ts:633-650` | Whitelist valid symbols |
| 6 | Silent error in enrichment gathering | `alpaca-trading-engine.ts:736-876` | Add fallback mechanism |
| 7 | Background process error handling | `routes.ts:182-220` | Add try-catch wrappers |
| 8 | P&L missing for opening trades | `alpaca-trading-engine.ts:484-502` | Calculate unrealized P&L |
| 9 | Work queue cleanup on failure | `routes.ts:204-217` | Add cleanup and alerting |
| 10 | Trade not linked when AI fails | `alpaca-trading-engine.ts:1019-1029` | Add error handling for linkage |
| 11 | Null reference in market data | `alpaca-trading-engine.ts:1200-1220` | Validate price before use |

### MEDIUM Severity (Fix Next Sprint)

| # | Issue | Location |
|---|-------|----------|
| 1 | LLM response parsing edge case | `decision-engine.ts:312-328` |
| 2 | Function calling infinite retry risk | `decision-engine.ts:387-418` |
| 3 | Missing Promise rejection handling | `routes.ts:182-220` |
| 4 | Silent enrichment failures | `alpaca-trading-engine.ts:771-873` |
| 5 | Session storage in-memory only | `routes.ts:91` |
| 6 | No input sanitization on symbol | `routes.ts:633-650` |
| 7 | Orphaned work queue items | `routes.ts:204-217` |
| 8 | Broken AI decision audit trail | `alpaca-trading-engine.ts:1019-1029` |
| 9 | Stats exclude ongoing positions | `alpaca-trading-engine.ts:1310-1318` |

---

## Infrastructure Improvements

### 1. Database Migrations (CRITICAL)

**Current State:** No migration files exist despite using Drizzle ORM

**Action Items:**
```bash
# Generate initial migration
npm run drizzle-kit generate --name initial_schema

# Add to package.json scripts
"db:migrate": "drizzle-kit migrate",
"db:generate": "drizzle-kit generate"
```

**Files to Create:**
- `migrations/0000_initial_schema.sql`
- `docs/DATABASE_MIGRATIONS.md`

### 2. Environment Variables (CRITICAL)

**Create `.env.example`:**
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_trader

# Broker (Alpaca Paper Trading)
ALPACA_API_KEY=your_paper_key
ALPACA_SECRET_KEY=your_paper_secret
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Market Data
FINNHUB_API_KEY=
NEWS_API_KEY=
COINMARKETCAP_API_KEY=

# AI/LLM Providers
OPENAI_API_KEY=
GROQ_API_KEY=
TOGETHER_API_KEY=
OPENROUTER_API_KEY=

# Security
SESSION_SECRET=generate_random_string
ADMIN_TOKEN=generate_secure_token

# Infrastructure
NATS_URL=nats://localhost:4222
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Rate Limits (optional overrides)
ALPACA_RATE_LIMIT_PER_MIN=180
FINNHUB_RATE_LIMIT_PER_MIN=60
```

### 3. CI/CD Improvements

**Update `.github/workflows/ci.yml`:**
- Remove `--passWithNoTests` flag
- Add TypeScript strict mode check
- Add bundle size analysis
- Add database migration execution

### 4. Kubernetes Configuration

**Issues to Fix:**
- Add egress NetworkPolicies for external APIs
- Add securityContext to all pods (non-root, read-only filesystem)
- Centralize port configuration (currently hardcoded)
- Add PriorityClass for critical services
- Document TLS certificate provisioning

### 5. Caching & Rate Limiting

**Implement Distributed Caching:**
- Connect to Redis (already in docker-compose but unused)
- Move throttle state from in-memory Map to Redis
- Add cache invalidation endpoints
- Add cache metrics

### 6. Observability Enhancements

**Action Items:**
- Document OpenTelemetry context propagation
- Add custom span attributes for trading operations
- Standardize log format (JSON)
- Add log level configuration per service

---

## Test Coverage Plan

### Current State: 3 Test Files (~0.1% coverage)

| File | Lines | Content |
|------|-------|---------|
| `server/utils/numeric.test.ts` | 246 | Numeric utilities |
| `services/shared/common/feature-flags.test.ts` | 262 | Feature flags |
| `services/trading-engine/repositories/persistence.test.ts` | 549 | Repository pattern |

### Phase 1: Critical Path Tests (Week 1-2)

**Priority 1 - Trading Execution:**
```
server/trading/alpaca-trading-engine.ts (1,978 lines) - NO TESTS
server/trading/order-execution-flow.ts (1,191 lines) - NO TESTS
server/trading/paper-trading-engine.ts (638 lines) - NO TESTS
```

**Tests to Write:**
- [ ] `alpaca-trading-engine.test.ts` - Trade execution, position management
- [ ] `order-execution-flow.test.ts` - Error recovery, retry logic
- [ ] `paper-trading-engine.test.ts` - Trade lifecycle, P&L calculation

**Priority 2 - AI Decision Engine:**
```
server/ai/decision-engine.ts (592 lines) - NO TESTS
server/ai/llmGateway.ts (416 lines) - NO TESTS
```

**Tests to Write:**
- [ ] `decision-engine.test.ts` - Signal generation, confidence scoring
- [ ] `llmGateway.test.ts` - Model routing, fallback chains

### Phase 2: Integration Tests (Week 3-4)

**API Endpoint Tests:**
```
server/routes.ts (5,400 lines) - NO TESTS
server/routes/arena.ts - NO TESTS
server/routes/backtests.ts - NO TESTS
```

**Tests to Write:**
- [ ] `routes.test.ts` - All critical endpoints
- [ ] `trades.integration.test.ts` - Full trade flow
- [ ] `positions.integration.test.ts` - Position lifecycle

### Phase 3: E2E Tests (Week 5-6)

**User Flow Tests:**
- [ ] Strategy creation → Signal generation → Trade execution
- [ ] Portfolio rebalancing workflow
- [ ] Risk management triggers

### Mock Framework Setup

**Create `tests/mocks/`:**
```typescript
// tests/mocks/alpaca.ts
export const mockAlpacaClient = {
  getAccount: vi.fn(),
  getPositions: vi.fn(),
  createOrder: vi.fn(),
  getOrders: vi.fn(),
};

// tests/mocks/llm.ts
export const mockLLMGateway = {
  generateDecision: vi.fn(),
  routeToModel: vi.fn(),
};
```

---

## MCP Integration Opportunities

### Tier 1: High Value for Trading Platform

| MCP Server | Use Case | Priority |
|------------|----------|----------|
| **PostgreSQL MCP** | Direct database queries, schema inspection | HIGH |
| **Financial Datasets** | Real-time stock/crypto data, market news | HIGH |
| **GreptimeDB MCP** | Time-series data for OHLC, metrics | HIGH |
| **Octagon MCP** | SEC filings, financial analysis | MEDIUM |

### Tier 2: Operations & DevOps

| MCP Server | Use Case | Priority |
|------------|----------|----------|
| **GitHub MCP** | Code management, CI/CD automation | MEDIUM |
| **AWS MCP** | Infrastructure management, S3 storage | MEDIUM |
| **n8n MCP** | Workflow automation, alerts | MEDIUM |

### Tier 3: Analytics & Intelligence

| MCP Server | Use Case | Priority |
|------------|----------|----------|
| **ClickHouse MCP** | High-performance analytics | LOW |
| **Qdrant Vector MCP** | Semantic search for strategies | LOW |
| **Chroma MCP** | Document management | LOW |

### Implementation Plan

**Phase 1: PostgreSQL MCP**
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "${DATABASE_URL}"
      }
    }
  }
}
```

**Phase 2: Financial Data MCP**
- Evaluate Financial Datasets Server for market data
- Consider replacing/augmenting Finnhub connector

---

## Prioritized Roadmap

### Sprint 1: Critical Security & Stability (Week 1-2)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| Fix hardcoded admin credentials | CRITICAL | 2h | Backend |
| Fix trade quantity calculation | CRITICAL | 4h | Backend |
| Add request validation (Zod) | CRITICAL | 8h | Backend |
| Create `.env.example` | CRITICAL | 2h | DevOps |
| Generate initial DB migration | CRITICAL | 4h | Backend |
| Fix throttle race condition | HIGH | 4h | Backend |

### Sprint 2: Testing Foundation (Week 3-4)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| Create mock framework | HIGH | 8h | QA |
| Write trading engine tests | HIGH | 16h | Backend |
| Write decision engine tests | HIGH | 12h | Backend |
| Write order flow tests | HIGH | 12h | Backend |
| CI/CD test integration | HIGH | 4h | DevOps |

### Sprint 3: Infrastructure Hardening (Week 5-6)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| Implement Redis caching | HIGH | 8h | Backend |
| Add database indexes | HIGH | 4h | Backend |
| Add foreign key constraints | HIGH | 4h | Backend |
| K8s security improvements | MEDIUM | 8h | DevOps |
| Observability enhancements | MEDIUM | 8h | DevOps |

### Sprint 4: MCP Integrations (Week 7-8)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| PostgreSQL MCP setup | MEDIUM | 4h | Backend |
| Evaluate Financial Data MCP | MEDIUM | 8h | Backend |
| Document MCP usage | MEDIUM | 4h | Docs |

### Sprint 5: Advanced Features (Week 9-10)

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| Integration tests | HIGH | 16h | QA |
| E2E tests | MEDIUM | 16h | QA |
| Performance optimization | MEDIUM | 8h | Backend |
| Documentation update | MEDIUM | 8h | Docs |

---

## Implementation Guidelines

### Code Quality Standards

```typescript
// 1. Always validate inputs with Zod
import { z } from "zod";

const TradeRequestSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{1,5}$/),
  side: z.enum(["buy", "sell"]),
  quantity: z.number().positive(),
});

// 2. Use proper error handling
try {
  const result = await executeOrder(params);
} catch (error) {
  if (error instanceof InsufficientFundsError) {
    // Handle specific error
  }
  logger.error("Order execution failed", { error, params });
  throw error;
}

// 3. Always log important operations
logger.info("Trade executed", {
  traceId,
  symbol,
  side,
  quantity,
  price,
  orderId,
});
```

### Testing Standards

```typescript
// 1. Use descriptive test names
describe("AlpacaTradingEngine", () => {
  describe("executeTrade", () => {
    it("should create bracket order with stop-loss and take-profit", async () => {
      // Test implementation
    });

    it("should reject trade when insufficient funds", async () => {
      // Test implementation
    });
  });
});

// 2. Mock external dependencies
beforeEach(() => {
  vi.mock("../connectors/alpaca", () => mockAlpacaClient);
});

// 3. Clean up after tests
afterEach(() => {
  vi.clearAllMocks();
});
```

### Documentation Standards

- Update relevant docs when making changes
- Include code examples in documentation
- Document all environment variables
- Keep API reference up to date

---

## Appendix

### Files Requiring Immediate Attention

| File | Lines | Issue Count | Priority |
|------|-------|-------------|----------|
| `server/routes.ts` | 5,400 | 8 | CRITICAL |
| `server/trading/alpaca-trading-engine.ts` | 1,978 | 6 | CRITICAL |
| `server/lib/fetchWithBudgetAndCache.ts` | 200 | 3 | HIGH |
| `server/ai/decision-engine.ts` | 592 | 2 | HIGH |
| `shared/schema.ts` | 1,447 | 2 | HIGH |

### Reference Documentation

- [APP_OVERVIEW.md](./APP_OVERVIEW.md) - Product features
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [API_REFERENCE.md](./API_REFERENCE.md) - Endpoint documentation
- [TESTING.md](./TESTING.md) - Test strategy
- [OBSERVABILITY.md](./OBSERVABILITY.md) - Monitoring setup

---

*This plan should be reviewed and updated weekly as implementation progresses.*
