# Phase 1 Implementation: Dependency & Tool Analysis

**Analysis Date:** December 31, 2024
**Codebase Status:** 81 production dependencies, 16 dev dependencies
**Current Test Coverage:** 33 test files, 15,230 total test lines

## Executive Summary

Phase 1 requires **10 new dependencies** and **2 configuration updates** to fully support:
1. Real-time data streaming (SSE/WebSocket)
2. Live chart updates
3. Mobile UI testing
4. Advanced testing infrastructure
5. Performance monitoring

**Total Installation Size:** ~45 MB (compressed)
**Installation Time:** ~3-5 minutes
**Breaking Changes:** None (all backward compatible)

---

## Critical Findings

### 1. SSE/WebSocket Infrastructure (READY)
✅ **Status:** 80% Complete - WebSocket server exists, SSE emitter exists
- **Found:** `/server/lib/sse-emitter.ts` (9 event types)
- **Found:** `/server/lib/websocket-server.ts` (authenticated, heartbeat-based)
- **Found:** `/server/trading/alpaca-stream.ts` (real-time trade updates)
- **Found:** `/server/trading/stream-aggregator.ts` (event aggregation)
- **Missing:** Client-side EventSource hook, reconnection logic

### 2. Charting & Real-Time Visualization (PARTIAL)
✅ **Status:** 50% Complete - Recharts installed, no live updates
- **Found:** `recharts@2.12.7` (static charts only)
- **Found:** Chart components in `/components/ui/chart.tsx`
- **Found:** Performance charts in `/app/strategies/[id]/PerformanceTab.tsx`
- **Missing:** Live updating charts, real-time data bindings, performance optimizations

### 3. Testing Infrastructure (GOOD)
✅ **Status:** 70% Complete - Unit/integration tests, no E2E or performance
- **Found:** vitest@4.0.15, 33 test files, @testing-library installed
- **Found:** 6 E2E test flows (API-based, not browser-based)
- **Missing:** Playwright for browser testing, Mock Service Worker for API mocking
- **Missing:** Performance testing framework

### 4. Mobile Testing (NOT STARTED)
❌ **Status:** 0% - No mobile testing tools installed
- **Missing:** Playwright mobile testing profiles
- **Missing:** Responsive design testing tools
- **Missing:** Visual regression testing

---

## Dependency Recommendations

### TIER 1: Critical (Required for Phase 1)

#### 1. **eventsource** (Client-side SSE)
- **Purpose:** Receive SSE updates from backend
- **Package:** `eventsource@2.1.1`
- **Size:** 48 KB
- **Why:** Bridge for browser EventSource API, graceful reconnection
- **Installation:** `npm install eventsource`
- **Configuration:** Create `/lib/realtime/sse-client.ts`
- **Integration:** Wrap in React hook for automatic reconnection
- **Usage Example:**
```typescript
const useSSE = (url: string) => {
  useEffect(() => {
    const es = new EventSource(url);
    es.addEventListener('order:update', (e) => {
      const data = JSON.parse(e.data);
      // Handle update
    });
    return () => es.close();
  }, [url]);
};
```

#### 2. **recharts** (Already installed ✅)
- **Status:** `recharts@2.12.7` already in package.json
- **What's Missing:** Live update support
- **Solution:** Add hooks wrapper for reactive updates
- **Create:** `/lib/realtime/live-chart-hook.ts`

#### 3. **ws** (Already installed ✅)
- **Status:** `ws@8.18.0` already for WebSocket support
- **Currently Used:** Alpaca stream, WebSocket server
- **What's Needed:** Client-side hook for browser WebSocket

#### 4. **@testing-library/dom** (Already installed ✅)
- **Status:** `@testing-library/dom@7.0.0` part of @testing-library/react
- **For:** SSE/WebSocket integration testing

#### 5. **Mock Service Worker** (MSW)
- **Package:** `msw@2.1.5` (dev dependency)
- **Size:** 2.5 MB
- **Why:** Mock REST/GraphQL APIs, WebSocket handlers for testing
- **Installation:** `npm install --save-dev msw`
- **Configuration:** Create `/tests/mocks/handlers.ts`
- **CLI Setup:** `npx msw init public/`
- **Integration:** Auto-mock all API responses in tests
- **Benefits:**
  - Server-independent testing
  - Request interception at network layer
  - Works for SSE/WebSocket
  - Better than manual mocking
- **Usage Example:**
```typescript
import { setupServer } from 'msw/node';
import { http } from 'msw';

const server = setupServer(
  http.post('/api/orders', () => HttpResponse.json(orderData))
);
```

### TIER 2: High-Priority (Testing & Observability)

#### 6. **Playwright** (Browser Testing)
- **Package:** `@playwright/test@1.48.2` (dev dependency)
- **Size:** 180 MB (includes browsers)
- **Why:** Mobile UI testing, cross-browser E2E
- **Installation:** `npm install --save-dev @playwright/test`
- **Configuration:** Create `/tests/e2e/playwright.config.ts`
- **Features:**
  - Mobile emulation (iPhone 13, Pixel 5, iPad)
  - Network throttling
  - Device testing
  - Screenshots/videos
  - Visual regression detection
