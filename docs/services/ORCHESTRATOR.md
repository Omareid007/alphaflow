# Orchestrator Service Specification

> **Domain:** Trading Cycle Coordination  
> **Owner:** Platform Team  
> **Status:** Design

---

## Service Overview

The Orchestrator Service coordinates the autonomous trading agent loop, managing trading cycles, strategy execution, and saga coordination across services.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ORCHESTRATOR SERVICE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │  Cycle Manager  │  │  Saga Coord     │  │  State Manager  │            │
│  │                 │  │                 │  │                 │            │
│  │ • Scheduling    │  │ • Trade saga    │  │ • Agent status  │            │
│  │ • Strategy loop │  │ • Rollback      │  │ • Checkpoints   │            │
│  │ • Rate limiting │  │ • Compensation  │  │ • Recovery      │            │
│  │ • Prioritization│  │ • Timeout       │  │ • Audit log     │            │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘            │
│           │                    │                    │                      │
│           └────────────────────┴────────────────────┘                      │
│                                │                                            │
│                    ┌───────────▼───────────┐                               │
│                    │   Event Coordinator   │                               │
│                    │   (Subscribe/Publish) │                               │
│                    └───────────────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Specification

### REST Endpoints

#### Agent Control

```yaml
# Start Autonomous Agent
POST /api/v1/agent/start
Request:
  strategies?: string[]      # Optional: specific strategies to run
  mode?: "normal" | "conservative" | "aggressive"
Response:
  status: "started"
  agentId: string
  startedAt: string
  activeStrategies: string[]

# Stop Autonomous Agent
POST /api/v1/agent/stop
Request:
  reason?: string
  cancelOpenOrders?: boolean  # Default: false
Response:
  status: "stopped"
  stoppedAt: string
  openPositions: number
  pendingOrders: number

# Get Agent Status
GET /api/v1/agent/status
Response:
  status: "running" | "stopped" | "paused" | "error"
  uptime: number             # Seconds
  currentCycle: {
    id: string
    type: string
    startedAt: string
    progress: number         # 0-100
  }
  lastCycle: {
    id: string
    completedAt: string
    duration: number
    decisions: number
    orders: number
  }
  stats: {
    cyclesCompleted: number
    decisionsGenerated: number
    ordersExecuted: number
    errors: number
  }
  activeStrategies: Strategy[]
  nextScheduledCycle: string

# Pause Agent
POST /api/v1/agent/pause
Request:
  duration?: number          # Minutes, optional
Response:
  status: "paused"
  resumeAt?: string

# Resume Agent
POST /api/v1/agent/resume
Response:
  status: "running"
  resumedAt: string
```

#### Strategy Management

```yaml
# List Strategies
GET /api/v1/strategies
Response:
  strategies: [
    {
      id: string
      name: string
      type: string
      status: "active" | "paused" | "stopped"
      symbols: string[]
      riskMode: string
      lastRun: string
      performance: {
        pnl: number
        trades: number
        winRate: number
      }
    }
  ]

# Activate Strategy
POST /api/v1/strategies/:strategyId/activate
Response:
  status: "active"
  activatedAt: string

# Deactivate Strategy
POST /api/v1/strategies/:strategyId/deactivate
Request:
  closePositions?: boolean
Response:
  status: "stopped"
  deactivatedAt: string

# Trigger Manual Analysis
POST /api/v1/strategies/:strategyId/analyze
Request:
  symbols?: string[]
Response:
  cycleId: string
  status: "started"
```

#### Cycle History

```yaml
# Get Cycle History
GET /api/v1/cycles
Query:
  limit: number (default: 20)
  status?: "completed" | "failed" | "cancelled"
Response:
  cycles: [
    {
      id: string
      type: string
      startedAt: string
      completedAt: string
      duration: number
      status: string
      decisions: number
      orders: number
      errors: Error[]
    }
  ]

# Get Cycle Details
GET /api/v1/cycles/:cycleId
Response:
  cycle: CycleDetails
  decisions: Decision[]
  orders: Order[]
  logs: LogEntry[]
```

### Event Subscriptions

