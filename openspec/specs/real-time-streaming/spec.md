# Real-Time Streaming Capability

## Purpose

Server-Sent Events (SSE) based real-time streaming infrastructure for pushing trading updates, order status changes, position updates, price quotes, AI decisions, and alerts to connected clients. Provides unidirectional server-to-client communication with automatic browser-level reconnection, event replay, and per-user event buffering.

## Requirements

### Requirement: SSE Connection Establishment

Users SHALL be able to establish persistent SSE connections with authentication and CORS support.

#### Scenario: Successful connection with valid session

- **WHEN** a user with valid session cookie connects to an SSE endpoint
- **THEN** the system SHALL configure SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`)
- **AND** send initial connection confirmation event
- **AND** assign a unique client ID (`{userId}-{stream}-{timestamp}`)
- **AND** return HTTP 200 with open connection

#### Scenario: Connection without authentication

- **WHEN** a user attempts to connect to a protected SSE endpoint without valid session
- **THEN** the system SHALL return HTTP 401 Unauthorized
- **AND** return error message "Unauthorized"
- **AND** not establish SSE connection

#### Scenario: CORS preflight request

- **WHEN** a browser sends OPTIONS request to SSE endpoint
- **THEN** the system SHALL return Access-Control-Allow-Origin header
- **AND** return Access-Control-Allow-Methods: "GET, OPTIONS"
- **AND** return Access-Control-Allow-Headers: "Content-Type, Authorization"
- **AND** return HTTP 200

#### Scenario: Connection with compression support

- **WHEN** a client includes "Accept-Encoding: gzip" header
- **THEN** the system SHALL apply gzip compression to event stream
- **AND** set Content-Encoding: gzip header
- **AND** reduce bandwidth usage by approximately 60-70%

### Requirement: Order Updates Stream

Users SHALL receive real-time order status updates through SSE.

#### Scenario: Initial snapshot on connection

- **WHEN** a user connects to `/api/stream/orders`
- **THEN** the system SHALL query recent orders for the user
- **AND** send `order:update` event with snapshot flag
- **AND** include all current orders in snapshot data
- **AND** include timestamp in ISO 8601 format

#### Scenario: Order creation event

- **WHEN** an order is created for a user
- **THEN** the system SHALL emit `order:update` event to user's clients
- **AND** include orderId, symbol, side, qty, status, timestamp
- **AND** assign unique event ID for deduplication
- **AND** set retry timeout to 5000ms

#### Scenario: Order fill event

- **WHEN** an order is filled or partially filled
- **THEN** the system SHALL emit `order:fill` event to user's clients
- **AND** include orderId, filledQty, filledAvgPrice, timestamp
- **AND** update order status to "filled" or "partially_filled"

#### Scenario: Order cancellation event

- **WHEN** an order is canceled
- **THEN** the system SHALL emit `order:update` event with status "canceled"
- **AND** include cancellation reason if available
- **AND** preserve order history in event buffer

### Requirement: Position Changes Stream

Users SHALL receive real-time portfolio position updates.

#### Scenario: Position opened

- **WHEN** a new position is opened for a user
- **THEN** the system SHALL emit `position:update` event
- **AND** include symbol, quantity, entryPrice, currentPrice
- **AND** calculate and include unrealized P&L
- **AND** update portfolio totalValue

#### Scenario: Position closed

- **WHEN** a position is fully closed
- **THEN** the system SHALL emit `position:update` event with quantity 0
- **AND** include realized P&L for the closure
- **AND** remove position from active positions list

#### Scenario: Position value update

- **WHEN** market price changes affect position value
- **THEN** the system SHALL emit `position:update` event
- **AND** include updated currentPrice
- **AND** recalculate unrealized P&L
- **AND** update portfolio totalValue

#### Scenario: Portfolio snapshot on connection

- **WHEN** a user connects to `/api/stream/positions`
- **THEN** the system SHALL query current positions
- **AND** calculate total portfolio value
- **AND** send initial `position:update` event with all positions
- **AND** include totalValue calculated from sum of position values

### Requirement: Price/Quote Updates Stream

Users SHALL receive real-time market price updates via broadcast stream.

#### Scenario: Price update broadcast

- **WHEN** a price update is received from market data provider
- **THEN** the system SHALL emit `price:update` event to all connected clients
- **AND** include symbol, price, bid, ask, timestamp
- **AND** broadcast to all clients subscribed to price stream
- **AND** not require authentication (public data)

#### Scenario: Symbol-filtered price stream

- **WHEN** a user connects with `?symbols=AAPL,GOOGL` query parameter
- **THEN** the system SHALL send initial price data for requested symbols
- **AND** filter subsequent `price:update` events to requested symbols
- **AND** send initializing flag on first message

#### Scenario: Price update throttling

- **WHEN** price updates exceed 1000 events per second
- **THEN** the system SHALL batch updates within 100ms window
- **AND** send most recent price for each symbol
- **AND** prevent client overwhelming

### Requirement: Alert Notifications Stream

Users SHALL receive real-time alert notifications.

#### Scenario: Alert triggered

- **WHEN** a trading alert is triggered for a user
- **THEN** the system SHALL emit `alert:new` event to user's clients
- **AND** include alertId, level ("info", "warning", "error"), message, timestamp
- **AND** deliver to all active sessions for the user

#### Scenario: Critical alert priority

- **WHEN** an alert with level "error" is triggered
- **THEN** the system SHALL send event immediately (no batching)
- **AND** mark event as high priority
- **AND** log alert delivery status

### Requirement: Strategy Execution Events Stream

Users SHALL receive real-time strategy execution updates.

#### Scenario: Strategy signal generated

- **WHEN** a strategy generates a trading signal
- **THEN** the system SHALL emit `strategy:update` event to strategy owner
- **AND** include strategyId, signal type, symbol, action, confidence, timestamp
- **AND** include signal details and reasoning

#### Scenario: Strategy status change

- **WHEN** a strategy status changes (started, stopped, error)
- **THEN** the system SHALL emit `strategy:update` event
- **AND** include strategyId, status, timestamp
- **AND** include error details if status is "error"

#### Scenario: Strategy-specific stream

- **WHEN** a user connects to `/api/stream/strategies/:strategyId`
- **THEN** the system SHALL verify strategy exists and user has access
- **AND** return HTTP 404 if strategy not found
- **AND** establish stream for strategy-specific events only

### Requirement: Event Replay with Event IDs

The system SHALL support event replay using Last-Event-ID for reconnection handling.

#### Scenario: Reconnection with Last-Event-ID

- **WHEN** a client reconnects with `?lastEventId=1234567890-abc` query parameter
- **THEN** the system SHALL retrieve buffered events after that ID
- **AND** send missed events in chronological order
- **AND** resume normal streaming after replay complete

#### Scenario: Event ID format

- **WHEN** the system generates an event
- **THEN** the system SHALL assign event ID in format `{timestamp}-{random}`
- **AND** include ID in `id:` field of SSE message
- **AND** ensure uniqueness across all events

#### Scenario: Event deduplication

- **WHEN** a client receives an event with duplicate event ID
- **THEN** the client SHALL ignore the duplicate event
- **AND** track received event IDs in memory
- **AND** log deduplication action for debugging

### Requirement: Per-User Event Buffering

The system SHALL maintain event buffers per user for reconnection support.

#### Scenario: Event buffering on send

- **WHEN** an event is sent to a user
- **THEN** the system SHALL store event in user's buffer
- **AND** maintain last 100 events per user
- **AND** evict oldest events when buffer exceeds limit

#### Scenario: Buffer replay on new connection

- **WHEN** a user establishes new SSE connection
- **THEN** the system SHALL check for buffered events
- **AND** send buffered events in chronological order
- **AND** resume normal streaming after buffer exhausted

#### Scenario: Buffer cleanup

- **WHEN** all clients for a user disconnect
- **THEN** the system SHALL clear user's event buffer after 5 minutes
- **AND** free memory allocated to buffer
- **AND** log buffer cleanup action

### Requirement: Keepalive Mechanism

The system SHALL send keepalive messages to prevent connection timeout.

#### Scenario: Periodic keepalive

- **WHEN** 30 seconds elapse since last event sent to client
- **THEN** the system SHALL send keepalive comment (`: keepalive\n\n`)
- **AND** reset connection timeout timer
- **AND** detect dead connections on write failure

#### Scenario: Stale connection cleanup

- **WHEN** a client has no activity for 5 minutes
- **THEN** the system SHALL close connection
- **AND** remove client from active clients map
- **AND** clean up associated resources

#### Scenario: Keepalive failure detection

- **WHEN** keepalive write to client fails
- **THEN** the system SHALL remove client from active clients
- **AND** clear keepalive interval
- **AND** log disconnect event with client ID

### Requirement: Correlation IDs for Tracing

The system SHALL support correlation IDs for distributed tracing of events.

#### Scenario: Request correlation ID propagation

- **WHEN** a request includes `X-Correlation-ID` header
- **THEN** the system SHALL extract correlation ID
- **AND** attach to SSE connection metadata
- **AND** include in all log messages for that connection

#### Scenario: Auto-generated correlation ID

- **WHEN** a request does not include correlation ID
- **THEN** the system SHALL generate unique correlation ID
- **AND** return in `X-Correlation-ID` response header
- **AND** use for tracing throughout request lifecycle

#### Scenario: Event correlation tracking

- **WHEN** an event is emitted via SSE
- **THEN** the system SHALL include correlation ID in log metadata
- **AND** enable tracing of event from source to delivery
- **AND** link to originating request when applicable

### Requirement: Multiple Concurrent Connections

Users SHALL be able to maintain multiple SSE connections simultaneously.

#### Scenario: Multi-tab support

- **WHEN** a user opens multiple browser tabs
- **THEN** the system SHALL support separate SSE connections per tab
- **AND** deliver events to all active connections
- **AND** track connections with unique client IDs

#### Scenario: Per-stream connection tracking

- **WHEN** a user connects to multiple stream endpoints
- **THEN** the system SHALL maintain separate client entries
- **AND** route events to appropriate stream type
- **AND** allow independent connection lifecycle

#### Scenario: Connection limit enforcement

- **WHEN** a user attempts more than 10 concurrent connections
- **THEN** the system SHALL close oldest connection
- **AND** log connection limit enforcement
- **AND** send connection limit warning to client

## Security

### Session Cookie Validation

SSE endpoints MUST validate session cookies before establishing connections:

- Extract session ID from `session` cookie
- Verify session exists and is not expired
- Attach userId to connection metadata
- Return HTTP 401 if session invalid

### CORS Configuration

SSE endpoints MUST configure CORS headers:

- `Access-Control-Allow-Origin: *` (or specific domain in production)
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- Handle OPTIONS preflight requests

### Event Data Sanitization

Events sent via SSE MUST sanitize sensitive data:

- Redact API keys, tokens, passwords
- Mask PII (email, phone) in logs
- Exclude internal system identifiers
- Validate data types before JSON serialization

### Rate Limiting

SSE endpoints SHOULD implement connection rate limiting:

- Max 10 connections per user simultaneously
- Max 5 connection attempts per minute per IP
- Throttle high-frequency event emission (100ms batching)

## API Endpoints

| Method | Path                               | Auth Required | Description                                    |
| ------ | ---------------------------------- | ------------- | ---------------------------------------------- |
| GET    | /api/stream/orders                 | Yes           | Stream order updates for authenticated user    |
| GET    | /api/stream/positions              | Yes           | Stream position updates for authenticated user |
| GET    | /api/stream/prices                 | No            | Stream price updates (broadcast)               |
| GET    | /api/stream/trading                | No\*          | Combined stream (orders + positions)           |
| GET    | /api/stream/ai-decisions           | Yes           | Stream AI decision events                      |
| GET    | /api/stream/strategies/:strategyId | Yes           | Stream strategy-specific events                |
| GET    | /api/stream/alerts                 | Yes           | Stream alert notifications                     |
| GET    | /api/stream/metrics                | No            | Get connection metrics (debugging)             |
| POST   | /api/stream/test                   | Admin         | Broadcast test event (admin only)              |

\*Trading stream requires userId query parameter for filtering

## Event Format

All SSE events MUST follow this format:

```
event: {eventType}\n
data: {jsonData}\n
id: {eventId}\n
retry: 5000\n\n
```

### Event Fields

- **event**: Event type (e.g., `order:update`, `position:update`, `price:update`)
- **data**: JSON-serialized event payload
- **id**: Unique event identifier in format `{timestamp}-{random}`
- **retry**: Client retry timeout in milliseconds (default: 5000)

### Event Types

| Event Type        | Description                    | User-Specific  |
| ----------------- | ------------------------------ | -------------- |
| `order:update`    | Order status change            | Yes            |
| `order:fill`      | Order fill execution           | Yes            |
| `position:update` | Position opened/closed/updated | Yes            |
| `trade:new`       | New trade execution            | Yes            |
| `price:update`    | Market price update            | No (broadcast) |
| `ai:decision`     | AI trading decision            | Yes            |
| `agent:status`    | System agent status            | No (broadcast) |
| `strategy:update` | Strategy execution event       | Yes            |
| `alert:new`       | Alert notification             | Yes            |

### Sample Events

**Order Update:**

```
event: order:update
data: {"orderId":"ord-123","symbol":"AAPL","status":"filled","qty":10,"filledQty":10,"filledAvgPrice":150.25,"timestamp":"2026-01-02T10:30:00Z"}
id: 1735819800000-abc123def
retry: 5000

