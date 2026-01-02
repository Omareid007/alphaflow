# Portfolio Management Capability

## Purpose

Comprehensive portfolio management system providing real-time position tracking, risk monitoring, automated rebalancing, and portfolio analytics. Integrates with Alpaca broker for live data, implements advanced risk controls, and supports multi-strategy portfolio optimization.

## Requirements

### Requirement: Portfolio Overview Retrieval

The system SHALL provide real-time portfolio metrics including equity, buying power, cash, and position counts.

#### Scenario: Successful portfolio snapshot

- **WHEN** an authenticated user requests portfolio snapshot
- **THEN** the system SHALL fetch current account data from Alpaca
- **AND** aggregate all open positions with real-time prices
- **AND** calculate daily P/L, total P/L, and P/L percentages
- **AND** return comprehensive snapshot with HTTP 200
- **AND** include timestamp, position counts by side (long/short)

#### Scenario: Broker unavailable

- **WHEN** Alpaca API is unavailable during snapshot request
- **THEN** the system SHALL return HTTP 503 Service Unavailable
- **AND** include source metadata indicating live data unavailable
- **AND** log the connectivity failure
- **AND** NOT fallback to stale database data without explicit warning

#### Scenario: Real-time metrics calculation

- **WHEN** portfolio snapshot is generated
- **THEN** daily P/L SHALL be calculated as (current equity - last equity)
- **AND** daily P/L percentage SHALL be (daily P/L / last equity) \* 100
- **AND** total P/L SHALL combine realized P/L from closed trades + unrealized P/L from open positions
- **AND** all monetary values SHALL be parsed to floating-point numbers

### Requirement: Position List and Details

Users SHALL be able to retrieve all open positions with real-time pricing and P/L.

#### Scenario: Live position retrieval

- **WHEN** an authenticated user requests positions
- **THEN** the system SHALL fetch positions from Alpaca (source of truth)
- **AND** filter out dust positions below 0.0001 shares threshold
- **AND** enrich each position with metadata (fetchedAt, source)
- **AND** sync positions to database asynchronously in background
- **AND** return HTTP 200 with enriched positions array

#### Scenario: Dust position filtering

- **WHEN** positions are retrieved from broker
- **THEN** the system SHALL exclude positions with absolute quantity < 0.0001 shares
- **AND** prevent display of floating-point residuals from closed trades
- **AND** only return positions with meaningful holdings

#### Scenario: Position details structure

- **WHEN** position data is returned
- **THEN** each position SHALL include symbol, quantity, entry price, current price
- **AND** include market value, unrealized P/L, unrealized P/L percentage
- **AND** include cost basis, side (long/short), asset class (us_equity/crypto)
- **AND** include unique position ID from broker

### Requirement: Position Reconciliation with Broker

The system SHALL periodically reconcile database positions with broker positions to ensure data consistency.

#### Scenario: Scheduled reconciliation

- **WHEN** reconciliation interval (5 minutes) has elapsed
- **THEN** the system SHALL fetch positions from both broker and database
- **AND** compare quantities, prices, and holdings
- **AND** identify added, removed, and conflicting positions
- **AND** update database to match broker (source of truth)
- **AND** return reconciliation result with status and metrics

#### Scenario: Quantity mismatch resolution

- **WHEN** a position exists in both broker and database with different quantities
- **THEN** the system SHALL create a conflict record
- **AND** automatically resolve by updating database to broker quantity
- **AND** log the conflict with resolution details
- **AND** mark conflict as resolved

#### Scenario: Externally closed position

- **WHEN** a position exists in database but not in broker
- **THEN** the system SHALL mark the position as closed in database
- **AND** log the external closure event
- **AND** increment removed position count in reconciliation result

#### Scenario: Externally opened position

- **WHEN** a position exists in broker but not in database
- **THEN** the system SHALL create the position in database
- **AND** populate with broker data (quantity, entry price, current price)
- **AND** set strategyId to null (unknown origin)
- **AND** increment added position count in reconciliation result

