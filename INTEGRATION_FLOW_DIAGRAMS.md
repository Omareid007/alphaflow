# Integration Flow Diagrams

## System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         TRADING PLATFORM ARCHITECTURE                      │
└────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│   CLIENT LAYER      │
│  (React Native)     │
│                     │
│  - Expo App         │
│  - React Query      │
│  - TanStack Query   │
│  - Local State      │
└──────────┬──────────┘
           │ HTTP/REST
           │ credentials: include
           │
┌──────────▼──────────┐
│   API LAYER         │
│  (Express.js)       │
│                     │
│  - Routes           │
│  - Middleware       │
│  - Auth             │
│  - Validation       │
└──────────┬──────────┘
           │
           ├─────────────────┐─────────────────┐─────────────────┐
           │                 │                 │                 │
┌──────────▼──────────┐ ┌───▼────────┐ ┌──────▼──────┐ ┌───────▼────────┐
│  DATABASE LAYER     │ │ BACKGROUND │ │  EXTERNAL   │ │   AI LAYER     │
│  (PostgreSQL)       │ │   JOBS     │ │    APIs     │ │                │
│                     │ │            │ │             │ │                │
│  - Users            │ │ - Work     │ │ - Alpaca    │ │ - Decision     │
│  - Strategies       │ │   Queue    │ │ - Finnhub   │ │   Engine       │
│  - Positions        │ │ - Backtest │ │ - NewsAPI   │ │ - LLM Gateway  │
│  - Orders           │ │   Engine   │ │ - SEC Edgar │ │ - Orchestrator │
│  - Trades           │ │ - Reconcile│ │ - FRED      │ │ - Arena        │
│  - AI Decisions     │ │ - Rebalance│ │             │ │                │
└─────────────────────┘ └────────────┘ └─────────────┘ └────────────────┘
```

---

## Layer Communication Patterns

### Request Flow (Synchronous)
```
Client Request → Middleware Chain → Route Handler → Database → Response

┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐
│ Client  │───>│   CORS   │───>│  Auth   │───>│Validation│───>│ Handler │
└─────────┘    └──────────┘    └─────────┘    └──────────┘    └────┬────┘
                                                                     │
                                                                     ▼
                                                              ┌─────────────┐
                                                              │  Database   │
                                                              └─────────────┘
```

### Event Flow (Asynchronous)
```
External Event → WebSocket → Event Handler → Database → Notify Clients

┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│ Alpaca  │───>│   WS     │───>│ Handler │───>│    DB    │
│ Stream  │    │ Client   │    │         │    │          │
└─────────┘    └──────────┘    └─────────┘    └──────────┘
                                                     │
                                                     ▼
                                               ┌──────────┐
                                               │  Clients │
                                               │ (polling)│
                                               └──────────┘
```

### Background Job Flow
```
Job Enqueue → Work Queue → Worker → Execute → Update Database → Result

┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│ Trigger │───>│  Queue   │───>│ Worker  │───>│ Execute  │
└─────────┘    │ (BullMQ) │    │  Pool   │    │ Business │
               └──────────┘    └─────────┘    │  Logic   │
                                               └────┬─────┘
                                                    │
                                                    ▼
                                               ┌──────────┐
                                               │    DB    │
                                               │  Update  │
                                               └──────────┘
```

---

## Authentication Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

1. SIGNUP
──────────
┌────────┐                     ┌────────┐                     ┌────────┐
│ Client │                     │  API   │                     │   DB   │
└───┬────┘                     └───┬────┘                     └───┬────┘
    │ POST /api/auth/signup       │                              │
    │ {username, password}        │                              │
    │─────────────────────────────>                              │
    │                              │ Validate input              │
    │                              │ (Zod schema)                │
    │                              │                              │
    │                              │ Check username exists       │
    │                              │─────────────────────────────>
    │                              │                              │
    │                              │<─────────────────────────────
    │                              │                              │
    │                              │ bcrypt.hash(password)        │
    │                              │                              │
    │                              │ INSERT INTO users            │
    │                              │─────────────────────────────>
    │                              │                              │
    │                              │<─────────────────────────────
    │                              │ User created                 │
    │<─────────────────────────────│                              │
    │ {user: {...}}                │                              │

2. LOGIN
────────
┌────────┐                     ┌────────┐                     ┌────────┐
│ Client │                     │  API   │                     │Session │
└───┬────┘                     └───┬────┘                     └───┬────┘
    │ POST /api/auth/login        │                              │
    │ {username, password}        │                              │
    │─────────────────────────────>                              │
    │                              │ SELECT user FROM users      │
    │                              │ WHERE username = ?          │
    │                              │                              │
    │                              │ bcrypt.compare(             │
    │                              │   password,                 │
    │                              │   user.password             │
    │                              │ )                           │
    │                              │                              │
    │                              │ generateSessionId()         │
    │                              │                              │
    │                              │ Store session               │
    │                              │─────────────────────────────>
    │                              │                              │
    │<─────────────────────────────│                              │
    │ Set-Cookie: session=xxx      │                              │
    │ {user: {...}}                │                              │

3. AUTHENTICATED REQUEST
────────────────────────
┌────────┐                     ┌────────┐                     ┌────────┐
│ Client │                     │  API   │                     │Session │
└───┬────┘                     └───┬────┘                     └───┬────┘
    │ GET /api/strategies         │                              │
    │ Cookie: session=xxx         │                              │
    │─────────────────────────────>                              │
    │                              │ authMiddleware              │
    │                              │ Extract sessionId           │
    │                              │                              │
    │                              │ Validate session            │
    │                              │─────────────────────────────>
    │                              │                              │
    │                              │<─────────────────────────────
    │                              │ {userId, expiresAt}         │
    │                              │                              │
    │                              │ req.userId = userId         │
    │                              │                              │
    │                              │ Execute route handler       │
    │                              │                              │
    │<─────────────────────────────│                              │
    │ {strategies: [...]}          │                              │
```