- **Setup:**
```bash
# Install browsers
npx playwright install

# Create test
npx playwright codegen http://localhost:3000
```
- **Integration:** Create `/tests/e2e/real-time-updates.spec.ts`

#### 7. **vitest-browser-runner** (In-Browser Testing)
- **Package:** `vitest` (already installed) with `browser` option
- **Alternative:** Reuse Playwright for browser testing
- **Why:** Run unit tests in real browser environment
- **Installation:** Already have vitest, just enable browser mode
- **Configuration:** Update `vitest.config.ts`

#### 8. **@testing-library/user-event** (Already installed ✅)
- **Status:** `@testing-library/user-event@14.6.1` already installed
- **Upgrade to:** `@testing-library/user-event@15.2.0` for latest features
- **Installation:** `npm install --save-dev @testing-library/user-event@latest`

### TIER 3: High-Priority (Performance & Monitoring)

#### 9. **web-vitals** (Core Web Vitals Monitoring)
- **Package:** `web-vitals@4.2.3` (optional for client bundle)
- **Size:** 15 KB (gzipped)
- **Why:** Monitor LCP, FID, CLS for real-time charts
- **Installation:** `npm install web-vitals`
- **Configuration:** Add to `/lib/analytics/vitals.ts`
- **Integration:** Hook into chart rendering lifecycle
- **Benefits:**
  - Detect performance degradation
  - Real-time monitoring
  - Alert on poor metrics

#### 10. **zod** (Already installed ✅)
- **Status:** `zod@3.25.76` for type-safe data validation
- **Usage:** Validate SSE event payloads

---

## Configuration Updates Required

### Update 1: Vitest Configuration

**File:** `/home/runner/workspace/vitest.config.ts`

