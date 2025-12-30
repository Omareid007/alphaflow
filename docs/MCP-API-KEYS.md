# MCP Server API Keys Guide

This document provides instructions for obtaining and configuring API keys for MCP servers that require authentication.

## Quick Reference (24 Servers)

### Core Servers (No API Key Required)
| Server | Status | Env Variable(s) | Cost |
|--------|--------|-----------------|------|
| postgres | ✅ Working | `DATABASE_URL` | - |
| sequential-thinking | ✅ Working | None | Free |
| memory | ✅ Working | None | Free |
| filesystem | ✅ Working | None | Free |
| git | ✅ Working | None | Free |
| context7 | ✅ Working | None | Free |
| ts-morph | ✅ Working | None | Free |
| playwright | ✅ Working | None | Free |
| vitest | ✅ Working | None | Free |
| openapi | ✅ Working | `OPENAPI_SPEC_PATH` (optional) | Free |
| coingecko | ✅ Working | None | Free tier |
| yfinance | ✅ Working | None | Free |
| redis | 🔑 Needs Key | `REDIS_HOST`, `REDIS_PORT` | Free (self-hosted) |

### API Key Required
| Server | Status | Env Variable(s) | Cost |
|--------|--------|-----------------|------|
| github | 🔑 Needs Key | `GITHUB_PERSONAL_ACCESS_TOKEN` | Free |
| slack | 🔑 Needs Key | `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID` | Free |
| brave-search | 🔑 Needs Key | `BRAVE_API_KEY` | Freemium |
| exa | 🔑 Needs Key | `EXA_API_KEY` | Paid |
| sendgrid | 🔑 Needs Key | `SENDGRID_API_KEY` | Freemium |
| codacy | 🔑 Needs Key | `CODACY_ACCOUNT_TOKEN` | Free tier |

### Finance-Specific (API Key Required)
| Server | Status | Env Variable(s) | Cost |
|--------|--------|-----------------|------|
| alpaca-trading | ✅ Configured | `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` | Free |
| financial-datasets | 🔑 Needs Key | `FINANCIAL_DATASETS_API_KEY` | Paid |
| alphavantage | 🔑 Needs Key | `ALPHAVANTAGE_API_KEY` | Freemium |
| polygon | 🔑 Needs Key | `POLYGON_API_KEY` | Paid |
| octagon | 🔑 Needs Key | `OCTAGON_API_KEY` | Paid |

---

## GitHub MCP Server

### Purpose
Repository operations, issues, pull requests, code search, and repository management.

### Getting API Key

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Select scopes:
   - `repo` (full control of private repositories)
   - `read:org` (read org membership)
   - `read:user` (read user profile data)
4. Click "Generate token"
5. Copy the token (starts with `ghp_`)

### Configuration

```bash
# Add to .env
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Verify

```bash
curl -H "Authorization: token $GITHUB_PERSONAL_ACCESS_TOKEN" https://api.github.com/user
```

---

## Slack MCP Server

### Purpose
Send trade alerts, notifications, and receive commands via Slack.

### Getting API Keys

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name it "AlphaFlow Trading" and select your workspace
4. Navigate to "OAuth & Permissions"
5. Add Bot Token Scopes:
   - `chat:write` - Send messages
   - `channels:read` - View channels
   - `channels:history` - Read message history
6. Click "Install to Workspace"
7. Copy the "Bot User OAuth Token" (starts with `xoxb-`)
8. Get Team ID from workspace URL or API

### Configuration

```bash
# Add to .env
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx
SLACK_TEAM_ID=T0XXXXXXXXX
```

### Verify

```bash
curl -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN"
```

---

## Brave Search MCP Server

### Purpose
Privacy-focused web search for market research and news.

### Getting API Key

1. Go to https://brave.com/search/api/
2. Click "Get Started"
3. Sign up/login
4. Select plan:
   - **Free**: 2,000 queries/month
   - **Base**: $5/month for 20,000 queries
   - **Pro**: $15/month for unlimited
5. Copy API key from dashboard

### Configuration

```bash
# Add to .env
BRAVE_API_KEY=BSAxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Verify

```bash
curl "https://api.search.brave.com/res/v1/web/search?q=test" \
  -H "X-Subscription-Token: $BRAVE_API_KEY"
```

---

## Sentry MCP Server

### Purpose
Error tracking, performance monitoring, and production debugging.

### Getting Access

1. Go to https://sentry.io
2. Create account or login
3. Create a project for "Next.js"
4. Go to Settings → API → Auth Tokens
5. Create new token with scopes:
   - `project:read`
   - `event:read`
   - `issue:read`

### Configuration

The Sentry MCP server uses OAuth flow:
```bash
# Configuration handled via mcp.sentry.dev OAuth
# No manual env vars needed - token stored securely
```

