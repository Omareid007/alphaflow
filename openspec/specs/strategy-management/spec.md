# Strategy Management Capability

## Purpose

Comprehensive trading strategy lifecycle management system with creation, validation, backtesting, deployment, versioning, and autonomous signal generation. Supports manual, semi-automated, and fully automated execution modes with real-time performance tracking.

## Requirements

### Requirement: Strategy Creation with Parameters

Users SHALL be able to create trading strategies with configurable parameters including entry/exit rules, indicators, risk controls, and execution settings.

#### Scenario: Create strategy with full configuration

- **WHEN** a user provides strategy name, type, and complete configuration object
- **THEN** the system SHALL validate all parameters against schema
- **AND** create strategy in "draft" status with default mode null
- **AND** assign unique strategy ID
- **AND** return HTTP 201 with created strategy

#### Scenario: Create strategy with invalid parameters

- **WHEN** a user provides invalid configuration (e.g., negative lookback period)
- **THEN** the system SHALL reject with HTTP 400 Bad Request
- **AND** return validation error details with field-level messages

#### Scenario: Create strategy with XSS attempt

- **WHEN** a user provides strategy name containing script tags or malicious HTML
- **THEN** the system SHALL sanitize all text inputs
- **AND** create strategy with sanitized values
- **AND** log security event

### Requirement: Strategy Validation Rules

The system SHALL enforce validation rules for strategy configurations including technical indicator parameters, risk thresholds, and universe constraints.

#### Scenario: Validate strategy configuration

- **WHEN** a POST to /api/strategies/validate is made with strategy definition
- **THEN** the system SHALL validate name, type, and parameters
- **AND** return HTTP 200 with validation result
- **AND** include field-level errors if validation fails

#### Scenario: Validate technical indicators

- **WHEN** strategy config includes technical indicators (RSI, MACD, Bollinger Bands)
- **THEN** the system SHALL validate period parameters are positive integers
- **AND** validate threshold values are within acceptable ranges
- **AND** reject configuration if any indicator is invalid

#### Scenario: Validate risk controls

- **WHEN** strategy config includes risk parameters
- **THEN** the system SHALL validate maxPositionPercent is between 0.01 and 1
- **AND** validate dailyLossLimitPercent is between 0.001 and 0.5
- **AND** ensure maxOrdersPerDay is at least 1

### Requirement: Strategy CRUD Operations

Users SHALL be able to list, retrieve, update, and delete strategies with appropriate authorization.

#### Scenario: List all strategies

- **WHEN** an authenticated user requests GET /api/strategies
- **THEN** the system SHALL return all strategies for that user
- **AND** include id, name, type, status, mode, and timestamps
- **AND** return HTTP 200 with array of strategies

#### Scenario: Get strategy by ID

- **WHEN** an authenticated user requests GET /api/strategies/:id
- **THEN** the system SHALL return the complete strategy record
- **AND** include config, performanceSummary, and lastBacktestId
- **AND** return HTTP 404 if strategy not found

#### Scenario: Update strategy (partial)

- **WHEN** an authenticated user sends PATCH /api/strategies/:id with partial update
- **THEN** the system SHALL merge changes with existing strategy
- **AND** validate updated fields against schema
- **AND** update updatedAt timestamp
- **AND** return HTTP 200 with updated strategy

#### Scenario: Update strategy (full replacement)

- **WHEN** an authenticated user sends PUT /api/strategies/:id with complete strategy
- **THEN** the system SHALL validate entire strategy object
- **AND** replace strategy with new configuration
- **AND** return HTTP 200 with updated strategy

#### Scenario: Delete strategy

- **WHEN** an authenticated user sends DELETE /api/strategies/:id
- **THEN** the system SHALL delete the strategy
- **AND** cascade delete to strategy versions (via database constraint)
- **AND** set trades.strategyId and positions.strategyId to NULL
- **AND** return HTTP 200 with success message

### Requirement: Strategy Deployment to Production

Users SHALL be able to deploy strategies to paper or live trading modes with lifecycle state validation and backtest gate enforcement.