```

**Position Update:**

```
event: position:update
data: {"positions":[{"symbol":"AAPL","quantity":"10","entryPrice":"150.00","currentPrice":"152.50","unrealizedPnL":25.00}],"totalValue":1525.00,"timestamp":"2026-01-02T10:30:00Z"}
id: 1735819800001-xyz789abc
retry: 5000

```

**Price Update:**

```
event: price:update
data: {"symbol":"AAPL","price":152.50,"bid":152.48,"ask":152.52,"timestamp":"2026-01-02T10:30:01Z"}
id: 1735819801000-def456ghi
retry: 5000

```

**Keepalive Comment:**

```
: keepalive

```

## Headers

### Request Headers

| Header           | Required | Description                                 |
| ---------------- | -------- | ------------------------------------------- |
| Cookie           | Yes\*    | Session cookie for authentication           |
| Accept-Encoding  | No       | Compression support (e.g., "gzip")          |
| X-Correlation-ID | No       | Request correlation ID for tracing          |
| Last-Event-ID    | No\*\*   | Browser-sent last event ID for reconnection |

\*Required for authenticated endpoints
\*\*Automatically sent by EventSource API on reconnect

### Response Headers

| Header                       | Value                       | Description                    |
| ---------------------------- | --------------------------- | ------------------------------ |
| Content-Type                 | text/event-stream           | SSE media type                 |
| Cache-Control                | no-cache                    | Disable caching                |
| Connection                   | keep-alive                  | Maintain persistent connection |
| X-Accel-Buffering            | no                          | Disable nginx buffering        |
| Access-Control-Allow-Origin  | \*                          | CORS support                   |
| Access-Control-Allow-Methods | GET, OPTIONS                | Allowed HTTP methods           |
| Access-Control-Allow-Headers | Content-Type, Authorization | Allowed request headers        |
| Content-Encoding             | gzip                        | Compression (if supported)     |
| X-Correlation-ID             | {correlationId}             | Request correlation ID         |

## Error Handling

All SSE endpoints MUST handle errors gracefully:

**401 Unauthorized**: Invalid or missing session

```json
{
  "error": "Unauthorized",
  "message": "No valid session found",
  "statusCode": 401
}
```

**404 Not Found**: Resource not found (e.g., strategy)

```json
{
  "error": "Not Found",
  "message": "Strategy not found",
  "statusCode": 404
}
```

**500 Internal Server Error**: Server-side failure

```json
{
  "error": "Internal Server Error",
  "message": "Failed to establish SSE connection",
  "statusCode": 500
}
```

### Client-Side Error Handling

Clients SHOULD implement error handling:

- **onerror**: Detect connection failures, log error, rely on auto-reconnect
- **onclose**: Clean up resources, clear intervals
- **Parse errors**: Wrap JSON.parse in try-catch, log malformed events
- **Timeout detection**: Track last message time, force reconnect after 90 seconds

### Server-Side Error Handling

Server MUST handle:

- **Write failures**: Remove dead clients, log disconnect
- **Buffer overflow**: Evict oldest events, maintain max 100 events per user
- **Memory leaks**: Clear intervals on disconnect, remove client references
- **Connection limits**: Enforce max 10 concurrent connections per user

## Database Schema

No persistent schema required. Events are buffered in-memory only.

### In-Memory Structures

**clients Map:**

- Key: clientId (string)
- Value: Express Response object

**userClients Map:**

- Key: userId (string)
- Value: Set<clientId>

**eventBuffer Map:**

- Key: userId (string)
- Value: Array<SSEEvent> (max 100 events)

## Performance Considerations

### Event Throttling

High-frequency events SHOULD be throttled:

- Batch events within 100ms window
- Send most recent state for each entity
- Max 10 events per second per client

### Memory Management

Server MUST manage memory:

- Buffer max 100 events per user
- Clean up disconnected clients immediately
- Clear user buffers after 5 minutes of inactivity
- Monitor total memory usage with metrics endpoint

### Compression

Enable gzip compression when supported:

- Reduces bandwidth by 60-70%
- Compression level: 6 (balance speed/size)
- Auto-detect via Accept-Encoding header

### Connection Pooling

Efficient client management:

- Use Map for O(1) client lookup
- Use Set for O(1) user-client association
- Cleanup interval: 30 seconds for stale connections
- Connection timeout: 5 minutes idle time

## Dependencies

- **express** - Web framework for SSE routes
- **pino** - Structured logging
- **eventsource** (client) - Node.js SSE client (testing)
- **compression** (optional) - Gzip middleware

## Files

**Routes**: `/home/runner/workspace/server/routes/stream-trading.ts`
**SSE Manager**: `/home/runner/workspace/server/lib/sse-emitter.ts`
**Middleware**: `/home/runner/workspace/server/middleware/auth.ts`
**Tests**: `/home/runner/workspace/tests/integration/sse-streaming.test.ts`
**Documentation**: `/home/runner/workspace/docs/SSE_IMPLEMENTATION_GUIDE.md`

## Testing

### Integration Tests

Required test scenarios:

1. Connection establishment with valid/invalid session
2. Initial snapshot delivery on connection
3. Real-time event delivery (order, position, price)
4. Event deduplication with event IDs
5. Reconnection with Last-Event-ID
6. Multiple concurrent connections per user
7. Keepalive message delivery
8. CORS preflight handling
9. Compression support
10. Stale connection cleanup

### Performance Tests

Required performance benchmarks:

- 1000 concurrent connections per server
- 100 events/second per client
- <100ms event delivery latency
- <10MB memory per 100 clients

## Monitoring

### Metrics Endpoint

`GET /api/stream/metrics` returns:

```json
{
  "timestamp": "2026-01-02T10:30:00Z",
  "totalClients": 150,
  "totalUsers": 75,
  "clientsPerUser": [
    { "userId": "user-1", "clientCount": 2 },
    { "userId": "user-2", "clientCount": 1 }
  ]
}
```

### Logs

Structured logs for:

- Client connected/disconnected (INFO)
- Event broadcast (DEBUG)
- Event delivery failures (ERROR)
- Buffer overflow (WARN)
- Connection limit enforcement (WARN)

All logs include correlation IDs for tracing.

## Client Implementation

### Browser (React Hook)

```typescript
import { useEffect, useState } from 'react';

