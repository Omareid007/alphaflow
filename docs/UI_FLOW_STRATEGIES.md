# UI Flow: Strategies

**Version:** 1.0.0  
**Date:** December 2024  
**Purpose:** Map UI screens to API endpoints to DB tables

---

## Critical UI Rules

1. **NO UNSOURCED CLAIMS**: Every metric shown must have a `runId` and provenance
2. **NO MARKETING TEXT**: Replace any "~X% returns" claims with computed values or remove
3. **FORECAST DISCLAIMERS**: Every projection display must show uncertainty disclaimers
4. **COMPUTED ONLY**: All numbers come from backtest runs, never hardcoded

---

## 1. Screen-to-API-to-DB Mapping

### 1.1 Strategy Library Screen

**Screen:** `client/screens/StrategiesScreen.tsx`

**Purpose:** Display available strategies with computed metrics from latest backtest runs.

```
UI Component (StrategiesScreen.tsx)
         │
         ▼
API Endpoint: GET /api/strategies
         │
         ▼
DB Tables: 
  - backtest_runs (for latest metrics per strategy)
```

**Data Displayed:**
| Field | Source | Notes |
|-------|--------|-------|
| Strategy Name | Config | Static |
| Category | Config | momentum/mean-reversion/trend |
| OOS Sharpe | backtest_runs | Computed |
| Max Drawdown | backtest_runs | Computed |
| Last Run | backtest_runs | Timestamp |

**Removed/Replaced:**
- Remove any "Expected Returns: ~15%" (unsourced)
- Show computed value or hide if no run exists
- Add provenance: "OOS Sharpe: 0.85 (Run: abc123, 2024-12-15)"

---

### 1.2 Strategy Configuration Screen

**Screen:** `client/screens/StrategyWizard/ConfigurationScreen.tsx`

**Purpose:** Configure strategy parameters.

```
UI Component (ConfigurationScreen.tsx)
         │
         ▼
API Endpoint: GET /api/strategies/:type
         │
         ▼
Strategy configuration with parameter defaults
```

**Parameter Categories:**
1. **Core Parameters** - Always visible
2. **Risk Parameters** - Collapsed by default
3. **Timing Parameters** - Collapsed by default
4. **Advanced Parameters** - Hidden unless "Show Advanced"

**Provenance Display:**
```
Lookback Period: [12 months]
────────────────────────────────
  Default from: Moskowitz, Ooi & Pedersen (2012)
  "12-month lookback shown optimal in original research"
```

---

### 1.3 Backtest Screen

**Screen:** `client/screens/StrategyWizard/BacktestScreen.tsx`

**Purpose:** Run and display backtest results.

```
UI Component (BacktestScreen.tsx)
         │
         ▼
API Endpoint: POST /api/strategies/:type/backtest
         │
         ▼
DB Table: backtest_runs
```

**Required Sections:**
1. **Equity Curve Chart** - Line chart of portfolio value
2. **Drawdown Chart** - Area chart showing drawdowns
3. **Metrics Table** - All computed, none hardcoded
4. **Assumptions Panel** - Costs, slippage, data range
5. **Disclaimers** - Required legal text

**Metrics Table Fields:**
| Metric | Source | Required |
|--------|--------|----------|
| Total Return | Computed | Yes |
| CAGR | Computed | Yes |
| Sharpe Ratio | Computed | Yes |
| Sortino Ratio | Computed | Yes |
| Max Drawdown | Computed | Yes |
| Win Rate | Computed | Yes |
| Profit Factor | Computed | Yes |
| Trade Count | Computed | Yes |

**Required Footer Text:**
```
Past performance does not guarantee future results.
Backtest ID: {runId} | Data Range: {startDate} - {endDate}
Costs: Commission {commission}% + Slippage {slippage}bps
```

---

## 2. API Endpoint Reference

### Strategy Endpoints

| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/api/strategies` | List available strategies |
| GET | `/api/strategies/:type` | Get strategy config |
| POST | `/api/strategies/:type/backtest` | Run backtest |
| POST | `/api/strategies/backtest` | Generic backtest |

### Backtest Endpoints

| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/api/backtests` | List backtest runs |
| GET | `/api/backtests/:id` | Get specific run |

---

## 3. Database Schema

### backtest_runs Table

```sql
CREATE TABLE backtest_runs (
  id SERIAL PRIMARY KEY,
  strategy_id VARCHAR NOT NULL,
  status VARCHAR DEFAULT 'pending',
  config JSONB,
  results JSONB,
  metrics JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

**JSONB Fields:**
- `config`: Strategy parameters used
- `results`: Equity curve, trades, signals
- `metrics`: Sharpe, drawdown, win rate, etc.

---

## 4. Component Guidelines

### Card Components

**DO:**
- Show computed metrics with provenance
- Display run timestamp
- Include confidence intervals where applicable

**DON'T:**
- Hardcode performance numbers
- Use marketing language ("Best performer!")
- Show metrics without run ID

### Chart Components

**DO:**
- Include axis labels with units
- Show data source and date range
- Add tooltips with exact values

**DON'T:**
- Truncate axes to exaggerate returns
- Omit drawdown periods
- Use log scale without clearly labeling

### Disclaimer Components

**Required Disclaimers:**
1. "Past performance does not guarantee future results."
2. "Simulated results may not reflect actual trading."
3. "Costs and slippage are estimates."

---

## 5. Data Flow Summary

```
User selects strategy
         │
         ▼
Load strategy config from API
         │
         ▼
User configures parameters
         │
         ▼
Submit backtest request
         │
         ▼
Server runs backtest with:
  - Historical data (fetched with budget/cache)
  - Transaction costs
  - Slippage model
         │
         ▼
Store results in backtest_runs
         │
         ▼
Display results with:
  - All computed metrics
  - Full provenance (runId, timestamp)
  - Required disclaimers
```

---

*All UI text must come from computed values with full provenance.*
