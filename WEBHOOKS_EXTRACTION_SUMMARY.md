# Webhook Routes Extraction Summary

## Overview
Successfully extracted 8 webhook-related routes from `/home/runner/workspace/server/routes.ts` and created a modular router file at `/home/runner/workspace/server/routes/webhooks.ts`.

## Extracted Routes

### 1. GET /api/webhooks
**Purpose**: List all registered webhooks with supported event types
- Returns array of webhook configurations with sensitive data redacted
- Includes complete list of `SUPPORTED_EVENTS`
- No authentication required (handled by middleware)

**Response Example**:
```json
{
  "webhooks": [
    {
      "id": "wh_1234567890_abc123",
      "name": "Trading Alerts",
      "url": "https://example.com/webhook",
      "eventTypes": ["trade.order.filled", "trade.position.opened"],
      "enabled": true,
      "headers": { "X-API-Key": "***REDACTED***" },
      "secret": "***REDACTED***"
    }
  ],
  "supportedEvents": [
    "trade.order.submitted",
    "trade.order.filled",
    "trade.order.canceled",
    "trade.order.rejected",
    "trade.position.opened",
    "trade.position.closed",
    "trade.position.updated",
    "ai.decision.generated",
    "ai.decision.executed",
    "market.data.update",
    "market.news.alert",
    "analytics.pnl.daily",
    "analytics.metrics.update",
    "system.error",
    "system.health.changed"
  ]
}
```

### 2. POST /api/webhooks
**Purpose**: Create a new webhook configuration
- Validates required fields: `name` and `url`
- Enforces HTTPS URLs in production environments
- Auto-generates unique webhook ID

**Request Body**:
```json
{
  "name": "Trading Alerts",
  "url": "https://example.com/webhook",
  "eventTypes": ["trade.order.filled", "trade.position.opened"],
  "enabled": true,
  "headers": { "X-API-Key": "secret-key" },
  "secret": "shared-secret-for-hmac"
}
```

**Response**: 201 Created with webhook configuration (secrets redacted)

### 3. GET /api/webhooks/:id
**Purpose**: Retrieve a specific webhook configuration by ID
- Returns single webhook with sensitive data redacted
- Returns 404 if webhook not found

**Response Example**:
```json
{
  "id": "wh_1234567890_abc123",
  "name": "Trading Alerts",
  "url": "https://example.com/webhook",
  "eventTypes": ["*"],
  "enabled": true,
  "headers": { "X-Custom-Header": "***REDACTED***" },
  "secret": "***REDACTED***"
}
```

### 4. PUT /api/webhooks/:id
**Purpose**: Update an existing webhook configuration
- Accepts partial updates (name, url, eventTypes, enabled, headers, secret)
- Returns 404 if webhook not found
- Returns updated configuration with redacted secrets

**Request Body** (all fields optional):
```json
{
  "name": "Updated Name",
  "enabled": false,
  "eventTypes": ["market.data.update"]
}
```

### 5. DELETE /api/webhooks/:id
**Purpose**: Unregister and remove a webhook
- Removes webhook from registry
- Returns 404 if webhook not found
- Returns success confirmation

**Response**:
```json
{
  "success": true
}
```

### 6. POST /api/webhooks/test
**Purpose**: Send a test event to all matching webhooks
- Allows testing webhook delivery without waiting for real events
- Optional custom event type and payload

**Request Body**:
```json
{
  "eventType": "system.test",
  "payload": {
    "test": true,
    "timestamp": "2025-12-26T12:00:00Z"
  }
}
```

**Response**:
```json
{
  "deliveries": 2,
  "results": [
    {
      "webhookId": "wh_1234567890_abc123",
      "eventId": "evt_1234567890_abc123",
      "eventType": "system.test",
      "status": "success",
      "statusCode": 200,
      "timestamp": "2025-12-26T12:00:00Z",
      "durationMs": 145
    }
  ]
}
```

### 7. GET /api/webhooks/stats/overview
**Purpose**: Get webhook statistics and health overview
- Shows total webhooks, enabled count, recent delivery stats
- Calculates success rate of recent deliveries

**Response**:
```json
{
  "totalWebhooks": 5,
  "enabledWebhooks": 4,
  "recentDeliveries": 23,
  "successRate": 0.96
}
```

