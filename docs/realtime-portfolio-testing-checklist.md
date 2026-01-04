# Real-Time Portfolio Streaming - E2E Test Checklist

**OpenSpec Change**: `realtime-portfolio-streaming`
**Phase**: Manual Testing (Task 4.5)
**Tester**: ********\_********
**Date**: ********\_********
**Environment**: Development / Staging / Production

---

## Prerequisites

- [ ] Server running: `npm run dev`
- [ ] Browser console open (F12 → Console tab)
- [ ] Network tab open (F12 → Network tab → Filter: WS)
- [ ] Test user logged in (admintest / admin1234)

---

## Test 1: WebSocket Connection Establishment

### Steps

1. Navigate to `/admin/positions` page
2. Open browser console
3. Check for connection logs

### Expected Results

- [ ] Console shows: `[PortfolioStream] Connecting to: ws://localhost:5000/ws/portfolio`
- [ ] Console shows: `[PortfolioStream] Connected successfully`
- [ ] Console shows: `[PortfolioStream] Subscribed to channels: ["positions"]`
- [ ] Network tab shows WebSocket connection (Status: 101 Switching Protocols)
- [ ] Green pulsing dot appears (PortfolioStreamStatus indicator)
- [ ] Green "Live" badge appears in Status column for each position

### If Failed

- Check server logs for "Portfolio stream initialized on /ws/portfolio"
- Verify session cookie exists (Application tab → Cookies)
- Check for CORS/auth errors in console

---

## Test 2: Real-Time Position Updates

### Steps

1. Note current P&L value for a position (e.g., AAPL: +$525.00)
2. Execute a test trade:
   - Via Admin Panel: `/admin/orders` → Submit order
   - OR via API: `POST /api/alpaca-trading/execute`
     ```bash
     curl -X POST http://localhost:5000/api/alpaca-trading/execute \
       -H "Cookie: session=YOUR_SESSION" \
       -H "Content-Type: application/json" \
       -d '{"symbol":"AAPL","side":"buy","quantity":1,"orderType":"market","authorizedByOrchestrator":true}'
     ```
3. Watch the positions table

### Expected Results (within 500ms)

- [ ] Console shows: `[Realtime] Position updated: AAPL <new_pnl>`
- [ ] P&L value flashes **GREEN** and scales up briefly (if profit increased)
- [ ] P&L value shakes with **RED** flash (if loss increased)
- [ ] New quantity appears in table
- [ ] LiveBadge resets to "Live" (green pulsing)
- [ ] Toast notification appears: "Order Filled: BUY 1 AAPL @ $175.50"

### If Failed

- Check server logs for "Emitted trade:executed event"
- Check console for WebSocket messages in Network tab
- Verify eventBus listeners are registered (server startup logs)
- Check for JavaScript errors in console

---

## Test 3: Order Status Updates

### Steps

