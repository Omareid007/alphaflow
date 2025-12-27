# Alpaca Rate Limiting - Quick Reference

## Quick Start

The rate limiting is **automatically active** for all Alpaca API calls. No code changes needed!

## Rate Limits

```
180 requests/minute (API limit: 200/min - safety margin)
5 concurrent requests max
333ms minimum between requests
```

## Circuit Breaker

```
Opens after: 5 consecutive failures
Resets after: 60 seconds OR manual reset
Timeout per request: 30 seconds
```

## Check Status

```typescript
// Rate limit status
const status = await alpaca.getRateLimitStatus();
console.log(status);
// {
//   provider: 'alpaca',
//   running: 2,
//   queued: 0,
//   reservoir: 178,
//   failureCount: 0,
//   circuitBreakerOpen: false
// }

// Connection status
const conn = alpaca.getConnectionStatus();
console.log(conn);
// {
//   connected: true,
//   hasCredentials: true,
//   cacheSize: 5,
//   failureCount: 0,
//   circuitBreakerOpen: false
// }
```

## Manual Reset

```typescript
// Reset circuit breaker if stuck open
alpaca.resetCircuitBreaker();
```

## Common Errors

### Circuit Breaker Open
```
Error: Circuit breaker is open - too many consecutive failures
```
**Fix**: Wait 60s or call `alpaca.resetCircuitBreaker()`

### Rate Limit Exceeded
```
Error: Rate limit exceeded after 3 retries
```
**Fix**: Requests will auto-queue. Reduce request rate.

## Best Practices

1. **Use caching** - Don't call `clearCache()` unnecessarily
2. **Batch requests** - Use multi-symbol endpoints
3. **Monitor status** - Check `getRateLimitStatus()` periodically
4. **Handle errors** - Circuit breaker errors need different handling

## Retry Strategy

| Error | Retries | Backoff |
|-------|---------|---------|
| 429 Rate Limit | 3x | 2-16s |
| 5xx Server | 3x | 1-8s |
| Network | 3x | 1-8s |
| 4xx Client | 0x | None |

## Cache Duration

All read operations cached for **30 seconds**

## Files

- Implementation: `/server/connectors/alpaca.ts`
- Documentation: `/docs/ALPACA_RATE_LIMITING.md`
- Full Summary: `/ALPACA_RATE_LIMITING_IMPLEMENTATION.md`
- Test Script: `/test-alpaca-rate-limit.ts`

## Test

```bash
npx tsx test-alpaca-rate-limit.ts
```

## Configuration

Already configured in `/server/lib/rateLimiter.ts`:

```typescript
'alpaca': {
  maxPerMinute: 180,
  maxConcurrent: 5,
  minTime: 333
}
```

To adjust limits:

```typescript
import { addProviderLimits } from './server/lib/rateLimiter';

addProviderLimits('alpaca', {
  maxPerMinute: 300,  // Adjust as needed
  maxConcurrent: 10,
  minTime: 200
});
```

## Monitoring Example

```typescript
// Check health periodically
setInterval(async () => {
  const status = await alpaca.getRateLimitStatus();

  if (status.circuitBreakerOpen) {
    console.error('Circuit breaker is OPEN!');
  }

  if (status.queued > 20) {
    console.warn('Large queue:', status.queued);
  }

  console.log('Remaining:', status.reservoir);
}, 60000);
```

## Architecture

```
Request → Manual CB Check → Opossum CB → Bottleneck Rate Limiter → Retry Logic → API
```

## Benefits

- ✅ Prevents 429 rate limit errors
- ✅ Automatic failure handling
- ✅ Request queuing
- ✅ Smart retries
- ✅ Production-ready
- ✅ Zero code changes required

## Libraries Used

- **Bottleneck**: Rate limiting and request queuing
- **Opossum**: Circuit breaker pattern
- Both are production-tested and widely used