#### Scenario: Deploy to paper trading

- **WHEN** a user sends POST /api/strategies/:id/deploy with mode "paper"
- **THEN** the system SHALL validate transition from current status to "paper"
- **AND** update strategy status to "paper" and mode to "paper"
- **AND** start the strategy in alpacaTradingEngine
- **AND** return HTTP 200 with deployed strategy

#### Scenario: Deploy to live trading without backtest

- **WHEN** a user attempts to deploy to "live" without lastBacktestId
- **THEN** the system SHALL reject with HTTP 400 Bad Request
- **AND** return error "A successful backtest is required before live deployment"

#### Scenario: Deploy to live trading with backtest

- **WHEN** a user deploys to "live" and strategy has lastBacktestId
- **THEN** the system SHALL validate transition from current status
- **AND** update strategy status to "live" and mode to "live"
- **AND** start the strategy in alpacaTradingEngine
- **AND** return HTTP 200 with deployed strategy

#### Scenario: Invalid status transition

- **WHEN** a user attempts invalid transition (e.g., "stopped" to "live")
- **THEN** the system SHALL reject with HTTP 400 Bad Request
- **AND** return error listing valid source states for target status

### Requirement: Strategy Parameter Configuration

Users SHALL be able to configure strategy parameters including technical indicators, thresholds, timeframes, position sizing, bracket orders, and exit rules.

#### Scenario: Configure technical indicators

- **WHEN** a user sets signals.technicalIndicators in config
- **THEN** the system SHALL accept array of {name, params, weight}
- **AND** support RSI (period), MACD (fast, slow, signal), SMA (period), Bollinger Bands (period, stdDev)
- **AND** validate weight is between 0 and 1

#### Scenario: Configure position sizing

- **WHEN** a user sets positionSizing in config
- **THEN** the system SHALL accept type ("percent", "fixed", "risk_based")
- **AND** validate value is positive number
- **AND** accept optional maxNotional and minNotional

#### Scenario: Configure bracket orders

- **WHEN** a user sets bracketOrders.enabled to true
- **THEN** the system SHALL accept takeProfitPercent, stopLossPercent, trailingStopPercent
- **AND** use bracket orders when executing trades for this strategy
- **AND** validate all percentages are positive

#### Scenario: Configure exit rules

- **WHEN** a user sets exitRules in config
- **THEN** the system SHALL accept maxHoldingPeriodHours, profitTargetPercent, lossLimitPercent
- **AND** enforce exit rules every 30 seconds via exitRuleEnforcer
- **AND** close positions exceeding holding period or P&L limits

### Requirement: Backtest Execution with Historical Data

Users SHALL be able to execute backtests against historical market data to evaluate strategy performance before deployment.

#### Scenario: Run backtest for strategy

- **WHEN** a user sends POST /api/backtests/run with strategyId, universe, startDate, endDate
- **THEN** the system SHALL fetch historical bars from Alpaca for specified date range
- **AND** execute strategy logic against historical data
- **AND** apply realistic fees, slippage, and execution price rules
- **AND** create backtestRuns record with status "RUNNING"
- **AND** return HTTP 200 with backtest run ID

#### Scenario: Backtest with default universe

- **WHEN** a user omits universe parameter in backtest request
- **THEN** the system SHALL use default symbols ["SPY", "QQQ", "AAPL"]
- **AND** proceed with backtest execution

#### Scenario: Backtest with invalid date range

- **WHEN** a user omits startDate or endDate
- **THEN** the system SHALL reject with HTTP 400 Bad Request
- **AND** return error "startDate and endDate are required"

#### Scenario: Backtest with invalid strategy type

- **WHEN** a user provides invalid strategyType
- **THEN** the system SHALL reject with HTTP 400 Bad Request
- **AND** return error listing valid strategy types

### Requirement: Backtest Date Range Selection

Users SHALL be able to specify custom date ranges and lookback periods for backtests.

#### Scenario: Specify custom date range

