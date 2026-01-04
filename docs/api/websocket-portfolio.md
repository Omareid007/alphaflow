# WebSocket Portfolio Streaming API

**Version**: 1.0.0
**Endpoint**: `wss://your-domain.com/ws/portfolio`
**Protocol**: WebSocket (RFC 6455)
**Authentication**: Session cookie

---

## Overview

The Portfolio Streaming API provides real-time updates for portfolio positions, orders, account balances, and trade executions via WebSocket connection. This enables sub-500ms latency updates without polling.

**Key Features**:

- Session-based authentication (same as REST API)
- Channel-based subscriptions (positions, orders, account, trades)
- Server-side batching (95% bandwidth reduction)
- Automatic reconnection support
- Connection limits: 5/user, 100 total

---

## Connection

### WebSocket URL

```
wss://your-domain.com/ws/portfolio
```

**Protocol Upgrade**: HTTP → WebSocket
**Port**: Same as REST API (typically 5000 or 443)

### Authentication

**Method**: Session cookie (automatically included by browser)

**Example (Browser)**:

```javascript
const ws = new WebSocket("wss://your-domain.com/ws/portfolio");
// Browser automatically includes session cookie
```

**Example (Node.js with cookie)**:

```javascript
const WebSocket = require("ws");
const ws = new WebSocket("wss://your-domain.com/ws/portfolio", {
  headers: {
    Cookie: "session=your-session-id-here",
  },
});
```

**Authentication Failure**:

- Close Code: `1008` (Policy Violation)
- Reason: `"Authentication required"`

---

## Client → Server Messages

### Subscribe to Channels

Subscribe to one or more data channels to receive updates.

**Message**:

```json
{
  "type": "subscribe",
  "channels": ["positions", "orders", "account", "trades"]
}
```

**Parameters**:

- `type`: `"subscribe"` (required)
- `channels`: Array of channel names (required)
  - `"positions"` - Position quantity/price/P&L updates
  - `"orders"` - Order status changes
  - `"account"` - Account balance/equity updates
  - `"trades"` - Trade execution notifications

**Response**: Server confirms with info message

### Unsubscribe from Channels

Stop receiving updates from specified channels.

**Message**:

```json
{
  "type": "unsubscribe",
  "channels": ["orders"]
}
```

**Parameters**:

- `type`: `"unsubscribe"` (required)
- `channels`: Array of channel names (required)

### Ping (Heartbeat)

Send ping to verify connection is alive.

**Message**:

```json
{
  "type": "ping"
}
```

**Response**: Server responds with `pong` event

---

## Server → Client Messages

All server messages follow this structure:

```json
{
  "type": "event_type",
  "timestamp": "ISO 8601 timestamp",
  "userId": "user-id-for-isolation",
  "data": {
    /* event-specific payload */
  }
}
```

### position_update

Sent when position quantity, price, or P&L changes.

**Event**:

```json
{
  "type": "position_update",
  "timestamp": "2026-01-04T15:30:45.123Z",
  "userId": "user-abc-123",
  "data": {
    "symbol": "AAPL",
    "quantity": "100",
    "currentPrice": "175.50",
    "entryPrice": "170.25",
    "unrealizedPnl": "525.00",
    "unrealizedPnlPercent": "3.08",
    "marketValue": "17550.00",
    "side": "long",
    "strategyId": "strategy-xyz",
    "openedAt": "2026-01-03T09:30:00.000Z"
  }
}
```

**Trigger Conditions**:

- Alpaca price update received
- Order filled (quantity changes)
- Position sync operation

**Frequency**: Variable (1-100 updates/minute per position during market hours)

### order_update

Sent when order status changes.

**Event**:

```json
{
  "type": "order_update",
  "timestamp": "2026-01-04T15:30:45.123Z",
  "userId": "user-abc-123",
  "data": {
    "orderId": "order-123",
    "brokerOrderId": "alpaca-456",
    "symbol": "TSLA",
    "side": "buy",
    "type": "limit",
    "status": "filled",
    "qty": "50",
    "filledQty": "50",
    "filledAvgPrice": "245.75",
    "limitPrice": "246.00",
    "submittedAt": "2026-01-04T15:29:30.000Z",
    "filledAt": "2026-01-04T15:30:45.000Z"
  }
}
```

**Trigger Conditions**:

- Order submitted (status: new)
- Order accepted (status: accepted)
- Order filled (status: filled/partially_filled)
- Order cancelled/rejected/expired

**Status Values**: new, accepted, pending_new, partially_filled, filled, canceled, rejected, expired

### account_update

Sent when account balance or equity changes.

**Event**:

```json
{
  "type": "account_update",
  "timestamp": "2026-01-04T15:30:45.123Z",
  "userId": "user-abc-123",
  "data": {
    "equity": "104308.75",
    "buyingPower": "354905.24",
    "cash": "50000.00",
    "portfolioValue": "104308.75",
    "dayPnl": "1234.56",
    "dayPnlPercent": "1.20",
    "timestamp": "2026-01-04T15:30:45.000Z"
  }
}
```

**Trigger Conditions**:

- Trade execution (cash/equity changes)
- Position value changes (equity changes)

**Frequency**: 1-10 updates per minute during active trading

### trade_executed

Sent when a trade is completed.

**Event**:

```json
{
  "type": "trade_executed",
  "timestamp": "2026-01-04T15:30:45.123Z",
  "userId": "user-abc-123",
  "data": {
    "tradeId": "trade-789",
    "symbol": "NVDA",
    "side": "sell",
    "quantity": "25",
    "price": "520.50",
    "pnl": "1250.00",
    "executedAt": "2026-01-04T15:30:45.000Z",
    "strategyId": "strategy-xyz"
  }
}
```

**Trigger Conditions**:

- Order fills and trade record is created

**Frequency**: Each completed trade (1-50 per day typical)

### batch

Aggregates multiple events into a single message (sent every 1 second if events occurred).

**Event**:

```json
{
  "type": "batch",
  "timestamp": "2026-01-04T15:30:45.123Z",
  "userId": "user-abc-123",
  "data": {
    "positions": [
      { "symbol": "AAPL", "quantity": "100" /* ... */ },
      { "symbol": "TSLA", "quantity": "50" /* ... */ }
    ],
    "orders": [{ "orderId": "order-123", "status": "filled" /* ... */ }],
    "account": {
      "equity": "104308.75",
      "buyingPower": "354905.24"
      /* ... */
    },
    "trades": [{ "tradeId": "trade-789", "symbol": "NVDA" /* ... */ }]
  }
}
```

**Batching**: Events are aggregated in 1-second windows to reduce message frequency by ~95%.

### pong

Heartbeat response to client ping.

**Event**:

```json
{
  "type": "pong",
  "timestamp": "2026-01-04T15:30:45.123Z",
  "userId": "user-abc-123",
  "data": {}
}
```

### error

Server error or notification.

**Event**:

```json
{
  "type": "error",
  "timestamp": "2026-01-04T15:30:45.123Z",
  "userId": "user-abc-123",
  "data": {
    "code": "SUBSCRIPTION_FAILED",
    "message": "Invalid channel name",
    "details": { "channel": "invalid_channel" }
  }
}
```

---

## Connection Lifecycle

### 1. Establish Connection

```javascript
const ws = new WebSocket("wss://your-domain.com/ws/portfolio");

ws.onopen = () => {
  console.log("Connected");
  // Subscribe to channels
  ws.send(
    JSON.stringify({
      type: "subscribe",
      channels: ["positions", "orders"],
    })
  );
};
```

### 2. Receive Events

```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "position_update") {
    console.log("Position updated:", data.data.symbol);
    // Update UI
  }

  if (data.type === "batch") {
    console.log("Batch update:", data.data);
    // Process all updates
  }
};
```

### 3. Handle Disconnection

```javascript
ws.onclose = (event) => {
  console.log("Disconnected:", event.code, event.reason);

  // Reconnect with exponential backoff
  setTimeout(() => reconnect(), 1000 * Math.pow(2, attemptCount));
};
```

### 4. Heartbeat

```javascript
// Send ping every 15 seconds
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "ping" }));
  }
}, 15000);
```

---

## Rate Limits

| Limit                | Value | Consequence                          |
| -------------------- | ----- | ------------------------------------ |
| Connections per user | 5     | 6th connection rejected (code 1008)  |
| Total connections    | 100   | New connections rejected (code 1013) |
| Messages per second  | 100   | Connection throttled or closed       |

---

## Close Codes

| Code | Meaning                        | Reconnect?       |
| ---- | ------------------------------ | ---------------- |
| 1000 | Normal closure                 | No               |
| 1001 | Going away (server shutdown)   | Yes              |
| 1008 | Policy violation (auth failed) | No               |
| 1013 | Try again later (capacity)     | Yes (with delay) |
| 1011 | Internal server error          | Yes              |

---

## Best Practices

### 1. Always Handle Reconnection

```javascript
class PortfolioStream {
  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onclose = () => this.reconnect();
  }

  reconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.attempts), 30000);
    setTimeout(() => this.connect(), delay);
  }
}
```

