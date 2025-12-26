# Order Rejection Feedback Loop System

## Overview

The Order Retry Handler is an automated system that monitors Alpaca order status changes via websocket, detects rejected or canceled orders, analyzes the rejection reason, applies intelligent fixes, and automatically retries with corrected parameters.

## Features

### 1. Automatic Detection
- Hooks into Alpaca websocket trade updates
- Monitors for `rejected` and `canceled` order statuses
- Extracts rejection reasons from order metadata

### 2. Intelligent Pattern Matching
- 20+ built-in rejection patterns
- Categorized by failure type
- Extensible handler system

### 3. Automated Fixes
- Converts market orders to limit orders for extended hours
- Adjusts aggressive pricing to broker-acceptable ranges
- Reduces quantities to fit buying power
- Rounds fractional shares to whole numbers
- Converts time-in-force to compatible values
- And many more...

### 4. Retry Safety
- Maximum 3 retry attempts per order
- Exponential backoff (2s, 4s, 8s)
- Circuit breaker prevents cascade failures
- Idempotent order submission

### 5. Observability
- Full retry attempt history
- Success/failure tracking
- Circuit breaker monitoring
- Detailed logging

## Architecture

```
Alpaca Websocket Stream
         ↓
  AlpacaTradeUpdate
         ↓
   hookIntoTradeUpdates()
         ↓
  handleOrderRejection()
         ↓
    ┌────────────────┐
    │ Pattern Match  │
    └────────────────┘
         ↓
    ┌────────────────┐
    │  Apply Fix     │
    └────────────────┘
         ↓
    ┌────────────────┐
    │ Exponential    │
    │   Backoff      │
    └────────────────┘
         ↓
    ┌────────────────┐
    │ Retry Submit   │
    └────────────────┘
         ↓
  New Order Created
```

## Rejection Categories

### 1. Market Hours (`market_hours`)
- Market orders during extended hours
- Day orders when market closed
- **Fix**: Convert to limit/GTC orders

### 2. Price Validation (`price_validation`)
- Limit price too aggressive
- Notional value too low
- **Fix**: Adjust pricing, increase quantity

### 3. Insufficient Funds (`insufficient_funds`)
- Not enough buying power
- **Fix**: Reduce quantity to fit available funds

### 4. Order Type (`order_type`)
- Fractional shares not supported
- Invalid time-in-force
- Market orders not allowed
- Bracket orders not supported
- **Fix**: Convert order type, round shares

### 5. Position Limits (`position_limits`)
- Maximum positions exceeded
- Short selling restricted
- **Fix**: Cannot auto-fix (manual intervention)

### 6. Regulatory (`regulatory`)
- Pattern day trader restrictions
- Account suspended
- Wash trade prevention
- **Fix**: Limited (delay for wash trades)

### 7. Symbol Invalid (`symbol_invalid`)
- Symbol not found
- **Fix**: Cannot auto-fix

## Built-in Handlers

### Market Hours Handlers

#### Extended Hours Market Order
```typescript
Pattern: /market.*(?:closed|extended|hours)/i
Fix: Convert to limit order with extended_hours=true
Confidence: High
```

#### Day Order After Close
```typescript
Pattern: /day.*(?:trading|closed)/i
Fix: Convert to GTC limit order
Confidence: High
```

### Price Validation Handlers

#### Aggressive Pricing
```typescript
Pattern: /price.*(?:aggressive|outside|collar|range)/i
Fix: Adjust limit price to 0.5% from market
Confidence: High
```

#### Minimum Notional
```typescript
Pattern: /notional.*(?:below|minimum|threshold)/i
Fix: Increase quantity to meet $5 minimum
Confidence: Medium
```

### Insufficient Funds Handlers

#### Buying Power
```typescript
Pattern: /insufficient.*(?:buying|funds|balance|capital)/i
Fix: Reduce quantity to 95% of buying power
Confidence: High
```

### Order Type Handlers

#### Fractional Shares
```typescript
Pattern: /fractional.*(?:not.*supported|shares)/i
Fix: Round down to whole shares
Confidence: High
```

#### Invalid Time-in-Force
```typescript
Pattern: /(?:gtc|time.*force).*(?:not.*supported|invalid)/i
Fix: Change to 'day'
Confidence: High
```

#### Market Order Not Allowed
```typescript
Pattern: /market.*order.*(?:not.*allowed|invalid)/i
Fix: Convert to limit order with 1% buffer
Confidence: High
```

#### Bracket Order Not Supported
```typescript
Pattern: /bracket.*(?:not.*supported|invalid)/i
Fix: Convert to simple order
Confidence: Medium
```

### Regulatory Handlers

#### Wash Trade
```typescript
Pattern: /wash.*trade/i
Fix: Delay 30 seconds and retry
Confidence: Low
```