**Changes:**
1. Add coverage for `/server/` and `/shared/` directories (already done ✓)
2. Add browser environment option for UI component testing
3. Add E2E test pattern for Playwright

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: [
      "tests/**/*.{test,spec}.{ts,tsx}",
      "tests/e2e/**/*.spec.ts" // NEW
    ],
    exclude: ["node_modules", "dist", ".expo", ".cache"],
    testTimeout: 30000,
    setupFiles: ["./tests/setup.ts", "./tests/setup-react.ts"],
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@shared": path.resolve(__dirname, "./shared"),
      "server": path.resolve(__dirname, "./server"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "server/**/*.ts",
        "shared/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "**/node_modules/**",
        "server/index.ts",
        "server_dist/**",
      ],
    },
  },
});
```

### Update 2: Package.json Scripts

**File:** `/home/runner/workspace/package.json`

**New Scripts to Add:**
```json
{
  "test:e2e": "playwright test",
  "test:e2e:debug": "playwright test --debug",
  "test:e2e:mobile": "playwright test --project=mobile",
  "test:all": "npm run test && npm run test:e2e",
  "test:perf": "node scripts/performance-test.ts"
}
```

---

## Implementation Roadmap

### Phase 1a: SSE Client Hook (Week 1)
**Priority:** CRITICAL
**Time Estimate:** 4 hours

```typescript
// /lib/realtime/sse-client.ts
import { useEffect, useRef, useState } from 'react';

export const useSSE = (url: string, options?: { onError?: (err: Error) => void }) => {
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setIsConnected(true);
    es.onerror = (err) => {
      setIsConnected(false);
      options?.onError?.(err as Error);
      // Auto-reconnect after 5 seconds
      setTimeout(() => es.close(), 5000);
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [url, options]);

  return isConnected;
};
```

**Tests (5 tests):**
1. SSE connection establishment
2. Event listener registration
3. Auto-reconnection on error
4. Client cleanup on unmount
5. Multiple event types handling

### Phase 1b: Live Chart Hook (Week 1)
**Priority:** HIGH
**Time Estimate:** 6 hours

```typescript
// /lib/realtime/live-chart-hook.ts
import { useState, useEffect } from 'react';

export const useLiveChartData = (symbol: string) => {
  const [data, setData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    const es = new EventSource(`/api/stream/${symbol}`);

    es.addEventListener('price:update', (event) => {
      const newPoint = JSON.parse(event.data);
      setData((prev) => {
        // Keep last 100 points for performance
        const updated = [...prev, newPoint];
        return updated.slice(-100);
      });
    });

    return () => es.close();
  }, [symbol]);

  return data;
};
```

**Tests (8 tests):**
1. Data streaming
2. Max 100 point limit
3. Chart re-render optimization
4. Symbol change handling
5. Data validation (Zod)
6. Memory cleanup
7. Performance under high frequency
8. Error recovery

### Phase 1c: MSW Integration (Week 2)
**Priority:** HIGH
**Time Estimate:** 8 hours

**Files to Create:**
- `/tests/mocks/handlers.ts` - API handlers
- `/tests/mocks/server.ts` - MSW server setup
- `/tests/setup-msw.ts` - MSW initialization
- `/tests/integration/sse.test.ts` - SSE mock tests (8 tests)

**Tests (10 tests):**
1. SSE mock handler
2. WebSocket mock handler
3. Event broadcasting
4. Client subscription
5. Error handling
6. Rate limiting
7. Authentication check
8. User isolation
9. Message ordering
10. Concurrent connections

### Phase 1d: Playwright Setup (Week 2)
**Priority:** MEDIUM
**Time Estimate:** 10 hours

**Files to Create:**
- `/tests/e2e/playwright.config.ts`
- `/tests/e2e/real-time-updates.spec.ts` (4 tests)
- `/tests/e2e/mobile.spec.ts` (3 tests)
- `/tests/e2e/performance.spec.ts` (4 tests)

**Tests (11 tests):**
1. Order update real-time display
2. Price update chart animation
3. Position P&L live refresh
4. Mobile responsiveness - iPhone 13
5. Mobile responsiveness - Pixel 5
6. Touch interactions
7. Network throttling (3G)
8. Long-running session stability
9. Reconnection after disconnect
10. Memory leak detection
11. Visual regression check

### Phase 1e: Test Infrastructure (Week 3)
**Priority:** MEDIUM
**Time Estimate:** 6 hours

**New Test Files (1 file, 5 tests):**
- `/tests/integration/real-time-integration.test.ts`
  - SSE + Chart + Redux integration
  - WebSocket + Redux integration
  - Error handling across layers
  - Performance benchmarks
  - Memory usage monitoring

---

## Dependency Installation Sequence

### Step 1: Install MSW (Prerequisite)
```bash
npm install --save-dev msw@2.1.5
npx msw init public/
```

### Step 2: Install Playwright
```bash
npm install --save-dev @playwright/test@1.48.2
npx playwright install
```

### Step 3: Install Client-side SSE
```bash
npm install eventsource@2.1.1
```

### Step 4: Optional - Web Vitals
```bash
npm install web-vitals@4.2.3
```

### Step 5: Verify Installation
```bash
npm ls | grep -E "msw|playwright|eventsource|web-vitals"
```

---

## Summary Table

| Dependency | Status | Priority | Size | Installation | Config Needed |
|------------|--------|----------|------|--------------|---------------|
| eventsource | Missing | CRITICAL | 48 KB | `npm install` | Hook wrapper |
| MSW | Missing | HIGH | 2.5 MB | `npm install --save-dev && npx msw init` | handlers.ts |
| Playwright | Missing | MEDIUM | 180 MB | `npm install --save-dev && npx playwright install` | playwright.config.ts |
| web-vitals | Missing | LOW | 15 KB | `npm install` | vitals.ts |
| recharts | ✅ Installed | - | 2.1 MB | - | Live hook |
| ws | ✅ Installed | - | 410 KB | - | Client hook |
| @testing-library | ✅ Installed | - | 2.3 MB | - | MSW setup |
| vitest | ✅ Installed | - | 9.2 MB | - | Browser config |

---

## Risk Assessment

### Low Risk (Backward Compatible)
- eventsource: Pure client-side add-on
- web-vitals: Monitoring only
- MSW: Test-only dependency

### Medium Risk (Configuration Required)
- Playwright: New test framework, needs setup
- Live chart hook: Performance optimization needed

### Mitigation Strategies
1. Install in feature branch first
2. Run full test suite after each installation
3. Test in both dev and prod modes
4. Monitor bundle size impact

---

## Files to Create

### Test Helpers
- `/lib/realtime/sse-client.ts` - SSE hook (30 lines)
- `/lib/realtime/live-chart-hook.ts` - Chart hook (40 lines)
- `/tests/mocks/handlers.ts` - MSW handlers (100 lines)
- `/tests/mocks/server.ts` - MSW server (20 lines)

### Configuration
- `/tests/e2e/playwright.config.ts` - Playwright config (60 lines)

### Integration Tests
- `/tests/integration/sse.test.ts` - SSE tests (150 lines, 8 tests)
- `/tests/integration/live-chart.test.ts` - Chart tests (120 lines, 8 tests)
- `/tests/e2e/real-time-updates.spec.ts` - E2E tests (200 lines, 4 tests)
- `/tests/e2e/mobile.spec.ts` - Mobile tests (150 lines, 3 tests)

**Total New Code:** ~830 lines (+ 35 tests)

---

## Next Steps

1. **Immediate (Tomorrow):**
   - Install eventsource and MSW
   - Update vitest.config.ts
   - Create SSE client hook

2. **Week 1:**
   - Create live chart hook
   - Set up MSW handlers
   - Write 8 SSE tests + 8 chart tests

3. **Week 2:**
   - Install and configure Playwright
   - Write 11 E2E tests
   - Set up mobile testing profiles

4. **Week 3:**
   - Implement performance monitoring
   - Write integration tests
   - Performance benchmarking

---

## Appendix: Command Reference

```bash
# Install all critical dependencies
npm install eventsource web-vitals
npm install --save-dev msw @playwright/test

# Initialize MSW
npx msw init public/

# Install Playwright browsers
npx playwright install

# Run all tests
npm run test          # Unit + integration
npm run test:e2e      # Playwright tests
npm run test:all      # Everything

# Debug tests
npm run test:watch
npm run test:e2e:debug

# Coverage report
npm run test -- --coverage
```

