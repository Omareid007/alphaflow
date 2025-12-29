# Backtesting Flow

Complete documentation of the backtesting user journey in AlphaFlow Trading Platform.

## Overview

| Attribute | Value |
|-----------|-------|
| **Purpose** | Test trading strategies against historical data |
| **Trigger** | Strategy creation wizard or "Run Backtest" button |
| **Actor** | Authenticated user (trader) |
| **Frequency** | Multiple times per strategy development cycle |

## Entry Conditions

- [ ] User is authenticated
- [ ] Strategy is configured with valid parameters
- [ ] Historical data is available for selected symbols
- [ ] Backtest service is operational

## Flow Diagram

```
[Strategy Page]
      |
      v
[Click "Run Backtest"]
      |
      v
[Configure Parameters]
      |
      v
[POST /api/backtests/run]
      |
      +-----------------+
      |                 |
      v                 v
[Success]          [Error]
      |                 |
      v                 v
[Poll Status]     [Show Error]
      |                 |
      v                 v
[Loading UI]      [Retry Option]
      |
      v
[GET /api/backtests/:id]
      |
      +-----------------+
      |                 |
      v                 v
[Completed]       [Failed]
      |                 |
      v                 v
[Display Results] [Show Failure]
      |
      v
[AI Interpretation]
      |
      v
[Decision: Deploy/Adjust]
```

## Detailed Steps

| Step | User Action | System Response | Component | API Call |
|------|-------------|-----------------|-----------|----------|
| 1 | Navigate to strategy | Load strategy details | StrategyDetailPage | GET /api/strategies/:id |
| 2 | Click "Run Backtest" | Show backtest config modal | BacktestPrompt | - |
| 3 | Configure parameters | Validate inputs | ConfigStep | - |
| 4 | Click "Start Backtest" | Submit backtest request | BacktestActions | POST /api/backtests/run |
| 5 | Wait for results | Show progress indicator | BacktestProgress | Poll GET /api/backtests/:id |
| 6 | View results | Display metrics and charts | BacktestResults | GET /api/backtests/:id |
| 7 | Read AI interpretation | Show AI analysis | AIInterpretation | Included in results |
| 8 | Make decision | Navigate to deploy or adjust | WizardNavigation | - |

## Happy Path

1. User navigates to `/strategies/:id` and clicks "Run Backtest"
2. User configures backtest parameters:
   - Date range (start/end)
   - Initial capital
   - Position sizing
   - Symbol selection
3. System validates configuration and starts backtest
4. User sees progress indicator with estimated time
5. Backtest completes successfully (typically 5-30 seconds)
6. User views results dashboard:
   - Equity curve chart
   - Performance metrics (CAGR, Sharpe, Max DD, Win Rate)
   - Trade list with entry/exit details
   - AI interpretation with recommendations
7. User decides to deploy strategy or adjust parameters

## Sad Paths

| Scenario | Trigger | Expected Behavior | Recovery |
|----------|---------|-------------------|----------|
| Invalid date range | End before start | Show validation error | Fix dates |
| No historical data | Symbol without data | Show "No data available" | Select different symbol |
| Insufficient capital | Capital < min trade | Show capital warning | Increase capital |
| Timeout | Backtest > 5 min | Show timeout message | Reduce date range |
| Server error | Internal error | Show error message | Retry or contact support |
| Strategy config invalid | Missing required fields | Show validation errors | Complete configuration |

## Edge Cases

| Case | Condition | Expected Behavior |
|------|-----------|-------------------|
| Empty trades | No signals generated | Show "No trades executed" with explanation |
| Single trade | Only one trade | Display limited metrics |
| All losses | Every trade loses | Show full metrics with warnings |
| Very long period | >5 years | Show performance warning, suggest chunking |
| Weekend/holiday | Start on non-trading day | Auto-adjust to next trading day |
| Split-adjusted data | Stock split in range | Use split-adjusted prices |

## State Transitions

```
[Idle] --start--> [Running] --complete--> [Completed]
                      |
                      +--fail--> [Failed]
                      |
                      +--cancel--> [Cancelled]
```

### State Definitions

| State | Description | UI Representation |
|-------|-------------|-------------------|
| Idle | No active backtest | "Run Backtest" button enabled |
| Running | Backtest in progress | Progress bar, disabled controls |
| Completed | Backtest finished | Results displayed |
| Failed | Backtest error | Error message with retry option |
| Cancelled | User cancelled | Return to idle state |

## API Sequence

### 1. Start Backtest
```
POST /api/backtests/run
Content-Type: application/json

{
  "strategyId": "uuid",
  "config": {
    "startDate": "2023-01-01",
    "endDate": "2023-12-31",
    "initialCapital": 100000,
    "symbols": ["AAPL", "MSFT"]
  }
}

Response 201:
{
  "id": "backtest-uuid",
  "status": "running",
  "startedAt": "2024-12-29T10:00:00Z"
}
```

### 2. Poll Status
```
GET /api/backtests/:id

Response 200 (Running):
{
  "id": "backtest-uuid",
  "status": "running",
  "progress": 45,
  "currentDate": "2023-06-15"
}

Response 200 (Completed):
{
  "id": "backtest-uuid",
  "status": "completed",
  "metrics": {
    "cagr": 0.234,
    "sharpe": 1.85,
    "maxDrawdown": -0.12,
    "winRate": 0.62,
    "totalTrades": 145,
    "profitFactor": 2.1
  },
  "chartSeries": { ... },
  "trades": [ ... ],
  "interpretation": { ... }
}
```

## Error Handling

| Error | HTTP Code | User Message | Technical Detail |
|-------|-----------|--------------|------------------|
| Validation | 400 | "Please fix configuration errors" | Field-level validation errors |
| Auth expired | 401 | "Session expired, please log in" | Redirect to /login |
| Not found | 404 | "Strategy not found" | Invalid strategy ID |
| Rate limit | 429 | "Too many requests, wait 1 minute" | Rate limit headers |
| Server error | 500 | "Backtest service unavailable" | Log to Sentry |

## Components Involved

| Component | Location | Purpose |
|-----------|----------|---------|
| BacktestPrompt | `components/wizard/BacktestPrompt.tsx` | Configuration modal |
| BacktestProgress | `components/wizard/BacktestProgress.tsx` | Progress indicator |
| BacktestResults | `components/wizard/backtest-results.tsx` | Results display |
| MetricsGrid | `components/wizard/MetricsGrid.tsx` | Performance metrics |
| PerformanceCharts | `components/wizard/PerformanceCharts.tsx` | Equity curve |
| AIInterpretation | `components/wizard/AIInterpretation.tsx` | AI analysis |

## Data Dependencies

| Data | Source | Required |
|------|--------|----------|
| Strategy configuration | Database | Yes |
| Historical prices | Alpaca API | Yes |
| Market calendar | Alpaca API | Yes |
| AI model | LLM Gateway | For interpretation |

## Performance Expectations

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Start latency | < 500ms | > 1s | > 3s |
| Progress update | Every 2s | > 5s | > 10s |
| Total duration (1 year) | < 30s | > 1 min | > 5 min |
| Results render | < 1s | > 2s | > 5s |

## Accessibility Notes

- Progress bar has aria-valuenow for screen readers
- Results tables are keyboard navigable
- Charts have text alternatives via AI interpretation
- Error messages use aria-live for announcements