#### Scenario: Force reconciliation

- **WHEN** user explicitly triggers reconciliation via API
- **THEN** the system SHALL bypass interval check
- **AND** execute immediate reconciliation regardless of last run time
- **AND** return detailed results with duration and conflict count

### Requirement: Portfolio Historical Snapshots

The system SHALL maintain historical portfolio snapshots for performance tracking and analysis.

#### Scenario: Snapshot creation

- **WHEN** portfolio metrics are calculated
- **THEN** the system SHALL store equity, positions, P/L at specific timestamp
- **AND** preserve point-in-time portfolio composition
- **AND** enable historical performance analysis

### Requirement: Risk Metrics Calculation

The system SHALL calculate comprehensive portfolio risk metrics including VaR, concentration, sector exposure, and drawdown.

#### Scenario: Risk metrics calculation

- **WHEN** portfolio risk is checked
- **THEN** the system SHALL calculate max position concentration (largest position / equity)
- **AND** calculate sector exposure for each sector
- **AND** calculate portfolio VaR at 95% and 99% confidence levels
- **AND** calculate current drawdown from peak equity
- **AND** determine overall risk level (LOW, MEDIUM, HIGH, CRITICAL)

#### Scenario: Position concentration breach

- **WHEN** any single position exceeds 5% of portfolio value
- **THEN** the system SHALL flag concentrationBreached = true
- **AND** add alert indicating symbol and concentration percentage
- **AND** set risk level to HIGH or CRITICAL

#### Scenario: Sector concentration breach

- **WHEN** any sector exceeds 25% of portfolio value
- **THEN** the system SHALL flag sectorBreached = true
- **AND** add alert indicating sector name and exposure percentage
- **AND** escalate risk level accordingly

#### Scenario: Drawdown breach

- **WHEN** current drawdown exceeds 5% from peak equity
- **THEN** the system SHALL add critical alert
- **AND** set risk level to CRITICAL
- **AND** calculate drawdown as (peak - current) / peak

#### Scenario: VaR estimation

- **WHEN** risk metrics are calculated
- **THEN** portfolioVaR95 SHALL estimate 95% confidence daily loss (2% of equity)
- **AND** portfolioVaR99 SHALL estimate 99% confidence daily loss (3% of equity)
- **AND** VaR SHALL be used for position sizing and risk budgeting

### Requirement: Allocation Targets Configuration

Users SHALL be able to define allocation policies with risk constraints and rebalancing rules.

#### Scenario: Create allocation policy

- **WHEN** a user creates a new allocation policy
- **THEN** the system SHALL validate policy parameters
- **AND** store max position weight percentage (default 8%)
- **AND** store max sector weight percentage (default 25%)
- **AND** store profit-taking threshold percentage (default 20%)
- **AND** store rebalancing frequency (daily/weekly/monthly)
- **AND** return HTTP 200 with created policy

#### Scenario: Activate allocation policy

- **WHEN** a user activates an allocation policy
- **THEN** the system SHALL deactivate all other policies (only one active)
- **AND** set isActive = true for selected policy
- **AND** update policy timestamp
- **AND** return HTTP 200 with updated policy

#### Scenario: Policy validation

- **WHEN** allocation policy is created or updated
- **THEN** maxPositionWeightPct SHALL be between 1 and 20
- **AND** maxSectorWeightPct SHALL be between 5 and 100
- **AND** rebalanceFrequency SHALL be one of: daily, weekly, monthly
- **AND** return HTTP 400 if validation fails

### Requirement: Rebalancing Triggers

The system SHALL support threshold-based and scheduled rebalancing triggers.

#### Scenario: Manual rebalancing trigger

- **WHEN** a user manually triggers rebalancing
- **THEN** the system SHALL create a new rebalance run with status "running"
- **AND** generate unique trace ID for tracking
- **AND** set trigger type to "manual"
- **AND** capture current portfolio snapshot as input
- **AND** return HTTP 200 with run details

