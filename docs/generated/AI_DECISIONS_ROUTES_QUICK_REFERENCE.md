# AI Decisions Routes - Quick Reference Guide

## File Location
**Primary File:** `/home/runner/workspace/server/routes/ai-decisions.ts`

---

## Route Summary Table

| # | Method | Route | Handler Line | Description |
|----|--------|-------|--------------|-------------|
| 1 | GET | `/api/ai-decisions` | 35 | Fetch recent AI trading decisions |
| 2 | GET | `/api/ai-decisions/history` | 50 | Fetch decisions with filtering/pagination |
| 3 | POST | `/api/ai-decisions` | 85 | Create new AI decision record |
| 4 | GET | `/api/ai-decisions/enriched` | 104 | Get decisions with linked orders/trades/positions |
| 5 | POST | `/api/ai/analyze` | 273 | Analyze trading opportunity |
| 6 | GET | `/api/ai/status` | 337 | Get AI decision engine status |
| 7 | GET | `/api/ai/events` | 351 | Get recent AI activity |
| 8 | GET | `/api/ai/sentiment` | 395 | Get sentiment signals for symbols |
| 9 | GET | `/api/ai/cache/stats` | 433 | Get LLM cache statistics |
| 10 | POST | `/api/ai/cache/clear` | 447 | Clear all LLM cache |
| 11 | POST | `/api/ai/cache/clear/:role` | 461 | Clear LLM cache by role |
| 12 | POST | `/api/ai/cache/reset-stats` | 476 | Reset cache statistics |
| 13 | GET | `/api/agent/status` | 494 | Get agent status |
| 14 | POST | `/api/agent/toggle` | 516 | Toggle agent on/off |
| 15 | GET | `/api/agent/market-analysis` | 539 | Get market condition analysis |
| 16 | POST | `/api/agent/market-analysis/refresh` | 560 | Refresh market analysis |
| 17 | GET | `/api/agent/dynamic-limits` | 574 | Get dynamic order limits |
| 18 | POST | `/api/agent/set-limits` | 604 | Set order limits |
| 19 | GET | `/api/agent/health` | 653 | Get agent health status |
| 20 | POST | `/api/agent/auto-start` | 673 | Set auto-start enabled/disabled |
| 21 | POST | `/api/autonomous/execute-trades` | 693 | Execute trades from decisions |

---

## Router Mounting Configuration

### Option 1: Mount at /api prefix
```typescript
import aiDecisionsRouter from './routes/ai-decisions';

// In main routes.ts
app.use('/api', aiDecisionsRouter);
```

### Option 2: Mount at /api/ai-decisions prefix
```typescript
import aiDecisionsRouter from './routes/ai-decisions';

// In main routes.ts
app.use('/api/ai-decisions', aiDecisionsRouter);
```

**Note:** Routes in the file use relative paths, so Option 1 will expose all routes at `/api/*` paths.

---

## Route Categories

### AI Decisions Management (4 routes)
- `GET /api/ai-decisions` - List recent decisions
- `GET /api/ai-decisions/history` - Paginated decision history
- `POST /api/ai-decisions` - Create decision
- `GET /api/ai-decisions/enriched` - Enriched timeline data

### AI Analysis (4 routes)
- `POST /api/ai/analyze` - Analyze opportunity
- `GET /api/ai/status` - Engine status
- `GET /api/ai/events` - Activity events
- `GET /api/ai/sentiment` - Sentiment signals

### LLM Cache Management (4 routes)
- `GET /api/ai/cache/stats` - Cache statistics
- `POST /api/ai/cache/clear` - Clear all cache
- `POST /api/ai/cache/clear/:role` - Clear by role
- `POST /api/ai/cache/reset-stats` - Reset stats

### Agent Control (7 routes)
- `GET /api/agent/status` - Agent status
- `POST /api/agent/toggle` - Toggle agent
- `GET /api/agent/market-analysis` - Market analysis
- `POST /api/agent/market-analysis/refresh` - Refresh analysis
- `GET /api/agent/dynamic-limits` - Order limits
- `POST /api/agent/set-limits` - Update limits
- `GET /api/agent/health` - Health status
- `POST /api/agent/auto-start` - Auto-start config

### Trade Execution (1 route)
- `POST /api/autonomous/execute-trades` - Execute trades

---

## Key Data Structures

### Enriched Decision
```typescript
{
  decision: AiDecision,
  linkedOrder: Order | null,
  linkedTrade: Trade | null,
  linkedPosition: Position | null,
  timeline: [
    { stage: "decision", status: "completed", timestamp, details }
    { stage: "risk_gate", status: "completed|pending|skipped", timestamp, details }
    { stage: "order", status: "completed|pending|failed", timestamp, details }
    { stage: "fill", status: "completed|pending", timestamp, details }
    { stage: "position", status: "completed", timestamp, details }
    { stage: "exit", status: "completed|pending", timestamp, details }
  ]
}
```