### Alternative: Direct Token

```bash
# Add to .env
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=alphaflow
```

---

## Exa MCP Server

### Purpose
AI-powered semantic web search for research and analysis.

### Getting API Key

1. Go to https://exa.ai
2. Sign up for account
3. Go to API Keys section
4. Generate new API key
5. Copy key

### Pricing
- Free tier: Limited queries
- Paid: ~$0.004 per search

### Configuration

```bash
# Add to .env
EXA_API_KEY=exa_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Verify

```bash
curl https://api.exa.ai/search \
  -H "x-api-key: $EXA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "numResults": 1}'
```

---

## Financial Datasets MCP Server

### Purpose
Income statements, balance sheets, cash flows, and stock prices.

### Getting API Key

1. Go to https://financialdatasets.ai
2. Sign up for account
3. Select plan:
   - **Starter**: $29/month
   - **Pro**: $99/month
   - **Enterprise**: Custom
4. Copy API key from dashboard

### Configuration

```bash
# Add to .env
FINANCIAL_DATASETS_API_KEY=fd_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Verify

```bash
curl "https://api.financialdatasets.ai/financial-statements/income-statements?ticker=AAPL&period=annual&limit=1" \
  -H "X-API-KEY: $FINANCIAL_DATASETS_API_KEY"
```

---

## Alpaca Trading MCP Server

### Purpose
Direct trading operations, account management, and market data.

### Getting API Keys

1. Go to https://app.alpaca.markets
2. Sign up for account (paper trading is free)
3. Navigate to API Keys section
4. Generate new API key pair
5. Copy both Key ID and Secret Key

### Configuration

```bash
# Add to .env
ALPACA_API_KEY=PKxxxxxxxxxxxxxxxxxxxx
ALPACA_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ALPACA_PAPER=true  # Use paper trading
```

### Verify

```bash
curl https://paper-api.alpaca.markets/v2/account \
  -H "APCA-API-KEY-ID: $ALPACA_API_KEY" \
  -H "APCA-API-SECRET-KEY: $ALPACA_SECRET_KEY"
```

---

## Alpha Vantage MCP Server

### Purpose
100+ financial APIs including fundamentals, forex, crypto, and technical indicators.

### Getting API Key

1. Go to https://www.alphavantage.co/support/#api-key
2. Enter email and select use case
3. Receive API key immediately
4. Free tier: 5 calls/minute, 500 calls/day

### Pricing
- **Free**: 5 calls/min, 500/day
- **Premium**: $49.99/month for 75 calls/min

### Configuration

```bash
# Add to .env
ALPHAVANTAGE_API_KEY=xxxxxxxxxxxxxxxxxxxx
```

### Verify

```bash
curl "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=$ALPHAVANTAGE_API_KEY"
```

---

## Polygon MCP Server

### Purpose
Real-time and historical market data, options, and crypto.

### Getting API Key

1. Go to https://polygon.io
2. Sign up for account
3. Select plan:
   - **Basic**: Free (5 calls/minute, delayed)
   - **Starter**: $29/month
   - **Developer**: $79/month (real-time)
   - **Advanced**: $199/month
4. Copy API key from dashboard

### Configuration

```bash
# Add to .env
POLYGON_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Verify

```bash
curl "https://api.polygon.io/v2/aggs/ticker/AAPL/prev?apiKey=$POLYGON_API_KEY"
```

---

## Context7 MCP Server (NEW)

### Purpose
Real-time library documentation lookup for any npm package.

### Configuration
No API key required. Works out of the box.

```json
{
  "context7": {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp@latest"]
  }
}
```

---

## Vitest MCP Server (NEW)

### Purpose
AI-optimized test runner with LLM-friendly output and coverage analysis.

### Configuration
No API key required. Works out of the box.

```json
{
  "vitest": {
    "command": "npx",
    "args": ["-y", "@djankies/vitest-mcp"]
  }
}
```

### Features
- Run tests with AI-friendly output
- Coverage analysis
- Log capturing
- Line-by-line coverage

---

## OpenAPI MCP Server (NEW)

### Purpose
Interact with APIs via OpenAPI specifications.

### Configuration

```json
{
  "openapi": {
    "command": "npx",
    "args": ["-y", "@ivotoby/openapi-mcp-server"],
    "env": {
      "OPENAPI_SPEC_PATH": "${OPENAPI_SPEC_PATH}"
    }
  }
}
```

### Environment Variable (Optional)
```bash
# Path to your OpenAPI spec file
OPENAPI_SPEC_PATH=/home/runner/workspace/docs/api/OPENAPI_SPEC.yaml
```

---

## SendGrid MCP Server (NEW)

### Purpose
Email notifications, trade alerts, and marketing emails.

### Getting API Key

1. Go to https://app.sendgrid.com
2. Sign up for account
3. Navigate to Settings → API Keys
4. Create new API key with "Full Access" or "Restricted Access"
5. Copy the API key (starts with `SG.`)

### Pricing
- **Free**: 100 emails/day forever
- **Essentials**: $19.95/month for 50K emails
- **Pro**: $89.95/month for 100K emails

### Configuration

```bash
# Add to .env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=alerts@yourdomain.com
```

### Verify

```bash
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"personalizations":[{"to":[{"email":"test@example.com"}]}],"from":{"email":"test@yourdomain.com"},"subject":"Test","content":[{"type":"text/plain","value":"Test"}]}'
```

---

## Codacy MCP Server (NEW)

### Purpose
Code quality metrics, coverage tracking, and security analysis.

### Getting API Key

1. Go to https://app.codacy.com
2. Sign up and add your repository
3. Navigate to Account → Access Management → API tokens
4. Generate new token
5. Copy the token

### Pricing
- **Free**: Open source projects
- **Pro**: $15/user/month

### Configuration

```bash
# Add to .env
CODACY_ACCOUNT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Verify