- **WHEN** a user provides startDate "2023-01-01" and endDate "2023-12-31"
- **THEN** the system SHALL backtest strategy from Jan 1 to Dec 31, 2023
- **AND** include all market data within range

#### Scenario: Specify lookback days

- **WHEN** a user provides lookbackDays query parameter
- **THEN** the system SHALL calculate date range as (today - lookbackDays) to today
- **AND** use default 365 days if not specified

#### Scenario: Retrieve backtest equity curve

- **WHEN** a user requests GET /api/backtests/:id/equity-curve
- **THEN** the system SHALL return time-series data of equity, cash, exposure
- **AND** order points by timestamp ascending
- **AND** return HTTP 200 with formatted equity curve

### Requirement: Backtest Result Analysis

Users SHALL be able to retrieve comprehensive backtest results including performance metrics (Sharpe ratio, Sortino ratio, max drawdown, win rate, profit factor).

#### Scenario: Get backtest summary

- **WHEN** a user requests GET /api/backtests/:id
- **THEN** the system SHALL return resultsSummary with performance metrics
- **AND** include totalReturn, sharpeRatio, sortinoRatio, maxDrawdown, winRate, profitFactor
- **AND** return HTTP 200 with backtest run

#### Scenario: Get backtest trades

- **WHEN** a user requests GET /api/backtests/:id/trades
- **THEN** the system SHALL return all trade events for the backtest
- **AND** include symbol, side, qty, price, fees, slippage, reason, orderType
- **AND** order trades by timestamp ascending
- **AND** return HTTP 200 with formatted trades

#### Scenario: List all backtests

- **WHEN** a user requests GET /api/backtests with limit and offset
- **THEN** the system SHALL return paginated list of backtest runs
- **AND** include status, strategyId, createdAt, resultsSummary
- **AND** default to 50 results with offset 0

#### Scenario: Backtest not found

- **WHEN** a user requests GET /api/backtests/:id for non-existent backtest
- **THEN** the system SHALL return HTTP 404 Not Found
- **AND** return error "Backtest not found"

### Requirement: Strategy Versioning

Users SHALL be able to create, activate, archive, and retrieve strategy versions with change tracking and backtest validation.

#### Scenario: Create strategy version

- **WHEN** a user sends POST /api/strategies/versions with strategyId, name, spec
- **THEN** the system SHALL auto-increment version number
- **AND** sanitize name and description to prevent XSS
- **AND** create version with status "draft"
- **AND** return HTTP 201 with created strategy version

#### Scenario: Get strategy versions

- **WHEN** a user requests GET /api/strategies/versions?strategyId=xxx
- **THEN** the system SHALL return all versions for that strategy
- **AND** order by version number descending
- **AND** limit to 50 versions by default

#### Scenario: Activate strategy version with backtest

- **WHEN** a user sends POST /api/strategies/versions/:id/activate
- **THEN** the system SHALL verify strategy has successful backtest (status "DONE")
- **AND** update version status to "active"
- **AND** set activatedAt timestamp
- **AND** return HTTP 200 with activated version

#### Scenario: Activate strategy version without backtest

- **WHEN** a user attempts to activate version without successful backtest
- **THEN** the system SHALL reject with HTTP 400 Bad Request
- **AND** return error "Strategy must have at least one successful backtest before activation"

#### Scenario: Archive strategy version

- **WHEN** a user sends POST /api/strategies/versions/:id/archive
- **THEN** the system SHALL update version status to "archived"
- **AND** return HTTP 200 with archived version

#### Scenario: Get latest strategy version

- **WHEN** a user requests GET /api/strategies/versions/:strategyId/latest
- **THEN** the system SHALL return the highest version number for that strategy
- **AND** return HTTP 404 if no versions exist

### Requirement: Live Strategy Monitoring

Users SHALL be able to monitor running strategies in real-time including status, last check time, errors, and execution state.

#### Scenario: Get strategy status

- **WHEN** a user requests GET /api/strategies/:id/status
- **THEN** the system SHALL return strategy metadata and alpacaTradingEngine state
- **AND** include isActive, status, mode, isRunning, lastCheck, error
- **AND** return HTTP 200 with status object

