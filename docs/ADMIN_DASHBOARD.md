# Admin Dashboard (Admin Hub)

> **Canonical document for the consolidated Admin Hub interface.**

## Overview

The Admin Hub is a WordPress-style consolidated admin panel that provides a unified interface for managing all aspects of the AI Active Trader system. It features a collapsible sidebar navigation with 11 specialized modules.

## Access

- **Tab**: Admin tab in the bottom navigation
- **Screen**: `AdminHubScreen.tsx`

## Module Overview

| Module | Icon | Purpose | Key Endpoints |
|--------|------|---------|---------------|
| **Overview** | home | Dashboard summary with connector health, data fusion, AI config, API keys | `/api/admin/connectors-health`, `/api/admin/data-fusion-status`, `/api/admin/ai-config`, `/api/admin/api-keys-status` |
| **Providers & Budgets** | activity | API rate limits, budget usage, cache TTL, provider enable/disable | `/api/admin/provider-status`, `/api/admin/valyu-budget`, `PATCH /api/admin/provider/:provider/toggle` |
| **LLM Router** | git-branch | Model routing configs, fallback chains, call statistics, cost tracking | `/api/admin/model-router/configs`, `/api/admin/model-router/stats`, `/api/admin/model-router/calls` |
| **Orders** | file-text | Broker order lifecycle, fills, sync controls | `/api/orders`, `/api/orders/:id`, `/api/fills`, `POST /api/orders/sync` |
| **Universe** | globe | Asset universe management, tradable filtering, refresh from Alpaca | `/api/admin/universe/stats`, `/api/admin/universe/assets`, `POST /api/admin/universe/refresh` |
| **Fundamentals** | bar-chart-2 | Fundamental data fetch, top scores, symbol detail view | `/api/admin/fundamentals/stats`, `/api/admin/fundamentals/top/scores`, `POST /api/admin/fundamentals/fetch` |
| **Candidates** | users | Trading candidate generation, approval/rejection workflow | `/api/admin/candidates/stats`, `/api/admin/candidates`, `POST /api/admin/candidates/generate`, `POST /api/admin/candidates/:symbol/approve` |
| **Enforcement** | shield | Enforcement gate stats, symbol allow/block checking | `/api/admin/enforcement/stats`, `POST /api/admin/enforcement/check` |
| **Allocation** | pie-chart | Allocation policies, active policy, allocation runs, drift analysis | `/api/admin/allocation/stats`, `/api/admin/allocation/policies`, `POST /api/admin/allocation/analyze` |
| **Rebalancer** | refresh-cw | Portfolio rebalancing dry-run, execution, profit-taking analysis | `/api/admin/rebalancer/stats`, `POST /api/admin/rebalancer/dry-run`, `POST /api/admin/rebalancer/execute` |
| **Observability** | search | TraceId explorer, work queue health, dead letter management | `/api/admin/trace/:traceId`, `/api/admin/work-items`, `POST /api/admin/work-items/retry` |

## Module Details

### 1. Overview Module

Dashboard landing page showing:
- **Connector Health**: Status of all configured data connectors (Alpaca, Finnhub, etc.)
- **Data Fusion Engine**: Intelligence score, active sources count, capabilities
- **AI Configuration**: Auto-execute trades toggle, conservative mode toggle
- **API Keys Summary**: Count of configured vs missing API keys

### 2. Providers & Budgets Module

Rate limit and budget management:
- **Valyu Retrieval Budgets**: Web, Finance, Proprietary tier usage
- **Per-Provider Cards**: Enable/disable, budget usage bar, remaining calls, cache TTL
- **Force Refresh**: Manually refresh provider cache

### 3. LLM Router Module

AI model routing configuration:
- **Active Providers**: List of available LLM providers
- **Call Statistics**: Total calls, total cost, by-provider breakdown with success rates
- **Role Configurations**: Fallback chains for each agent role (News Summarizer, Technical Analyst, etc.)
- **Recent Calls**: Last 10 LLM calls with latency and cost

### 4. Orders Module

Broker order lifecycle management (see [ORDER_LIFECYCLE.md](ORDER_LIFECYCLE.md) for details):
- **Order Lifecycle Card**: Description and Sync button
- **Status Filters**: All, New, Filled, Partially Filled, Canceled, Rejected
- **Order Ledger**: List of orders with expandable rows
- **Expandable Details**: Broker Order ID, Trace ID, Decision ID, Fills
- **Real-time Updates**: 15-second auto-refresh polling

### 5. Universe Module

Asset universe management:
- **Universe Stats**: Total assets, tradable count, excluded count
- **Refresh Universe**: Pull latest assets from Alpaca
- **Search & Filter**: Filter by all/tradable/excluded, search by symbol
- **Asset List**: View assets, exclude symbols, see detail

### 6. Fundamentals Module

Fundamental data management:
- **Stats**: Total symbols with fundamentals, average score, last updated
- **Fetch Fundamentals**: Bulk fetch for comma-separated symbols
- **Top Scores**: Ranked list of symbols by fundamental score
- **Symbol Detail**: Deep dive into individual symbol fundamentals

### 7. Candidates Module

Trading candidate workflow:
- **Stats**: Total candidates, approved/pending/rejected counts
- **Generate Candidates**: Create new candidates based on liquidity and score thresholds
- **Filter by Status**: All/Pending/Approved/Rejected
- **Approval Actions**: Approve or reject pending candidates
- **Approved List**: View all approved candidates as chips

