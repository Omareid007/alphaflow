# Gap Fix Specification: Test Infrastructure

## Overview

| Attribute | Value |
|-----------|-------|
| Gap ID | G-002 |
| Priority | P0 |
| Effort | 4-6 weeks |
| Current State | < 5% coverage, 11 test files |
| Target State | > 60% coverage, 80+ test files |

## Problem Statement

The platform has minimal test coverage (< 5%) with only 11 test files for 485+ source files. Critical trading logic, AI decision making, and API endpoints are largely untested.

## Goals

1. Achieve 60%+ overall code coverage
2. 80%+ coverage for critical trading paths
3. E2E tests for all major user flows
4. CI/CD integration with coverage gates

## Current State

### Existing Test Files

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

### Missing Coverage (Critical)

| Module | Lines | Tests | Risk |
|--------|-------|-------|------|
| server/trading/alpaca-trading-engine.ts | 800+ | 0 | HIGH |
| server/autonomous/orchestrator.ts | 600+ | 0 | HIGH |
| server/ai/llmGateway.ts | 800+ | 0 | HIGH |
| server/connectors/alpaca.ts | 1000+ | 0 | HIGH |

## Test Strategy

### Test Pyramid

```
        /\
       /E2E\         5% - Critical flows
      /------\
     /  Int   \     25% - API & services
    /----------\
   /    Unit    \   70% - Functions & components
  /--------------\
```

### Coverage Targets by Module

| Module | Target | Priority |
|--------|--------|----------|
| Trading Core | 80% | P0 |
| AI Pipeline | 70% | P0 |
| API Routes | 70% | P1 |
| Autonomous | 80% | P0 |
| Frontend | 50% | P2 |

## Implementation Plan

### Phase 1: Infrastructure Setup (Week 1)

#### Install Dependencies

```bash
# Testing libraries
npm install -D @playwright/test playwright
npm install -D @testing-library/user-event
npm install -D msw@latest
npm install -D supertest @types/supertest
npm install -D @vitest/coverage-c8

# Mocking
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
      exclude: [
        'node_modules',
        'tests',
        '**/*.d.ts',
        '**/*.config.*',
      ],
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

#### Configure Playwright

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'mobile', use: devices['iPhone 13'] },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

#### Setup MSW Handlers

```typescript
// tests/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // Auth
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(ctx.json({ user: { id: '1', username: 'test' } }));
  }),

  // Portfolio
  rest.get('/api/portfolio/snapshot', (req, res, ctx) => {
    return res(ctx.json({
      equity: 100000,
      cash: 25000,
      dayPnl: 1234,
      positions: [],
    }));
  }),

  // Orders
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

  describe('retryOrder', () => {
    it('should retry with new client_order_id', async () => {
      mockAlpaca.createOrder
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ id: 'order-456', status: 'accepted' });

      const result = await engine.placeOrderWithRetry({
        symbol: 'AAPL',
        qty: 10,
        side: 'buy',
        type: 'market',
      });

      expect(mockAlpaca.createOrder).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('should not retry rejected orders', async () => {
      mockAlpaca.createOrder.mockRejectedValue(new Error('order rejected'));

      const result = await engine.placeOrderWithRetry({
        symbol: 'AAPL',
        qty: 10,
        side: 'buy',
        type: 'market',
      });

      expect(mockAlpaca.createOrder).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
    });
  });
});
```

#### AI Decision Tests

```typescript
// tests/ai/decision-engine.test.ts
import { describe, it, expect, vi } from 'vitest';
import { DecisionEngine } from '../../server/ai/decision-engine';

describe('DecisionEngine', () => {
  describe('generateSignal', () => {
    it('should generate BUY signal with positive indicators', async () => {
      const engine = new DecisionEngine(mockLLMGateway);

      const signal = await engine.generateSignal('AAPL', {
        technical: 0.8,
        sentiment: 0.7,
        momentum: 0.9,
      });

      expect(signal.action).toBe('BUY');
      expect(signal.confidence).toBeGreaterThan(0.7);
    });

    it('should fallback to technical analysis when LLM unavailable', async () => {
      const mockGateway = { call: vi.fn().mockRejectedValue(new Error('LLM unavailable')) };
      const engine = new DecisionEngine(mockGateway);

      const signal = await engine.generateSignal('AAPL', { technical: 0.9 });

      expect(signal.source).toBe('technical');
      expect(signal.action).toBeDefined();
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

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[name="username"]', 'admintest');
    await page.fill('[name="password"]', 'admin1234');
    await page.click('button[type="submit"]');

    // Logout
    await page.click('[data-testid="logout-button"]');
    await expect(page).toHaveURL('/login');
  });
});

// tests/e2e/strategy.spec.ts
test.describe('Strategy Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="username"]', 'admintest');
    await page.fill('[name="password"]', 'admin1234');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/home');
  });

  test('should create new strategy', async ({ page }) => {
    await page.goto('/create');

    // Select template
    await page.click('[data-testid="template-momentum"]');
    await page.click('button:has-text("Next")');

    // Configure
    await page.fill('[name="name"]', 'E2E Test Strategy');
    await page.click('button:has-text("Next")');

    // Verify creation
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('should run backtest', async ({ page }) => {
    await page.goto('/strategies');
    await page.click('[data-testid="strategy-card"]:first-child');
    await page.click('button:has-text("Run Backtest")');

    // Wait for completion
    await expect(page.locator('[data-testid="backtest-results"]')).toBeVisible({
      timeout: 60000,
    });
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

## Success Metrics

| Metric | Current | Week 2 | Week 4 | Week 6 |
|--------|---------|--------|--------|--------|
| Overall coverage | <5% | 20% | 40% | 60% |
| Unit tests | 2 | 20 | 40 | 60 |
| Integration tests | 4 | 10 | 20 | 25 |
| E2E tests | 0 | 5 | 10 | 15 |
| CI pipeline | No | Yes | Yes | Yes |

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
