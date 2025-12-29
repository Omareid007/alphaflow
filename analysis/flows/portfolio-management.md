# Portfolio Management Flow

Complete documentation of portfolio viewing, analysis, and reconciliation in AlphaFlow Trading Platform.

## Overview

| Attribute | Value |
|-----------|-------|
| **Purpose** | View, analyze, and manage trading portfolio |
| **Trigger** | Navigate to Portfolio page or admin actions |
| **Actor** | Authenticated user (trader/admin) |
| **Frequency** | Multiple times daily |

## Entry Conditions

- [ ] User is authenticated
- [ ] Alpaca account is connected
- [ ] At least one position exists (for meaningful view)

---

## Flow 1: View Portfolio

### Flow Diagram

```
[Navigation: /portfolio]
         |
         v
   [Fetch Portfolio Data]
         |
    +----+----+----+
    |    |    |    |
    v    v    v    v
[Account] [Positions] [Strategies] [Trades]
    |    |    |    |
    v    v    v    v
[Merge Data]
    |
    v
[Calculate Metrics]
    |
    v
[Render Dashboard]
    |
    +----+----+----+
    |    |    |    |
    v    v    v    v
[Metrics] [Charts] [Tables] [Alerts]
```

### Portfolio Components

| Component | Data Source | Purpose |
|-----------|-------------|---------|
| Portfolio Metrics | Account API | Total equity, P&L, exposure |
| Asset Allocation | Positions API | Pie chart of holdings |
| Position P&L | Positions API | Bar chart by symbol |
| Cash & Exposure | Account API | Progress bars |
| Active Strategies | Database | Strategy performance |
| Recent Trades | Orders API | Trade history |

### API Calls

| Endpoint | Purpose | Cache |
|----------|---------|-------|
| GET /api/portfolio/snapshot | Account summary | 30s |
| GET /api/positions | Current holdings | 30s |
| GET /api/strategies | Active strategies | 60s |
| GET /api/trades | Recent trades | 30s |

### Metrics Calculated

| Metric | Formula | Display |
|--------|---------|---------|
| Total Equity | Cash + Position Values | $XXX,XXX.XX |
| Day P&L | Current - Previous Close | +/- $X,XXX.XX (X.XX%) |
| Total P&L | Current - Cost Basis | +/- $X,XXX.XX (X.XX%) |
| Exposure | Position Value / Equity | XX% |
| Cash Available | Cash Balance | $XX,XXX.XX |
| Buying Power | 2x Cash (margin) | $XX,XXX.XX |

---

## Flow 2: Position Reconciliation

### Purpose
Ensure database positions match broker (Alpaca) positions.

### Flow Diagram

```
[Admin: Trigger Reconciliation]
         |
         v
   [Fetch Alpaca Positions]
         |
         v
   [Fetch DB Positions]
         |
         v
   [Compare Positions]
         |
    +----+----+
    |         |
    v         v
[Match]   [Mismatch]
    |         |
    v         v
[No Action] [Flag Discrepancy]
              |
         +----+----+
         |         |
         v         v
      [Auto-Fix] [Manual Review]
         |
         v
      [Sync DB]
         |
         v
      [Log Action]
```

### Reconciliation Checks

| Check | Comparison | Action on Mismatch |
|-------|------------|-------------------|
| Symbol exists | DB vs Alpaca | Add missing to DB |
| Quantity match | DB qty vs Alpaca qty | Update DB |
| Cost basis | DB avg price vs Alpaca | Update if different |
| Side | Long vs Short | Flag for review |
| Orphan positions | DB only, not in Alpaca | Mark as closed |

### API Endpoint

```
POST /api/positions/reconcile

Response:
{
  "status": "completed",
  "matches": 15,
  "discrepancies": 2,
  "actions": [
    { "symbol": "AAPL", "action": "quantity_updated", "from": 100, "to": 110 },
    { "symbol": "TSLA", "action": "added", "qty": 50 }
  ]
}
```

---

## Flow 3: Portfolio Rebalancing

### Flow Diagram

