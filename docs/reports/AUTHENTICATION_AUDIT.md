# Authentication Audit Report

**Date**: 2025-12-23
**Scope**: `/home/runner/workspace/server/routes.ts`
**Auditor**: Claude Code

## Executive Summary

This audit identified **critical authentication gaps** in the API layer. Multiple sensitive endpoints are exposed without authentication middleware, allowing unauthorized access to trading operations, market data, and system controls.

---

## Critical Findings

### 🔴 HIGH SEVERITY - Unauthenticated Trading Operations

These endpoints allow **direct trading execution** without authentication:

1. **`POST /api/agent/toggle`** (Line 423)
   - **Risk**: Start/stop trading agent without auth
   - **Fix**: Add `authMiddleware`

2. **`POST /api/autonomous/start`** (Line 464)
   - **Risk**: Start autonomous trading without auth
   - **Fix**: Add `authMiddleware`

3. **`POST /api/autonomous/stop`** (Line 475)
   - **Risk**: Stop autonomous trading without auth
   - **Fix**: Add `authMiddleware`

4. **`POST /api/autonomous/kill-switch`** (Line 486)
   - **Risk**: Activate/deactivate kill switch without auth
   - **Fix**: Add `authMiddleware`

5. **`PUT /api/autonomous/risk-limits`** (Line 502)
   - **Risk**: Modify risk limits without auth
   - **Fix**: Add `authMiddleware`

6. **`POST /api/autonomous/mode`** (Line 525)
   - **Risk**: Change trading mode without auth
   - **Fix**: Add `authMiddleware`

7. **`POST /api/agent/market-analysis/refresh`** (Line 556)
   - **Risk**: Trigger market analysis without auth
   - **Fix**: Add `authMiddleware`

8. **`POST /api/agent/set-limits`** (Line 591)
   - **Risk**: Modify order limits without auth
   - **Fix**: Add `authMiddleware`

9. **`POST /api/agent/auto-start`** (Line 645)
   - **Risk**: Change auto-start config without auth
   - **Fix**: Add `authMiddleware`

10. **`POST /api/autonomous/close-position`** (Line 670)
    - **Risk**: Close positions without auth
    - **Fix**: Add `authMiddleware`

11. **`POST /api/autonomous/execute-trades`** (Line 690)
    - **Risk**: Execute trades without auth
    - **Fix**: Add `authMiddleware`

12. **`POST /api/autonomous/cancel-stale-orders`** (Line 770)
    - **Risk**: Cancel orders without auth
    - **Fix**: Add `authMiddleware`

13. **`POST /api/autonomous/cancel-all-orders`** (Line 781)
    - **Risk**: Cancel all orders without auth
    - **Fix**: Add `authMiddleware`

14. **`POST /api/autonomous/sync-positions`** (Line 801)
    - **Risk**: Sync positions without auth
    - **Fix**: Add `authMiddleware`

15. **`POST /api/autonomous/close-all-positions`** (Line 811)
    - **Risk**: Close all positions without auth
    - **Fix**: Add `authMiddleware`

16. **`POST /api/orders/cleanup`** (Line 834)
    - **Risk**: Cleanup orders without auth
    - **Fix**: Add `authMiddleware`

17. **`POST /api/orders/reconcile`** (Line 849)
    - **Risk**: Reconcile orders without auth
    - **Fix**: Add `authMiddleware`

18. **`POST /api/strategies`** (Line 910)
    - **Risk**: Create strategies without auth
    - **Fix**: Add `authMiddleware`

19. **`PATCH /api/strategies/:id`** (Line 923)
    - **Risk**: Modify strategies without auth
    - **Fix**: Add `authMiddleware`

20. **`POST /api/strategies/:id/toggle`** (Line 935)
    - **Risk**: Toggle strategies without auth
    - **Fix**: Add `authMiddleware`

21. **`POST /api/strategies/:id/start`** (Lines 948, 3423)
    - **Risk**: Start strategies without auth (duplicate endpoint!)
    - **Fix**: Add `authMiddleware` to both

22. **`POST /api/strategies/:id/stop`** (Lines 968, 3439)
    - **Risk**: Stop strategies without auth (duplicate endpoint!)
    - **Fix**: Add `authMiddleware` to both

---

### 🟠 MEDIUM SEVERITY - Unauthenticated Data Access

These endpoints expose sensitive data without authentication:

1. **`GET /api/agent/status`** (Line 406)
   - **Risk**: View agent status without auth
   - **Fix**: Add `authMiddleware`

2. **`GET /api/autonomous/state`** (Line 442)
   - **Risk**: View autonomous state without auth
   - **Fix**: Add `authMiddleware`