#### Scenario: Get running strategies

- **WHEN** a user requests GET /api/strategies/running
- **THEN** the system SHALL return all strategies with status "paper" or "live"
- **AND** include only active strategies
- **AND** return HTTP 200 with array of running strategies

#### Scenario: Toggle strategy active state

- **WHEN** a user sends POST /api/strategies/:id/toggle
- **THEN** the system SHALL invert isActive boolean
- **AND** update strategy record
- **AND** return HTTP 200 with updated strategy

### Requirement: Strategy Performance Tracking

Users SHALL be able to track strategy performance including P&L, win rate, trade metrics, and position status.

#### Scenario: Get strategy performance metrics

- **WHEN** a user requests GET /api/strategies/:id/performance
- **THEN** the system SHALL calculate real-time metrics from database trades
- **AND** include totalTrades, closingTrades, winningTrades, losingTrades, winRate
- **AND** calculate realizedPnl, unrealizedPnl, totalPnl
- **AND** calculate avgWin, avgLoss, avgTrade, profitFactor
- **AND** return current positions with unrealizedPnl
- **AND** return recent 10 trades ordered by executedAt descending

#### Scenario: Update strategy performance summary

- **WHEN** a user sends POST /api/strategies/:id/metrics/update
- **THEN** the system SHALL fetch all trades for strategy
- **AND** calculate totalReturn, winRate, sharpeRatio, maxDrawdown, totalTrades
- **AND** cache results in strategy.performanceSummary
- **AND** return HTTP 200 with updated strategy

#### Scenario: No trades for performance calculation

- **WHEN** a user requests metrics update for strategy with zero trades
- **THEN** the system SHALL return HTTP 200
- **AND** include message "No trades to calculate metrics"
- **AND** not modify performanceSummary

### Requirement: Autonomous Strategy Signal Generation

The system SHALL autonomously generate trading signals using technical indicators, market data, and strategy configuration.

#### Scenario: Run signal pipeline in full_auto mode

- **WHEN** strategy executionMode is "full_auto" and triggers fire
- **THEN** the system SHALL fetch market data for all symbols in universe
- **AND** calculate configured technical indicators (RSI, MACD, SMA, Bollinger Bands)
- **AND** generate composite signal score weighted by indicator weights
- **AND** validate signals against guards (position limits, risk controls)
- **AND** execute approved signals immediately via actionExecutor
- **AND** return pipeline result with signalsExecuted count

#### Scenario: Run signal pipeline in manual mode

- **WHEN** strategy executionMode is "manual"
- **THEN** the system SHALL generate signals and validate against guards
- **AND** queue approved signals to Redis hash for user review
- **AND** set signal expiry to 15 minutes
- **AND** return pipeline result with pendingSignals array

#### Scenario: Generate signal with insufficient data

- **WHEN** market data has fewer than 20 bars for a symbol
- **THEN** the system SHALL log insufficient data warning
- **AND** skip signal generation for that symbol
- **AND** return null signal

#### Scenario: Approve pending signal

- **WHEN** a user approves a pending signal via approveSignal(signalId)
- **THEN** the system SHALL verify signal is in "pending" status
- **AND** check signal has not expired (expiresAt > now)
- **AND** execute signal via actionExecutor
- **AND** update signal status to "approved" in Redis
- **AND** return ActionResult

#### Scenario: Reject pending signal

- **WHEN** a user rejects a pending signal via rejectSignal(signalId)
- **THEN** the system SHALL update signal status to "rejected" in Redis
- **AND** log rejection event
- **AND** return true

#### Scenario: Signal blocked by guards

- **WHEN** generated signal violates guard constraints
- **THEN** the system SHALL increment signalsBlocked counter
- **AND** log guard violation with blockedBy reasons
- **AND** not execute or queue the signal

## Security

### Input Sanitization

All user-provided text fields MUST be sanitized to prevent XSS attacks:

- Strategy names sanitized via `sanitizeInput()`
- Strategy descriptions sanitized via `sanitizeInput()`
- Universe symbols sanitized via `sanitizeArray()`
- Version change notes sanitized before storage

