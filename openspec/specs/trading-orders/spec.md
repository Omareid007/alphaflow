# Trading & Orders Capability

## Purpose

Order execution and management system with comprehensive lifecycle tracking, validation, retry logic, and real-time updates. Supports multiple order types (market, limit, stop, stop-limit, trailing-stop), advanced orders (bracket, OCO), and integrates with Alpaca broker API. Includes pre-trade validation, position/sector limits, circuit breaker protection, automatic retry with deduplication, and SSE streaming for real-time order status updates.

## Requirements

### Requirement: Market Order Submission

Users SHALL be able to submit market orders for immediate execution at current market price.

#### Scenario: Successful market order submission

- **WHEN** an authenticated user submits a market order with valid symbol and quantity
- **THEN** the system SHALL validate symbol tradability via tradabilityService
- **AND** check buying power and position limits via pre-trade validation
- **AND** generate a client_order_id using strategy, symbol, side, and 5-minute time bucket
- **AND** submit the order to Alpaca broker
- **AND** store order record in orders table with status "new" or "accepted"
- **AND** return HTTP 200 with order ID and client_order_id
- **AND** emit real-time SSE event with order status update

#### Scenario: Market order during extended hours

- **WHEN** a user submits a market order during pre-market or after-hours
- **THEN** the system SHALL automatically convert it to a limit order with 1% buffer from current price
- **AND** set extended_hours flag to true
- **AND** retry the order with adjusted parameters
- **AND** log the automatic conversion with explanation

#### Scenario: Insufficient buying power

- **WHEN** a user submits a market order exceeding available buying power
- **THEN** the system SHALL reject the order with HTTP 403 Forbidden
- **AND** return error message "Insufficient buying power"
- **AND** suggest reducing quantity or closing existing positions

#### Scenario: Symbol not tradable

- **WHEN** a user submits an order for a non-tradable symbol
- **THEN** the system SHALL reject the order with HTTP 400 Bad Request
- **AND** return error message "Symbol not tradable: {reason}"
- **AND** not submit the order to broker

### Requirement: Limit Order Submission

Users SHALL be able to submit limit orders with specified execution price constraints.

#### Scenario: Successful limit order submission

- **WHEN** an authenticated user submits a limit order with valid symbol, quantity, and limit_price
- **THEN** the system SHALL validate that limit_price is within acceptable range (not more than 5% from current market price)
- **AND** submit the order to Alpaca with type "limit"
- **AND** store order with limit_price in database
- **AND** return HTTP 200 with order details

#### Scenario: Limit price too aggressive

- **WHEN** a limit order has price outside broker's allowed collar range
- **THEN** the order retry handler SHALL automatically adjust limit_price to within 0.5% of current market price
- **AND** retry the order with adjusted price
- **AND** log adjustment with confidence level "high"

#### Scenario: Limit order with GTC time-in-force

- **WHEN** a user submits a limit order with time_in_force "gtc" (good-til-canceled)
- **THEN** the system SHALL submit order that remains active until filled or manually canceled
- **AND** persist order in database with timeInForce "gtc"
- **AND** allow order to execute across multiple trading sessions

### Requirement: Stop and Stop-Limit Orders

Users SHALL be able to submit stop orders and stop-limit orders with stop price triggers.

#### Scenario: Stop-loss order submission

- **WHEN** a user submits a stop order with stop_price below current market price (for sell)
- **THEN** the system SHALL validate stop_price is reasonable (within 20% of current price)
- **AND** submit order to broker with type "stop"
- **AND** trigger market order when price reaches or falls below stop_price

#### Scenario: Stop-limit order submission

- **WHEN** a user submits a stop-limit order with both stop_price and limit_price
- **THEN** the system SHALL validate both prices are reasonable
- **AND** trigger limit order when price reaches stop_price
- **AND** execute only if price is at or better than limit_price

#### Scenario: Stop order conversion failure

- **WHEN** a stop order is rejected due to order type restrictions
- **THEN** the retry handler SHALL convert to a limit order
- **AND** use current market price with 1% buffer as limit_price
- **AND** log conversion with confidence "medium"

