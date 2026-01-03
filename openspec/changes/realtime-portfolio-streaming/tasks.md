# Implementation Tasks for Real-Time Portfolio Streaming

## 1. Backend Infrastructure (8 tasks)

### Task 1.1: Create Portfolio Event Type Definitions

**File**: `server/lib/portfolio-events.ts` (new)

- Define TypeScript interfaces: PortfolioEvent, PositionUpdate, OrderUpdate, AccountUpdate, TradeExecuted, BatchUpdate
- Create Zod schemas for runtime validation
- Create event factory functions: createPositionUpdateEvent(), createOrderUpdateEvent(), etc.
- Add event type guards: isPositionUpdate(), isOrderUpdate(), etc.
- **Estimated**: 45 minutes
- **Dependencies**: None

### Task 1.2: Create Portfolio Stream Manager

**File**: `server/lib/portfolio-stream.ts` (new)

- Create PortfolioStreamManager class
- Implement handleConnection(): Parse session cookie, validate, store connection
- Implement handleDisconnection(): Cleanup connection, remove from tracking map
- Implement handleClientMessage(): Process subscribe/unsubscribe/ping requests
- Create connection tracking: Map<userId, Set<{ws: WebSocket, subscriptions: Set<string>}>>
- Implement broadcast(): Send event to all user's connections that subscribed to channel
- Implement batchEvents(): 1-second aggregation window for position updates
- Add heartbeat: Send ping every 15s, disconnect on 30s timeout
- **Estimated**: 2 hours
- **Dependencies**: Task 1.1

### Task 1.3: Integrate Portfolio Stream with HTTP Server

**File**: `server/index.ts` (modify)

- Import PortfolioStreamManager
- Initialize on HTTP server after wsServer initialization (line ~426)
- Add route: /ws/portfolio for portfolio-specific WebSocket connections
- **Estimated**: 20 minutes
- **Dependencies**: Task 1.2

### Task 1.4: Hook into Event Bus for Trade Events

**File**: `server/lib/portfolio-stream.ts` (modify)

- Subscribe to eventBus events: 'trade:executed', 'order:updated'
- On trade:executed → Fetch updated position → Emit position_update + account_update
- On order:updated → Emit order_update
- **Estimated**: 45 minutes
- **Dependencies**: Task 1.2

### Task 1.5: Modify Alpaca Stream to Emit Events

**File**: `server/trading/alpaca-stream.ts` (modify)

- Import eventBus
- On trade update from Alpaca → eventBus.emit('trade:executed', {...})
- On order update from Alpaca → eventBus.emit('order:updated', {...})
- Add error handling for event emission failures
- **Estimated**: 30 minutes
- **Dependencies**: None

### Task 1.6: Modify Position Manager to Emit Events

**File**: `server/trading/position-manager.ts` (modify)

- After syncPositionsFromAlpaca() → Emit position_update for each changed position
- Compare old vs new positions, emit only changes
- **Estimated**: 30 minutes
- **Dependencies**: None

### Task 1.7: Modify Work Queue to Emit Order Events

**File**: `server/lib/work-queue.ts` (modify)

- In processOrderSubmit() after successful order creation → eventBus.emit('order:updated')
- In processOrderCancel() after cancellation → eventBus.emit('order:updated')
- **Estimated**: 20 minutes
- **Dependencies**: None

### Task 1.8: Add WebSocket Admin Endpoint

**File**: `server/routes/admin.ts` (modify)

- Add GET /api/admin/websocket-stats endpoint
- Return: {activeConnections, totalMessages, avgLatency, disconnectRate, errorRate}
- Require admin authentication
- **Estimated**: 30 minutes
- **Dependencies**: Task 1.2

## 2. Frontend Hooks (5 tasks)

### Task 2.1: Create Base WebSocket Hook

**File**: `client/hooks/usePortfolioStream.ts` (new)

