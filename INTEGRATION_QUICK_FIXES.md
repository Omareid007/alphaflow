# INTEGRATION TEST - QUICK FIXES

**Priority-ordered fixes to address integration test failures**

---

## CRITICAL FIX #1: Data Fusion Engine Not Initialized

**Error:** `Data fusion engine not initialized`
**Impact:** Breaks autonomous trading, multi-source data aggregation
**Files Affected:** 3 tests failed

### Fix

**File:** `/home/runner/workspace/server/ai/data-fusion-engine.ts`

Check if the file exports a singleton instance:

```typescript
// WRONG (if this is the case):
export class DataFusionEngine {
  async fuseMarketData() { ... }
}

// CORRECT (should be):
export class DataFusionEngine {
  async fuseMarketData() { ... }
}

export const dataFusionEngine = new DataFusionEngine();
```

**OR** if the file is in a different location:

```bash
# Find the file
find . -name "data-fusion-engine.ts" -type f

# Check exports
grep -n "export" server/ai/data-fusion-engine.ts
```

---

## CRITICAL FIX #2: AI Decision Engine Missing Method

**Error:** `Decision Engine missing generateDecision method`
**Impact:** AI trading signals cannot be generated
**Files Affected:** 3 tests failed

### Fix

**File:** `/home/runner/workspace/server/ai/decision-engine.ts`

Check method name:

```typescript
// The import expects:
aiDecisionEngine.generateDecision()

// But the file might have:
aiDecisionEngine.makeDecision()
// OR
aiDecisionEngine.generateTradeDecision()
```

**Action:**
1. Open `server/ai/decision-engine.ts`
2. Find the main decision method
3. Either:
   - Rename it to `generateDecision`, OR
   - Add an alias: `generateDecision = this.makeDecision`
   - Update test to use correct method name

---

## CRITICAL FIX #3: External API Connector Exports

**Error:** `Cannot read properties of undefined (reading 'getRecentFilings')`
**Impact:** Cannot fetch external data (SEC, FINRA, etc.)
**Files Affected:** 5 tests failed

### Fix #3a: SEC Edgar

**File:** `/home/runner/workspace/server/connectors/sec-edgar.ts`

Check export:

```typescript
// WRONG:
export class SECEdgar { ... }

// CORRECT:
export class SECEdgar { ... }
export const secEdgar = new SECEdgar();
```

### Fix #3b: FINRA

**File:** `/home/runner/workspace/server/connectors/finra.ts`

Check if `getShortInterest` method exists:

```typescript
export class FINRA {
  // Add this method if missing:
  async getShortInterest(symbol: string) {
    // Implementation
  }
}

export const finra = new FINRA();
```

### Fix #3c: Frankfurter

**File:** `/home/runner/workspace/server/connectors/frankfurter.ts`

The API returns data but test expects `rates.EUR`. Check response structure:

```typescript
// Test expects:
const rates = await frankfurter.getLatestRates("USD");
if (!rates.EUR) { ... } // This failed

// Possible fixes:
// 1. Response is { base: "USD", rates: { EUR: 0.92, ... } }
//    - Test should check: rates.rates.EUR
//
// 2. API changed structure
//    - Update connector to return rates.rates instead of rates
```

---

## CRITICAL FIX #4: Alpaca Market Data API Call

**Error:** `symbols.join is not a function`
**Impact:** Cannot fetch historical price data
**Files Affected:** 1 test failed

### Fix

**File:** Integration test or any file calling `alpaca.getBars()`

```typescript
// WRONG:
const bars = await alpaca.getBars("AAPL", { ... });
//                                  ^^^^^^ String

// CORRECT:
const bars = await alpaca.getBars(["AAPL"], { ... });
//                                 ^^^^^^^^ Array
```

**Where to fix:**
- If in test: `/home/runner/workspace/scripts/comprehensive-integration-test.ts` line ~388
- If in connector: `/home/runner/workspace/server/connectors/alpaca.ts`

---

## CRITICAL FIX #5: Event Bus Not Initialized