### Requirement: Trailing Stop Orders

Users SHALL be able to submit trailing stop orders that dynamically adjust stop price.

#### Scenario: Trailing stop by percentage

- **WHEN** a user submits a trailing stop order with trail_percent (e.g., 2%)
- **THEN** the system SHALL submit order to Alpaca with type "trailing_stop"
- **AND** stop price SHALL trail market price by specified percentage
- **AND** trigger market order when price falls by trail_percent from highest point

#### Scenario: Trailing stop for profit protection

- **WHEN** a long position moves up 10% and has trailing stop of 2%
- **THEN** the stop price SHALL automatically adjust to lock in 8% profit
- **AND** trigger if price falls 2% from the new high

### Requirement: Bracket Orders (Take-Profit + Stop-Loss)

Users SHALL be able to submit bracket orders with automatic take-profit and stop-loss legs.

#### Scenario: Successful bracket order

- **WHEN** a user submits a bracket order with take_profit and stop_loss prices
- **THEN** the system SHALL submit parent order with order_class "bracket"
- **AND** Alpaca SHALL automatically create take-profit limit order
- **AND** Alpaca SHALL automatically create stop-loss order
- **AND** cancel remaining leg when one leg executes (OCO - One-Cancels-Other)

#### Scenario: Bracket order during extended hours

- **WHEN** a bracket order is submitted during extended hours
- **THEN** the retry handler SHALL convert to simple order without bracket legs
- **AND** log explanation "bracket orders not supported during extended hours"
- **AND** retry as limit order with extended_hours flag

#### Scenario: Bracket order validation

- **WHEN** a bracket order is submitted with invalid take-profit or stop-loss prices
- **THEN** the system SHALL validate take-profit is above entry for buys (below for sells)
- **AND** validate stop-loss is below entry for buys (above for sells)
- **AND** reject with HTTP 400 if validation fails

### Requirement: Time-in-Force Rules

Orders SHALL support multiple time-in-force options controlling order lifetime.

#### Scenario: Day order execution

- **WHEN** a user submits an order with time_in_force "day"
- **THEN** the order SHALL remain active only until market close
- **AND** be automatically canceled if not filled by end of trading day

#### Scenario: Good-til-canceled order

- **WHEN** a user submits an order with time_in_force "gtc"
- **THEN** the order SHALL remain active until filled or manually canceled
- **AND** persist across trading sessions
- **AND** remain in orders table with status "new" or "accepted"

#### Scenario: Immediate-or-cancel order

- **WHEN** a user submits an order with time_in_force "ioc"
- **THEN** the system SHALL attempt immediate execution
- **AND** cancel any unfilled portion immediately
- **AND** allow partial fills

#### Scenario: Fill-or-kill order

- **WHEN** a user submits an order with time_in_force "fok"
- **THEN** the system SHALL require complete fill immediately
- **AND** cancel entire order if complete fill is not possible
- **AND** not allow partial fills

### Requirement: Order Validation (Pre-Trade Checks)

All orders SHALL undergo pre-trade validation before submission to broker.

#### Scenario: Position size limit validation

- **WHEN** an order would create a position exceeding 5% of portfolio value
- **THEN** the system SHALL reject with HTTP 403 Forbidden
- **AND** return error "Position size limit exceeded (max 5% per position)"
- **AND** not submit order to broker

#### Scenario: Sector exposure limit validation

- **WHEN** an order would increase sector exposure beyond 25% of portfolio
- **THEN** the system SHALL reject with HTTP 403 Forbidden
- **AND** return error "Sector exposure limit exceeded (max 25% per sector)"
- **AND** suggest diversification

#### Scenario: Market hours validation

- **WHEN** a market order is submitted while market is closed
- **THEN** the system SHALL convert to GTC limit order
- **AND** set limit_price with 1% buffer from last close
- **AND** retry with adjusted parameters

#### Scenario: Minimum notional validation

- **WHEN** an order value is below broker's minimum (typically $1)
- **THEN** the retry handler SHALL increase quantity to meet $5 minimum
- **AND** recalculate required shares based on current price
- **AND** retry with adjusted quantity

