# Quick Fix Guide - Alpaca Order Failures

## TL;DR - 3 Critical Bugs to Fix Now

**Success Rate:** 84.31% → Target: >99%
**Time to Fix:** 2-3 hours total
**Impact:** Eliminates 100% of current order failures

---

## Bug #1: System Error - Wrong Method Name (62.5% of failures)

**Error:** `tradingSessionManager.getSessionInfo is not a function`

**Root Cause:** Code is calling non-existent method

**Fix:**
```bash
# Find all occurrences
grep -rn "\.getSessionInfo" server/ services/

# Replace with:
.getCurrentSession
```

**Files to Check:**
- `server/lib/work-queue.ts`
- `server/trading/unified-order-executor.ts`
- `services/trading-engine/order-manager.ts`

**Before:**
```typescript
const sessionInfo = tradingSessionManager.getSessionInfo(exchange);
```

**After:**
```typescript
const sessionInfo = tradingSessionManager.getCurrentSession(exchange);
```

---

## Bug #2: Market Orders in Extended Hours (25% of failures)

**Error:** `Market orders not allowed during pre_market. Use limit orders for extended hours trading.`

**Root Cause:** Trying to submit market orders during pre-market/after-hours

**Fix:** Add this validation before order submission:

```typescript
// In server/trading/unified-order-executor.ts or services/trading-engine/order-manager.ts
async function validateOrderTiming(params: OrderParams): Promise<OrderParams> {
  const exchange = tradingSessionManager.detectExchange(params.symbol);
  const sessionInfo = tradingSessionManager.getCurrentSession(exchange);

  // Block market orders during extended hours
  if (params.type === 'market' && sessionInfo.isExtendedHours) {
    log.warn('OrderValidator',
      `Market order ${params.symbol} blocked during ${sessionInfo.session}. Auto-converting to limit.`
    );

    // Get current price
    const snapshots = await alpaca.getSnapshots([params.symbol]);
    const snapshot = snapshots[params.symbol];
    const currentPrice = snapshot?.latestTrade?.p || snapshot?.dailyBar?.c || 0;

    if (!currentPrice) {
      throw new Error(`Cannot convert market order to limit: no price data for ${params.symbol}`);
    }

    // Add 0.2% buffer for aggressive execution
    const limitPrice = params.side === 'buy'
      ? currentPrice * 1.002
      : currentPrice * 0.998;

    return {
      ...params,
      type: 'limit',
      limit_price: limitPrice.toFixed(2),
      extended_hours: true
    };
  }

  return params;
}
```

---

## Bug #3: Market Orders with GTC Time-in-Force (12.5% of failures)

**Error:** Alpaca rejects market orders with TIF other than "day"

**Root Cause:** Invalid time_in_force for market orders (especially crypto)

**Fix:** Add this to `server/connectors/alpaca.ts` in the `validateOrder` method (around line 1107):

```typescript
validateOrder(params: CreateOrderParams): OrderValidationResult {
  // ... existing code ...

  // CRITICAL: Market orders MUST be "day" orders
  if (params.type === 'market' && params.time_in_force !== 'day') {
    adjustments.push({
      field: 'time_in_force',
      from: params.time_in_force,
      to: 'day',
      reason: 'Market orders must be day orders per Alpaca API rules'
    });
    normalizedParams.time_in_force = 'day';
    log.warn('Alpaca', `Auto-correcting market order TIF from ${params.time_in_force} to day`);
  }

  // ... rest of validation ...
}
```

---

## Testing After Fixes

```bash
# 1. Test extended hours detection
npm test -- server/services/__tests__/trading-session-manager.test.ts

# 2. Test order validation
npm test -- server/connectors/__tests__/alpaca.test.ts

# 3. Test work queue processing
npm test -- server/lib/__tests__/work-queue.test.ts

# 4. Manual integration test during pre-market
# (Submit a market order at 6am ET and verify it converts to limit)
```

---

## Verification Queries

After deploying fixes, monitor these metrics:

```sql
-- Check work item failure rate (should be < 1%)
SELECT
  COUNT(CASE WHEN status = 'SUCCEEDED' THEN 1 END) * 100.0 / COUNT(*) as success_rate
FROM work_items
WHERE type = 'ORDER_SUBMIT'
  AND created_at >= NOW() - INTERVAL '24 hours';

-- Check for the specific errors (should be 0)
SELECT COUNT(*), last_error
FROM work_items
WHERE status IN ('FAILED', 'DEAD_LETTER')
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY last_error;

-- Check order rejection rate (should be < 1%)
SELECT
  status,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM orders
WHERE submitted_at >= NOW() - INTERVAL '24 hours'
GROUP BY status;
```

---

## Checklist

- [ ] Fix Bug #1: Replace `getSessionInfo` with `getCurrentSession`
- [ ] Fix Bug #2: Add extended hours market order prevention
- [ ] Fix Bug #3: Force market orders to use TIF=day
- [ ] Run test suite
- [ ] Deploy to staging
- [ ] Test manually during pre-market hours
- [ ] Monitor work item failure rate for 24 hours
- [ ] Deploy to production
- [ ] Verify success rate > 99%

---

## Emergency Rollback

If issues occur after deployment:

```bash
# Revert the changes
git revert <commit-hash>

# Or disable extended hours trading entirely:
# In order-manager.ts or unified-order-executor.ts
if (sessionInfo.isExtendedHours) {
  throw new Error('Extended hours trading temporarily disabled');
}
```

---

## Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Order Success Rate | 84.31% | >99% |
| Failed Work Items (48h) | 8 | <1 |
| System Errors | 5 | 0 |
| Extended Hours Rejections | 2 | 0 |
| Invalid TIF Rejections | 1 | 0 |

---

**Priority:** P0 - CRITICAL
**Time Estimate:** 2-3 hours
**Risk Level:** LOW (fixes are defensive, no breaking changes)
**Deploy Window:** Immediately (these are bugs, not features)
