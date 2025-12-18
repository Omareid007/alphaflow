# Known Bugs and Issues

> **Last Updated:** December 2025
> **Total Issues:** 27 (7 Critical, 11 High, 9 Medium)

---

## Critical Issues (Fix Immediately)

### BUG-001: Hardcoded Admin Credentials
- **Location:** `server/routes.ts:222-242`
- **Severity:** CRITICAL
- **Type:** Security Vulnerability
- **Description:** Default admin password "admin1234" is hardcoded in source code and created on every server startup.
- **Impact:** Unauthorized admin access, visible in git history
- **Fix:** Remove hardcoded credentials, use environment variable or CLI setup

### BUG-002: Trade Quantity Always 1
- **Location:** `server/routes.ts:673-674`
- **Severity:** CRITICAL
- **Type:** Trading Logic
- **Description:** Order quantity is hardcoded to 1, ignoring AI's `suggestedQuantity`
- **Impact:** Trades execute at wrong sizes, potentially massive exposure for high-price stocks
- **Fix:** Use `decision.suggestedQuantity` with validation

### BUG-003: Unsafe Type Coercion
- **Location:** `server/routes.ts:673`
- **Severity:** CRITICAL
- **Type:** Type Safety
- **Description:** `decision.action` force-cast to "buy" | "sell" without validation
- **Impact:** "hold" action could create invalid orders
- **Fix:** Add type guard before order creation

### BUG-004: Rate Limit Race Condition
- **Location:** `server/lib/fetchWithBudgetAndCache.ts:42-55`
- **Severity:** CRITICAL
- **Type:** Concurrency
- **Description:** Throttle state uses non-thread-safe Map, concurrent requests bypass limits
- **Impact:** API bans, 429 errors, service disruption
- **Fix:** Implement mutex or use Redis for distributed rate limiting

### BUG-005: Missing Request Validation
- **Location:** `server/routes.ts:554-625`
- **Severity:** CRITICAL
- **Type:** Input Validation
- **Description:** Request body properties accessed directly without schema validation
- **Impact:** Type confusion attacks, NaN/null values corrupting state
- **Fix:** Add Zod schema validation to all route handlers

### BUG-006: CSRF Vulnerability
- **Location:** `server/routes.ts:91-124`
- **Severity:** CRITICAL
- **Type:** Security
- **Description:** No CSRF tokens on state-changing operations, in-memory sessions
- **Impact:** Cross-site attacks could trigger trading operations
- **Fix:** Implement CSRF tokens, move sessions to persistent storage

### BUG-007: Stale Cache on All Errors
- **Location:** `server/lib/fetchWithBudgetAndCache.ts:154-185`
- **Severity:** CRITICAL
- **Type:** Data Integrity
- **Description:** Serves cached data on any error without distinguishing error types
- **Impact:** Stale data (24+ hours) driving trading decisions
- **Fix:** Add error classification, TTL checks, cache invalidation

---

## High Priority Issues

### BUG-008: Position Calculation Silent Failure
- **Location:** `server/trading/alpaca-trading-engine.ts:923-929`
- **Severity:** HIGH
- **Type:** Trading Logic
- **Description:** When quantity calculation results in 0 or NaN, trade silently skipped without logging
- **Impact:** Phantom trades, frontend shows trade executed when it wasn't
- **Fix:** Add logging, return error status, update decision state

### BUG-009: Incomplete Wash Trade Prevention
- **Location:** `server/trading/alpaca-trading-engine.ts:963-979`
- **Severity:** HIGH
- **Type:** Compliance
- **Description:** Only checks pending sell orders, not existing long positions
- **Impact:** Position size limits violated, margin calls possible
- **Fix:** Check existing positions before allowing new buys

### BUG-010: Missing Foreign Key Constraints
- **Location:** `shared/schema.ts` (all tables)
- **Severity:** HIGH
- **Type:** Database Integrity
- **Description:** Foreign keys defined but no `.onDelete()` or `.onUpdate()` clauses
- **Impact:** Orphaned records when parent deleted
- **Fix:** Add cascade delete rules to foreign key definitions

