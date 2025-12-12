# n8n Workflow Automation Integration Guide

> **Purpose:** Integrate n8n community workflows for trade alerts, data pipelines, AI orchestration, and backtesting automation with the AI Active Trader platform.

---

## Overview

n8n provides 177+ trading automation workflows that can extend our platform's capabilities:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI ACTIVE TRADER                                   │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Trading   │  │     AI      │  │   Market    │  │  Analytics  │       │
│  │   Engine    │  │  Decision   │  │    Data     │  │   Service   │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                │                │                │               │
│         └────────────────┴────────────────┴────────────────┘               │
│                                   │                                         │
│                    ┌──────────────▼──────────────┐                         │
│                    │     EVENT BUS (NATS)        │                         │
│                    └──────────────┬──────────────┘                         │
│                                   │                                         │
│                    ┌──────────────▼──────────────┐                         │
│                    │    n8n EVENT BRIDGE         │                         │
│                    │  (Webhook ↔ Event Adapter)  │                         │
│                    └──────────────┬──────────────┘                         │
│                                   │                                         │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │           n8n HUB             │
                    ├───────────────────────────────┤
                    │                               │
                    │  ┌─────────────────────────┐ │
                    │  │     TRADE ALERTS        │ │
                    │  │  • Telegram Bot         │ │
                    │  │  • Slack Notifications  │ │
                    │  │  • Email Summaries      │ │
                    │  │  • SMS Alerts           │ │
                    │  └─────────────────────────┘ │
                    │                               │
                    │  ┌─────────────────────────┐ │
                    │  │     DATA PIPELINES      │ │
                    │  │  • Google Sheets Sync   │ │
                    │  │  • Notion Database      │ │
                    │  │  • Airtable Tracking    │ │
                    │  │  • CSV Exports          │ │
                    │  └─────────────────────────┘ │
                    │                               │
                    │  ┌─────────────────────────┐ │
                    │  │     AI WORKFLOWS        │ │
                    │  │  • Multi-Agent Analysis │ │
                    │  │  • ICT Strategy Bot     │ │
                    │  │  • Sentiment Analysis   │ │
                    │  │  • Report Generation    │ │
                    │  └─────────────────────────┘ │
                    │                               │
                    │  ┌─────────────────────────┐ │
                    │  │     BACKTESTING         │ │
                    │  │  • Strategy Triggers    │ │
                    │  │  • Performance Reports  │ │
                    │  │  • Parameter Sweeps     │ │
                    │  └─────────────────────────┘ │
                    │                               │
                    └───────────────────────────────┘
```

---

## Recommended Workflows

### 1. Trade Alert Workflows

#### Telegram Trade Notifications
**Source:** [n8n.io/workflows/5711](https://n8n.io/workflows/5711)

```yaml
trigger: trade.order.filled
actions:
  - format_message:
      template: |
        📈 Trade Executed
        Symbol: {{symbol}}
        Side: {{side}}
        Qty: {{quantity}}
        Price: ${{price}}
        P&L: {{pnl}}
  - send_telegram:
      bot_token: ${TELEGRAM_BOT_TOKEN}
      chat_id: ${TELEGRAM_CHAT_ID}
```

#### Multi-Channel Alerts
**Source:** Custom Integration

```yaml
trigger: ai.decision.generated
conditions:
  - confidence >= 0.8
  - action != "HOLD"
actions:
  - send_slack:
      channel: "#trading-signals"
      message: "High confidence {{action}} signal for {{symbol}}"
  - send_email:
      to: "trader@example.com"
      subject: "AI Trading Signal: {{symbol}}"
  - log_to_sheets:
      spreadsheet_id: ${GSHEET_ID}
      row: [timestamp, symbol, action, confidence]
```

### 2. Data Pipeline Workflows

#### Google Sheets Trade Log
**Source:** [n8n.io/workflows/7240](https://n8n.io/workflows/7240)

```typescript
// Event: trade.order.filled
interface TradeLogEntry {
  timestamp: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fees: number;
  strategy: string;
  aiConfidence: number;
  pnl: number;
}

// n8n Workflow Configuration
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "trade-log",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Google Sheets",
      "type": "n8n-nodes-base.googleSheets",
      "parameters": {
        "operation": "append",
        "sheetId": "{{$env.GSHEET_ID}}",
        "range": "Trades!A:J"
      }
    }
  ]
}
```

#### Notion Portfolio Tracker
**Source:** Custom Integration

```yaml
trigger: analytics.metrics.snapshot
schedule: "0 16 * * 1-5"  # 4 PM EST weekdays
actions:
  - fetch_positions: {}
  - update_notion_database:
      database_id: ${NOTION_DB_ID}
      properties:
        Date: "{{date}}"
        Equity: "{{totalEquity}}"
        Day P&L: "{{dayPnl}}"
        Win Rate: "{{winRate}}"
        Sharpe: "{{sharpeRatio}}"
