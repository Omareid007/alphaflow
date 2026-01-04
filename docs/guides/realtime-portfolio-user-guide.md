# Real-Time Portfolio Updates - User Guide

**Feature**: Real-Time Portfolio Streaming
**Version**: 1.0.0
**Status**: Active

---

## What's New? 🚀

Your portfolio now updates **instantly** when trades execute or positions change. No more refreshing the page or waiting for updates!

### Key Benefits

- **Instant P&L Updates**: See gains/losses within 500ms
- **Order Fill Notifications**: Get alerted when orders execute
- **Live Balance Tracking**: Watch your equity and buying power in real-time
- **Visual Indicators**: Know when data is live, delayed, or stale

---

## Features

### 1. Live P&L Updates ✨

**What You'll See**:

- Position P&L values update automatically as prices change
- **Green flash + scale animation** when profit increases
- **Red shake animation** when profit decreases

**Where**:

- `/portfolio` - Portfolio dashboard
- `/admin/positions` - Positions table

**How It Works**:

- WebSocket connection streams updates from the server
- Updates appear within 500ms of price changes
- No manual refresh needed!

### 2. Connection Indicator 🔌

Located in the top-right of portfolio pages.

**Status Colors**:

- **Green pulsing dot**: ✅ Connected - receiving live updates
- **Yellow dot**: ⚠️ Connecting or reconnecting
- **Red dot**: ❌ Connection error - using cached data
- **Gray dot**: ⭕ Disconnected - using cached data

**Tooltip**: Hover over the dot to see connection details and last update time.

### 3. Data Freshness Badges 📊

Each position shows a freshness indicator:

- **"Live" (green, pulsing)**: Data updated < 5 seconds ago
- **"Delayed" (yellow)**: Data updated 5-30 seconds ago
- **"Stale" (red)**: Data updated > 30 seconds ago
- **"Offline" (gray)**: No connection to real-time updates

**Auto-Updates**: Badges automatically transition as data ages (no refresh needed).

### 4. Staleness Warnings ⚠️

If your portfolio data becomes outdated (>60 seconds old), you'll see:

- Yellow warning banner at the top of the page
- Message: "Data may be outdated. Last updated 1m ago."
- Refresh button to manually update

**Auto-Dismiss**: The warning disappears automatically when fresh data arrives!

### 5. Order Fill Notifications 🔔

When an order fills, you'll see:

- Toast notification popup: "Order Filled: BUY 10 AAPL @ $175.50"
- Position updates immediately
- Account balance reflects the trade

---

## How To Use

### Viewing Real-Time Updates

1. **Navigate to Portfolio**:
   - Go to `/portfolio` or `/admin/positions`

2. **Check Connection Status**:
   - Look for green pulsing dot in header
   - Should see "Live" badges next to positions

3. **Execute a Trade** (or wait for market activity):
   - Submit an order via trading interface
   - Or wait for an existing limit order to fill

4. **Watch the Update**:
   - P&L value flashes green/red and animates
   - Quantity updates instantly
   - "Live" badge pulses
   - Connection indicator stays green

### Understanding Data Freshness

**Live (Green)**: Your data is current. Updates are flowing in real-time.

**Delayed (Yellow)**: Data is slightly old (5-30s). Usually happens when:

- Market is closed (no price updates)
- Network connection is slow
- Server is processing high load

**Stale (Red)**: Data is outdated (>30s). Causes:

- WebSocket disconnected
- Server is down
- Network issues

**Offline (Gray)**: No real-time connection. You're seeing cached/REST data.

### Reconnection

**Automatic**: If your connection is lost, the system automatically tries to reconnect:

1. First attempt: 1 second
2. Second attempt: 2 seconds
3. Third attempt: 4 seconds
4. ...up to 30 seconds between attempts

**Max Attempts**: 10 attempts (~2 minutes)

**Fallback**: After 10 failed attempts, the system falls back to REST API polling (updates every 5 seconds).

**Manual**: You can always refresh the page to force reconnection.

---

## Troubleshooting

### ❓ Not Seeing Live Updates?

**Check 1**: Connection indicator

