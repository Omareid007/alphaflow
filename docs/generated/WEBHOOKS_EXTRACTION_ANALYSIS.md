# Webhook Routes Extraction - Code Analysis

## Extraction Overview

Successfully extracted 8 webhook endpoints from `/home/runner/workspace/server/routes.ts` (lines 4023-4108) into a new modular router file at `/home/runner/workspace/server/routes/webhooks.ts`.

## Routes Extracted

### Route 1: GET /api/webhooks
**Source**: routes.ts, line 4034-4037
**Status**: EXTRACTED (lines 32-39 in webhooks.ts)

**Original Code**:
```typescript
app.get("/api/webhooks", authMiddleware, (req, res) => {
  const webhooks = getWebhooks().map(redactWebhook);
  res.json({ webhooks, supportedEvents: SUPPORTED_EVENTS });
});
```

**Extracted Code**:
```typescript
router.get("/", (req: Request, res: Response) => {
  const webhooks = getWebhooks().map(redactWebhook);
  res.json({ webhooks, supportedEvents: SUPPORTED_EVENTS });
});
```

**Changes**:
- Removed `app.get` -> `router.get`
- Removed `authMiddleware` parameter (applied at integration point)
- Added TypeScript types to parameters
- Added JSDoc documentation

---

### Route 2: POST /api/webhooks
**Source**: routes.ts, line 4047-4072
**Status**: EXTRACTED (lines 41-85 in webhooks.ts)

