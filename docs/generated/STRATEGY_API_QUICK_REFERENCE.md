# Strategy API Quick Reference

## Endpoint Summary

### 1. Activate Strategy Version (with Backtest Validation)
```bash
POST /api/strategies/versions/:id/activate
```

**Requires:** Valid session cookie or admin token
**Validation:** Strategy must have at least one successful backtest

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/strategies/versions/abc-123/activate \
  -H "Cookie: session=xyz-789" \
  -H "Content-Type: application/json"
```

**Success (200):**
```json
{
  "id": "abc-123",
  "strategyId": "strategy-456",
  "version": 1,
  "name": "Momentum Strategy v1",
  "status": "active",
  "activatedAt": "2025-12-23T10:30:00.000Z",
  "spec": { ... },
  ...
}
```

**Validation Failed (400):**
```json
{
  "error": "Backtest validation required",
  "message": "Strategy must have at least one successful backtest before activation. Please run a backtest and verify results before activating this strategy.",
  "strategyId": "strategy-456",
  "strategyVersionId": "abc-123"
}
```

---

### 2. Get Strategy Performance
```bash
GET /api/strategies/:id/performance
```

**Requires:** Valid session cookie or admin token
**Returns:** Real-time performance metrics, positions, trades, and AI decisions

**Example Request:**
```bash
curl -X GET http://localhost:5000/api/strategies/strategy-456/performance \
  -H "Cookie: session=xyz-789"
