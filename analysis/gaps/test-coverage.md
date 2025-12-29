# Test Coverage Gap Analysis

Comprehensive analysis of test coverage gaps in the AlphaFlow Trading Platform.

## Executive Summary

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Overall coverage | < 5% | 60% | 55% |
| Unit tests | 2 files | 50+ files | 48 files |
| Integration tests | 4 files | 20+ files | 16 files |
| E2E tests | 0 files | 10+ files | 10 files |
| Test files total | 11 | 80+ | 69 files |

## Current Test Inventory

### Existing Tests

| File | Type | Lines | Coverage |
|------|------|-------|----------|
| `tests/unit/components/button.test.tsx` | Unit | 45 | Button component |
| `tests/unit/components/error-boundary.test.tsx` | Unit | 42 | Error boundary |
| `tests/integration/api-endpoints.test.ts` | Integration | 156 | API endpoints |
| `tests/integration/data-flow.test.ts` | Integration | 134 | Data flow |
| `tests/integration/ai-pipeline.test.ts` | Integration | 178 | AI pipeline |
| `tests/integration/trading-engine-fixes.test.ts` | Integration | 176 | Trading engine |
| `tests/services/trading-session-manager.test.ts` | Unit | 217 | Session manager |
| `tests/lib/sanitization.test.ts` | Unit | 347 | Input sanitization |
| `tests/examples/*.ts` | Examples | 260 | Usage examples |

**Total: 1,555 lines of tests**

### Test Configuration

| Config | Status | Location |
|--------|--------|----------|
| Vitest | Configured | `vitest.config.ts` |
| React Testing | Configured | `tests/setup-react.ts` |
| Test Utils | Created | `tests/utils/render.tsx` |
| Playwright | Not installed | - |
| E2E Config | Missing | - |

## Critical Untested Areas

### Priority 0: Trading Core (CRITICAL)

| Module | Risk | Lines | Current Tests |
|--------|------|-------|---------------|
| `server/trading/alpaca-trading-engine.ts` | High | 800+ | 0 |
| `server/trading/order-retry-handler.ts` | High | 300+ | 0 |
| `server/autonomous/orchestrator.ts` | High | 600+ | 0 |
| `server/autonomous/position-manager.ts` | High | 400+ | 0 |
| `server/connectors/alpaca.ts` | High | 1000+ | 0 |

### Priority 1: AI Decision Making

| Module | Risk | Lines | Current Tests |
|--------|------|-------|---------------|
| `server/ai/llmGateway.ts` | High | 800+ | 0 |
| `server/ai/decision-engine.ts` | High | 700+ | 0 |
| `server/trading/ai-analyzer.ts` | High | 500+ | 0 |
| `server/ai/roleBasedRouter.ts` | Medium | 400+ | 0 |

### Priority 2: API Routes

| Module | Risk | Lines | Current Tests |
|--------|------|-------|---------------|
| `server/routes/alpaca.ts` | High | 300+ | Partial |
| `server/routes/strategies.ts` | Medium | 200+ | 0 |
| `server/routes/backtests.ts` | Medium | 250+ | 0 |
| `server/routes/auth.ts` | High | 150+ | 0 |

### Priority 3: Frontend Components

| Component | Risk | Current Tests |
|-----------|------|---------------|
| Strategy Wizard | Medium | 0 |
| Portfolio Dashboard | Medium | 0 |
| Admin Pages | Low | 0 |
| Settings Page | Low | 0 |

## Test Coverage by Directory

```
server/
├── ai/           0% coverage (0 tests)
├── autonomous/   0% coverage (0 tests)
├── connectors/   0% coverage (0 tests)
├── routes/       5% coverage (partial)
├── services/     10% coverage (1 test file)
├── trading/      5% coverage (1 test file)
├── lib/          15% coverage (1 test file)
└── middleware/   0% coverage (0 tests)

app/              0% coverage (0 E2E tests)
components/       2% coverage (2 unit tests)
lib/              5% coverage (1 test file)
```

## Recommended Test Plan

### Phase 1: Critical Trading Tests (Week 1-2)

#### Unit Tests Needed

```typescript
// tests/trading/order-execution.test.ts
describe('OrderExecution', () => {
  describe('placeOrder', () => {
    it('should create market order successfully');
    it('should create limit order with price');
    it('should create bracket order with stops');
    it('should validate order parameters');
    it('should handle insufficient buying power');
  });

  describe('orderRetry', () => {
    it('should retry failed orders up to 3 times');
    it('should generate unique client_order_id on retry');
    it('should not retry rejected orders');
  });
});
```

#### Integration Tests Needed

```typescript
// tests/integration/trading-flow.test.ts
describe('TradingFlow', () => {
  it('should execute market buy and update positions');
  it('should execute limit sell and update portfolio');
  it('should handle order rejection gracefully');
  it('should reconcile positions with broker');
});
```

### Phase 2: AI Pipeline Tests (Week 3-4)

```typescript
// tests/ai/decision-engine.test.ts
describe('DecisionEngine', () => {
  describe('generateSignal', () => {
    it('should generate BUY signal with high confidence');
    it('should generate SELL signal on negative indicators');
    it('should return HOLD when uncertain');
    it('should combine technical and sentiment factors');
  });

  describe('fallback', () => {
    it('should use technical analysis when LLM unavailable');
    it('should log decision rationale');
  });
});
```

### Phase 3: E2E Tests (Week 5-6)

```typescript
// tests/e2e/auth.spec.ts
test.describe('Authentication', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="username"]', 'testuser');
    await page.fill('[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/home');
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="username"]', 'invalid');
    await page.fill('[name="password"]', 'wrong');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-message')).toBeVisible();
  });
});

// tests/e2e/strategy-crud.spec.ts
test.describe('Strategy Management', () => {
  test('should create new strategy', async ({ page }) => {
    await page.goto('/create');
    // Fill wizard steps
    // Verify strategy created
  });

  test('should run backtest on strategy', async ({ page }) => {
    await page.goto('/strategies/123');
    await page.click('text=Run Backtest');
    // Configure and run
    // Verify results displayed
  });
});
```

## Test Infrastructure Needed

### 1. Install Dependencies

```bash
npm install -D @playwright/test playwright
npm install -D @testing-library/user-event
npm install -D msw # for API mocking
```

### 2. Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 2,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### 3. Mock Server Setup

```typescript
// tests/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/portfolio/snapshot', (req, res, ctx) => {
    return res(ctx.json({
      equity: 100000,
      cash: 25000,
      // ...mock data
    }));
  }),
  // More handlers
];
```

## Coverage Targets by Module

| Module | Current | Week 4 | Week 8 | Final |
|--------|---------|--------|--------|-------|
| Trading Core | 0% | 40% | 70% | 80% |
| AI Pipeline | 0% | 30% | 60% | 70% |
| API Routes | 5% | 40% | 70% | 80% |
| Frontend | 2% | 20% | 50% | 60% |
| **Overall** | **<5%** | **30%** | **50%** | **60%** |

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:coverage
        env:
          COVERAGE_THRESHOLD: 60
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: codecov/codecov-action@v3
```

## Success Criteria

| Metric | Target |
|--------|--------|
| Unit test coverage | > 70% |
| Integration test coverage | > 60% |
| E2E critical paths | 100% |
| No critical bugs | Yes |
| All P0 tests passing | Yes |
| CI pipeline green | Yes |