- Manage WebSocket connection lifecycle (useEffect: connect on mount, close on unmount)
- Parse session cookie from document.cookie
- Implement reconnection with exponential backoff (useRef for retry count, setTimeout for delays)
- Expose connection state: connectionStatus, lastMessageTimestamp, error
- Parse incoming messages: JSON.parse + Zod validation
- Handle message errors: Log, discard message, continue
- Emit events via custom event system (EventEmitter or callback)
- **Estimated**: 1.5 hours
- **Dependencies**: Task 1.3 (server endpoint must exist)

### Task 2.2: Create Realtime Positions Hook

**File**: `client/hooks/useRealtimePositions.ts` (new)

- Use usePortfolioStream() to get message stream
- Subscribe to 'positions' channel on connect
- On position_update event → queryClient.setQueryData(['positions', userId], (old) => merge(old, newData))
- On batch event → process all position updates
- Implement smart merge: Update only changed positions, preserve others
- Add staleness tracking: Map<symbol, lastUpdateTimestamp>
- Trigger REST refetch if no update for > 60 seconds
- **Estimated**: 1 hour
- **Dependencies**: Task 2.1

### Task 2.3: Create Realtime Orders Hook

**File**: `client/hooks/useRealtimeOrders.ts` (new)

- Use usePortfolioStream() to get message stream
- Subscribe to 'orders' channel on connect
- On order_update event → queryClient.setQueryData(['orders', userId], (old) => updateOrderInList(old, newOrder))
- Handle order status transitions: new → filled → update position cache too
- **Estimated**: 45 minutes
- **Dependencies**: Task 2.1

### Task 2.4: Create Realtime Account Hook

**File**: `client/hooks/useRealtimeAccount.ts` (new)

- Use usePortfolioStream() to get message stream
- Subscribe to 'account' channel on connect
- On account_update event → queryClient.setQueryData(['account'], newAccountData)
- Cache day P&L for sparkline rendering
- **Estimated**: 30 minutes
- **Dependencies**: Task 2.1

### Task 2.5: Create Connection Status Component

**File**: `client/components/ui/ConnectionStatus.tsx` (new)

- Use usePortfolioStream() to get connectionStatus
- Show indicator: Connected (green dot), Connecting (yellow pulse), Disconnected (red dot)
- Show tooltip with details: "Connected to live updates" | "Reconnecting..." | "Offline - using cached data"
- Add to app header/navbar (position: top-right)
- **Estimated**: 45 minutes
- **Dependencies**: Task 2.1

## 3. UI Integration (4 tasks)

### Task 3.1: Update Portfolio Dashboard Page

**File**: `client/app/(app)/portfolio/page.tsx` (modify)

- Import and use useRealtimePositions(), useRealtimeOrders(), useRealtimeAccount()
- Remove or increase polling interval (30s → 300s as backup)
- Add ConnectionStatus component to header
- Show "Last updated: Xs ago" timestamp per section
- **Estimated**: 1 hour
- **Dependencies**: Task 2.2, 2.3, 2.4, 2.5

### Task 3.2: Add P&L Change Animations

**File**: `client/components/portfolio/PositionsTable.tsx` (modify)

- Wrap P&L cells in <motion.div>
- On value increase → animate={{backgroundColor: '#22c55e', scale: 1.05}} then revert
- On value decrease → animate={{backgroundColor: '#ef4444', x: [-2, 2, -2, 2, 0]}} (shake)
- Respect prefers-reduced-motion
- Add aria-live="polite" for screen readers
- **Estimated**: 1 hour
- **Dependencies**: Task 2.2

### Task 3.3: Add Real-Time Price Updates

**File**: `client/components/portfolio/PositionCard.tsx` (modify)

- Show current price from WebSocket updates
- Add "Live" badge when price updates in last 5 seconds
- Fade to "Delayed" if no update for > 30 seconds
- **Estimated**: 30 minutes
- **Dependencies**: Task 2.2

### Task 3.4: Add Staleness Warnings

**File**: `client/components/portfolio/PortfolioHeader.tsx` (modify)

