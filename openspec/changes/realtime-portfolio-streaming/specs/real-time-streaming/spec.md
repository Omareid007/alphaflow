# Real-Time Streaming - Delta Specification

## MODIFIED Requirements

### Requirement: The system SHALL support WebSocket connections for real-time portfolio updates

The system SHALL extend the existing WebSocket infrastructure (server/lib/websocket-server.ts) to support authenticated portfolio streaming on a dedicated `/ws/portfolio` endpoint. WebSocket connections SHALL require valid session cookie authentication and support channel-based subscriptions (positions, orders, account, trades) for selective event delivery.

#### Scenario: User connects to portfolio WebSocket endpoint

- **GIVEN** a user is authenticated with a valid session
- **WHEN** the client opens a WebSocket connection to `/ws/portfolio`
- **THEN** the server SHALL validate the session cookie
- **AND** accept the connection if session is valid
- **AND** store the connection mapped to the user's ID
- **AND** reject the connection with 401 if session is invalid or expired

#### Scenario: Client subscribes to portfolio channels

- **GIVEN** a WebSocket connection is established
- **WHEN** the client sends `{type: 'subscribe', channels: ['positions', 'orders']}`
- **THEN** the server SHALL store the subscription preferences
- **AND** only send events matching subscribed channels
- **AND** confirm subscription with acknowledgment message

#### Scenario: Client unsubscribes from channels

- **GIVEN** a client is subscribed to 'positions' channel
- **WHEN** the client sends `{type: 'unsubscribe', channels: ['positions']}`
- **THEN** the server SHALL remove 'positions' from subscriptions
- **AND** stop sending position_update events to that client

## ADDED Requirements

### Requirement: The system SHALL deliver position updates via WebSocket within 500ms

The system SHALL push position updates to connected WebSocket clients whenever position quantity, price, or unrealized P&L changes, with delivery latency not exceeding 500 milliseconds from the triggering broker event. Updates SHALL be batched within 1-second windows to optimize bandwidth while maintaining near-real-time responsiveness.

#### Scenario: Position P&L changes due to price movement

- **GIVEN** a user has an open position in AAPL
- **WHEN** the Alpaca stream receives a price update for AAPL
- **THEN** the server SHALL calculate the new unrealized P&L
- **AND** emit a position_update event to the user's WebSocket connections
- **AND** deliver the event within 500ms of receiving the price update

#### Scenario: Position created from order fill

- **GIVEN** a buy order for 100 shares of TSLA is filled
- **WHEN** the position record is created in the database
- **THEN** the server SHALL emit a position_update event
- **AND** the client SHALL receive the new position within 500ms
- **AND** the UI SHALL display the new position immediately

#### Scenario: Multiple positions update simultaneously

- **GIVEN** a user has 10 open positions
- **WHEN** market prices update for all 10 symbols within 1 second
- **THEN** the server SHALL batch all position updates into a single message
- **AND** deliver the batch within 1 second
- **AND** reduce message count by ~90% compared to individual updates

### Requirement: The system SHALL deliver order status updates via WebSocket

The system SHALL push order status change notifications to connected WebSocket clients whenever an order transitions between states (new, accepted, partially_filled, filled, cancelled, rejected, expired). Each status change SHALL trigger an order_update event delivered within 500 milliseconds of the state transition.

#### Scenario: Order status changes from new to filled

- **GIVEN** a user submits a market order
- **WHEN** the order status changes to 'filled' on Alpaca
- **THEN** the server SHALL emit an order_update event with status: 'filled'
- **AND** the client SHALL receive the event within 500ms
- **AND** the UI SHALL update the order status immediately
- **AND** show a success notification

#### Scenario: Order rejected by broker

- **GIVEN** a user submits an order
- **WHEN** Alpaca rejects the order (insufficient buying power)
- **THEN** the server SHALL emit an order_update event with status: 'rejected'
- **AND** include the rejection reason in the event data
- **AND** the UI SHALL display an error message to the user

### Requirement: The system SHALL deliver account balance updates via WebSocket

The system SHALL push account balance updates to connected WebSocket clients whenever equity, buying power, cash, or day P&L changes due to trade execution or position value changes. Account updates SHALL include complete snapshot of all balance fields and be delivered within 1 second of the triggering event.

#### Scenario: Account equity changes after trade execution

- **GIVEN** a user executes a trade
- **WHEN** the trade completes and cash balance changes
- **THEN** the server SHALL fetch the updated account data
- **AND** emit an account_update event with new equity and buying power
- **AND** the client SHALL receive the event within 1 second
- **AND** update the account balance display

