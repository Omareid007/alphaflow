# Strategy-Related Features Implementation

This document describes the implementation of two new strategy-related features:

1. **Backtest Validation Gate** - Requires successful backtest before strategy activation
2. **Strategy Monitoring Dashboard API** - Real-time performance metrics endpoint

---

## 1. Backtest Validation Gate

### Overview
Prevents strategy activation without prior backtest validation to ensure strategies are tested before going live.

### Implementation Location
`/home/runner/workspace/server/routes/strategies.ts` - Line 94-153

### Endpoint
```
POST /api/strategies/versions/:id/activate
```

### Validation Logic
1. Retrieves the strategy version by ID
2. Queries `backtestRuns` table for successful backtests (status = "DONE")
3. Filters by `strategyId` to find backtests for this specific strategy
4. Returns 400 error if no successful backtest exists
5. Proceeds with activation if validation passes

### Database Query
```typescript
const successfulBacktests = await db
  .select()
  .from(backtestRuns)
  .where(
    and(
      eq(backtestRuns.strategyId, version.strategyId),
      eq(backtestRuns.status, "DONE")
    )
  )
  .orderBy(desc(backtestRuns.createdAt))
  .limit(1);
```

### Error Response (No Backtest)
```json
{
  "error": "Backtest validation required",
  "message": "Strategy must have at least one successful backtest before activation. Please run a backtest and verify results before activating this strategy.",
  "strategyId": "strategy-uuid",
  "strategyVersionId": "version-uuid"
}
```

### Success Response
Standard strategy version object with `status: "active"` and `activatedAt` timestamp.

### Logging
- **Warning**: Logs when activation is blocked due to missing backtest
- **Info**: Logs when backtest validation passes with backtest details

### Testing the Feature

#### Test Case 1: Activation Without Backtest (Should Fail)
```bash
curl -X POST http://localhost:5000/api/strategies/versions/{version-id}/activate \
  -H "Cookie: session={your-session}" \
  -H "Content-Type: application/json"
```

Expected Response:
```json
{
  "error": "Backtest validation required",
  "message": "Strategy must have at least one successful backtest before activation..."
}
```

#### Test Case 2: Activation With Backtest (Should Succeed)
```bash
# First, run a backtest
curl -X POST http://localhost:5000/api/backtests/run \
  -H "Cookie: session={your-session}" \
  -H "Content-Type: application/json" \
  -d '{
    "strategyId": "{strategy-id}",
    "universe": ["AAPL", "GOOGL"],
    "startDate": "2024-01-01",
    "endDate": "2024-06-01",
    "initialCash": 10000,
    "strategyType": "moving_average_crossover"
  }'

# Then activate the strategy version
curl -X POST http://localhost:5000/api/strategies/versions/{version-id}/activate \
  -H "Cookie: session={your-session}" \
  -H "Content-Type: application/json"
```

Expected Response:
```json
{
  "id": "version-uuid",
  "strategyId": "strategy-uuid",
  "status": "active",
  "activatedAt": "2025-12-23T...",
  ...
}
```

---

## 2. Strategy Monitoring Dashboard API

### Overview
Provides real-time performance metrics for active strategies, including P&L, trades, positions, and win rate.

### Implementation Location
`/home/runner/workspace/server/routes/strategies.ts` - Line 186-326

### Endpoint
```
GET /api/strategies/:id/performance
```

### Data Sources

#### 1. Strategy State (alpacaTradingEngine)
- Real-time running status
- Last check timestamp
- Last AI decision
- Current errors

#### 2. Trades Table (Database)
- All historical trades for the strategy
- P&L calculations
- Win/loss statistics

#### 3. Positions Table (Database)
- Current open positions
- Unrealized P&L

