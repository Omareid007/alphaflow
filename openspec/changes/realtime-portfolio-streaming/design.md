# Real-Time Portfolio Streaming - Technical Design

## Architecture Overview

### System Components

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                              │
├──────────────────────────────────────────────────────────────────┤
│  usePortfolioStream()                                            │
│    ├─→ useRealtimePositions() ──→ TanStack Query Cache          │
│    ├─→ useRealtimeOrders()    ──→ TanStack Query Cache          │
│    └─→ useRealtimeAccount()   ──→ TanStack Query Cache          │
│                                                                   │
│  WebSocket Client (browser native or React Native)               │
│    - Auto-reconnect with exponential backoff                     │
│    - Message parsing and validation                              │
│    - Fallback to REST polling on failure                         │
└──────────────────────────────────────────────────────────────────┘
                              ↕ WebSocket Protocol
┌──────────────────────────────────────────────────────────────────┐
│                         SERVER LAYER                              │
├──────────────────────────────────────────────────────────────────┤
│  PortfolioStreamManager (server/lib/portfolio-stream.ts)        │
│    ├─→ Connection Manager: Map<userId, Set<Connection>>         │
│    ├─→ Event Router: Subscribe to EventBus                      │
│    ├─→ Batch Aggregator: 1-second window                        │
│    └─→ Broadcaster: Send to authenticated clients               │
│                                                                   │
│  Event Sources:                                                  │
│    ├─→ Alpaca Stream (trade/order updates from broker)          │
│    ├─→ Work Queue (order submission completions)                │
│    ├─→ Position Manager (position sync operations)              │
│    └─→ Order Executor (direct trade execution)                  │
│                                                                   │
│  Event Bus (server/orchestration)                               │
│    - Central event routing                                       │
│    - Event types: trade:executed, order:updated, position:changed│
└──────────────────────────────────────────────────────────────────┘
```

## WebSocket Protocol

### Connection Lifecycle

**1. Connection Establishment**

```typescript
// Client initiates WebSocket connection
const ws = new WebSocket("wss://alphaflow.app/ws/portfolio");

// Server validates session cookie
const cookie = parseUpgradeRequestCookie(req);
const session = await getSession(cookie);
if (!session) {
  ws.close(1008, "Authentication required"); // 1008 = Policy Violation
  return;
}

// Server stores connection
connections.set(userId, new Set([{ ws, subscriptions: new Set() }]));

// Client subscribes to channels
ws.send(
  JSON.stringify({
    type: "subscribe",
    channels: ["positions", "orders", "account"],
  })
);
```

**2. Event Streaming**

```typescript
// Server receives broker event
alpacaStream.on("trade", (tradeUpdate) => {
  // Fetch updated position from database
  const position = await storage.getPosition(tradeUpdate.symbol);

  // Create event
  const event = createPositionUpdateEvent(userId, position);

  // Add to batch window (1-second aggregation)
  batchWindow.add(event);
});

// After 1 second, flush batch
setInterval(() => {
  if (batchWindow.size > 0) {
    const batch = {
      type: "batch",
      timestamp: new Date().toISOString(),
      data: {
        positions: Array.from(batchWindow.positions.values()),
        orders: Array.from(batchWindow.orders.values()),
      },
    };

    // Broadcast to all user's connections subscribed to these channels
    broadcastToUser(userId, batch);
    batchWindow.clear();
  }
}, 1000);
```

**3. Client Processing**

```typescript
// Client receives batch event
ws.onmessage = (message) => {
  const event = JSON.parse(message.data);

  if (event.type === "batch") {
    // Update TanStack Query cache
    if (event.data.positions) {
      queryClient.setQueryData(["positions", userId], (old) => {
        return mergePositions(old, event.data.positions);
      });
    }

    if (event.data.orders) {
      queryClient.setQueryData(["orders", userId], (old) => {
        return mergeOrders(old, event.data.orders);
      });
    }
  }
};
```

**4. Disconnection and Reconnect**

```typescript
// Client detects disconnect
ws.onclose = (event) => {
  setConnectionStatus("disconnected");

  // Exponential backoff reconnection
  const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
  setTimeout(() => reconnect(), delay);

  // Fallback to REST polling after 10 failed reconnects
  if (retryCount > 10) {
    startRestPolling(5000); // Poll every 5 seconds
  }
};
```

**5. Heartbeat**

```typescript
// Server sends ping every 15 seconds
setInterval(() => {
  ws.ping();
}, 15000);