### BUG-011: Missing Database Indexes
- **Location:** `shared/schema.ts:200-210, 519-553`
- **Severity:** HIGH
- **Type:** Performance
- **Description:** Critical query columns lack indexes (provider+windowType, symbol+createdAt)
- **Impact:** Slow queries, N+1 patterns
- **Fix:** Add composite indexes on frequently queried columns

### BUG-012: Symbol Injection Risk
- **Location:** `server/routes.ts:633-650`
- **Severity:** HIGH
- **Type:** Security
- **Description:** Symbol parameter passed to Alpaca without sanitization/validation
- **Impact:** Potential injection if symbol used in queries
- **Fix:** Whitelist valid symbols, sanitize input

### BUG-013: Silent Enrichment Failures
- **Location:** `server/trading/alpaca-trading-engine.ts:736-876`
- **Severity:** HIGH
- **Type:** Error Handling
- **Description:** Promise.allSettled silently ignores enrichment failures
- **Impact:** AI decisions made with incomplete data
- **Fix:** Add fallback mechanism, log failures prominently

### BUG-014: Background Process Errors
- **Location:** `server/routes.ts:182-220`
- **Severity:** HIGH
- **Type:** Error Handling
- **Description:** `coordinator.start()`, engine initialization lack try-catch
- **Impact:** Unhandled rejections could crash process or leave inconsistent state
- **Fix:** Wrap in try-catch, add recovery logic

### BUG-015: Missing P&L for Opening Trades
- **Location:** `server/trading/alpaca-trading-engine.ts:484-502`
- **Severity:** HIGH
- **Type:** Financial Calculation
- **Description:** P&L set to null for opening trades, unrealized P&L not calculated
- **Impact:** Stats exclude ongoing positions, false metrics
- **Fix:** Calculate unrealized P&L for open positions

### BUG-016: Work Queue Cleanup Failure
- **Location:** `server/routes.ts:204-217`
- **Severity:** HIGH
- **Type:** Resource Management
- **Description:** Failed work items accumulate, no cleanup or alerting
- **Impact:** Orders drift out of sync, queue fills up
- **Fix:** Add cleanup job, dead-letter queue, alerting

### BUG-017: AI Decision Linkage Failure
- **Location:** `server/trading/alpaca-trading-engine.ts:1019-1029`
- **Severity:** HIGH
- **Type:** Audit Trail
- **Description:** If `getLatestAiDecisionForSymbol` fails, trade orphaned from decision
- **Impact:** Broken audit trail, can't trace decision → trade
- **Fix:** Add error handling, retry logic, alert on failure

### BUG-018: Null Reference in Market Data
- **Location:** `server/trading/alpaca-trading-engine.ts:1200-1220`
- **Severity:** HIGH
- **Type:** Null Safety
- **Description:** Fallback to 0 price when all sources fail, passes Number.isFinite() check
- **Impact:** Orders at price 0 fail silently
- **Fix:** Validate that 0 represents error state, not real price

---

## Medium Priority Issues

### BUG-019: LLM Response Parsing Edge Case
- **Location:** `server/ai/decision-engine.ts:312-328`
- **Severity:** MEDIUM
- **Type:** Error Handling
- **Description:** `response.json` used without shape validation, JSON.parse could throw
- **Impact:** Invalid decisions returned without error
- **Fix:** Add response shape validation, try-catch JSON.parse

### BUG-020: Function Calling Infinite Retry
- **Location:** `server/ai/decision-engine.ts:387-418`
- **Severity:** MEDIUM
- **Type:** Resource Management
- **Description:** No timeout on individual tool calls, no deduplication
- **Impact:** Analysis hangs, resource exhaustion
- **Fix:** Add per-call timeout, deduplicate tool calls