### Response Schema
```typescript
{
  strategyId: string;
  strategyName: string;
  status: "running" | "stopped";
  lastCheck: Date | null;
  lastError: string | null;

  metrics: {
    // Trade counts
    totalTrades: number;
    closingTrades: number;
    openingTrades: number;

    // P&L metrics
    realizedPnl: number;
    unrealizedPnl: number;
    totalPnl: number;

    // Win/Loss metrics
    winningTrades: number;
    losingTrades: number;
    winRate: number;  // percentage

    // Average trade metrics
    avgWin: number;
    avgLoss: number;
    avgTrade: number;
    profitFactor: number;  // avgWin / abs(avgLoss)
  };

  positions: Array<{
    id: string;
    symbol: string;
    side: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    openedAt: Date;
  }>;

  recentTrades: Array<{
    id: string;
    symbol: string;
    side: string;
    quantity: number;
    price: number;
    pnl: number | null;
    status: string;
    executedAt: Date;
    notes: string | null;
  }>;

  lastDecision: {
    action: string;
    confidence: number;
    reasoning: string;
    riskLevel: string;
  } | null;
}
```

### Metrics Calculations

#### Win Rate
```typescript
const winRate = closingTrades.length > 0
  ? (winningTrades.length / closingTrades.length) * 100
  : 0;
```

#### Total P&L
```typescript
const totalPnl = closingTrades.reduce((sum, t) => {
  return sum + parseFloat(t.pnl || "0");
}, 0);
```

#### Average Win/Loss
```typescript
const avgWin = winningTrades.length > 0
  ? winningTrades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0) / winningTrades.length
  : 0;

const avgLoss = losingTrades.length > 0
  ? losingTrades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0) / losingTrades.length
  : 0;
```

#### Profit Factor
```typescript
const profitFactor = avgLoss !== 0
  ? avgWin / Math.abs(avgLoss)
  : avgWin > 0 ? Infinity : 0;
```

### Testing the Feature

#### Basic Performance Check
```bash
curl -X GET http://localhost:5000/api/strategies/{strategy-id}/performance \
  -H "Cookie: session={your-session}" \
  -H "Content-Type: application/json"
```

#### Example Response
```json
{
  "strategyId": "abc-123-def",
  "strategyName": "Auto-Pilot Strategy",
  "status": "running",
  "lastCheck": "2025-12-23T10:30:00.000Z",
  "lastError": null,
  "metrics": {
    "totalTrades": 50,
    "closingTrades": 25,
    "openingTrades": 25,
    "realizedPnl": 1250.50,
    "unrealizedPnl": 320.75,
    "totalPnl": 1571.25,
    "winningTrades": 18,
    "losingTrades": 7,
    "winRate": 72.0,
    "avgWin": 125.30,
    "avgLoss": -45.20,
    "avgTrade": 50.02,
    "profitFactor": 2.77
  },
  "positions": [
    {
      "id": "pos-1",
      "symbol": "AAPL",
      "side": "long",
      "quantity": 10,
      "entryPrice": 180.50,
      "currentPrice": 185.25,
      "unrealizedPnl": 47.50,
      "openedAt": "2025-12-20T14:30:00.000Z"
    }
  ],
  "recentTrades": [
    {
      "id": "trade-1",
      "symbol": "GOOGL",
      "side": "sell",
      "quantity": 5,
      "price": 142.30,
      "pnl": 67.50,
      "status": "completed",
      "executedAt": "2025-12-23T09:15:00.000Z",
      "notes": "AI Decision: SELL with 75% confidence..."
    }
  ],
  "lastDecision": {
    "action": "buy",
    "confidence": 0.72,
    "reasoning": "Strong upward momentum with positive sentiment",
    "riskLevel": "medium"
  }
}
```

---

## Integration with Existing System

### Routes Registration
Both endpoints are automatically registered through the existing strategies router mounting in `/home/runner/workspace/server/routes.ts`:

```typescript
app.use("/api/strategies", authMiddleware, strategiesRouter);
```

### Authentication
Both endpoints require authentication via the `authMiddleware` which checks for valid session cookies or admin tokens.

