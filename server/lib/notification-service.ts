import crypto from "crypto";
import { log } from "../utils/logger";
import { sendEmail, isEmailConfigured } from "./email-service";

export interface NotificationChannel {
  id: string;
  type: "telegram" | "slack" | "discord" | "email";
  name: string;
  enabled: boolean;
  config: TelegramConfig | SlackConfig | DiscordConfig | EmailConfig;
  createdAt: Date;
}

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface SlackConfig {
  webhookUrl: string;
  channel?: string;
}

interface DiscordConfig {
  webhookUrl: string;
}

interface EmailConfig {
  from: string;
  to: string[];
  replyTo?: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  eventType: string;
  channels: string[];
  messageTemplate: string;
  enabled: boolean;
}

export interface NotificationResult {
  channelId: string;
  channelType: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

const channels: Map<string, NotificationChannel> = new Map();
const templates: Map<string, NotificationTemplate> = new Map();
const notificationHistory: NotificationResult[] = [];
const MAX_HISTORY = 200;

export function registerChannel(channel: NotificationChannel): void {
  channels.set(channel.id, channel);
}

export function getChannel(id: string): NotificationChannel | undefined {
  return channels.get(id);
}

export function getChannels(): NotificationChannel[] {
  return Array.from(channels.values());
}

export function updateChannel(
  id: string,
  updates: Partial<NotificationChannel>
): NotificationChannel | null {
  const channel = channels.get(id);
  if (!channel) return null;
  const updated = { ...channel, ...updates, id: channel.id };
  channels.set(id, updated);
  return updated;
}

export function deleteChannel(id: string): boolean {
  return channels.delete(id);
}

export function registerTemplate(template: NotificationTemplate): void {
  templates.set(template.id, template);
}

export function getTemplates(): NotificationTemplate[] {
  return Array.from(templates.values());
}

export function updateTemplate(
  id: string,
  updates: Partial<NotificationTemplate>
): NotificationTemplate | null {
  const template = templates.get(id);
  if (!template) return null;
  const updated = { ...template, ...updates, id: template.id };
  templates.set(id, updated);
  return updated;
}

export function deleteTemplate(id: string): boolean {
  return templates.delete(id);
}

function formatMessage(
  template: string,
  data: Record<string, unknown>
): string {
  let message = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    message = message.replace(regex, String(value ?? ""));
  }
  message = message.replace(/\{\{[^}]+\}\}/g, "");
  return message;
}

