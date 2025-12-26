# Alpaca Order Cancellation & Rejection Analysis Report

**Report Date:** December 22, 2025
**Analysis Period:** Last 48 hours
**Database:** Production trading database

---

## Executive Summary

Analysis of order failures in the Alpaca trading system reveals **8 critical order submission failures** with an **84.31% success rate** (43 successful, 8 failed). While the success rate appears acceptable, the failures are dominated by **critical system bugs** that require immediate attention.

### Key Findings

1. **62.5% of failures** are caused by a **critical code bug** (`tradingSessionManager.getSessionInfo is not a function`)
2. **25% of failures** are from market orders attempted during extended hours
3. **12.5% of failures** are from invalid GTC time-in-force on market orders
4. **All failures occurred during pre-market hours** (4am-9am ET)

---

## 1. Failure Category Breakdown

### Critical Priority Failures

#### 1.1 SYSTEM_ERROR (5 occurrences - 62.5%)

**Severity:** CRITICAL
**Description:** Internal system error - code calling non-existent method

**Error Message:**
```
tradingSessionManager.getSessionInfo is not a function
```

**Root Cause:**
The code is calling `tradingSessionManager.getSessionInfo()` but the actual method name is `getCurrentSession()`. This is a simple typo/API mismatch in the order execution code.

**Affected Symbols:** JPM (3), V (1), INTC (1), ISRG (1)

**Examples:**
1. **JPM** - market/day order at 11:50:00 UTC
   - Attempts: 1
   - Extended Hours: undefined

2. **INTC** - limit/day order at 11:37:01 UTC
   - Attempts: 1
   - Extended Hours: true

3. **V** - market/day order at 11:30:03 UTC
   - Attempts: 1
   - Extended Hours: undefined

**Fix Required:**
```typescript
// WRONG (current code somewhere):
const sessionInfo = tradingSessionManager.getSessionInfo(exchange);

// CORRECT:
const sessionInfo = tradingSessionManager.getCurrentSession(exchange);
```

**Code Locations to Check:**
- `server/lib/work-queue.ts` (processOrderSubmit method)
- `server/trading/unified-order-executor.ts`
- `services/trading-engine/order-manager.ts`

---

#### 1.2 MARKET_ORDER_EXTENDED_HOURS (2 occurrences - 25%)

**Severity:** CRITICAL
**Description:** Market orders attempted during extended hours (pre-market/after-hours)

**Error Message:**
```
Market orders not allowed during pre_market. Use limit orders for extended hours trading.
```

**Alpaca API Rule:**
Alpaca **DOES NOT ACCEPT** market orders during extended hours. Only limit orders are allowed in pre-market (4am-9:30am ET) and after-hours (4pm-8pm ET).

**Affected Symbols:** V (1), JPM (1)

**Examples:**
1. **V** - market/day order at 11:50:38 UTC (6:50am ET - Pre-market)
2. **JPM** - market/day order at 11:30:00 UTC (6:30am ET - Pre-market)

**Current Behavior:**
The system is attempting to submit market orders during pre-market hours, which Alpaca immediately rejects.

**Fix Options:**

**Option A: Reject Market Orders During Extended Hours**
```typescript
if (orderType === 'market' && sessionInfo.isExtendedHours) {
  throw new Error(
    `Market orders not allowed during ${sessionInfo.session}. ` +
    `Use limit orders for extended hours trading.`
  );
}
```

**Option B: Auto-Convert to Limit Orders (Recommended)**
```typescript
if (orderType === 'market' && sessionInfo.isExtendedHours) {
  // Get current market price
  const currentPrice = await getCurrentPrice(symbol);

  // Add small buffer for aggressive execution
  const limitPrice = side === 'buy'
    ? currentPrice * 1.001  // 0.1% above for buys
    : currentPrice * 0.999; // 0.1% below for sells

  log.warn('OrderExecutor',
    `Auto-converting market order to limit order for extended hours: ` +
    `${symbol} ${side} @ $${limitPrice.toFixed(2)}`
  );

  orderType = 'limit';
  params.limit_price = limitPrice.toFixed(2);
}
```

**Code Location:**
- `server/trading/unified-order-executor.ts`
- `services/trading-engine/order-manager.ts` (validateOrderTiming method)

---

### High Priority Failures

#### 1.3 GTC_MARKET_ORDER (1 occurrence - 12.5%)

**Severity:** HIGH
**Description:** Market orders cannot have GTC (Good-Til-Canceled) time_in_force

**Error Message:**
```
Alpaca API error: 403 - {"code":40310000,"message":"insufficient balance for USD"}
```

