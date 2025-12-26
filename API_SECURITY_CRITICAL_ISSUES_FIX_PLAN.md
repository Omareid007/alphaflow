# API Security Critical Issues - Fix Plan

**Generated:** 2025-12-24
**Analysis Date:** December 24, 2025
**Total Endpoints Analyzed:** 341
**Critical Security Issues:** 97

---

## Executive Summary

A comprehensive security audit of all backend API endpoints has revealed **97 CRITICAL security vulnerabilities**, primarily related to missing authentication on sensitive trading, order management, and financial endpoints. These vulnerabilities could allow unauthorized users to:

- View and manipulate trading positions
- Place, cancel, and modify orders
- Access account information
- Control risk settings
- Execute trades
- Access proprietary trading strategies

**IMMEDIATE ACTION REQUIRED:** All trading-related endpoints are currently PUBLIC and accessible without authentication.

---

## Critical Security Vulnerabilities

### Category 1: Trading & Order Management (HIGHEST PRIORITY)

**Impact:** Unauthorized users can view, create, modify, and delete orders and positions.

#### Affected Endpoints (27 endpoints)

```
❌ GET    /api/orders/unreal
❌ POST   /api/orders/cleanup
❌ POST   /api/orders/reconcile
❌ GET    /api/orders/execution-engine/status
❌ GET    /api/orders
❌ POST   /api/orders/sync
❌ GET    /api/orders/recent
❌ GET    /api/orders/:id
❌ GET    /api/trades
❌ GET    /api/trades/enriched
❌ GET    /api/trades/symbols
❌ GET    /api/trades/:id
❌ GET    /api/trades/:id/enriched
❌ POST   /api/trades
❌ POST   /api/trades/backfill-prices
❌ GET    /api/positions/snapshot
❌ GET    /api/positions/broker
❌ GET    /api/positions/:id
❌ POST   /api/positions
❌ PATCH  /api/positions/:id
❌ DELETE /api/positions/:id
❌ POST   /api/positions/reconcile
❌ GET    /api/positions/reconcile/status
❌ GET    /api/alpaca/positions
❌ GET    /api/alpaca/orders
❌ POST   /api/alpaca/orders
❌ DELETE /api/alpaca/orders/:orderId
```

**Fix:**
```typescript
// In server/routes.ts, add authMiddleware to all these endpoints
app.get("/api/orders/unreal", authMiddleware, async (req, res) => {
app.post("/api/orders/cleanup", authMiddleware, async (req, res) => {
app.post("/api/orders/reconcile", authMiddleware, async (req, res) => {
// ... and so on for all trading endpoints
```

---

### Category 2: Strategy Management (CRITICAL)

**Impact:** Unauthorized users can view, create, modify, and control trading strategies.

#### Affected Endpoints (24 endpoints)

```
❌ GET    /api/strategies
❌ GET    /api/strategies/:id
❌ POST   /api/strategies
❌ PATCH  /api/strategies/:id
❌ POST   /api/strategies/:id/toggle
❌ POST   /api/strategies/:id/start
❌ POST   /api/strategies/:id/stop
❌ GET    /api/strategies/moving-average/schema
❌ POST   /api/strategies/moving-average/backtest
❌ POST   /api/strategies/moving-average/ai-validate
❌ GET    /api/strategies/mean-reversion/schema
❌ POST   /api/strategies/mean-reversion/backtest
❌ POST   /api/strategies/mean-reversion/signal
❌ GET    /api/strategies/momentum/schema
❌ POST   /api/strategies/momentum/backtest
❌ POST   /api/strategies/momentum/signal
❌ GET    /api/strategies/all-schemas
❌ POST   /api/strategies/backtest
❌ POST   /api/strategies/:id/start (duplicate)
❌ POST   /api/strategies/:id/stop (duplicate)
❌ GET    /api/strategies/:id/status
```