| Event Type | Description | Action |
|------------|-------------|--------|
| `system.heartbeat` | Service health | Monitor service health |
| `market.session.changed` | Market open/close | Start/stop trading |
| `trade.order.filled` | Order filled | Update cycle state |
| `ai.decision.generated` | Decision ready | Trigger execution |
| `system.error.occurred` | Error detected | Error handling |

### Event Publications

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `orchestrator.cycle.started` | Cycle begins | Cycle info |
| `orchestrator.cycle.completed` | Cycle ends | Results |
| `orchestrator.analysis.requested` | Need decision | Analysis request |
| `orchestrator.strategy.activated` | Strategy activated | Strategy info |
| `orchestrator.strategy.deactivated` | Strategy stopped | Strategy info |
| `orchestrator.error.occurred` | Error in cycle | Error details |

---

## Data Model

### Database Schema

```sql
-- orchestration schema
CREATE SCHEMA orchestration;

-- Agent status
CREATE TABLE orchestration.agent_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(20) NOT NULL DEFAULT 'stopped',
  started_at TIMESTAMP WITH TIME ZONE,
  stopped_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  resume_at TIMESTAMP WITH TIME ZONE,
  mode VARCHAR(20) DEFAULT 'normal',
  cycles_completed INTEGER DEFAULT 0,
  decisions_generated INTEGER DEFAULT 0,
  orders_executed INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cycles
CREATE TABLE orchestration.cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'started',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  strategies_processed INTEGER DEFAULT 0,
  decisions_generated INTEGER DEFAULT 0,
  orders_submitted INTEGER DEFAULT 0,
  orders_filled INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cycle logs
CREATE TABLE orchestration.cycle_logs (
  id BIGSERIAL PRIMARY KEY,
  cycle_id UUID REFERENCES orchestration.cycles(id),
  level VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  context JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Strategy schedules
CREATE TABLE orchestration.strategy_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL,
  schedule_type VARCHAR(20) NOT NULL,  -- 'interval', 'cron', 'event'
  schedule_value VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cycles_started ON orchestration.cycles(started_at);
CREATE INDEX idx_cycles_status ON orchestration.cycles(status);
CREATE INDEX idx_logs_cycle ON orchestration.cycle_logs(cycle_id);
CREATE INDEX idx_schedules_next ON orchestration.strategy_schedules(next_run_at) WHERE enabled = TRUE;
```

---

## Cycle Types

### Analysis Cycle

The main trading cycle that analyzes market conditions and generates decisions.

```typescript
interface AnalysisCycle {
  type: 'analysis';
  interval: number;          // Default: 60 seconds
  steps: [
    'fetch_market_data',
    'evaluate_positions',
    'generate_decisions',
    'validate_decisions',
    'execute_orders',
    'update_state'
  ];
}

async function runAnalysisCycle(strategies: Strategy[]): Promise<CycleResult> {
  const cycleId = generateCycleId();
  
  publishEvent('orchestrator.cycle.started', {
    cycleId,
    type: 'analysis',
    strategies: strategies.map(s => s.id)
  });
  
  try {
    // 1. Fetch current market data
    const marketData = await fetchMarketData(strategies);
    
    // 2. Evaluate existing positions
    const positions = await evaluatePositions();
    
    // 3. Generate AI decisions for each strategy
    const decisions = await Promise.all(
      strategies.map(s => requestDecision(s, marketData, positions))
    );
    
    // 4. Validate decisions against risk rules
    const validatedDecisions = await validateDecisions(decisions);
    
    // 5. Execute approved orders
    const orders = await executeOrders(validatedDecisions);
    
    // 6. Update state
    await updateAgentState(cycleId, { decisions, orders });
    
    publishEvent('orchestrator.cycle.completed', {
      cycleId,
      status: 'success',
      decisions: decisions.length,
      orders: orders.length
    });
    
    return { cycleId, status: 'success', decisions, orders };
  } catch (error) {
    publishEvent('orchestrator.cycle.completed', {
      cycleId,
      status: 'failed',
      error: error.message
    });
    throw error;
  }
}
```

### Heartbeat Cycle

Periodic health check and status update.

```typescript
interface HeartbeatCycle {
  type: 'heartbeat';
  interval: 30000;           // 30 seconds
  actions: [
    'check_service_health',
    'sync_positions',
    'update_status'
  ];
}
```