### Requirement: Order Lifecycle Management

Users SHALL be able to list, retrieve, and manage orders throughout their lifecycle.

#### Scenario: List recent orders

- **WHEN** an authenticated user requests GET /api/orders with limit parameter
- **THEN** the system SHALL return up to specified limit of orders (default 50)
- **AND** include order details from local database
- **AND** allow filtering by status (new, filled, canceled, rejected)
- **AND** return HTTP 200 with orders array and source metadata

#### Scenario: Get order by ID

- **WHEN** a user requests GET /api/orders/:id with valid order ID
- **THEN** the system SHALL look up order by broker_order_id or client_order_id
- **AND** include associated fills from fills table
- **AND** return HTTP 200 with order details and fills array
- **AND** return HTTP 404 if order not found

#### Scenario: List live orders from broker

- **WHEN** a user requests GET /api/orders/recent
- **THEN** the system SHALL fetch orders directly from Alpaca API (source of truth)
- **AND** enrich with mapped fields and isAI flag
- **AND** return live data with source metadata indicating "alpaca_api"
- **AND** fallback to HTTP 503 if broker unavailable

### Requirement: Order Status Tracking

Orders SHALL transition through well-defined status states from submission to completion.

#### Scenario: Order status progression (successful fill)

- **WHEN** an order is submitted successfully
- **THEN** initial status SHALL be "new" or "pending_new"
- **AND** transition to "accepted" when exchange accepts
- **AND** transition to "partially_filled" if partial execution occurs
- **AND** transition to "filled" when completely executed
- **AND** emit SSE events for each status change

#### Scenario: Order status progression (cancellation)

- **WHEN** a user cancels an order
- **THEN** status SHALL transition to "pending_cancel"
- **AND** transition to "canceled" when cancellation confirms
- **AND** set canceled_at timestamp
- **AND** emit SSE event with status "canceled"

#### Scenario: Order status progression (rejection)

- **WHEN** an order is rejected by broker or exchange
- **THEN** status SHALL be set to "rejected"
- **AND** set failed_at timestamp
- **AND** store rejection reason in rawJson field
- **AND** trigger automatic retry via order-retry-handler if fixable

### Requirement: Order Cancellation

Users SHALL be able to cancel pending orders before execution.

#### Scenario: Cancel single order

- **WHEN** a user requests cancellation of an order by ID
- **THEN** the system SHALL submit cancellation request to broker
- **AND** update order status to "pending_cancel"
- **AND** poll for confirmation with 60-second timeout
- **AND** update status to "canceled" when confirmed
- **AND** return HTTP 200 with success message

#### Scenario: Cancel already-filled order

- **WHEN** a user attempts to cancel an order already filled
- **THEN** the system SHALL return HTTP 400 Bad Request
- **AND** return error "Cannot cancel filled order"
- **AND** not submit cancellation to broker

#### Scenario: Cancel non-existent order

- **WHEN** a user attempts to cancel an order that doesn't exist
- **THEN** the system SHALL treat as success (idempotent)
- **AND** return HTTP 200
- **AND** log the not-found condition

### Requirement: Order Retry with Deduplication

Failed orders SHALL be automatically retried with intelligent fixes and deduplication.

#### Scenario: Automatic retry with parameter adjustment

- **WHEN** an order is rejected with reason "price too aggressive"
- **THEN** the order-retry-handler SHALL identify matching rejection pattern
- **AND** adjust limit_price to within 0.5% of current market price
- **AND** generate new client_order_id with retry suffix (e.g., "retry-{orderId}-1")
- **AND** apply exponential backoff (base 2000ms \* 2^attempt)
- **AND** retry order with fixed parameters
- **AND** store retry metadata in rawJson

#### Scenario: Deduplication via client_order_id

- **WHEN** an order is submitted with existing client_order_id
- **THEN** the system SHALL query ALL orders (not just open) for duplicate
- **AND** validate duplicate order status with Alpaca API
- **AND** return existing order if still active
- **AND** invalidate work item if duplicate order is canceled/rejected/expired
- **AND** allow retry with new client_order_id