**Fix:**
```typescript
// In server/routes.ts, add authMiddleware before the handler
app.get("/api/strategies", authMiddleware, async (req, res) => {
app.post("/api/strategies", authMiddleware, async (req, res) => {
app.patch("/api/strategies/:id", authMiddleware, async (req, res) => {
// ... etc
```

---

### Category 3: Alpaca Integration (CRITICAL)

**Impact:** Unauthorized access to broker account information and trading capabilities.

#### Affected Endpoints (18 endpoints)

```
❌ GET    /api/alpaca/account
❌ GET    /api/alpaca/assets
❌ GET    /api/alpaca/allocations
❌ POST   /api/alpaca/rebalance/preview
❌ POST   /api/alpaca/rebalance/execute
❌ GET    /api/alpaca/rebalance/suggestions
❌ GET    /api/alpaca/assets/search
❌ GET    /api/alpaca/bars
❌ GET    /api/alpaca/snapshots
❌ GET    /api/alpaca/clock
❌ GET    /api/alpaca/market-status
❌ GET    /api/alpaca/can-trade-extended/:symbol
❌ GET    /api/alpaca/portfolio-history
❌ GET    /api/alpaca/top-stocks
❌ GET    /api/alpaca/top-crypto
❌ GET    /api/alpaca/top-etfs
❌ POST   /api/alpaca/validate-order
```

**Fix:**
```typescript
// Most Alpaca endpoints should require authentication
app.get("/api/alpaca/account", authMiddleware, async (req, res) => {
app.get("/api/alpaca/positions", authMiddleware, async (req, res) => {
app.post("/api/alpaca/orders", authMiddleware, async (req, res) => {
app.delete("/api/alpaca/orders/:orderId", authMiddleware, async (req, res) => {

// Some data endpoints like market-status might be safe as public:
// - /api/alpaca/market-status (market open/closed status - can stay public)
// - /api/alpaca/clock (market clock - can stay public)
```

---

### Category 4: Risk Management (CRITICAL)

**Impact:** Unauthorized users can modify risk settings or trigger emergency liquidations.

#### Affected Endpoints (5 endpoints)

```
❌ GET    /api/risk/settings
❌ POST   /api/risk/settings
❌ POST   /api/risk/kill-switch
❌ POST   /api/risk/close-all
❌ POST   /api/risk/emergency-liquidate
```

**Fix:**
```typescript
// ALL risk endpoints must require authentication AND potentially admin privileges
app.get("/api/risk/settings", authMiddleware, async (req, res) => {
app.post("/api/risk/settings", authMiddleware, async (req, res) => {
app.post("/api/risk/kill-switch", authMiddleware, async (req, res) => {
app.post("/api/risk/close-all", authMiddleware, async (req, res) => {
app.post("/api/risk/emergency-liquidate", authMiddleware, async (req, res) => {
```

---

## Medium Priority Issues

### Missing Input Validation (75 endpoints)

Many POST/PUT/PATCH endpoints lack proper input validation. Examples:

```typescript
// BAD - No validation
app.post("/api/agent/toggle", authMiddleware, async (req, res) => {
  const result = await doSomething(req.body);
});

// GOOD - With validation
app.post("/api/agent/toggle", authMiddleware, async (req, res) => {
  if (!req.body || typeof req.body.enabled !== 'boolean') {
    return badRequest(res, "Invalid request: enabled (boolean) required");
  }
  const result = await doSomething(req.body);
});
```

**Affected Endpoints Include:**
- POST /api/agent/toggle
- POST /api/autonomous/start
- POST /api/autonomous/stop
- POST /api/autonomous/kill-switch
- PUT /api/autonomous/risk-limits
- And 70 more...

---

### Incomplete Error Handling (11 endpoints)

Some endpoints lack try-catch blocks or proper error handling:

```typescript
// BAD - No error handling
app.post("/api/ai/analyze", async (req, res) => {
  const result = await analyze(req.body);
  res.json(result);
});

// GOOD - With error handling
app.post("/api/ai/analyze", async (req, res) => {
  try {
    const result = await analyze(req.body);
    res.json(result);
  } catch (error) {
    console.error("Analysis failed:", error);
    return serverError(res, "Failed to analyze data");
  }
});
```

