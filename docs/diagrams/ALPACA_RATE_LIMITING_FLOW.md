# Alpaca Rate Limiting Flow Diagram

## Complete Request Flow

```
┌───────────────────────────────────────────────────────────────────┐
│                        API Call Initiated                         │
│              (e.g., alpaca.getAccount())                          │
└───────────────────────────┬───────────────────────────────────────┘
                            │
                            ↓
                   ┌─────────────────┐
                   │  Cache Check    │
                   └────────┬────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ↓                           ↓
      ┌─────────────┐            ┌─────────────┐
      │ Cache HIT   │            │ Cache MISS  │
      │   < 5ms     │            │             │
      └──────┬──────┘            └──────┬──────┘
             │                          │
             │                          ↓
             │              ┌──────────────────────────┐
             │              │  Manual Circuit Breaker  │
             │              │  failureCount < 5?       │
             │              └───────────┬──────────────┘
             │                          │
             │              ┌───────────┴───────────┐
             │              │                       │
             │              ↓ PASS                  ↓ FAIL
             │    ┌─────────────────┐      ┌──────────────────┐
             │    │  Opossum        │      │ Throw Error:     │
             │    │  Circuit        │      │ Circuit breaker  │
             │    │  Breaker        │      │ is open          │
             │    └────────┬────────┘      └──────────────────┘
             │             │
             │   ┌─────────┴─────────┐
             │   │                   │
             │   ↓ CLOSED            ↓ OPEN/HALF-OPEN
             │ ┌──────────┐     ┌─────────────┐
             │ │ Allow    │     │ Fail Fast or│
             │ │ Request  │     │ Test Request│
             │ └────┬─────┘     └─────────────┘
             │      │
             │      ↓
             │ ┌──────────────────────────┐
             │ │  Bottleneck Rate Limiter │
             │ │  - Check quota available │
             │ │  - Queue if needed       │
             │ └───────────┬──────────────┘
             │             │
             │   ┌─────────┴─────────┐
             │   │                   │
             │   ↓ Quota Available   ↓ No Quota
             │ ┌──────────┐     ┌─────────────┐
             │ │ Execute  │     │ Queue until │
             │ │ Now      │     │ quota avail │
             │ └────┬─────┘     └──────┬──────┘
             │      │                  │
             │      │                  │
             │      └────────┬─────────┘
             │               │
             │               ↓
             │      ┌──────────────────┐
             │      │  HTTP Request    │
             │      │  Attempt 1       │
             │      └────────┬─────────┘
             │               │
             │     ┌─────────┴─────────┐
             │     │                   │
             │     ↓ Success           ↓ Failure
             │   ┌────┐           ┌──────────┐
             │   │200 │           │ 429/5xx/ │
             │   │OK  │           │ Network  │
             │   └──┬─┘           └─────┬────┘
             │      │                   │
             │      │                   ↓
             │      │            ┌─────────────┐
             │      │            │  Retry?     │
             │      │            │  i < 3?     │
             │      │            └──────┬──────┘
             │      │                   │
             │      │        ┌──────────┴──────────┐
             │      │        │                     │
             │      │        ↓ Yes                 ↓ No
             │      │  ┌────────────┐      ┌──────────────┐
             │      │  │ Wait with  │      │ Throw Error  │
             │      │  │ Backoff    │      │              │
             │      │  │ 2^i * 1000 │      └──────┬───────┘
             │      │  └──────┬─────┘             │
             │      │         │                   │
             │      │         └─ Retry ───────────┤
             │      │                             │
             │      │                             │
             │      └────────┬────────────────────┘
             │               │
             │               ↓
             │      ┌──────────────────┐
             │      │  recordSuccess() │
             │      │  or              │
             │      │  recordFailure() │
             │      └────────┬─────────┘
             │               │
             │               ↓
             │      ┌──────────────────┐
             │      │  Update Cache    │
             │      │  (on success)    │
             │      └────────┬─────────┘
             │               │
             └───────────────┘
                             │
                             ↓
                   ┌───────────────────┐
                   │  Return Result    │
                   │  to Caller        │
                   └───────────────────┘
```

## Component Details

### 1. Cache Layer
- **Duration**: 30 seconds
- **Hit Rate**: Typically 30-50% for read-heavy workloads
- **Latency**: < 5ms

### 2. Manual Circuit Breaker
```
State: CLOSED
Condition: failureCount < 5

State: OPEN
Condition: failureCount >= 5
Action: Reject all requests
Recovery: Wait 5 minutes OR manual reset
```

### 3. Opossum Circuit Breaker
```
State: CLOSED
Condition: Error rate < 50%
Action: Allow all requests

State: OPEN
Condition: Error rate >= 50%
Action: Fail fast
Recovery: After 60 seconds → HALF-OPEN

State: HALF-OPEN
Action: Test with 1 request
Success → CLOSED
Failure → OPEN
```

### 4. Bottleneck Rate Limiter
```
Configuration:
- maxConcurrent: 5 requests
- reservoir: 180 per minute
- minTime: 333ms between requests

Behavior:
- Queue requests when limit reached
- Release based on time windows
- Fair queuing (FIFO)
```