#### Scenario: Circuit breaker activation

- **WHEN** 5 order failures occur within 5-minute window
- **THEN** the circuit breaker SHALL open
- **AND** reject all new order submissions with HTTP 503 Service Unavailable
- **AND** auto-reset after 60 seconds
- **AND** allow single test order in "half-open" state

#### Scenario: Max retries exceeded

- **WHEN** an order fails 3 times (MAX_RETRIES_PER_ORDER)
- **THEN** the system SHALL mark final status as "max_retries_exceeded"
- **AND** store all retry attempts in retry tracker
- **AND** not attempt further retries
- **AND** log permanent failure with all attempted fixes

### Requirement: Real-Time Order Updates via SSE

Users SHALL receive real-time order status updates through Server-Sent Events.

#### Scenario: Order status SSE stream

- **WHEN** an authenticated client connects to /api/stream
- **THEN** the system SHALL establish SSE connection
- **AND** emit "order_update" events when order status changes
- **AND** include orderId, symbol, status, filledQty, filledAvgPrice in payload
- **AND** maintain connection with heartbeat every 30 seconds

#### Scenario: Order fill notification

- **WHEN** an order transitions to "filled" status
- **THEN** an SSE event SHALL be emitted with event type "order_update"
- **AND** payload SHALL include final filledQty and filledAvgPrice
- **AND** UI SHALL update order status in real-time
- **AND** trigger position refresh to show new holdings

### Requirement: Trade Execution History

Users SHALL be able to retrieve historical trade executions and fills.

#### Scenario: Get fills for all orders

- **WHEN** a user requests GET /api/orders/fills
- **THEN** the system SHALL fetch fills from fills table
- **AND** sort by occurred_at descending
- **AND** limit to specified count (default 50)
- **AND** return HTTP 200 with fills array

#### Scenario: Get fills for specific order

- **WHEN** a user requests GET /api/orders/fills/order/:orderId
- **THEN** the system SHALL query fills by orderId or brokerOrderId
- **AND** return all fill events for that order
- **AND** include qty, price, occurredAt for each fill
- **AND** calculate average fill price from multiple partial fills

#### Scenario: Partial fill tracking

- **WHEN** an order is partially filled multiple times
- **THEN** each fill SHALL create separate record in fills table
- **AND** order.filledQty SHALL reflect cumulative filled quantity
- **AND** order.filledAvgPrice SHALL reflect weighted average price
- **AND** order status SHALL be "partially_filled" until complete

### Requirement: Failed Order Handling

Failed orders SHALL be logged, analyzed, and presented with actionable recovery suggestions.

#### Scenario: Order rejection analysis

- **WHEN** an order is rejected by broker
- **THEN** the system SHALL extract rejection reason from Alpaca response
- **AND** classify into category (market_hours, price_validation, insufficient_funds, etc.)
- **AND** identify matching rejection handler pattern
- **AND** store rejection metadata in order rawJson

#### Scenario: Fractional shares rejection

- **WHEN** an order is rejected with "fractional shares not supported"
- **THEN** the retry handler SHALL round down quantity to whole shares
- **AND** verify at least 1 whole share remains
- **AND** retry with adjusted whole-number quantity
- **AND** log explanation with confidence "high"

#### Scenario: Insufficient quantity available

- **WHEN** a sell order is rejected with "insufficient qty available"
- **THEN** the retry handler SHALL fetch actual position from Alpaca
- **AND** adjust quantity to available shares (qty_available field)
- **AND** round down to whole shares
- **AND** retry with actual available quantity

### Requirement: Order Reconciliation

System SHALL periodically reconcile local order records with broker state.

#### Scenario: Identify unreal orders

- **WHEN** admin requests GET /api/orders/unreal
- **THEN** the system SHALL compare local orders with Alpaca orders
- **AND** identify orders existing locally but not in broker
- **AND** return list of orphaned orders with details

#### Scenario: Cleanup unreal orders

- **WHEN** admin requests POST /api/orders/cleanup
- **THEN** the system SHALL identify unreal orders
- **AND** update their status to "canceled" locally
- **AND** log cleanup actions
- **AND** return count of identified and canceled orders

