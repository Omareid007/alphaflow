# Webhook Routes - Code Reference & Quick Start

## File Created
```
/home/runner/workspace/server/routes/webhooks.ts (183 lines)
```

## Quick Start Integration

### Step 1: Import the router
```typescript
import webhooksRouter from "./routes/webhooks";
```

### Step 2: Register with auth middleware (RECOMMENDED)
```typescript
app.use("/api/webhooks", authMiddleware, webhooksRouter);
```

## Route Summary Table

| HTTP Method | Endpoint | Description | Auth Required |
|------------|----------|-------------|---------------|
| GET | `/api/webhooks` | List all webhooks | Yes |
| POST | `/api/webhooks` | Create webhook | Yes |
| GET | `/api/webhooks/:id` | Get webhook by ID | Yes |
| PUT | `/api/webhooks/:id` | Update webhook | Yes |
| DELETE | `/api/webhooks/:id` | Delete webhook | Yes |
| POST | `/api/webhooks/test` | Send test event | Yes |
| GET | `/api/webhooks/stats/overview` | Get stats | Yes |
| GET | `/api/webhooks/history/deliveries` | Get delivery history | Yes |

## Detailed Route Examples

### 1. List All Webhooks
```bash
curl -X GET http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Create Webhook
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Order Notifications",
    "url": "https://example.com/webhooks/orders",
    "eventTypes": ["trade.order.filled", "trade.order.rejected"],
    "enabled": true,
    "headers": {
      "X-API-Key": "your-secret-key"
    },
    "secret": "webhook-signing-secret"
  }'
```

Response: 201 Created
```json
{
  "id": "wh_1735150400000_abc123def",
  "name": "Order Notifications",
  "url": "https://example.com/webhooks/orders",
  "eventTypes": ["trade.order.filled", "trade.order.rejected"],
  "enabled": true,
  "headers": {
    "X-API-Key": "***REDACTED***"
  },
  "secret": "***REDACTED***"
}
```

### 3. Get Specific Webhook
```bash
curl -X GET http://localhost:3000/api/webhooks/wh_1735150400000_abc123def \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Update Webhook
```bash
curl -X PUT http://localhost:3000/api/webhooks/wh_1735150400000_abc123def \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false,
    "eventTypes": ["trade.position.updated"]
  }'
```

### 5. Delete Webhook
```bash
curl -X DELETE http://localhost:3000/api/webhooks/wh_1735150400000_abc123def \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "success": true
}
```

### 6. Send Test Event
```bash
curl -X POST http://localhost:3000/api/webhooks/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "trade.order.filled",
    "payload": {
      "orderId": "order_123",
      "symbol": "AAPL",
      "quantity": 100,
      "price": 150.25
    }
  }'
