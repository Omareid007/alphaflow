# Admin Hub Access Guide

> **How to access and use the Admin Hub interface.**

## Access Methods

### Admin Tab in Bottom Navigation (Current)

1. Log in to the application with an admin account
2. The **Admin** tab appears in the bottom navigation bar (rightmost tab)
3. Tap the **Admin** tab to access the Admin Hub
4. The Admin Hub displays a sidebar with 13 modules

**Note:** The Admin tab is conditionally rendered - only visible if `user.isAdmin === true`.

```
Home | Markets | Analytics | Strategies | Auto | Profile | [Admin]
                                                           ↑
                                                   Only visible for admins
```

The tab is rendered in `MainTabNavigator.tsx`:
```tsx
{user?.isAdmin ? (
  <Tab.Screen name="AdminTab" component={AdminStackNavigator} ... />
) : null}
```

## Admin Authentication

### Default Admin Credentials

For local development and testing:

| Field | Value |
|-------|-------|
| Username | `admintest` |
| Password | `admin1234` |

### Creating Admin Users

To create a new admin user:

1. Use the database directly:
```sql
INSERT INTO users (username, password, is_admin)
VALUES ('newadmin', 'hashed_password', true);
```

2. Or use the API (requires existing admin):
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "newadmin", "password": "securepassword", "isAdmin": true}'
```

Note: Password must be properly hashed before database insertion.

## Environment Variables

The Admin Hub requires the following environment variables for full functionality:

### Required

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session encryption key |

### Market Data Providers

| Variable | Purpose |
|----------|---------|
| `ALPACA_API_KEY` | Alpaca Paper Trading API key |
| `ALPACA_SECRET_KEY` | Alpaca Paper Trading secret |
| `FINNHUB_API_KEY` | Finnhub market data |
| `POLYGON_API_KEY` | Polygon.io market data |

### LLM Providers

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API access |
| `OPENROUTER_API_KEY` | OpenRouter API access |
| `GROQ_API_KEY` | Groq API access |
| `TOGETHER_API_KEY` | Together.ai API access |

### Optional

| Variable | Purpose | Default |
|----------|---------|---------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector | (disabled) |
| `SLACK_WEBHOOK_URL` | Alert notifications | (disabled) |

## Admin Hub Modules

The Admin Hub contains 13 specialized modules:

| Module | Purpose | Source |
|--------|---------|--------|
| **Overview** | Dashboard with connector health, data fusion, AI config | Internal |
| **Providers & Budgets** | API rate limits, budget usage, cache management | Internal |
| **LLM Router** | Model routing, fallback chains, call statistics | Internal |
| **Orders** | Broker order lifecycle, fills, sync controls | Alpaca (Broker-synced) |
| **Positions** | Live portfolio positions from broker | Alpaca (Live) |
| **Universe** | Asset universe management, tradability | Alpaca API |
| **Fundamentals** | Company fundamentals data | Finnhub |
| **Candidates** | Trading candidate approval workflow | Internal |
| **Enforcement** | Trading enforcement gate | Internal |
| **Allocation** | Portfolio allocation policies | Internal |
| **Rebalancer** | Portfolio rebalancing controls | Internal |
| **Orchestrator** | Strategy orchestration, pause/resume/run-now | Internal |
| **Observability** | Traces, work queue, alerts (4 sub-tabs) | DB (broker-synced) |

## Source of Truth Semantics

### AI Trade Intents (Analytics Screen)
- **Source Badge**: "Source: Internal AI Decisions"
- **Status**: Uses "pending" or "info" (never "success")
- **Purpose**: Shows what the AI decided to do

### Broker Orders (Orders Module)
- **Source Badge**: "Source: Alpaca (Broker-synced)"
- **Status**: Uses "success" for filled, "error" for rejected
- **Purpose**: Shows what actually happened at the broker

### Trace Timeline (Observability Module)
The Trace Timeline displays events in chronological order:
- **AI Decisions**: status = "info" (internal)
- **Trade Intents**: status = "pending" (internal)
- **Broker Orders**: status = "success/error" (broker-confirmed)
- **Fills**: status = "success" (actual execution)

## Troubleshooting

### Admin Tab Not Visible

1. Verify you're logged in with an admin account
2. Check that the user's `isAdmin` field is `true` in the database:
```sql
SELECT username, is_admin FROM users WHERE username = 'your_username';
```

### Module Not Loading Data

1. Check the server logs for API errors
2. Verify required environment variables are set
3. Use the refresh button in the top bar to reload data

### Orders Not Syncing

1. Verify Alpaca API credentials are correct
2. Check if market is open (orders only sync during market hours)
3. Use the Sync button in Orders module to trigger manual sync
4. Check work queue for failed ORDER_SYNC items in Observability module

## API Endpoints

All admin endpoints require authentication. The base path is `/api/admin/*`.

See [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) for complete endpoint reference.

## Security Notes

1. Admin endpoints are protected by `authMiddleware`
2. Only users with `isAdmin: true` can access admin functions
3. Sensitive operations (like rebalancing) require confirmation
4. All admin actions are logged with traceId for audit

---

*Last updated: December 2025*
