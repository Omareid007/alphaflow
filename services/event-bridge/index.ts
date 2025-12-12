import http from 'http';

const PORT = process.env.PORT || 3006;
const SERVICE_NAME = process.env.SERVICE_NAME || 'event-bridge';
const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE || 'http://localhost:5678/webhook';
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';

interface EventMapping {
  eventType: string;
  webhookPath: string;
  description: string;
}

const EVENT_MAPPINGS: EventMapping[] = [
  { eventType: 'trade.order.filled', webhookPath: '/trade-filled', description: 'Order fill notifications' },
  { eventType: 'trade.order.submitted', webhookPath: '/trade-submitted', description: 'Order submission alerts' },
  { eventType: 'trade.order.canceled', webhookPath: '/trade-canceled', description: 'Order cancellation alerts' },
  { eventType: 'trade.position.updated', webhookPath: '/position-updated', description: 'Position change alerts' },
  { eventType: 'ai.decision.generated', webhookPath: '/ai-decision', description: 'AI trading signals' },
  { eventType: 'ai.decision.validated', webhookPath: '/ai-validated', description: 'Validated AI decisions' },
  { eventType: 'analytics.pnl.calculated', webhookPath: '/pnl-update', description: 'P&L updates' },
  { eventType: 'analytics.metrics.snapshot', webhookPath: '/daily-metrics', description: 'Daily metrics snapshots' },
  { eventType: 'market.news.published', webhookPath: '/news-alert', description: 'Market news alerts' },
  { eventType: 'orchestrator.cycle.completed', webhookPath: '/cycle-complete', description: 'Trading cycle completion' },
  { eventType: 'system.error.occurred', webhookPath: '/system-error', description: 'System error alerts' },
];

interface WebhookConfig {
  url: string;
  enabled: boolean;
  headers?: Record<string, string>;
}

interface NotificationChannel {
  type: 'telegram' | 'slack' | 'webhook' | 'email';
  config: Record<string, string>;
  eventTypes: string[];
  enabled: boolean;
}

const state = {
  eventsForwarded: 0,
  lastEventTime: null as Date | null,
  errors: 0,
  channels: [] as NotificationChannel[],
};

async function forwardToWebhook(webhookUrl: string, event: unknown): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    
    if (response.ok) {
      state.eventsForwarded++;
      state.lastEventTime = new Date();
      return true;
    }
    
    console.error(`[${SERVICE_NAME}] Webhook failed: ${response.status}`);
    state.errors++;
    return false;
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Webhook error:`, error);
    state.errors++;
    return false;
  }
}

async function sendTelegramMessage(botToken: string, chatId: string, message: string): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
    return response.ok;
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Telegram error:`, error);
    return false;
  }
}

async function sendSlackMessage(webhookUrl: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
    return response.ok;
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Slack error:`, error);
    return false;
  }
}

function formatTradeMessage(event: any): string {
  const p = event.payload || event;
  return `<b>Trade Executed</b>
Symbol: ${p.symbol}
Side: ${p.side?.toUpperCase()}
Qty: ${p.quantity || p.filledQuantity}
Price: $${p.price || p.averagePrice}
${p.pnl ? `P&L: $${p.pnl}` : ''}`;
}

function formatAIDecisionMessage(event: any): string {
  const p = event.payload || event;
  return `<b>AI Signal</b>
Symbol: ${p.symbol}
Action: ${p.action}
Confidence: ${(p.confidence * 100).toFixed(1)}%
${p.reasoning ? `Reason: ${p.reasoning}` : ''}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: SERVICE_NAME,
      stats: {
        eventsForwarded: state.eventsForwarded,
        lastEventTime: state.lastEventTime,
        errors: state.errors,
        channelsActive: state.channels.filter(c => c.enabled).length,
      },
      mappings: EVENT_MAPPINGS.length,
    }));
    return;
  }
  
  if (url.pathname === '/mappings') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ mappings: EVENT_MAPPINGS }));
    return;
  }
  
  if (url.pathname === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state));
    return;
  }
  
  if (req.method === 'POST' && url.pathname === '/forward') {
    let body = '';
    for await (const chunk of req) { body += chunk; }
    
    try {
      const { eventType, event, webhookUrl } = JSON.parse(body);
      const success = await forwardToWebhook(webhookUrl || `${N8N_WEBHOOK_BASE}/${eventType}`, event);
      res.writeHead(success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
    return;
  }
  
  if (req.method === 'POST' && url.pathname === '/notify/telegram') {
    let body = '';
    for await (const chunk of req) { body += chunk; }
    
    try {
      const { botToken, chatId, message, event, eventType } = JSON.parse(body);
      let text = message;
      if (!text && event) {
        if (eventType?.includes('trade.order')) {
          text = formatTradeMessage(event);
        } else if (eventType?.includes('ai.decision')) {
          text = formatAIDecisionMessage(event);
        } else {
          text = JSON.stringify(event, null, 2);
        }
      }
      const success = await sendTelegramMessage(botToken, chatId, text);
      res.writeHead(success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
    return;
  }
  
  if (req.method === 'POST' && url.pathname === '/notify/slack') {
    let body = '';
    for await (const chunk of req) { body += chunk; }
    
    try {
      const { webhookUrl, message, event, eventType } = JSON.parse(body);
      let text = message;
      if (!text && event) {
        if (eventType?.includes('trade.order')) {
          const p = event.payload || event;
          text = `*Trade Executed*\nSymbol: ${p.symbol} | Side: ${p.side} | Qty: ${p.quantity} | Price: $${p.price}`;
        } else if (eventType?.includes('ai.decision')) {
          const p = event.payload || event;
          text = `*AI Signal*\nSymbol: ${p.symbol} | Action: ${p.action} | Confidence: ${(p.confidence * 100).toFixed(1)}%`;
        } else {
          text = '```' + JSON.stringify(event, null, 2) + '```';
        }
      }
      const success = await sendSlackMessage(webhookUrl, text);
      res.writeHead(success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
    return;
  }
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ service: SERVICE_NAME, message: 'Event Bridge - NATS to Webhook adapter' }));
});

server.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] Running on port ${PORT}`);
  console.log(`[${SERVICE_NAME}] n8n webhook base: ${N8N_WEBHOOK_BASE}`);
  console.log(`[${SERVICE_NAME}] Event mappings: ${EVENT_MAPPINGS.length}`);
});