### Authorization

All strategy endpoints MUST enforce authentication:

- `requireAuth` middleware for user operations (GET, POST, PATCH, PUT, DELETE)
- `requireAdmin` middleware for AI validation endpoint (semi-trusted AI service)
- Session-based authentication with HTTP-only cookies

### Rate Limiting

The following endpoints SHOULD enforce rate limiting to prevent abuse:

- POST /api/strategies (strategy creation)
- POST /api/backtests/run (backtest execution - resource intensive)
- POST /api/strategies/:id/orders (order execution)

### Backtest Gate for Live Deployment

Strategies MUST have successful backtest before live deployment:

- Activation of strategy versions requires backtest with status "DONE"
- Direct deployment to "live" mode requires lastBacktestId to be set
- Prevents untested strategies from trading real money

### Position Close Confirmation

Stopping strategies with open positions MUST require explicit confirmation:

- First call returns requiresConfirmation: true with position count
- User must confirm closePositions decision
- Prevents accidental position abandonment

## API Endpoints

| Method | Path                                        | Auth Required | Description                        |
| ------ | ------------------------------------------- | ------------- | ---------------------------------- |
| GET    | /api/strategies                             | Yes           | List all strategies                |
| POST   | /api/strategies                             | Yes           | Create new strategy                |
| GET    | /api/strategies/:id                         | Yes           | Get strategy by ID                 |
| PATCH  | /api/strategies/:id                         | Yes           | Update strategy (partial)          |
| PUT    | /api/strategies/:id                         | Yes           | Update strategy (full)             |
| DELETE | /api/strategies/:id                         | Yes           | Delete strategy                    |
| POST   | /api/strategies/:id/toggle                  | Yes           | Toggle active state                |
| POST   | /api/strategies/:id/start                   | Yes           | Start strategy in trading engine   |
| POST   | /api/strategies/:id/stop                    | Yes           | Stop strategy in trading engine    |
| GET    | /api/strategies/:id/status                  | Yes           | Get real-time strategy status      |
| POST   | /api/strategies/:id/deploy                  | Yes           | Deploy to paper/live mode          |
| POST   | /api/strategies/:id/pause                   | Yes           | Pause running strategy             |
| POST   | /api/strategies/:id/resume                  | Yes           | Resume paused strategy             |
| POST   | /api/strategies/:id/lifecycle/stop          | Yes           | Stop with position close option    |
| POST   | /api/strategies/:id/backtest/start          | Yes           | Start backtest lifecycle           |
| POST   | /api/strategies/:id/backtest/complete       | Yes           | Complete backtest with results     |
| POST   | /api/strategies/:id/reset                   | Yes           | Reset stopped strategy to draft    |
| POST   | /api/strategies/:id/metrics/update          | Yes           | Update performance metrics         |
| GET    | /api/strategies/running                     | Yes           | Get all running strategies         |
| POST   | /api/strategies/validate                    | Yes           | Validate strategy configuration    |
| POST   | /api/strategies/backtest                    | Yes           | Run generic backtest               |
| GET    | /api/strategies/:id/performance             | Yes           | Get strategy performance dashboard |
| POST   | /api/strategies/:id/orders                  | Yes           | Execute trade via strategy config  |
| GET    | /api/strategies/:id/orders                  | Yes           | Get orders for strategy            |
| POST   | /api/strategies/:id/close-position          | Yes           | Close position via strategy        |
| GET    | /api/strategies/:id/execution-context       | Yes           | Get parsed execution context       |
| POST   | /api/strategies/:id/preview-position-size   | Yes           | Preview position size calculation  |
| GET    | /api/strategies/versions                    | Yes           | List strategy versions             |
| POST   | /api/strategies/versions                    | Yes           | Create strategy version            |
| GET    | /api/strategies/versions/:id                | Yes           | Get strategy version               |
| PATCH  | /api/strategies/versions/:id                | Yes           | Update strategy version            |
| POST   | /api/strategies/versions/:id/activate       | Yes           | Activate strategy version          |
| POST   | /api/strategies/versions/:id/archive        | Yes           | Archive strategy version           |
| GET    | /api/strategies/versions/:strategyId/latest | Yes           | Get latest version                 |
| POST   | /api/backtests/run                          | Yes           | Execute backtest                   |
| GET    | /api/backtests                              | Yes           | List backtest runs                 |
| GET    | /api/backtests/:id                          | Yes           | Get backtest run                   |
| GET    | /api/backtests/:id/equity-curve             | Yes           | Get equity curve data              |
| GET    | /api/backtests/:id/trades                   | Yes           | Get backtest trades                |