**Error:** `eventBus is not defined`
**Impact:** Inter-service messaging broken
**Files Affected:** 1 test failed

### Fix

**File:** `/home/runner/workspace/server/orchestration/index.ts` (or similar)

Check export:

```typescript
// WRONG (if this is the case):
const eventBus = createEventBus();
export { logger, coordinator }; // eventBus missing!

// CORRECT:
const eventBus = createEventBus();
export { eventBus, logger, coordinator };
```

---

## HIGH PRIORITY FIX #1: Session Foreign Key Constraint

**Error:** `insert or update on table "sessions" violates foreign key constraint`
**Impact:** Session tests cannot run (but production likely OK)
**Files Affected:** 4 tests failed

### Fix

**This is NOT a bug in production code!** It's a test data issue.

**File:** `/home/runner/workspace/scripts/comprehensive-integration-test.ts`

Update session tests to create user first:

```typescript
// WRONG (current):
await runTest(
  "Auth Integration",
  "Session creation and database storage",
  async () => {
    const testSessionUserId = `session-test-${Date.now()}`;
    sessionId = await createSession(testSessionUserId); // User doesn't exist!
  }
);

// CORRECT:
await runTest(
  "Auth Integration",
  "Session creation and database storage",
  async () => {
    // Create user FIRST
    const testSessionUserId = `session-test-${Date.now()}`;
    await storage.createUser({
      id: testSessionUserId,
      username: `session-test-${Date.now()}`,
      password: await bcrypt.hash("test", 10),
    });

    // NOW create session
    sessionId = await createSession(testSessionUserId); // User exists!
  }
);
```

**Apply same fix to:**
- Session retrieval test
- Session expiration test
- Session deletion test
- Session cleanup test

---

## HIGH PRIORITY FIX #2: LLM Configuration

**Error:** `No LLM provider configured`
**Impact:** AI features won't work
**Files Affected:** 1 test failed (but affects production)

### Fix

**File:** `.env`

Add at least one LLM API key:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# OR Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OR both (for fallback)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## HIGH PRIORITY FIX #3: WebSocket Subscription Methods

**Error:** `Alpaca stream missing subscription methods`
**Impact:** Real-time trade updates not working
**Files Affected:** 1 test failed

### Fix

**File:** `/home/runner/workspace/server/trading/alpaca-stream.ts`

Add subscription method:

```typescript
export class AlpacaStream {
  // Add this method if missing:
  subscribeToTrades(symbols: string[], callback: (trade: Trade) => void) {
    // Implementation
    this.client.subscribe(['trade'], symbols, (data) => {
      callback(data);
    });
  }
}
```

---

## HIGH PRIORITY FIX #4: Budget Tracking Export

**Error:** `getValyuBudgetStats is not a function`
**Impact:** Cannot track LLM costs
**Files Affected:** 1 test failed

### Fix

**File:** `/home/runner/workspace/server/lib/valyuBudget.ts`

Check if function is exported:

```typescript
// Add export if missing:
export function getValyuBudgetStats() {
  return {
    totalSpent: 0,
    // ... other stats
  };
}
```

---

## MEDIUM PRIORITY FIX #1: Tool Router Initialization

**Error:** `Tool Router not initialized`
**Impact:** AI tool calling not working
**Files Affected:** 1 test failed

### Fix

**File:** `/home/runner/workspace/server/ai/toolRouter.ts`

Export singleton:

```typescript
// Add at end of file:
export const toolRouter = new ToolRouter();
```

---

## MEDIUM PRIORITY FIX #2: Alert Service Method

**Error:** `Alert service missing evaluateAlerts method`
**Impact:** Alert evaluation not working
**Files Affected:** 1 test failed

### Fix

**File:** `/home/runner/workspace/server/observability/alertService.ts`

Add method:

```typescript
export class AlertService {
  // Add this method if missing:
  async evaluateAlerts() {
    // Implementation
  }
}
```

---

## MEDIUM PRIORITY FIX #3: Database Pool Stats