1. Navigate to `/admin/orders` page (if it exists) or watch orders in dashboard
2. Submit a limit order (won't fill immediately)
3. Cancel the order

### Expected Results

- [ ] Order appears with status "new" instantly
- [ ] Toast notification on order submission
- [ ] Order status changes to "cancelled" instantly when cancelled
- [ ] No page refresh needed

### If Failed

- Check useRealtimeOrders is enabled in the orders page
- Verify work queue is processing ORDER_SUBMIT events
- Check for order_update events in WebSocket messages

---

## Test 4: Account Balance Updates

### Steps

1. Note current equity value (e.g., $104,308.75)
2. Execute a buy trade (uses cash)
3. Watch account balance in portfolio dashboard

### Expected Results (within 1 second)

- [ ] Equity value updates
- [ ] Buying power updates (decreases)
- [ ] Cash balance updates (decreases)
- [ ] Day P&L updates
- [ ] Console shows: `[Realtime] Account updated: equity = <new_value>`

### If Failed

- Check useRealtimeAccount is active
- Verify account_update events in batch messages
- Check ['portfolio', 'snapshot'] cache is updating

---

## Test 5: Connection Status Indicator

### Steps

1. Navigate to `/portfolio` page
2. Locate PortfolioStreamStatus indicator (should be in hero section header)
3. Observe the indicator

### Expected Results

- [ ] Green pulsing dot when connected
- [ ] Tooltip on hover shows "Connected - Real-time updates active"
- [ ] Shows "Last update: just now" in tooltip

### Steps (Disconnect Test)

4. Stop the server (Ctrl+C in terminal)
5. Watch the indicator

### Expected Results

- [ ] Indicator changes to yellow (reconnecting)
- [ ] Console shows reconnection attempts with delays: 1s, 2s, 4s, 8s...
- [ ] After 10 failed attempts (~2 min), status changes to red (error)

### Steps (Reconnect Test)

6. Restart the server (`npm run dev`)
7. Watch the indicator

### Expected Results

- [ ] Indicator changes back to green (connected)
- [ ] Console shows: "[PortfolioStream] Connected successfully"
- [ ] LiveBadges return to "Live" status

---

## Test 6: Data Staleness Detection

### Steps

1. Navigate to `/admin/positions`
2. Ensure WebSocket is connected
3. Wait 30 seconds without any trades

### Expected Results

- [ ] After ~5 seconds: LiveBadges remain "Live" (green)
- [ ] After ~6 seconds: LiveBadges change to "Delayed" (yellow)
- [ ] After ~30 seconds: LiveBadges change to "Stale" (red)
- [ ] After ~60 seconds: Yellow warning banner appears at top:
  ```
  ⚠️ Data May Be Outdated
  Portfolio data may be outdated. Last updated 1m ago.
  [Refresh]
  ```

### Steps (Fresh Data Test)

4. Execute a trade (any symbol)

### Expected Results

- [ ] Warning banner **auto-hides** immediately
- [ ] LiveBadges return to "Live" (green pulsing)
- [ ] Staleness timer resets

---

## Test 7: Batching Efficiency

### Steps

1. Open Network tab → Filter by WS
2. Watch WebSocket frames while market is active
3. Execute multiple trades rapidly (3+ trades in 1 second)

### Expected Results

- [ ] Multiple events are batched into single WebSocket message
- [ ] Message type: "batch"
- [ ] Message data contains arrays: {positions: [...], orders: [...], account: {...}}
- [ ] Only 1 message per second (not 1 per event)
- [ ] Bandwidth reduced vs individual messages

### Metrics

- Events emitted: **\_** (from server logs)
- Messages sent: **\_** (from Network tab)
- Batch efficiency: **\_** % (should be >90%)

---

## Test 8: Multiple Connections (Same User)

### Steps

1. Open `/admin/positions` in Chrome
2. Open `/admin/positions` in another tab or browser
3. Execute a trade

### Expected Results

- [ ] **Both tabs** receive the same WebSocket event
- [ ] **Both tabs** show the updated P&L with animation
- [ ] **Both tabs** stay synchronized
- [ ] Server logs show 2 connections for same userId

### If Failed

- Check connection tracking Map<userId, Set<Connection>>
- Verify broadcast logic sends to all user connections

---

## Test 9: Animation System

### Steps

1. Navigate to `/admin/positions`
2. Execute a profitable trade (buy low, sell high scenario)
3. Watch the P&L column

### Expected Results

- [ ] AnimatedPnL component flashes **green** background
- [ ] P&L value scales up (1.05x) then back to normal
- [ ] Animation duration: ~500ms
- [ ] Smooth, professional feel (no jank)

### Steps (Loss Animation)

4. Execute a losing trade
5. Watch P&L decrease

### Expected Results

- [ ] AnimatedPnL component flashes **red** background
- [ ] P&L value shakes left-right
- [ ] Animation feels responsive, not laggy

### Accessibility Test

6. Enable prefers-reduced-motion in browser (varies by browser)
7. Execute trade

### Expected Results

- [ ] NO animations play
- [ ] Only color changes (green → red)
- [ ] Still functional without motion

---

## Test 10: Admin Monitoring

### Steps

1. Open admin panel or use curl:
   ```bash
   curl http://localhost:5000/api/admin/websocket-stats \
     -H "Cookie: session=YOUR_SESSION"
   ```

### Expected Results

```json
{
  "status": "healthy",
  "enabled": true,
  "activeConnections": 2,
  "connectionsByUser": {
    "user-123": 2
  },
  "totalMessagesDelivered": 145,
  "totalEventsEmitted": 1200,
  "performance": {
    "batchEfficiency": "95.2%",
    "avgConnectionDurationSeconds": 180,
    "disconnectRatePerMinute": "0.50"
  },
  "uptime": {
    "seconds": 300,
    "formatted": "5m"
  }
}
```

- [ ] Status is "healthy"
- [ ] Connection counts are accurate
- [ ] Batch efficiency is >90%
- [ ] Uptime is reasonable

---

## Test 11: Error Handling

### Steps

1. Connect to WebSocket without session cookie:
   ```bash
   wscat -c ws://localhost:5000/ws/portfolio
   ```

### Expected Results

- [ ] Connection rejected with code 1008 (Policy Violation)
- [ ] Close reason: "Authentication required"
- [ ] Server logs: "Connection rejected - authentication failed"

### Steps (Connection Limit)

2. Open 6 tabs to `/admin/positions` simultaneously

### Expected Results

- [ ] First 5 tabs connect successfully
- [ ] 6th tab gets rejected
- [ ] Console shows: "Maximum connections exceeded (5 per user)"
- [ ] 6th tab falls back to REST polling

---

## Test 12: Performance Under Load

### Steps

1. Have 13 open positions (current state)
2. Watch WebSocket traffic during market hours
3. Monitor browser performance (F12 → Performance tab)

### Expected Results

- [ ] Position updates batched (max 1 message/second)
- [ ] No UI jank or stuttering
- [ ] Memory usage stays stable (no leaks)
- [ ] CPU usage reasonable (<10% sustained)

---

## Performance Benchmarks

Record these metrics after 10 minutes of operation:

| Metric                       | Target | Actual | Pass/Fail |
| ---------------------------- | ------ | ------ | --------- |
| Event delivery latency (p95) | <500ms | **\_** | [ ]       |
| Batch efficiency             | >90%   | **\_** | [ ]       |
| Active connections           | 1-5    | **\_** | [ ]       |
| Memory usage (server)        | <100MB | **\_** | [ ]       |
| Disconnect rate              | <5/min | **\_** | [ ]       |
| Reconnection success         | >95%   | **\_** | [ ]       |

---

## Sign-Off

**All Critical Tests Passed**: [ ] YES / [ ] NO

**Issues Found**:

- Issue 1: **************\_\_\_**************
- Issue 2: **************\_\_\_**************
- Issue 3: **************\_\_\_**************

**Tester Signature**: ********\_********
**Date**: ********\_********

**Ready for Production**: [ ] YES / [ ] NO / [ ] WITH FIXES

---

## Troubleshooting Guide

### WebSocket Not Connecting

- Check: `ENABLE_REALTIME_PORTFOLIO` not set to "false"
- Check: Server logs show "Portfolio stream initialized"
- Check: Session cookie exists and is valid
- Check: Port 5000 is accessible

### Events Not Arriving

- Check: Event bus listeners registered (server startup logs)
- Check: Trade execution emits events (check Alpaca stream logs)
- Check: WebSocket subscription successful (console logs)
- Check: Network tab shows WS messages flowing

### Animations Not Playing

- Check: AnimatedPnL component is actually used (not static text)
- Check: Framer Motion installed (`npm list framer-motion`)
- Check: prefers-reduced-motion not enabled
- Check: Value is actually changing (not same value twice)

### High Latency

- Check: Server load (CPU, memory)
- Check: Network latency (ping Alpaca API)
- Check: Database query performance
- Check: Batching is working (not sending individual events)

---

**End of E2E Test Checklist**

This checklist validates all requirements from the OpenSpec proposal.
Execute this before marking Tasks 4.1-4.5 as complete.