```

### 3. AI Workflow Automation

#### Multi-Agent Trading Analysis
**Source:** [n8n.io/workflows/8569](https://n8n.io/workflows/8569)

```yaml
trigger: market.analysis.requested
workflow:
  # Parallel agent analysis
  - parallel:
      - valuation_agent:
          prompt: "Analyze intrinsic value of {{symbol}}"
          model: gpt-4o
      - sentiment_agent:
          prompt: "Analyze market sentiment for {{symbol}}"
          model: gpt-4o
      - technical_agent:
          prompt: "Analyze technical indicators for {{symbol}}"
          model: gpt-4o
      - macro_agent:
          prompt: "Analyze macroeconomic factors affecting {{symbol}}"
          model: gpt-4o
  
  # Risk assessment
  - risk_manager:
      input: "{{parallel.results}}"
      rules:
        - max_position_size: 0.05
        - stop_loss_required: true
        - confidence_threshold: 0.7
  
  # Final decision
  - portfolio_manager:
      input: "{{risk_manager.output}}"
      output: "ai.decision.generated"
```

#### ICT Crypto Strategy Bot
**Source:** [n8n.io/workflows/8453](https://n8n.io/workflows/8453)

```yaml
trigger: schedule
cron: "0 * * * *"  # Every hour
workflow:
  - detect_kill_zone:
      zones:
        - name: "Asian"
          start: "19:00"
          end: "02:00"
        - name: "London"
          start: "02:00"
          end: "07:00"
        - name: "New York"
          start: "07:00"
          end: "12:00"
  
  - analyze_ict_patterns:
      patterns:
        - market_structure_break
        - liquidity_grab
        - order_block
        - fair_value_gap
  
  - gpt4_validation:
      prompt: |
        Analyze this ICT setup for {{symbol}}:
        Pattern: {{pattern}}
        Confidence: {{confidence}}
        Should we enter this trade?
  
  - execute_if_valid:
      confidence_threshold: 0.75
      action: "ai.decision.generated"
```

### 4. Backtesting Automation

#### Strategy Parameter Sweep
```yaml
trigger: webhook
path: /backtest/start
workflow:
  - generate_parameters:
      strategy: "MovingAverageCrossover"
      ranges:
        fast_period: [5, 10, 15, 20]
        slow_period: [20, 30, 50, 100]
        stop_loss: [0.02, 0.03, 0.05]
  
  - run_backtests:
      parallel: true
      max_concurrent: 10
      endpoint: "${API_URL}/api/backtest/run"
  
  - aggregate_results:
      metrics: ["sharpe", "max_drawdown", "win_rate"]
  
  - send_report:
      to: "trader@example.com"
      format: "html"
      include_charts: true
```

---

## Setup Guide

### 1. Install n8n

```bash
# Docker (recommended for production)
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD} \
  n8nio/n8n

# Or npm (development)
npm install -g n8n
n8n start
```

### 2. Configure Event Bridge

Create an Event Bridge service that subscribes to NATS events and triggers n8n webhooks:

```typescript
// services/event-bridge/src/index.ts
import { connect, StringCodec } from 'nats';
import axios from 'axios';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE || 'http://localhost:5678/webhook';

interface EventMapping {
  eventType: string;
  webhookPath: string;
}

const EVENT_MAPPINGS: EventMapping[] = [
  { eventType: 'trade.order.filled', webhookPath: '/trade-filled' },
  { eventType: 'ai.decision.generated', webhookPath: '/ai-decision' },
  { eventType: 'analytics.metrics.snapshot', webhookPath: '/daily-metrics' },
  { eventType: 'market.news.published', webhookPath: '/news-alert' },
];

async function main() {
  const nc = await connect({ servers: process.env.NATS_URL });
  const sc = StringCodec();

  for (const mapping of EVENT_MAPPINGS) {
    const sub = nc.subscribe(`ai-trader.${mapping.eventType}`);
    
    (async () => {
      for await (const msg of sub) {
        const event = JSON.parse(sc.decode(msg.data));
        try {
          await axios.post(`${N8N_WEBHOOK_BASE}${mapping.webhookPath}`, event);
          console.log(`Forwarded ${mapping.eventType} to n8n`);
        } catch (error) {
          console.error(`Failed to forward ${mapping.eventType}:`, error.message);
        }
      }
    })();
  }
}