---

## Trading Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          TRADING FLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

1. FETCH POSITIONS (Real-time Alpaca Sync)
──────────────────────────────────────────
┌────────┐       ┌────────┐       ┌────────┐       ┌────────┐
│ Client │       │  API   │       │   DB   │       │ Alpaca │
└───┬────┘       └───┬────┘       └───┬────┘       └───┬────┘
    │                │                │                │
    │ GET /positions │                │                │
    │───────────────>│                │                │
    │                │                │                │
    │                │ GET /v2/positions              │
    │                │───────────────────────────────>│
    │                │                │                │
    │                │<───────────────────────────────│
    │                │ [Alpaca positions]             │
    │                │                │                │
    │                │ SELECT positions               │
    │                │ FROM positions                 │
    │                │───────────────>│                │
    │                │                │                │
    │                │<───────────────│                │
    │                │ [DB positions] │                │
    │                │                │                │
    │                │ Enrich:        │                │
    │                │ - Add metadata │                │
    │                │ - Merge DB data│                │
    │                │ - Calculate PnL│                │
    │                │                │                │
    │<───────────────│                │                │
    │ [Enriched positions with _metadata]              │

2. PLACE ORDER (Idempotent Execution)
─────────────────────────────────────
┌────────┐       ┌────────┐       ┌────────┐       ┌────────┐
│ Client │       │  API   │       │  Work  │       │ Alpaca │
│        │       │        │       │ Queue  │       │        │
└───┬────┘       └───┬────┘       └───┬────┘       └───┬────┘
    │                │                │                │
    │ POST /orders   │                │                │
    │ {symbol, qty}  │                │                │
    │───────────────>│                │                │
    │                │                │                │
    │                │ 1. Validate    │                │
    │                │ 2. Risk checks │                │
    │                │                │                │
    │                │ Enqueue work   │                │
    │                │───────────────>│                │
    │                │                │                │
    │<───────────────│                │                │
    │ {workItemId}   │                │                │
    │                │                │                │
    │                │                │ Worker picks up│
    │                │                │ work item      │
    │                │                │                │
    │                │                │ POST /v2/orders│
    │                │                │───────────────>│
    │                │                │                │
    │                │                │<───────────────│
    │                │                │ Order created  │
    │                │                │                │
    │                │ INSERT order   │                │
    │                │<───────────────│                │
    │                │                │                │
    │ GET /orders/:id│                │                │
    │ (polling)      │                │                │
    │───────────────>│                │                │
    │<───────────────│                │                │
    │ {status:'filled'}               │                │

3. POSITION RECONCILIATION (Periodic Background Job)
────────────────────────────────────────────────────
┌────────┐       ┌────────┐       ┌────────┐
│  Cron  │       │   DB   │       │ Alpaca │
└───┬────┘       └───┬────┘       └───┬────┘
    │                │                │
    │ Every 45s      │                │
    │                │                │
    │ GET /v2/positions              │
    │───────────────────────────────>│
    │                │                │
    │<───────────────────────────────│
    │ [Alpaca positions]             │
    │                │                │
    │ SELECT positions               │
    │───────────────>│                │
    │                │                │
    │<───────────────│                │
    │ [DB positions] │                │
    │                │                │
    │ Compare & reconcile:           │
    │ - Missing in DB → INSERT       │
    │ - Mismatch → UPDATE            │
    │ - Closed in Alpaca → UPDATE    │
    │                │                │
    │ UPDATE positions               │
    │───────────────>│                │
