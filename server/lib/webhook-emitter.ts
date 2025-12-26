import pLimit from 'p-limit';
import { log } from "../utils/logger";

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  enabled: boolean;
  headers?: Record<string, string>;
  secret?: string;
  retryCount?: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: unknown;
}

interface DeliveryAttempt {
  webhookId: string;
  eventId: string;
  eventType: string;
  status: 'success' | 'failed' | 'pending';
  statusCode?: number;
  error?: string;
  timestamp: Date;
  durationMs: number;
}

const webhooks: Map<string, WebhookConfig> = new Map();
const deliveryHistory: DeliveryAttempt[] = [];
const MAX_HISTORY = 100;
const limit = pLimit(5);

export function registerWebhook(config: WebhookConfig): void {
  webhooks.set(config.id, config);
  log.info("Webhook", "Registered", { name: config.name, id: config.id, url: config.url });
}

export function unregisterWebhook(id: string): boolean {
  const result = webhooks.delete(id);
  if (result) {
    log.info("Webhook", "Unregistered", { id });
  }
  return result;
}

export function getWebhooks(): WebhookConfig[] {
  return Array.from(webhooks.values());
}

export function getWebhook(id: string): WebhookConfig | undefined {
  return webhooks.get(id);
}

export function updateWebhook(id: string, updates: Partial<WebhookConfig>): WebhookConfig | undefined {
  const existing = webhooks.get(id);
  if (!existing) return undefined;
  
  const updated = { ...existing, ...updates };
  webhooks.set(id, updated);
  return updated;
}

async function deliverWebhook(webhook: WebhookConfig, event: WebhookEvent): Promise<DeliveryAttempt> {
  const startTime = Date.now();
  const attempt: DeliveryAttempt = {
    webhookId: webhook.id,
    eventId: event.id,
    eventType: event.type,
    status: 'pending',
    timestamp: new Date(),
    durationMs: 0,
  };

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event.type,
      'X-Webhook-Id': event.id,
      'X-Webhook-Timestamp': event.timestamp,
      ...webhook.headers,
    };

    if (webhook.secret) {
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(event))
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(10000),
    });

    attempt.durationMs = Date.now() - startTime;
    attempt.statusCode = response.status;

    if (response.ok) {
      attempt.status = 'success';
    } else {
      attempt.status = 'failed';
      attempt.error = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (error) {
    attempt.durationMs = Date.now() - startTime;
    attempt.status = 'failed';
    attempt.error = error instanceof Error ? error.message : 'Unknown error';
  }

  deliveryHistory.push(attempt);
  if (deliveryHistory.length > MAX_HISTORY) {
    deliveryHistory.shift();
  }

  return attempt;
}

export async function emitEvent(type: string, payload: unknown): Promise<DeliveryAttempt[]> {
  const event: WebhookEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type,
    timestamp: new Date().toISOString(),
    source: 'ai-active-trader',
    payload,
  };

  const matchingWebhooks = Array.from(webhooks.values()).filter(
    (w) => w.enabled && (w.eventTypes.includes(type) || w.eventTypes.includes('*'))
  );

  if (matchingWebhooks.length === 0) {
    return [];
  }

  log.info("Webhook", "Emitting event", { type, webhookCount: matchingWebhooks.length });

  const results = await Promise.all(
    matchingWebhooks.map((webhook) => limit(() => deliverWebhook(webhook, event)))
  );

  const successes = results.filter((r) => r.status === 'success').length;
  const failures = results.filter((r) => r.status === 'failed').length;

  if (failures > 0) {
    log.warn("Webhook", "Some deliveries failed", { type, successes, failures });
  }

  return results;
}

export function getDeliveryHistory(limit?: number): DeliveryAttempt[] {
  const count = limit || MAX_HISTORY;
  return deliveryHistory.slice(-count);
}

export function getWebhookStats(): {
  totalWebhooks: number;
  enabledWebhooks: number;
  recentDeliveries: number;
  successRate: number;
} {
  const recent = deliveryHistory.slice(-50);
  const successes = recent.filter((d) => d.status === 'success').length;

  return {
    totalWebhooks: webhooks.size,
    enabledWebhooks: Array.from(webhooks.values()).filter((w) => w.enabled).length,
    recentDeliveries: recent.length,
    successRate: recent.length > 0 ? successes / recent.length : 1,
  };
}

export const SUPPORTED_EVENTS = [
  'trade.order.submitted',
  'trade.order.filled',
  'trade.order.canceled',
  'trade.order.rejected',
  'trade.position.opened',
  'trade.position.closed',
  'trade.position.updated',
  'ai.decision.generated',
  'ai.decision.executed',
  'market.data.update',
  'market.news.alert',
  'analytics.pnl.daily',
  'analytics.metrics.update',
  'system.error',
  'system.health.changed',
];