```
[Trigger Rebalance]
         |
         v
   [Analyze Current Allocation]
         |
         v
   [Compare to Target]
         |
         v
   [Calculate Trades Needed]
         |
    +----+----+
    |         |
    v         v
[Within Bands] [Outside Bands]
    |              |
    v              v
[No Action]   [Generate Orders]
                   |
                   v
              [Preview Changes]
                   |
                   v
              [Confirm/Execute]
                   |
                   v
              [Monitor Fills]
```

### Rebalancing Rules

| Rule | Default | Configurable |
|------|---------|--------------|
| Min trade size | $100 | Yes |
| Rebalance threshold | 5% drift | Yes |
| Max single trade | 10% portfolio | Yes |
| Sector limit | 30% | Yes |
| Single position limit | 15% | Yes |

---

## Happy Path

1. User navigates to `/portfolio`
2. Page fetches data from multiple endpoints (parallel)
3. Metrics cards show:
   - Total Equity: $125,430.00
   - Day P&L: +$1,234.56 (+0.99%)
   - Exposure: 78%
   - Cash: $27,594.60
4. Asset allocation pie chart displays by sector
5. Position table shows each holding with P&L
6. User can click position for details
7. Data auto-refreshes every 30 seconds

## Sad Paths

| Scenario | Trigger | Expected Behavior | Recovery |
|----------|---------|-------------------|----------|
| No positions | Empty portfolio | Show "No positions" message | Guide to first trade |
| API error | Alpaca unavailable | Show cached data + warning | Retry button |
| Stale data | Cache > 5 min old | Show warning banner | Force refresh |
| Calculation error | Invalid data | Show partial view + error | Contact support |

## Edge Cases

| Case | Condition | Expected Behavior |
|------|-----------|-------------------|
| Zero equity | All cash | Show 0% exposure, cash only |
| Negative P&L | Losing positions | Show in red, no hiding |
| Single position | 100% allocation | Show 100% in chart |
| Fractional shares | < 1 share | Display with decimals |
| Crypto positions | BTC/ETH | Include in totals, separate section |
| Pending orders | Open orders exist | Show pending badge |

## State Definitions

| State | Description | Visual Indicator |
|-------|-------------|------------------|
| Loading | Fetching data | Skeleton loaders |
| Ready | Data displayed | Full dashboard |
| Stale | Old cached data | Warning banner |
| Error | Fetch failed | Error message + retry |
| Empty | No positions | Empty state guidance |

## Data Model

```typescript
interface PortfolioSnapshot {
  equity: number;
  cash: number;
  buyingPower: number;
  dayPnl: number;
  dayPnlPercent: number;
  totalPnl: number;
  totalPnlPercent: number;
  exposure: number;
  positionCount: number;
  lastUpdated: Date;
}

interface Position {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  side: 'long' | 'short';
  strategyId?: string;
}
```

## Components Involved

| Component | Location | Purpose |
|-----------|----------|---------|
| PortfolioPage | `app/portfolio/page.tsx` | Main page |
| MetricCard | `components/ui/card.tsx` | KPI display |
| AllocationChart | Uses Recharts | Pie chart |
| PositionPnLChart | Uses Recharts | Bar chart |
| PositionsTable | `components/ui/table.tsx` | Position list |
| CashExposureBar | `components/ui/progress.tsx` | Progress bars |

## Performance Targets

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Initial load | < 2s | > 3s | > 5s |
| Auto-refresh | Every 30s | Skipped | Failed |
| Chart render | < 500ms | > 1s | > 2s |
| Position count | Up to 100 | > 200 | > 500 |

## API Rate Limits

| Endpoint | Limit | Cache Strategy |
|----------|-------|----------------|
| /portfolio/snapshot | 100/min | SWR 30s |
| /positions | 100/min | SWR 30s |
| /trades | 100/min | SWR 60s |

## Accessibility

- Charts have text summaries
- Tables are keyboard navigable
- P&L colors have icon indicators (not color alone)
- Screen reader announcements for data updates