#### Scenario: Scheduled rebalancing trigger

- **WHEN** rebalancing frequency interval elapses
- **THEN** the system SHALL automatically trigger rebalancing
- **AND** set trigger type to "scheduled"
- **AND** follow active allocation policy rules

#### Scenario: Threshold-based rebalancing trigger

- **WHEN** a position exceeds target weight by overweight threshold (default 50%)
- **THEN** the system SHALL trigger rebalancing
- **AND** set trigger type to "threshold"
- **AND** focus on overweight position reduction

### Requirement: Rebalancing Execution

The system SHALL execute portfolio rebalancing based on allocation policy rules.

#### Scenario: Position rebalancing

- **WHEN** rebalancing is executed
- **THEN** the system SHALL calculate target weights for each position
- **AND** compare current weights to target weights
- **AND** generate order intents to adjust positions toward targets
- **AND** respect max position and sector weight constraints
- **AND** execute orders via trading engine
- **AND** update rebalance run with executed orders

#### Scenario: Rebalancing completion

- **WHEN** all rebalancing orders are executed or failed
- **THEN** the system SHALL update rebalance run status to "completed"
- **AND** set completedAt timestamp
- **AND** store rationale explaining rebalancing decisions
- **AND** log outcome metrics

#### Scenario: Rebalancing failure

- **WHEN** rebalancing encounters errors during execution
- **THEN** the system SHALL update status to "failed"
- **AND** store error details in rationale
- **AND** log failure for investigation
- **AND** NOT leave portfolio in inconsistent state

### Requirement: Position Sizing Limits

The system SHALL enforce maximum position size limits to prevent over-concentration.

#### Scenario: Position size validation

- **WHEN** an order would create or increase a position
- **THEN** the system SHALL calculate new position value after order
- **AND** calculate position percentage of total equity
- **AND** reject order if position would exceed 5% limit
- **AND** return validation failure with reason

#### Scenario: Position limit enforcement

- **WHEN** validating new position
- **THEN** estimated position value SHALL be calculated as (current quantity + new quantity) \* current price
- **AND** position percentage SHALL be estimated value / total equity
- **AND** if percentage > 5%, return positionLimitOk = false
- **AND** add failure reason to validation response

### Requirement: Sector Concentration Limits

The system SHALL enforce sector-level exposure limits to prevent correlated risk.

#### Scenario: Sector exposure validation

- **WHEN** an order would increase sector exposure
- **THEN** the system SHALL fetch sector classification for symbol
- **AND** calculate current sector exposure from existing positions
- **AND** calculate new sector exposure including proposed position
- **AND** reject order if sector exposure would exceed 25% limit
- **AND** return validation failure with sector details

#### Scenario: Sector classification

- **WHEN** determining sector for a symbol
- **THEN** the system SHALL first check in-memory cache
- **AND** if not cached, query universe_fundamentals table
- **AND** if not in database, use fallback sector mapping
- **AND** cache sector classification for performance
- **AND** return sector name

#### Scenario: Sector limit enforcement

- **WHEN** sector exposure is calculated
- **THEN** all positions in same sector SHALL be summed
- **AND** sector percentage SHALL be sector value / total equity
- **AND** if percentage > 25%, return sectorLimitOk = false
- **AND** block new trades in that sector

### Requirement: Tax-Aware Rebalancing

The system SHALL support tax-loss harvesting and tax-efficient rebalancing strategies.

#### Scenario: Partial take-profit levels

- **WHEN** a position reaches profit target
- **THEN** the system SHALL check partial take-profit rules
- **AND** close specified percentage of position at each level
- **AND** mark profit level as executed with timestamp
- **AND** preserve remaining position for further gains

#### Scenario: Trailing stop adjustment

- **WHEN** a position is in profit above activation threshold
- **THEN** the system SHALL update high water mark to current price
- **AND** calculate trailing stop as high water mark - trail percentage
- **AND** move stop to breakeven + 0.5% when profit exceeds trigger
- **AND** log trailing stop updates with reason