- Check lastMessageTimestamp from usePortfolioStream()
- If > 60 seconds → Show yellow warning: "Portfolio data may be delayed"
- If > 5 minutes → Show red warning: "Portfolio data is stale - click to refresh"
- **Estimated**: 30 minutes
- **Dependencies**: Task 2.1

## 4. Testing (5 tasks)

### Task 4.1: Unit Test Portfolio Stream Manager

**File**: `tests/server/lib/portfolio-stream.test.ts` (new)

- Test authentication: Invalid session → connection rejected
- Test subscription: Client subscribes to 'positions' → receives position_update events
- Test unsubscribe: Client unsubscribes → no longer receives events
- Test isolation: User A doesn't receive User B's events
- Test batching: Multiple events within 1s → single batch message
- **Estimated**: 1.5 hours
- **Dependencies**: Task 1.2

### Task 4.2: Integration Test WebSocket Flow

**File**: `tests/integration/realtime-portfolio.test.ts` (new)

- Test end-to-end: Submit order via API → WebSocket client receives order_update + position_update
- Test reconnection: Kill server → Client reconnects → Receives full snapshot
- Test fallback: Disable WebSocket → Client falls back to REST polling
- Use Playwright for WebSocket testing
- **Estimated**: 2 hours
- **Dependencies**: Task 1.3, 2.1

### Task 4.3: Load Test with 100 Connections

**File**: `tests/load/websocket-load.test.ts` (new)

- Simulate 100 concurrent WebSocket connections
- Broadcast 1000 position updates/second
- Measure: Event delivery latency (p50, p95, p99)
- Verify: Memory usage < 100MB, no memory leaks over 1 hour
- **Estimated**: 2 hours
- **Dependencies**: Task 1.2

### Task 4.4: Frontend Hook Unit Tests

**File**: `tests/unit/hooks/usePortfolioStream.test.ts` (new)

- Test reconnection logic: Mock disconnect → verify exponential backoff
- Test cache updates: Mock event → verify queryClient.setQueryData called
- Test fallback: Mock repeated failures → verify REST polling started
- Use @testing-library/react-hooks
- **Estimated**: 1 hour
- **Dependencies**: Task 2.1, 2.2

### Task 4.5: Manual E2E Testing

- Open portfolio dashboard in browser
- Execute test trades via admin panel
- Verify instant P&L updates (< 500ms)
- Disconnect network (DevTools → Offline) → Verify reconnection
- Kill server → Verify client reconnects when server restarts
- Test on mobile (React Native if applicable)
- **Estimated**: 1 hour
- **Dependencies**: All frontend tasks complete

## 5. Documentation (3 tasks)

### Task 5.1: Update OpenAPI Specification

**File**: `docs/api/OPENAPI_SPEC.yaml` (modify)

- Add WebSocket endpoint documentation: /ws/portfolio
- Document event schemas (PortfolioEvent types)
- Document client message format (subscribe/unsubscribe/ping)
- Add authentication requirements
- **Estimated**: 30 minutes
- **Dependencies**: Task 1.2

### Task 5.2: Create User Guide

**File**: `docs/user/real-time-updates.md` (new)

- Explain real-time portfolio updates feature
- Show connection status indicator meanings
- Troubleshoot: "What if updates stop?" → Check connection status, refresh page
- FAQ: Battery impact, data usage, browser compatibility
- **Estimated**: 45 minutes
- **Dependencies**: Task 3.1

### Task 5.3: Create Admin Runbook

**File**: `docs/runbooks/websocket-operations.md` (new)

- Monitoring: How to check WebSocket health (/api/admin/websocket-stats)
- Troubleshooting: Common issues (high disconnect rate, latency spikes)
- Incident response: How to disable feature (set flag), diagnose problems
- Rollback procedure: Feature flag → false, verify fallback
- **Estimated**: 45 minutes
- **Dependencies**: Task 1.8

## 6. Deployment and Rollout (2 tasks)

### Task 6.1: Deploy to Staging

