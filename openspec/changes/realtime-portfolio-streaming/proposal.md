# Real-Time Portfolio Streaming via WebSocket

## Summary

Implement WebSocket-based real-time portfolio streaming to push position updates, order status changes, account balance updates, and trade executions to connected clients with <500ms latency. Replaces REST API polling with event-driven updates for superior UX during active trading.

## Motivation

### Current Pain Points

1. **Stale Data**: Users must manually refresh or wait for polling intervals (30-60s) to see portfolio changes
2. **Poor Trading UX**: During active trading, delayed P&L updates lead to suboptimal decisions
3. **Wasted Resources**: REST polling every 30s wastes bandwidth and server resources
4. **Missed Opportunities**: Order fill notifications arrive too late for follow-up actions

### Business Impact

- **User Experience**: Instant feedback on trades improves trader confidence and platform stickiness
- **Competitive Advantage**: Real-time updates are table stakes for modern trading platforms
- **Resource Efficiency**: WebSocket uses 90% less bandwidth than polling (event-driven vs periodic fetch)
- **Scalability**: Event-driven architecture scales better than polling (100 users polling = 200 req/min, WebSocket = 0 req/min)

## Proposed Solution

### High-Level Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Alpaca Stream   │────▶│  Event Bus       │────▶│ Portfolio       │
│ (Trade Updates) │     │  (Orchestration) │     │ Stream Manager  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               ▲                          │
                               │                          ▼
┌─────────────────┐            │                   ┌─────────────────┐
│ Work Queue      │────────────┘                   │ WebSocket       │
│ (Order Submit)  │                                │ Clients (Auth)  │
└─────────────────┘                                └─────────────────┘
                                                          │
┌─────────────────┐                                      ▼
│ Position Mgr    │                              ┌─────────────────┐
│ (Manual Sync)   │──────────────────────────────▶│ React Hooks     │
└─────────────────┘                              │ (TanStack Query)│
                                                  └─────────────────┘
```

### Core Components

#### 1. Backend: Portfolio Stream Manager (`server/lib/portfolio-stream.ts`)

- **Responsibility**: Manage WebSocket connections, route events to authenticated clients
- **Authentication**: Session cookie validation on connection upgrade
- **Connection Tracking**: Map<userId, Set<WebSocket>> for efficient broadcasting
- **Event Subscription**: Channels (positions, orders, account, trades) per client
- **Batching**: 1-second aggregation window to reduce message frequency by 95%
- **Heartbeat**: Ping/pong every 15 seconds, disconnect after 30s timeout

#### 2. Backend: Event Integration

- **Hook into EventBus**: Subscribe to trade:executed, order:updated, position:changed events
- **Alpaca Stream Integration**: Modify alpaca-stream.ts to emit position_update on broker events
- **Position Manager Integration**: Emit events after syncPositionsFromAlpaca()
- **Work Queue Integration**: Emit events after successful ORDER_SUBMIT execution

#### 3. Frontend: WebSocket React Hook (`client/hooks/usePortfolioStream.ts`)

- **Connection Management**: Auto-connect on mount, cleanup on unmount
- **Reconnection Logic**: Exponential backoff (1s, 2s, 4s, 8s, max 30s, max 10 attempts)
- **State Exposure**: connectionStatus ('connected' | 'connecting' | 'disconnected' | 'error')
- **Message Parsing**: JSON parse + Zod validation
- **Error Handling**: Graceful degradation to REST polling

#### 4. Frontend: Subscription Hooks

- `useRealtimePositions()`: Subscribes to position_update events, updates Query cache
- `useRealtimeOrders()`: Subscribes to order_update events
- `useRealtimeAccount()`: Subscribes to account_update events
- **TanStack Query Integration**: queryClient.setQueryData() to merge WebSocket updates

#### 5. Frontend: UI Components

- `ConnectionStatus.tsx`: Visual indicator (green/yellow/red dot) in header
- **Position Animations**: Flash green on profit increase, red on loss increase (Framer Motion)
- **Staleness Indicator**: Show "Last updated: Xs ago" per position

### Event Schemas

#### WebSocket Message Format (Server → Client)

```typescript
interface PortfolioEvent {
  type:
    | "position_update"
    | "order_update"
    | "account_update"
    | "trade_executed"
    | "batch";
  timestamp: string;
  userId: string;
  data:
    | PositionUpdate
    | OrderUpdate
    | AccountUpdate
    | TradeExecuted
    | BatchUpdate;
}

