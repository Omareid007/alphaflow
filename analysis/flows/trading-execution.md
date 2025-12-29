# Trading Execution Flow

Complete documentation of manual and autonomous trading execution in AlphaFlow Trading Platform.

## Overview

| Attribute | Value |
|-----------|-------|
| **Purpose** | Execute trades (buy/sell) through Alpaca broker |
| **Trigger** | Manual action or autonomous strategy signal |
| **Actor** | Authenticated user or autonomous orchestrator |
| **Frequency** | Multiple times daily during market hours |

## Entry Conditions

- [ ] User is authenticated
- [ ] Alpaca account is connected and verified
- [ ] Market is open (for immediate execution)
- [ ] Sufficient buying power available
- [ ] Symbol is tradable

---

## Flow 1: Manual Trading

### Flow Diagram

```
[Research Page / Portfolio]
         |
         v
   [Click "Trade"]
         |
         v
   [Order Entry Form]
         |
         v
   [Validate Order]
         |
    +----+----+
    |         |
    v         v
[Valid]   [Invalid]
    |         |
    v         v
[Preview]  [Error]
    |
    v
[Confirm Order]
    |
    v
[POST /api/alpaca-trading/execute]
    |
    +--------+--------+
    |        |        |
    v        v        v
[Success] [Partial] [Rejected]
    |        |        |
    v        v        v
[Show Fill] [Show Partial] [Show Error]
    |
    v
[Update Positions]
```

### Steps

| Step | User Action | System Response | Component | API Call |
|------|-------------|-----------------|-----------|----------|
| 1 | Click "Trade" on symbol | Open order entry modal | TradeModal | - |
| 2 | Select order type | Update form fields | OrderTypeSelector | - |
| 3 | Enter quantity | Validate against buying power | QuantityInput | GET /api/alpaca/account |
| 4 | Set price (if limit) | Validate against current price | PriceInput | GET /api/alpaca/quotes/:symbol |
| 5 | Review order preview | Show estimated cost/proceeds | OrderPreview | - |
| 6 | Click "Confirm" | Submit order | ConfirmButton | POST /api/alpaca-trading/execute |
| 7 | View confirmation | Show fill details | OrderConfirmation | - |
| 8 | Check positions | Update position list | PositionsTable | GET /api/positions |

### Order Types Supported

| Type | Description | Required Fields |
|------|-------------|-----------------|
| Market | Execute at best available price | Symbol, Qty, Side |
| Limit | Execute at specified price or better | Symbol, Qty, Side, Limit Price |
| Stop | Trigger market order at stop price | Symbol, Qty, Side, Stop Price |
| Stop Limit | Trigger limit order at stop price | Symbol, Qty, Side, Stop, Limit |
| Bracket | Entry with profit target and stop loss | Symbol, Qty, Side, Entry, Target, Stop |

### API Request

```typescript
POST /api/alpaca-trading/execute
Content-Type: application/json

{
  "symbol": "AAPL",
  "qty": 10,
  "side": "buy",
  "type": "limit",
  "limit_price": 175.50,
  "time_in_force": "day",
  "client_order_id": "manual-uuid-timestamp"
}
```

---

## Flow 2: Autonomous Trading

### Flow Diagram

```
[Orchestrator Trigger]
         |
         v
   [Fetch Market Data]
         |
         v
   [Run AI Analysis]
         |
         v
   [Generate Signal]
         |
    +----+----+
    |         |
    v         v
  [BUY]    [SELL]    [HOLD]
    |         |         |
    v         v         v
[Size Position] [Size Position] [Log & Exit]
    |         |
    v         v
[Pre-Trade Validation]
    |
    +--------+--------+
    |                 |
    v                 v
[Pass]            [Fail]
    |                 |
    v                 v
[Execute Order]  [Log Rejection]
    |
    v
[Record Decision]
    |
    v
[Update Learning]
```

### Autonomous Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Orchestrator | `server/autonomous/orchestrator.ts` | Main coordination |
| AI Analyzer | `server/trading/ai-analyzer.ts` | Generate signals |
| Position Manager | `server/autonomous/position-manager.ts` | Track positions |
| Order Queue | `server/autonomous/order-queue.ts` | Queue management |
| Pre-Trade Guard | `server/autonomous/pre-trade-guard.ts` | Risk validation |
| Learning Service | `server/ai/learning-service.ts` | Improve over time |

### Signal Generation

```typescript
interface TradeSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;  // 0-1
  quantity: number;
  reasoning: string;
  factors: {
    technical: number;
    sentiment: number;
    fundamental: number;
    momentum: number;
  };
}
```