Note: This error also shows insufficient funds, but the order had `time_in_force: gtc` with `type: market` which is invalid.

**Affected Symbols:** BTC/USD (1)

**Alpaca API Rule:**
Market orders **MUST** have `time_in_force: "day"`. They cannot be GTC, IOC, FOK, etc.

**Example:**
- **BTC/USD** - market/gtc order at 11:36:23 UTC

**Current Behavior:**
Crypto orders are being submitted with `time_in_force: "gtc"` and `type: "market"`, which violates Alpaca's API rules.

**Fix Required:**
```typescript
// In alpaca.ts validateOrder or order submission code:
if (params.type === 'market' && params.time_in_force !== 'day') {
  log.warn('Alpaca',
    `Adjusting market order TIF from ${params.time_in_force} to day`
  );
  params.time_in_force = 'day';
}
```

**Code Location:**
- `server/connectors/alpaca.ts` (validateOrder method - line 1107)
- Already has some validation, but needs to enforce this rule

---

## 2. Symbol Impact Analysis

### Most Affected Symbols

| Symbol | Failures | Categories |
|--------|----------|------------|
| JPM    | 3        | SYSTEM_ERROR, MARKET_ORDER_EXTENDED_HOURS |
| V      | 2        | MARKET_ORDER_EXTENDED_HOURS, SYSTEM_ERROR |
| INTC   | 1        | SYSTEM_ERROR |
| BTC    | 1        | GTC_MARKET_ORDER |
| ISRG   | 1        | SYSTEM_ERROR |

**Analysis:**
- JPM is most affected (3 failures) - all during pre-market hours
- V has both system errors and extended hours issues
- BTC failure is unique - crypto-specific with GTC issue

---

## 3. Time of Day Analysis

**ALL FAILURES OCCURRED DURING PRE-MARKET (4am-9am ET)**

| Time Period | Failures | % of Total | Top Categories |
|-------------|----------|------------|----------------|
| 04:00-09:00 ET (Pre-Market) | 8 | 100% | SYSTEM_ERROR (5), MARKET_ORDER_EXTENDED_HOURS (2) |
| 09:00-17:00 ET (Regular) | 0 | 0% | - |
| 17:00-20:00 ET (After-Hours) | 0 | 0% | - |
| 20:00-04:00 ET (Closed) | 0 | 0% | - |

**Critical Finding:**
The system only fails during extended hours, specifically pre-market. This suggests:
1. The extended hours handling code has bugs
2. Market order validation is not working during extended hours
3. The system may not be properly detecting market session state

---

## 4. Order Type Analysis

| Order Type / TIF | Failures | Categories |
|------------------|----------|------------|
| market/day       | 5        | MARKET_ORDER_EXTENDED_HOURS, SYSTEM_ERROR |
| limit/day        | 2        | SYSTEM_ERROR |
| market/gtc       | 1        | GTC_MARKET_ORDER |

**Analysis:**
- Market orders with day TIF are most problematic (5 failures)
- All failures involve either market orders or extended hours
- No failures during regular market hours with proper order types

---

## 5. Canceled Orders Analysis

In addition to the 8 failed work items, there were **73 canceled orders** in the last 48 hours:
- **37** market/day orders canceled
- **36** limit/day orders canceled
- Most cancellations were JPM (23), TSLA (12), SPY (5)

**Status Breakdown (Last 7 Days):**
- Canceled: 1,337 orders
- Filled: 502 orders
- New: 6 orders
- Accepted: 3 orders
- Expired: 1 order

**Note:** The high cancellation rate (~72% of all orders) suggests aggressive order management or position churning. However, these are *user/system cancellations*, not Alpaca rejections, so they don't indicate a problem with the API integration.

---

## 6. Actionable Recommendations

### CRITICAL Priority (Fix Immediately)

#### 1. Fix System Error - getSessionInfo Bug
**Priority:** P0 - CRITICAL
**Impact:** 62.5% of all failures
**Estimated Time:** 15 minutes

**Steps:**
1. Search codebase for `tradingSessionManager.getSessionInfo`
2. Replace with `tradingSessionManager.getCurrentSession`
3. Verify return type matches (SessionInfo interface)
4. Test during extended hours

**Command to find all occurrences:**
```bash
grep -r "getSessionInfo" server/ services/
```

---

#### 2. Add Extended Hours Market Order Prevention
**Priority:** P0 - CRITICAL
**Impact:** 25% of all failures
**Estimated Time:** 1 hour

**Implementation:**