### Rebalance Cycle

Periodic portfolio rebalancing based on targets.

```typescript
interface RebalanceCycle {
  type: 'rebalance';
  schedule: '0 9 * * 1-5';   // 9 AM weekdays
  actions: [
    'calculate_target_weights',
    'compare_current_weights',
    'generate_rebalance_orders',
    'execute_orders'
  ];
}
```

---

## Saga Patterns

### Trade Execution Saga

```typescript
interface TradeExecutionSaga {
  steps: [
    { action: 'reserve_buying_power', compensate: 'release_buying_power' },
    { action: 'submit_order', compensate: 'cancel_order' },
    { action: 'wait_for_fill', compensate: 'handle_partial_fill' },
    { action: 'update_position', compensate: 'rollback_position' },
    { action: 'record_trade', compensate: 'void_trade' }
  ];
  timeout: 60000;            // 1 minute
  retries: 3;
}

async function executeTradeOrder(decision: Decision): Promise<SagaResult> {
  const saga = new Saga('trade_execution');
  
  try {
    // Step 1: Reserve buying power
    await saga.execute('reserve_buying_power', async () => {
      await reserveBuyingPower(decision.symbol, decision.suggestedQuantity);
    });
    
    // Step 2: Submit order
    const order = await saga.execute('submit_order', async () => {
      return await submitOrder({
        symbol: decision.symbol,
        side: decision.action.toLowerCase(),
        quantity: decision.suggestedQuantity,
        type: 'market'
      });
    });
    
    // Step 3: Wait for fill
    await saga.execute('wait_for_fill', async () => {
      await waitForOrderFill(order.orderId, { timeout: 30000 });
    });
    
    // Step 4: Update position
    await saga.execute('update_position', async () => {
      await syncPositions();
    });
    
    // Step 5: Record trade
    await saga.execute('record_trade', async () => {
      await recordTrade(order, decision);
    });
    
    return saga.complete();
  } catch (error) {
    // Compensate in reverse order
    await saga.compensate();
    throw error;
  }
}
```

---

## Configuration

```yaml
orchestrator:
  server:
    port: 3005
    host: "0.0.0.0"
  
  cycles:
    analysis:
      interval: 60000        # 1 minute
      maxConcurrent: 1
      timeout: 120000        # 2 minutes
    heartbeat:
      interval: 30000        # 30 seconds
    rebalance:
      schedule: "0 9 * * 1-5"  # 9 AM weekdays
  
  trading:
    marketHoursOnly: true
    preMarketStart: "04:00"
    regularStart: "09:30"
    regularEnd: "16:00"
    afterHoursEnd: "20:00"
    timezone: "America/New_York"
  
  sagas:
    tradeExecution:
      timeout: 60000
      retries: 3
      retryDelay: 1000
  
  database:
    host: ${DB_HOST}
    port: ${DB_PORT}
    name: ai_trader
    schema: orchestration
  
  eventBus:
    url: ${NATS_URL}
    publishPrefix: "ai-trader.orchestrator"
    subscriptions:
      - "ai-trader.system.heartbeat"
      - "ai-trader.market.session.*"
      - "ai-trader.trade.order.*"
      - "ai-trader.ai.decision.*"
```

---

## Health & Metrics

### Health Endpoint

```json
GET /health
{
  "status": "healthy",
  "checks": {
    "database": "connected",
    "eventBus": "connected",
    "services": {
      "trading-engine": "healthy",
      "ai-decision": "healthy",
      "market-data": "healthy"
    }
  },
  "agent": {
    "status": "running",
    "uptime": 3600,
    "currentCycle": "analysis"
  }
}
```

### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `orchestrator_cycles_total` | Counter | Total cycles by type |
| `orchestrator_cycle_duration_ms` | Histogram | Cycle execution time |
| `orchestrator_decisions_total` | Counter | Decisions generated |
| `orchestrator_orders_total` | Counter | Orders executed |
| `orchestrator_errors_total` | Counter | Errors by type |
| `orchestrator_agent_uptime` | Gauge | Agent uptime seconds |
| `orchestrator_strategies_active` | Gauge | Active strategies |