export function useOrderStream(userId: string) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const source = new EventSource(`/api/stream/orders`);

    source.addEventListener('order:update', (event) => {
      const data = JSON.parse(event.data);
      if (data.snapshot) {
        setOrders(data.orders);
      } else {
        setOrders(prev => /* update logic */);
      }
    });

    source.onerror = () => {
      console.error('SSE error, will auto-reconnect');
    };

    return () => source.close();
  }, [userId]);

  return orders;
}
```

### Server Emission

```typescript
import { sseEmitter } from "../lib/sse-emitter";

// Emit to specific user
sseEmitter.sendToUser(userId, {
  type: "order:update",
  data: { orderId, status, symbol, qty },
});

// Broadcast to all clients
sseEmitter.broadcast({
  type: "price:update",
  data: { symbol: "AAPL", price: 150.25 },
});
```

## Compliance

### Browser Support

- Chrome 6+
- Firefox 6+
- Safari 5+
- Edge 79+
- Opera 11+
- No IE11 support (use polyfill)

### Standards Compliance

- **HTML5 Server-Sent Events**: Full compliance with W3C specification
- **CORS**: Proper preflight handling per RFC 7231
- **UTF-8 Encoding**: All event data must be UTF-8 encoded
- **HTTP/1.1 Chunked Transfer**: Compatible with standard HTTP proxies