### 8. GET /api/webhooks/history/deliveries
**Purpose**: Get webhook delivery history with optional limit
- Query param: `limit` (default: 50)
- Returns array of recent delivery attempts

**Query Example**: `/api/webhooks/history/deliveries?limit=100`

**Response**:
```json
{
  "deliveries": [
    {
      "webhookId": "wh_1234567890_abc123",
      "eventId": "evt_1234567890_xyz789",
      "eventType": "trade.order.filled",
      "status": "success",
      "statusCode": 200,
      "timestamp": "2025-12-26T12:00:00Z",
      "durationMs": 245
    },
    {
      "webhookId": "wh_1234567890_def456",
      "eventId": "evt_1234567890_xyz789",
      "eventType": "trade.order.filled",
      "status": "failed",
      "statusCode": 500,
      "error": "HTTP 500: Internal Server Error",
      "timestamp": "2025-12-26T12:00:00Z",
      "durationMs": 10000
    }
  ]
}
```

## File Structure

### Created File
- `/home/runner/workspace/server/routes/webhooks.ts` (183 lines)

### Dependencies
- Express Router (imported from "express")
- Webhook emitter functions from `/home/runner/workspace/server/lib/webhook-emitter.ts`
  - `registerWebhook()`
  - `unregisterWebhook()`
  - `getWebhooks()`
  - `getWebhook()`
  - `updateWebhook()`
  - `emitEvent()`
  - `getDeliveryHistory()`
  - `getWebhookStats()`
  - `SUPPORTED_EVENTS` constant

## Security Features

### Sensitive Data Redaction
- Webhook secrets are redacted to `***REDACTED***`
- HTTP headers containing 'auth', 'token', or 'key' (case-insensitive) are redacted
- Redaction applied to all API responses

### HTTPS Enforcement
- Webhook URLs must use HTTPS in production environments
- Development environments allow HTTP for testing

### HMAC-SHA256 Signatures
- Webhooks can be configured with a shared secret
- Payload is signed using HMAC-SHA256
- Signature sent in `X-Webhook-Signature` header

### Custom Headers Support
- Webhooks can include custom HTTP headers for authentication
- Headers are validated and can be redacted if they contain sensitive data

## Integration Steps

To integrate the webhook router into the main routes file:

1. Import the webhook router:
```typescript
import webhooksRouter from "./routes/webhooks";
```

2. Register the router with authentication middleware:
```typescript
app.use("/api/webhooks", authMiddleware, webhooksRouter);
```

Or if webhooks should be accessible without auth (not recommended for production):
```typescript
app.use("/api/webhooks", webhooksRouter);
```

## Event Types Reference

The webhook system supports the following event types:

- `trade.order.submitted` - Order submitted to broker
- `trade.order.filled` - Order execution completed
- `trade.order.canceled` - Order cancellation completed
- `trade.order.rejected` - Order rejected by broker
- `trade.position.opened` - New position opened
- `trade.position.closed` - Position fully closed
- `trade.position.updated` - Position details changed
- `ai.decision.generated` - AI generated trading decision
- `ai.decision.executed` - AI decision executed
- `market.data.update` - Market data received
- `market.news.alert` - News alert triggered
- `analytics.pnl.daily` - Daily P&L calculated
- `analytics.metrics.update` - Metrics updated
- `system.error` - System error occurred
- `system.health.changed` - System health status changed

Webhooks can subscribe to specific events or use `*` to receive all events.

## Implementation Notes

### ID Generation
- Webhook IDs follow pattern: `wh_<timestamp>_<random>`
- Event IDs follow pattern: `evt_<timestamp>_<random>`
- Ensures unique identification and timestamp-based sorting

### Delivery Tracking
- In-memory delivery history (max 100 most recent)
- Tracks: webhookId, eventId, eventType, status, statusCode, error, timestamp, durationMs
- Success/failure status recorded per delivery attempt

### Concurrency Control
- Uses `p-limit` with concurrency limit of 5
- Prevents overwhelming target servers with simultaneous requests
- 10-second timeout per webhook delivery attempt

## Related Files

- Webhook emitter implementation: `/home/runner/workspace/server/lib/webhook-emitter.ts`
- Main routes file (original location): `/home/runner/workspace/server/routes.ts` (lines 4023-4108)
- Strategies router pattern reference: `/home/runner/workspace/server/routes/strategies.ts`