```

---

## AI Decision Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      AI DECISION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

1. ORCHESTRATOR LOOP (Every 60s)
────────────────────────────────
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│Orchestrator│  │   Market   │  │     AI     │  │    DB      │
│            │  │    Data    │  │   Engine   │  │            │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │               │               │               │
      │ 1. Get universe symbols       │               │
      │──────────────────────────────────────────────>│
      │               │               │               │
      │<──────────────────────────────────────────────│
      │ [symbols]     │               │               │
      │               │               │               │
      │ 2. Fetch market data          │               │
      │──────────────>│               │               │
      │               │ GET snapshots │               │
      │               │ (Alpaca)      │               │
      │               │               │               │
      │<──────────────│               │               │
      │ [market data] │               │               │
      │               │               │               │
      │ 3. Run AI analysis            │               │
      │──────────────────────────────>│               │
      │               │               │               │
      │               │               │ LLM calls     │
      │               │               │ (GPT-4, etc)  │
      │               │               │               │
      │<──────────────────────────────│               │
      │ [decisions]   │               │               │
      │               │               │               │
      │ 4. Store decisions            │               │
      │──────────────────────────────────────────────>│
      │               │               │               │
      │ 5. Execute high-confidence trades             │
      │ (if autoExecute=true)         │               │
      │               │               │               │

2. DECISION EXECUTION
─────────────────────
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│Orchestrator│  │    Work    │  │  Trading   │  │    DB      │
│            │  │   Queue    │  │   Engine   │  │            │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │               │               │               │
      │ For each decision:            │               │
      │ if confidence > threshold     │               │
      │               │               │               │
      │ Enqueue order │               │               │
      │──────────────>│               │               │
      │               │               │               │
      │               │ Worker executes               │
      │               │──────────────>│               │
      │               │               │               │
      │               │               │ Place order   │
      │               │               │ with Alpaca   │
      │               │               │               │
      │               │               │ Store result  │
      │               │               │──────────────>│
      │               │               │               │
      │               │ Update decision               │
      │               │ status='executed'             │
      │               │──────────────────────────────>│

3. ARENA MODE (Multi-Agent Debate)
──────────────────────────────────
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│  Arena     │  │  Agent 1   │  │  Agent 2   │  │    DB      │
│Coordinator │  │   (Bull)   │  │   (Bear)   │  │            │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │               │               │               │
      │ New symbol analysis request   │               │
      │               │               │               │
      │ Invoke agents in parallel     │               │
      │──────────────>│               │               │
      │──────────────────────────────>│               │
      │               │               │               │
      │               │ Analyze       │               │
      │               │ (bullish)     │               │
      │               │               │               │
      │               │               │ Analyze       │
      │               │               │ (bearish)     │
      │               │               │               │
      │<──────────────│               │               │
      │ Bull decision │               │               │
      │<──────────────────────────────│               │
      │ Bear decision │               │               │
      │               │               │               │
      │ Aggregate consensus           │               │
      │ (confidence, action)          │               │
      │               │               │               │
      │ Store consensus               │               │
      │──────────────────────────────────────────────>│
      │               │               │               │
      │ Execute if consensus reached  │               │
```

---

## Backtest Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKTEST FLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

┌────────┐       ┌────────┐       ┌────────┐       ┌────────┐
│ Client │       │  API   │       │  DB    │       │ Worker │
└───┬────┘       └───┬────┘       └───┬────┘       └───┬────┘
    │                │                │                │
    │ POST /backtests│                │                │
    │ {config}       │                │                │
    │───────────────>│                │                │
    │                │                │                │
    │                │ Validate config│                │
    │                │ Hash config    │                │
    │                │                │                │
    │                │ INSERT backtest│                │
    │                │ status=QUEUED  │                │
    │                │───────────────>│                │
    │                │                │                │
    │<───────────────│                │                │
    │ {id, status}   │                │                │
    │                │                │                │
    │                │                │ Worker picks up│
    │                │                │ QUEUED backtest│
    │                │                │<───────────────┤
    │                │                │                │
    │                │                │ UPDATE status= │
    │                │                │ RUNNING        │
    │                │                │───────────────>│
    │                │                │                │
    │                │                │ Fetch historical
    │                │                │ data (Alpaca) │
    │                │                │                │
    │                │                │ Simulate trades│
    │                │                │                │
    │ GET /backtests/:id (polling)   │                │
    │───────────────>│                │                │
    │                │ SELECT backtest│                │
    │                │───────────────>│                │
    │<───────────────│                │                │
    │ {status:RUNNING│                │                │
    │  progress: 45%}│                │                │
    │                │                │                │
    │                │                │ For each day:  │
    │                │                │ - Calculate    │
    │                │                │   indicators   │
    │                │                │ - Generate     │
    │                │                │   signals      │
    │                │                │ - Execute      │
    │                │                │   trades       │
    │                │                │ - Calculate    │
    │                │                │   equity       │
    │                │                │                │
    │                │                │ INSERT trades  │
    │                │                │───────────────>│
    │                │                │                │
    │                │                │ INSERT equity  │
    │                │                │ curve          │
    │                │                │───────────────>│
    │                │                │                │
    │                │                │ Calculate      │
    │                │                │ metrics:       │
    │                │                │ - Total return │
    │                │                │ - Sharpe ratio │
    │                │                │ - Max drawdown │
    │                │                │ - Win rate     │
    │                │                │                │
    │                │                │ UPDATE status= │
    │                │                │ DONE, results  │
    │                │                │───────────────>│
    │                │                │                │
    │ GET /backtests/:id             │                │
    │───────────────>│                │                │
    │<───────────────│                │                │
    │ {status: DONE, │                │                │
    │  results: {...}}                │                │
    │                │                │                │
    │ GET /backtests/:id/equity      │                │
    │───────────────>│                │                │
    │                │ SELECT equity  │                │
    │                │───────────────>│                │
    │<───────────────│                │                │
    │ [equity curve] │                │                │
