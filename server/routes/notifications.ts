import { Router, Request, Response } from "express";
import { log } from "../utils/logger";
import {
  registerChannel,
  getChannel,
  getChannels,
  updateChannel,
  deleteChannel,
  registerTemplate,
  getTemplates,
  updateTemplate,
  deleteTemplate,
  sendNotification,
  sendDirectNotification,
  getNotificationHistory,
  getNotificationStats,
  type NotificationChannel,
  type NotificationTemplate,
} from "../lib/notification-service";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Redacted channel response for API output
 */
interface RedactedChannelResponse {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Redacts sensitive fields from a notification channel config for API responses.
 * Handles all channel types: telegram, slack, discord, email.
 */
const redactChannelConfig = (channel: NotificationChannel): RedactedChannelResponse => {
  // Shallow copy the config as a plain object
  const config: Record<string, unknown> = { ...channel.config };

  // Redact sensitive fields based on what exists
  if ("botToken" in config && typeof config.botToken === "string") {
    config.botToken = "***REDACTED***";
  }
  if ("webhookUrl" in config && typeof config.webhookUrl === "string") {
    config.webhookUrl = config.webhookUrl.replace(/\/[^/]+$/, "/***REDACTED***");
  }
  if ("password" in config && typeof config.password === "string") {
    config.password = "***REDACTED***";
  }

  return {
    id: channel.id,
    type: channel.type,
    name: channel.name,
    enabled: channel.enabled,
    config,
    createdAt: channel.createdAt,
  };
};

// ============================================================================
// CHANNEL ROUTES
// ============================================================================

router.get("/channels", (req: Request, res: Response) => {
  res.json({ channels: getChannels().map(redactChannelConfig) });
});

router.get("/channels/:id", (req: Request, res: Response) => {
  const channel = getChannel(req.params.id);
  if (!channel) {
    return res.status(404).json({ error: "Channel not found" });
  }
  res.json(redactChannelConfig(channel));
});

router.post("/channels", (req: Request, res: Response) => {
  try {
    const { type, name, config, enabled } = req.body;
    if (!type || !name || !config) {
      return res
        .status(400)
        .json({ error: "type, name, and config are required" });
    }
    if (!["telegram", "slack", "discord", "email"].includes(type)) {
      return res.status(400).json({ error: "Invalid channel type" });
    }
    const id = `ch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const channel: NotificationChannel = {
      id,
      type,
      name,
      config,
      enabled: enabled === true,
      createdAt: new Date(),
    };
    registerChannel(channel);
    res.status(201).json(redactChannelConfig(channel));
  } catch (error) {
    log.error("NotificationsAPI", "Channel creation error", { error: error });
    res.status(500).json({ error: "Failed to create channel" });
  }
});

router.put("/channels/:id", (req: Request, res: Response) => {
  const updated = updateChannel(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "Channel not found" });
  }
  res.json(redactChannelConfig(updated));
});

router.delete("/channels/:id", (req: Request, res: Response) => {
  const result = deleteChannel(req.params.id);
  if (!result) {
    return res.status(404).json({ error: "Channel not found" });
  }
  res.json({ success: true });
});

router.post("/channels/:id/test", requireAuth, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const result = await sendDirectNotification(
      req.params.id,
      message || "Test notification from AI Active Trader"
    );
    if (!result) {
      return res.status(404).json({ error: "Channel not found" });
    }
    res.json(result);
  } catch (error) {
    log.error("NotificationsAPI", "Notification test error", { error: error });
    res.status(500).json({ error: "Failed to send test notification" });
  }
});

// ============================================================================
// TEMPLATE ROUTES
// ============================================================================

router.get("/templates", (req: Request, res: Response) => {
  res.json({ templates: getTemplates() });
});

router.post("/templates", (req: Request, res: Response) => {
  try {
    const { name, eventType, channels, messageTemplate, enabled } = req.body;
    if (!name || !eventType || !messageTemplate) {
      return res
        .status(400)
        .json({ error: "name, eventType, and messageTemplate are required" });
    }
    const id = `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const template: NotificationTemplate = {
      id,
      name,
      eventType,
      channels: channels || [],
      messageTemplate,
      enabled: enabled !== false,
    };
    registerTemplate(template);
    res.status(201).json(template);
  } catch (error) {
    log.error("NotificationsAPI", "Template creation error", { error: error });
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.put("/templates/:id", (req: Request, res: Response) => {
  const updated = updateTemplate(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "Template not found" });
  }
  res.json(updated);
});

router.delete("/templates/:id", (req: Request, res: Response) => {
  const result = deleteTemplate(req.params.id);
  if (!result) {
    return res.status(404).json({ error: "Template not found" });
  }
  res.json({ success: true });
});

// ============================================================================
// NOTIFICATION ROUTES
// ============================================================================

router.post("/send", requireAuth, async (req: Request, res: Response) => {
  try {
    const { eventType, data } = req.body;
    if (!eventType) {
      return res.status(400).json({ error: "eventType is required" });
    }
    const results = await sendNotification(eventType, data || {});
    res.json({ sent: results.length, results });
  } catch (error) {
    log.error("NotificationsAPI", "Notification send error", { error: error });
    res.status(500).json({ error: "Failed to send notification" });
  }
});

router.get("/history", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json({ notifications: getNotificationHistory(limit) });
});

router.get("/stats", (req: Request, res: Response) => {
  res.json(getNotificationStats());
});

export default router;