3. **`GET /api/agent/market-analysis`** (Line 539)
   - **Risk**: View market analysis without auth
   - **Fix**: Add `authMiddleware`

4. **`GET /api/agent/dynamic-limits`** (Line 566)
   - **Risk**: View dynamic limits without auth
   - **Fix**: Add `authMiddleware`

5. **`GET /api/agent/health`** (Line 629)
   - **Risk**: View agent health without auth
   - **Fix**: Add `authMiddleware`

6. **`GET /api/autonomous/execution-history`** (Line 661)
   - **Risk**: View execution history without auth
   - **Fix**: Add `authMiddleware`

7. **`GET /api/autonomous/open-orders`** (Line 760)
   - **Risk**: View open orders without auth
   - **Fix**: Add `authMiddleware`

8. **`GET /api/autonomous/reconcile-positions`** (Line 791)
   - **Risk**: View reconciliation data without auth
   - **Fix**: Add `authMiddleware`

9. **`GET /api/orders/unreal`** (Line 821)
   - **Risk**: View unreal orders without auth
   - **Fix**: Add `authMiddleware`

10. **`GET /api/orders/execution-engine/status`** (Line 866)
    - **Risk**: View execution engine status without auth
    - **Fix**: Add `authMiddleware`

11. **`GET /api/strategies`** (Line 889)
    - **Risk**: List all strategies without auth
    - **Fix**: Add `authMiddleware`

12. **`GET /api/strategies/:id`** (Line 898)
    - **Risk**: View strategy details without auth
    - **Fix**: Add `authMiddleware`

13. **`GET /api/strategies/:id/status`** (Line 3455)
    - **Risk**: View strategy status without auth
    - **Fix**: Add `authMiddleware`

14. **`GET /api/trades`** (Line 1224)
    - **Risk**: View trades without auth
    - **Fix**: Add `authMiddleware`

15. **`GET /api/trades/enriched`** (Line 1234)
    - **Risk**: View enriched trades without auth
    - **Fix**: Add `authMiddleware`

16. **`GET /api/trades/symbols`** (Line 1254)
    - **Risk**: View traded symbols without auth
    - **Fix**: Add `authMiddleware`

17. **`GET /api/trades/:id`** (Line 1263)
    - **Risk**: View trade details without auth
    - **Fix**: Add `authMiddleware`

18. **`GET /api/trades/:id/enriched`** (Line 1275)
    - **Risk**: View enriched trade details without auth
    - **Fix**: Add `authMiddleware`

19. **`POST /api/trades`** (Line 1287)
    - **Risk**: Create trades without auth
    - **Fix**: Add `authMiddleware`

20. **`GET /api/positions`** (Line 1302)
    - **Risk**: View positions without auth
    - **Fix**: Add `authMiddleware`

21. **`GET /api/positions/broker`** (Line 1338)
    - **Risk**: View broker positions without auth
    - **Fix**: Add `authMiddleware`

22. **`GET /api/positions/:id`** (Line 1364)
    - **Risk**: View position details without auth
    - **Fix**: Add `authMiddleware`

23. **`POST /api/positions`** (Line 1376)
    - **Risk**: Create positions without auth
    - **Fix**: Add `authMiddleware`

24. **`PATCH /api/positions/:id`** (Line 1389)
    - **Risk**: Update positions without auth
    - **Fix**: Add `authMiddleware`

25. **`DELETE /api/positions/:id`** (Line 1401)
    - **Risk**: Delete positions without auth
    - **Fix**: Add `authMiddleware`

26. **`POST /api/positions/reconcile`** (Line 1414)
    - **Risk**: Reconcile positions without auth
    - **Fix**: Add `authMiddleware`

27. **`GET /api/positions/reconcile/status`** (Line 1426)
    - **Risk**: View reconciliation status without auth
    - **Fix**: Add `authMiddleware`

28. **`GET /api/ai-decisions`** (Line 1436)
    - **Risk**: View AI decisions without auth
    - **Fix**: Add `authMiddleware`

29. **`GET /api/ai-decisions/history`** (Line 1446)
    - **Risk**: View AI decision history without auth
    - **Fix**: Add `authMiddleware`

30. **`POST /api/ai-decisions`** (Line 1476)
    - **Risk**: Create AI decisions without auth
    - **Fix**: Add `authMiddleware`

31. **`GET /api/ai-decisions/enriched`** (Line 1493)
    - **Risk**: View enriched AI decisions without auth
    - **Fix**: Add `authMiddleware`

32. **`GET /api/orders`** (Line 1903)
    - **Risk**: View orders without auth
    - **Fix**: Add `authMiddleware`

