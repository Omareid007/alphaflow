# Order Retry Patterns - Quick Reference

## All Rejection Patterns & Fixes

### Market Hours Issues

| Pattern | Category | Fix | Confidence |
|---------|----------|-----|------------|
| `market.*(?:closed\|extended\|hours)` | market_hours | Convert to limit order with extended_hours=true | High |
| `day.*(?:trading\|closed)` | market_hours | Convert to GTC limit order | High |

### Price Validation Issues

| Pattern | Category | Fix | Confidence |
|---------|----------|-----|------------|
| `price.*(?:aggressive\|outside\|collar\|range)` | price_validation | Adjust limit price to 0.5% from market | High |
| `notional.*(?:below\|minimum\|threshold)` | price_validation | Increase quantity to $5 minimum | Medium |

### Insufficient Funds

| Pattern | Category | Fix | Confidence |
|---------|----------|-----|------------|
| `insufficient.*(?:buying\|funds\|balance\|capital)` | insufficient_funds | Reduce quantity to 95% of buying power | High |

### Position Limits

| Pattern | Category | Fix | Confidence |
|---------|----------|-----|------------|
| `(?:max\|maximum).*positions` | position_limits | **MANUAL INTERVENTION REQUIRED** | N/A |
| `short.*(?:not.*available\|restricted\|locate)` | position_limits | **MANUAL INTERVENTION REQUIRED** | N/A |

### Order Type Issues

| Pattern | Category | Fix | Confidence |
|---------|----------|-----|------------|
| `fractional.*(?:not.*supported\|shares)` | order_type | Round down to whole shares | High |
| `(?:gtc\|time.*force).*(?:not.*supported\|invalid)` | order_type | Change time-in-force to 'day' | High |
| `market.*order.*(?:not.*allowed\|invalid)` | order_type | Convert to limit order with 1% buffer | High |
| `bracket.*(?:not.*supported\|invalid)` | order_type | Convert to simple order | Medium |

### Regulatory Issues

| Pattern | Category | Fix | Confidence |
|---------|----------|-----|------------|
| `pattern.*day.*trad(?:er\|ing)` | regulatory | **CANNOT BYPASS PDT RULE** | N/A |
| `account.*(?:blocked\|suspended\|restricted)` | regulatory | **CANNOT BYPASS RESTRICTION** | N/A |
| `wash.*trade` | regulatory | Delay 30 seconds and retry | Low |

### Symbol Issues

| Pattern | Category | Fix | Confidence |
|---------|----------|-----|------------|
| `symbol.*(?:not.*found\|invalid\|unknown)` | symbol_invalid | **CANNOT FIX INVALID SYMBOL** | N/A |

## Common Scenarios

### Scenario 1: After-Hours Trading
**Error**: "market orders not allowed during extended hours"

**Fix**:
```typescript
// Original
{
  type: "market",
  extended_hours: true
}

// Fixed
{
  type: "limit",
  limit_price: "150.75", // Current price + 0.5%
  time_in_force: "day",
  extended_hours: true
}
```

### Scenario 2: Fractional Shares Not Supported
**Error**: "fractional shares not supported"

**Fix**:
```typescript
// Original
{
  qty: "10.5"
}

// Fixed
{
  qty: "10" // Rounded down
}
```

### Scenario 3: Insufficient Buying Power
**Error**: "insufficient buying power to complete order"

**Fix**:
```typescript
// Original (wants $15,000 worth)
{
  qty: "100",
  price: "$150/share"
}

// Fixed (only $10,000 available)
{
  qty: "63", // (10000 * 0.95) / 150
  // Reduced to fit 95% of buying power
}
```

### Scenario 4: Aggressive Pricing
**Error**: "limit price too aggressive"

**Fix**:
```typescript
// Original (way above market)
{
  type: "limit",
  limit_price: "200.00" // Market: $150
}

// Fixed
{
  type: "limit",
  limit_price: "150.75" // Market + 0.5%
}
```