## Usage

### Basic Integration

The handler is automatically integrated into the Alpaca stream:

```typescript
import { alpacaStream } from "./alpaca-stream";

// Auto-hooks into rejected/canceled orders
await alpacaStream.connect();
```

### Manual Retry

```typescript
import { handleOrderRejection } from "./order-retry-handler";

const result = await handleOrderRejection(tradeUpdate, "optional custom reason");

if (result.success) {
  console.log(`New order created: ${result.newOrderId}`);
} else {
  console.error(`Retry failed: ${result.error}`);
}
```

### Custom Handler Registration

```typescript
import { registerRejectionHandler } from "./order-retry-handler";

registerRejectionHandler({
  pattern: /custom.*error/i,
  category: "unknown",
  description: "My custom error handler",
  fix: async (order, reason) => {
    // Return FixedOrderParams or null
    return {
      params: {
        symbol: order.order.symbol,
        side: order.order.side as "buy" | "sell",
        qty: order.order.qty,
        type: "limit",
        time_in_force: "day",
        limit_price: "100.00",
      },
      explanation: "Custom fix applied",
      confidence: "medium",
    };
  },
});
```

### Test Rejection Reason

```typescript
import { testRejectionReason } from "./order-retry-handler";

const result = testRejectionReason("market orders not allowed during extended hours");

console.log(result.matched); // true
console.log(result.category); // "market_hours"
console.log(result.handler?.description); // "Market order rejected during extended hours"
```

### Monitor Statistics

```typescript
import { getRetryStats } from "./order-retry-handler";

const stats = getRetryStats();

console.log(`Total retries: ${stats.totalRetries}`);
console.log(`Success rate: ${(stats.successfulRetries / stats.totalRetries * 100).toFixed(1)}%`);
console.log(`Circuit breaker open: ${stats.circuitBreakerState.isOpen}`);
```

### Circuit Breaker Control

```typescript
import { resetCircuitBreaker } from "./order-retry-handler";

// Manually reset if needed
resetCircuitBreaker();
```

## API Endpoints

### GET `/api/trading/retry-stats`
Get current retry statistics

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRetries": 15,
    "successfulRetries": 12,
    "failedRetries": 3,
    "activeRetries": 2,
    "circuitBreakerState": {
      "failures": 0,
      "lastFailureTime": null,
      "isOpen": false,
      "resetTime": null
    }
  }
}
```

### POST `/api/trading/retry-circuit-breaker/reset`
Reset the circuit breaker

**Response:**
```json
{
  "success": true,
  "message": "Circuit breaker reset successfully"
}
```

### POST `/api/trading/test-rejection-reason`
Test a rejection reason against handlers

**Request:**
```json
{
  "reason": "market orders not allowed during extended hours"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matched": true,
    "category": "market_hours",
    "handler": {
      "description": "Market order rejected during extended hours",
      "category": "market_hours",
      "pattern": "market.*(?:closed|extended|hours)"
    }
  }
}
```

### GET `/api/trading/retry-handlers`
Get all registered handlers

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 20,
    "handlers": [
      {
        "category": "market_hours",
        "description": "Market order rejected during extended hours",
        "pattern": "market.*(?:closed|extended|hours)"
      }
    ]
  }
}
```

### POST `/api/trading/manual-retry/:orderId`
Manually trigger a retry for a failed order

**Request:**
```json
{
  "reason": "manual retry requested"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "originalOrderId": "abc123",
    "newOrderId": "def456",
    "attempts": [
      {
        "attemptNumber": 1,
        "timestamp": "2025-12-22T10:30:00Z",
        "reason": "manual retry requested",
        "fix": "Converted to limit order",
        "success": true
      }
    ],
    "finalStatus": "retried_successfully"
  }
}
```

## Configuration

### Constants

```typescript
const MAX_RETRIES_PER_ORDER = 3;
const RETRY_BACKOFF_BASE_MS = 2000; // 2 seconds
const CIRCUIT_BREAKER_THRESHOLD = 10; // failures
const CIRCUIT_BREAKER_WINDOW_MS = 60000; // 1 minute
const CIRCUIT_BREAKER_RESET_MS = 300000; // 5 minutes
```

### Customization

To change retry behavior, modify the constants in `order-retry-handler.ts`:

```typescript
// More aggressive retries
const MAX_RETRIES_PER_ORDER = 5;
const RETRY_BACKOFF_BASE_MS = 1000;

// More lenient circuit breaker
const CIRCUIT_BREAKER_THRESHOLD = 20;
```

## Circuit Breaker

### Purpose
Prevents cascade failures when the broker is experiencing systemic issues.

### Behavior
- Tracks failures within a rolling 1-minute window
- Opens after 10 failures
- Blocks all retries when open
- Auto-resets after 5 minutes
- Can be manually reset via API