**Affected Endpoints:**
- POST /api/ai/analyze
- GET /api/connectors/status
- POST /api/autonomous/execute-trades
- And 8 more...

---

## Recommended Public Endpoints

The following endpoints are **intentionally public** and should remain so:

### Authentication (4 endpoints)
```
✅ POST   /api/auth/signup
✅ POST   /api/auth/login
✅ POST   /api/auth/logout
✅ GET    /api/auth/me
```

### Market Data - Read Only (13 endpoints)
```
✅ GET    /api/crypto/markets
✅ GET    /api/crypto/prices
✅ GET    /api/crypto/chart/:coinId
✅ GET    /api/stock/quote/:symbol
✅ GET    /api/stock/quotes
✅ GET    /api/stock/candles/:symbol
✅ GET    /api/stock/profile/:symbol
✅ GET    /api/stock/news
... (public market data)
```

### Health/Status - Read Only (5 endpoints)
```
✅ GET    /api/health/db
✅ GET    /api/alpaca/clock (market hours)
✅ GET    /api/alpaca/market-status
✅ GET    /api/fusion/status
✅ GET    /api/orchestration/status
```

---

## Implementation Priority

### Phase 1: IMMEDIATE (Within 24 hours)
**Add authentication to all trading endpoints**

1. Orders endpoints (10 endpoints)
2. Positions endpoints (9 endpoints)
3. Trades endpoints (8 endpoints)
4. Alpaca trading endpoints (4 endpoints)
5. Risk management endpoints (5 endpoints)

**Total:** 36 endpoints

### Phase 2: URGENT (Within 48 hours)
**Add authentication to strategy endpoints**

1. Strategy management (24 endpoints)
2. Alpaca account/portfolio endpoints (14 endpoints)

**Total:** 38 endpoints

### Phase 3: HIGH PRIORITY (Within 1 week)
**Add input validation**

1. Add validation to all POST/PUT/PATCH endpoints (75 endpoints)
2. Improve error handling (11 endpoints)

### Phase 4: MEDIUM PRIORITY (Within 2 weeks)
**Review and secure remaining endpoints**

1. AI endpoints (consider if should be protected)
2. Orchestration endpoints (add auth)
3. Public data endpoints (ensure read-only)

---

## Testing Strategy

After implementing fixes, test each endpoint category:

### 1. Authentication Tests
```bash
# Test without auth token - should return 401
curl -X GET http://localhost:5000/api/orders

# Test with valid auth - should return 200
curl -X GET http://localhost:5000/api/orders \
  -H "Cookie: session=valid-session-id"
```

### 2. Input Validation Tests
```bash
# Test with invalid input - should return 400
curl -X POST http://localhost:5000/api/strategies \
  -H "Content-Type: application/json" \
  -d '{}'

# Test with valid input - should return 200/201
curl -X POST http://localhost:5000/api/strategies \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","type":"momentum"}'
```

### 3. Authorization Tests
```bash
# Test admin endpoint with non-admin user - should return 403
curl -X POST http://localhost:5000/api/admin/universe/refresh \
  -H "Cookie: session=user-session-id"

# Test admin endpoint with admin user - should return 200
curl -X POST http://localhost:5000/api/admin/universe/refresh \
  -H "Cookie: session=admin-session-id"
```

---

## Code Change Checklist

For each endpoint being fixed:

- [ ] Add `authMiddleware` to route definition
- [ ] Add input validation using Zod schemas or manual checks
- [ ] Wrap logic in try-catch block
- [ ] Return appropriate error codes (400, 401, 403, 500)
- [ ] Log security events (failed auth attempts)
- [ ] Add rate limiting if necessary
- [ ] Update API documentation
- [ ] Add integration tests
- [ ] Test with real client

---

## Example Fix Implementation

### Before (VULNERABLE):
```typescript
app.post("/api/orders", async (req, res) => {
  const order = await storage.createOrder(req.body);
  res.json(order);
});
```