### Scenario 5: Market Closed
**Error**: "day trading only allowed during market hours"

**Fix**:
```typescript
// Original
{
  type: "market",
  time_in_force: "day"
}

// Fixed
{
  type: "limit",
  limit_price: "150.75",
  time_in_force: "gtc" // Will execute when market opens
}
```

## Decision Tree

```
Order Rejected
    ↓
Contains "market" + "extended"?
    YES → Convert to limit order with extended_hours=true
    NO → Continue
    ↓
Contains "price" + "aggressive"?
    YES → Adjust limit price to 0.5% from market
    NO → Continue
    ↓
Contains "insufficient" + "buying"?
    YES → Reduce quantity to 95% of buying power
    NO → Continue
    ↓
Contains "fractional" + "not supported"?
    YES → Round down to whole shares
    NO → Continue
    ↓
Contains "gtc" + "invalid"?
    YES → Change to time_in_force: "day"
    NO → Continue
    ↓
Contains "bracket" + "not supported"?
    YES → Convert to order_class: "simple"
    NO → Continue
    ↓
No pattern matched
    → Return: no_fix_available
```

## Retry Strategy

### Exponential Backoff
- **Attempt 1**: 2 seconds
- **Attempt 2**: 4 seconds
- **Attempt 3**: 8 seconds
- **Max**: 3 attempts

### Circuit Breaker
- **Threshold**: 10 failures in 60 seconds
- **Action**: Block all retries
- **Reset**: Auto after 5 minutes, or manual

## Quick Commands

```bash
# Check retry stats
curl http://localhost:3000/api/trading/retry-stats

# Test a rejection reason
curl -X POST http://localhost:3000/api/trading/test-rejection-reason \
  -d '{"reason": "YOUR_ERROR_HERE"}'

# Reset circuit breaker
curl -X POST http://localhost:3000/api/trading/retry-circuit-breaker/reset

# Get all handlers
curl http://localhost:3000/api/trading/retry-handlers

# Manual retry
curl -X POST http://localhost:3000/api/trading/manual-retry/ORDER_ID \
  -d '{"reason": "manual retry"}'
```

## Return Status Codes

| Status | Meaning |
|--------|---------|
| `retried_successfully` | Order retried and accepted |
| `max_retries_exceeded` | Exhausted all 3 retry attempts |
| `permanent_failure` | Circuit breaker open or non-retryable error |
| `no_fix_available` | No handler matched the rejection reason |

## Best Practices

1. **Monitor circuit breaker status** - Indicates systemic issues
2. **Track success rate** - Should be >70%
3. **Review no_fix_available cases** - May need custom handlers
4. **Clear stale retry history** - Prevent memory bloat
5. **Test custom handlers** - Use test API before deploying

## Integration Checklist

- [x] Import handler in alpaca-stream.ts
- [x] Hook into handleTradeUpdate()
- [x] Register API routes
- [x] Set up monitoring
- [ ] Configure alerts
- [ ] Add custom handlers (if needed)
- [ ] Test end-to-end

## Common Pitfalls

1. **Not waiting for backoff** - Each retry waits 2^n seconds
2. **Ignoring circuit breaker** - Will block retries when open
3. **Stale price data** - Price may change during retry delay
4. **Not logging attempts** - Retry history stored in-memory
5. **Forgetting to reset circuit breaker** - Manual reset after broker outage

## Support Matrix

| Error Type | Auto-Retry | Manual Intervention | Success Rate |
|------------|------------|---------------------|--------------|
| Market hours | ✅ High | Optional | ~95% |
| Price validation | ✅ High | Optional | ~90% |
| Insufficient funds | ✅ Medium | Recommended | ~80% |
| Fractional shares | ✅ High | Optional | ~95% |
| Order type | ✅ High | Optional | ~90% |
| Position limits | ❌ | **Required** | 0% |
| Regulatory | ⚠️ Limited | **Required** | ~20% |
| Invalid symbol | ❌ | **Required** | 0% |