#### Scenario: Full order book reconciliation

- **WHEN** admin requests POST /api/orders/reconcile
- **THEN** the system SHALL fetch all orders from Alpaca
- **AND** compare with local trades table
- **AND** identify missing local records (not synced from broker)
- **AND** identify orphaned local records (deleted from broker)
- **AND** sync missing records to local database
- **AND** return reconciliation report with counts

### Requirement: Position Sizing Validation

Orders SHALL be validated against portfolio-wide position and sector limits.

#### Scenario: Position size calculation

- **WHEN** validating an order for position size
- **THEN** the system SHALL calculate order notional value (qty \* current_price)
- **AND** fetch current portfolio value from Alpaca account
- **AND** calculate position percentage (order_value / portfolio_value)
- **AND** reject if exceeds 5% threshold

#### Scenario: Existing position adjustment

- **WHEN** an order would add to existing position
- **THEN** the system SHALL calculate combined position value (existing + new)
- **AND** validate combined position against 5% limit
- **AND** allow sells that reduce position size regardless of limit

#### Scenario: Sector exposure aggregation

- **WHEN** validating sector exposure
- **THEN** the system SHALL classify symbol into sector via asset-classifier
- **AND** aggregate all positions in same sector
- **AND** calculate sector percentage of portfolio
- **AND** reject new orders if sector would exceed 25%

## Security

### Pre-Trade Authorization

Orders MUST pass authorization checks:

- **requireAuth middleware** - Valid session or admin token required
- **Strategy authorization** - Orders from strategies must set `authorizedByOrchestrator: true`
- **User-initiated orders** - Marked as authorized via admin routes

### Rate Limiting

Order submission endpoints MUST enforce rate limits:

- **Alpaca API limit** - 200 requests per minute (enforced by broker)
- **Local rate limiting** - Consider implementing 10 orders per minute per user
- **Circuit breaker** - 5 failures in 5 minutes triggers circuit breaker (60-second reset)

### Validation Rules

All orders MUST validate:

- **Symbol tradability** - Query tradabilityService before submission
- **Quantity/Notional** - Mutually exclusive, at least one required
- **Price constraints** - Limit/stop prices must be reasonable (within 5-20% of market)
- **Minimum order value** - At least $1 notional (recommend $5 minimum)
- **Position limits** - Max 5% per position, max 25% per sector
- **Buying power** - Sufficient funds for buy orders

### Credential Security

Order submission MUST NOT log:

- API keys or secret keys
- Session tokens
- Sensitive account identifiers
- Use Pino auto-redaction for `apiKey`, `secretKey`, `authorization` fields

### Idempotency

Client order IDs MUST be generated using:

- Strategy ID + Symbol + Side + 5-minute time bucket for submissions
- Order ID + 1-minute time bucket for cancellations
- Format: `{strategyId}-{symbol}-{side}-{timestamp_bucket}`
- Prevents duplicate submissions within time window

## API Endpoints

| Method | Path                                | Auth Required | Description                                    |
| ------ | ----------------------------------- | ------------- | ---------------------------------------------- |
| GET    | /api/orders                         | Yes           | List orders from local database with filters   |
| GET    | /api/orders/recent                  | Yes           | Get live orders from Alpaca (source of truth)  |
| GET    | /api/orders/:id                     | Yes           | Get single order by ID with fills              |
| POST   | /api/orders/sync                    | Yes           | Manually trigger order sync with broker        |
| GET    | /api/orders/fills                   | Yes           | Get recent fills from all orders               |
| GET    | /api/orders/fills/order/:orderId    | Yes           | Get fills for specific order                   |
| GET    | /api/orders/unreal                  | Yes           | Identify orders in DB but not in broker        |
| POST   | /api/orders/cleanup                 | Yes           | Clean up unreal orders                         |
| POST   | /api/orders/reconcile               | Yes           | Reconcile order book with broker               |
| GET    | /api/orders/execution-engine/status | Yes           | Get active order execution states              |
| POST   | /api/alpaca-trading/execute         | Yes           | Execute trade via Alpaca trading engine        |
| POST   | /api/alpaca-trading/close/:symbol   | Yes           | Close position for symbol                      |
| POST   | /api/alpaca-trading/analyze         | Yes           | Analyze symbol for trade signals               |
| POST   | /api/alpaca-trading/analyze-execute | Yes           | Analyze and execute if signals positive        |
| POST   | /api/alpaca-trading/stop-all        | Yes           | Stop all running strategies                    |
| GET    | /api/trades                         | Yes           | Get trade history with limit                   |
| GET    | /api/trades/enriched                | Yes           | Get trades with filters (P&L, dates, symbols)  |
| GET    | /api/trades/:id                     | Yes           | Get single trade by ID                         |
| POST   | /api/trades                         | Yes           | Create new trade record                        |
| POST   | /api/trades/backfill-prices         | Yes           | Backfill zero-price trades from Alpaca history |

