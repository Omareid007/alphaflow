# Enhancement Proposal: Test Coverage Improvement Plan

## Executive Summary

| Attribute | Value |
|-----------|-------|
| Proposal ID | EP-003 |
| Priority | P0 |
| Risk Level | Low |
| Effort | 4-6 weeks |

## Problem Statement

The platform has critically low test coverage (< 5%) with only 11 test files for 485+ source files. Critical trading logic, AI decision making, and API endpoints are largely untested, creating significant risk for production deployments.

## Current State

### Test File Inventory

| File | Type | Coverage |
|------|------|----------|
| tests/unit/components/button.test.tsx | Unit | Button |
| tests/unit/components/error-boundary.test.tsx | Unit | ErrorBoundary |
| tests/integration/api-endpoints.test.ts | Integration | Partial API |
| tests/integration/data-flow.test.ts | Integration | Data flow |
| tests/integration/ai-pipeline.test.ts | Integration | AI |
| tests/integration/trading-engine-fixes.test.ts | Integration | Trading |
| tests/services/trading-session-manager.test.ts | Unit | Sessions |
| tests/lib/sanitization.test.ts | Unit | Sanitization |

### Critical Gaps

| Module | Lines | Tests | Risk Level |
|--------|-------|-------|------------|
| server/trading/alpaca-trading-engine.ts | 800+ | 0 | CRITICAL |
| server/autonomous/orchestrator.ts | 600+ | 0 | CRITICAL |
| server/ai/llmGateway.ts | 800+ | 0 | HIGH |
| server/connectors/alpaca.ts | 1000+ | 0 | HIGH |
| server/routes/*.ts | 2000+ | 2 | HIGH |

## Proposed Solution

### Test Pyramid Strategy

```
          /\
         /E2E\         5% - Critical user flows
        /------\
       /  Int   \     25% - API & service tests
      /----------\
     /    Unit    \   70% - Functions & components
    /--------------\
```

### Coverage Targets

| Module | Current | Week 2 | Week 4 | Week 6 |
|--------|---------|--------|--------|--------|
| Trading Core | 0% | 40% | 70% | 80% |
| AI Pipeline | 0% | 30% | 60% | 70% |
| API Routes | ~5% | 30% | 50% | 70% |
| Autonomous | 0% | 40% | 70% | 80% |
| Frontend | ~2% | 20% | 35% | 50% |
| **Overall** | **<5%** | **25%** | **45%** | **60%** |

## Implementation Plan

### Phase 1: Infrastructure (Week 1)

#### Install Dependencies

```bash
npm install -D @playwright/test playwright
npm install -D @testing-library/user-event
npm install -D msw@latest
npm install -D supertest @types/supertest
npm install -D @vitest/coverage-c8
npm install -D vitest-mock-extended
```

#### Configure Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules', 'tests', '**/*.d.ts', '**/*.config.*'],
      thresholds: {
        global: {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
      },
    },
  },
});
```

#### Setup MSW Handlers

```typescript
// tests/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(ctx.json({ user: { id: '1', username: 'test' } }));
  }),

  rest.get('/api/portfolio/snapshot', (req, res, ctx) => {
    return res(ctx.json({
      equity: 100000,
      cash: 25000,
      dayPnl: 1234,
      positions: [],
    }));
  }),

  rest.post('/api/alpaca-trading/execute', (req, res, ctx) => {
    return res(ctx.json({
      id: 'order-123',
      status: 'filled',
      filledQty: 10,
    }));
  }),
];
```

### Phase 2: Unit Tests (Week 2-3)

#### Trading Engine Tests

```typescript
// tests/trading/alpaca-trading-engine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlpacaTradingEngine } from '../../server/trading/alpaca-trading-engine';

describe('AlpacaTradingEngine', () => {
  let engine: AlpacaTradingEngine;
  let mockAlpaca: any;

  beforeEach(() => {
    mockAlpaca = {
      createOrder: vi.fn(),
      getOrder: vi.fn(),
      cancelOrder: vi.fn(),
    };
    engine = new AlpacaTradingEngine(mockAlpaca);
  });

  describe('placeOrder', () => {
    it('should create market order successfully', async () => {
      mockAlpaca.createOrder.mockResolvedValue({
        id: 'order-123',
        status: 'accepted',
      });

      const result = await engine.placeOrder({
        symbol: 'AAPL',
        qty: 10,
        side: 'buy',
        type: 'market',
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order-123');
    });

    it('should validate order parameters', async () => {
      await expect(
        engine.placeOrder({ symbol: '', qty: 0, side: 'buy', type: 'market' })
      ).rejects.toThrow('Invalid order parameters');
    });

    it('should handle insufficient buying power', async () => {
      mockAlpaca.createOrder.mockRejectedValue(
        new Error('insufficient buying power')
      );

      const result = await engine.placeOrder({
        symbol: 'AAPL',
        qty: 10000,
        side: 'buy',
        type: 'market',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('buying power');
    });
  });
});
```

#### AI Decision Tests

```typescript
// tests/ai/llm-gateway.test.ts
import { describe, it, expect, vi } from 'vitest';
import { LLMGateway } from '../../server/ai/llmGateway';

describe('LLMGateway', () => {
  describe('routeRequest', () => {
    it('should use primary provider when available', async () => {
      const gateway = new LLMGateway(mockProviders);

      const response = await gateway.routeRequest({
        prompt: 'Analyze AAPL',
        model: 'gpt-4',
      });

      expect(response.provider).toBe('openai');
    });

    it('should fallback to secondary provider on failure', async () => {
      mockProviders.openai.call.mockRejectedValue(new Error('Rate limited'));

      const gateway = new LLMGateway(mockProviders);
      const response = await gateway.routeRequest({
        prompt: 'Analyze AAPL',
        model: 'gpt-4',
      });

      expect(response.provider).toBe('anthropic');
    });
  });
});
```

### Phase 3: Integration Tests (Week 3-4)

```typescript
// tests/integration/strategy-api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/app';

describe('Strategy API', () => {
  let authToken: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'test' });
    authToken = res.body.token;
  });

  describe('GET /api/strategies', () => {
    it('should return strategies for authenticated user', async () => {
      const res = await request(app)
        .get('/api/strategies')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/strategies');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/strategies', () => {
    it('should create new strategy', async () => {
      const res = await request(app)
        .post('/api/strategies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Strategy',
          type: 'momentum',
          config: { symbols: ['AAPL'] },
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });
  });
});
```

### Phase 4: E2E Tests (Week 5-6)

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="username"]', 'admintest');
    await page.fill('[name="password"]', 'admin1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/home');
    await expect(page.locator('nav')).toContainText('Home');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="username"]', 'invalid');
    await page.fill('[name="password"]', 'wrong');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toBeVisible();
  });
});

// tests/e2e/trading.spec.ts
test.describe('Trading Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should place market order', async ({ page }) => {
    await page.goto('/portfolio');
    await page.click('[data-testid="trade-button"]');

    await page.fill('[name="symbol"]', 'AAPL');
    await page.fill('[name="quantity"]', '10');
    await page.selectOption('[name="side"]', 'buy');
    await page.click('button:has-text("Place Order")');

    await expect(page.locator('.success-toast')).toBeVisible();
  });
});
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          fail_ci_if_error: true

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Test Priority Matrix

| Test Area | Priority | Risk if Untested |
|-----------|----------|------------------|
| Order execution | P0 | Financial loss |
| Position management | P0 | Incorrect P&L |
| Authentication | P0 | Security breach |
| AI signal generation | P1 | Bad trades |
| Backtest accuracy | P1 | False confidence |
| API validation | P1 | Data corruption |
| UI components | P2 | UX issues |
| Admin functions | P2 | Operational issues |

## Success Metrics

| Metric | Current | Week 2 | Week 4 | Week 6 |
|--------|---------|--------|--------|--------|
| Overall coverage | <5% | 25% | 45% | 60% |
| Unit tests | 2 | 25 | 45 | 60 |
| Integration tests | 4 | 12 | 20 | 25 |
| E2E tests | 0 | 5 | 10 | 15 |
| CI pipeline | No | Yes | Yes | Yes |
| Flaky tests | N/A | <5% | <2% | 0% |

## Risk Mitigation

### Test Stability
- Use deterministic data in tests
- Mock external dependencies
- Avoid time-dependent assertions
- Implement retry logic for flaky tests

### Coverage vs Speed
- Run unit tests on every commit
- Run integration tests on PR
- Run E2E tests nightly + before release
- Use test parallelization

## Definition of Done

- [ ] Vitest configured with coverage
- [ ] Playwright configured for E2E
- [ ] MSW handlers for API mocking
- [ ] 60% overall code coverage
- [ ] 80% coverage for trading core
- [ ] All E2E tests for critical paths
- [ ] CI/CD pipeline with coverage gates
- [ ] Coverage report in PRs
- [ ] No flaky tests
- [ ] Documentation updated
