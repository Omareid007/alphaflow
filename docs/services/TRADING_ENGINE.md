# Trading Engine Service Specification

> **Domain:** Order Execution & Position Management  
> **Owner:** Trading Team  
> **Status:** Design

---

## Service Overview

The Trading Engine Service is responsible for all order lifecycle management, position tracking, and risk enforcement. It acts as the single point of integration with the Alpaca broker API.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRADING ENGINE SERVICE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │  Order Manager  │  │Position Tracker │  │  Risk Engine    │            │
│  │                 │  │                 │  │                 │            │
│  │ • Submit        │  │ • Track open    │  │ • Pre-trade     │            │
│  │ • Cancel        │  │ • P&L calc      │  │ • Position size │            │
│  │ • Modify        │  │ • Sync broker   │  │ • Stop-loss     │            │
│  │ • Status        │  │ • History       │  │ • Buying power  │            │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘            │
│           │                    │                    │                      │
│           └────────────────────┴────────────────────┘                      │
│                                │                                            │
│                    ┌───────────▼───────────┐                               │
│                    │   Alpaca Connector    │                               │
│                    │   (REST + WebSocket)  │                               │
│                    └───────────────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Specification

### REST Endpoints

#### Orders

```yaml
# Submit Order
POST /api/v1/orders
Request:
  symbol: string (required)
  side: "buy" | "sell" (required)
  quantity: number (required)
  type: "market" | "limit" | "stop" | "stop_limit" (required)
  timeInForce: "day" | "gtc" | "ioc" | "fok" (default: "day")
  limitPrice?: number (required for limit orders)
  stopPrice?: number (required for stop orders)
  extendedHours?: boolean (default: false)
  clientOrderId?: string
  strategyId?: string
Response:
  orderId: string
  status: "pending" | "accepted" | "rejected"
  createdAt: string (ISO 8601)

# Cancel Order
DELETE /api/v1/orders/:orderId
Response:
  success: boolean
  message: string

# Get Order Status
GET /api/v1/orders/:orderId
Response:
  orderId: string
  symbol: string
  side: "buy" | "sell"
  quantity: number
  filledQuantity: number
  status: "new" | "partially_filled" | "filled" | "cancelled" | "rejected"
  averagePrice?: number
  createdAt: string
  updatedAt: string

# List Orders
GET /api/v1/orders?status=open&limit=100&after=cursor
Response:
  orders: Order[]
  nextCursor?: string
```

#### Positions

```yaml
# Get All Positions
GET /api/v1/positions
Response:
  positions: Position[]
  totalEquity: number
  buyingPower: number

# Get Position
GET /api/v1/positions/:symbol
Response:
  symbol: string
  quantity: number
  side: "long" | "short"
  averageEntryPrice: number
  currentPrice: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPercent: number

# Close Position
DELETE /api/v1/positions/:symbol
Request:
  quantity?: number (optional, defaults to full position)
Response:
  orderId: string
  status: string

# Close All Positions
DELETE /api/v1/positions
Response:
  closedCount: number
  orderIds: string[]
```

#### Account

```yaml
# Get Account
GET /api/v1/account
Response:
  accountId: string
  equity: number
  cash: number
  buyingPower: number
  daytradeCount: number
  patternDayTrader: boolean
  tradingBlocked: boolean
  accountBlocked: boolean
```

### Event Subscriptions

| Event Type | Description | Action |
|------------|-------------|--------|
| `ai.decision.generated` | AI made a trade decision | Validate & execute if approved |
| `market.session.opened` | Market opened | Enable order submission |
| `market.session.closed` | Market closed | Disable market orders |
| `system.shutdown` | System shutting down | Cancel pending orders |

### Event Publications

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `trade.order.submitted` | Order sent to broker | Order details |
| `trade.order.filled` | Order fully filled | Fill details, P&L |
| `trade.order.partial` | Partial fill received | Fill details |
| `trade.order.rejected` | Broker rejected order | Rejection reason |
| `trade.order.cancelled` | Order cancelled | Cancellation details |
| `trade.position.opened` | New position opened | Position details |
| `trade.position.updated` | Position quantity changed | Updated position |
| `trade.position.closed` | Position fully closed | Final P&L |

---

## Data Model

### Database Schema