// Server disconnects on pong timeout (30 seconds)
ws.on("pong", () => {
  clearTimeout(pongTimeout);
  pongTimeout = setTimeout(() => {
    ws.close(1000, "Heartbeat timeout");
  }, 30000);
});
```

## Event Schema Specifications

### Event Type: position_update

**Purpose**: Notify client when a position's quantity, price, or P&L changes

**Trigger Conditions**:

- Alpaca trade update received (price change)
- Order fills (quantity change)
- Position manager sync (periodic reconciliation)

**Event Structure**:

```typescript
{
  type: 'position_update',
  timestamp: '2026-01-03T15:30:45.123Z',
  userId: 'user-abc-123',
  data: {
    symbol: 'AAPL',
    quantity: '100',
    currentPrice: '175.50',
    entryPrice: '170.25',
    unrealizedPnl: '525.00',
    unrealizedPnlPercent: '3.08',
    marketValue: '17550.00',
    side: 'long',
    strategyId: 'strategy-xyz',
    openedAt: '2026-01-03T09:30:00.000Z'
  }
}
```

**Frequency**: Variable (depends on market activity)

- During market hours: ~1-100 updates/minute per position
- After hours: Rare (only on order fills)
- Batched: Multiple positions in single message every 1 second

### Event Type: order_update

**Purpose**: Notify client when an order status changes

**Trigger Conditions**:

- Order submitted (status: new)
- Order accepted by broker (status: accepted)
- Order partially filled (status: partially_filled)
- Order completely filled (status: filled)
- Order cancelled/rejected/expired

**Event Structure**:

```typescript
{
  type: 'order_update',
  timestamp: '2026-01-03T15:30:45.123Z',
  userId: 'user-abc-123',
  data: {
    orderId: 'order-123',
    brokerOrderId: 'alpaca-order-456',
    symbol: 'TSLA',
    side: 'buy',
    type: 'limit',
    status: 'filled',
    qty: '50',
    filledQty: '50',
    filledAvgPrice: '245.75',
    limitPrice: '246.00',
    submittedAt: '2026-01-03T15:29:30.000Z',
    filledAt: '2026-01-03T15:30:45.000Z'
  }
}
```

**Frequency**: Burst on order submission, then sporadic

- Submit order: 1 event (status: new)
- Fills occur: 1-10 events (depends on fill chunks)
- Final fill: 1 event (status: filled)

### Event Type: account_update

**Purpose**: Notify client when account balance or equity changes

**Trigger Conditions**:

- Trade execution (cash/equity changes)
- Position value changes (equity changes)
- Manual cash transfer (rare)

**Event Structure**:

```typescript
{
  type: 'account_update',
  timestamp: '2026-01-03T15:30:45.123Z',
  userId: 'user-abc-123',
  data: {
    equity: '104308.75',
    buyingPower: '354905.24',
    cash: '50000.00',
    portfolioValue: '104308.75',
    dayPnl: '1234.56',
    dayPnlPercent: '1.20',
    timestamp: '2026-01-03T15:30:45.000Z'
  }
}
```

**Frequency**: After each trade or significant position value change

- Typically 1-10 updates per minute during active trading
- Batched with position updates for efficiency

### Event Type: trade_executed

**Purpose**: Notify client when a new trade is created in the database

**Trigger Conditions**:

- Order fills and trade record is created
- Manual trade entry (rare)

**Event Structure**:

```typescript
{
  type: 'trade_executed',
  timestamp: '2026-01-03T15:30:45.123Z',
  userId: 'user-abc-123',
  data: {
    tradeId: 'trade-789',
    symbol: 'NVDA',
    side: 'sell',
    quantity: '25',
    price: '520.50',
    pnl: '1250.00',
    executedAt: '2026-01-03T15:30:45.000Z',
    strategyId: 'strategy-xyz'
  }
}
```

**Frequency**: Each completed trade (1-50 per day typical)

### Event Type: batch

**Purpose**: Aggregate multiple events into single message to reduce bandwidth

**Event Structure**:

```typescript
{
  type: 'batch',
  timestamp: '2026-01-03T15:30:45.123Z',
  userId: 'user-abc-123',
  data: {
    positions: [PositionUpdate, PositionUpdate, ...],
    orders: [OrderUpdate, OrderUpdate, ...],
    account: AccountUpdate,
    trades: [TradeExecuted]
  }
}
```

**Frequency**: Every 1 second (if events occurred in that window)

## Authentication and Security

### Connection Authentication

**Method**: Session cookie (same as REST API and SSE)

**Flow**:

```typescript
// 1. Client connects with cookies
const ws = new WebSocket("wss://alphaflow.app/ws/portfolio");
// Browser automatically includes cookies in upgrade request

