# AI Pulse Flow

> **Path:** `/app/ai/page.tsx`
> **Route:** `/ai`

## Overview

AI Pulse is the AI activity monitoring dashboard that displays real-time trading signals, risk alerts, sentiment analysis, and data feed statuses. It provides transparency into the AI decision-making process.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       AI Pulse Page                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────────┐  │
│  │  Active   │ │  Signals  │ │   Risk    │ │ Avg Sentiment   │  │
│  │  Sources  │ │   Today   │ │  Alerts   │ │  (Gauges)       │  │
│  │ StatsCard │ │ StatsCard │ │ StatsCard │ │ StatsCard       │  │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───────┬─────────┘  │
│        └─────────────┴─────────────┴───────────────┘             │
│                              │                                    │
│                     useAiEvents + useFeedSources                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     Events Tabs                              │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                        │ │
│  │  │   All   │ │ Signals │ │  Risk   │  (Tab Navigation)      │ │
│  │  └────┬────┘ └────┬────┘ └────┬────┘                        │ │
│  │       │           │           │                              │ │
│  │       ▼           ▼           ▼                              │ │
│  │  ┌─────────────────────────────────────┐                    │ │
│  │  │         EventCard List              │                    │ │
│  │  │  • Signal events (green)            │                    │ │
│  │  │  • Risk alerts (red/orange)         │                    │ │
│  │  │  • News events (blue)               │                    │ │
│  │  │  • Suggestions (purple)             │                    │ │
│  │  └─────────────────────────────────────┘                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │    Data Sources Card     │  │   Sentiment Gauges Card      │ │
│  │  ┌────────────────────┐  │  │  ┌────────────────────────┐  │ │
│  │  │ Alpaca     ● Active│  │  │  │ SPY  [▓▓▓▓░░] Bullish │  │ │
│  │  │ CoinGecko  ● Active│  │  │  │ QQQ  [▓▓▓░░░] Neutral │  │ │
│  │  │ Finnhub    ● Active│  │  │  │ AAPL [▓▓▓▓▓░] Bullish │  │ │
│  │  │ NewsAPI    ○ Delay │  │  │  │ TSLA [▓░░░░░] Bearish │  │ │
│  │  │ ...                │  │  │  │ NVDA [▓▓▓▓░░] Bullish │  │ │
│  │  └────────────────────┘  │  │  └────────────────────────┘  │ │
│  │         │                 │  │           │                  │ │
│  │    useFeedSources         │  │      useSentiment            │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `StatsCard` | Display aggregate AI metrics | `components/ai/StatsCard` |
| `EventsTabs` | Tabbed event filtering interface | `components/ai/EventsTabs` |
| `EventCard` | Individual event with type coloring | `components/ai/EventCard` |
| `DataSourcesCard` | Show 8 data feed statuses | `components/ai/DataSourcesCard` |
| `SentimentGaugesCard` | Visual sentiment per symbol | `components/ai/SentimentGaugesCard` |
| `SentimentCard` | Individual sentiment gauge | `components/ai/SentimentCard` |

## API Endpoints

### GET `/api/ai/events?limit=100`

Returns AI-generated trading events.

**Response:**
```typescript
interface AiEvent {
  id: string;
  type: 'signal' | 'risk' | 'sentiment' | 'news' | 'suggestion';
  title: string;
  headline: string;
  explanation: string;
  symbol?: string;
  confidence: number;      // 0-100 confidence score
  action?: 'buy' | 'sell' | 'hold';
  impactedStrategies?: string[];
  time: string;           // ISO timestamp
}
```

**Refetch Interval:** 60 seconds

### GET `/api/feeds`

Returns status of all data feed sources.

**Response:**
```typescript
interface FeedSource {
  id: string;
  name: string;
  type: 'market' | 'news' | 'social' | 'crypto';
  status: 'active' | 'delayed' | 'offline';
  lastUpdate: string;     // ISO timestamp
  latency?: number;       // ms
}
```

**Data Sources (8 feeds):**
| Feed | Type | Purpose |
|------|------|---------|
| Alpaca Markets | market | Real-time US equities |
| CoinGecko | crypto | Cryptocurrency prices |
| Finnhub | market | Stock quotes & news |
| CoinMarketCap | crypto | Crypto market data |
| NewsAPI | news | Financial news |
| GDELT | news | Global news events |
| UAE Markets | market | Middle East markets |
| Hugging Face | social | NLP sentiment models |