### BUG-021: Session Memory Only
- **Location:** `server/routes.ts:91`
- **Severity:** MEDIUM
- **Type:** Reliability
- **Description:** Sessions stored in Map, lost on process restart
- **Impact:** Users logged out on every deployment
- **Fix:** Move sessions to Redis or database

### BUG-022: Symbol Not Sanitized
- **Location:** `server/routes.ts:633-650`
- **Severity:** MEDIUM
- **Type:** Input Validation
- **Description:** No whitelisting of valid trading symbols
- **Impact:** Potential API abuse with invalid symbols
- **Fix:** Validate against known tradable symbols

### BUG-023: Orphaned Work Items
- **Location:** `server/routes.ts:204-217`
- **Severity:** MEDIUM
- **Type:** Resource Leak
- **Description:** Work queue items not cleaned up on failure
- **Impact:** Stale items consume memory, reconciliation fails
- **Fix:** Add TTL, cleanup job for failed items

### BUG-024: Broken Audit Trail
- **Location:** `server/trading/alpaca-trading-engine.ts:1019-1029`
- **Severity:** MEDIUM
- **Type:** Compliance
- **Description:** Decision-trade linkage silently fails
- **Impact:** Compliance reporting gaps
- **Fix:** Add mandatory audit logging

### BUG-025: Stats Exclude Open Positions
- **Location:** `server/trading/alpaca-trading-engine.ts:1310-1318`
- **Severity:** MEDIUM
- **Type:** Reporting
- **Description:** Filter `t.pnl !== null` excludes ongoing positions
- **Impact:** Win rate/stats underreported
- **Fix:** Include unrealized P&L in statistics

### BUG-026: Missing Enrichment Fallback
- **Location:** `server/trading/alpaca-trading-engine.ts:771-873`
- **Severity:** MEDIUM
- **Type:** Resilience
- **Description:** Individual enrichment providers fail with only debug log
- **Impact:** Degraded decision quality without visibility
- **Fix:** Add fallback data, warning-level logging

### BUG-027: Promise Rejection Unhandled
- **Location:** `server/routes.ts:182-220`
- **Severity:** MEDIUM
- **Type:** Error Handling
- **Description:** Multiple async operations scheduled without error boundaries
- **Impact:** Partial execution, inconsistent state
- **Fix:** Add global error handler, process-level rejection handling

---

## Infrastructure Issues

| Issue | Location | Severity | Description |
|-------|----------|----------|-------------|
| No database migrations | `migrations/` (missing) | CRITICAL | Cannot version schema changes |
| No `.env.example` | Project root | CRITICAL | Developers can't run locally |
| Redis unused | `docker-compose.yml:54-64` | HIGH | Infrastructure waste |
| Hardcoded K8s ports | `infrastructure/k8s/*.yaml` | MEDIUM | Difficult to manage |
| Missing egress policies | `infrastructure/k8s/` | MEDIUM | Security risk |
| Health checks inconsistent | Various | MEDIUM | K8s may kill healthy pods |

---

## Test Coverage Issues

| Area | Files | Lines | Tests | Priority |
|------|-------|-------|-------|----------|
| Trading Engine | 3 | 3,807 | 0 | CRITICAL |
| AI Decision | 6 | 3,200+ | 0 | CRITICAL |
| API Routes | 8 | 6,500+ | 0 | HIGH |
| Connectors | 13 | 5,000+ | 0 | HIGH |
| Strategies | 4 | 1,600+ | 0 | HIGH |
| Universe | 7 | 1,400+ | 0 | MEDIUM |

---

## Resolution Tracking

| Bug ID | Status | Assigned | Sprint | PR |
|--------|--------|----------|--------|-----|
| BUG-001 | Open | - | 1 | - |
| BUG-002 | Open | - | 1 | - |
| BUG-003 | Open | - | 1 | - |
| ... | ... | ... | ... | ... |

---

*Update this document when bugs are discovered or resolved.*