### Pre-Trade Validation Checks

| Check | Threshold | Action if Failed |
|-------|-----------|------------------|
| Buying power | > order value | Reject order |
| Position concentration | < 20% portfolio | Reduce size |
| Daily loss limit | < 5% drawdown | Halt trading |
| Correlation check | < 0.7 with existing | Warn |
| Liquidity check | Volume > 100K | Reject or reduce |
| Circuit breaker | < 3 consecutive losses | Pause 30 min |

---

## Happy Path (Manual)

1. User sees AAPL trading at $175.00 on Research page
2. Clicks "Trade" button to open order modal
3. Selects "Buy" and enters quantity: 10 shares
4. Chooses "Limit" order at $174.50
5. Reviews preview: "Buy 10 AAPL @ $174.50 limit = $1,745.00"
6. Clicks "Confirm Order"
7. Receives confirmation: "Order submitted, pending fill"
8. Order fills at $174.45 (price improvement)
9. Position appears in Portfolio with 10 shares @ $174.45

## Happy Path (Autonomous)

1. Orchestrator triggers at 10:00 AM (market open + 30 min)
2. System fetches market data for strategy universe
3. AI analyzes NVDA: Strong momentum, positive sentiment
4. Signal generated: BUY NVDA, 0.85 confidence, 50 shares
5. Pre-trade validation passes all checks
6. Order submitted: Market buy 50 NVDA
7. Fill received: 50 shares @ $142.15
8. Position recorded, decision logged
9. Learning service updates model weights

## Sad Paths

| Scenario | Trigger | Expected Behavior | Recovery |
|----------|---------|-------------------|----------|
| Insufficient funds | Order > buying power | Show "Insufficient buying power" | Reduce quantity |
| Market closed | Order outside hours | Show "Market closed" with hours | Queue for open |
| Symbol halted | Trading halt | Show "Symbol halted" | Wait for resume |
| Connection error | Network failure | Show "Connection error" | Auto-retry 3x |
| Rejected by broker | Compliance issue | Show rejection reason | Review settings |
| Partial fill | Low liquidity | Show partial, cancel rest | Accept partial |

## Edge Cases

| Case | Condition | Expected Behavior |
|------|-----------|-------------------|
| Zero quantity | User enters 0 | Disable submit, show error |
| Fractional shares | Qty < 1 | Allow for supported symbols |
| Pre-market order | Before 9:30 AM ET | Queue or reject based on setting |
| Same-day round trip | Buy then sell same day | Check PDT status |
| Penny stock | Price < $1 | Show warning about volatility |

## State Transitions (Order)

```
[New] --submit--> [Pending] --accepted--> [Open]
                      |                      |
                      v                      |
                  [Rejected]                 |
                                             |
                      +----------+-----------+
                      |          |           |
                      v          v           v
                  [Filled]  [Partial]  [Cancelled]
                      |          |
                      v          v
                  [Done]    [Partial Done]
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/alpaca-trading/execute | Submit order |
| GET | /api/orders | List orders |
| GET | /api/orders/:id | Get order details |
| DELETE | /api/orders/:id | Cancel order |
| GET | /api/positions | List positions |
| DELETE | /api/positions/:symbol | Close position |

## Error Handling

| Error | HTTP Code | User Message | Action |
|-------|-----------|--------------|--------|
| Invalid symbol | 400 | "Symbol not found" | Check symbol |
| Insufficient BP | 400 | "Insufficient buying power" | Reduce qty |
| Market closed | 400 | "Market is closed" | Queue for open |
| Order rejected | 422 | [Broker message] | Review order |
| Rate limited | 429 | "Too many orders" | Wait 1 min |
| Server error | 500 | "Order service unavailable" | Retry later |

## Risk Controls

| Control | Implementation | Location |
|---------|----------------|----------|
| Max order size | 10% of portfolio | Pre-trade guard |
| Daily loss limit | 5% max drawdown | Position manager |
| Position limit | 25 max positions | Portfolio rules |
| Sector limit | 30% max per sector | Rebalancer |
| Circuit breaker | 3 consecutive losses | Order queue |

## Monitoring

| Metric | Alert Threshold | Dashboard |
|--------|-----------------|-----------|
| Order success rate | < 95% | Admin/Orders |
| Fill latency | > 5s | Admin/Observability |
| Error rate | > 1% | Sentry |
| Slippage | > 0.5% | Trading reports |
