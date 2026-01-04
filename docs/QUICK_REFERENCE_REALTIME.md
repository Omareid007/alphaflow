# Real-Time Portfolio - Quick Reference Card

**Feature**: Real-Time Portfolio Streaming v1.0.0
**Endpoint**: `wss://domain/ws/portfolio`

---

## 🎣 React Hooks

```typescript
import {
  usePortfolioStream,
  useRealtimePositions,
  useRealtimeOrders,
  useRealtimeAccount,
} from "@/hooks/realtime";

// Base WebSocket connection
const { status, connect, disconnect, ping } = usePortfolioStream({
  autoConnect: true,
  channels: ["positions", "orders"],
  onEvent: (event) => console.log(event),
  onStatusChange: (status) => console.log(status),
});

// Position updates
const {
  connectionStatus,
  isConnected,
  hasStaleData,
  lastUpdateTime,
  positionUpdateTimes,
} = useRealtimePositions({
  enabled: true,
  onPositionUpdate: (position) =>
    console.log(position.symbol, position.unrealizedPnl),
});

// Order updates
const { isConnected } = useRealtimeOrders({
  enabled: true,
  onOrderFilled: (order) => toast.success(`Filled: ${order.symbol}`),
});

// Account updates
const {} = useRealtimeAccount({
  enabled: true,
  onAccountUpdate: (account) => console.log(`Equity: ${account.equity}`),
});
```

---

## 🎨 UI Components

```tsx
import {
  ConnectionStatus,
  AnimatedPnL,
  LiveBadge,
  StalenessWarning,
  LastUpdatedTimestamp
} from '@/components/ui/realtime';

// Connection status indicator
<ConnectionStatus
  showLabel={false}
  size="sm"
  tooltipSide="bottom"
/>

// Animated P&L value
<AnimatedPnL
  value={position.unrealizedPl}
  percentValue={position.unrealizedPlPct}
  showSign
  showPercent
  size="sm"
/>

// Data freshness badge
<LiveBadge
  lastUpdate={lastUpdateTime}
  showLabel={true}
  size="sm"
  liveThreshold={5000}      // 5s
  delayedThreshold={30000}  // 30s
/>

// Staleness warning banner
<StalenessWarning
  lastUpdate={lastUpdateTime}
  threshold={60000}  // 60s
  onRefresh={() => refetch()}
  variant="banner"  // or "inline"
/>

// Last updated timestamp
<LastUpdatedTimestamp
  lastUpdate={lastUpdateTime}
  showIcon={true}
/>
```

---

## 📡 WebSocket Protocol

### Client → Server

**Subscribe to Channels**:

```json
{
  "type": "subscribe",
  "channels": ["positions", "orders", "account", "trades"]
}
```

**Unsubscribe**:

```json
{
  "type": "unsubscribe",
  "channels": ["orders"]
}
```

**Ping** (heartbeat):

```json
{
  "type": "ping"
}
```

### Server → Client

**Position Update**:

```json
{
  "type": "position_update",
  "timestamp": "2026-01-04T10:30:00Z",
  "userId": "user-123",
  "data": {
    "symbol": "AAPL",
    "quantity": "100",
    "currentPrice": "175.50",
    "unrealizedPnl": "525.00",
    "unrealizedPnlPercent": "3.08"
  }
}
```

**Order Update**:

```json
{
  "type": "order_update",
  "data": {
    "orderId": "order-123",
    "symbol": "AAPL",
    "status": "filled",
    "filledQty": "10",
    "filledAvgPrice": "175.50"
  }
}
```

**Batch** (most common):

```json
{
  "type": "batch",
  "data": {
    "positions": [...],
    "orders": [...],
    "account": {...}
  }
}
```

---

## 🔧 Admin Commands

### Check WebSocket Stats

```bash
curl https://domain/api/admin/websocket-stats \
  -H "Cookie: session=ADMIN_SESSION" | jq
```

### Monitor Connections

```bash
watch -n 5 'curl -s /api/admin/websocket-stats | jq .activeConnections'
```

### Check Server Logs

```bash
# WebSocket initialization
grep "Portfolio stream" logs/app.log

# Connection events
grep "PortfolioStream.*connected" logs/app.log | tail -20

# Event emissions
grep "eventBus.emit" logs/app.log | tail -20

# Batch efficiency
grep "Batch flushed" logs/app.log | tail -20
```

### Emergency Disable

```bash
export ENABLE_REALTIME_PORTFOLIO=false
pm2 restart app
# Clients auto-fallback to REST polling within 5 seconds
```

---

## 🐛 Troubleshooting

### Not Seeing Live Updates?

**Check 1**: Connection indicator (should be green)
**Check 2**: Browser console (F12) - look for WebSocket connection logs
**Check 3**: Network tab - filter by WS, check for messages
**Check 4**: Refresh page

### Data Seems Stale?

**Check**: LiveBadge color (should be green)
**Action**: Click refresh button in staleness warning
**Wait**: Auto-reconnection happens within 30 seconds

### Connection Keeps Dropping?

**Check 1**: Server logs for disconnect reasons
**Check 2**: Network stability (ping server)
**Check 3**: Firewall/proxy allowing WebSocket upgrades
**Action**: Contact admin if persistent

### Animations Not Working?

**Check 1**: Verify AnimatedPnL component is used (not static text)
**Check 2**: Browser "Reduce motion" setting (accessibility)
**Check 3**: Console for JavaScript errors
**Action**: Refresh page or disable reduce motion

---

## 📊 Configuration

### Connection Limits

| Setting            | Default | Location                       |
| ------------------ | ------- | ------------------------------ |
| Max per user       | 5       | server/lib/portfolio-stream.ts |
| Max total          | 100     | server/lib/portfolio-stream.ts |
| Batch window       | 1000ms  | server/lib/portfolio-stream.ts |
| Heartbeat interval | 15000ms | server/lib/portfolio-stream.ts |
| Heartbeat timeout  | 30000ms | server/lib/portfolio-stream.ts |

### Thresholds

| Setting             | Default | Where                      |
| ------------------- | ------- | -------------------------- |
| Live threshold      | 5000ms  | LiveBadge component        |
| Delayed threshold   | 30000ms | LiveBadge component        |
| Stale threshold     | 60000ms | StalenessWarning component |
| Animation threshold | 0.01    | AnimatedPnL component      |

---

## 🔗 Quick Links

- **API Docs**: `docs/api/websocket-portfolio.md`
- **User Guide**: `docs/guides/realtime-portfolio-user-guide.md`
- **Admin Runbook**: `docs/runbooks/realtime-portfolio-admin.md`
- **E2E Testing**: `docs/realtime-portfolio-testing-checklist.md`
- **Deployment**: `docs/deployment/realtime-portfolio-deployment.md`
- **OpenSpec**: `openspec/changes/realtime-portfolio-streaming/`

---

## 🎯 Key Metrics

Monitor these daily:

- `activeConnections` (should be 0-100)
- `batchEfficiency` (should be >90%)
- `disconnectRatePerMinute` (should be <5)
- `status` (should be "healthy")

Alert if:

- No connections for >5 min (during market hours)
- Disconnect rate >10/min
- Batch efficiency <50%
- Connection limit reached (>95)

---

**Version**: 1.0.0
**Last Updated**: 2026-01-04
**Status**: Production-Ready