### After (SECURE):
```typescript
import { insertOrderSchema } from "@shared/schema";

app.post("/api/orders", authMiddleware, async (req, res) => {
  try {
    // Validate input
    const parsed = insertOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, "Invalid order data", parsed.error);
    }

    // Verify user owns this account
    const userId = req.userId;
    if (!userId) {
      return unauthorized(res, "Not authenticated");
    }

    // Create order with user context
    const order = await storage.createOrder({
      ...parsed.data,
      userId,
      createdAt: new Date(),
    });

    res.status(201).json(order);
  } catch (error) {
    console.error("Order creation failed:", error);
    return serverError(res, "Failed to create order");
  }
});
```

---

## Monitoring & Alerts

After fixes are deployed:

1. **Monitor auth failures:**
   - Set up alerts for >10 401 errors/minute
   - Log all failed authentication attempts

2. **Monitor suspicious activity:**
   - Multiple failed orders from same IP
   - Rapid strategy modifications
   - Unusual risk setting changes

3. **Audit logs:**
   - Log all trading operations (already implemented via audit middleware)
   - Review logs daily for anomalies

---

## Additional Recommendations

### 1. Rate Limiting
Add rate limiting to prevent abuse:
```typescript
import rateLimit from 'express-rate-limit';

const tradingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many requests, please try again later'
});

app.post("/api/orders", authMiddleware, tradingLimiter, async (req, res) => {
  // ...
});
```

### 2. CORS Configuration
Review CORS settings to ensure only authorized origins:
```typescript
// Current implementation allows any Replit domain
// Consider restricting to specific frontends
```

### 3. API Keys for Programmatic Access
Consider implementing API keys for automated trading:
```typescript
// Add API key authentication as alternative to session
function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    // Validate API key
    // Set req.userId based on API key
  }
  next();
}
```

### 4. SQL Injection Prevention
Current implementation uses Drizzle ORM, which provides good protection.
Ensure raw SQL is never used with user input:
```typescript
// GOOD - Parameterized query via ORM
await db.select().from(orders).where(eq(orders.id, orderId));

// BAD - Never do this
await db.execute(sql`SELECT * FROM orders WHERE id = ${orderId}`);
```

---

## Success Metrics

After implementation, measure:

1. **Security Coverage:**
   - Target: 100% of trading endpoints protected
   - Current: 58.7% endpoints protected
   - Goal: >95% endpoints protected

2. **Validation Coverage:**
   - Target: 100% of POST/PUT/PATCH endpoints validated
   - Current: ~70% have validation
   - Goal: >98% have validation

3. **Error Handling:**
   - Target: 100% of endpoints have try-catch
   - Current: ~97% have error handling
   - Goal: 100% have error handling

4. **Incident Rate:**
   - Unauthorized access attempts: Monitor and alert
   - Failed validations: Log and review weekly
   - Authentication failures: <1% of requests

---

## Timeline

| Phase | Duration | Endpoints | Completion Target |
|-------|----------|-----------|-------------------|
| Phase 1 (Critical) | 1 day | 36 | Day 1 |
| Phase 2 (Urgent) | 1 day | 38 | Day 2 |
| Phase 3 (High) | 5 days | 86 | Week 1 |
| Phase 4 (Medium) | 7 days | All remaining | Week 2 |
| Testing & Validation | Ongoing | All | Week 2 |

**Total estimated time:** 2 weeks for complete implementation and testing.

---

## Conclusion

The API currently has significant security vulnerabilities with **97 critical issues** related to missing authentication on sensitive endpoints. All trading, order management, strategy, and risk management endpoints are publicly accessible without authentication.

**IMMEDIATE ACTION REQUIRED:**
1. Add `authMiddleware` to all trading-related endpoints
2. Add `authMiddleware` to all strategy endpoints
3. Add `authMiddleware` to all Alpaca integration endpoints
4. Add `authMiddleware` to all risk management endpoints

Once these critical issues are addressed, the platform's security posture will be significantly improved.
