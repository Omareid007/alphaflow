## ADDED Requirements

### Requirement: User Ownership Validation for Trading Operations

All trading operations SHALL validate user ownership and context before execution.

#### Scenario: User-attributed order execution

- **WHEN** an authenticated user requests trade execution
- **AND** the system processes the order via `/api/alpaca-trading/execute`
- **THEN** the system SHALL validate that `userId` is present in request context
- **AND** ensure order creation includes proper `userId` foreign key
- **AND** validate user has permission to execute trades for their account
- **AND** reject orders without proper user attribution with HTTP 401 Unauthorized

#### Scenario: Order ownership verification

- **WHEN** a user attempts to view or modify an order
- **AND** the user accesses order endpoints (e.g., `/api/orders/:id`)
- **THEN** the system SHALL verify the order belongs to the authenticated user
- **AND** filter order queries by `userId` to enforce user isolation
- **AND** prevent users from accessing orders that don't belong to them
- **AND** return HTTP 403 Forbidden for unauthorized order access

#### Scenario: Multi-user trading isolation

- **WHEN** multiple users trading simultaneously
- **AND** each user executes trading operations
- **THEN** the system SHALL ensure complete isolation between user accounts
- **AND** prevent users from executing trades on behalf of other users
- **AND** ensure order history is user-scoped and private
- **AND** validate user permissions for all trading-related operations

### Requirement: User Context Integration in Trading Pipeline

Trading execution pipeline SHALL properly integrate user context throughout all operations.

#### Scenario: Trading engine user context propagation

- **WHEN** a trading operation is initiated by an authenticated user
- **AND** the operation flows through the trading execution pipeline
- **THEN** the `alpacaTradingEngine.executeAlpacaTrade` function SHALL require `userId` parameter
- **AND** all order creation operations SHALL include proper user attribution
- **AND** user context SHALL be maintained throughout the entire execution flow
- **AND** no trading operation SHALL bypass user context validation

#### Scenario: Order creation with user attribution

- **WHEN** an order is being created through the trading system
- **THEN** the order record SHALL include proper `userId` foreign key constraint
- **AND** the `createOrder` function SHALL enforce user context requirement
- **AND** order creation SHALL validate user account ownership
- **AND** prevent creation of orders without proper user attribution

### Requirement: User-Scoped Order Management

Order management operations SHALL be scoped to authenticated user context.

#### Scenario: User-scoped order queries

- **WHEN** a user requests their order list via `/api/orders`
- **THEN** the system SHALL filter orders by authenticated user's `userId`
- **AND** only return orders belonging to the requesting user
- **AND** not expose orders from other users in the system
- **AND** apply user scoping to all order-related database queries

#### Scenario: User-scoped order cancellation

- **WHEN** a user attempts to cancel an order
- **THEN** the system SHALL verify the order belongs to the authenticated user
- **AND** prevent users from canceling orders they don't own
- **AND** include proper user context in cancellation operations
- **AND** maintain audit trail of who cancelled which orders

#### Scenario: User-scoped fill history

- **WHEN** a user requests their fill history via `/api/orders/fills`
- **THEN** the system SHALL filter fills by user's orders only
- **AND** not expose fill data from other users
- **AND** ensure proper user attribution in all trade execution history
- **AND** maintain privacy between different user accounts

## MODIFIED Requirements

### Requirement: Market Order Submission

Users SHALL be able to submit market orders for immediate execution at current market price with proper user attribution.

#### Scenario: Successful market order submission

- **WHEN** an authenticated user submits a market order with valid symbol and quantity
- **THEN** the system SHALL validate symbol tradability via tradabilityService
- **AND** check buying power and position limits via pre-trade validation
- **AND** validate user context and ensure proper user attribution
- **AND** generate a client_order_id using strategy, symbol, side, and 5-minute time bucket
- **AND** submit the order to Alpaca broker with user context
- **AND** store order record in orders table with status "new" or "accepted" and proper userId
- **AND** return HTTP 200 with order ID and client_order_id
- **AND** emit real-time SSE event with order status update

#### Scenario: Market order during extended hours

- **WHEN** a user submits a market order during pre-market or after-hours
- **THEN** the system SHALL automatically convert it to a limit order with 1% buffer from current price
- **AND** set extended_hours flag to true
- **AND** ensure user context is maintained throughout the conversion
- **AND** retry the order with adjusted parameters and proper user attribution
- **AND** log the automatic conversion with explanation and user attribution

#### Scenario: Insufficient buying power

- **WHEN** a user submits a market order exceeding available buying power
- **THEN** the system SHALL reject the order with HTTP 403 Forbidden
- **AND** return error message "Insufficient buying power"
- **AND** suggest reducing quantity or closing existing positions
- **AND** log the rejection with proper user attribution

#### Scenario: Symbol not tradable

- **WHEN** a user submits an order for a non-tradable symbol
- **THEN** the system SHALL reject the order with HTTP 400 Bad Request
- **AND** return error message "Symbol not tradable: {reason}"
- **AND** not submit the order to broker
- **AND** log the rejection with user attribution