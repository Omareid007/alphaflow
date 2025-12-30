# Dashboard (Home Page) Flow

> **Path:** `/app/home/page.tsx`
> **Route:** `/home` (redirects from `/`)

## Overview

The Dashboard is the primary landing page for the AlphaFlow trading platform, providing a real-time overview of portfolio performance, active strategies, and AI-driven trading insights.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Dashboard Page                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ Total Equity│ │   Day P&L   │ │ Active Strat│ │ Buying Power││
│  │ MetricCard  │ │ MetricCard  │ │ MetricCard  │ │ MetricCard  ││
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘│
│         │               │               │               │        │
│         └───────────────┴───────────────┴───────────────┘        │
│                              │                                    │
│                   usePortfolioSnapshot                           │
│                              │                                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│  │    Strategies Section       │ │      AI Events Section      │ │
│  │    ┌─────────────────┐     │ │    ┌─────────────────┐      │ │
│  │    │  StrategyCard   │     │ │    │   AiEventCard   │      │ │
│  │    │  StrategyCard   │     │ │    │   AiEventCard   │      │ │
│  │    │  StrategyCard   │     │ │    │   AiEventCard   │      │ │
│  │    └─────────────────┘     │ │    └─────────────────┘      │ │
│  │           │                 │ │           │                  │ │
│  │      useStrategies          │ │      useAiEvents            │ │
│  └─────────────────────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      React Query Cache
                              │
                              ▼
            ┌─────────────────────────────────┐
            │          API Layer               │
            │    /api/positions/snapshot       │
            │    /api/strategies               │
            │    /api/ai/events                │
            └─────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │       Alpaca Connector           │
            │    • alpaca.getAccount()         │
            │    • alpaca.getPositions()       │
            └─────────────────────────────────┘
```

## Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `MetricCard` | Display key portfolio metrics | `components/dashboard/MetricCard` |
| `StrategyCard` | List active strategies with performance | `components/dashboard/StrategyCard` |
| `AiEventCard` | Show recent AI trading decisions | `components/dashboard/AiEventCard` |
| `Skeleton` | Loading state placeholders | `components/ui/skeleton` |
| `ErrorBoundary` | Graceful error handling with retry | `components/error-boundaries` |

## API Endpoints

### GET `/api/positions/snapshot`

Returns comprehensive portfolio snapshot including positions and metrics.

**Response:**
```typescript
interface PortfolioSnapshot {
  equity: number;           // Total account value
  cash: number;             // Cash balance
  buyingPower: number;      // Available buying power
  dayPnl: number;           // Unrealized daily P&L
  dayPnlPercent: number;    // Daily P&L as percentage
  positions: Position[];    // Array of current positions
}
```

**Refetch Interval:** 60 seconds

### GET `/api/strategies`

Returns all user strategies with status and performance.

**Response:**
```typescript
interface Strategy {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'draft';
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    winRate: number;
  };
}
```

### GET `/api/ai/events?limit=10`

Returns recent AI-generated trading events.

**Response:**
```typescript
interface AiEvent {
  id: string;
  type: 'signal' | 'risk' | 'sentiment' | 'news' | 'suggestion';
  title: string;
  headline: string;
  explanation: string;
  symbol?: string;
  confidence: number;
  action?: 'buy' | 'sell' | 'hold';
  time: string;
}
```

**Refetch Interval:** 60 seconds

## Data Flow

```
1. Page Load
   │
   ├─► usePortfolioSnapshot() ─► GET /api/positions/snapshot
   │                              │
   │                              ├─► alpaca.getAccount()
   │                              │   └─► Returns: equity, cash, buying_power
   │                              │
   │                              └─► alpaca.getPositions()
   │                                  └─► Returns: array of positions
   │
   ├─► useStrategies() ─► GET /api/strategies
   │                       │
   │                       └─► storage.getStrategies()
   │                           └─► Returns: array of strategies
   │
   └─► useAiEvents({ limit: 10 }) ─► GET /api/ai/events?limit=10
                                      │
                                      └─► storage.getAiDecisions()
                                          └─► Returns: array of events
```

## User Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| View All Strategies | Click "View All" | Navigate to `/strategies` |
| Create Strategy | Click "New Strategy" | Navigate to `/create` |
| View Strategy Details | Click strategy card | Navigate to `/strategies/{id}` |
| View AI Activity | Click "View Activity" | Navigate to `/ai` |
| Retry Failed Load | Click "Retry" button | Refetch failed data source |

## State Management

The dashboard uses React Query for server state management:

```typescript
// lib/api/hooks/usePortfolioSnapshot.ts
const { data, isLoading, error } = useQuery({
  queryKey: ['portfolio-snapshot'],
  queryFn: fetchPortfolioSnapshot,
  refetchInterval: 60_000,  // 60 seconds
});

// lib/api/hooks/useStrategies.ts
const { data, isLoading, error } = useQuery({
  queryKey: ['strategies'],
  queryFn: fetchStrategies,
});

// lib/api/hooks/useAiEvents.ts
const { data, isLoading, error } = useQuery({
  queryKey: ['ai-events', { limit }],
  queryFn: () => fetchAiEvents({ limit }),
  refetchInterval: 60_000,
});
```

## Error Handling

1. **Network Errors:** Displayed with retry button
2. **API Errors:** Caught by ErrorBoundary, shows fallback UI
3. **Empty States:** Handled with "No data" messages and call-to-action

## Performance Optimizations

| Optimization | Implementation |
|--------------|----------------|
| Skeleton Loading | Progressive UI rendering while data loads |
| Query Caching | React Query caches responses |
| Stale-While-Revalidate | Shows cached data while fetching updates |
| Component Memoization | React.memo on expensive components |

## Related Files

- `app/home/page.tsx` - Main page component
- `lib/api/hooks/usePortfolioSnapshot.ts` - Portfolio data hook
- `lib/api/hooks/useStrategies.ts` - Strategies data hook
- `lib/api/hooks/useAiEvents.ts` - AI events data hook
- `server/routes/positions.ts` - Position API routes
- `server/routes/strategies.ts` - Strategy API routes
- `server/routes/ai-decisions.ts` - AI events API routes
- `server/connectors/alpaca.ts` - Alpaca broker integration
