# CRITICAL AUTHENTICATION FIXES REQUIRED

## Summary
21 endpoints in `/home/runner/workspace/server/routes.ts` are missing authentication middleware.

## Quick Fix Instructions

Add `authMiddleware` as the second parameter to each of the following endpoint definitions in `server/routes.ts`:

### Position Endpoints (7 fixes)

```typescript
// Line 1310
app.get("/api/positions/snapshot", authMiddleware, async (req, res) => {

// Line 1379
app.get("/api/positions", authMiddleware, async (req, res) => {

// Line 1441
app.get("/api/positions/:id", authMiddleware, async (req, res) => {

// Line 1453
app.post("/api/positions", authMiddleware, async (req, res) => {

// Line 1478
app.delete("/api/positions/:id", authMiddleware, async (req, res) => {

// Line 1491
app.post("/api/positions/reconcile", authMiddleware, async (req, res) => {

// Line 1503
app.get("/api/positions/reconcile/status", authMiddleware, async (req, res) => {
```

### Trade Endpoints (6 fixes)

```typescript
// Line 1233
app.get("/api/trades", authMiddleware, async (req, res) => {

// Line 1243
app.get("/api/trades/enriched", authMiddleware, async (req, res) => {

// Line 1263
app.get("/api/trades/symbols", authMiddleware, async (req, res) => {

// Line 1272
app.get("/api/trades/:id", authMiddleware, async (req, res) => {

// Line 1284
app.get("/api/trades/:id/enriched", authMiddleware, async (req, res) => {

// Line 1296
app.post("/api/trades", authMiddleware, async (req, res) => {
```

### AI Decision Endpoints (4 fixes)

```typescript
// Line 1513
app.get("/api/ai-decisions", authMiddleware, async (req, res) => {

// Line 1523
app.get("/api/ai-decisions/history", authMiddleware, async (req, res) => {

// Line 1553
app.post("/api/ai-decisions", authMiddleware, async (req, res) => {

// Line 1570
app.get("/api/ai-decisions/enriched", authMiddleware, async (req, res) => {
```

### Order/Fill Endpoints (6 fixes)

```typescript
// Line 1980
app.get("/api/orders", authMiddleware, async (req, res) => {

// Line 2009
app.get("/api/fills", authMiddleware, async (req, res) => {

// Line 2045
app.get("/api/fills/order/:orderId", authMiddleware, async (req, res) => {

// Line 2072
app.post("/api/orders/sync", authMiddleware, async (req, res) => {

// Line 2096
app.get("/api/orders/recent", authMiddleware, async (req, res) => {

// Line 2124
app.get("/api/orders/:id", authMiddleware, async (req, res) => {
```

### Analytics Endpoint (1 fix - HIGHEST PRIORITY)

```typescript
// Line 2159 - THIS IS THE MOST CRITICAL ONE
app.get("/api/analytics/summary", authMiddleware, async (req, res) => {
```

## Optional: Remove auth from health endpoints

These currently require auth but should be public:

```typescript
// Line 3116
app.get("/api/health/db", async (req, res) => {  // REMOVE authMiddleware

// Line 3136
app.get("/api/alpaca/health", async (req, res) => {  // REMOVE authMiddleware
```

## Verification

After making changes, restart the server and test:

```bash
# Should return 401 (not authenticated)
curl http://localhost:3000/api/analytics/summary
curl http://localhost:3000/api/positions
curl http://localhost:3000/api/trades
curl http://localhost:3000/api/ai-decisions
curl http://localhost:3000/api/orders

# Should return 200 (public)
curl http://localhost:3000/api/health/db
curl http://localhost:3000/api/alpaca/health
```

## Find & Replace Pattern

If your editor supports it, you can use these find/replace patterns:

1. `app.get("/api/positions/snapshot", async` → `app.get("/api/positions/snapshot", authMiddleware, async`
2. `app.get("/api/positions", async` → `app.get("/api/positions", authMiddleware, async`
3. `app.get("/api/trades`, async` → `app.get("/api/trades", authMiddleware, async`
4. `app.get("/api/ai-decisions`, async` → `app.get("/api/ai-decisions", authMiddleware, async`
5. `app.get("/api/orders`, async` → `app.get("/api/orders", authMiddleware, async`
6. `app.get("/api/fills`, async` → `app.get("/api/fills", authMiddleware, async`
7. `app.get("/api/analytics/summary", async` → `app.get("/api/analytics/summary", authMiddleware, async`
8. `app.post("/api/trades", async` → `app.post("/api/trades", authMiddleware, async`
9. `app.post("/api/positions", async` → `app.post("/api/positions", authMiddleware, async`
10. `app.post("/api/ai-decisions", async` → `app.post("/api/ai-decisions", authMiddleware, async`
11. `app.delete("/api/positions/:id", async` → `app.delete("/api/positions/:id", authMiddleware, async`

**IMPORTANT:** Be careful with find/replace as some endpoints may already have authMiddleware. Always verify each change.

## Why This Matters

These endpoints currently expose:
- Complete account balance and portfolio value
- All trading positions with P&L
- Complete trade history
- Order execution details
- AI trading strategies
- Risk management settings

Without authentication, **anyone on the internet** can access this sensitive financial data.