33. **`GET /api/fills`** (Line 1932)
    - **Risk**: View fills without auth
    - **Fix**: Add `authMiddleware`

34. **`GET /api/fills/order/:orderId`** (Line 1968)
    - **Risk**: View order fills without auth
    - **Fix**: Add `authMiddleware`

35. **`POST /api/orders/sync`** (Line 1995)
    - **Risk**: Sync orders without auth
    - **Fix**: Add `authMiddleware`

36. **`GET /api/orders/recent`** (Line 2019)
    - **Risk**: View recent orders without auth
    - **Fix**: Add `authMiddleware`

37. **`GET /api/orders/:id`** (Line 2047)
    - **Risk**: View order details without auth
    - **Fix**: Add `authMiddleware`

38. **`GET /api/analytics/summary`** (Line 2082)
    - **Risk**: View analytics without auth
    - **Fix**: Add `authMiddleware`

39. **`GET /api/alpaca/account`** (Line 2821)
    - **Risk**: View Alpaca account without auth
    - **Fix**: Add `authMiddleware`

40. **`GET /api/alpaca/positions`** (Line 2831)
    - **Risk**: View Alpaca positions without auth
    - **Fix**: Add `authMiddleware`

41. **`GET /api/alpaca/orders`** (Line 2847)
    - **Risk**: View Alpaca orders without auth
    - **Fix**: Add `authMiddleware`

42. **`POST /api/alpaca/orders`** (Line 2859)
    - **Risk**: Create Alpaca orders without auth
    - **Fix**: Add `authMiddleware`

43. **`DELETE /api/alpaca/orders/:orderId`** (Line 2883)
    - **Risk**: Delete Alpaca orders without auth
    - **Fix**: Add `authMiddleware`

44. **`GET /api/alpaca/assets`** (Line 2893)
    - **Risk**: View Alpaca assets without auth
    - **Fix**: Add `authMiddleware`

45. **`GET /api/alpaca/allocations`** (Line 2904)
    - **Risk**: View allocations without auth
    - **Fix**: Add `authMiddleware`

46. **`POST /api/alpaca/rebalance/preview`** (Line 2914)
    - **Risk**: Preview rebalance without auth
    - **Fix**: Add `authMiddleware`

47. **`POST /api/alpaca/rebalance/execute`** (Line 2938)
    - **Risk**: Execute rebalance without auth
    - **Fix**: Add `authMiddleware`

48. **`GET /api/alpaca/rebalance/suggestions`** (Line 2962)
    - **Risk**: View rebalance suggestions without auth
    - **Fix**: Add `authMiddleware`

49. **`GET /api/alpaca/assets/search`** (Line 2972)
    - **Risk**: Search assets without auth
    - **Fix**: Add `authMiddleware`

50. **`GET /api/alpaca/bars`** (Line 2986)
    - **Risk**: View bars data without auth
    - **Fix**: Add `authMiddleware`

51. **`GET /api/alpaca/snapshots`** (Line 3000)
    - **Risk**: View snapshots without auth
    - **Fix**: Add `authMiddleware`

52. **`GET /api/alpaca/health`** (Line 3038)
    - **Risk**: View Alpaca health without auth
    - **Fix**: Add `authMiddleware`

53. **`GET /api/alpaca/clock`** (Line 3048)
    - **Risk**: View Alpaca clock without auth
    - **Decision**: **KEEP PUBLIC** (market hours are public info)

54. **`GET /api/alpaca/market-status`** (Line 3058)
    - **Risk**: View market status without auth
    - **Decision**: **KEEP PUBLIC** (market status is public info)

55. **`GET /api/alpaca/can-trade-extended/:symbol`** (Line 3068)
    - **Risk**: Check extended hours trading without auth
    - **Fix**: Add `authMiddleware`

56. **`POST /api/alpaca-trading/execute`** (Line 3340)
    - **Risk**: Execute Alpaca trades without auth
    - **Fix**: Add `authMiddleware`

57. **`POST /api/alpaca-trading/close/:symbol`** (Line 3373)
    - **Risk**: Close Alpaca position without auth
    - **Fix**: Add `authMiddleware`

58. **`POST /api/alpaca-trading/analyze`** (Line 3391)
    - **Risk**: Analyze symbol without auth
    - **Fix**: Add `authMiddleware`

59. **`POST /api/alpaca-trading/analyze-execute`** (Line 3407)
    - **Risk**: Analyze and execute without auth
    - **Fix**: Add `authMiddleware`