### Agent Status
```typescript
{
  isRunning: boolean,
  totalTrades: number,
  totalPnl: string,
  minOrderLimit?: number,
  maxOrderLimit?: number,
  dynamicOrderLimit?: number,
  marketCondition?: string,
  aiConfidenceScore?: string,
  autoStartEnabled?: boolean,
  lastHeartbeat?: Date
}
```

### Market Analysis
```typescript
{
  isRunning: boolean,
  lastAnalysis: any,
  lastAnalysisTime: Date,
  currentOrderLimit: number
}
```

### Trade Execution Result
```typescript
{
  success: boolean,
  message: string,
  results: [
    {
      decisionId: string,
      success: boolean,
      error?: string,
      order?: any
    }
  ]
}
```

---

## Query Parameters

### `/api/ai-decisions`
- `limit` (number): Default 20

### `/api/ai-decisions/history`
- `limit` (number): Default 100
- `offset` (number): Default 0
- `status` (string): Filter by decision status
- `action` (string): Filter by action (buy/sell)

### `/api/ai-decisions/enriched`
- `limit` (number): Default 50
- `offset` (number): Default 0
- `status` (string): Filter by status

### `/api/ai/events`
- `limit` (number): Default 20, max 100
- `type` (string): Filter by event type

### `/api/ai/sentiment`
- `symbols` (string): Comma-separated symbols, default "SPY,QQQ,AAPL,TSLA,NVDA"

### `/api/agent/dynamic-limits`
- None

### `/api/agent/set-limits`
- Request body: `{ minOrderLimit?: number, maxOrderLimit?: number }`

### `/api/agent/auto-start`
- Request body: `{ enabled: boolean }`

### `/api/autonomous/execute-trades`
- Request body: `{ decisionIds: string[] }`

---

## Required Imports (Already Included)

### Core Modules
- `express` Router
- `../storage` Database operations
- `../utils/logger` Logging
- `../lib/standard-errors` Error responses

### AI Modules
- `../ai/decision-engine` Decision engine
- `../ai/llmGateway` LLM caching
- `../ai/market-condition-analyzer` Market analysis

### Trading Modules
- `../trading/alpaca-trading-engine` Trade execution
- `../connectors/alpaca` Alpaca API

### Orchestration
- `../autonomous/orchestrator` Agent orchestration

### Types
- `@shared/schema` Type definitions

---

## Authentication

**All routes require:** `authMiddleware`

Provides:
- User context via `req.userId`
- Request validation
- Security headers

---

## Error Handling

All routes implement consistent error handling:

```typescript
try {
  // Route logic
} catch (error) {
  log.error("AiDecisionsAPI", `Error message: ${error}`);
  res.status(500).json({ error: "User-friendly message" });
}
```

Error responses use standardized functions:
- `badRequest(res, message)` - 400
- `notFound(res, message)` - 404
- `serverError(res, message)` - 500
- `validationError(res, message, details)` - 422

---

## Performance Considerations

### Pagination
- `/api/ai-decisions/history` supports pagination with limit/offset
- `/api/ai-decisions/enriched` supports pagination with limit/offset

### Caching
- LLM responses are cached via `llmGateway`
- Cache can be cleared globally or by role
- Cache statistics available for monitoring

### Database Queries
- Most endpoints use direct storage queries
- Some endpoints perform multiple parallel queries with Promise.all()

---

## Example Usage

### Fetch Recent Decisions
```bash
curl -H "Authorization: Bearer <token>" \
  https://api.example.com/api/ai-decisions?limit=10
```

### Analyze Opportunity
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "marketData": { /* market data */ },
    "strategyId": "strategy-123"
  }' \
  https://api.example.com/api/ai/analyze
```

### Execute Trades
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "decisionIds": ["decision-1", "decision-2"]
  }' \
  https://api.example.com/api/autonomous/execute-trades
```

### Toggle Agent
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  https://api.example.com/api/agent/toggle
```

---

## Integration Checklist

- [ ] Copy `/home/runner/workspace/server/routes/ai-decisions.ts` to `/server/routes/`
- [ ] Update `/server/routes.ts` to import ai-decisions router
- [ ] Mount router at appropriate prefix (see Router Mounting Configuration)
- [ ] Test all 21 endpoints with authentication
- [ ] Verify database queries work correctly
- [ ] Test Alpaca integration for trade execution
- [ ] Configure rate limiting if needed
- [ ] Add API documentation to project docs
- [ ] Run test suite for new router

---

**Created:** 2025-12-26
**File Count:** 1 (ai-decisions.ts)
**Routes:** 21 endpoints
**Status:** Ready for integration