## Database Schema

### orders table

- `id` (varchar, primary key) - UUID identifier
- `userId` (varchar, foreign key → users.id, cascade) - User who created order
- `broker` (text, not null) - Broker name (e.g., "alpaca")
- `brokerOrderId` (text, unique, not null) - Broker's unique order ID
- `clientOrderId` (text, unique, nullable) - Client-specified idempotency key
- `symbol` (text, not null) - Trading symbol
- `side` (text, not null) - "buy" or "sell"
- `type` (text, not null) - "market", "limit", "stop", "stop_limit", "trailing_stop"
- `timeInForce` (text, nullable) - "day", "gtc", "ioc", "fok", "opg", "cls"
- `qty` (numeric, nullable) - Order quantity (mutually exclusive with notional)
- `notional` (numeric, nullable) - Notional dollar amount (mutually exclusive with qty)
- `limitPrice` (numeric, nullable) - Limit price for limit/stop_limit orders
- `stopPrice` (numeric, nullable) - Stop price for stop/stop_limit orders
- `status` (text, not null) - Order status (see orderStatuses enum)
- `extendedHours` (boolean, default false) - Allow extended hours execution
- `orderClass` (text, nullable) - "simple", "bracket", "oco", "oto"
- `submittedAt` (timestamp, not null) - When order was submitted
- `updatedAt` (timestamp, not null) - Last status update
- `filledAt` (timestamp, nullable) - When order was completely filled
- `expiredAt` (timestamp, nullable) - When order expired
- `canceledAt` (timestamp, nullable) - When order was canceled
- `failedAt` (timestamp, nullable) - When order failed
- `filledQty` (numeric, nullable) - Quantity filled so far
- `filledAvgPrice` (numeric, nullable) - Average fill price
- `traceId` (text, nullable) - Distributed tracing ID
- `decisionId` (varchar, foreign key → aiDecisions.id, set null) - AI decision reference
- `tradeIntentId` (varchar, foreign key → trades.id, set null) - Trade intent reference
- `workItemId` (varchar, foreign key → workItems.id, set null) - Work queue reference
- `strategyId` (varchar, foreign key → strategies.id, set null) - Strategy reference
- `rawJson` (jsonb, nullable) - Raw broker API response
- `createdAt` (timestamp, not null) - Record creation timestamp

**Indexes**: userId, brokerOrderId, clientOrderId, symbol, status, traceId, decisionId, strategyId

### fills table

- `id` (varchar, primary key) - UUID identifier
- `broker` (text, not null) - Broker name
- `brokerOrderId` (text, not null) - Broker order ID that was filled
- `brokerFillId` (text, unique, nullable) - Broker's unique fill identifier
- `orderId` (varchar, foreign key → orders.id, cascade) - Reference to order
- `symbol` (text, not null) - Symbol that was filled
- `side` (text, not null) - "buy" or "sell"
- `qty` (numeric, not null) - Quantity filled in this event
- `price` (numeric, not null) - Execution price for this fill
- `occurredAt` (timestamp, not null) - When fill occurred
- `traceId` (text, nullable) - Distributed tracing ID
- `rawJson` (jsonb, nullable) - Raw broker API response
- `createdAt` (timestamp, not null) - Record creation timestamp