```

---

## Error Handling Patterns

### API Error Response
```
┌────────┐                     ┌────────┐
│ Client │                     │  API   │
└───┬────┘                     └───┬────┘
    │ POST /api/orders           │
    │ {invalid data}             │
    │───────────────────────────>│
    │                             │
    │                             │ Validate
    │                             │ (Zod schema)
    │                             │
    │<────────────────────────────│
    │ 400 Bad Request             │
    │ {                           │
    │   error: "Validation error" │
    │   details: [...]            │
    │ }                           │
```

### Database Transaction Error
```
┌────────┐                     ┌────────┐
│  API   │                     │   DB   │
└───┬────┘                     └───┬────┘
    │                             │
    │ BEGIN TRANSACTION           │
    │────────────────────────────>│
    │                             │
    │ INSERT order                │
    │────────────────────────────>│
    │<────────────────────────────│
    │ OK                          │
    │                             │
    │ UPDATE account              │
    │────────────────────────────>│
    │<────────────────────────────│
    │ ERROR (constraint violation)│
    │                             │
    │ ROLLBACK                    │
    │────────────────────────────>│
    │                             │
    │ Return error to client      │
```

### External API Failure with Retry
```
┌────────┐                     ┌────────┐
│  API   │                     │ Alpaca │
└───┬────┘                     └───┬────┘
    │                             │
    │ GET /v2/account             │
    │────────────────────────────>│
    │<────────────────────────────│
    │ 503 Service Unavailable     │
    │                             │
    │ Wait 1s (exponential backoff)
    │                             │
    │ GET /v2/account (retry 1)   │
    │────────────────────────────>│
    │<────────────────────────────│
    │ 503 Service Unavailable     │
    │                             │
    │ Wait 2s                     │
    │                             │
    │ GET /v2/account (retry 2)   │
    │────────────────────────────>│
    │<────────────────────────────│
    │ 200 OK                      │
    │ {account data}              │
```

---

## Data Consistency Patterns

### Optimistic Updates
```
1. Client sends update
2. Client immediately updates UI (optimistic)
3. Server processes update
4. If success: UI remains updated
5. If error: Rollback UI to previous state
```

### Pessimistic Updates
```
1. Client sends update
2. Client shows loading state
3. Server processes update
4. Server responds with result
5. Client updates UI based on server response
```

### Eventually Consistent Updates
```
1. Client sends update
2. Server enqueues background job
3. Client polls for status
4. Background job completes
5. Client fetches updated state
```

---

## Monitoring & Observability

### Request Tracing
```
┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
│ Client │───>│  API   │───>│   DB   │───>│External│
└───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘
    │             │             │             │
    │ traceId=abc │             │             │
    │             │ traceId=abc │             │
    │             │             │ traceId=abc │
    │             │             │             │
All logs tagged with traceId for correlation
```

### Health Check Flow
```
┌────────┐    ┌────────┐    ┌────────┐
│Monitor │───>│  API   │───>│   DB   │
└───┬────┘    └───┬────┘    └───┬────┘
    │             │             │
    │ GET /health │             │
    │────────────>│             │
    │             │ SELECT 1    │
    │             │────────────>│
    │             │<────────────│
    │             │             │
    │<────────────│             │
    │ 200 OK      │             │
    │ {db: "ok"}  │             │
```

---

**Last Updated**: 2024-12-24
**Purpose**: Visual reference for integration testing
**Audience**: Developers, QA Engineers, Platform Engineers