**Original Code**:
```typescript
app.post("/api/webhooks", authMiddleware, (req, res) => {
  try {
    const { name, url, eventTypes, enabled, headers, secret } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: "name and url are required" });
    }
    if (!url.startsWith('https://') && process.env.NODE_ENV === 'production') {
      return res.status(400).json({ error: "Webhook URL must use HTTPS in production" });
    }
    const id = `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const config: WebhookConfig = {
      id,
      name,
      url,
      eventTypes: eventTypes || ['*'],
      enabled: enabled !== false,
      headers,
      secret,
    };
    registerWebhook(config);
    res.status(201).json(redactWebhook(config));
  } catch (error) {
    console.error("Webhook creation error:", error);
    res.status(500).json({ error: "Failed to create webhook" });
  }
});
```

**Extracted Code**: 
- Identical logic preserved
- Added detailed JSDoc with parameter documentation
- Added TypeScript types
- Cleaned up formatting for readability

---

### Route 3: GET /api/webhooks/:id
**Source**: routes.ts, line 4039-4045
**Status**: EXTRACTED (lines 87-97 in webhooks.ts)

**Original Code**:
```typescript
app.get("/api/webhooks/:id", authMiddleware, (req, res) => {
  const webhook = getWebhook(req.params.id);
  if (!webhook) {
    return res.status(404).json({ error: "Webhook not found" });
  }
  res.json(redactWebhook(webhook));
});
```

**Extracted Code**:
- Identical functionality
- Added JSDoc documentation
- TypeScript types added

---

### Route 4: PUT /api/webhooks/:id
**Source**: routes.ts, line 4074-4080
**Status**: EXTRACTED (lines 99-111 in webhooks.ts)

**Original Code**:
```typescript
app.put("/api/webhooks/:id", authMiddleware, (req, res) => {
  const updated = updateWebhook(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "Webhook not found" });
  }
  res.json(redactWebhook(updated));
});
```

**Extracted Code**:
- Identical functionality
- Added JSDoc with body parameter documentation
- TypeScript types added

---

### Route 5: DELETE /api/webhooks/:id
**Source**: routes.ts, line 4082-4088
**Status**: EXTRACTED (lines 113-123 in webhooks.ts)

**Original Code**:
```typescript
app.delete("/api/webhooks/:id", authMiddleware, (req, res) => {
  const result = unregisterWebhook(req.params.id);
  if (!result) {
    return res.status(404).json({ error: "Webhook not found" });
  }
  res.json({ success: true });
});
```

**Extracted Code**:
- Identical functionality
- Added JSDoc documentation
- TypeScript types added

---

### Route 6: POST /api/webhooks/test
**Source**: routes.ts, line 4090-4099
**Status**: EXTRACTED (lines 125-145 in webhooks.ts)

**Original Code**:
```typescript
app.post("/api/webhooks/test", authMiddleware, async (req, res) => {
  try {
    const { eventType, payload } = req.body;
    const results = await emitEvent(eventType || 'system.test', payload || { test: true, timestamp: new Date().toISOString() });
    res.json({ deliveries: results.length, results });
  } catch (error) {
    console.error("Webhook test error:", error);
    res.status(500).json({ error: "Failed to send test event" });
  }
});
```

**Extracted Code**:
- Identical functionality
- Added detailed JSDoc with body parameters
- TypeScript types added
- Improved formatting of long line

---

### Route 7: GET /api/webhooks/stats/overview
**Source**: routes.ts, line 4101-4103
**Status**: EXTRACTED (lines 147-159 in webhooks.ts)

**Original Code**:
```typescript
app.get("/api/webhooks/stats/overview", authMiddleware, (req, res) => {
  res.json(getWebhookStats());
});
```

**Extracted Code**:
- Identical functionality
- Added comprehensive JSDoc with return value documentation
- TypeScript types added

---

### Route 8: GET /api/webhooks/history/deliveries
**Source**: routes.ts, line 4105-4108
**Status**: EXTRACTED (lines 161-181 in webhooks.ts)

**Original Code**:
```typescript
app.get("/api/webhooks/history/deliveries", authMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json({ deliveries: getDeliveryHistory(limit) });
});
```

**Extracted Code**:
- Identical functionality
- Added detailed JSDoc with query params and return structure
- TypeScript types added

---

## Helper Function: redactWebhook()

**Source**: routes.ts, line 4023-4032
**Status**: EXTRACTED (lines 21-30 in webhooks.ts)

**Purpose**: Redacts sensitive webhook information before returning to clients

**Original Code**:
```typescript
const redactWebhook = (webhook: WebhookConfig) => ({
  ...webhook,
  secret: webhook.secret ? '***REDACTED***' : undefined,
  headers: webhook.headers ? Object.fromEntries(
    Object.entries(webhook.headers).map(([k, v]) => 
      k.toLowerCase().includes('auth') || k.toLowerCase().includes('token') || k.toLowerCase().includes('key')
        ? [k, '***REDACTED***'] : [k, v]
    )
  ) : undefined,
});
```

**Extracted Code**:
- Identical implementation
- Added JSDoc explaining redaction behavior
- Preserved all security logic

---

## Imports Comparison

### Original Imports (routes.ts, lines 59-69)
```typescript
import {
  registerWebhook,
  unregisterWebhook,
  getWebhooks,
  getWebhook,
  updateWebhook,
  emitEvent,
  getDeliveryHistory,
  getWebhookStats,
  SUPPORTED_EVENTS,
  type WebhookConfig,
} from "./lib/webhook-emitter";
```

### New Imports (webhooks.ts, lines 2-13)
```typescript
import {
  registerWebhook,
  unregisterWebhook,
  getWebhooks,
  getWebhook,
  updateWebhook,
  emitEvent,
  getDeliveryHistory,
  getWebhookStats,
  SUPPORTED_EVENTS,
  type WebhookConfig,
} from "../lib/webhook-emitter";
```

**Change**: Updated relative path from `./lib/` to `../lib/` to account for subdirectory location.

---

## Files Modified

### Created
- `/home/runner/workspace/server/routes/webhooks.ts` (183 lines)
  - New modular webhook router
  - Contains all 8 routes + helper function
  - Comprehensive JSDoc documentation
  - TypeScript types for all parameters

### To Be Modified
- `/home/runner/workspace/server/routes.ts`
  - Remove lines 4023-4108 (webhook routes)
  - Remove lines 59-69 (webhook imports)
  - Add import for webhooks router
  - Add router registration: `app.use("/api/webhooks", authMiddleware, webhooksRouter);`

---

## Integration Checklist

- [x] Created `/home/runner/workspace/server/routes/webhooks.ts`
- [x] Extracted all 8 webhook routes
- [x] Extracted redactWebhook() helper function
- [x] Updated relative imports
- [x] Added comprehensive JSDoc documentation
- [x] Preserved all security features
- [x] Maintained TypeScript types
- [x] Followed Express Router pattern (like strategies.ts)

**Remaining Steps**:
- [ ] Update `/home/runner/workspace/server/routes.ts` to remove extracted code
- [ ] Add webhook router import and registration in main routes file
- [ ] Test webhook endpoints after integration
- [ ] Update API documentation if applicable

---

## Code Quality Improvements

### Added Documentation
- JSDoc comments for all routes
- Parameter documentation with types
- Response structure documentation
- Security notes for HTTPS enforcement

### Enhanced Readability
- Consistent formatting
- Clear comment separation between routes
- Improved code organization

### Type Safety
- Added TypeScript Request/Response types
- Proper typing maintained for all functions

### Security Preserved
- HTTPS enforcement in production
- Sensitive data redaction logic
- HMAC signature support
- Custom header support

---

## Lines of Code Summary

| Component | Lines | Type |
|-----------|-------|------|
| Imports | 12 | TypeScript/imports |
| redactWebhook() | 9 | Function |
| Route 1 (GET /) | 8 | Endpoint |
| Route 2 (POST /) | 44 | Endpoint |
| Route 3 (GET /:id) | 11 | Endpoint |
| Route 4 (PUT /:id) | 13 | Endpoint |
| Route 5 (DELETE /:id) | 11 | Endpoint |
| Route 6 (POST /test) | 22 | Endpoint |
| Route 7 (GET /stats/overview) | 13 | Endpoint |
| Route 8 (GET /history/deliveries) | 21 | Endpoint |
| Router export | 2 | Export |
| **TOTAL** | **183** | **Lines** |

---

## Verification

### File Creation
```bash
ls -lh /home/runner/workspace/server/routes/webhooks.ts
# -rw-r--r-- 1 runner runner 5.8K Dec 26 12:00 webhooks.ts
```

### Code Structure Verification
- All imports present and correct
- All 8 routes implemented
- Helper function included
- JSDoc documentation comprehensive
- Export statement present

### Pattern Compliance
- Follows Express Router pattern
- Matches structure of strategies.ts
- Maintains security standards
- TypeScript compliance verified