```sql
-- trading schema
CREATE SCHEMA trading;

-- Orders table
CREATE TABLE trading.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_order_id VARCHAR(64) UNIQUE,
  client_order_id VARCHAR(64) UNIQUE,
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity DECIMAL(15, 4) NOT NULL,
  filled_quantity DECIMAL(15, 4) DEFAULT 0,
  order_type VARCHAR(20) NOT NULL,
  time_in_force VARCHAR(10) NOT NULL,
  limit_price DECIMAL(15, 4),
  stop_price DECIMAL(15, 4),
  average_fill_price DECIMAL(15, 4),
  status VARCHAR(20) NOT NULL,
  extended_hours BOOLEAN DEFAULT FALSE,
  strategy_id UUID,
  decision_id UUID,
  submitted_at TIMESTAMP WITH TIME ZONE,
  filled_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Positions table (cache of broker positions)
CREATE TABLE trading.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(10) UNIQUE NOT NULL,
  quantity DECIMAL(15, 4) NOT NULL,
  side VARCHAR(5) NOT NULL CHECK (side IN ('long', 'short')),
  average_entry_price DECIMAL(15, 4) NOT NULL,
  current_price DECIMAL(15, 4),
  market_value DECIMAL(15, 2),
  unrealized_pnl DECIMAL(15, 2),
  cost_basis DECIMAL(15, 2),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fills table (individual order fills)
CREATE TABLE trading.fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES trading.orders(id),
  broker_fill_id VARCHAR(64),
  quantity DECIMAL(15, 4) NOT NULL,
  price DECIMAL(15, 4) NOT NULL,
  commission DECIMAL(10, 4) DEFAULT 0,
  filled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_symbol ON trading.orders(symbol);
CREATE INDEX idx_orders_status ON trading.orders(status);
CREATE INDEX idx_orders_strategy ON trading.orders(strategy_id);
CREATE INDEX idx_orders_submitted ON trading.orders(submitted_at);
CREATE INDEX idx_positions_symbol ON trading.positions(symbol);
```

---

## Risk Engine

### Pre-Trade Validation

```typescript
interface PreTradeValidation {
  // Required checks before order submission
  checks: {
    buyingPower: boolean;      // Sufficient buying power
    positionLimit: boolean;    // Not exceeding max position size
    dailyLossLimit: boolean;   // Not exceeding daily loss limit
    marketSession: boolean;    // Market is open (or extended hours enabled)
    symbolTradable: boolean;   // Symbol is tradable
    washTrade: boolean;        // Not a wash trade
    patternDayTrader: boolean; // PDT rule compliance
  };
  
  // Validation result
  approved: boolean;
  rejectionReason?: string;
}
```

### Position Sizing Rules

| Rule | Description | Default |
|------|-------------|---------|
| Max Position Size | % of portfolio in single position | 10% |
| Max Sector Exposure | % of portfolio in single sector | 30% |
| Max Daily Loss | Stop trading if daily loss exceeds | 3% |
| Max Open Positions | Maximum concurrent positions | 20 |

---

## Integration Patterns

### Alpaca WebSocket Integration

```typescript
// Subscribe to order updates
const ws = new WebSocket('wss://paper-api.alpaca.markets/stream');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.stream) {
    case 'trade_updates':
      handleTradeUpdate(data.data);
      break;
  }
};

async function handleTradeUpdate(update: AlpacaTradeUpdate) {
  // Update local order status
  await updateOrderStatus(update.order.id, update.event);
  
  // Publish event to NATS
  switch (update.event) {
    case 'fill':
    case 'partial_fill':
      await publishEvent('trade.order.filled', {
        orderId: update.order.id,
        symbol: update.order.symbol,
        filledQty: update.qty,
        price: update.price,
        timestamp: update.timestamp
      });
      break;
    // ... other events
  }
}
```

---

## Configuration

```yaml
trading-engine:
  server:
    port: 3001
    host: "0.0.0.0"
  
  alpaca:
    baseUrl: ${ALPACA_BASE_URL:https://paper-api.alpaca.markets}
    apiKey: ${ALPACA_API_KEY}
    secretKey: ${ALPACA_SECRET_KEY}
    dataUrl: ${ALPACA_DATA_URL:https://data.alpaca.markets}
  
  risk:
    maxPositionSizePercent: 10
    maxSectorExposurePercent: 30
    maxDailyLossPercent: 3
    maxOpenPositions: 20
    enableWashTradeProtection: true
  
  sync:
    positionSyncInterval: 30000  # 30 seconds
    orderStatusPollInterval: 5000  # 5 seconds
  
  eventBus:
    url: ${NATS_URL}
    publishPrefix: "ai-trader.trade"
    subscriptions:
      - "ai-trader.ai.decision.generated"
      - "ai-trader.market.session.*"
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
    "alpaca": "connected",
    "eventBus": "connected",
    "websocket": "connected"
  },
  "lastOrderAt": "2025-12-12T10:30:00Z",
  "openPositions": 5,
  "pendingOrders": 2
}
```

### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `trading_orders_total` | Counter | Total orders by status |
| `trading_order_latency_ms` | Histogram | Order execution latency |
| `trading_positions_count` | Gauge | Current open positions |
| `trading_buying_power` | Gauge | Available buying power |
| `trading_daily_pnl` | Gauge | Today's P&L |

---

## Error Handling

| Error Code | Description | Action |
|------------|-------------|--------|
| `INSUFFICIENT_FUNDS` | Not enough buying power | Reject order |
| `POSITION_LIMIT` | Would exceed position limit | Reject order |
| `MARKET_CLOSED` | Market not open | Queue or reject |
| `SYMBOL_NOT_TRADABLE` | Symbol suspended/delisted | Reject order |
| `WASH_TRADE` | Potential wash trade | Reject order |
| `BROKER_ERROR` | Alpaca API error | Retry with backoff |

---

## Testing Strategy

### Unit Tests
- Order validation logic
- Risk engine rules
- Position calculations

### Integration Tests
- Alpaca API mocking
- WebSocket event handling
- Database operations

### Contract Tests
- Event schema validation
- API response schemas

### E2E Tests
- Full order lifecycle (paper)
- Position sync accuracy