main().catch(console.error);
```

### 3. Import Community Workflows

1. **Download workflow JSON** from n8n.io
2. **Import in n8n UI:** Settings → Import Workflow
3. **Configure credentials:**
   - OpenAI API Key
   - Alpaca API Key/Secret
   - Telegram Bot Token (if using alerts)
   - Google Sheets API credentials
4. **Update webhook URLs** to match your Event Bridge
5. **Activate workflow**

### 4. Environment Variables

```bash
# n8n Configuration
N8N_WEBHOOK_BASE=http://localhost:5678/webhook
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=secure_password

# Notification Channels
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx

# Data Pipelines
GSHEET_ID=your_spreadsheet_id
NOTION_API_KEY=your_notion_key
NOTION_DB_ID=your_database_id
AIRTABLE_API_KEY=your_airtable_key
AIRTABLE_BASE_ID=your_base_id

# AI Services
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_groq_key
```

---

## Workflow Templates

### Template 1: Complete Trade Alert System

```json
{
  "name": "Trade Alert System",
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "trade-filled",
        "httpMethod": "POST",
        "responseMode": "onReceived"
      },
      "position": [250, 300]
    },
    {
      "name": "Format Message",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "values": {
          "string": [
            {
              "name": "message",
              "value": "=📈 Trade Executed\\n\\nSymbol: {{$json.payload.symbol}}\\nSide: {{$json.payload.side}}\\nQty: {{$json.payload.quantity}}\\nPrice: ${{$json.payload.price}}\\nP&L: {{$json.payload.pnl}}"
            }
          ]
        }
      },
      "position": [450, 300]
    },
    {
      "name": "Telegram",
      "type": "n8n-nodes-base.telegram",
      "parameters": {
        "operation": "sendMessage",
        "chatId": "={{$env.TELEGRAM_CHAT_ID}}",
        "text": "={{$json.message}}"
      },
      "position": [650, 200]
    },
    {
      "name": "Slack",
      "type": "n8n-nodes-base.slack",
      "parameters": {
        "channel": "#trading-alerts",
        "text": "={{$json.message}}"
      },
      "position": [650, 400]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{ "node": "Format Message", "type": "main", "index": 0 }]]
    },
    "Format Message": {
      "main": [
        [
          { "node": "Telegram", "type": "main", "index": 0 },
          { "node": "Slack", "type": "main", "index": 0 }
        ]
      ]
    }
  }
}
```

### Template 2: Daily Performance Report

```json
{
  "name": "Daily Performance Report",
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": {
          "interval": [{ "field": "cronExpression", "expression": "0 16 * * 1-5" }]
        }
      },
      "position": [250, 300]
    },
    {
      "name": "Fetch Analytics",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "={{$env.API_URL}}/api/analytics/summary",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth"
      },
      "position": [450, 300]
    },
    {
      "name": "Generate Report",
      "type": "n8n-nodes-base.openAi",
      "parameters": {
        "operation": "text",
        "prompt": "=Generate a concise daily trading report based on this data: {{JSON.stringify($json)}}"
      },
      "position": [650, 300]
    },
    {
      "name": "Send Email",
      "type": "n8n-nodes-base.emailSend",
      "parameters": {
        "toEmail": "={{$env.TRADER_EMAIL}}",
        "subject": "Daily Trading Report - {{$today.format('YYYY-MM-DD')}}",
        "text": "={{$json.text}}"
      },
      "position": [850, 300]
    }
  ]
}
```

---

## Security Considerations

1. **Webhook Authentication:** Use webhook signatures or API keys
2. **Credential Storage:** Use n8n's encrypted credential storage
3. **Network Isolation:** Run n8n in same network as services
4. **Rate Limiting:** Implement rate limiting on Event Bridge
5. **Audit Logging:** Log all webhook triggers and responses

---

## Monitoring

### Health Check Endpoint

```typescript
// Event Bridge health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    nats: natsClient.isClosed() ? 'disconnected' : 'connected',
    n8n: await checkN8nHealth(),
    lastEventTime: lastEventTimestamp,
    eventsForwarded: eventCounter
  });
});
```

### Metrics to Track

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Events Forwarded | Total events sent to n8n | - |
| Forward Latency | Time to forward event | >500ms |
| Forward Errors | Failed webhook calls | >5/min |
| n8n Queue Depth | Pending workflow executions | >100 |

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Webhook timeout | n8n overloaded | Scale n8n workers |
| Duplicate events | Retry logic | Add idempotency checks |
| Missing events | NATS subscription lost | Auto-reconnect logic |
| Credential errors | Expired tokens | Rotate credentials |

### Debug Mode

```bash
# Enable n8n debug logging
N8N_LOG_LEVEL=debug n8n start

# Monitor Event Bridge
DEBUG=event-bridge:* node dist/index.js
```