### States
- **CLOSED**: Normal operation, retries allowed
- **OPEN**: Too many failures, retries blocked
- **RESET**: Manual or automatic reset

## Retry Flow Example

### Scenario: Extended Hours Market Order

1. **Initial Order**
   ```json
   {
     "symbol": "AAPL",
     "side": "buy",
     "qty": "10",
     "type": "market",
     "extended_hours": true
   }
   ```

2. **Rejection**
   ```
   Status: rejected
   Reason: "market orders not allowed during extended hours"
   ```

3. **Pattern Match**
   ```
   Matched: /market.*(?:closed|extended|hours)/i
   Category: market_hours
   ```

4. **Fix Applied**
   ```json
   {
     "symbol": "AAPL",
     "side": "buy",
     "qty": "10",
     "type": "limit",
     "limit_price": "150.75",
     "time_in_force": "day",
     "extended_hours": true
   }
   ```

5. **Retry**
   ```
   Backoff: 2000ms
   Attempt: 1/3
   Result: Success ✓
   New Order ID: retry-abc123-1-1734864000000
   ```

## Logging

All retry operations are logged with context:

```typescript
log.warn("OrderRetry", `Order abc123 for AAPL rejected`, {
  reason: "market orders not allowed during extended hours",
  orderType: "market",
  timeInForce: "day",
});

log.info("OrderRetry", `Found handler: Market order rejected during extended hours (market_hours)`);

log.info("OrderRetry", `Waiting 2000ms before retry (attempt 1/3)`);

log.info("OrderRetry", `Retry successful! New order def456 created for AAPL`, {
  status: "accepted",
  fix: "Converted market order to limit order at $150.75 for extended hours trading",
});
```

## Error Handling

### Non-retryable Errors
- Invalid symbols
- Account restrictions
- Pattern day trader limits
- Maximum positions exceeded

These errors immediately return with `finalStatus: "no_fix_available"`.

### Transient Errors
- Network timeouts
- Rate limits
- Temporary broker issues

These errors trigger automatic retries with exponential backoff.

### Permanent Errors
- Invalid parameters
- Insufficient funds (after reduction)
- Regulatory violations

These errors exhaust retries and return `finalStatus: "max_retries_exceeded"`.

## Database Integration

Retry metadata is stored in the order record:

```typescript
{
  ...order,
  rawJson: {
    ...alpacaOrder,
    retryMetadata: {
      originalOrderId: "abc123",
      attemptNumber: 1,
      rejectionReason: "market orders not allowed during extended hours",
      fix: "Converted market order to limit order at $150.75"
    }
  }
}
```

## Performance Considerations

### Memory
- Retry history is stored in-memory
- Auto-cleanup after successful completion
- Manual cleanup available via `clearRetryHistory(orderId)`

### Network
- Exponential backoff prevents API hammering
- Circuit breaker protects against cascades
- Throttled price lookups via Alpaca connector

### Database
- Minimal writes (only on retry submission)
- Uses existing upsert logic
- No additional tables required

## Testing

```bash
# Run test suite
npm test server/trading/order-retry-handler.test.ts

# Test specific pattern
curl -X POST http://localhost:3000/api/trading/test-rejection-reason \
  -H "Content-Type: application/json" \
  -d '{"reason": "market orders not allowed during extended hours"}'

# Get statistics
curl http://localhost:3000/api/trading/retry-stats

# Manual retry
curl -X POST http://localhost:3000/api/trading/manual-retry/abc123 \
  -H "Content-Type: application/json" \
  -d '{"reason": "manual retry"}'
```

## Monitoring

### Key Metrics
- **Success Rate**: `successfulRetries / totalRetries`
- **Circuit Breaker Status**: `circuitBreakerState.isOpen`
- **Active Retries**: `activeRetries`
- **Failure Rate**: `failedRetries / totalRetries`

### Alerts
Consider setting up alerts for:
- Circuit breaker opens
- Success rate drops below 70%
- Sustained high failure rate

## Limitations

1. **Cannot fix all rejections**: Some errors require manual intervention
2. **No cross-order coordination**: Each order retried independently
3. **Price staleness**: Uses current market price, may drift during retry delay
4. **No smart routing**: Always submits to original broker (Alpaca)

## Future Enhancements

- [ ] Smart price adjustment based on order book
- [ ] Cross-order retry coordination
- [ ] Machine learning for rejection prediction
- [ ] Multiple broker fallback
- [ ] Retry analytics dashboard
- [ ] Webhook notifications
- [ ] Configurable retry strategies per symbol
- [ ] Integration with risk management system

## Support

For issues or questions:
1. Check logs for detailed error messages
2. Review retry statistics via API
3. Test rejection reasons against handlers
4. Consult this documentation

## License

Part of the trading platform codebase.