- Should be **green pulsing dot**
- If yellow/red, connection has issues

**Check 2**: Console logs (F12 → Console)

- Should see: `[PortfolioStream] Connected`
- Should see: `[Realtime] Position updated: SYMBOL`

**Check 3**: Refresh the page

- Sometimes helps re-establish connection

**Check 4**: Internet connection

- WebSocket requires stable internet
- Check other sites work properly

### ❓ Data Seems Outdated?

**Look for indicators**:

- "Delayed" or "Stale" badges
- Yellow warning banner at top
- "Last updated: Xm ago" timestamp

**Solutions**:

1. Click **Refresh** button in warning banner
2. Wait a few seconds for automatic reconnection
3. Refresh the browser page
4. Check server status (contact admin if persistent)

### ❓ Animations Not Working?

**Possible causes**:

- Browser has "Reduce motion" enabled (accessibility feature)
- P&L value isn't actually changing
- JavaScript error in console (check F12 → Console)

**Solutions**:

- Check browser accessibility settings
- Disable "Reduce motion" if desired
- Check console for errors

### ❓ "Maximum Connections Exceeded" Error?

**Cause**: You have more than 5 tabs/windows open to the portfolio.

**Solution**: Close extra tabs. Keep max 5 open at once.

---

## FAQ

**Q: Will I lose data if I disconnect?**

A: No. All data is stored on the server. When you reconnect, you'll see the latest values. You might miss some intermediate updates, but the final state is accurate.

**Q: How much bandwidth does this use?**

A: Very little! Updates are batched (every 1 second) and only changed values are sent. Typical usage: <100KB per day (vs 5MB with traditional polling).

**Q: Can I use this on mobile?**

A: Yes! The real-time updates work on mobile browsers and React Native apps. Battery impact is minimal due to efficient batching.

**Q: What happens if the server restarts?**

A: Your browser automatically detects the disconnection and reconnects when the server comes back online. You'll see:

1. Connection indicator turns yellow (reconnecting)
2. After server starts, turns green (connected)
3. Fresh data loads automatically

**Q: Can I disable real-time updates?**

A: Currently, real-time updates are enabled by default. If WebSocket fails, the system automatically falls back to REST API polling, so you'll always have data.

**Q: Is my data secure?**

A: Yes! WebSocket connections are authenticated via your session. You can only see your own portfolio data, never other users' information.

**Q: What if I see "Data may be outdated"?**

A: This warning appears when data hasn't updated in >60 seconds. Usually means:

- Market is closed (no new prices)
- WebSocket temporarily disconnected
- Network interruption

Click the Refresh button or wait for automatic reconnection.

---

## Tips for Best Experience

1. **Keep Page Open**: Real-time updates only work while the page is open
2. **Stable Internet**: WebSocket works best with stable connection
3. **Don't Disable Cookies**: Session auth requires cookies enabled
4. **Update Browser**: Modern browsers have better WebSocket support
5. **Check Connection Indicator**: Green = all good, yellow/red = potential issues

---

## Technical Details (For Developers)

### React Hooks

- `usePortfolioStream()` - Base WebSocket connection
- `useRealtimePositions()` - Position updates
- `useRealtimeOrders()` - Order updates
- `useRealtimeAccount()` - Account balance updates

### Components

- `<ConnectionStatus />` - Connection indicator
- `<AnimatedPnL />` - Animated P&L values
- `<LiveBadge />` - Data freshness badge
- `<StalenessWarning />` - Stale data warning

### WebSocket Endpoint

```
wss://your-domain.com/ws/portfolio
```

### Channels

- `positions` - Position updates
- `orders` - Order status changes
- `account` - Account balance updates
- `trades` - Trade executions

---

## Support

**Issues or Questions?**

- Check this guide first
- Check `/docs/realtime-portfolio-testing-checklist.md` for troubleshooting
- Contact support with:
  - What you were doing
  - What you expected to see
  - What actually happened
  - Browser console errors (F12 → Console)

---

**Last Updated**: 2026-01-04
**Applies To**: v1.0.0+
**Related**: WebSocket API Documentation, Admin Runbook