60. **`POST /api/alpaca-trading/stop-all`** (Line 3475)
    - **Risk**: Stop all trading without auth
    - **Fix**: Add `authMiddleware`

---

### 🟡 LOW SEVERITY - Unauthenticated Market Data

These endpoints expose market data (mostly public information):

1. **`GET /api/crypto/markets`** (Line 2186)
   - **Decision**: **KEEP PUBLIC** (public market data)

2. **`GET /api/crypto/prices`** (Line 2199)
   - **Decision**: **KEEP PUBLIC** (public market data)

3. **`GET /api/crypto/chart/:coinId`** (Line 2211)
   - **Decision**: **KEEP PUBLIC** (public market data)

4. **`GET /api/crypto/trending`** (Line 2223)
   - **Decision**: **KEEP PUBLIC** (public market data)

5. **`GET /api/crypto/global`** (Line 2233)
   - **Decision**: **KEEP PUBLIC** (public market data)

6. **`GET /api/crypto/search`** (Line 2243)
   - **Decision**: **KEEP PUBLIC** (public market data)

7. **`GET /api/stock/quote/:symbol`** (Line 2257)
   - **Decision**: **KEEP PUBLIC** (public market data)

8. **`GET /api/stock/quotes`** (Line 2268)
   - **Decision**: **KEEP PUBLIC** (public market data)

9. **`GET /api/stock/candles/:symbol`** (Line 2284)
   - **Decision**: **KEEP PUBLIC** (public market data)

10. **`GET /api/stock/profile/:symbol`** (Line 2298)
    - **Decision**: **KEEP PUBLIC** (public market data)

11. **`GET /api/stock/search`** (Line 2309)
    - **Decision**: **KEEP PUBLIC** (public market data)

12. **`GET /api/stock/news`** (Line 2323)
    - **Decision**: **KEEP PUBLIC** (public market data)

13. **`GET /api/news/headlines`** (Line 3266)
    - **Decision**: **KEEP PUBLIC** (public market data)

14. **`GET /api/news/search`** (Line 3279)
    - **Decision**: **KEEP PUBLIC** (public market data)

15. **`GET /api/news/market`** (Line 3295)
    - **Decision**: **KEEP PUBLIC** (public market data)

16. **`GET /api/news/crypto`** (Line 3306)
    - **Decision**: **KEEP PUBLIC** (public market data)

17. **`GET /api/news/stock/:symbol`** (Line 3317)
    - **Decision**: **KEEP PUBLIC** (public market data)

18. **`GET /api/candidates`** (Line 5669)
    - **Decision**: **KEEP PUBLIC** (intended for public watchlist)

19. **`GET /api/watchlist`** (Line 5692)
    - **Decision**: **KEEP PUBLIC** (intended for public watchlist)

---

### ✅ Properly Protected Endpoints

These endpoints correctly use `authMiddleware`:

- All `/api/admin/*` endpoints (Lines 3868+)
- All `/api/webhooks/*` endpoints (Lines 3617+)
- All `/api/notifications/*` endpoints (Lines 3724+)
- All `/api/universe/*` endpoints (Lines 5575+)
- Debate, tools, competition, strategies, arena routers (mounted with auth)

---

### 🟢 Intentionally Public Endpoints

These endpoints are correctly left public:

- **`POST /api/auth/signup`** (Line 267)
- **`POST /api/auth/login`** (Line 305)
- **`POST /api/auth/logout`** (Line 336)
- **`GET /api/auth/me`** (Line 352)
- **`GET /api/events`** (Line 379) - Has inline auth check
- **`GET /api/alpaca/clock`** (Line 3048)
- **`GET /api/alpaca/market-status`** (Line 3058)
- All crypto/stock/news market data endpoints
- All trading session endpoints (Lines 3080-3143)

---

## Remediation Plan

### Phase 1: Critical Fixes (Priority 1)

Add `authMiddleware` to all trading operation endpoints (15 endpoints).

### Phase 2: High Priority Fixes (Priority 2)

Add `authMiddleware` to all data access endpoints that expose sensitive trading/position data (60 endpoints).

### Phase 3: Documentation (Priority 3)

Document intentionally public endpoints in API docs.

---

## Implementation Status

- ✅ Automated stop-loss orders implemented
- ⏳ Authentication fixes pending (see below)

---

## Notes

1. Many endpoints are duplicated (e.g., `/api/strategies/:id/start` appears twice)
2. Consider implementing rate limiting on public endpoints
3. Consider implementing API key authentication for programmatic access
4. The `/api/events` SSE endpoint has inline auth checking - consider standardizing
5. Market data endpoints intentionally left public for dashboard widgets

---

**End of Audit Report**
