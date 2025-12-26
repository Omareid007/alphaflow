# Order Retry System - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Trading Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐         ┌──────────────────┐               │
│  │  Order Submit  │────────▶│ Alpaca API       │               │
│  │   (Original)   │         │  Broker          │               │
│  └────────────────┘         └──────────────────┘               │
│                                      │                          │
│                                      │ WebSocket                │
│                                      ▼                          │
│                          ┌──────────────────────┐              │
│                          │  Trade Update Event  │              │
│                          │  (rejected/canceled) │              │
│                          └──────────────────────┘              │
│                                      │                          │
│                                      ▼                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            ORDER RETRY HANDLER SYSTEM                     │ │
│  │                                                            │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  1. hookIntoTradeUpdates()                         │  │ │
│  │  │     - Detects rejected/canceled status             │  │ │
│  │  │     - Triggers handleOrderRejection()              │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                         │                                 │ │
│  │                         ▼                                 │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  2. Extract Rejection Reason                       │  │ │
│  │  │     - Parse order status                           │  │ │
│  │  │     - Infer from order metadata                    │  │ │
│  │  │     - Log reason                                   │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                         │                                 │ │
│  │                         ▼                                 │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  3. Pattern Matching                               │  │ │
│  │  │     - Test against 20+ regex patterns              │  │ │
│  │  │     - Categorize failure type                      │  │ │
│  │  │     - Select handler                               │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                         │                                 │ │
│  │                         ▼                                 │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  4. Safety Checks                                  │  │ │
│  │  │     ┌──────────────────────────────────────────┐   │  │ │
│  │  │     │  Retry Limit Check (max 3 attempts)     │   │  │ │
│  │  │     └──────────────────────────────────────────┘   │  │ │
│  │  │     ┌──────────────────────────────────────────┐   │  │ │
│  │  │     │  Circuit Breaker Check                   │   │  │ │
│  │  │     │  - 10 failures in 60s = OPEN             │   │  │ │
│  │  │     │  - Blocks all retries when open          │   │  │ │
│  │  │     │  - Auto-resets after 5 minutes           │   │  │ │
│  │  │     └──────────────────────────────────────────┘   │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                         │                                 │ │
│  │                         ▼                                 │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  5. Apply Fix                                      │  │ │
│  │  │     - Handler.fix() called                         │  │ │
│  │  │     - Returns FixedOrderParams or null            │  │ │
│  │  │     - Generates explanation                        │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                         │                                 │ │
│  │                         ▼                                 │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  6. Exponential Backoff                            │  │ │
│  │  │     - Attempt 1: Wait 2 seconds                    │  │ │
│  │  │     - Attempt 2: Wait 4 seconds                    │  │ │
│  │  │     - Attempt 3: Wait 8 seconds                    │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                         │                                 │ │
│  │                         ▼                                 │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  7. Submit Retry Order                             │  │ │
│  │  │     - New client_order_id (idempotency)           │  │ │
│  │  │     - Corrected parameters                         │  │ │
│  │  │     - Store in database                            │  │ │
│  │  │     - Track attempt                                │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                         │                                 │ │
│  │                         ▼                                 │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  8. Result Tracking                                │  │ │
│  │  │     - Success: Return new order ID                 │  │ │
│  │  │     - Failure: Retry or exhaust attempts          │  │ │
│  │  │     - Update statistics                            │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                      │                          │
│                                      ▼                          │
│                          ┌──────────────────────┐              │
│                          │   Order Accepted     │              │
│                          │   (Retry Success)    │              │
│                          └──────────────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     COMPONENT LAYERS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  API LAYER (order-retry-api.ts)                           │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  GET /retry-stats                                    │ │ │
│  │  │  POST /retry-circuit-breaker/reset                   │ │ │
│  │  │  POST /test-rejection-reason                         │ │ │
│  │  │  GET /retry-handlers                                 │ │ │
│  │  │  POST /manual-retry/:orderId                         │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                             │                                    │
│                             ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  CORE LOGIC (order-retry-handler.ts)                      │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Pattern Matching Engine                             │ │ │
│  │  │  - 20+ regex patterns                                │ │ │
│  │  │  - 7 categories                                      │ │ │
│  │  │  - Custom handler registry                           │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Fix Functions                                       │ │ │
│  │  │  - Market hours fixes                                │ │ │
│  │  │  - Price adjustments                                 │ │ │
│  │  │  - Quantity reductions                               │ │ │
│  │  │  - Order type conversions                            │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Safety Systems                                      │ │ │
│  │  │  - Retry limit enforcement                           │ │ │
│  │  │  - Circuit breaker                                   │ │ │
│  │  │  - Exponential backoff                               │ │ │
│  │  │  - Idempotency tracking                              │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Statistics & Monitoring                             │ │ │
│  │  │  - Retry tracking                                    │ │ │
│  │  │  - Success/failure rates                             │ │ │
│  │  │  - Circuit breaker state                             │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                             │                                    │
│                             ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  INTEGRATION LAYER (alpaca-stream.ts)                     │ │
│  │  - WebSocket handler hook                                 │ │
│  │  - Trade update processing                                │ │
│  │  - Status change detection                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                             │                                    │
│                             ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  DATA LAYER                                                │ │
│  │  - In-memory retry tracker (Map)                          │ │
│  │  - Circuit breaker state                                  │ │
│  │  - Database (existing orders table)                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Rejection Category Tree