### 2. Subscribe After Connection Opens

```javascript
ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: "subscribe",
      channels: ["positions", "account"],
    })
  );
};
```

### 3. Parse Messages Safely

```javascript
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    // Process data
  } catch (error) {
    console.error("Failed to parse message:", error);
  }
};
```

### 4. Cleanup on Unmount

```javascript
// React component
useEffect(() => {
  const ws = new WebSocket(url);

  return () => {
    ws.close(1000, "Component unmounted");
  };
}, []);
```

---

## Monitoring

### Admin Stats Endpoint

```
GET /api/admin/websocket-stats
```

**Response**:

```json
{
  "status": "healthy",
  "enabled": true,
  "activeConnections": 42,
  "totalMessagesDelivered": 15420,
  "performance": {
    "batchEfficiency": "95.2%",
    "disconnectRatePerMinute": "0.50"
  }
}
```

### Metrics

- `activeConnections`: Current WebSocket connections
- `totalMessagesDelivered`: Cumulative message count
- `batchEfficiency`: Event reduction percentage
- `disconnectRatePerMinute`: Disconnects per minute

---

## Examples

### React Hook (Browser)

```typescript
import { useEffect, useState } from "react";

function usePortfolioStream() {
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    const ws = new WebSocket("wss://your-domain.com/ws/portfolio");

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "subscribe",
          channels: ["positions"],
        })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "position_update") {
        setPositions((prev) => updatePosition(prev, data.data));
      }
    };

    return () => ws.close();
  }, []);

  return positions;
}
```

### Node.js Client

```javascript
const WebSocket = require("ws");

const ws = new WebSocket("wss://your-domain.com/ws/portfolio", {
  headers: {
    Cookie: `session=${sessionId}`,
  },
});

ws.on("open", () => {
  console.log("Connected");
  ws.send(
    JSON.stringify({
      type: "subscribe",
      channels: ["positions", "orders", "account"],
    })
  );
});

ws.on("message", (data) => {
  const event = JSON.parse(data);
  console.log("Event:", event.type, event.data);
});

ws.on("close", (code, reason) => {
  console.log("Closed:", code, reason);
});
```

---

## Troubleshooting

### Connection Rejected

**Problem**: WebSocket closes immediately with code 1008

**Causes**:

- No session cookie provided
- Session expired
- Invalid session ID

**Solution**:

- Verify session cookie exists
- Check cookie expiration
- Re-authenticate via `/api/auth/login`

### No Events Received

**Problem**: Connected but not receiving position/order updates

**Causes**:

- Not subscribed to channels
- No trading activity (no events to send)
- User isolation (events only for your portfolio)

**Solution**:

- Send subscribe message after connection opens
- Execute a test trade to trigger events
- Check server logs for event emissions

### Connection Limit Exceeded

**Problem**: Connection rejected with "Maximum connections exceeded"

**Causes**:

- More than 5 connections for same user
- Server at 100 total connections

**Solution**:

- Close extra browser tabs/windows
- Wait for capacity to free up
- Contact admin to increase limits

---

## Performance

### Latency

- **Target**: <500ms from broker event to client delivery
- **Typical**: 100-300ms
- **Batching**: Events sent every 1 second

### Bandwidth

- **Per Position**: ~200 bytes per update
- **Batched**: ~2KB per batch (multiple positions)
- **Daily**: <100KB per user (vs 5MB with 30s REST polling)

### Message Frequency

- **Without Batching**: ~23,400 messages/day per position
- **With Batching (1s)**: ~1,170 messages/day per position
- **Reduction**: ~95%

---

## Security

### Authentication

- Session cookie required (HttpOnly, Secure)
- Validated on connection upgrade
- Users receive only their own portfolio events

### Rate Limiting

- Max 5 connections per user
- Max 100 total server connections
- Max 100 messages/second per connection

### Event Isolation

- Strict userId filtering
- Cross-user data leakage prevented
- Events filtered before transmission

---

## Feature Flag

**Environment Variable**: `ENABLE_REALTIME_PORTFOLIO`

- `true` (default): WebSocket streaming enabled
- `false`: WebSocket disabled, clients fall back to REST polling

---

## Related Documentation

- **User Guide**: `/docs/guides/realtime-portfolio-user-guide.md`
- **Admin Runbook**: `/docs/runbooks/realtime-portfolio-admin.md`
- **OpenSpec Proposal**: `/openspec/changes/realtime-portfolio-streaming/`
- **Testing Checklist**: `/docs/realtime-portfolio-testing-checklist.md`

---

**Last Updated**: 2026-01-04
**Version**: 1.0.0
**Status**: Production-Ready