async function sendTelegram(
  config: TelegramConfig,
  message: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: message,
      parse_mode: "HTML",
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${error}`);
  }
}

async function sendSlack(config: SlackConfig, message: string): Promise<void> {
  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: message,
      channel: config.channel,
    }),
  });
  if (!response.ok) {
    throw new Error(`Slack webhook error: ${response.status}`);
  }
}

async function sendDiscord(
  config: DiscordConfig,
  message: string
): Promise<void> {
  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });
  if (!response.ok) {
    throw new Error(`Discord webhook error: ${response.status}`);
  }
}

async function sendToChannel(
  channel: NotificationChannel,
  message: string
): Promise<NotificationResult> {
  const result: NotificationResult = {
    channelId: channel.id,
    channelType: channel.type,
    success: false,
    timestamp: new Date(),
  };

  try {
    switch (channel.type) {
      case "telegram":
        await sendTelegram(channel.config as TelegramConfig, message);
        result.success = true;
        break;
      case "slack":
        await sendSlack(channel.config as SlackConfig, message);
        result.success = true;
        break;
      case "discord":
        await sendDiscord(channel.config as DiscordConfig, message);
        result.success = true;
        break;
      case "email": {
        if (!isEmailConfigured()) {
          result.error = "SENDGRID_API_KEY not configured";
          log.warn("Notification", "Email skipped - SendGrid not configured", {
            channelId: channel.id,
          });
          break;
        }
        const emailConfig = channel.config as EmailConfig;
        const emailResult = await sendEmail({
          to: emailConfig.to,
          from: emailConfig.from,
          subject: message.substring(0, 100).replace(/<[^>]*>/g, ''),
          text: message.replace(/<[^>]*>/g, ''),
          html: message.replace(/\n/g, '<br>'),
          replyTo: emailConfig.replyTo,
        });
        if (emailResult.success) {
          result.success = true;
          log.info("Notification", "Email sent successfully", {
            channelId: channel.id,
            to: emailConfig.to.length,
          });
        } else {
          result.error = emailResult.error;
        }
        break;
      }
      default:
        result.error = `Unsupported channel type: ${channel.type}`;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  notificationHistory.unshift(result);
  if (notificationHistory.length > MAX_HISTORY) {
    notificationHistory.pop();
  }

  return result;
}

export async function sendNotification(
  eventType: string,
  data: Record<string, unknown>
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];

  for (const template of templates.values()) {
    if (!template.enabled) continue;
    if (template.eventType !== eventType && template.eventType !== "*")
      continue;

    const message = formatMessage(template.messageTemplate, {
      ...data,
      eventType,
    });

    for (const channelId of template.channels) {
      const channel = channels.get(channelId);
      if (!channel || !channel.enabled) continue;

      const result = await sendToChannel(channel, message);
      results.push(result);
    }
  }

  return results;
}

export async function sendDirectNotification(
  channelId: string,
  message: string
): Promise<NotificationResult | null> {
  const channel = channels.get(channelId);
  if (!channel) return null;
  return sendToChannel(channel, message);
}

export function getNotificationHistory(
  limit: number = 50
): NotificationResult[] {
  return notificationHistory.slice(0, limit);
}

export function getNotificationStats() {
  const total = notificationHistory.length;
  const successful = notificationHistory.filter((n) => n.success).length;
  return {
    totalChannels: channels.size,
    enabledChannels: Array.from(channels.values()).filter((c) => c.enabled)
      .length,
    totalTemplates: templates.size,
    recentNotifications: total,
    successRate: total > 0 ? successful / total : 1,
  };
}

export function createDefaultTemplates(): void {
  const defaultTemplates: NotificationTemplate[] = [
    {
      id: "trade-order-submitted",
      name: "Trade Order Submitted",
      eventType: "trade.order.submitted",
      channels: [],
      messageTemplate:
        "📊 <b>Order Submitted</b>\n{{side}} {{qty}} {{symbol}} @ ${{price}}\nOrder ID: {{orderId}}",
      enabled: true,
    },
    {
      id: "trade-order-filled",
      name: "Trade Order Filled",
      eventType: "trade.order.filled",
      channels: [],
      messageTemplate:
        "✅ <b>Order Filled</b>\n{{side}} {{qty}} {{symbol}} @ ${{price}}\nOrder ID: {{orderId}}",
      enabled: true,
    },
    {
      id: "trade-order-rejected",
      name: "Trade Order Rejected",
      eventType: "trade.order.rejected",
      channels: [],
      messageTemplate:
        "❌ <b>Order Rejected</b>\n{{side}} {{qty}} {{symbol}}\nReason: {{reason}}",
      enabled: true,
    },
    {
      id: "ai-decision",
      name: "AI Decision Generated",
      eventType: "ai.decision.generated",
      channels: [],
      messageTemplate:
        "🤖 <b>AI Decision</b>\nSymbol: {{symbol}}\nAction: {{action}}\nConfidence: {{confidence}}%\nReason: {{reasoning}}",
      enabled: true,
    },
    {
      id: "position-opened",
      name: "Position Opened",
      eventType: "trade.position.opened",
      channels: [],
      messageTemplate:
        "📈 <b>Position Opened</b>\n{{side}} {{qty}} {{symbol}} @ ${{entryPrice}}",
      enabled: true,
    },
    {
      id: "position-closed",
      name: "Position Closed",
      eventType: "trade.position.closed",
      channels: [],
      messageTemplate:
        "📉 <b>Position Closed</b>\n{{symbol}} closed\nP/L: ${{pnl}} ({{pnlPercent}}%)",
      enabled: true,
    },
  ];

  for (const template of defaultTemplates) {
    if (!templates.has(template.id)) {
      templates.set(template.id, template);
    }
  }
}

createDefaultTemplates();