### 5. Retry Logic
```
Attempt 1: Immediate
  ↓ Fail
Attempt 2: Wait 1-2 seconds
  ↓ Fail
Attempt 3: Wait 2-4 seconds
  ↓ Fail
Error thrown

Special case 429:
- Wait based on Retry-After header
- Or exponential: 2, 4, 8, 16 seconds max
```

## Error Flow

```
┌──────────────────┐
│  Error Occurs    │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ↓         ↓
┌────────┐  ┌────────┐
│ 4xx    │  │ 5xx/   │
│ Client │  │ Network│
└───┬────┘  └───┬────┘
    │           │
    ↓           ↓
┌────────┐  ┌────────┐
│ No     │  │ Retry  │
│ Retry  │  │ 3x     │
└───┬────┘  └───┬────┘
    │           │
    └─────┬─────┘
          │
          ↓
    ┌──────────┐
    │ Record   │
    │ Failure  │
    └─────┬────┘
          │
          ↓
    ┌──────────┐
    │ Update   │
    │ Circuit  │
    │ Breaker  │
    └─────┬────┘
          │
          ↓
    ┌──────────┐
    │ Throw to │
    │ Caller   │
    └──────────┘
```

## State Transitions

### Circuit Breaker States

```
        ┌─────────┐
        │ CLOSED  │◄───────────────┐
        └────┬────┘                │
             │                     │
     Error Rate >= 50%       Success
             │                     │
             ↓                     │
        ┌─────────┐                │
        │  OPEN   │                │
        └────┬────┘                │
             │                     │
      After 60 seconds             │
             │                     │
             ↓                     │
        ┌──────────┐               │
        │ HALF-    │               │
        │ OPEN     │───────────────┘
        └──────────┘
             │
      Failure
             │
             ↓
        ┌─────────┐
        │  OPEN   │
        └─────────┘
```

## Performance Characteristics

### Latency Distribution

```
Cache Hit:              ████ < 5ms
No Queue:               ██████████ 100-500ms
Queued:                 ████████████████████ 500-2000ms
Rate Limited:           ████████████████████████████ 2000-16000ms
Circuit Open:           █ < 1ms (fail fast)
```

### Throughput

```
Max Theoretical:  200 req/min (API limit)
Configured Max:   180 req/min (safety margin)
With Cache:       360+ req/min (cache hits don't count)
With Retries:     ~150 req/min (accounting for failures)
```

## Timeline Example

Real-world scenario with 10 requests:

```
Time  | Event
------|----------------------------------------------------------
0ms   | Request 1 → Rate Limiter → Executing
333ms | Request 2 → Rate Limiter → Executing
400ms | Request 1 completes (100ms response time)
666ms | Request 3 → Rate Limiter → Executing
733ms | Request 2 completes
900ms | Request 4 → Rate Limiter → Queued (5 concurrent limit)
999ms | Request 3 completes
1000ms| Request 4 → Executing (released from queue)
1100ms| Request 5 → Executing (cache hit, instant)
1200ms| Request 6 → Rate Limiter → Queued
1333ms| Request 4 completes
1333ms| Request 6 → Executing (released from queue)
1500ms| Request 7 → Rate Limiter → Executing
1600ms| Request 6 completes
1800ms| Request 8 → Rate Limiter → Executing
1833ms| Request 7 completes
2000ms| Request 9 → Rate Limiter → Executing
2100ms| Request 8 completes
2200ms| Request 10 → Rate Limiter → Queued
2333ms| Request 9 completes
2333ms| Request 10 → Executing (released from queue)
2500ms| Request 10 completes
```

## Monitoring Points

```
┌─────────────────┐
│ Application     │
└────────┬────────┘
         │
         ↓ getRateLimitStatus()
┌─────────────────┐
│ Rate Limiter    │
│ - running       │
│ - queued        │
│ - reservoir     │
└────────┬────────┘
         │
         ↓ getBreakerStats()
┌─────────────────┐
│ Circuit Breaker │
│ - state         │
│ - failures      │
│ - successes     │
└────────┬────────┘
         │
         ↓ getConnectionStatus()
┌─────────────────┐
│ Alpaca Client   │
│ - failureCount  │
│ - cacheSize     │
│ - connected     │
└─────────────────┘
```

## Decision Tree

```
New API Request
    │
    ├─ Cache available? ──Yes──> Return cached
    │                             (< 5ms)
    ↓ No
    │
    ├─ Circuit breaker open? ──Yes──> Throw error
    │                                   (< 1ms)
    ↓ No
    │
    ├─ Quota available? ──No──> Queue request
    │                             (wait for quota)
    ↓ Yes
    │
    ├─ Concurrent < 5? ──No──> Queue request
    │                            (wait for slot)
    ↓ Yes
    │
    ├─ 333ms since last? ──No──> Wait
    │                              (throttle)
    ↓ Yes
    │
    Execute HTTP Request
    │
    ├─ Response 200 ──> Cache & Return
    │                    (100-500ms)
    ├─ Response 429 ──> Retry with backoff
    │                    (2-16 seconds)
    ├─ Response 5xx ──> Retry with backoff
    │                    (1-8 seconds)
    └─ Response 4xx ──> Throw error
                         (no retry)
```
