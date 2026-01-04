# Real-Time Portfolio Streaming - Admin Runbook

**System**: Real-Time Portfolio WebSocket Streaming
**Version**: 1.0.0
**Last Updated**: 2026-01-04

---

## Overview

This runbook covers monitoring, troubleshooting, and operational procedures for the real-time portfolio streaming system.

**Components**:

- WebSocket server: `server/lib/portfolio-stream.ts`
- Event bus integration: `server/orchestration/events.ts`
- HTTP endpoint: `/ws/portfolio`
- Admin stats: `/api/admin/websocket-stats`

---

## Monitoring

### Health Check

**Endpoint**: `GET /api/admin/websocket-stats`

**Authentication**: Requires admin session cookie

**Command**:

```bash
curl https://your-domain.com/api/admin/websocket-stats \
  -H "Cookie: session=ADMIN_SESSION_ID" | jq
```

**Example Response**:

```json
{
  "status": "healthy",
  "enabled": true,
  "activeConnections": 42,
  "connectionsByUser": {
    "user-123": 2,
    "user-456": 1
  },
  "totalMessagesDelivered": 15420,
  "totalEventsEmitted": 234560,
  "totalDisconnects": 38,
  "totalReconnects": 35,
  "performance": {
    "batchEfficiency": "95.2%",
    "batchEfficiencyRaw": 0.952,
    "avgConnectionDurationSeconds": 1847,
    "disconnectRatePerMinute": "0.50"
  },
  "uptime": {
    "seconds": 86400,
    "formatted": "24h 0m"
  },
  "limits": {
    "maxConnectionsPerUser": 5,
    "maxTotalConnections": 100
  },
  "timestamp": "2026-01-04T10:30:00.000Z"
}
```

### Health Status Meanings

**healthy**: Normal operation

- Disconnect rate < 10% of connections per minute
- Batch efficiency > 50%

**degraded**: Performance issues

- High disconnect rate (>10% connections/min)
- Low batch efficiency (<50%)

**offline**: No active connections

- May be normal if no users online
- Check if WebSocket server initialized properly

### Key Metrics to Monitor

| Metric                       | Healthy Range | Alert Threshold | Action                      |
| ---------------------------- | ------------- | --------------- | --------------------------- |
| activeConnections            | 0-100         | >95             | Capacity warning            |
| batchEfficiency              | >90%          | <50%            | Investigate event patterns  |
| disconnectRatePerMinute      | <5            | >10             | Check server/network health |
| avgConnectionDurationSeconds | >300          | <60             | Frequent disconnects issue  |
| uptime (seconds)             | Continuous    | N/A             | Track service availability  |

---

## Logs

### Server Logs

**WebSocket Initialization**:

```
[STARTUP] Portfolio stream initialized on /ws/portfolio
[STARTUP] Event bus listeners registered: [trade:executed, position:updated, position:closed]
```

**Connection Events**:

```
[PortfolioStream] Client connected: userId=user-123, connectionId=conn_1234567890_abc, totalUserConnections=1
[PortfolioStream] Client subscribed to channels: ["positions", "orders"]
[PortfolioStream] Client disconnected: userId=user-123, code=1000, reason=Client disconnect, duration=1845s
```

**Event Emissions**:

```
[AlpacaStream] Emitted trade:executed event: tradeId=trade-789, symbol=AAPL
[PortfolioStream] Processed trade:executed event: userId=user-123, symbol=AAPL
[PortfolioStream] Broadcast position update: userId=user-123, symbol=AAPL, unrealizedPnl=550.00
[PortfolioStream] Batch flushed: userId=user-123, positionUpdates=3, orderUpdates=1, totalEvents=4
```

### Client Logs (Browser Console)

**Connection**:

```
[PortfolioStream] Connecting to: ws://localhost:5000/ws/portfolio
[PortfolioStream] Connected successfully
[PortfolioStream] Subscribed to channels: ["positions"]
```

**Events**:

```
[Realtime] Position updated: AAPL +$550.00
[Realtime] Account updated: equity = 104550.00
```

**Errors**:

```
[PortfolioStream] WebSocket connection error
[PortfolioStream] Reconnecting in 1000ms (attempt 1/10)
```

---

## Common Issues

### Issue 1: High Disconnect Rate

**Symptoms**:

- `disconnectRatePerMinute` > 10
- Users report frequent "Reconnecting..." status
- Server logs show many disconnect events

**Possible Causes**:

- Network instability
- Server overload (CPU/memory)
- Firewall/proxy issues
- Client-side browser issues

**Investigation Steps**:

1. Check server resources:

   ```bash
   top
   # Check CPU and memory usage
   ```

2. Check network connectivity:

   ```bash
   ping your-domain.com
   # Verify network stability
   ```

3. Check firewall/proxy logs:

   ```bash
   tail -f /var/log/nginx/error.log
   # Look for WebSocket upgrade failures
   ```

4. Check browser console for client-side errors

**Resolution**:

- If server overload: Scale up server resources
- If network issues: Contact network admin
- If firewall blocking: Configure firewall to allow WebSocket (Upgrade: websocket)
- If client issues: Ask users to update browsers

### Issue 2: Low Batch Efficiency (<50%)

**Symptoms**:

- `batchEfficiency` < 0.5 (50%)
- High message count despite batching
- Increased bandwidth usage

**Possible Causes**:

- Events are too sparse (batching can't combine them)
- Batch window too short
- Single-symbol activity (can't batch different symbols)

**Investigation Steps**:

1. Check event emission patterns:

   ```bash
   grep "Batch flushed" server.log | tail -20
   # See typical batch sizes
   ```

2. Check event types:
   ```bash
   grep "eventBus.emit" server.log | cut -d'"' -f2 | sort | uniq -c
   # Count events by type
   ```

**Resolution**:

- If sparse events: Normal, batching won't help much
- If concentrated bursts: Consider increasing batch window (code change)
- If single-symbol: Normal, expected behavior

### Issue 3: Connection Limit Reached

**Symptoms**:

- Users get "Maximum connections exceeded" error
- `activeConnections` = 100 (server limit)
- New connections rejected with code 1013

**Possible Causes**:

- Many users online simultaneously
- Users leaving tabs open (not closing connections)
- Server limit too low for user base

**Investigation Steps**:

1. Check connection distribution:

   ```bash
   curl /api/admin/websocket-stats | jq '.connectionsByUser'
   # See which users have most connections
   ```

2. Identify power users:
   ```bash
   # Find users with >3 connections
   curl /api/admin/websocket-stats | jq '.connectionsByUser | to_entries | map(select(.value > 3))'
   ```

**Resolution**:

- Ask users to close extra tabs
- Increase `maxTotalConnections` in `portfolio-stream.ts` (requires code change + deploy)
- Consider per-user notifications to close idle tabs

### Issue 4: No Events Being Emitted

**Symptoms**:

- Users connected but not receiving updates
- `totalEventsEmitted` not increasing
- `totalMessagesDelivered` not increasing

**Possible Causes**:

- EventBus listeners not registered
- Trade execution not emitting events
- Alpaca stream disconnected

**Investigation Steps**:

1. Check server startup logs:

   ```bash
   grep "Event bus listeners registered" server.log
   # Should show: [trade:executed, position:updated, position:closed]
   ```

2. Check Alpaca stream status:

   ```bash
   grep "AlpacaStream" server.log | tail -20
   # Look for "Connected" or "trade_updates stream"
   ```

3. Execute test trade and watch logs:
   ```bash
   tail -f server.log | grep -E "eventBus.emit|Broadcast"
   ```

**Resolution**:

- If listeners not registered: Check server initialization logs, restart server
- If Alpaca stream down: Reconnect Alpaca stream manually or restart
- If events not emitting: Check eventBus.emit() calls in code

### Issue 5: Memory Leak

**Symptoms**:

- Server memory usage grows continuously
- `avgConnectionDurationSeconds` very high (>10000s = 2.7h)
- Server becomes slow over time

**Possible Causes**:

- Connections not being cleaned up
- Event listeners not unsubscribed
- Batch buffers not being cleared

**Investigation Steps**:

1. Check memory usage:

   ```bash
   top -p $(pgrep -f "node.*server")
   # Monitor RES (resident memory)
   ```

2. Check connection cleanup:

   ```bash
   grep "Client disconnected" server.log | wc -l
   grep "Client connected" server.log | wc -l
   # Should be roughly equal
   ```

3. Force garbage collection and observe:
   ```bash
   # Restart server to clear memory
   pm2 restart app
   # Monitor if memory grows again
   ```

**Resolution**:

- If connections not cleaning up: Check shutdown() method in PortfolioStreamManager
- If event listeners leaking: Check eventUnsubscribers cleanup
- If batch buffers not clearing: Check flushBatches() logic
- Temporary: Restart server daily as maintenance

---

## Operational Procedures

### Graceful Shutdown

WebSocket connections are automatically closed during server shutdown:

```bash
# Send SIGTERM (graceful)
pm2 stop app

# Server will:
# 1. Stop accepting new connections
# 2. Unsubscribe event bus listeners
# 3. Flush remaining batches
# 4. Close all WebSocket connections (code 1001: Going Away)
# 5. Clean up timers and maps
```

**Client Behavior**: Clients auto-reconnect when server restarts.

### Emergency Disable

**Scenario**: WebSocket causing issues, need to disable immediately.

**Steps**:

1. Set environment variable:

   ```bash
   export ENABLE_REALTIME_PORTFOLIO=false
   ```

2. Restart server:

   ```bash
   pm2 restart app
   ```

3. Verify:
   ```bash
   curl /api/admin/websocket-stats
   # Should return: "status": "disabled"
   ```

**Client Behavior**: Clients detect WebSocket unavailable within 5 seconds, fall back to REST polling.

**Rollback Time**: ~2 minutes (env change + restart)

### Increase Connection Limits

**File**: `server/lib/portfolio-stream.ts`

**Change**:

```typescript
// From:
private readonly maxConnectionsPerUser = 5;
private readonly maxTotalConnections = 100;

// To:
private readonly maxConnectionsPerUser = 10; // Doubled
private readonly maxTotalConnections = 200; // Doubled
```

**Deploy**: Requires code change, build, and deployment

**Impact**: More memory usage (~1KB per connection)

---

## Performance Tuning

### Batch Window Adjustment

**Current**: 1-second batching window

**File**: `server/lib/portfolio-stream.ts`

**Change**:

```typescript
// From:
private readonly batchWindowMs = 1000; // 1 second

// To:
private readonly batchWindowMs = 2000; // 2 seconds (more batching)
```

**Impact**:

- Higher batch efficiency (>98%)
- Slightly higher latency (up to 2s vs 1s)
- Less frequent messages (lower bandwidth)

**When to Use**: If bandwidth is a concern, not latency

### Heartbeat Interval Adjustment

**Current**: Ping every 15s, timeout after 30s

**File**: `server/lib/portfolio-stream.ts`

**Change**:

```typescript
// From:
private readonly heartbeatIntervalMs = 15000; // 15 seconds
private readonly heartbeatTimeoutMs = 30000; // 30 seconds

// To:
private readonly heartbeatIntervalMs = 30000; // 30 seconds
private readonly heartbeatTimeoutMs = 60000; // 60 seconds
```

**Impact**:

- Less network overhead (fewer pings)
- Slower detection of dead connections
- Connections may stay alive longer unnecessarily

**When to Use**: If network overhead is a concern

---

## Alerting

### Recommended Alerts

**Alert 1: WebSocket Service Down**

- **Condition**: `activeConnections` = 0 for >5 minutes during market hours
- **Severity**: Critical
- **Action**: Check server logs, restart portfolio stream

**Alert 2: High Disconnect Rate**

- **Condition**: `disconnectRatePerMinute` > 10 for >5 minutes
- **Severity**: Warning
- **Action**: Investigate server load, network issues

**Alert 3: Low Batch Efficiency**

- **Condition**: `batchEfficiency` < 0.5 for >10 minutes
- **Severity**: Info
- **Action**: Review event patterns, consider batch window adjustment

**Alert 4**: Connection Capacity Warning

- **Condition**: `activeConnections` > 90 (90% of max 100)
- **Severity**: Warning
- **Action**: Consider increasing limits or scaling

### Alert Configuration Examples

**Prometheus**:

```yaml
- alert: WebSocketServiceDown
  expr: websocket_active_connections == 0
  for: 5m
  annotations:
    summary: "WebSocket service has no active connections"
```

**Datadog**:

```json
{
  "query": "avg(last_5m):avg:websocket.active_connections{*} < 1",
  "message": "WebSocket service appears down - no active connections",
  "name": "WebSocket Service Down"
}
```

---

## Troubleshooting Playbook

### Scenario 1: Users Report "Not Getting Live Updates"

**Steps**:

1. Check global health:

   ```bash
   curl /api/admin/websocket-stats | jq '.status'
   ```

2. If `status != "healthy"`, investigate per Issue sections above

3. If `status == "healthy"`, check user-specific:
   - Ask user to refresh page
   - Check user's browser console for errors
   - Verify user is authenticated
   - Check if user hit connection limit (5)

4. Test with your own account:
   - Open `/admin/positions`
   - Check for green connection indicator
   - Execute test trade, verify update appears

5. Check server logs:
   ```bash
   tail -f server.log | grep "PortfolioStream\|eventBus"
   ```

**Resolution**:

- If server issue: Restart server
- If client issue: User refreshes browser
- If auth issue: User re-authenticates

### Scenario 2: Server Memory Growing

**Steps**:

1. Check current memory:

   ```bash
   ps aux | grep "node.*server" | awk '{print $6}'
   # Shows memory in KB
   ```

2. Check connection count:

   ```bash
   curl /api/admin/websocket-stats | jq '.activeConnections'
   ```

3. Calculate memory per connection:

   ```
   Memory Per Connection = Total Memory / Active Connections
   Should be: <1MB per connection
   ```

4. If excessive (>5MB per connection):
   - Check for memory leaks
   - Review batch buffer cleanup
   - Check event listener cleanup

**Resolution**:

- Restart server (clears memory)
- If recurring: Code review for memory leaks
- Monitor after restart to confirm fix

### Scenario 3: Slow Updates (>1s Latency)

**Steps**:

1. Check batch window setting (should be 1000ms)

2. Check event emission logs:

   ```bash
   grep "eventBus.emit" server.log | tail -20
   # Verify events are being emitted
   ```

3. Check broadcast logs:

   ```bash
   grep "Broadcast" server.log | tail -20
   # Verify broadcasts are happening
   ```

4. Measure end-to-end latency:
   - Execute trade via API (note timestamp)
   - Check browser console for "[Realtime]" log (note timestamp)
   - Calculate difference

5. Check server load:
   ```bash
   top
   # High CPU may delay event processing
   ```

**Resolution**:

- If server overloaded: Scale up resources
- If batching delayed: Check batch flush interval (should be 1s)
- If network slow: Check network latency

---

## Deployment Procedures

### Initial Deployment

1. **Deploy Code**:

   ```bash
   git pull origin main
   npm run build
   pm2 restart app
   ```

2. **Verify Initialization**:

   ```bash
   tail -f server.log | grep "Portfolio stream"
   # Should see: "Portfolio stream initialized on /ws/portfolio"
   ```

3. **Check Stats Endpoint**:

   ```bash
   curl /api/admin/websocket-stats -H "Cookie: session=$ADMIN_SESSION" | jq
   # Should return status: "healthy" or "offline" (if no users yet)
   ```

4. **Test Connection**:
   - Open browser to `/admin/positions`
   - Check for green connection indicator
   - Execute test trade
   - Verify position updates

### Rolling Restart (Zero Downtime)

**Not Currently Supported**: WebSocket connections will drop during restart.

**Current Behavior**:

1. Server restarts
2. All WebSocket connections close (code 1001: Going Away)
3. Clients auto-reconnect within 5 seconds
4. Brief interruption (~5-10 seconds)

**Future Enhancement**: Blue-green deployment with connection draining

### Rollback

**Scenario**: Real-time updates causing issues, need to revert.

**Steps**:

1. Disable feature flag:

   ```bash
   export ENABLE_REALTIME_PORTFOLIO=false
   pm2 restart app
   ```

2. Verify disabled:

   ```bash
   curl /api/admin/websocket-stats | jq '.enabled'
   # Should return: false
   ```

3. Notify users (optional):
   - "Real-time updates temporarily disabled"
   - "Using standard refresh mode"

**Client Behavior**: Automatic fallback to REST polling (every 5 seconds)

**Rollback Time**: <2 minutes

---

## Maintenance

### Daily Checks

1. **Check Health Status**:

   ```bash
   curl /api/admin/websocket-stats | jq '.status'
   # Should be: "healthy"
   ```

2. **Review Disconnect Rate**:

   ```bash
   curl /api/admin/websocket-stats | jq '.performance.disconnectRatePerMinute'
   # Should be: <5
   ```

3. **Check Batch Efficiency**:
   ```bash
   curl /api/admin/websocket-stats | jq '.performance.batchEfficiency'
   # Should be: >90%
   ```

### Weekly Reviews

1. **Analyze Connection Patterns**:

   ```bash
   curl /api/admin/websocket-stats | jq '.connectionsByUser'
   # Identify power users or unusual patterns
   ```

2. **Review Performance Trends**:
   - Compare batch efficiency week-over-week
   - Track average connection duration
   - Monitor disconnect trends

3. **Check for Errors**:
   ```bash
   grep "ERROR.*PortfolioStream" server.log | wc -l
   # Should be: 0 or very low
   ```

---

## Feature Flag Management

### Environment Variable

**Name**: `ENABLE_REALTIME_PORTFOLIO`

**Values**:

- `true` (default): WebSocket streaming enabled
- `false`: WebSocket disabled, clients use REST polling

### Enable/Disable Without Code Change

**File**: `.env` or environment configuration

**Enable**:

```bash
ENABLE_REALTIME_PORTFOLIO=true
```

**Disable**:

```bash
ENABLE_REALTIME_PORTFOLIO=false
```

**Apply**: Restart server after changing

---

## Capacity Planning

### Current Limits

- **Max connections per user**: 5
- **Max total connections**: 100
- **Memory per connection**: ~1KB
- **Total memory overhead**: <100MB

### Scaling Recommendations

**For 100 users (avg 2 connections each = 200 total)**:

- Increase `maxTotalConnections` to 250
- Allocate +150MB memory
- Monitor disconnect rate closely

**For 500 users (avg 2 connections each = 1000 total)**:

- Consider horizontal scaling (multiple servers)
- Implement connection load balancing
- Redis for shared state (if needed)

---

## Emergency Contacts

**On-Call Engineer**: ********\_********
**Backup Contact**: ********\_********
**Escalation**: ********\_********

**Slack Channel**: #alphaflow-alerts
**PagerDuty**: Real-Time Portfolio Service

---

## Related Documentation

- **API Documentation**: `/docs/api/websocket-portfolio.md`
- **User Guide**: `/docs/guides/realtime-portfolio-user-guide.md`
- **Testing Checklist**: `/docs/realtime-portfolio-testing-checklist.md`
- **OpenSpec Proposal**: `/openspec/changes/realtime-portfolio-streaming/`

---

**Last Updated**: 2026-01-04
**Version**: 1.0.0
**Status**: Production-Ready
**Owner**: DevOps Team
