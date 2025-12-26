# Authentication Fixes Implementation Guide

## Critical Endpoints Requiring Authentication

To implement these fixes, add `authMiddleware` to the following endpoints in `/home/runner/workspace/server/routes.ts`:

### Phase 1: Critical Trading Operations (HIGH PRIORITY)

```typescript
// Line 406 - GET /api/agent/status
app.get("/api/agent/status", authMiddleware, async (req, res) => {

// Line 423 - POST /api/agent/toggle
app.post("/api/agent/toggle", authMiddleware, async (req, res) => {

// Line 442 - GET /api/autonomous/state
app.get("/api/autonomous/state", authMiddleware, async (req, res) => {

// Line 464 - POST /api/autonomous/start
app.post("/api/autonomous/start", authMiddleware, async (req, res) => {

// Line 475 - POST /api/autonomous/stop
app.post("/api/autonomous/stop", authMiddleware, async (req, res) => {

// Line 486 - POST /api/autonomous/kill-switch
app.post("/api/autonomous/kill-switch", authMiddleware, async (req, res) => {

// Line 502 - PUT /api/autonomous/risk-limits
app.put("/api/autonomous/risk-limits", authMiddleware, async (req, res) => {

// Line 525 - POST /api/autonomous/mode
app.post("/api/autonomous/mode", authMiddleware, async (req, res) => {

// Line 539 - GET /api/agent/market-analysis
app.get("/api/agent/market-analysis", authMiddleware, async (req, res) => {

// Line 556 - POST /api/agent/market-analysis/refresh
app.post("/api/agent/market-analysis/refresh", authMiddleware, async (req, res) => {

// Line 566 - GET /api/agent/dynamic-limits
app.get("/api/agent/dynamic-limits", authMiddleware, async (req, res) => {

// Line 591 - POST /api/agent/set-limits
app.post("/api/agent/set-limits", authMiddleware, async (req, res) => {

// Line 629 - GET /api/agent/health
app.get("/api/agent/health", authMiddleware, async (req, res) => {

// Line 645 - POST /api/agent/auto-start
app.post("/api/agent/auto-start", authMiddleware, async (req, res) => {

// Line 661 - GET /api/autonomous/execution-history
app.get("/api/autonomous/execution-history", authMiddleware, async (req, res) => {

// Line 670 - POST /api/autonomous/close-position
app.post("/api/autonomous/close-position", authMiddleware, async (req, res) => {

// Line 690 - POST /api/autonomous/execute-trades
app.post("/api/autonomous/execute-trades", authMiddleware, async (req, res) => {

// Line 760 - GET /api/autonomous/open-orders
app.get("/api/autonomous/open-orders", authMiddleware, async (req, res) => {

// Line 770 - POST /api/autonomous/cancel-stale-orders
app.post("/api/autonomous/cancel-stale-orders", authMiddleware, async (req, res) => {

// Line 781 - POST /api/autonomous/cancel-all-orders
app.post("/api/autonomous/cancel-all-orders", authMiddleware, async (req, res) => {

// Line 791 - GET /api/autonomous/reconcile-positions
app.get("/api/autonomous/reconcile-positions", authMiddleware, async (req, res) => {

// Line 801 - POST /api/autonomous/sync-positions
app.post("/api/autonomous/sync-positions", authMiddleware, async (req, res) => {

// Line 811 - POST /api/autonomous/close-all-positions
app.post("/api/autonomous/close-all-positions", authMiddleware, async (req, res) => {

// Line 821 - GET /api/orders/unreal
app.get("/api/orders/unreal", authMiddleware, async (req, res) => {

// Line 834 - POST /api/orders/cleanup
app.post("/api/orders/cleanup", authMiddleware, async (req, res) => {

// Line 849 - POST /api/orders/reconcile
app.post("/api/orders/reconcile", authMiddleware, async (req, res) => {

// Line 866 - GET /api/orders/execution-engine/status
app.get("/api/orders/execution-engine/status", authMiddleware, async (req, res) => {
```

### Phase 2: Strategy & Trade Endpoints (HIGH PRIORITY)

