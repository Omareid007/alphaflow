/**
 * Notification Service Tests
 *
 * Tests for the multi-channel notification system including
 * Telegram, Slack, Discord, and Email channels.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerChannel,
  getChannel,
  getChannels,
  updateChannel,
  deleteChannel,
  registerTemplate,
  getTemplates,
  sendNotification,
  sendDirectNotification,
  getNotificationHistory,
  getNotificationStats,
  NotificationChannel,
  NotificationTemplate,
} from "../../../server/lib/notification-service";

// Mock fetch for external API calls
global.fetch = vi.fn();

describe("NotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Channel Management", () => {
    it("should register a new channel", () => {
      const channel: NotificationChannel = {
        id: "test-channel-1",
        type: "slack",
        name: "Test Slack Channel",
        enabled: true,
        config: { webhookUrl: "https://hooks.slack.com/test" },
        createdAt: new Date(),
      };

      registerChannel(channel);
      const retrieved = getChannel("test-channel-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("Test Slack Channel");
      expect(retrieved?.type).toBe("slack");
    });

    it("should update an existing channel", () => {
      const channel: NotificationChannel = {
        id: "test-channel-2",
        type: "discord",
        name: "Original Name",
        enabled: true,
        config: { webhookUrl: "https://discord.com/webhook" },
        createdAt: new Date(),
      };

      registerChannel(channel);
      const updated = updateChannel("test-channel-2", {
        name: "Updated Name",
        enabled: false,
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.enabled).toBe(false);
      expect(updated?.id).toBe("test-channel-2"); // ID should not change
    });

    it("should return null when updating non-existent channel", () => {
      const updated = updateChannel("non-existent", { name: "Test" });
      expect(updated).toBeNull();
    });

    it("should delete a channel", () => {
      const channel: NotificationChannel = {
        id: "test-channel-3",
        type: "telegram",
        name: "To Delete",
        enabled: true,
        config: { botToken: "token", chatId: "chat" },
        createdAt: new Date(),
      };

      registerChannel(channel);
      expect(getChannel("test-channel-3")).toBeDefined();

      const deleted = deleteChannel("test-channel-3");
      expect(deleted).toBe(true);
      expect(getChannel("test-channel-3")).toBeUndefined();
    });

    it("should return all channels", () => {
      const channels = getChannels();
      expect(Array.isArray(channels)).toBe(true);
    });
  });

  describe("Template Management", () => {
    it("should register a template", () => {
      const template: NotificationTemplate = {
        id: "test-template-1",
        name: "Test Template",
        eventType: "test.event",
        channels: [],
        messageTemplate: "Hello {{name}}!",
        enabled: true,
      };

      registerTemplate(template);
      const templates = getTemplates();
      const found = templates.find((t) => t.id === "test-template-1");

      expect(found).toBeDefined();
      expect(found?.messageTemplate).toBe("Hello {{name}}!");
    });

    it("should have default templates", () => {
      const templates = getTemplates();
      const tradeOrderFilled = templates.find(
        (t) => t.id === "trade-order-filled"
      );

      expect(tradeOrderFilled).toBeDefined();
      expect(tradeOrderFilled?.eventType).toBe("trade.order.filled");
    });
  });

  describe("Notification Sending", () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
      });
    });

    it("should send notification to Slack channel", async () => {
      const channel: NotificationChannel = {
        id: "slack-test",
        type: "slack",
        name: "Slack Test",
        enabled: true,
        config: { webhookUrl: "https://hooks.slack.com/test" },
        createdAt: new Date(),
      };

      registerChannel(channel);

      const result = await sendDirectNotification("slack-test", "Test message");

      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://hooks.slack.com/test",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("should send notification to Discord channel", async () => {
      const channel: NotificationChannel = {
        id: "discord-test",
        type: "discord",
        name: "Discord Test",
        enabled: true,
        config: { webhookUrl: "https://discord.com/api/webhooks/test" },
        createdAt: new Date(),
      };

      registerChannel(channel);

      const result = await sendDirectNotification(
        "discord-test",
        "Test message"
      );

      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
    });

    it("should return null for non-existent channel", async () => {
      const result = await sendDirectNotification("non-existent", "Test");
      expect(result).toBeNull();
    });

    it("should handle API errors gracefully", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server error"),
      });

      const channel: NotificationChannel = {
        id: "error-test",
        type: "slack",
        name: "Error Test",
        enabled: true,
        config: { webhookUrl: "https://hooks.slack.com/error" },
        createdAt: new Date(),
      };

      registerChannel(channel);

      const result = await sendDirectNotification("error-test", "Test");

      expect(result).toBeDefined();
      expect(result?.success).toBe(false);
      expect(result?.error).toBeDefined();
    });
  });

  describe("Email Channel", () => {
    it("should handle email channel when SendGrid not configured", async () => {
      const channel: NotificationChannel = {
        id: "email-test",
        type: "email",
        name: "Email Test",
        enabled: true,
        config: {
          from: "test@example.com",
          to: ["recipient@example.com"],
        },
        createdAt: new Date(),
      };

      registerChannel(channel);

      const result = await sendDirectNotification("email-test", "Test email");

      expect(result).toBeDefined();
      // Should fail gracefully when no email provider is configured
      expect(result?.error).toContain("No email provider configured");
    });
  });

  describe("Notification History & Stats", () => {
    it("should return notification history", () => {
      const history = getNotificationHistory(10);
      expect(Array.isArray(history)).toBe(true);
    });

    it("should return notification stats", () => {
      const stats = getNotificationStats();

      expect(stats).toHaveProperty("totalChannels");
      expect(stats).toHaveProperty("enabledChannels");
      expect(stats).toHaveProperty("totalTemplates");
      expect(stats).toHaveProperty("recentNotifications");
      expect(stats).toHaveProperty("successRate");
    });
  });
});