**Refetch Interval:** 60 seconds (staleTime: 30 seconds)

### GET `/api/ai/sentiment?symbols=SPY,QQQ,AAPL,TSLA,NVDA`

Returns sentiment analysis for specified symbols.

**Response:**
```typescript
interface SentimentSignal {
  symbol: string;
  score: number;          // -50 to +50
  trend: 'up' | 'down' | 'neutral';
  explanation: string;
  sources: string[];      // Data sources used
  timestamp: string;
}
```

**Refetch Interval:** 120 seconds (staleTime: 60 seconds)

## Data Flow

```
1. Page Load
   │
   ├─► useAiEvents({ limit: 100 }) ─► GET /api/ai/events?limit=100
   │                                   │
   │                                   └─► storage.getAiDecisions()
   │                                       └─► Maps to AiEvent format
   │
   ├─► useFeedSources() ─► GET /api/feeds
   │                        │
   │                        └─► Returns 8 feed source statuses
   │                            (Currently hardcoded - needs integration)
   │
   └─► useSentiment({ symbols: [...] }) ─► GET /api/ai/sentiment
                                            │
                                            └─► Generates sentiment scores
                                                (Currently mock - needs AI integration)

2. Event Filtering
   │
   └─► Tab Selection
       ├─► "All" → Show all events
       ├─► "Signals" → Filter type === 'signal'
       └─► "Risk" → Filter type === 'risk'
```

## Event Types & Visualization

| Type | Color | Icon | Description |
|------|-------|------|-------------|
| `signal` | Green | TrendingUp | Trading buy/sell signals |
| `risk` | Red/Orange | AlertTriangle | Risk warnings & alerts |
| `sentiment` | Blue | Heart | Market sentiment changes |
| `news` | Sky | Newspaper | Financial news impacts |
| `suggestion` | Purple | Lightbulb | AI trading suggestions |

## User Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| Filter All Events | Click "All" tab | Show all event types |
| Filter Signals | Click "Signals" tab | Show only signal events |
| Filter Risk | Click "Risk" tab | Show only risk alerts |
| Refresh Data | Auto every 60s | Update events & sources |
| View Event Details | Click event card | Expand event details |

## State Management

```typescript
// lib/api/hooks/useAiEvents.ts
const { data: events } = useQuery({
  queryKey: ['ai-events', { limit: 100 }],
  queryFn: () => fetchAiEvents({ limit: 100 }),
  refetchInterval: 60_000,
});

// lib/api/hooks/useFeedSources.ts
const { data: feeds } = useQuery({
  queryKey: ['feed-sources'],
  queryFn: fetchFeedSources,
  refetchInterval: 60_000,
  staleTime: 30_000,
});

// lib/api/hooks/useSentiment.ts
const { data: sentiment } = useQuery({
  queryKey: ['sentiment', symbols],
  queryFn: () => fetchSentiment({ symbols }),
  refetchInterval: 120_000,
  staleTime: 60_000,
});
```

## Aggregate Metrics Calculation

```typescript
// Stats Cards Data
const stats = {
  activeSources: feeds.filter(f => f.status === 'active').length,
  signalsToday: events.filter(e =>
    e.type === 'signal' &&
    isToday(e.time)
  ).length,
  riskAlerts: events.filter(e => e.type === 'risk').length,
  avgSentiment: calculateAverageSentiment(sentiment),
};
```

## Known Limitations

### Current Mock Data
1. **Sentiment Endpoint:** Currently generates random scores - needs AI model integration
2. **Feed Statuses:** Hardcoded in API - needs real connector status monitoring

### Improvement Opportunities
- Integrate real sentiment analysis (HuggingFace, OpenAI)
- Connect feed status to actual connector health checks
- Add WebSocket for real-time event streaming
- Implement event notification system

## Related Files

- `app/ai/page.tsx` - Main AI Pulse page
- `lib/api/hooks/useAiEvents.ts` - AI events hook
- `lib/api/hooks/useFeedSources.ts` - Data feeds hook
- `lib/api/hooks/useSentiment.ts` - Sentiment analysis hook
- `server/routes/ai-decisions.ts` - AI events API
- `server/routes/feeds.ts` - Feed sources API
- `server/ai/decision-engine.ts` - AI decision generation
- `server/ai/llmGateway.ts` - LLM integration for analysis