```typescript
// Line 889 - GET /api/strategies
app.get("/api/strategies", authMiddleware, async (req, res) => {

// Line 898 - GET /api/strategies/:id
app.get("/api/strategies/:id", authMiddleware, async (req, res) => {

// Line 910 - POST /api/strategies
app.post("/api/strategies", authMiddleware, async (req, res) => {

// Line 923 - PATCH /api/strategies/:id
app.patch("/api/strategies/:id", authMiddleware, async (req, res) => {

// Line 935 - POST /api/strategies/:id/toggle
app.post("/api/strategies/:id/toggle", authMiddleware, async (req, res) => {

// Line 948 - POST /api/strategies/:id/start
app.post("/api/strategies/:id/start", authMiddleware, async (req, res) => {

// Line 968 - POST /api/strategies/:id/stop
app.post("/api/strategies/:id/stop", authMiddleware, async (req, res) => {

// Line 988-1222 - All strategy backtest/config endpoints - ADD authMiddleware

// Line 1224 - GET /api/trades
app.get("/api/trades", authMiddleware, async (req, res) => {

// Line 1234 - GET /api/trades/enriched
app.get("/api/trades/enriched", authMiddleware, async (req, res) => {

// Line 1254 - GET /api/trades/symbols
app.get("/api/trades/symbols", authMiddleware, async (req, res) => {

// Line 1263 - GET /api/trades/:id
app.get("/api/trades/:id", authMiddleware, async (req, res) => {

// Line 1275 - GET /api/trades/:id/enriched
app.get("/api/trades/:id/enriched", authMiddleware, async (req, res) => {

// Line 1287 - POST /api/trades
app.post("/api/trades", authMiddleware, async (req, res) => {
```

### Phase 3: Position & Order Endpoints (HIGH PRIORITY)

```typescript
// Line 1302 - GET /api/positions
app.get("/api/positions", authMiddleware, async (req, res) => {

// Line 1338 - GET /api/positions/broker
app.get("/api/positions/broker", authMiddleware, async (req, res) => {

// Line 1364 - GET /api/positions/:id
app.get("/api/positions/:id", authMiddleware, async (req, res) => {

// Line 1376 - POST /api/positions
app.post("/api/positions", authMiddleware, async (req, res) => {

// Line 1389 - PATCH /api/positions/:id
app.patch("/api/positions/:id", authMiddleware, async (req, res) => {

// Line 1401 - DELETE /api/positions/:id
app.delete("/api/positions/:id", authMiddleware, async (req, res) => {

// Line 1414 - POST /api/positions/reconcile
app.post("/api/positions/reconcile", authMiddleware, async (req, res) => {

// Line 1426 - GET /api/positions/reconcile/status
app.get("/api/positions/reconcile/status", authMiddleware, async (req, res) => {

// Line 1436 - GET /api/ai-decisions
app.get("/api/ai-decisions", authMiddleware, async (req, res) => {

// Line 1446 - GET /api/ai-decisions/history
app.get("/api/ai-decisions/history", authMiddleware, async (req, res) => {

// Line 1476 - POST /api/ai-decisions
app.post("/api/ai-decisions", authMiddleware, async (req, res) => {

// Line 1493 - GET /api/ai-decisions/enriched
app.get("/api/ai-decisions/enriched", authMiddleware, async (req, res) => {

// Line 1903 - GET /api/orders
app.get("/api/orders", authMiddleware, async (req, res) => {

// Line 1932 - GET /api/fills
app.get("/api/fills", authMiddleware, async (req, res) => {

// Line 1968 - GET /api/fills/order/:orderId
app.get("/api/fills/order/:orderId", authMiddleware, async (req, res) => {

// Line 1995 - POST /api/orders/sync
app.post("/api/orders/sync", authMiddleware, async (req, res) => {

// Line 2019 - GET /api/orders/recent
app.get("/api/orders/recent", authMiddleware, async (req, res) => {

// Line 2047 - GET /api/orders/:id
app.get("/api/orders/:id", authMiddleware, async (req, res) => {

// Line 2082 - GET /api/analytics/summary
app.get("/api/analytics/summary", authMiddleware, async (req, res) => {
```

### Phase 4: Alpaca Integration Endpoints (HIGH PRIORITY)