### 8. Enforcement Module

Enforcement gate management:
- **About Card**: Explanation of enforcement gate purpose
- **Stats**: Total checks, allowed count, blocked count
- **Reset Stats**: Clear enforcement statistics
- **Check Symbol(s)**: Test if symbols would be allowed or blocked

### 9. Allocation Module

Portfolio allocation policies:
- **Stats**: Total policies, total runs
- **Analyze Allocation**: Run drift analysis
- **Active Policy**: Currently active allocation policy
- **Policies List**: All policies with activate button
- **Recent Runs**: History of allocation runs

### 10. Rebalancer Module

Portfolio rebalancing:
- **Stats**: Total runs, last run date
- **Dry Run**: Preview rebalancing trades without execution
- **Execute Rebalance**: Actually execute trades (with warning)
- **Profit Taking Analysis**: Identify profit-taking opportunities

### 11. Observability Module

System observability and debugging:
- **TraceId Explorer**: Search for traces by ID, view AI decisions, trades, LLM calls, work items
- **Work Queue Health**: Pending/Running/Succeeded/Failed/Dead Letter counts
- **Dead Letters & Failed Items**: View and retry failed work items
- **Recent Work Items**: Last 15 work items with status

## UI/UX Design

### Layout

- **Top Bar**: Menu toggle, current module title, refresh button
- **Sidebar**: Collapsible navigation (220px expanded, 60px collapsed)
- **Main Content**: Scrollable module content with pull-to-refresh

### Design Patterns

- **Cards**: All content organized in cards with consistent styling
- **Status Dots**: 8px colored dots for status indication
- **Progress Bars**: Visual budget/usage representation
- **Action Buttons**: Primary (blue), success (green), warning (yellow), danger (red)
- **Chips**: Tag-style display for providers and approved candidates
- **Stats Row**: Centered stat items with value and label

### Color Coding

| Color | Usage |
|-------|-------|
| `BrandColors.success` (#10B981) | Healthy, allowed, approved, success |
| `BrandColors.warning` (#F59E0B) | Warning, pending, high usage |
| `BrandColors.error` (#EF4444) | Error, blocked, rejected, failed |
| `BrandColors.primaryLight` (#3E92CC) | Primary actions, active states |
| `BrandColors.neutral` (#6B7280) | Disabled, inactive |

## Backend Endpoint Reference

See [API_REFERENCE.md](API_REFERENCE.md) for complete endpoint documentation.

### Admin Endpoints Used

```
GET  /api/admin/connectors-health
GET  /api/admin/data-fusion-status
GET  /api/admin/ai-config
PUT  /api/admin/ai-config
GET  /api/admin/api-keys-status
GET  /api/admin/provider-status
GET  /api/admin/valyu-budget
PATCH /api/admin/provider/:provider/toggle
POST /api/admin/provider/:provider/force-refresh
GET  /api/admin/model-router/configs
GET  /api/admin/model-router/stats
GET  /api/admin/model-router/calls
GET  /api/orders
GET  /api/orders/:id
GET  /api/fills
GET  /api/fills/order/:orderId
POST /api/orders/sync
GET  /api/admin/universe/stats
GET  /api/admin/universe/assets
GET  /api/admin/universe/assets/:symbol
POST /api/admin/universe/refresh
POST /api/admin/universe/exclude/:symbol
GET  /api/admin/fundamentals/stats
GET  /api/admin/fundamentals/:symbol
GET  /api/admin/fundamentals/top/scores
POST /api/admin/fundamentals/fetch
GET  /api/admin/candidates/stats
GET  /api/admin/candidates
GET  /api/admin/candidates/approved/list
POST /api/admin/candidates/generate
POST /api/admin/candidates/:symbol/approve
POST /api/admin/candidates/:symbol/reject
GET  /api/admin/enforcement/stats
POST /api/admin/enforcement/check
POST /api/admin/enforcement/reset-stats
GET  /api/admin/allocation/stats
GET  /api/admin/allocation/policies
GET  /api/admin/allocation/policies/active
POST /api/admin/allocation/policies/:id/activate
POST /api/admin/allocation/analyze
GET  /api/admin/allocation/runs
GET  /api/admin/rebalancer/stats
POST /api/admin/rebalancer/dry-run
POST /api/admin/rebalancer/execute
POST /api/admin/rebalancer/profit-taking/analyze
GET  /api/admin/work-items
POST /api/admin/work-items/retry
GET  /api/admin/trace/:traceId
```

## File Structure

```
client/
├── screens/
│   └── AdminHubScreen.tsx      # Main consolidated admin screen (all modules)
├── navigation/
│   └── AdminStackNavigator.tsx # Stack navigator for admin tab
```

## Reality Matrix

| Feature | Backend Status | UI Status |
|---------|---------------|-----------|
| Overview (Connectors, Fusion, AI Config, Keys) | Implemented | Implemented |
| Providers & Budgets | Implemented | Implemented |
| LLM Router | Implemented | Implemented |
| Orders (Broker Order Lifecycle, Fills, Sync) | Implemented | Implemented |
| Universe | Implemented | Implemented |
| Fundamentals | Implemented | Implemented |
| Candidates | Implemented | Implemented |
| Enforcement | Implemented | Implemented |
| Allocation | Implemented | Implemented |
| Rebalancer | Implemented | Implemented |
| Observability (TraceId + Work Queue + Alerts) | Implemented | Implemented |

---

*Last updated: December 2025*