## Database Schema

### strategies table

- `id` (varchar, primary key) - Auto-generated UUID
- `name` (text, not null) - Strategy name
- `type` (text, not null) - Strategy type identifier
- `description` (text, nullable) - Strategy description
- `isActive` (boolean, default false) - Legacy active flag
- `status` (text, default "draft") - Lifecycle status (draft, backtesting, backtested, paper, live, paused, stopped)
- `mode` (text, nullable) - Trading mode (paper, live) when deployed
- `templateId` (text, default "custom") - Algorithm template reference
- `config` (jsonb, default {}) - Strategy configuration object
- `lastBacktestId` (varchar, nullable) - Reference to last successful backtest
- `performanceSummary` (jsonb, nullable) - Cached performance metrics
- `assets` (text[], nullable) - Asset universe
- `parameters` (text, nullable) - Legacy parameters field
- `createdAt` (timestamp, not null) - Creation timestamp
- `updatedAt` (timestamp, not null) - Last update timestamp

**Indexes**: status_idx, mode_idx, template_id_idx

### strategy_versions table

- `id` (varchar, primary key) - Auto-generated UUID
- `strategyId` (varchar, foreign key → strategies.id, cascade delete, not null) - Parent strategy
- `version` (integer, not null) - Version number (unique per strategy)
- `name` (text, not null) - Version name
- `spec` (jsonb, not null) - Strategy specification
- `universeConfig` (jsonb, nullable) - Universe configuration
- `signalsConfig` (jsonb, nullable) - Signals configuration
- `riskConfig` (jsonb, nullable) - Risk configuration
- `llmPolicy` (jsonb, nullable) - LLM policy settings
- `promptTemplate` (text, nullable) - Prompt template
- `status` (text, default "draft") - Version status (draft, active, archived, deprecated)
- `dryRunResult` (jsonb, nullable) - Dry run results
- `changeNotes` (text, nullable) - Version change notes
- `createdBy` (varchar, nullable) - Creator user ID
- `createdAt` (timestamp, not null) - Creation timestamp
- `activatedAt` (timestamp, nullable) - Activation timestamp

**Indexes**: strategy_id_idx, status_idx
**Unique Constraint**: (strategyId, version)

### backtest_runs table

- `id` (varchar, primary key) - Auto-generated UUID
- `createdAt` (timestamp, not null) - Creation timestamp
- `updatedAt` (timestamp, not null) - Last update timestamp
- `status` (text, default "QUEUED") - Run status (QUEUED, RUNNING, DONE, FAILED)
- `strategyId` (varchar, foreign key → strategies.id, set null) - Strategy reference
- `strategyConfigHash` (text, not null) - Config hash for caching
- `strategyConfig` (jsonb, not null) - Strategy configuration snapshot
- `universe` (text[], not null) - Symbols to backtest
- `broker` (text, not null) - Broker for execution simulation
- `timeframe` (text, not null) - Bar timeframe (1Day, 1Hour, etc.)
- `startDate` (text, not null) - Backtest start date
- `endDate` (text, not null) - Backtest end date
- `initialCash` (numeric, not null) - Starting capital
- `feesModel` (jsonb, not null) - Fee calculation model
- `slippageModel` (jsonb, not null) - Slippage model
- `executionPriceRule` (text, not null) - Execution price rule (NEXT_OPEN, NEXT_CLOSE)
- `dataSource` (text, not null) - Market data source
- `provenance` (jsonb, nullable) - Version provenance data
- `resultsSummary` (jsonb, nullable) - Performance summary
- `errorMessage` (text, nullable) - Error message if failed
- `runtimeMs` (integer, nullable) - Execution time in milliseconds

