# Testing Documentation

> **Purpose**  
> This document defines the testing strategy, test categories, execution commands, and human-executable test scenarios for the AI Active Trader application.

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Test Categories](#2-test-categories)
3. [Test Infrastructure](#3-test-infrastructure)
4. [Running Tests](#4-running-tests)
5. [Human-Executable Test Scenarios](#5-human-executable-test-scenarios)
6. [API Testing](#6-api-testing)
7. [E2E Testing Guidelines](#7-e2e-testing-guidelines)
8. [Test Data Management](#8-test-data-management)
9. [Known Testing Gaps](#9-known-testing-gaps)

---

## 1. Testing Philosophy

### 1.1 Core Principles

1. **Test what matters:** Focus on business-critical paths (trading, P&L, AI decisions)
2. **Prefer E2E for user flows:** Use Playwright for complete user journeys
3. **Mock external services:** Never hit live APIs in automated tests
4. **Deterministic results:** Tests must produce the same result every run
5. **Fast feedback:** Tests should run quickly to enable rapid iteration

### 1.2 Testing Pyramid

```
            ┌─────────┐
            │  E2E    │  ← Few, high-value user journey tests
            ├─────────┤
            │ Integr- │  ← API endpoint tests with mocked services
            │  ation  │
            ├─────────┤
            │  Unit   │  ← Many, fast tests for business logic
            └─────────┘
```

### 1.3 What MUST Be Tested

| Category | Test Type | Priority |
|----------|-----------|----------|
| P&L calculations | Unit | Critical |
| Trade execution | Integration + E2E | Critical |
| Risk limit enforcement | Unit + Integration | Critical |
| AI decision generation | Unit (mocked LLM) | High |
| Position sync | Integration | High |
| Dashboard data display | E2E | Medium |
| Strategy CRUD | Integration | Medium |

---

## 2. Test Categories

### 2.1 Unit Tests

**Purpose:** Test individual functions and modules in isolation.

**Scope:**
- Numeric utilities (`safeParseFloat`, `calculatePnL`)
- Business logic calculations
- Data transformations
- Validation functions

**Characteristics:**
- No database access
- No network calls
- No external dependencies
- Execute in milliseconds

**Example locations:**
- `server/utils/numeric.ts` → test pure calculation functions
- `server/ai/decision-engine.ts` → test decision parsing (mocked LLM)

### 2.2 Integration Tests

**Purpose:** Test API endpoints with real database but mocked external services.

**Scope:**
- REST API endpoints
- Database operations via storage layer
- Multiple module interactions

**Characteristics:**
- Uses test database
- Mocks external APIs (Alpaca, OpenAI, Finnhub)
- Verifies request/response contracts
- Tests error handling

### 2.3 E2E Tests (Playwright)

**Purpose:** Test complete user flows through the web interface.

**Scope:**
- User authentication
- Dashboard interactions
- Trade execution via UI
- Strategy management

**Characteristics:**
- Runs in real browser
- Uses development database
- Tests actual user experience
- Captures screenshots on failure

---

## 3. Test Infrastructure

### 3.1 Current State

| Component | Status | Notes |
|-----------|--------|-------|
| **Unit Test Framework** | Configured | Vitest with vitest.config.ts |
| **Integration Tests** | Partial | Manual curl commands |
| **E2E Framework** | Available | Playwright via `run_test` tool |
| **Test Database** | Shared | Uses development database |
| **Mocking Library** | Not set up | MSW recommended for API mocking |

### 3.2 Running Unit Tests

```bash
# Run all unit tests once
npx vitest run

# Run tests in watch mode
npx vitest

# Run specific test file
npx vitest run server/utils/numeric.test.ts

# Run tests with coverage
npx vitest run --coverage
```

### 3.3 Test File Naming

| Pattern | Purpose |
|---------|---------|
| `*.test.ts` | Unit tests |
| `*.spec.ts` | Integration tests |
| `*.e2e.ts` | E2E tests |

---

## 4. Running Tests

### 4.1 Manual API Testing

```bash
# Health check
curl http://localhost:5000/api/alpaca/health

# Get agent status
curl http://localhost:5000/api/agent/status

# Get positions
curl http://localhost:5000/api/positions

# Get trades
curl http://localhost:5000/api/trades

# Get analytics summary
curl http://localhost:5000/api/analytics/summary

# Start agent
curl -X POST http://localhost:5000/api/autonomous/start

# Stop agent
curl -X POST http://localhost:5000/api/autonomous/stop

# Get orchestrator state
curl http://localhost:5000/api/autonomous/state
```

### 4.2 E2E Testing with Playwright

Use the `run_test` tool with a structured test plan:

```
[New Context] Create a new browser context
[Browser] Navigate to dashboard (path: /)
[Verify] Assert dashboard loads with positions widget
[Browser] Click on Strategies tab
[Verify] Assert strategies list is visible
```

### 4.3 Database Queries for Verification

```sql
-- Check trades with P&L
SELECT id, symbol, side, quantity, price, pnl, executed_at 
FROM trades 
ORDER BY executed_at DESC 
LIMIT 10;

-- Check positions
SELECT id, symbol, quantity, entry_price, current_price, unrealized_pnl 
FROM positions;

-- Check AI decisions
SELECT id, symbol, action, confidence, status, created_at 
FROM ai_decisions 
ORDER BY created_at DESC 
LIMIT 5;

-- Check agent status
SELECT * FROM agent_status LIMIT 1;
```

---

## 5. Human-Executable Test Scenarios

### 5.1 Scenario: Dashboard Data Accuracy

**Objective:** Verify dashboard displays accurate financial data.

**Prerequisites:**
- App running at `http://localhost:5000`
- At least one open position exists

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open browser to `http://localhost:5000` | Dashboard loads |
| 2 | Observe Total Equity value | Shows non-zero dollar amount |
| 3 | Compare with `/api/alpaca/account` response | Values match within $1 |
| 4 | Observe Unrealized P&L | Shows colored (green/red) value |
| 5 | Compare position P&L with Alpaca positions | Values match |

**Pass Criteria:** All financial values match between UI and API.

---

### 5.2 Scenario: Agent Start/Stop

**Objective:** Verify agent can be started and stopped correctly.

**Prerequisites:**
- App running
- Agent currently stopped

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `GET /api/agent/status` | `isRunning: false` |
| 2 | Call `POST /api/autonomous/start` | Success response |
| 3 | Wait 5 seconds | - |
| 4 | Call `GET /api/agent/status` | `isRunning: true` |
| 5 | Check logs for `[Orchestrator] Started` | Log message present |
| 6 | Call `POST /api/autonomous/stop` | Success response |
| 7 | Call `GET /api/agent/status` | `isRunning: false` |

**Pass Criteria:** Agent transitions correctly between states.

---

### 5.3 Scenario: Trade Execution

**Objective:** Verify a trade executes and P&L is calculated.

**Prerequisites:**
- Agent running
- Sufficient cash balance
- Market open (or use crypto for 24/7)

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Note current cash balance | Record value |
| 2 | Wait for AI decision or trigger manually | AI decision generated |
| 3 | Check `/api/autonomous/execution-history` | New execution entry |
| 4 | Check `/api/positions` | New position created |
| 5 | Check `/api/alpaca/positions` | Position exists in Alpaca |
| 6 | Check cash balance | Reduced by trade value |

**Pass Criteria:** Trade executes, position created, cash updated.

---

### 5.4 Scenario: Risk Limit Enforcement

**Objective:** Verify risk limits prevent excessive trades.

**Prerequisites:**
- Agent running
- Risk limits configured

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set `maxPositionsCount: 2` via API | Updated |
| 2 | Create 2 positions | Positions exist |
| 3 | Attempt third trade | Trade rejected with reason |
| 4 | Check AI decision status | `status: skipped` |
| 5 | Check `skipReason` | Contains "max positions" |

**Pass Criteria:** Risk limits enforced correctly.

---

### 5.5 Scenario: Kill Switch

**Objective:** Verify kill switch halts all trading.

**Prerequisites:**
- Agent running
- At least one open position

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `POST /api/autonomous/kill-switch` with `{active: true}` | Success |
| 2 | Check agent status | `killSwitchActive: true` |
| 3 | Attempt to start agent | Agent refuses to start |
| 4 | Call kill switch with `{active: false}` | Success |
| 5 | Start agent | Agent starts normally |

**Pass Criteria:** Kill switch prevents trading until disabled.

---

### 5.6 Scenario: Position Sync

**Objective:** Verify DB positions sync with Alpaca.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `GET /api/alpaca/positions` | Get Alpaca positions |
| 2 | Call `GET /api/positions` | Get app positions |
| 3 | Compare symbol, quantity, prices | Should match or sync |
| 4 | Call `POST /api/autonomous/sync-positions` | Sync executed |
| 5 | Call `GET /api/positions` again | Updated to match Alpaca |

**Pass Criteria:** Positions synchronized correctly.

---

## 6. API Testing

### 6.1 Critical Endpoints to Test

| Endpoint | Method | Test Cases |
|----------|--------|------------|
| `/api/positions` | GET | Returns live Alpaca positions |
| `/api/trades` | GET | Returns trades with P&L |
| `/api/analytics/summary` | GET | Returns accurate totals |
| `/api/autonomous/start` | POST | Starts agent successfully |
| `/api/autonomous/stop` | POST | Stops agent gracefully |
| `/api/autonomous/kill-switch` | POST | Activates/deactivates kill switch |
| `/api/agent/set-limits` | POST | Updates order limits |

### 6.2 Error Cases to Test

| Scenario | Expected Behavior |
|----------|-------------------|
| Invalid JSON body | 400 Bad Request |
| Missing required fields | 400 with field name |
| Alpaca API down | 503 Service Unavailable |
| Database connection lost | 500 with error logged |
| Unauthorized access | 401 Unauthorized |

---

## 7. E2E Testing Guidelines

### 7.1 Test Plan Format

```
1. [New Context] Create a new browser context
2. [Browser] Navigate to the page (path: /path)
3. [Browser] Click on element
4. [Verify] Assert expected behavior
5. [API] Make API call if needed
6. [DB] Query database if needed
```

### 7.2 Viewport Configuration

Use mobile dimensions for accurate testing:
- Width: 402px
- Height: 874px

### 7.3 Unique Test Data

Generate unique values to avoid conflicts:
```typescript
const uniqueId = nanoid(6);
const testEmail = `test-${uniqueId}@example.com`;
```

### 7.4 Cleanup

Tests should clean up after themselves when modifying data:
- Delete test records after verification
- Reset modified settings

---

## 8. Test Data Management

### 8.1 Current Approach

- **Development database:** Used for all testing
- **No isolated test database:** Tests share data with development
- **Manual cleanup:** May be required after test runs

### 8.2 Test Data Guidelines

| Data Type | Approach |
|-----------|----------|
| Users | Use test-prefixed usernames |
| Strategies | Create with "TEST-" prefix |
| Trades | Created through normal execution |
| Positions | Sync from Alpaca (paper trading) |

### 8.3 Known Test Data Issues

- ~245 historical trades have `price = 0`
- These trades cannot be used for P&L verification
- New trades have correct price data

---

## 9. Known Testing Gaps

### 9.1 Current Test Coverage

| Area | Status | Test Count | Priority |
|------|--------|------------|----------|
| **Numeric utilities** | Covered | 39 tests | Complete |
| **P&L calculations** | Covered | 14 tests | Complete |
| **Percent change** | Covered | 6 tests | Complete |
| **Safe parsing** | Covered | 10 tests | Complete |
| **Formatting functions** | Covered | 9 tests | Complete |
| Risk limits | Manual | 0 tests | High |
| AI decisions | Manual | 0 tests | Medium |
| Position sync | Manual | 0 tests | Medium |
| Error handling | Limited | 0 tests | Medium |

### 9.2 Missing Test Coverage

| Area | Gap | Priority |
|------|-----|----------|
| Risk limit enforcement | No automated tests | High |
| AI decisions | No mocked LLM tests | Medium |
| Position sync | Manual testing only | Medium |
| Error handling | Limited coverage | Medium |
| API endpoints | No integration tests | Medium |

### 9.3 Recommended Next Steps

1. **Add integration tests** for critical API endpoints
2. **Create mock fixtures** for Alpaca and OpenAI responses
3. **Add risk limit tests** for order enforcement logic
4. **Document E2E test scenarios** in this file as they're created

### 9.4 Test Debt Backlog

| Item | Description | Status | Effort |
|------|-------------|--------|--------|
| Set up Vitest | Configure test runner | Done | - |
| Unit tests for numeric.ts | Test calculation functions | Done (39 tests) | - |
| Mock Alpaca responses | Create fixtures | TODO | 4h |
| Integration test suite | Test critical endpoints | TODO | 8h |
| Risk limit tests | Test order enforcement | TODO | 4h |
| CI/CD integration | Run tests on commit | TODO | 4h |

---

## Changelog

| Date | Change |
|------|--------|
| Dec 2024 | Initial testing documentation |

---

*Last Updated: December 2024*