```

### 7. Get Webhook Statistics
```bash
curl -X GET http://localhost:3000/api/webhooks/stats/overview \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "totalWebhooks": 3,
  "enabledWebhooks": 2,
  "recentDeliveries": 47,
  "successRate": 0.9787234042553191
}
```

### 8. Get Delivery History
```bash
curl -X GET "http://localhost:3000/api/webhooks/history/deliveries?limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "deliveries": [
    {
      "webhookId": "wh_1735150400000_abc123def",
      "eventId": "evt_1735150400100_xyz789abc",
      "eventType": "trade.order.filled",
      "status": "success",
      "statusCode": 200,
      "timestamp": "2025-12-26T12:00:00Z",
      "durationMs": 245
    },
    {
      "webhookId": "wh_1735150400000_def456ghi",
      "eventId": "evt_1735150400100_xyz789abc",
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

## Webhook Event Types

### Order Events
- `trade.order.submitted` - Order submitted to broker
- `trade.order.filled` - Order execution completed
- `trade.order.canceled` - Order cancellation completed
- `trade.order.rejected` - Order rejected by broker

### Position Events
- `trade.position.opened` - New position opened
- `trade.position.closed` - Position fully closed
- `trade.position.updated` - Position details changed

### AI Events
- `ai.decision.generated` - AI generated trading decision
- `ai.decision.executed` - AI decision executed

### Market Events
- `market.data.update` - Market data received
- `market.news.alert` - News alert triggered

### Analytics Events
- `analytics.pnl.daily` - Daily P&L calculated
- `analytics.metrics.update` - Metrics updated

### System Events
- `system.error` - System error occurred
- `system.health.changed` - System health status changed

## Webhook Payload Structure

When a webhook is triggered, it receives a JSON payload with this structure:

```json
{
  "id": "evt_1735150400100_xyz789abc",
  "type": "trade.order.filled",
  "timestamp": "2025-12-26T12:00:00Z",
  "source": "ai-active-trader",
  "payload": {
    // Event-specific data
  }
}
```

### Custom Headers Sent with Each Delivery
```
Content-Type: application/json
X-Webhook-Event: trade.order.filled
X-Webhook-Id: evt_1735150400100_xyz789abc
X-Webhook-Timestamp: 2025-12-26T12:00:00Z
X-Webhook-Signature: sha256=<hmac_signature>
[Any custom headers configured for the webhook]
```

## Security Implementation

### HMAC Signature Verification
If a webhook has a secret configured, the payload is signed using HMAC-SHA256:

```typescript
// Pseudo-code for verification
const crypto = require('crypto');
const signature = request.headers['x-webhook-signature'];
const body = request.rawBody;
const secret = 'your-webhook-secret';

const expectedSignature = `sha256=${crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex')}`;

if (signature !== expectedSignature) {
  // Invalid signature - reject webhook
}
```

### HTTPS Enforcement
- In production: All webhook URLs MUST use HTTPS
- In development: HTTP is allowed for testing
- This is validated at webhook creation/update

### Header Redaction
Sensitive headers are redacted before returning webhook configs:
- Headers containing 'auth' (case-insensitive)
- Headers containing 'token' (case-insensitive)
- Headers containing 'key' (case-insensitive)
- Webhook secret is always redacted

## Implementation Notes

### Concurrency Management
- Maximum 5 concurrent webhook deliveries
- Uses `p-limit` library for throttling
- 10-second timeout per delivery attempt

### Event Matching
- Webhooks can subscribe to specific events or `*` for all events
- An event matches if:
  - Webhook is enabled AND
  - Webhook.eventTypes includes the event type OR webhook.eventTypes includes '*'

### Delivery History
- Last 100 delivery attempts stored in memory
- Tracks timestamp, duration, status, and error details
- Useful for debugging failed deliveries

### ID Generation
- Webhook IDs: `wh_<timestamp>_<randomString>`
- Event IDs: `evt_<timestamp>_<randomString>`
- Ensures uniqueness and allows timestamp-based sorting

## Related Source Files

1. **Webhook Implementation**: `/home/runner/workspace/server/lib/webhook-emitter.ts`
   - Core webhook logic
   - Event delivery system
   - Delivery history tracking

2. **Original Routes**: `/home/runner/workspace/server/routes.ts`
   - Lines 4023-4108: Webhook routes (now extracted)
   - Imports webhook functions (line 59-69)

3. **Pattern Reference**: `/home/runner/workspace/server/routes/strategies.ts`
   - Similar router pattern using Express Router
   - Example of modular route organization

## Troubleshooting

### Webhook Not Receiving Events
1. Verify webhook is enabled: `enabled: true`
2. Check eventTypes matches the event being emitted
3. Ensure URL is accessible and responding with 2xx status
4. Check delivery history for error details

### Signature Verification Failed
1. Ensure you're using the exact raw request body
2. Verify the secret matches what was configured
3. Decode the signature format: `sha256=<hex_string>`

### High Failure Rates
1. Check webhook statistics: GET `/api/webhooks/stats/overview`
2. Review delivery history: GET `/api/webhooks/history/deliveries?limit=100`
3. Consider increasing timeout (currently 10 seconds)
4. Verify target server can handle request volume

## Testing Webhooks

### Manual Test via API
```bash
curl -X POST http://localhost:3000/api/webhooks/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "system.test",
    "payload": { "test": true }
  }'
```

### Real Event Simulation
Set up a webhook pointing to a service like `webhook.site` or `requestbin.com` to capture actual webhook deliveries.

## Monitoring & Observability

Use these endpoints to monitor webhook health:

1. **Overall Stats**
   ```
   GET /api/webhooks/stats/overview
   ```
   Returns: totalWebhooks, enabledWebhooks, recentDeliveries, successRate

2. **Delivery History**
   ```
   GET /api/webhooks/history/deliveries?limit=100
   ```
   Returns: Array of recent delivery attempts with detailed information

3. **Individual Webhook**
   ```
   GET /api/webhooks/{id}
   ```
   Returns: Full webhook configuration (with redacted secrets)

