# Alpaca API Rate Limiting and Circuit Breaker

## Overview

The Alpaca connector implements comprehensive rate limiting and circuit breaker patterns to prevent API rate limit violations and handle failures gracefully.

## Architecture

### Components

1. **Rate Limiter (Bottleneck)**: Controls request throughput
2. **Circuit Breaker (Opossum)**: Prevents cascading failures
3. **Manual Circuit Breaker**: Additional failure tracking layer
4. **Request Cache**: Reduces unnecessary API calls

### Rate Limiting Configuration

Located in `/server/lib/rateLimiter.ts`:

```typescript
'alpaca': {
  maxPerMinute: 180,    // 180 requests per minute
  maxConcurrent: 5,     // Max 5 concurrent requests
  minTime: 333          // Minimum 333ms between requests
}
```

#### Alpaca API Limits (as of 2024)

- **Trading API**: 200 requests per minute
- **Market Data API**: 200 requests per minute (varies by plan)
- **Paper Trading**: Same as live trading limits

Our configuration (180/min) provides a safety margin below the hard limit.

### Circuit Breaker Configuration

```typescript
{
  timeout: 30000,                  // 30 second timeout per request
  errorThresholdPercentage: 50,    // Open at 50% error rate
  resetTimeout: 60000,             // Try again after 1 minute
  volumeThreshold: 5               // Need 5 requests before calculating error rate
}
```

### Manual Circuit Breaker

Additional layer that tracks consecutive failures:

- Opens after 5 consecutive failures
- Resets after 5 minutes of no failures
- Can be manually reset via `resetCircuitBreaker()`

## Request Flow

```
API Call Request
    ↓
Check Manual Circuit Breaker (failureCount < 5?)
    ↓ (pass)
Circuit Breaker (Opossum) Check
    ↓ (open/half-open/closed)
Rate Limiter (Bottleneck) Queue
    ↓ (when quota available)
HTTP Request with Retry Logic
    ↓
Response Handling
    ↓
Success: recordSuccess() | Failure: recordFailure()
```

## Retry Strategy

### Automatic Retries

The connector implements smart retry logic:

1. **429 Rate Limit Errors**:
   - Respects `Retry-After` header if present
   - Otherwise uses exponential backoff: 2^(i+1) * 1000ms
   - Max wait time: 16 seconds
   - Retries: 3 attempts

2. **5xx Server Errors**:
   - Exponential backoff: 2^i * 1000ms
   - Max wait time: 8 seconds
   - Retries: 3 attempts

3. **Network Errors**:
   - Exponential backoff: 2^i * 1000ms
   - Max wait time: 8 seconds
   - Retries: 3 attempts

4. **4xx Client Errors** (except 429):
   - No retry (fail immediately)
   - These indicate invalid requests

### Example Retry Timeline

```
Attempt 1: Immediate
Attempt 2: Wait 1-2 seconds
Attempt 3: Wait 2-4 seconds
Then fail if still unsuccessful
```

## Caching Strategy

Reduces API load by caching responses:

- **Cache Duration**: 30 seconds
- **Cached Endpoints**:
  - `getAccount()` - Account information
  - `getPositions()` - Current positions
  - `getOrders()` - Order history
  - `getAssets()` - Available assets
  - `getBars()` - Historical price data
  - `getSnapshots()` - Market snapshots
  - `getClock()` - Market hours
  - Top assets/ETFs/crypto lists

Cache is automatically invalidated after 30 seconds.

## Monitoring and Status

### Get Rate Limit Status

```typescript
const status = await alpaca.getRateLimitStatus();
// Returns:
// {
//   provider: 'alpaca',
//   running: 2,              // Currently executing requests
//   queued: 5,               // Requests waiting in queue
//   reservoir: 175,          // Remaining requests in current minute
//   failureCount: 0,         // Consecutive failures
//   circuitBreakerOpen: false // Is circuit breaker open?
// }
```

### Get Connection Status

```typescript
const status = alpaca.getConnectionStatus();
// Returns:
// {
//   connected: true,
//   hasCredentials: true,
//   cacheSize: 15,
//   failureCount: 0,
//   circuitBreakerOpen: false
// }
```

## Error Handling

### Circuit Breaker Open

When the circuit breaker opens (after too many failures):

```typescript
Error: Circuit breaker is open - too many consecutive failures
```

**Recovery**:
1. Wait 1 minute (automatic reset timeout)
2. Or manually reset: `alpaca.resetCircuitBreaker()`

### Rate Limit Exceeded

```typescript
Error: Rate limit exceeded after 3 retries
```

**Recovery**:
- Wait for rate limit window to reset (1 minute)
- Requests will automatically queue and execute when quota available

### API Errors

```typescript
Error: Alpaca API error: 400 - Invalid symbol
```

**Action**: Fix the request parameters (no automatic retry for 4xx errors)

## Best Practices

### 1. Use Caching

Don't clear cache unnecessarily. Let it expire naturally:

```typescript
// Good: Use cached data when available
const account = await alpaca.getAccount(); // May use cache

// Bad: Forcing fresh data too often
alpaca.clearCache();
const account = await alpaca.getAccount();
```

### 2. Batch Requests

Combine multiple symbols in single requests:

```typescript
// Good: Single request for multiple symbols
const snapshots = await alpaca.getSnapshots(['AAPL', 'GOOGL', 'MSFT']);

// Bad: Multiple requests
const aapl = await alpaca.getSnapshots(['AAPL']);
const googl = await alpaca.getSnapshots(['GOOGL']);
const msft = await alpaca.getSnapshots(['MSFT']);
```

### 3. Monitor Status