### Requirement: Portfolio Analytics and Reporting

The system SHALL provide comprehensive portfolio analytics including performance metrics and attributions.

#### Scenario: Kelly criterion position sizing

- **WHEN** calculating optimal position size
- **THEN** the system SHALL use win rate, average win, average loss
- **AND** calculate raw Kelly percentage = (winRate _ avgWin - lossRate _ avgLoss) / avgWin
- **AND** apply fractional Kelly (default 0.25) for risk management
- **AND** cap position size at max position limit
- **AND** return suggested position size in dollars

#### Scenario: Market regime detection

- **WHEN** determining market conditions
- **THEN** the system SHALL fetch VIX, yield spread, unemployment data
- **AND** classify regime as bullish, bearish, sideways, volatile, or unknown
- **AND** adjust position sizing based on regime (bullish: 1.25x, bearish: 0.5x, volatile: 0.6x)
- **AND** cache regime analysis with timestamp

#### Scenario: Performance metrics calculation

- **WHEN** portfolio performance is analyzed
- **THEN** the system SHALL calculate total return, annualized return
- **AND** calculate Sharpe ratio (risk-adjusted return)
- **AND** calculate Sortino ratio (downside risk-adjusted return)
- **AND** calculate maximum drawdown and drawdown duration
- **AND** calculate win rate, profit factor, average win/loss

## Security

### Position Data Access Control

All position and portfolio endpoints MUST enforce authentication via `requireAuth` middleware.

### Broker API Credentials

Alpaca API credentials MUST be stored in environment variables:

- `ALPACA_API_KEY` - API key identifier
- `ALPACA_SECRET_KEY` - Secret key for authentication
- `ALPACA_BASE_URL` - Paper or live trading endpoint

### Source of Truth Protocol

Position data MUST follow source of truth hierarchy:

1. **Broker (Alpaca)** - Primary source of truth for current positions
2. **Database** - Write-behind cache and audit trail
3. **Stale data warning** - Return 503 with metadata if broker unavailable

### Admin Operations Authorization

Dangerous operations MUST be marked with security flags:

- Close position: `authorizedByOrchestrator: true`
- Close all positions: `authorizedByOrchestrator: true, isEmergencyStop: true`

### Risk Limit Enforcement

Hard risk limits MUST be enforced at multiple layers:

- Position sizing: 5% max per position
- Sector exposure: 25% max per sector
- Daily loss: 5% max daily drawdown
- Emergency stop: Triggered at VIX > 35 or critical risk level

## API Endpoints

| Method | Path                            | Auth Required | Description                                |
| ------ | ------------------------------- | ------------- | ------------------------------------------ |
| GET    | /api/positions/snapshot         | Yes           | Get comprehensive portfolio snapshot       |
| GET    | /api/positions                  | Yes           | List all open positions from broker        |
| GET    | /api/positions/broker           | Yes           | Alias for /api/positions (backward compat) |
| GET    | /api/positions/:id              | Yes           | Get specific position by ID from database  |
| POST   | /api/positions                  | Yes           | Create position in database                |
| PATCH  | /api/positions/:id              | Yes           | Update position in database                |
| DELETE | /api/positions/:id              | Yes           | Delete position from database              |
| POST   | /api/positions/reconcile        | Yes           | Trigger position reconciliation            |
| GET    | /api/positions/reconcile/status | Yes           | Get reconciliation status                  |
| POST   | /api/positions/close/:symbol    | Yes           | Close specific position by symbol          |
| POST   | /api/positions/close-all        | Yes           | Emergency close all positions              |
| GET    | /api/allocation-policies        | Yes           | List allocation policies                   |
| POST   | /api/allocation-policies        | Yes           | Create allocation policy                   |
| PATCH  | /api/allocation-policies/:id    | Yes           | Update allocation policy                   |
| DELETE | /api/allocation-policies/:id    | Yes           | Delete allocation policy                   |
| GET    | /api/rebalance/runs             | Yes           | List rebalancing runs                      |
| POST   | /api/rebalance/trigger          | Yes           | Trigger manual rebalancing                 |