**Error:** `Database pool stats not available`
**Impact:** Cannot monitor database connections
**Files Affected:** 1 test failed

### Fix

**File:** `/home/runner/workspace/server/db.ts`

Check `getPoolStats` export:

```typescript
// Should have:
export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}
```

---

## MEDIUM PRIORITY FIX #4: LLM Cache Stats

**Error:** `LLM cache stats not available`
**Impact:** Cannot monitor LLM cache performance
**Files Affected:** 1 test failed

### Fix

**File:** `/home/runner/workspace/server/ai/llmGateway.ts`

Update `getLLMCacheStats` to return proper structure:

```typescript
export function getLLMCacheStats() {
  return {
    hits: cacheHits,
    misses: cacheMisses,
    size: cache.size,
  };
}
```

---

## MEDIUM PRIORITY FIX #5: API Cache Stats

**Error:** `Cache stats not available`
**Impact:** Cannot monitor API cache
**Files Affected:** 1 test failed

### Fix

**File:** `/home/runner/workspace/server/lib/persistentApiCache.ts`

Update `getCacheStats` to return proper structure:

```typescript
export async function getCacheStats() {
  return {
    entryCount: await getEntryCount(),
    hitRate: calculateHitRate(),
    // ... other stats
  };
}
```

---

## TEST-ONLY FIX: Standard Error Handling

**Error:** `res.status is not a function`
**Impact:** None (test expects Express response object)
**Files Affected:** 1 test failed

### Fix

**File:** `/home/runner/workspace/scripts/comprehensive-integration-test.ts`

Update test to not call error constructors directly:

```typescript
// WRONG:
const badReq = badRequest("Test error");
if (badReq.status !== 400) { ... }

// CORRECT:
const err = badRequest("Test error");
if (err.statusCode !== 400) { ... } // Use statusCode, not status
```

---

## Quick Fix Script

Run these commands to quickly identify and fix issues:

```bash
# 1. Check Data Fusion Engine export
grep -n "export" server/ai/data-fusion-engine.ts

# 2. Check AI Decision Engine methods
grep -n "generateDecision\|makeDecision" server/ai/decision-engine.ts

# 3. Check SEC Edgar export
grep -n "export.*secEdgar" server/connectors/sec-edgar.ts

# 4. Check FINRA methods
grep -n "getShortInterest" server/connectors/finra.ts

# 5. Check Event Bus export
grep -n "export.*eventBus" server/orchestration/index.ts

# 6. Find all getBars calls
grep -rn "getBars" server/

# 7. Check all exports
for file in server/connectors/*.ts; do
  echo "=== $file ==="
  grep "export" "$file"
done
```

---

## Testing After Fixes

After applying fixes, re-run integration tests:

```bash
tsx scripts/comprehensive-integration-test.ts
```

**Expected improvements:**
- Database Integration: Already 100%
- Alpaca Integration: Should reach 100% (fix getBars)
- External APIs: Should reach 80%+ (fix exports)
- AI Integration: Should reach 80%+ (fix exports + config)
- Auth Integration: Should reach 100% (fix test data)
- Overall: Should reach 85%+ passing

---

## Summary

**Total Fixes Required:** 15
- **Critical (must fix):** 5
- **High Priority:** 4
- **Medium Priority:** 5
- **Test-only:** 1

**Estimated Time:**
- Critical fixes: 2-3 hours
- High priority: 1-2 hours
- Medium priority: 1-2 hours
- **Total: 4-7 hours**

**Order of Operations:**
1. Fix Data Fusion Engine export (enables autonomous trading)
2. Fix AI Decision Engine method (enables AI signals)
3. Fix external API exports (enables data aggregation)
4. Fix Alpaca getBars call (enables historical data)
5. Fix Event Bus export (enables real-time messaging)
6. Fix session test data (enables session testing)
7. Configure LLM providers (enables AI features)
8. Fix remaining medium priority items

After fixing items 1-5, the system should be **production-ready for autonomous trading**.
