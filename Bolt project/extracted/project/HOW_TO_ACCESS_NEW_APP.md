# How to Access the New Bolt App

## The New App is Running! 🎉

The migrated Bolt Trading Platform is live and working. If you're seeing the old Replit app, it's a **browser caching issue**.

---

## Quick Fix

### Option 1: Hard Refresh (FASTEST)
1. Go to: **http://localhost:3000**
2. Press:
   - **Windows/Linux**: `Ctrl + Shift + R`
   - **Mac**: `Cmd + Shift + R`
3. This bypasses the cache and loads the new app

### Option 2: Clear Browser Cache
1. Open browser DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Option 3: Incognito/Private Window
1. Open a new incognito/private window
2. Go to: **http://localhost:3000**
3. The new app will load fresh

### Option 4: Different Browser
Try a different browser you haven't used for this project yet

---

## How to Confirm You're on the New App

Look for these indicators:

### ✅ You're on the NEW Bolt App if you see:
- **Title**: "AlphaFlow - AI Trading Platform"
- **Sidebar**: Dark sidebar with logo and navigation
- **Pages**: Home, Strategies, Create, Portfolio, Backtests, Ledger, AI Pulse, Research, Settings, Admin Hub
- **Home Page**: Shows "Dashboard" with Total Equity, Day P&L, Active Strategies, Buying Power
- **Real Data**: Portfolio metrics from your Alpaca account (28 positions synced)
- **Loading Spinners**: Brief loading states when fetching data

### ❌ You're on the OLD Replit app if you see:
- Different title or layout
- Different navigation structure
- Mock/fake data
- No connection to Alpaca

---

## Current Server Status

Both servers are running:

**Frontend (Next.js)**:
- URL: http://localhost:3000
- Status: ✅ Ready in 2s
- Routes: All 40 pages built

**Backend (Express)**:
- URL: http://localhost:5000
- Status: ✅ Server listening on port 5000
- Features:
  - ✅ Alpaca WebSocket authenticated
  - ✅ 28 positions synced from broker
  - ✅ Trading orchestrator active
  - ✅ Market analyzer running
  - ✅ Work queue processing
  - ✅ AI decision engine ready

---

## Test the Migration

Once you can see the new app, test these features:

1. **Home Page** (http://localhost:3000/home)
   - Should show real portfolio metrics
   - Total Equity, Day P&L cards
   - Strategies list
   - AI Activity feed

2. **Strategies Page** (http://localhost:3000/strategies)
   - Should show database strategies
   - Try pause/resume/delete operations
   - Should see toast notifications

3. **Portfolio Page** (http://localhost:3000/portfolio)
   - Should show 28 real positions
   - Asset allocation pie chart
   - Position P&L bar chart
   - Real-time data

4. **Create Strategy** (http://localhost:3000/create)
   - Strategy wizard should load
   - Select a template
   - Configure and run backtest
   - Deploy to paper trading

5. **Admin Pages** (http://localhost:3000/admin/positions)
   - Should show real positions
   - Real order data
   - Real strategy list

---

## Troubleshooting

### If you still see the old app after hard refresh:

1. **Check the URL**: Make sure you're on `http://localhost:3000` (not 8080 or other port)

2. **Check browser console** (F12 → Console):
   - Look for any red errors
   - Should see React Query devtools info
   - Should see API calls to `/api/positions/snapshot`, etc.

3. **Check Network tab** (F12 → Network):
   - Refresh and look at requests
   - Should see calls to `localhost:5000/api/*`
   - Should NOT see calls to old app ports

4. **Stop all servers and restart**:
   ```bash
   # Kill everything
   pkill -f "node"

   # Clear cache
   cd "/home/runner/workspace/Bolt project/extracted/project"
   rm -rf .next

   # Start fresh
   npm run dev
   ```

---

## Verification Commands

Run these to verify the new app is working:

```bash
# Check frontend is responding
curl http://localhost:3000 | grep "AlphaFlow"

# Check backend API
curl http://localhost:5000/api/strategies

# Check positions endpoint
curl http://localhost:5000/api/positions/snapshot

# Check AI events endpoint (NEW)
curl http://localhost:5000/api/ai/events
```

All should return data (or auth errors, which is fine).

---

## What You Should See

### Home Page Preview:
```
Dashboard
Overview of your trading performance

[Total Equity]     [Day P&L]        [Active Strategies]  [Buying Power]
$XXX,XXX          $XXX.XX           X                     $XXX,XXX
+X.XX% today      +X.XX%

Strategies (View All →)
├─ Strategy Name 1 [PAPER TRADING]
├─ Strategy Name 2 [LIVE]
└─ Strategy Name 3 [DRAFT]

AI Activity (View All →)
├─ AI event 1
├─ AI event 2
└─ AI event 3
```

### Sidebar Navigation:
```
🔼 AlphaFlow
   AI Trading Platform

   ◉ Home
   ☰ Strategies
   + Create
   📊 Portfolio
   ⏰ Backtests
   📖 Ledger
   🧠 AI Pulse
   🔬 Research
   ⚙ Settings
   🛡 Admin Hub

   [🌙 Dark Mode]
```

If you see this layout, you're on the new app!

---

## Still Having Issues?

If browser cache clearing doesn't work:

1. Close ALL browser tabs for localhost
2. Close the browser completely
3. Reopen and go directly to http://localhost:3000
4. Hard refresh immediately (Ctrl+Shift+R)

The new app is definitely running and ready to use!