## MCP Server Tools

The custom `trading-utilities` MCP server provides portfolio management tools:

| Tool                    | Purpose                                                 |
| ----------------------- | ------------------------------------------------------- |
| `check_portfolio_risk`  | Calculate VaR, concentration, sector exposure, drawdown |
| `get_live_positions`    | Fetch current positions with real-time P/L              |
| `validate_order`        | Pre-trade validation against risk limits                |
| `market_status`         | Check market hours and trading availability             |
| `check_circuit_breaker` | Verify circuit breaker state                            |

## Database Schema

### positions table

- `id` (varchar, primary key) - Unique position identifier
- `user_id` (varchar, foreign key → users.id, cascade delete) - Position owner
- `symbol` (text, not null) - Asset symbol
- `quantity` (numeric, not null) - Current position size
- `entry_price` (numeric, not null) - Average entry price
- `current_price` (numeric, nullable) - Latest market price
- `unrealized_pnl` (numeric, nullable) - Unrealized profit/loss
- `side` (text, not null) - Position side ("long" or "short")
- `opened_at` (timestamp, not null) - Position open timestamp
- `entry_time` (timestamp, not null) - Entry time for holding period tracking
- `strategy_id` (varchar, foreign key → strategies.id, set null) - Associated strategy

**Indexes**:

- `positions_user_id_idx` on `user_id` for efficient user lookups

### allocation_policies table

- `id` (varchar, primary key) - Unique policy identifier
- `name` (text, unique, not null) - Policy name
- `description` (text, nullable) - Policy description
- `is_active` (boolean, default false, not null) - Whether policy is active
- `max_position_weight_pct` (numeric, default "8") - Max position weight percentage
- `max_sector_weight_pct` (numeric, default "25") - Max sector weight percentage
- `min_liquidity_tier` (text, default "B") - Minimum liquidity tier
- `profit_taking_threshold_pct` (numeric, default "20") - Profit-taking threshold
- `overweight_threshold_pct` (numeric, default "50") - Overweight trigger threshold
- `rotation_top_n` (integer, default 10) - Number of top assets for rotation
- `rebalance_frequency` (text, default "daily") - Rebalancing frequency
- `created_by` (varchar, foreign key → users.id, set null) - Policy creator
- `created_at` (timestamp, not null) - Creation timestamp
- `updated_at` (timestamp, not null) - Last update timestamp

**Indexes**:

- `allocation_policies_active_idx` on `is_active`

### rebalance_runs table

- `id` (varchar, primary key) - Unique run identifier
- `policy_id` (varchar, foreign key → allocation_policies.id, set null) - Associated policy
- `trace_id` (text, not null) - Trace ID for tracking
- `status` (text, not null, default "pending") - Run status (pending/running/completed/failed)
- `trigger_type` (text, not null) - Trigger type (manual/scheduled/threshold)
- `input_snapshot` (jsonb, nullable) - Portfolio snapshot at start
- `order_intents` (jsonb, nullable) - Planned orders
- `executed_orders` (jsonb, nullable) - Actual executed orders
- `rationale` (text, nullable) - Rebalancing rationale
- `started_at` (timestamp, not null) - Run start timestamp
- `completed_at` (timestamp, nullable) - Run completion timestamp

**Indexes**:

- `rebalance_runs_trace_id_idx` on `trace_id`
- `rebalance_runs_status_idx` on `status`

## Error Handling

All portfolio management endpoints MUST use standardized error responses:

**400 Bad Request**: Invalid request format or validation errors
**401 Unauthorized**: Missing or invalid authentication
**404 Not Found**: Position or policy not found
**500 Internal Server Error**: Unexpected server errors
**503 Service Unavailable**: Broker API unavailable