// 2. Server extracts and validates session
const cookieHeader = upgradeReq.headers.cookie;
const sessionId = parseCookie(cookieHeader, "session");
const session = await getSession(sessionId);

if (!session) {
  ws.close(1008, "Unauthorized"); // 1008 = Policy Violation
  return;
}

// 3. Store userId with connection
const userId = session.userId;
connectionManager.add(userId, ws);
```

### Event Isolation

**Requirement**: Users MUST only receive events for their own portfolio

**Implementation**:

```typescript
function broadcastToUser(userId: string, event: PortfolioEvent) {
  const userConnections = connectionManager.get(userId);
  if (!userConnections) return;

  for (const conn of userConnections) {
    // Check if client subscribed to this event's channel
    const channel = getChannelForEventType(event.type);
    if (!conn.subscriptions.has(channel)) continue;

    // Send only if WebSocket is open
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(event));
    }
  }
}
```

### Rate Limiting

**Connection Limits**:

- Max 5 WebSocket connections per user (prevents abuse)
- Max 100 total concurrent connections (server capacity)
- Max 100 messages/second per connection (flood protection)

**Implementation**:

```typescript
function handleNewConnection(userId: string, ws: WebSocket) {
  const userConnections = connectionManager.get(userId) || new Set();

  if (userConnections.size >= 5) {
    ws.close(1008, "Maximum connections exceeded (5 per user)");
    return;
  }

  const totalConnections = getTotalConnectionCount();
  if (totalConnections >= 100) {
    ws.close(1013, "Server capacity reached - try again later");
    return;
  }

  userConnections.add({ ws, subscriptions: new Set(), messageCount: 0 });
  connectionManager.set(userId, userConnections);
}
```

## Performance Optimizations

### 1. Server-Side Batching

**Problem**: 23,400 position updates/day per position = excessive messages

**Solution**: 1-second batching window

```typescript
class BatchAggregator {
  private positions = new Map<string, PositionUpdate>();
  private orders = new Map<string, OrderUpdate>();
  private account: AccountUpdate | null = null;
  private flushTimer: NodeJS.Timeout;

  constructor(private userId: string) {
    this.flushTimer = setInterval(() => this.flush(), 1000);
  }

  addPosition(symbol: string, update: PositionUpdate) {
    this.positions.set(symbol, update); // Overwrites old update in same window
  }

  flush() {
    if (this.positions.size === 0 && this.orders.size === 0 && !this.account) {
      return; // Nothing to send
    }

    const batch = {
      type: "batch",
      timestamp: new Date().toISOString(),
      userId: this.userId,
      data: {
        positions: Array.from(this.positions.values()),
        orders: Array.from(this.orders.values()),
        account: this.account,
      },
    };

    broadcastToUser(this.userId, batch);

    // Clear for next window
    this.positions.clear();
    this.orders.clear();
    this.account = null;
  }
}
```

**Impact**: Reduces events from ~23,400/day to ~1,170/day per position (95% reduction)

### 2. Smart Diffing

**Problem**: Not all price changes are significant (e.g., $175.50 → $175.51 = $1 on 100 shares)

**Solution**: Only emit updates for changes > 0.1%

```typescript
function shouldEmitPositionUpdate(
  oldPosition: Position,
  newPosition: Position
): boolean {
  const oldPnl = parseFloat(oldPosition.unrealizedPnl || "0");
  const newPnl = parseFloat(newPosition.unrealizedPnl || "0");
  const pnlChange = Math.abs(newPnl - oldPnl);
  const marketValue = parseFloat(newPosition.marketValue || "1");
  const changePercent = (pnlChange / marketValue) * 100;

  return changePercent > 0.1; // Only emit if > 0.1% change
}
```

**Impact**: Further reduces events by ~80% during low-volatility periods

### 3. Client-Side Throttling

**Problem**: UI re-renders on every WebSocket message can cause jank

**Solution**: requestAnimationFrame batching

```typescript
function useRealtimePositions() {
  const [pendingUpdates, setPendingUpdates] = useState<PositionUpdate[]>([]);

  useEffect(() => {
    let rafId: number;

    const flushUpdates = () => {
      if (pendingUpdates.length > 0) {
        queryClient.setQueryData(["positions"], (old) => {
          return mergeBatch(old, pendingUpdates);
        });
        setPendingUpdates([]);
      }
      rafId = requestAnimationFrame(flushUpdates);
    };

    rafId = requestAnimationFrame(flushUpdates);
    return () => cancelAnimationFrame(rafId);
  }, [pendingUpdates]);

  // On WebSocket message
  const handlePositionUpdate = (update: PositionUpdate) => {
    setPendingUpdates((prev) => [...prev, update]);
  };
}
```

**Impact**: Smooth 60fps UI updates even with burst events

## Reliability and Fault Tolerance

### Reconnection Strategy

**Exponential Backoff with Jitter**:

```typescript
function calculateReconnectDelay(attemptNumber: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1);
  const jitter = Math.random() * 1000; // 0-1 second random jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