interface PositionUpdate {
  symbol: string;
  quantity: string;
  currentPrice: string;
  entryPrice: string;
  unrealizedPnl: string;
  unrealizedPnlPercent: string;
  marketValue: string;
  side: "long" | "short";
  strategyId?: string;
  openedAt: string;
}

interface OrderUpdate {
  orderId: string;
  brokerOrderId: string;
  symbol: string;
  side: "buy" | "sell";
  type: string;
  status: string;
  qty?: string;
  filledQty?: string;
  filledAvgPrice?: string;
  submittedAt: string;
  filledAt?: string;
}

interface AccountUpdate {
  equity: string;
  buyingPower: string;
  cash: string;
  portfolioValue: string;
  dayPnl: string;
  dayPnlPercent: string;
  timestamp: string;
}

interface BatchUpdate {
  positions?: PositionUpdate[];
  orders?: OrderUpdate[];
  account?: AccountUpdate;
}
```

#### Client Message Format (Client → Server)

```typescript
interface ClientMessage {
  type: "subscribe" | "unsubscribe" | "ping";
  channels?: ("positions" | "orders" | "account" | "trades")[];
  symbols?: string[]; // Optional: Subscribe to specific symbols only
}
```

### Security Requirements

**REQ-1**: The system SHALL authenticate WebSocket clients via session cookies

- GIVEN a client attempts to connect to /ws/portfolio
- WHEN the upgrade request lacks a valid session cookie
- THEN the server SHALL reject the connection with 401 status code

**REQ-2**: The system SHALL isolate user portfolio data

- GIVEN multiple users are connected via WebSocket
- WHEN a portfolio event occurs for user A
- THEN only user A's connections SHALL receive the event
- AND user B SHALL NOT receive user A's events

**REQ-3**: The system SHALL rate-limit WebSocket connections

- GIVEN a client attempts to connect
- WHEN the user already has 5 active connections
- THEN the server SHALL reject the 6th connection
- AND return error: "Maximum connections exceeded"

### Performance Requirements

**REQ-4**: The system SHALL deliver position updates within 500ms of broker events

- GIVEN a position price changes on Alpaca
- WHEN the Alpaca stream receives the update
- AND the PortfolioStreamManager processes the event
- THEN authenticated clients SHALL receive position_update within 500ms

**REQ-5**: The system SHALL batch events to reduce message frequency

- GIVEN multiple position updates occur within 1 second
- WHEN the batching window closes
- THEN the server SHALL send a single batch message containing all updates
- AND reduce event count by ~95% (from 23,400 to ~1,170 per position per day)

**REQ-6**: The system SHALL support 100+ concurrent WebSocket connections

- GIVEN 100 users connect simultaneously
- WHEN position updates are broadcast
- THEN all clients SHALL receive events within 500ms
- AND server memory usage SHALL NOT exceed 100MB for connection management

### Reliability Requirements

**REQ-7**: The system SHALL automatically reconnect on disconnection

- GIVEN a WebSocket connection is lost (network failure, server restart)
- WHEN the client detects the disconnect (onclose event)
- THEN the client SHALL attempt reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- AND retry up to 10 times before falling back

**REQ-8**: The system SHALL fall back to REST polling on WebSocket failure

- GIVEN WebSocket connection fails after 10 retry attempts
- WHEN the client enters fallback mode
- THEN the client SHALL poll /api/positions every 5 seconds
- AND show "Using backup connection" status indicator

**REQ-9**: The system SHALL reconcile data via REST every 60 seconds

- GIVEN a client is connected via WebSocket
- WHEN 60 seconds elapse since last REST fetch
- THEN the client SHALL trigger a background REST fetch
- AND merge results with WebSocket cache to detect missed events

**REQ-10**: The system SHALL handle message loss gracefully

- GIVEN a WebSocket message is dropped due to network issues
- WHEN the periodic REST reconciliation runs
- THEN the client SHALL detect the difference
- AND update the UI with correct data from REST

### Client-Side Requirements

**REQ-11**: The system SHALL update TanStack Query cache on WebSocket events

- GIVEN a position_update event is received
- WHEN the useRealtimePositions hook processes it
- THEN queryClient.setQueryData(['positions', userId]) SHALL be called
- AND the UI SHALL reflect the update without refetch

**REQ-12**: The system SHALL animate P&L changes

- GIVEN a position unrealizedPnl increases
- WHEN the UI receives the update
- THEN the P&L value SHALL flash green for 500ms
- AND scale up 1.05x then return to normal (Framer Motion)

**REQ-13**: The system SHALL respect accessibility settings

- GIVEN a user has prefers-reduced-motion enabled
- WHEN P&L updates occur
- THEN animations SHALL be disabled
- AND only color changes SHALL indicate updates

### Monitoring Requirements

**REQ-14**: The system SHALL track WebSocket connection metrics

- The server SHALL track: active connections, connection duration, disconnect rate
- The server SHALL expose metrics via /api/admin/websocket-stats
- Alert if disconnect rate > 10 connections/minute (server issue)

**REQ-15**: The system SHALL track event delivery latency

- The server SHALL measure time from event emission to client delivery
- The server SHALL track p50, p95, p99 latency
- Alert if p95 latency > 1 second (performance degradation)

## Impact

### Breaking Changes

- **None** - WebSocket is additive, REST API endpoints remain unchanged

### Dependencies

- **Existing**: 'ws' package (already in dependencies)
- **Existing**: server/lib/websocket-server.ts (initialized in server/index.ts:426)
- **Existing**: server/orchestration eventBus (for event routing)
- **Existing**: server/trading/alpaca-stream.ts (modify to emit events)
- **New**: None - all dependencies already installed

### Affected Modules

- **server/lib/**: New portfolio-stream.ts, portfolio-events.ts
- **server/trading/**: Modify alpaca-stream.ts, position-manager.ts
- **server/lib/**: Modify work-queue.ts (emit events after order execution)
- **client/hooks/**: New usePortfolioStream.ts, useRealtimePositions.ts, useRealtimeOrders.ts
- **client/components/**: Modify portfolio dashboard, positions table
- **client/components/ui/**: New ConnectionStatus.tsx

### Rollback Plan

1. Set feature flag ENABLE_REALTIME_PORTFOLIO=false in environment
2. Clients automatically fall back to REST polling
3. No data loss, no downtime
4. Can toggle flag without code deployment

## Risks and Mitigations

### Risk 1: WebSocket connection instability

- **Impact**: Users experience frequent disconnects, poor UX
- **Mitigation**: Automatic reconnection with exponential backoff, fallback to REST polling
- **Monitoring**: Track disconnect rate, alert if > 10/minute

### Risk 2: Event delivery lag under load

- **Impact**: Position updates delayed > 500ms, defeats purpose of real-time
- **Mitigation**: Server-side batching (1-second window), load testing with 100+ connections
- **Monitoring**: Track p95 latency, alert if > 1 second

### Risk 3: Memory leak from unclosed connections

- **Impact**: Server memory grows unbounded, eventual OOM crash
- **Mitigation**: Connection timeout (30s idle), max connections per user (5), periodic cleanup
- **Monitoring**: Track connection count and memory usage, alert on growth

### Risk 4: Race conditions on concurrent updates

- **Impact**: Client cache shows inconsistent data (old P&L after new update)
- **Mitigation**: Timestamp-based ordering, periodic REST reconciliation (60s), complete object snapshots (not deltas)
- **Monitoring**: No specific metric, rely on user reports + reconciliation logs

### Risk 5: Alpaca stream disconnection

- **Impact**: Server receives no broker events, clients show stale data
- **Mitigation**: Alpaca stream auto-reconnects, emit "data stale" event to clients after 30s silence
- **Monitoring**: Track time since last Alpaca event, alert if > 2 minutes during market hours

## Success Criteria

### Functional

- [ ] Users see position P&L updates within 500ms of price changes
- [ ] Order status updates (new → filled) appear instantly
- [ ] Account balance reflects trades immediately
- [ ] Connection status indicator shows real-time state
- [ ] Automatic reconnection recovers within 5 seconds
- [ ] Fallback to REST polling works seamlessly

### Performance

- [ ] p95 event delivery latency < 500ms
- [ ] Support 100 concurrent connections without degradation
- [ ] Memory usage < 100MB for connection management
- [ ] Bandwidth reduced by 90% vs polling (events only when changes occur)

### Reliability

- [ ] Reconnection success rate > 95% (within 30 seconds)
- [ ] Zero data loss during disconnects (REST reconciliation catches up)
- [ ] WebSocket uptime > 99.5% (excluding planned maintenance)

### Security

- [ ] All connections authenticated via session cookies
- [ ] Users receive only their own portfolio events
- [ ] Rate limiting prevents abuse (max 5 connections per user)
- [ ] No sensitive data in WebSocket URLs (session in cookie only)

## Deployment Strategy

### Phase 1: Backend Infrastructure (Week 1)

- Implement PortfolioStreamManager with authentication
- Hook into existing eventBus
- Deploy to staging environment
- Load test with 100 simulated connections

### Phase 2: Frontend Hooks (Week 2)

- Implement usePortfolioStream base hook
- Implement subscription hooks (positions, orders, account)
- Deploy to staging, test with beta users
- A/B test: 10% users on WebSocket, 90% on REST polling

### Phase 3: UI Integration (Week 3)

- Update portfolio dashboard with real-time subscriptions
- Add P&L change animations
- Add connection status indicator
- Gradual rollout: 10% → 50% → 100% users

### Feature Flag

- **Environment Variable**: ENABLE_REALTIME_PORTFOLIO (default: true)
- **Server**: Only initialize WebSocket if flag enabled
- **Client**: Check flag via /api/health, fall back to REST if disabled
- **Rollback**: Set flag to false, clients auto-fallback within 5 seconds

## Alternative Approaches Considered

### Alternative 1: Enhance existing SSE endpoint (/api/events)

- **Pros**: Already implemented, simpler than WebSocket
- **Cons**: One-way only (no client subscriptions), no ping/pong, HTTP overhead
- **Decision**: Rejected - need bi-directional for channel subscriptions and heartbeat

### Alternative 2: GraphQL Subscriptions

- **Pros**: Type-safe, industry standard
- **Cons**: Requires GraphQL server (major architecture change), overkill for this use case
- **Decision**: Rejected - too heavy for portfolio streaming

### Alternative 3: Firebase Realtime Database

- **Pros**: Managed service, automatic sync
- **Cons**: Vendor lock-in, cost, data duplication (still need PostgreSQL)
- **Decision**: Rejected - prefer self-hosted solution

### Alternative 4: Socket.io

- **Pros**: Higher-level abstraction, rooms/namespaces, fallback to polling built-in
- **Cons**: Larger dependency (200KB), we only need raw WebSocket
- **Decision**: Rejected - 'ws' package sufficient, avoid dependency bloat

## Dependencies and Prerequisites

### Existing Infrastructure (No Changes Needed)

- ✅ WebSocket server: server/lib/websocket-server.ts (initialized in server/index.ts:426)
- ✅ SSE endpoint: /api/events (authenticated streaming fallback)
- ✅ Alpaca stream: server/trading/alpaca-stream.ts (broker event source)
- ✅ Event bus: server/orchestration (central event routing)
- ✅ Session management: server/lib/session.ts (authentication)
- ✅ TanStack Query: client-side cache (React hooks)
- ✅ Framer Motion: UI animations

### New Dependencies

- **None** - All required packages already installed ('ws' v8.18.0)

### Environment Variables

- **New**: ENABLE_REALTIME_PORTFOLIO (optional, default: true)
- **Existing**: All trading/auth variables unchanged

## Testing Strategy

### Unit Tests

- PortfolioStreamManager: Connection lifecycle, authentication, broadcasting
- Event helpers: Serialization, validation, batching
- React hooks: Reconnection logic, cache updates, error handling

### Integration Tests

- End-to-end: Submit order → WebSocket client receives order_update + position_update
- Authentication: Invalid session → connection rejected
- Isolation: User A doesn't receive User B's events
- Reconnection: Server restart → clients auto-reconnect within 5s

### Load Tests

- 100 concurrent connections
- 1000 position updates/second
- Measure: Event delivery latency (p50, p95, p99)
- Verify: Memory usage < 100MB, no memory leaks over 1 hour

### Manual Testing

- Open portfolio dashboard, execute trades, verify instant updates
- Disconnect network, verify reconnection + catch-up
- Disable WebSocket (feature flag), verify REST polling fallback

## Documentation Updates

- **OpenAPI Spec**: Add WebSocket endpoint documentation (docs/api/OPENAPI_SPEC.yaml)
- **Architecture Docs**: Update real-time streaming architecture diagram
- **User Guide**: Add section on real-time updates and connection status
- **Admin Runbook**: Add WebSocket monitoring and troubleshooting guide

## Post-Deployment Monitoring

### Metrics to Watch (First 7 Days)

1. WebSocket connection success rate (target: > 95%)
2. Average event delivery latency (target: < 200ms p95)
3. Disconnect rate (target: < 5 disconnects/user/day)
4. Fallback activation rate (target: < 1% of sessions)
5. User-reported issues (target: < 5 tickets)

### Alerts

- Alert if active connections drop by > 50% suddenly (server crash)
- Alert if event latency p95 > 1 second (performance issue)
- Alert if error rate > 5% (system problem)
- Alert if no events emitted for > 5 minutes during market hours (Alpaca stream down)