```typescript
// Line 2375 - POST /api/ai/analyze
app.post("/api/ai/analyze", authMiddleware, async (req, res) => {

// Line 2433 - GET /api/ai/status
app.get("/api/ai/status", authMiddleware, async (req, res) => {

// Line 2443 - GET /api/ai/cache/stats
app.get("/api/ai/cache/stats", authMiddleware, async (req, res) => {

// Line 2453 - POST /api/ai/cache/clear
app.post("/api/ai/cache/clear", authMiddleware, async (req, res) => {

// Line 2463 - POST /api/ai/cache/clear/:role
app.post("/api/ai/cache/clear/:role", authMiddleware, async (req, res) => {

// Line 2474 - POST /api/ai/cache/reset-stats
app.post("/api/ai/cache/reset-stats", authMiddleware, async (req, res) => {

// Line 2484 - GET /api/connectors/status
app.get("/api/connectors/status", authMiddleware, async (req, res) => {

// Line 2628 - GET /api/fusion/intelligence
app.get("/api/fusion/intelligence", authMiddleware, async (req, res) => {

// Line 2638 - GET /api/fusion/market-data
app.get("/api/fusion/market-data", authMiddleware, async (req, res) => {

// Line 2648 - GET /api/fusion/status
app.get("/api/fusion/status", authMiddleware, async (req, res) => {

// Line 2657 - GET /api/risk/settings
app.get("/api/risk/settings", authMiddleware, async (req, res) => {

// Line 2682 - POST /api/risk/settings
app.post("/api/risk/settings", authMiddleware, async (req, res) => {

// Line 2731 - POST /api/risk/kill-switch
app.post("/api/risk/kill-switch", authMiddleware, async (req, res) => {

// Line 2758 - POST /api/risk/close-all
app.post("/api/risk/close-all", authMiddleware, async (req, res) => {

// Line 2773 - POST /api/risk/emergency-liquidate
app.post("/api/risk/emergency-liquidate", authMiddleware, async (req, res) => {

// Line 2821 - GET /api/alpaca/account
app.get("/api/alpaca/account", authMiddleware, async (req, res) => {

// Line 2831 - GET /api/alpaca/positions
app.get("/api/alpaca/positions", authMiddleware, async (req, res) => {

// Line 2847 - GET /api/alpaca/orders
app.get("/api/alpaca/orders", authMiddleware, async (req, res) => {

// Line 2859 - POST /api/alpaca/orders
app.post("/api/alpaca/orders", authMiddleware, async (req, res) => {

// Line 2883 - DELETE /api/alpaca/orders/:orderId
app.delete("/api/alpaca/orders/:orderId", authMiddleware, async (req, res) => {

// Line 2893 - GET /api/alpaca/assets
app.get("/api/alpaca/assets", authMiddleware, async (req, res) => {

// Line 2904 - GET /api/alpaca/allocations
app.get("/api/alpaca/allocations", authMiddleware, async (req, res) => {

// Line 2914 - POST /api/alpaca/rebalance/preview
app.post("/api/alpaca/rebalance/preview", authMiddleware, async (req, res) => {

// Line 2938 - POST /api/alpaca/rebalance/execute
app.post("/api/alpaca/rebalance/execute", authMiddleware, async (req, res) => {

// Line 2962 - GET /api/alpaca/rebalance/suggestions
app.get("/api/alpaca/rebalance/suggestions", authMiddleware, async (req, res) => {

// Line 2972 - GET /api/alpaca/assets/search
app.get("/api/alpaca/assets/search", authMiddleware, async (req, res) => {

// Line 2986 - GET /api/alpaca/bars
app.get("/api/alpaca/bars", authMiddleware, async (req, res) => {

// Line 3000 - GET /api/alpaca/snapshots
app.get("/api/alpaca/snapshots", authMiddleware, async (req, res) => {

// Line 3038 - GET /api/alpaca/health
app.get("/api/alpaca/health", authMiddleware, async (req, res) => {

// Line 3068 - GET /api/alpaca/can-trade-extended/:symbol
app.get("/api/alpaca/can-trade-extended/:symbol", authMiddleware, async (req, res) => {

// Line 3080-3176 - All trading session endpoints - ADD authMiddleware

// Line 3209 - POST /api/alpaca/validate-order
app.post("/api/alpaca/validate-order", authMiddleware, async (req, res) => {

// Line 3329 - GET /api/alpaca-trading/status
app.get("/api/alpaca-trading/status", authMiddleware, async (req, res) => {

// Line 3340 - POST /api/alpaca-trading/execute
app.post("/api/alpaca-trading/execute", authMiddleware, async (req, res) => {

// Line 3373 - POST /api/alpaca-trading/close/:symbol
app.post("/api/alpaca-trading/close/:symbol", authMiddleware, async (req, res) => {

// Line 3391 - POST /api/alpaca-trading/analyze
app.post("/api/alpaca-trading/analyze", authMiddleware, async (req, res) => {

// Line 3407 - POST /api/alpaca-trading/analyze-execute
app.post("/api/alpaca-trading/analyze-execute", authMiddleware, async (req, res) => {

// Line 3423 - POST /api/strategies/:id/start (DUPLICATE)
app.post("/api/strategies/:id/start", authMiddleware, async (req, res) => {

// Line 3439 - POST /api/strategies/:id/stop (DUPLICATE)
app.post("/api/strategies/:id/stop", authMiddleware, async (req, res) => {

// Line 3455 - GET /api/strategies/:id/status
app.get("/api/strategies/:id/status", authMiddleware, async (req, res) => {

// Line 3475 - POST /api/alpaca-trading/stop-all
app.post("/api/alpaca-trading/stop-all", authMiddleware, async (req, res) => {

// Line 3485 - GET /api/orchestration/status
app.get("/api/orchestration/status", authMiddleware, async (req, res) => {

// Line 3496 - POST /api/orchestration/start
app.post("/api/orchestration/start", authMiddleware, async (req, res) => {

// Line 3506 - POST /api/orchestration/stop
app.post("/api/orchestration/stop", authMiddleware, async (req, res) => {

// Line 3516 - PUT /api/orchestration/config
app.put("/api/orchestration/config", authMiddleware, async (req, res) => {

// Line 3527 - GET /api/orchestration/logs
app.get("/api/orchestration/logs", authMiddleware, async (req, res) => {

// Line 3542 - GET /api/orchestration/logs/errors
app.get("/api/orchestration/logs/errors", authMiddleware, async (req, res) => {

// Line 3553 - GET /api/orchestration/events
app.get("/api/orchestration/events", authMiddleware, async (req, res) => {

// Line 3568 - POST /api/orchestration/reset-stats
app.post("/api/orchestration/reset-stats", authMiddleware, async (req, res) => {

// Line 3578 - GET /api/performance/metrics
app.get("/api/performance/metrics", authMiddleware, async (req, res) => {
```