// Attempt 1: 1s + jitter = ~1-2s
// Attempt 2: 2s + jitter = ~2-3s
// Attempt 3: 4s + jitter = ~4-5s
// Attempt 4: 8s + jitter = ~8-9s
// Attempt 5+: 30s (max)
```

**Max Retry Attempts**: 10 (total time: ~2 minutes)
**Fallback**: After 10 failed attempts → switch to REST polling every 5 seconds

### REST Reconciliation

**Purpose**: Detect missed events during WebSocket interruptions

**Strategy**:

```typescript
// Every 60 seconds, fetch from REST and compare with WebSocket cache
setInterval(async () => {
  const restPositions = await fetchPositions(); // REST API
  const wsPositions = queryClient.getQueryData(["positions"]); // WebSocket cache

  const diff = findDifferences(restPositions, wsPositions);

  if (diff.length > 0) {
    log.warn("Detected missed events via reconciliation", {
      count: diff.length,
    });
    // Merge REST data as source of truth
    queryClient.setQueryData(["positions"], restPositions);
  }
}, 60000);
```

**Impact**: Guarantees data accuracy within 60 seconds even with message loss

### Message Loss Handling

**WebSocket Characteristics**:

- TCP-based: Guaranteed delivery at transport layer
- Application layer: No ACKs in basic WebSocket protocol

**Our Approach** (Simple, Best-Effort):

- Rely on TCP guarantees for in-flight messages
- Use REST reconciliation to detect missing messages (60s interval)
- No complex message queuing or sequence numbers in V1

**Future Enhancement** (V2):

- Add sequence numbers to events
- Client tracks last received sequence
- Request gap-fill on reconnection: `{type: 'catch_up', since_sequence: 123}`

## TanStack Query Integration

### Cache Update Strategy

**Goal**: WebSocket updates should feel instant, but REST refetch is source of truth

**Implementation**:

```typescript
// In useRealtimePositions()
const queryClient = useQueryClient();

const handlePositionUpdate = (update: PositionUpdate) => {
  // Optimistic update from WebSocket
  queryClient.setQueryData(
    ["positions", userId],
    (old: Position[] | undefined) => {
      if (!old) return [update]; // No cache yet

      // Find and update existing position
      const index = old.findIndex((p) => p.symbol === update.symbol);
      if (index >= 0) {
        const newPositions = [...old];
        newPositions[index] = {
          ...old[index],
          ...update,
          wsUpdatedAt: Date.now(),
        };
        return newPositions;
      }

      // New position (order just filled)
      return [...old, { ...update, wsUpdatedAt: Date.now() }];
    }
  );
};