```
Rejection Detected
        │
        ├─▶ MARKET_HOURS
        │   ├─▶ Extended hours market order → Convert to limit
        │   └─▶ Day order when closed → Convert to GTC limit
        │
        ├─▶ PRICE_VALIDATION
        │   ├─▶ Aggressive pricing → Adjust to 0.5% buffer
        │   └─▶ Below minimum notional → Increase quantity
        │
        ├─▶ INSUFFICIENT_FUNDS
        │   └─▶ Buying power exceeded → Reduce to 95% available
        │
        ├─▶ ORDER_TYPE
        │   ├─▶ Fractional shares → Round down to whole
        │   ├─▶ Invalid TIF → Convert to 'day'
        │   ├─▶ Market order not allowed → Convert to limit
        │   └─▶ Bracket not supported → Convert to simple
        │
        ├─▶ POSITION_LIMITS
        │   ├─▶ Max positions → Cannot auto-fix ✗
        │   └─▶ Short restricted → Cannot auto-fix ✗
        │
        ├─▶ REGULATORY
        │   ├─▶ Pattern day trader → Cannot bypass ✗
        │   ├─▶ Account blocked → Cannot bypass ✗
        │   └─▶ Wash trade → Delay 30s and retry ⚠️
        │
        └─▶ SYMBOL_INVALID
            └─▶ Invalid symbol → Cannot auto-fix ✗
```

## Circuit Breaker State Machine

```
                    ┌──────────────┐
                    │   CLOSED     │◀─────────┐
                    │  (Normal)    │          │
                    └──────────────┘          │
                           │                  │
                           │ Failure          │
                           │ Count++          │
                           ▼                  │
                    ┌──────────────┐          │
                    │   MONITOR    │          │
                    │ (<10 fails)  │          │
                    └──────────────┘          │
                           │                  │
                           │ 10th             │ 5 min elapsed
                           │ Failure          │ OR Manual reset
                           ▼                  │
                    ┌──────────────┐          │
                    │     OPEN     │──────────┘
                    │  (Blocking)  │
                    │  5 min timer │
                    └──────────────┘

States:
- CLOSED: Normal operation, all retries allowed
- MONITOR: Counting failures, approaching threshold
- OPEN: Circuit breaker tripped, blocking all retries
```

## Retry Flow Diagram

```
Order Rejected
      │
      ▼
┌─────────────┐
│ Retry Count │
│   Check     │
└─────────────┘
      │
      ├─▶ ≥3 attempts? ───▶ MAX_RETRIES_EXCEEDED ✗
      │
      ▼
┌─────────────┐
│  Circuit    │
│   Breaker   │
└─────────────┘
      │
      ├─▶ Is Open? ───────▶ PERMANENT_FAILURE ✗
      │
      ▼
┌─────────────┐
│   Pattern   │
│   Matching  │
└─────────────┘
      │
      ├─▶ No match? ──────▶ NO_FIX_AVAILABLE ✗
      │
      ▼
┌─────────────┐
│  Apply Fix  │
└─────────────┘
      │
      ├─▶ Fix failed? ────▶ PERMANENT_FAILURE ✗
      │
      ▼
┌─────────────┐
│  Backoff    │
│   Wait      │
└─────────────┘
      │
      ▼
┌─────────────┐
│   Submit    │
│   Retry     │
└─────────────┘
      │
      ├─▶ Success? ───────▶ RETRIED_SUCCESSFULLY ✓
      │
      ▼
   Recursive
    Retry
```

## Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Alpaca     │────▶│  WebSocket   │────▶│  Trade       │
│   Broker     │     │   Stream     │     │  Update      │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
                                        ┌──────────────────┐
                                        │ Order Rejected?  │
                                        └──────────────────┘
                                                  │
                                                  ▼
                                        ┌──────────────────┐
                                        │  Retry Handler   │
                                        │  • Extract       │
                                        │  • Match         │
                                        │  • Fix           │
                                        │  • Retry         │
                                        └──────────────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    ▼                             ▼                             ▼
            ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
            │   Database   │            │   In-Memory  │            │    Logs      │
            │  (Orders)    │            │   Tracker    │            │ (Monitoring) │
            │              │            │ • Attempts   │            │ • Stats      │
            │ rawJson:     │            │ • CB State   │            │ • Errors     │
            │  retry       │            └──────────────┘            └──────────────┘
            │  metadata    │
            └──────────────┘
```

## Handler Execution Flow

```
Rejection Reason: "market orders not allowed during extended hours"
                                    │
                                    ▼
                        ┌─────────────────────┐
                        │  Pattern Matching   │
                        │  /market.*extended/ │
                        └─────────────────────┘
                                    │
                                    ▼
                        ┌─────────────────────┐
                        │  Handler Found      │
                        │  Category:          │
                        │  market_hours       │
                        └─────────────────────┘
                                    │
                                    ▼
                        ┌─────────────────────┐
                        │  Get Current Price  │
                        │  (Alpaca API)       │
                        │  $150.00            │
                        └─────────────────────┘
                                    │
                                    ▼
                        ┌─────────────────────┐
                        │  Calculate Fix      │
                        │  • type: limit      │
                        │  • limit: $150.75   │
                        │  • extended: true   │
                        └─────────────────────┘
                                    │
                                    ▼
                        ┌─────────────────────┐
                        │  Wait Backoff       │
                        │  2000ms (attempt 1) │
                        └─────────────────────┘
                                    │
                                    ▼
                        ┌─────────────────────┐
                        │  Submit New Order   │
                        │  client_order_id:   │
                        │  retry-abc-1-...    │
                        └─────────────────────┘
                                    │
                                    ▼
                        ┌─────────────────────┐
                        │  Result: SUCCESS ✓  │
                        │  New Order ID:      │
                        │  def456             │
                        └─────────────────────┘
```

## Statistics Tracking

```
┌─────────────────────────────────────────┐
│        RETRY STATISTICS                 │
├─────────────────────────────────────────┤
│                                          │
│  Total Retries: 47                      │
│  └─▶ Successful: 39 (83%)              │
│  └─▶ Failed: 8 (17%)                   │
│                                          │
│  Active Retries: 3                      │
│  └─▶ In Progress                        │
│                                          │
│  Circuit Breaker: CLOSED ✓              │
│  └─▶ Failures: 2/10                     │
│  └─▶ Window: 60s                        │
│  └─▶ Reset in: N/A                      │
│                                          │
│  By Category:                            │
│  ├─▶ market_hours: 15 (94% success)    │
│  ├─▶ price_validation: 12 (83% success)│
│  ├─▶ insufficient_funds: 8 (75% success)│
│  ├─▶ order_type: 7 (100% success)      │
│  ├─▶ position_limits: 3 (0% success)   │
│  └─▶ regulatory: 2 (50% success)       │
│                                          │
└─────────────────────────────────────────┘
```

## Key Design Patterns

### 1. Strategy Pattern
- Different fix strategies for different error types
- Extensible via custom handler registration

### 2. Circuit Breaker Pattern
- Prevents cascade failures
- Auto-recovery with time-based reset
- Manual override capability

### 3. Retry with Exponential Backoff
- Prevents API hammering
- Gives broker time to recover
- Bounded retry attempts

### 4. Observer Pattern
- WebSocket integration hooks
- Event-driven architecture
- Decoupled components

### 5. Command Pattern
- Each fix is a command
- Encapsulates order transformation
- Reversible/testable logic