Check rate limit status periodically:

```typescript
const status = await alpaca.getRateLimitStatus();
if (status.queued > 10) {
  console.warn('Rate limit queue building up');
}
if (status.circuitBreakerOpen) {
  console.error('Circuit breaker is open!');
}
```

### 4. Handle Errors Gracefully

```typescript
try {
  const account = await alpaca.getAccount();
} catch (error) {
  if (error.message.includes('Circuit breaker is open')) {
    // Wait and retry later or use cached data
    await new Promise(resolve => setTimeout(resolve, 60000));
  } else if (error.message.includes('Rate limit exceeded')) {
    // Queue is full, wait and retry
    await new Promise(resolve => setTimeout(resolve, 10000));
  } else {
    // Handle other errors
    console.error('API error:', error);
  }
}
```

### 5. Use Connection Health Checks

Verify connectivity before critical operations:

```typescript
const health = await alpaca.healthCheck();
if (health.overall !== 'healthy') {
  console.warn('Alpaca API may be degraded:', health);
}
```

## Advanced Configuration

### Adjusting Rate Limits

To modify rate limits (e.g., for a paid plan with higher limits):

```typescript
import { addProviderLimits } from './server/lib/rateLimiter';

addProviderLimits('alpaca', {
  maxPerMinute: 300,  // Increased limit
  maxConcurrent: 10,
  minTime: 200
});
```

### Custom Circuit Breaker Settings

The circuit breaker settings are configured per-request in `fetchWithRetry()`. To modify:

```typescript
const breaker = getBreaker(
  'alpaca-api',
  async () => { /* ... */ },
  {
    timeout: 60000,              // Longer timeout
    errorThresholdPercentage: 30, // More sensitive
    resetTimeout: 120000,         // Longer recovery
    volumeThreshold: 10          // More data before opening
  }
);
```

## Troubleshooting

### Issue: Requests Taking Too Long

**Symptoms**: API calls hang or timeout

**Possible Causes**:
1. Rate limit queue is very long
2. Circuit breaker is open
3. Network issues

**Solutions**:
```typescript
// Check status
const status = await alpaca.getRateLimitStatus();
console.log('Queued requests:', status.queued);
console.log('Circuit breaker open:', status.circuitBreakerOpen);

// If circuit breaker is open, reset it
if (status.circuitBreakerOpen) {
  alpaca.resetCircuitBreaker();
}
```

### Issue: Too Many Rate Limit Errors

**Symptoms**: Frequent 429 errors even with rate limiting

**Possible Causes**:
1. Multiple instances of the application
2. Other processes using same API key
3. Burst traffic patterns

**Solutions**:
```typescript
// Reduce rate limits to be more conservative
addProviderLimits('alpaca', {
  maxPerMinute: 120,  // More conservative
  maxConcurrent: 3,
  minTime: 500
});
```

### Issue: Circuit Breaker Opens Frequently

**Symptoms**: Circuit breaker state often 'open'

**Possible Causes**:
1. API connectivity issues
2. Invalid credentials
3. Malformed requests

**Solutions**:
```typescript
// Check credentials
const status = alpaca.getConnectionStatus();
console.log('Has credentials:', status.hasCredentials);

// Run health check
const health = await alpaca.healthCheck();
console.log('Health:', health);

// Review recent errors in logs
// Look for patterns in error messages
```

## Testing

Run the test script to verify rate limiting:

```bash
npx tsx test-alpaca-rate-limit.ts
```

Expected output:
- Initial status shows no failures
- Requests complete with proper timing
- Cache reduces subsequent request time
- Rate limit status shows usage statistics

## Performance Metrics

Expected performance with rate limiting:

- **Single Request**: 100-500ms (network + API processing)
- **Cached Request**: <5ms
- **Queued Request**: Wait time + request time
- **Rate Limited Request**: 2-16 seconds (exponential backoff)

## Integration Examples

### Example 1: Safe Account Polling

```typescript
async function pollAccount() {
  setInterval(async () => {
    try {
      const account = await alpaca.getAccount();
      console.log('Portfolio value:', account.portfolio_value);
    } catch (error) {
      console.error('Failed to get account:', error.message);
    }
  }, 30000); // Poll every 30 seconds (matches cache duration)
}
```

### Example 2: Batch Market Data Retrieval

```typescript
async function getMarketData(symbols: string[]) {
  // Process in batches to avoid overwhelming the API
  const BATCH_SIZE = 50;
  const results = [];

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    try {
      const snapshots = await alpaca.getSnapshots(batch);
      results.push(snapshots);
    } catch (error) {
      console.error(`Batch ${i}-${i + BATCH_SIZE} failed:`, error.message);
    }
  }

  return results;
}
```

### Example 3: Resilient Order Placement

```typescript
async function placeOrderWithRetry(params: CreateOrderParams, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const order = await alpaca.createOrder(params);
      console.log('Order placed successfully:', order.id);
      return order;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        const status = await alpaca.getRateLimitStatus();
        if (status.circuitBreakerOpen) {
          console.log('Circuit breaker open, waiting 60s...');
          await new Promise(resolve => setTimeout(resolve, 60000));
        } else {
          console.log('Retrying in 5s...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } else {
        throw error;
      }
    }
  }
}
```

## References

- [Alpaca API Documentation](https://alpaca.markets/docs/api-references/)
- [Bottleneck Documentation](https://github.com/SGrondin/bottleneck)
- [Opossum Circuit Breaker](https://github.com/nodeshift/opossum)
- Rate Limiter Implementation: `/server/lib/rateLimiter.ts`
- Circuit Breaker Implementation: `/server/lib/circuitBreaker.ts`