```

**Success (200):**
```json
{
  "strategyId": "strategy-456",
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

**Not Found (404):**
```json
{
  "error": "Strategy not found"
}
```

---

## Metrics Explained

### Trade Counts
- **totalTrades**: All trades (opening + closing)
- **closingTrades**: Trades that closed a position (have P&L)
- **openingTrades**: Trades that opened a position (no P&L yet)

### P&L Metrics
- **realizedPnl**: Total profit/loss from closed positions
- **unrealizedPnl**: Total profit/loss from open positions
- **totalPnl**: Sum of realized + unrealized P&L

### Win/Loss Metrics
- **winningTrades**: Number of profitable closed trades
- **losingTrades**: Number of unprofitable closed trades
- **winRate**: Percentage of winning trades (winningTrades / closingTrades * 100)

### Average Trade Metrics
- **avgWin**: Average profit per winning trade
- **avgLoss**: Average loss per losing trade
- **avgTrade**: Average P&L per closed trade
- **profitFactor**: Ratio of average win to average loss (higher is better)

---

## Complete Workflow Example

### Step 1: Create a Strategy
```bash
curl -X POST http://localhost:5000/api/strategies \
  -H "Cookie: session=xyz-789" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Momentum Strategy",
    "type": "momentum",
    "description": "Trading on momentum signals",
    "isActive": false,
    "assets": ["AAPL", "GOOGL", "MSFT"],
    "parameters": "{\"riskLevel\": \"medium\"}"
  }'
```

### Step 2: Run a Backtest
```bash
curl -X POST http://localhost:5000/api/backtests/run \
  -H "Cookie: session=xyz-789" \
  -H "Content-Type: application/json" \
  -d '{
    "strategyId": "{strategy-id-from-step-1}",
    "universe": ["AAPL", "GOOGL", "MSFT"],
    "startDate": "2024-01-01",
    "endDate": "2024-06-01",
    "initialCash": 10000,
    "strategyType": "moving_average_crossover",
    "strategyParams": {
      "fastPeriod": 10,
      "slowPeriod": 20,
      "allocationPct": 10
    }
  }'
```

### Step 3: Create Strategy Version
```bash
curl -X POST http://localhost:5000/api/strategies/versions \
  -H "Cookie: session=xyz-789" \
  -H "Content-Type: application/json" \
  -d '{
    "strategyId": "{strategy-id}",
    "name": "Momentum v1",
    "version": 1,
    "spec": {
      "type": "momentum",
      "params": {"fastPeriod": 10, "slowPeriod": 20}
    },
    "status": "draft"
  }'
```

### Step 4: Activate Strategy Version (with Backtest Validation)
```bash
curl -X POST http://localhost:5000/api/strategies/versions/{version-id}/activate \
  -H "Cookie: session=xyz-789" \
  -H "Content-Type: application/json"
```

### Step 5: Monitor Performance
```bash
curl -X GET http://localhost:5000/api/strategies/{strategy-id}/performance \
  -H "Cookie: session=xyz-789"
```

### Step 6: Check Performance Periodically
```bash
# Poll every 30 seconds for updates
while true; do
  curl -X GET http://localhost:5000/api/strategies/{strategy-id}/performance \
    -H "Cookie: session=xyz-789" | jq '.metrics'
  sleep 30
done
```

---

## Common Use Cases

### Check if Strategy Can Be Activated
```bash
# First check backtest history
curl -X GET http://localhost:5000/api/backtests?strategyId={strategy-id} \
  -H "Cookie: session=xyz-789"

# Look for status: "DONE" in the response
# If found, activation will succeed
```

### Monitor Live Trading Performance
```bash
# Get comprehensive performance snapshot
curl -X GET http://localhost:5000/api/strategies/{strategy-id}/performance \
  -H "Cookie: session=xyz-789" | jq '{
    pnl: .metrics.totalPnl,
    winRate: .metrics.winRate,
    profitFactor: .metrics.profitFactor,
    positions: .positions | length,
    status: .status
  }'
```

### Calculate Current Risk Exposure
```bash
# Sum up unrealized P&L across all positions
curl -X GET http://localhost:5000/api/strategies/{strategy-id}/performance \
  -H "Cookie: session=xyz-789" | jq '
    .positions
    | map(.unrealizedPnl)
    | add
  '
```

### Track Win Rate Over Time
```bash
# Extract just the win rate metric
curl -X GET http://localhost:5000/api/strategies/{strategy-id}/performance \
  -H "Cookie: session=xyz-789" | jq '.metrics.winRate'
```

---

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Backtest validation failed | Run a successful backtest first |
| 401 | Not authenticated | Provide valid session cookie or admin token |
| 404 | Strategy/version not found | Verify the ID is correct |
| 500 | Server error | Check server logs for details |

---

## Pro Tips

1. **Always backtest first**: The validation gate ensures you can't activate untested strategies
2. **Monitor profit factor**: Values > 2.0 indicate strong strategy performance
3. **Check lastError**: If status is "stopped", check lastError for issues
4. **Track unrealizedPnl**: Watch open positions for risk management
5. **Use recent trades**: The 10 most recent trades help spot patterns
6. **Monitor lastDecision**: See what the AI is planning next

---

## TypeScript Types

```typescript
// Performance Response
interface StrategyPerformance {
  strategyId: string;
  strategyName: string;
  status: "running" | "stopped";
  lastCheck: Date | null;
  lastError: string | null;
  metrics: PerformanceMetrics;
  positions: Position[];
  recentTrades: Trade[];
  lastDecision: AIDecision | null;
}

interface PerformanceMetrics {
  totalTrades: number;
  closingTrades: number;
  openingTrades: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgTrade: number;
  profitFactor: number;
}

interface Position {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  openedAt: Date;
}

interface Trade {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  pnl: number | null;
  status: string;
  executedAt: Date;
  notes: string | null;
}

interface AIDecision {
  action: string;
  confidence: number;
  reasoning: string;
  riskLevel: string;
}
```

---

## Integration Examples

### React Component
```tsx
import { useState, useEffect } from 'react';

function StrategyPerformance({ strategyId }: { strategyId: string }) {
  const [performance, setPerformance] = useState(null);

  useEffect(() => {
    const fetchPerformance = async () => {
      const res = await fetch(`/api/strategies/${strategyId}/performance`);
      const data = await res.json();
      setPerformance(data);
    };

    fetchPerformance();
    const interval = setInterval(fetchPerformance, 30000); // Update every 30s

    return () => clearInterval(interval);
  }, [strategyId]);

  if (!performance) return <div>Loading...</div>;

  return (
    <div>
      <h2>{performance.strategyName}</h2>
      <div>Status: {performance.status}</div>
      <div>Total P&L: ${performance.metrics.totalPnl.toFixed(2)}</div>
      <div>Win Rate: {performance.metrics.winRate.toFixed(1)}%</div>
      <div>Profit Factor: {performance.metrics.profitFactor.toFixed(2)}</div>
    </div>
  );
}
```

### Python Script
```python
import requests
import time

BASE_URL = "http://localhost:5000"
SESSION_COOKIE = "xyz-789"

def get_performance(strategy_id):
    response = requests.get(
        f"{BASE_URL}/api/strategies/{strategy_id}/performance",
        cookies={"session": SESSION_COOKIE}
    )
    return response.json()

def monitor_strategy(strategy_id, interval=30):
    while True:
        perf = get_performance(strategy_id)
        print(f"P&L: ${perf['metrics']['totalPnl']:.2f} | "
              f"Win Rate: {perf['metrics']['winRate']:.1f}% | "
              f"Positions: {len(perf['positions'])}")
        time.sleep(interval)

if __name__ == "__main__":
    monitor_strategy("strategy-456")
```

---

## Files Modified

- `/home/runner/workspace/server/routes/strategies.ts` - Both features implemented here

## Dependencies

- `drizzle-orm` - Database queries
- `@shared/schema` - Table definitions
- `../trading/alpaca-trading-engine` - Real-time state access
- `../utils/logger` - Logging

## Authentication Required

Both endpoints require authentication via:
- Session cookie (`Cookie: session={id}`)
- Admin token header (`X-Admin-Token: {token}`)

Set via existing `authMiddleware` in routes registration.