- Deploy backend changes to staging environment
- Run load tests to verify performance
- Verify Alpaca stream integration works
- Check logs for errors
- **Estimated**: 1 hour
- **Dependencies**: All backend tasks complete (Task 1.\*)

### Task 6.2: Gradual Production Rollout

- Week 1: 10% of users (ENABLE_REALTIME_PORTFOLIO flag + user whitelist)
- Monitor: Connection success rate, latency, error rate
- Week 2: 50% of users (expand whitelist)
- Monitor: System stability, user feedback
- Week 3: 100% of users (remove whitelist, flag defaults to true)
- Monitor: Full-scale metrics, prepare for spike
- **Estimated**: 3 weeks (monitoring time, not dev time)
- **Dependencies**: Task 6.1, all frontend tasks complete

## Total Estimated Time

- **Development**: ~18 hours (2.5 developer-days)
- **Testing**: ~8 hours (1 developer-day)
- **Documentation**: ~2 hours
- **Deployment**: ~1 hour
- **Total**: ~29 hours (~4 developer-days)

## Task Dependencies Graph

```
1.1 (Event Types)
  └─→ 1.2 (Stream Manager)
        ├─→ 1.3 (HTTP Integration)
        ├─→ 1.4 (Event Bus Hook)
        ├─→ 1.8 (Admin Endpoint)
        └─→ 2.1 (Base WebSocket Hook)
              ├─→ 2.2 (Positions Hook)
              ├─→ 2.3 (Orders Hook)
              ├─→ 2.4 (Account Hook)
              ├─→ 2.5 (Status Component)
              └─→ 3.1 (Dashboard Integration)
                    ├─→ 3.2 (Animations)
                    ├─→ 3.3 (Price Updates)
                    └─→ 3.4 (Staleness Warnings)

1.5 (Alpaca Stream) ──┐
1.6 (Position Manager) ├─→ 4.2 (Integration Tests)
1.7 (Work Queue) ──────┘

4.1 (Unit Tests) ─────────┐
4.2 (Integration Tests) ──┤
4.3 (Load Tests) ─────────├─→ 5.* (Documentation) ─→ 6.1 (Staging) ─→ 6.2 (Production)
4.4 (Hook Tests) ─────────┤
4.5 (Manual Tests) ───────┘
```

## Verification Checklist

Before marking each phase complete, verify:

### Backend Phase Complete

- [ ] npm run build passes
- [ ] npm run typecheck passes
- [ ] WebSocket server accepts authenticated connections
- [ ] Events are emitted on trade execution
- [ ] Admin stats endpoint returns connection metrics
- [ ] No memory leaks after 1 hour of load testing

### Frontend Phase Complete

- [ ] npm run build passes (client)
- [ ] npm run typecheck passes
- [ ] Hooks compile without errors
- [ ] TanStack Query cache updates on WebSocket events
- [ ] Reconnection logic tested (manual network disconnect)
- [ ] Fallback to REST polling works

### UI Integration Phase Complete

- [ ] Portfolio dashboard shows real-time updates
- [ ] P&L animations trigger on value changes
- [ ] Connection status indicator displays correctly
- [ ] No console errors in browser
- [ ] Accessibility: Screen reader announces updates
- [ ] Animations respect prefers-reduced-motion

### Testing Phase Complete

- [ ] All unit tests pass (npm run test)
- [ ] Integration tests pass (E2E trade → WebSocket update)
- [ ] Load tests pass (100 connections, <500ms latency)
- [ ] Manual testing complete (checklist signed off)
- [ ] No regressions in existing REST API functionality

### Documentation Phase Complete

- [ ] OpenAPI spec updated and validated
- [ ] User guide published
- [ ] Admin runbook published
- [ ] Code comments added to new files
- [ ] README.md updated (if applicable)

### Deployment Phase Complete

- [ ] Staging deployment successful
- [ ] Staging smoke tests pass
- [ ] Production rollout 10% successful (no incidents)
- [ ] Production rollout 50% successful (metrics healthy)
- [ ] Production rollout 100% successful
- [ ] Post-deployment monitoring shows healthy metrics