#### Scenario: Day P&L calculation updates

- **GIVEN** multiple positions have P&L changes throughout the day
- **WHEN** any position P&L changes
- **THEN** the server SHALL recalculate total day P&L
- **AND** include in the account_update event
- **AND** the client SHALL display the updated day P&L

### Requirement: The system SHALL automatically reconnect WebSocket on disconnection

The system SHALL implement automatic client-side reconnection when WebSocket connections are lost due to network failures, server restarts, or timeouts. Reconnection attempts SHALL use exponential backoff starting at 1 second and capping at 30 seconds, with a maximum of 10 retry attempts before falling back to REST API polling.

#### Scenario: Network interruption causes disconnect

- **GIVEN** a client is connected to the WebSocket
- **WHEN** a network interruption occurs
- **THEN** the client SHALL detect the disconnection within 5 seconds
- **AND** attempt to reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- **AND** retry up to 10 times
- **AND** display "Reconnecting..." status to the user

#### Scenario: Reconnection succeeds on first attempt

- **GIVEN** a client detected a disconnection
- **WHEN** the first reconnection attempt succeeds
- **THEN** the client SHALL request a full portfolio snapshot
- **AND** update all cached data
- **AND** display "Connected" status
- **AND** resume normal event streaming

#### Scenario: All reconnection attempts fail

- **GIVEN** a client has attempted reconnection 10 times
- **WHEN** all attempts fail
- **THEN** the client SHALL fall back to REST API polling every 5 seconds
- **AND** display "Offline - using backup connection" status
- **AND** continue attempting WebSocket reconnection every 30 seconds in background

### Requirement: The system SHALL isolate portfolio events by user

The system SHALL enforce strict event isolation such that each authenticated WebSocket client receives only portfolio events associated with their own user account. Event routing SHALL use the validated session userId to filter events before transmission, preventing any cross-user data leakage.

#### Scenario: User A receives only their own events

- **GIVEN** User A and User B are both connected to the WebSocket
- **WHEN** User A executes a trade
- **THEN** only User A's connections SHALL receive the position_update event
- **AND** User B SHALL NOT receive any events related to User A's portfolio

#### Scenario: User with multiple devices

- **GIVEN** a user has connections from desktop and mobile (2 connections)
- **WHEN** a position update event occurs
- **THEN** both connections SHALL receive the same event
- **AND** both UIs SHALL show synchronized portfolio data

### Requirement: The system SHALL rate-limit WebSocket connections

The system SHALL enforce connection limits to prevent resource exhaustion and ensure fair service availability. Each user SHALL be limited to a maximum of 5 concurrent WebSocket connections, and the server SHALL reject new connections exceeding this limit. The total server-wide limit SHALL be 100 concurrent connections with appropriate error codes returned when limits are reached.

#### Scenario: User attempts to open 6th connection

- **GIVEN** a user already has 5 active WebSocket connections
- **WHEN** the user attempts to open a 6th connection
- **THEN** the server SHALL reject the connection
- **AND** return error: "Maximum connections exceeded (5 per user)"
- **AND** close with code 1008 (Policy Violation)

#### Scenario: Total connections exceed server capacity

- **GIVEN** 100 users are currently connected (100 total connections)
- **WHEN** a new user attempts to connect
- **THEN** the server SHALL reject the connection
- **AND** return error: "Server capacity reached - please try again later"
- **AND** close with code 1013 (Try Again Later)

## MODIFIED Requirements

### Requirement: The system SHALL integrate with TanStack Query for state management

The system SHALL integrate WebSocket event updates with the existing TanStack Query cache infrastructure. WebSocket events SHALL trigger cache updates via queryClient.setQueryData() while preserving Query's built-in features including stale-time management, background refetching, and optimistic updates. REST API polling SHALL continue as a backup mechanism with extended intervals (5 minutes instead of 30 seconds).

#### Scenario: WebSocket event updates Query cache

- **GIVEN** a client has positions cached via TanStack Query
- **WHEN** a position_update event is received via WebSocket
- **THEN** the client SHALL call queryClient.setQueryData(['positions', userId])
- **AND** merge the WebSocket update with existing cache
- **AND** preserve Query metadata (staleTime, cacheTime)
- **AND** trigger React component re-renders automatically

#### Scenario: REST reconciliation detects missed event

- **GIVEN** a WebSocket message was lost due to network issues
- **WHEN** the periodic REST reconciliation runs (every 60 seconds)
- **THEN** the client SHALL fetch fresh data from REST API
- **AND** compare with WebSocket cache
- **AND** update the cache with REST data as source of truth
- **AND** log a warning about the discrepancy