Error response format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable description",
  "statusCode": 503,
  "_source": {
    "type": "unavailable",
    "broker": "alpaca",
    "lastAttempt": "2025-01-02T10:30:00Z"
  }
}
```

## Configuration

### Position Reconciliation

- **Interval**: 5 minutes (300000ms)
- **Dust threshold**: 0.0001 shares
- **Concurrency**: Prevents concurrent reconciliation runs
- **Conflict resolution**: Always use broker as source of truth

### Risk Thresholds

- **Max position concentration**: 5% of portfolio value
- **Max sector exposure**: 25% of portfolio value
- **Max daily drawdown**: 5% from peak equity
- **Warning threshold**: 80% of limit
- **Critical threshold**: 95% of limit

### Market Regime Multipliers

- **Bullish** (VIX < 15, positive yield spread): 1.25x position size
- **Bearish** (negative yield spread): 0.5x position size
- **Volatile** (VIX > 30): 0.6x position size
- **Sideways**: 0.75x position size

### Kelly Criterion

- **Fractional Kelly**: 0.25 (25% of full Kelly)
- **Max position cap**: Respects 5% limit regardless of Kelly suggestion

## Dependencies

### External Services

- **Alpaca Markets API** - Live position data, account information
- **FRED API** - VIX, macro indicators for market regime detection

### Internal Services

- `position-reconciler` - Broker/database sync
- `advanced-rebalancing-service` - Partial exits, trailing stops, Kelly sizing
- `dynamic-risk-manager` - Adaptive risk limits based on market conditions
- `sector-exposure-service` - Sector classification and limit enforcement
- `dynamic-exposure-controller` - Position sizing and exposure management

### Libraries

- `drizzle-orm` - Database ORM
- `zod` - Schema validation
- `decimal.js` - Precision decimal math for financial calculations

## Performance Considerations

### Caching Strategies

- **Sector classifications**: In-memory cache with database fallback
- **VIX data**: 5-minute TTL cache to reduce FRED API calls
- **Position snapshots**: Async database writes don't block API responses

### Parallel Data Fetching

- Account and positions fetched in parallel via `Promise.all`
- Multiple validation checks executed concurrently

### Dust Position Filtering

- Filter dust positions (< 0.0001 shares) early to reduce processing
- Prevents display of meaningless floating-point residuals

## Monitoring and Observability

### Key Metrics

- Position reconciliation duration and conflict count
- Risk level distribution over time
- Rebalancing trigger frequency and success rate
- Sector exposure trends
- Max drawdown tracking

### Logging

All operations MUST use structured logging via Pino:

- Position reconciliation: Log conflicts, additions, removals
- Risk breaches: Log concentration and sector violations
- Rebalancing: Log trigger type, order counts, outcomes
- Broker errors: Log API failures with retry context

### Alerts

Critical conditions that trigger alerts:

- Position concentration > 5%
- Sector exposure > 25%
- Daily drawdown > 5%
- Risk level = CRITICAL
- Broker connectivity failures

## Files

**Routes**:

- `server/routes/positions.ts` - Position CRUD and reconciliation
- `server/routes/portfolio-snapshot.ts` - Portfolio metrics
- `server/routes/allocation-rebalance.ts` - Allocation policies and rebalancing

**Services**:

- `server/services/position-reconciler.ts` - Broker/database sync
- `server/services/advanced-rebalancing-service.ts` - Advanced exit strategies
- `server/services/dynamic-risk-manager.ts` - Adaptive risk management
- `server/services/sector-exposure-service.ts` - Sector limits
- `server/services/dynamic-exposure-controller.ts` - Position sizing

**Schema**:

- `shared/schema/trading.ts` - Positions table
- `shared/schema/allocation.ts` - Allocation policies and rebalance runs

**MCP Server**:

- `mcp-servers/trading-utilities/src/index.ts` - Portfolio risk tools
- `mcp-servers/trading-utilities/src/types.ts` - Type definitions

**Utilities**:

- `shared/position-mapper.ts` - Position enrichment and mapping
- `server/utils/money.ts` - Decimal math, Kelly formula, trailing stops