// Query configuration
const { data: positions } = useQuery({
  queryKey: ["positions", userId],
  queryFn: fetchPositions,
  staleTime: 60000, // Consider fresh for 60 seconds
  refetchInterval: 300000, // Backup polling every 5 minutes
  // WebSocket updates are more frequent, but Query still refetches periodically
});
```

**Trade-offs**:

- **Pro**: Instant UI updates from WebSocket
- **Pro**: Periodic REST refetch ensures data accuracy
- **Con**: Slight bandwidth overhead (WebSocket + periodic REST)
- **Decision**: Acceptable - correctness over efficiency

### Optimistic Updates on User Actions

**Scenario**: User submits order via UI

**Flow**:

```typescript
// 1. User clicks "Buy 10 AAPL"
const mutation = useMutation({
  mutationFn: submitOrder,
  onMutate: async (newOrder) => {
    // Optimistic update: Show order as "pending" immediately
    await queryClient.cancelQueries(["orders"]);
    const previous = queryClient.getQueryData(["orders"]);
    queryClient.setQueryData(["orders"], (old) => [
      ...old,
      { id: "temp-" + Date.now(), status: "pending", ...newOrder },
    ]);
    return { previous };
  },
  onSuccess: (order) => {
    // WebSocket will send order_update event within 500ms
    // That will replace optimistic entry with real order
  },
  onError: (err, newOrder, context) => {
    // Rollback optimistic update
    queryClient.setQueryData(["orders"], context.previous);
  },
});
```

**Benefits**: UI feels instant, no waiting for server roundtrip

## Monitoring and Observability

### Metrics to Track

**1. Connection Metrics** (gauge)

- `websocket_active_connections{userId}`: Current connection count per user
- `websocket_total_connections`: Total active connections server-wide

**2. Event Metrics** (counter + rate)

- `websocket_events_emitted{type}`: Total events emitted by type
- `websocket_events_delivered{type}`: Successfully delivered events
- `websocket_events_dropped{type}`: Failed deliveries

**3. Latency Metrics** (histogram)

- `websocket_event_latency_ms`: Time from event creation to client delivery
- Percentiles: p50, p95, p99

**4. Error Metrics** (counter)

- `websocket_auth_failures`: Failed authentication attempts
- `websocket_disconnects{reason}`: Disconnections by reason (timeout, error, client_close)
- `websocket_reconnects`: Successful reconnections

**5. Batch Metrics**

- `websocket_batch_size{type}`: Events per batch message
- `websocket_batch_efficiency`: Reduction ratio (events → messages)

### Admin Dashboard

**Endpoint**: GET /api/admin/websocket-stats

**Response**:

```json
{
  "activeConnections": 45,
  "totalMessagesDelivered": 123456,
  "avgLatencyMs": 120,
  "p95LatencyMs": 350,
  "p99LatencyMs": 480,
  "disconnectRate": 0.5,
  "reconnectSuccessRate": 0.97,
  "batchEfficiency": 0.95,
  "errorRate": 0.002,
  "uptimePercent": 99.8,
  "connectionsByUser": [
    {"userId": "user-123", "connections": 2, "uptime": "4h 23m"},
    ...
  ]
}
```

### Alerting Rules

**Alert 1**: High Disconnect Rate

- **Condition**: > 10 disconnects/minute
- **Severity**: Warning
- **Action**: Check server health, Alpaca stream status

**Alert 2**: High Event Latency

- **Condition**: p95 latency > 1 second for 5 minutes
- **Severity**: Warning
- **Action**: Check server load, consider scaling

**Alert 3**: WebSocket Service Down

- **Condition**: 0 active connections for > 2 minutes (during market hours)
- **Severity**: Critical
- **Action**: Check server logs, restart WebSocket service

**Alert 4**: Alpaca Stream Silent

- **Condition**: No events from Alpaca for > 5 minutes (during market hours)
- **Severity**: Critical
- **Action**: Check Alpaca stream connection, trigger manual reconnect

## Deployment and Rollout

### Environment-Based Configuration

**Feature Flag**: ENABLE_REALTIME_PORTFOLIO

**Server** (`server/lib/portfolio-stream.ts`):

```typescript
export function initializePortfolioStream(server: http.Server) {
  if (process.env.ENABLE_REALTIME_PORTFOLIO !== "true") {
    log.info(
      "PortfolioStream",
      "Real-time streaming disabled via feature flag"
    );
    return;
  }

  const portfolioStreamManager = new PortfolioStreamManager(server);
  portfolioStreamManager.start();
  log.info("PortfolioStream", "Real-time portfolio streaming enabled");
}
```

**Client** (`client/hooks/usePortfolioStream.ts`):

```typescript
export function usePortfolioStream() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Check if feature enabled via health check
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setEnabled(data.features?.realtimePortfolio === true))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) {
    return {
      connectionStatus: "disabled",
      subscribe: () => {},
      unsubscribe: () => {},
    };
  }

  // ... actual WebSocket logic
}
```

### Gradual Rollout Plan

**Week 1: Staging**

- Deploy to staging environment
- Enable for QA team (5 users)
- Run load tests (100 simulated connections)
- Fix any bugs found

**Week 2: Production 10%**

- Deploy to production with flag=false
- Enable for 10% of users (user whitelist)
- Monitor: Connection success rate, latency, errors
- Collect user feedback

**Week 3: Production 50%**

- Expand whitelist to 50% of users
- Monitor: System stability, resource usage
- Verify no degradation in REST API performance

**Week 4: Production 100%**

- Remove whitelist, set ENABLE_REALTIME_PORTFOLIO=true as default
- Monitor: Full-scale metrics
- Prepare for potential spike in connections

### Rollback Procedure

**If problems detected**:

1. Set ENABLE_REALTIME_PORTFOLIO=false in environment
2. Restart server (or use runtime config reload if implemented)
3. Clients detect WebSocket unavailable within 5 seconds
4. Clients automatically fall back to REST polling
5. No data loss, no user intervention required

**Time to Rollback**: < 2 minutes (environment variable change + server restart)

## Testing Specifications

### Integration Test Example

```typescript
describe("Real-Time Portfolio Streaming", () => {
  it("should deliver position update within 500ms of trade execution", async () => {
    // Setup: Connect WebSocket client
    const ws = await connectAuthenticatedWebSocket(testUserId);
    const messagePromise = waitForMessage(ws, "position_update");

    // Action: Execute trade via REST API
    const startTime = Date.now();
    await apiClient.post("/api/alpaca-trading/execute", {
      symbol: "AAPL",
      side: "buy",
      quantity: 10,
    });

    // Verify: WebSocket receives position_update within 500ms
    const message = await messagePromise;
    const latency = Date.now() - startTime;

    expect(latency).toBeLessThan(500);
    expect(message.type).toBe("position_update");
    expect(message.data.symbol).toBe("AAPL");
    expect(message.data.quantity).toBe("10");
  });

  it("should isolate events between users", async () => {
    // Setup: Two users connected
    const user1Ws = await connectAuthenticatedWebSocket(user1Id);
    const user2Ws = await connectAuthenticatedWebSocket(user2Id);

    const user1Messages: any[] = [];
    const user2Messages: any[] = [];
    user1Ws.on("message", (msg) => user1Messages.push(JSON.parse(msg)));
    user2Ws.on("message", (msg) => user2Messages.push(JSON.parse(msg)));

    // Action: Execute trade for user1
    await apiClient.post(
      "/api/alpaca-trading/execute",
      {
        symbol: "TSLA",
        side: "buy",
        quantity: 5,
      },
      { userId: user1Id }
    );

    await sleep(1000); // Wait for event delivery

    // Verify: Only user1 received the event
    expect(user1Messages.some((m) => m.type === "position_update")).toBe(true);
    expect(user2Messages.some((m) => m.type === "position_update")).toBe(false);
  });
});
```

## Migration Path

### Backward Compatibility

**Old Behavior** (REST polling):

- Client polls /api/positions every 30 seconds
- TanStack Query manages cache and refetch
- No real-time updates

**New Behavior** (WebSocket streaming):

- Client connects to /ws/portfolio on mount
- Subscribes to positions/orders/account channels
- WebSocket updates TanStack Query cache in real-time
- REST polling continues as backup (every 5 minutes)

**Compatibility**: 100% backward compatible

- REST API endpoints unchanged
- Clients without WebSocket support continue using REST
- No breaking changes to API contracts

### Data Migration

**Required**: None - no database schema changes
**Optional**: Add indexes if query performance degrades

- Index on positions.userId, positions.symbol (likely already exists)
- Index on orders.userId, orders.status

## Success Validation

### Acceptance Criteria

**Before considering this change "complete", verify**:

1. ✅ User submits order → Receives order_update within 500ms
2. ✅ Position P&L changes → UI updates within 500ms
3. ✅ Network disconnect → Client reconnects within 5 seconds
4. ✅ Server restart → All clients reconnect within 30 seconds
5. ✅ WebSocket disabled → Clients fall back to REST polling without errors
6. ✅ 100 concurrent connections → p95 latency < 500ms
7. ✅ Load test 1 hour → No memory leaks, steady memory usage
8. ✅ User A's events → Not visible to User B
9. ✅ Animations trigger on P&L changes
10. ✅ Connection status indicator shows correct state

### Performance Benchmarks

**Target Metrics**:

- Event delivery latency p50: < 200ms
- Event delivery latency p95: < 500ms
- Event delivery latency p99: < 1000ms
- Connection success rate: > 95%
- Reconnection success rate: > 95%
- Memory per connection: < 1KB
- Bandwidth per user: < 100 KB/day (vs 5 MB/day with 30s polling)

**Load Test Results** (must achieve before production):

- 100 concurrent connections: ✅ All metrics within targets
- 1000 events/second: ✅ p95 latency < 500ms
- 1 hour sustained: ✅ No memory growth > 10%
