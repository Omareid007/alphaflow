# Phase 1: Quick Install Guide

**Objective:** Get Phase 1 dependencies installed and configured in < 30 minutes

---

## One-Line Installation

```bash
# Install all critical + recommended dependencies
npm install eventsource web-vitals && npm install --save-dev msw @playwright/test && npx msw init public/ && npx playwright install
```

---

## Step-by-Step Installation

### Step 1: SSE Client Library (2 minutes)
```bash
npm install eventsource@2.1.1
```
**Verify:**
```bash
npm ls eventsource
```
**Expected:** `eventsource@2.1.1`

### Step 2: Mock Service Worker (3 minutes)
```bash
npm install --save-dev msw@2.1.5
npx msw init public/
```
**Verify:**
```bash
npm ls msw
ls -la public/mockServiceWorker.js
```
**Expected:**
- `msw@2.1.5`
- `/public/mockServiceWorker.js` exists

### Step 3: Playwright for E2E Testing (10 minutes)
```bash
npm install --save-dev @playwright/test@1.48.2
npx playwright install
```
**Verify:**
```bash
npm ls @playwright/test
npx playwright --version
```
**Expected:**
- `@playwright/test@1.48.2`
- Playwright version output

### Step 4: Optional - Web Vitals Monitoring (1 minute)
```bash
npm install web-vitals@4.2.3
```
**Verify:**
```bash
npm ls web-vitals
```
**Expected:** `web-vitals@4.2.3`

---

## Post-Installation Verification

```bash
# Check all dependencies installed
npm ls | grep -E "eventsource|msw|playwright|web-vitals"

# Verify package.json has new entries
grep -A 3 "\"devDependencies\"" package.json

# Run existing tests (should still pass)
npm run test
```

---

## Configuration Files to Create

### 1. Create MSW Handlers
**File:** `/tests/mocks/handlers.ts`

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  // REST endpoints
  http.post('/api/orders', () => {
    return HttpResponse.json({
      id: 'order-123',
      symbol: 'AAPL',
      qty: 10,
      status: 'filled'
    });
  }),

  http.get('/api/positions', () => {
    return HttpResponse.json([
      { symbol: 'AAPL', qty: 10, avgPrice: 150.25 }
    ]);
  }),

  // WebSocket SSE event stream
  http.get('/api/stream/:symbol', () => {
    return HttpResponse.text('data: dummy', {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  }),
];
```

### 2. Create MSW Server Setup
**File:** `/tests/mocks/server.ts`

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 3. Update Test Setup
**File:** `/tests/setup.ts`

Add after imports:
```typescript
import { server } from './mocks/server';

// Start MSW server before tests
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 4. Create Playwright Config (Optional)
**File:** `/tests/e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## Update package.json Scripts

Add these test scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:mobile": "playwright test --project='Mobile Chrome' --project='Mobile Safari'",
    "test:all": "npm run test && npm run test:e2e",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Quick Validation

```bash
# 1. Check package.json
npm ls eventsource msw @playwright/test web-vitals

# 2. Run unit tests
npm run test

# 3. List Playwright browsers
npx playwright install --list

# 4. Create a simple E2E test
cat > /tmp/test.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveTitle(/AlphaFlow/);
});
EOF

# 5. Run it
npx playwright test /tmp/test.spec.ts
```

---

## Troubleshooting

### Issue: MSW init failed
**Solution:**
```bash
# Create public/mockServiceWorker.js manually
# Or ensure public/ directory exists
mkdir -p public
npx msw init public/
```

### Issue: Playwright install stuck
**Solution:**
```bash
# Cancel and retry with different approach
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
```

### Issue: Tests still failing after install
**Solution:**
```bash
# Clear caches
rm -rf node_modules/.vite
npm run test -- --clearCache

# Run with debug
npm run test -- --reporter=verbose
```

---

## Success Criteria

After installation, verify:

- [ ] `npm ls | grep eventsource` shows v2.1.1
- [ ] `npm ls | grep msw` shows v2.1.5
- [ ] `npm ls | grep @playwright` shows v1.48.2
- [ ] `npx playwright --version` outputs version
- [ ] `npm run test` passes all existing tests
- [ ] `/public/mockServiceWorker.js` exists
- [ ] `/tests/mocks/handlers.ts` created
- [ ] `/tests/mocks/server.ts` created

---

## What This Enables

✅ Real-time SSE updates from backend
✅ Live updating charts with Recharts
✅ MSW-powered API mocking for tests
✅ Browser-based E2E tests with Playwright
✅ Mobile UI testing (iPhone, Pixel, iPad)
✅ Performance monitoring with web-vitals
✅ 35 new tests for Phase 1 features

---

## Time Estimates

| Task | Time | Difficulty |
|------|------|------------|
| Install all packages | 15 min | Easy |
| Create handlers.ts | 5 min | Easy |
| Update test setup | 3 min | Easy |
| Create SSE hook | 30 min | Medium |
| Create chart hook | 45 min | Medium |
| Write 8 SSE tests | 60 min | Medium |
| Write 8 chart tests | 90 min | Medium |
| Set up Playwright | 20 min | Easy |
| Write 11 E2E tests | 120 min | Hard |

**Total Phase 1 Time:** ~6-8 hours of development

---

## Next: Create Hooks

Once dependencies are installed:

```bash
# Create hook directory
mkdir -p lib/realtime

# Create SSE client hook
cat > lib/realtime/sse-client.ts << 'EOF'
import { useEffect, useState } from 'react';

export const useSSE = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(url);
    es.onopen = () => setIsConnected(true);
    es.onerror = () => {
      setIsConnected(false);
      es.close();
    };
    return () => es.close();
  }, [url]);

  return isConnected;
};
EOF

# Create live chart hook
cat > lib/realtime/live-chart-hook.ts << 'EOF'
import { useState, useEffect } from 'react';

export const useLiveChartData = (symbol: string) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const es = new EventSource(`/api/stream/${symbol}`);
    es.addEventListener('price:update', (event) => {
      const newPoint = JSON.parse(event.data);
      setData(prev => [...prev, newPoint].slice(-100));
    });
    return () => es.close();
  }, [symbol]);

  return data;
};
EOF
```

---

## Final Check

```bash
npm run test && echo "✅ All tests pass!"
```

Ready to implement Phase 1!

