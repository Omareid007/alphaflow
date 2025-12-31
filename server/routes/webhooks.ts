import { Router, Request, Response } from "express";
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
import { log } from "../utils/logger";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

/**
 * Redacts sensitive webhook information (secrets and auth headers)
 * before returning to clients
 */
const redactWebhook = (webhook: WebhookConfig) => ({
  ...webhook,
  secret: webhook.secret ? "***REDACTED***" : undefined,
  headers: webhook.headers
    ? Object.fromEntries(
        Object.entries(webhook.headers).map(([k, v]) =>
          k.toLowerCase().includes("auth") ||
          k.toLowerCase().includes("token") ||
          k.toLowerCase().includes("key")
            ? [k, "***REDACTED***"]
            : [k, v]
        )
      )
    : undefined,
});

/**
 * GET /api/webhooks
 * List all registered webhooks with supported event types
 */
router.get("/", (req: Request, res: Response) => {
  const webhooks = getWebhooks().map(redactWebhook);
  res.json({ webhooks, supportedEvents: SUPPORTED_EVENTS });
});

/**
 * POST /api/webhooks
 * Create a new webhook configuration
 *
 * Body:
 * - name (string, required): Human-readable webhook name
 * - url (string, required): HTTPS webhook endpoint URL
 * - eventTypes (string[], optional): Types of events to subscribe to, defaults to ['*']
 * - enabled (boolean, optional): Whether webhook is active, defaults to true
 * - headers (Record<string, string>, optional): Custom HTTP headers to send
 * - secret (string, optional): Shared secret for HMAC-SHA256 signatures
 */
router.post("/", (req: Request, res: Response) => {
  try {
    const { name, url, eventTypes, enabled, headers, secret } = req.body;

    // Validate required fields
    if (!name || !url) {
      return res.status(400).json({ error: "name and url are required" });
    }

    // Enforce HTTPS in production
    if (!url.startsWith("https://") && process.env.NODE_ENV === "production") {
      return res
        .status(400)
        .json({ error: "Webhook URL must use HTTPS in production" });
    }

    // Create webhook configuration
    const id = `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const config: WebhookConfig = {
      id,
      name,
      url,
      eventTypes: eventTypes || ["*"],
      enabled: enabled !== false,
      headers,
      secret,
    };

    registerWebhook(config);
    res.status(201).json(redactWebhook(config));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("Webhooks", "Webhook creation error", { error: errorMessage });
    res.status(500).json({ error: "Failed to create webhook" });
  }
});

/**
 * GET /api/webhooks/:id
 * Retrieve a specific webhook configuration by ID
 */
router.get("/:id", (req: Request, res: Response) => {
  const webhook = getWebhook(req.params.id);
  if (!webhook) {
    return res.status(404).json({ error: "Webhook not found" });
  }
  res.json(redactWebhook(webhook));
});

/**
 * PUT /api/webhooks/:id
 * Update an existing webhook configuration
 *
 * Body: Partial webhook config (name, url, eventTypes, enabled, headers, secret)
 */
router.put("/:id", (req: Request, res: Response) => {
  const updated = updateWebhook(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "Webhook not found" });
  }
  res.json(redactWebhook(updated));
});

/**
 * DELETE /api/webhooks/:id
 * Unregister and remove a webhook
 */
router.delete("/:id", (req: Request, res: Response) => {
  const result = unregisterWebhook(req.params.id);
  if (!result) {
    return res.status(404).json({ error: "Webhook not found" });
  }
  res.json({ success: true });
});

/**
 * POST /api/webhooks/test
 * Send a test event to all matching webhooks
 *
 * Body:
 * - eventType (string, optional): Event type to emit, defaults to 'system.test'
 * - payload (unknown, optional): Custom test payload
 */
router.post("/test", requireAuth, async (req: Request, res: Response) => {
  try {
    const { eventType, payload } = req.body;
    const results = await emitEvent(
      eventType || "system.test",
      payload || { test: true, timestamp: new Date().toISOString() }
    );
    res.json({ deliveries: results.length, results });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("Webhooks", "Webhook test error", { error: errorMessage });
    res.status(500).json({ error: "Failed to send test event" });
  }
});

/**
 * GET /api/webhooks/stats/overview
 * Get webhook statistics and health overview
 *
 * Returns:
 * - totalWebhooks: Total number of registered webhooks
 * - enabledWebhooks: Number of active webhooks
 * - recentDeliveries: Count of recent delivery attempts
 * - successRate: Success rate of recent deliveries (0-1)
 */
router.get("/stats/overview", (req: Request, res: Response) => {
  res.json(getWebhookStats());
});

/**
 * GET /api/webhooks/history/deliveries
 * Get webhook delivery history with optional limit
 *
 * Query params:
 * - limit (number, optional): Number of recent deliveries to return, defaults to 50
 *
 * Returns array of delivery attempts including:
 * - webhookId: ID of the webhook
 * - eventId: ID of the event
 * - eventType: Type of event delivered
 * - status: 'success' | 'failed' | 'pending'
 * - statusCode: HTTP response code (if applicable)
 * - error: Error message (if failed)
 * - timestamp: When delivery was attempted
 * - durationMs: Time taken for delivery
 */
router.get("/history/deliveries", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json({ deliveries: getDeliveryHistory(limit) });
});

export default router;
