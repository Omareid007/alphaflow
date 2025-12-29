# Admin Operations Flow

Complete documentation of admin operations in AlphaFlow Trading Platform.

## Overview

Admin operations are restricted to users with `isAdmin: true` and provide system configuration, monitoring, and control capabilities.

| Attribute | Value |
|-----------|-------|
| **Purpose** | Configure and monitor platform operations |
| **Trigger** | Admin navigation to /admin/* routes |
| **Actor** | Admin user only |
| **Frequency** | As needed for configuration/monitoring |

## Entry Conditions

- [ ] User is authenticated
- [ ] User has admin role (`isAdmin: true`)
- [ ] System is operational

---

## Admin Flows

### Flow 1: LLM Provider Management

**Purpose:** Configure and manage AI/LLM providers for the platform.

```
[Navigate /admin/providers]
         |
         v
   [List Providers]
         |
    +----+----+----+
    |    |    |    |
    v    v    v    v
[Add] [Edit] [Test] [Delete]
```

#### Add Provider Steps

| Step | Action | System Response |
|------|--------|-----------------|
| 1 | Click "Add Provider" | Open provider form |
| 2 | Select provider type | Load type-specific fields |
| 3 | Enter credentials | Validate format |
| 4 | Configure limits | Set rate/budget limits |
| 5 | Test connection | Verify API key works |
| 6 | Save | Create provider record |

#### Provider Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Display name |
| type | enum | Yes | openai, anthropic, groq, etc. |
| apiKey | string | Yes | API credentials |
| baseUrl | string | No | Custom endpoint |
| rateLimit | number | No | Requests per minute |
| budgetLimit | number | No | Monthly $ limit |
| priority | number | Yes | Fallback order |
| enabled | boolean | Yes | Active status |

#### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/admin/providers | List all providers |
| POST | /api/admin/providers | Add provider |
| PUT | /api/admin/providers/:id | Update provider |
| DELETE | /api/admin/providers/:id | Remove provider |
| POST | /api/admin/providers/:id/test | Test connectivity |

---

### Flow 2: Orchestrator Control

**Purpose:** Manage autonomous trading jobs and emergency controls.

```
[Navigate /admin/orchestrator]
         |
         v
   [View Dashboard]
         |
    +----+----+----+----+
    |    |    |    |    |
    v    v    v    v    v
[Jobs] [Trigger] [Config] [Kill] [Logs]
```

#### Orchestrator Actions

| Action | Purpose | Confirmation Required |
|--------|---------|----------------------|
| View Jobs | See scheduled/running jobs | No |
| Trigger Job | Manually start a job | Yes |
| Edit Config | Change schedule/params | Yes |
| Kill Switch | Emergency stop all trading | Yes (double) |
| View Logs | See execution logs | No |

#### Kill Switch Flow

```
[Click "Kill Switch"]
         |
         v
[First Confirmation Dialog]
"Are you sure? This will stop all autonomous trading."
         |
         v
[Second Confirmation]
"Type 'STOP' to confirm"
         |
         v
[POST /api/admin/orchestrator/kill-switch]
         |
         v
[All Jobs Stopped]
         |
         v
[Notification Sent]
```

#### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/admin/orchestrator/jobs | List jobs |
| POST | /api/admin/orchestrator/trigger | Manual trigger |
| GET | /api/admin/orchestrator/config | Get config |
| PUT | /api/admin/orchestrator/config | Update config |
| POST | /api/admin/orchestrator/kill-switch | Emergency stop |

---

### Flow 3: Trading Universe Management

**Purpose:** Configure which symbols are available for trading.

```
[Navigate /admin/universe]
         |
         v
   [View Universe]
         |
    +----+----+----+
    |    |    |    |
    v    v    v    v
[Add] [Remove] [Import] [Filter]
```

#### Universe Configuration

| Category | Examples | Filter |
|----------|----------|--------|
| Stocks | AAPL, MSFT, GOOGL | Market cap, volume |
| ETFs | SPY, QQQ, IWM | Category, expense |
| Crypto | BTC/USD, ETH/USD | Volume, market cap |
| Sector | Technology, Healthcare | GICS sector |

#### Tradability Checks

| Check | Criteria | Action if Fail |
|-------|----------|----------------|
| Liquidity | Volume > 100K | Exclude |
| Price | > $1 | Flag as penny |
| Status | Not halted | Exclude |
| Margin | Marginable | Flag if not |

---

### Flow 4: User Management

**Purpose:** Manage platform users and permissions.

```
[Navigate /admin/users]
         |
         v
   [List Users]
         |
    +----+----+----+----+
    |    |    |    |    |
    v    v    v    v    v
[Add] [Edit] [Disable] [Delete] [Reset PW]
```

#### User Actions

| Action | Purpose | Permission |
|--------|---------|------------|
| Add User | Create new account | Admin only |
| Edit User | Update profile/role | Admin only |
| Disable | Suspend access | Admin only |
| Delete | Remove user | Admin only |
| Reset Password | Force password change | Admin only |

#### User Model

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  isEnabled: boolean;
  createdAt: Date;
  lastLogin: Date;
  alpacaConnected: boolean;
}
```

---

### Flow 5: System Observability

**Purpose:** Monitor system health and performance.

```
[Navigate /admin/observability]
         |
         v
   [Dashboard]
         |
    +----+----+----+----+
    |    |    |    |    |
    v    v    v    v    v
[Metrics] [Logs] [Alerts] [Traces] [Health]
```

#### Monitored Metrics

| Category | Metrics |
|----------|---------|
| API | Request rate, latency, error rate |
| Trading | Order success rate, fill latency |
| AI | Token usage, response time, cost |
| Database | Query time, connections |
| External | Alpaca API health, data feeds |

---

## Admin Pages Inventory

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | /admin | Overview and quick actions |
| Providers | /admin/providers | LLM provider management |
| LLM Router | /admin/llm-router | Routing configuration |
| Orchestrator | /admin/orchestrator | Job management |
| AI Arena | /admin/ai-arena | Model comparison |
| Candidates | /admin/candidates | Strategy candidates |
| Allocation | /admin/allocation | Portfolio allocation |
| Competition | /admin/competition | Strategy competition |
| Enforcement | /admin/enforcement | Risk enforcement |
| Fundamentals | /admin/fundamentals | Fundamental analysis |
| Observability | /admin/observability | System monitoring |
| Orders | /admin/orders | Order management |
| Positions | /admin/positions | Position overview |
| Rebalancer | /admin/rebalancer | Rebalancing config |
| Strategies | /admin/strategies | Strategy admin |
| Universe | /admin/universe | Trading universe |
| Users | /admin/users | User management |

## Access Control

```typescript
// Auth check in admin routes
const AdminGuard = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (!user?.isAdmin) return <Redirect to="/home" />;

  return children;
};
```

## Audit Logging

All admin actions are logged:

```typescript
interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes: object;
  ipAddress: string;
  timestamp: Date;
}
```

## Error Handling

| Error | Behavior |
|-------|----------|
| Not admin | Redirect to /home |
| Session expired | Redirect to /login |
| Permission denied | Show 403 message |
| Action failed | Show error toast |

## Confirmation Dialogs

Destructive actions require confirmation:

| Action | Confirmation Type |
|--------|-------------------|
| Delete provider | Single confirm |
| Delete user | Single confirm |
| Kill switch | Double confirm with text input |
| Clear cache | Single confirm |
| Reset circuit breaker | Single confirm |