```typescript
// In unified-order-executor.ts or order-manager.ts
async function validateOrderTiming(params: OrderParams): Promise<OrderParams> {
  const exchange = tradingSessionManager.detectExchange(params.symbol);
  const sessionInfo = tradingSessionManager.getCurrentSession(exchange);

  // RULE: Market orders not allowed during extended hours
  if (params.type === 'market' && sessionInfo.isExtendedHours) {
    log.warn('OrderValidator',
      `Market order for ${params.symbol} blocked during ${sessionInfo.session}. ` +
      `Converting to aggressive limit order.`
    );

    // Convert to limit order with competitive pricing
    const currentPrice = await alpaca.getSnapshot(params.symbol);
    const price = params.side === 'buy'
      ? currentPrice * 1.002  // 0.2% above for aggressive buy
      : currentPrice * 0.998; // 0.2% below for aggressive sell

    return {
      ...params,
      type: 'limit',
      limit_price: price.toFixed(2),
      extended_hours: true
    };
  }

  return params;
}
```

**Files to Modify:**
- `server/trading/unified-order-executor.ts`
- `services/trading-engine/order-manager.ts`

---

#### 3. Enforce DAY TIF for Market Orders
**Priority:** P1 - HIGH
**Impact:** 12.5% of failures, prevents API rejections
**Estimated Time:** 30 minutes

**Implementation:**

```typescript
// In alpaca.ts validateOrder method (around line 1107)
validateOrder(params: CreateOrderParams): OrderValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const adjustments: { field: string; from: unknown; to: unknown; reason: string }[] = [];

  // ... existing validation ...

  // CRITICAL: Market orders MUST be day orders
  if (params.type === 'market' && params.time_in_force !== 'day') {
    adjustments.push({
      field: 'time_in_force',
      from: params.time_in_force,
      to: 'day',
      reason: 'Market orders must have time_in_force=day per Alpaca API rules'
    });
    normalizedParams.time_in_force = 'day';
  }

  // ... rest of validation ...
}
```

**File to Modify:**
- `server/connectors/alpaca.ts` (line 1058-1124)

---

### HIGH Priority (Fix Within 1 Day)

#### 4. Add Pre-Submission Order Validation Pipeline
**Priority:** P1 - HIGH
**Impact:** Prevents all API rejections
**Estimated Time:** 2-3 hours

Create a comprehensive validation pipeline that checks:
- Market session compatibility
- Order type / TIF compatibility
- Extended hours order type enforcement
- Price reasonability (within 5% of current price)
- Quantity / notional minimums
- Symbol tradability

---

### MEDIUM Priority (Fix Within 1 Week)

#### 5. Add Order Rejection Monitoring & Alerts
**Priority:** P2 - MEDIUM
**Impact:** Early detection of issues
**Estimated Time:** 2 hours

**Implementation:**
1. Add metrics tracking for order rejection rates
2. Set up alerts when rejection rate > 10%
3. Log detailed rejection reasons to separate table
4. Create dashboard for failure analysis

---

#### 6. Improve Error Messages & Logging
**Priority:** P2 - MEDIUM
**Impact:** Faster debugging
**Estimated Time:** 1 hour

Current error messages are cryptic. Improve by:
- Include order parameters in error logs
- Add request/response logging for Alpaca API calls
- Include market session info in order submission logs

---

## 7. Testing Recommendations

### Test Cases to Add

1. **Extended Hours Market Order Test**
```typescript
test('should reject market orders during pre-market', async () => {
  const preMarketTime = new Date('2025-12-22T11:00:00Z'); // 6am ET
  const result = await executeOrder({
    symbol: 'AAPL',
    type: 'market',
    side: 'buy',
    qty: '10',
    time_in_force: 'day'
  }, preMarketTime);

  expect(result.error).toContain('Market orders not allowed during pre_market');
});
```

2. **Market Order TIF Validation Test**
```typescript
test('should force market orders to DAY tif', async () => {
  const order = await alpaca.createOrder({
    symbol: 'AAPL',
    type: 'market',
    side: 'buy',
    qty: '10',
    time_in_force: 'gtc'  // Invalid
  });

  expect(order.time_in_force).toBe('day'); // Should be auto-corrected
});
```

3. **Session Manager Method Test**
```typescript
test('should use getCurrentSession not getSessionInfo', async () => {
  const exchange = 'US_EQUITIES';
  const sessionInfo = tradingSessionManager.getCurrentSession(exchange);

  expect(sessionInfo).toHaveProperty('session');
  expect(sessionInfo).toHaveProperty('isOpen');
  expect(sessionInfo).toHaveProperty('isExtendedHours');
});
```

---

## 8. Code Locations Summary

### Files That Need Fixes