## Intentionally Public Endpoints (DO NOT MODIFY)

These endpoints are intentionally left public for valid reasons:

```typescript
// Auth endpoints
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me

// Market data (public information)
GET /api/crypto/*
GET /api/stock/*
GET /api/news/*
GET /api/alpaca/clock
GET /api/alpaca/market-status

// Public watchlist/candidates
GET /api/candidates
GET /api/watchlist

// Trading sessions (market hours are public)
GET /api/trading-sessions/*
```

## Implementation Script

Run this sed script to apply all authentication fixes at once:

```bash
cd /home/runner/workspace/server
# Backup first
cp routes.ts routes.ts.backup

# Apply fixes (example for a few critical endpoints)
sed -i 's/app.post("\/api\/agent\/toggle", async/app.post("\/api\/agent\/toggle", authMiddleware, async/g' routes.ts
sed -i 's/app.post("\/api\/autonomous\/start", async/app.post("\/api\/autonomous\/start", authMiddleware, async/g' routes.ts
# ... (continue for all endpoints listed above)
```

## Testing After Implementation

1. Verify unauthenticated requests return 401:
```bash
curl -X POST http://localhost:5000/api/agent/toggle
# Expected: {"error":"Not authenticated"}
```

2. Verify authenticated requests work:
```bash
curl -X POST http://localhost:5000/api/agent/toggle \
  -H "Cookie: session=YOUR_SESSION_ID"
# Expected: Success response
```

3. Run full API test suite to ensure no breakage

## Notes

- Total endpoints requiring auth: ~75
- Estimated time: 30-45 minutes
- Breaking change: Requires all API clients to authenticate
- Migration: Update frontend to handle 401 responses gracefully
