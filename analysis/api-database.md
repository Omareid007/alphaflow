# API & Database Analysis

## API Routes Overview

### Statistics
- **Total Route Files:** 46
- **Total Endpoints:** 50+
- **Total Lines:** ~9,765

### Route Categories

| Category | Files | Endpoints |
|----------|-------|-----------|
| Trading Core | 11 | 25+ |
| Market Data | 8 | 15 |
| AI/Decisions | 8 | 10 |
| Infrastructure | 10 | 15 |
| Monitoring | 9 | 10 |

---

## Database Schema

### Statistics
- **Schema Modules:** 15
- **Total Tables:** 35+
- **Total Lines:** 4,154
- **Foreign Keys:** 50+

### Domain Organization

#### Authentication (4 tables)
```
users
├── sessions (CASCADE DELETE)
├── adminSettings (SET NULL)
└── auditLogs (SET NULL)
```

#### Trading (4 tables)
```
strategies
├── trades (SET NULL)
├── positions (SET NULL)
└── orders (CASCADE DELETE)
    └── fills (CASCADE DELETE)
```

#### AI Decisions (4 tables)
```
aiDecisions
├── aiDecisionFeatures (CASCADE DELETE)
├── aiTradeOutcomes (CASCADE DELETE)
└── aiCalibrationLog
```

#### Orchestration (4 tables)
```
agentStatus (singleton)
workItems
├── workItemRuns (CASCADE DELETE)
aiArenaRuns
└── aiArenaAgentDecisions (CASCADE DELETE)
```

#### Backtesting (3 tables)
```
backtestRuns
├── backtestTradeEvents (CASCADE DELETE)
└── backtestEquityCurve (CASCADE DELETE)
```

---

## Key Tables

### Orders (489 lines - largest schema)
- **Primary:** id (UUID)
- **Unique:** brokerOrderId, clientOrderId
- **Indexes:** 7 (userId, brokerOrderId, clientOrderId, symbol, status, traceId, decisionId)
- **Relations:** userId, decisionId, workItemId

### AI Decisions (320 lines)
- **Lifecycle:** pending → executed → skipped → cancelled
- **Features:** Technical indicators, fundamentals, sentiment
- **Outcomes:** P&L, win/loss, exit reason

### Universe (733 lines - 6 tables)
- **Assets:** Symbol, asset class, exchange
- **Liquidity:** Daily volume, bid-ask spread, tier
- **Fundamentals:** P/E, P/B, ROE, market cap
- **Technicals:** RSI, MACD, volatility, trend

---

## Performance Issues

### Missing Indexes
1. `trades.orderId` - FK join optimization
2. `aiDecisionFeatures.decisionId` - CASCADE target
3. `workItemRuns.workItemId` - CASCADE target
4. `debateMessages.sessionId` - CASCADE target

### N+1 Query Patterns
1. Decision loops → Trade lookups
2. Position updates → Price fetches
3. Order reconciliation → Individual lookups

### Unbounded Tables (Need Partitioning)
- `llmCalls` - Audit log
- `auditLogs` - Activity log
- `toolInvocations` - No retention

---

## External Integrations

| Service | Purpose | Rate Limit |
|---------|---------|------------|
| Alpaca | Trading broker | 200/min |
| Finnhub | Market data | 60/min |
| CoinGecko | Crypto | 10/min |
| FRED | Economic data | 120/min |
| OpenAI | LLM | Token-based |
| OpenRouter | LLM fallback | Token-based |

---

## Security Patterns

### Authentication
- Session cookies (httpOnly, secure)
- Bcrypt password hashing
- Admin role flag
- Audit logging

### Validation
- Zod schemas on inputs
- Input sanitization (XSS)
- SQL parameterization (Drizzle)