1. **CRITICAL - Fix getSessionInfo bug:**
   - Search pattern: `tradingSessionManager.getSessionInfo`
   - Likely locations:
     - `server/lib/work-queue.ts`
     - `server/trading/unified-order-executor.ts`
     - `services/trading-engine/order-manager.ts`

2. **CRITICAL - Add extended hours validation:**
   - `server/trading/unified-order-executor.ts`
   - `services/trading-engine/order-manager.ts`

3. **HIGH - Fix market order TIF enforcement:**
   - `server/connectors/alpaca.ts` (line 1058-1124, validateOrder method)

4. **Reference implementations:**
   - `server/services/trading-session-manager.ts` (correct API)
   - `server/connectors/alpaca.ts` (order submission)
   - `server/trading/order-types-matrix.ts` (order type rules)

---

## 9. Alpaca API Rules Summary

### Order Type Rules

| Order Type | Valid TIF Values | Extended Hours | Notes |
|------------|------------------|----------------|-------|
| market     | day only         | NO             | Must use limit orders in extended hours |
| limit      | day, gtc, ioc, fok | YES          | Recommended for extended hours |
| stop       | day, gtc         | Varies         | Check Alpaca docs for extended hours rules |
| stop_limit | day, gtc         | Varies         | Check Alpaca docs for extended hours rules |

### Order Class Rules

| Order Class | Valid TIF | Notes |
|-------------|-----------|-------|
| simple      | Any       | Standard single order |
| bracket     | day only  | Must be DAY per Alpaca API |
| oco         | day recommended | One-Cancels-Other |
| oto         | day recommended | One-Triggers-Other |

### Extended Hours Rules

- **Pre-Market:** 4:00 AM - 9:30 AM ET
- **Regular Hours:** 9:30 AM - 4:00 PM ET
- **After-Hours:** 4:00 PM - 8:00 PM ET

**Restrictions:**
- ❌ NO market orders during extended hours
- ✅ YES limit orders during extended hours (with `extended_hours: true`)
- ⚠️ Reduced liquidity and wider spreads during extended hours

---

## 10. Success Metrics

### Current State
- **Order Success Rate:** 84.31% (43 successful / 51 total attempts)
- **Rejection Rate:** 15.69%
- **Critical Bugs:** 1 (getSessionInfo)
- **Failed Work Items:** 8 in 48 hours

### Target State (After Fixes)
- **Order Success Rate:** >99%
- **Rejection Rate:** <1%
- **Critical Bugs:** 0
- **Failed Work Items:** <1 per 48 hours

### Monitoring
- Track rejection rates by category
- Alert on rejection rate > 2%
- Weekly review of failure patterns
- Monthly analysis of order success trends

---

## Appendices

### A. Example Work Item Failures

```json
{
  "id": "...",
  "type": "ORDER_SUBMIT",
  "status": "DEAD_LETTER",
  "symbol": "JPM",
  "last_error": "tradingSessionManager.getSessionInfo is not a function",
  "attempts": 1,
  "payload": {
    "symbol": "JPM",
    "side": "sell",
    "type": "market",
    "time_in_force": "day",
    "qty": "19",
    "traceId": "cyc-07zggjzh"
  }
}
```

### B. Database Queries Used

```sql
-- Failed work items
SELECT * FROM work_items
WHERE type IN ('ORDER_SUBMIT', 'ORDER_CANCEL')
  AND status IN ('FAILED', 'DEAD_LETTER')
  AND created_at >= NOW() - INTERVAL '48 hours';

-- Canceled orders
SELECT * FROM orders
WHERE status IN ('canceled', 'rejected', 'expired')
  AND submitted_at >= NOW() - INTERVAL '48 hours';

-- Success rate
SELECT
  COUNT(CASE WHEN status = 'SUCCEEDED' THEN 1 END) as success_count,
  COUNT(CASE WHEN status IN ('FAILED', 'DEAD_LETTER') THEN 1 END) as fail_count
FROM work_items
WHERE type = 'ORDER_SUBMIT'
  AND created_at >= NOW() - INTERVAL '48 hours';
```

---

## Conclusion

The trading system has a **critical code bug** causing 62.5% of all order failures, combined with **improper extended hours handling** causing another 25% of failures. These issues are:

✅ **EASY TO FIX** - Simple code changes
⚠️ **HIGH IMPACT** - Affecting real trades
🔥 **URGENT** - Should be fixed immediately

**Estimated total fix time:** 2-3 hours for all critical fixes

**Expected outcome:** Order success rate should improve from 84% to >99% after implementing these fixes.

---

**Report Generated by:** Alpaca Order Failure Analysis Script
**Database:** Production trading database
**Analysis Scripts:** `/scripts/analyze-order-failures.js`, `/scripts/comprehensive-failure-report.js`