**Indexes**: status_idx, strategy_id_idx, created_at_idx

### backtest_trade_events table

- `id` (varchar, primary key) - Auto-generated UUID
- `runId` (varchar, foreign key → backtest_runs.id, cascade delete, not null) - Backtest run
- `ts` (timestamp, not null) - Trade timestamp
- `symbol` (text, not null) - Asset symbol
- `side` (text, not null) - Trade side (buy, sell)
- `qty` (numeric, not null) - Trade quantity
- `price` (numeric, not null) - Execution price
- `reason` (text, not null) - Trade reason/trigger
- `orderType` (text, not null) - Order type
- `fees` (numeric, not null) - Fees paid
- `slippage` (numeric, not null) - Slippage amount
- `positionAfter` (numeric, not null) - Position size after trade
- `cashAfter` (numeric, not null) - Cash balance after trade

**Indexes**: run_id_idx, ts_idx, symbol_idx

### backtest_equity_curve table

- `id` (varchar, primary key) - Auto-generated UUID
- `runId` (varchar, foreign key → backtest_runs.id, cascade delete, not null) - Backtest run
- `ts` (timestamp, not null) - Timestamp
- `equity` (numeric, not null) - Total equity value
- `cash` (numeric, not null) - Cash balance
- `exposure` (numeric, not null) - Market exposure

**Indexes**: run_id_idx, ts_idx

## Error Handling

All strategy endpoints MUST use standardized error responses:

**400 Bad Request**: Invalid request format, validation errors, or invalid state transitions
**404 Not Found**: Strategy, version, or backtest not found
**500 Internal Server Error**: Database errors, external service failures

Error response format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable description",
  "statusCode": 400,
  "details": [
    { "field": "lookbackPeriod", "message": "Must be a positive integer" }
  ]
}
```

## Dependencies

- `@shared/schema` - Strategy, backtest, and version schemas
- `@shared/strategy-spec` - Strategy specification validation
- `zod` - Runtime validation
- `drizzle-orm` - Database ORM
- `alpaca-trade-api` - Market data and broker integration
- `redis` - Pending signal persistence
- `/server/storage` - Database storage layer
- `/server/connectors/alpaca` - Alpaca API client
- `/server/trading/alpaca-trading-engine` - Strategy execution engine
- `/server/services/strategy-lifecycle-service` - Lifecycle state machine
- `/server/services/backtesting` - Backtesting engine
- `/server/autonomous/strategy-signal-pipeline` - Signal generation
- `/server/autonomous/trigger-evaluator` - Trigger evaluation
- `/server/autonomous/guard-validator` - Guard validation
- `/server/autonomous/action-executor` - Signal execution
- `/server/lib/sanitization` - XSS prevention
- `/scripts/shared/technical-indicators` - RSI, MACD, SMA, Bollinger Bands calculations

## Files

**Routes**: `/server/routes/strategies.ts`, `/server/routes/backtests.ts`
**Services**: `/server/services/strategy-lifecycle-service.ts`, `/server/services/backtesting.ts`
**Autonomous**: `/server/autonomous/strategy-signal-pipeline.ts`, `/server/autonomous/trigger-evaluator.ts`, `/server/autonomous/guard-validator.ts`, `/server/autonomous/action-executor.ts`
**Schema**: `/shared/schema/trading.ts`, `/shared/schema/strategy-versioning.ts`, `/shared/schema/backtest.ts`, `/shared/strategy-spec.ts`
**Storage**: `/server/storage.ts` (getStrategies, createStrategy, updateStrategy, deleteStrategy methods)
**Trading Engine**: `/server/trading/alpaca-trading-engine.ts`, `/server/trading/strategy-order-service.ts`
**Validation**: `/server/middleware/validate.ts`, `/server/lib/sanitization.ts`