### Dependencies
- `drizzle-orm` for database queries
- `@shared/schema` for table definitions
- `../trading/alpaca-trading-engine` for real-time state
- `../utils/logger` for logging

### Database Tables Used
1. `backtestRuns` - For backtest validation
2. `strategies` - For strategy metadata
3. `trades` - For trade history and P&L
4. `positions` - For current positions
5. `strategyVersions` - For version management

---

## Error Handling

### Backtest Validation Gate Errors
- **404**: Strategy version not found
- **400**: No successful backtest found (validation failed)
- **500**: Database or server error

### Performance Dashboard Errors
- **404**: Strategy not found
- **500**: Database query error or calculation error

All errors are logged with appropriate context for debugging.

---

## Performance Considerations

### Backtest Validation
- Single database query with index on `strategyId` and `status`
- Limit 1 for fast retrieval
- Minimal overhead on activation flow

### Performance Dashboard
- Trades query limited to 1000 most recent trades
- Positions query scoped to single strategy
- Recent trades sliced to 10 for UI display
- All calculations done in-memory for speed

### Recommended Indexes
```sql
CREATE INDEX idx_backtest_runs_strategy_status
  ON backtest_runs(strategy_id, status);

CREATE INDEX idx_trades_strategy_executed
  ON trades(strategy_id, executed_at DESC);

CREATE INDEX idx_positions_strategy
  ON positions(strategy_id);
```

---

## Future Enhancements

### Backtest Validation Gate
1. Configurable backtest freshness requirement (e.g., must be < 30 days old)
2. Minimum performance thresholds (e.g., win rate > 55%)
3. Multiple backtest requirement for robustness
4. Backtest comparison across different market conditions

### Performance Dashboard
1. Time-series equity curve
2. Drawdown analysis
3. Sharpe ratio and other risk metrics
4. Comparison with benchmark (e.g., SPY)
5. Daily/weekly/monthly performance breakdown
6. Real-time streaming updates via WebSocket

---

## Maintenance Notes

### Logs to Monitor
- `"StrategiesAPI"` - All strategy route operations
- `"BacktestRunner"` - Backtest execution
- `"AlpacaTradingEngine"` - Real-time strategy state

### Common Issues
1. **False negative on backtest validation**: Check if backtest status is actually "DONE" and not "FAILED"
2. **Stale performance metrics**: Ensure positions are synced with Alpaca regularly
3. **Missing trades**: Verify strategyId is properly set when creating trades

### Testing Checklist
- [ ] Test activation without backtest (should fail)
- [ ] Test activation with successful backtest (should succeed)
- [ ] Test activation with failed backtest (should fail)
- [ ] Test performance endpoint for running strategy
- [ ] Test performance endpoint for stopped strategy
- [ ] Test performance endpoint with no trades
- [ ] Test performance endpoint with open positions
- [ ] Verify P&L calculations accuracy
- [ ] Verify win rate calculations
- [ ] Verify profit factor edge cases (division by zero)

---

## API Documentation Summary

### POST /api/strategies/versions/:id/activate
Activate a strategy version (requires successful backtest)

**Request Headers:**
- `Cookie: session={session-id}` or `X-Admin-Token: {token}`

**Response (Success):**
- Status: 200
- Body: Strategy version object with `status: "active"`

**Response (Validation Failed):**
- Status: 400
- Body: `{ error: "Backtest validation required", message: "...", strategyId, strategyVersionId }`

---

### GET /api/strategies/:id/performance
Get real-time performance metrics for a strategy

**Request Headers:**
- `Cookie: session={session-id}` or `X-Admin-Token: {token}`

**Response:**
- Status: 200
- Body: Performance object with metrics, positions, trades, and last decision

**Response (Not Found):**
- Status: 404
- Body: `{ error: "Strategy not found" }`

---

## Implementation Complete

Both features are fully implemented and integrated into the existing `/api/strategies` router with authentication, error handling, and comprehensive logging.

File modified: `/home/runner/workspace/server/routes/strategies.ts`

No database migrations required - uses existing tables.