**Indexes**: brokerOrderId, orderId, symbol, traceId

### brokerAssets table

- `id` (varchar, primary key) - UUID identifier
- `alpacaId` (text, unique, not null) - Alpaca's asset ID
- `symbol` (text, unique, not null) - Trading symbol
- `name` (text, not null) - Full asset name
- `assetClass` (text, not null) - "us_equity" or "crypto"
- `exchange` (text, not null) - Exchange name
- `status` (text, not null) - Asset status
- `tradable` (boolean, default false) - Whether tradable
- `marginable` (boolean, default false) - Whether marginable
- `shortable` (boolean, default false) - Whether shortable
- `easyToBorrow` (boolean, default false) - Easy to borrow for shorting
- `fractionable` (boolean, default false) - Fractional shares allowed
- `minOrderSize` (numeric, nullable) - Minimum order size
- `minTradeIncrement` (numeric, nullable) - Minimum quantity increment
- `priceIncrement` (numeric, nullable) - Minimum price tick
- `lastSyncedAt` (timestamp, not null) - Last sync from broker
- `createdAt` (timestamp, not null) - Record creation timestamp
- `updatedAt` (timestamp, not null) - Record update timestamp

## Error Handling

All trading endpoints MUST use standardized error responses:

**400 Bad Request**: Invalid order parameters, validation errors
**401 Unauthorized**: Missing or invalid authentication
**403 Forbidden**: Insufficient buying power, position limits exceeded, circuit breaker active
**404 Not Found**: Order or symbol not found
**422 Unprocessable Entity**: Duplicate client_order_id, broker validation failure
**429 Too Many Requests**: Rate limit exceeded (Alpaca or local)
**500 Internal Server Error**: Unexpected server errors
**503 Service Unavailable**: Broker unavailable, circuit breaker open

Error response format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable description",
  "statusCode": 400,
  "details": {
    "field": "qty",
    "reason": "Quantity must be positive",
    "suggestion": "Provide qty > 0 or use notional"
  }
}
```

**Retry Handler Error Categories**:

- `market_hours` - Market closed, extended hours issues
- `order_type` - Unsupported order type or time-in-force
- `price_validation` - Price outside allowed range
- `insufficient_funds` - Insufficient buying power
- `position_limits` - Max positions or quantity exceeded
- `regulatory` - PDT rule, account restrictions, wash trades
- `symbol_invalid` - Symbol not found or not tradable
- `unknown` - Unclassified rejection reason

## Dependencies

- **@alpacahq/alpaca-trade-api** - Alpaca broker API client
- **drizzle-orm** - Database ORM for orders/fills tables
- **pino** - Structured JSON logging
- **zod** - Schema validation for order parameters
- **express-rate-limit** - Rate limiting middleware
- **work-queue** - Async order execution queue with idempotency
- **sse-emitter** - Real-time Server-Sent Events for order updates

## Files

**Routes**:

- `server/routes/orders.ts` - Order retrieval, sync, reconciliation, fills
- `server/routes/trades.ts` - Trade history and enriched queries
- `server/routes/alpaca-trading.ts` - Alpaca trading engine operations
- `server/routes/alpaca.ts` - Direct Alpaca API endpoints (account, positions, assets)

**Trading Core**:

- `server/trading/unified-order-executor.ts` - Unified order submission with queue/direct modes
- `server/trading/order-retry-handler.ts` - Automatic retry with 18+ rejection handlers
- `server/trading/alpaca-trading-engine.ts` - High-level trading operations
- `server/connectors/alpaca.ts` - Alpaca API wrapper with rate limiting

**Services**:

- `server/services/tradability-service.ts` - Symbol validation and asset universe sync
- `server/autonomous/order-queue.ts` - Idempotent order queueing with polling

**Schema**:

- `shared/schema/orders.ts` - Orders, fills, and broker assets tables
- `server/validation/api-schemas.ts` - Zod schemas for order validation

**SSE**:

- `server/lib/sse-emitter.ts` - Real-time order/position update events