```bash
curl -H "api-token: $CODACY_ACCOUNT_TOKEN" \
  https://app.codacy.com/api/v3/user
```

---

## Octagon MCP Server (NEW)

### Purpose
SEC filings, financial research, and company analysis.

### Getting API Key

1. Go to https://octagon.ai
2. Sign up for account
3. Navigate to API section
4. Generate API key
5. Copy the key

### Configuration

```bash
# Add to .env
OCTAGON_API_KEY=oct_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Yahoo Finance MCP Server (NEW)

### Purpose
Free market data including stock quotes, historical prices, and company information.

### Configuration
No API key required. Works out of the box.

```json
{
  "yfinance": {
    "command": "npx",
    "args": ["-y", "@mokemokechicken/yfinance-mcp-server"]
  }
}
```

### Features
- Real-time stock quotes
- Historical price data
- Company financials
- Options data
- Market indices

---

## Redis MCP Server (NEW)

### Purpose
High-performance caching for market data, session storage, and rate limiting.

### Configuration

```json
{
  "redis": {
    "command": "npx",
    "args": ["-y", "@gongrzhe/server-redis-mcp"],
    "env": {
      "REDIS_HOST": "${REDIS_HOST:-localhost}",
      "REDIS_PORT": "${REDIS_PORT:-6379}"
    }
  }
}
```

### Environment Variables
```bash
# Add to .env (optional - defaults shown)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your-password  # If authentication required
```

### Use Cases
- Cache frequently accessed market data
- Session management
- Rate limiting counters
- Pub/sub for real-time updates
- Queue management

---

## Environment File Template

Add these to your `.env` file:

```bash
# ===========================================
# MCP Server API Keys (22 Servers)
# ===========================================

# GitHub (Repository operations)
GITHUB_PERSONAL_ACCESS_TOKEN=

# Slack (Trade alerts, notifications)
SLACK_BOT_TOKEN=
SLACK_TEAM_ID=

# Brave Search (Web search)
BRAVE_API_KEY=

# Exa (AI-powered search)
EXA_API_KEY=

# SendGrid (Email notifications) - NEW
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=

# Codacy (Code quality) - NEW
CODACY_ACCOUNT_TOKEN=

# Financial Datasets (Fundamentals)
FINANCIAL_DATASETS_API_KEY=

# Alpha Vantage (Technical data)
ALPHAVANTAGE_API_KEY=

# Polygon (Real-time market data)
POLYGON_API_KEY=

# Octagon (SEC filings) - NEW
OCTAGON_API_KEY=

# OpenAPI (Optional spec path) - NEW
OPENAPI_SPEC_PATH=

# Alpaca (Already configured)
# ALPACA_API_KEY=
# ALPACA_SECRET_KEY=
# ALPACA_PAPER=true

# Redis (optional - defaults shown)
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Verifying MCP Server Status

Run the following to check which MCP servers are working:

```bash
# In Claude Code, use:
/mcp

# Or check the MCP configuration:
cat .mcp.json | jq '.mcpServers | keys'
```

## Troubleshooting

### Common Issues

1. **"API key invalid"** - Check for extra whitespace when copying
2. **"Rate limited"** - Upgrade plan or implement caching
3. **"Connection refused"** - Check firewall/network settings
4. **"Server not starting"** - Verify npm package is installed

### Debug Mode

Enable debug logging:
```bash
export DEBUG=mcp:*
```

### Reset MCP Configuration

```bash
# Restart MCP servers
pkill -f "mcp"
```
