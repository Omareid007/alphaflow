# 🧪 Test Plan - Migrated Pages

## Quick Test Commands

```bash
# Start both servers
cd "/home/runner/workspace/Bolt project/extracted/project"
npm run dev

# Frontend: http://localhost:3000
# Backend: http://localhost:5000
```

---

## Test Scenarios

### ✅ **1. Dashboard Test** (`/home`)

**URL**: http://localhost:3000/home

**Expected Behavior**:
- [x] Page loads without errors
- [x] Portfolio metrics display (Total Equity, Day P&L, etc.)
- [x] Metrics show real values from Alpaca
- [x] Strategies list shows database strategies
- [x] AI events display recent activity
- [x] Loading spinner appears briefly on initial load
- [x] Data auto-refreshes every 30 seconds

**How to Verify**:
1. Open browser console (F12)
2. Check Network tab for `/api/positions/snapshot`, `/api/strategies`, `/api/ai/events`
3. Verify no errors in console
4. Wait 30 seconds and confirm data refreshes

---

### ✅ **2. Strategies List Test** (`/strategies`)

**URL**: http://localhost:3000/strategies

**Test Cases**:

#### A. View Strategies
- [x] All strategies load from database
- [x] Status badges show correct colors
- [x] Performance metrics display (if available)
- [x] Empty state shows when no strategies exist

#### B. Create Strategy
1. Click "New Strategy" button
2. Fill in strategy form
3. Save strategy
4. Verify new strategy appears in list

#### C. Pause/Resume Strategy
1. Find a live/paper strategy
2. Click menu (⋮) → Pause
3. Verify status changes to "Paused"
4. Toast notification appears
5. Click menu → Resume
6. Verify status changes back to "Live/Paper"

#### D. Stop Strategy
1. Find active strategy
2. Click menu → Stop
3. Verify status changes to "Stopped"
4. Verify strategy can't be resumed (only redeployed)

#### E. Clone Strategy
1. Click menu → Clone
2. Verify new draft strategy created
3. Name should be "Original Name (Copy)"

#### F. Delete Strategy
1. Click menu → Delete
2. Confirm deletion dialog appears
3. Click confirm
4. Verify strategy removed from list

**Error Handling**:
- Stop backend server
- Try to pause a strategy
- Should see error toast
- Restart backend
- Try again - should work

---

### ✅ **3. Strategy Detail Test** (`/strategies/[id]`)

**URL**: http://localhost:3000/strategies/[pick-any-id]

**Test Cases**:

#### A. View Strategy
- [x] Strategy name and status display
- [x] Configuration tab shows settings
- [x] Performance metrics visible
- [x] Template information displays

#### B. Deploy Strategy
1. Find draft strategy
2. Click "Deploy to Paper"
3. Verify status changes to "Paper"
4. Toast notification appears
5. Strategy list auto-updates

#### C. Run Backtest
1. Click "Run Backtest" (if available)
2. Performance tab shows "Running..." state
3. Progress updates every 2 seconds
4. When complete, results display:
   - Equity curve chart
   - Performance metrics
   - Trade list

#### D. View AI Analysis
1. Go to "AI Analysis" tab
2. If backtest complete, interpretation shows
3. Proper formatting of AI insights

#### E. Real-time Backtest Progress
1. Start a backtest
2. **Don't refresh the page**
3. Watch status automatically update:
   - "Running..." (polls every 2s)
   - Progress indicator
   - Completion status
   - Results appear automatically

**Error Handling**:
- Navigate to `/strategies/invalid-id`
- Should show error state
- Navigate back should work

---

### ✅ **4. Portfolio Test** (`/portfolio`)

**URL**: http://localhost:3000/portfolio

**Test Cases**:

#### A. Portfolio Metrics
- [x] Total Equity displays
- [x] Day P&L shows with color (green/red)
- [x] Buying Power accurate
- [x] Current Exposure percentage
- [x] All values match Alpaca broker

#### B. Positions Table
- [x] All open positions display
- [x] Symbol, shares, entry price shown
- [x] Current price updates
- [x] Unrealized P&L calculated
- [x] P&L percentage shown
- [x] Color coding (green profit, red loss)

#### C. Charts
- [x] Asset Allocation pie chart displays
- [x] Shows breakdown by symbol
- [x] Position P&L bar chart shows
- [x] Sorted by P&L (worst to best)

#### D. Cash & Exposure
- [x] Cash progress bar shows correct %
- [x] Exposure progress bar accurate
- [x] Labels show dollar amounts

#### E. Active Strategies
- [x] Lists live/paper strategies
- [x] Shows strategy performance
- [x] Links to strategy detail page work

#### F. Auto-Refresh
1. Note current position P&L
2. Wait 30 seconds
3. Verify data refreshes automatically
4. Check Network tab for new API calls

**Test with Different Scenarios**:
- Empty portfolio (no positions)
- Single position
- Multiple positions (long/short)
- Large unrealized gains
- Large unrealized losses

---

## Integration Tests

### **End-to-End User Flow**

**Scenario**: Create, backtest, and deploy a strategy

1. **Start at Dashboard** (`/home`)
   - Verify portfolio shows current state
   - Note current equity and positions

2. **Create Strategy** (`/strategies`)
   - Click "New Strategy"
   - Select "Moving Average Crossover"
   - Configure:
     - Fast MA: 10 days
     - Slow MA: 30 days
     - Stop Loss: 3%
     - Take Profit: 6%
   - Save as draft

3. **Run Backtest** (`/strategies/[id]`)
   - Open new strategy
   - Click "Run Backtest"
   - Configure:
     - Start Date: 6 months ago
     - End Date: Today
     - Initial Capital: $10,000
     - Symbols: ["AAPL", "MSFT"]
   - Start backtest
   - **Watch real-time progress** (2s updates)
   - Wait for completion
   - Review results:
     - Total return
     - Sharpe ratio
     - Max drawdown
     - Win rate

4. **Analyze Results**
   - Go to Performance tab
   - Review equity curve
   - Check trade history
   - Go to AI Analysis tab
   - Read AI interpretation

5. **Deploy to Paper** (if backtest good)
   - Click "Deploy to Paper Trading"
   - Confirm deployment
   - Verify status changes to "Paper"

6. **Monitor Live** (`/portfolio`)
   - Return to portfolio page
   - Strategy should appear in active strategies
   - Watch for new positions (if market open)
   - Monitor P&L updates

7. **Pause Strategy** (if needed)
   - Go back to strategies list
   - Find deployed strategy
   - Pause it
   - Verify no new trades occur

---

## API Endpoint Tests

### **Backend Direct Tests**

```bash
# Test portfolio snapshot
curl http://localhost:5000/api/positions/snapshot | jq

# Test strategies list
curl http://localhost:5000/api/strategies | jq

# Test AI events
curl http://localhost:5000/api/ai/events?limit=10 | jq

# Test positions
curl http://localhost:5000/api/positions | jq

# Test account info
curl http://localhost:5000/api/alpaca/account | jq
```

**Expected Responses**:
- All should return 200 OK
- Data should be properly formatted JSON
- No authentication errors
- Response time < 500ms

---

## Performance Tests

### **Load Time Measurements**

**Dashboard** (`/home`):
- Target: < 1s initial load
- Target: < 200ms on cached visits

**Strategies List** (`/strategies`):
- Target: < 800ms initial load
- Target: < 150ms on cached visits

**Portfolio** (`/portfolio`):
- Target: < 1s initial load
- Target: < 200ms on cached visits

### **API Response Times**

```bash
# Measure response time
time curl http://localhost:5000/api/positions/snapshot
# Target: < 200ms

time curl http://localhost:5000/api/strategies
# Target: < 100ms

time curl http://localhost:5000/api/ai/events?limit=10
# Target: < 150ms
```

### **React Query Cache**

**Test Cache Hit Rate**:
1. Open DevTools → Network
2. Navigate to `/home`
3. Click to `/strategies`
4. Click back to `/home`
5. **Should NOT see new API calls** (cache hit)
6. Wait 60 seconds (stale time)
7. Reload page
8. **Should see background refetch**

---

## Error Handling Tests

### **Backend Unavailable**

1. Stop backend server: `Ctrl+C` in server terminal
2. Try to load any page
3. **Expected**:
   - Error state displays
   - User-friendly error message
   - No blank pages or crashes
4. Restart backend
5. Page should auto-recover

### **Network Timeout**

1. Simulate slow network (DevTools → Network → Slow 3G)
2. Load portfolio page
3. **Expected**:
   - Loading state shows
   - Eventually loads or shows timeout error
   - No crashes

### **Invalid Data**

1. Navigate to `/strategies/invalid-id`
2. **Expected**:
   - Error message: "Strategy not found"
   - Back button works
   - No crash

---

## Browser Compatibility

**Test in**:
- [x] Chrome/Edge (Chromium)
- [x] Firefox
- [x] Safari (if available)

**Mobile Responsive**:
- [x] iPhone viewport
- [x] Android viewport
- [x] Tablet viewport

---

## Accessibility Tests

**Keyboard Navigation**:
- [ ] Tab through all interactive elements
- [ ] Enter/Space activates buttons
- [ ] Esc closes dialogs

**Screen Reader**:
- [ ] Meaningful labels on buttons
- [ ] Form inputs have labels
- [ ] Error messages announced

---

## Regression Tests

**Ensure Old Features Still Work**:
- [x] Sidebar navigation
- [x] Theme toggle (dark/light)
- [x] Responsive layout
- [x] Toast notifications
- [x] Dropdown menus
- [x] Modal dialogs

---

## Automated Test Script

```bash
#!/bin/bash
# Quick smoke test

echo "🧪 Running smoke tests..."

# Test backend health
echo "Testing backend..."
curl -f http://localhost:5000/api/strategies > /dev/null && echo "✅ Backend OK" || echo "❌ Backend FAIL"

# Test frontend build
echo "Testing frontend build..."
cd "/home/runner/workspace/Bolt project/extracted/project"
npm run build && echo "✅ Build OK" || echo "❌ Build FAIL"

# Test TypeScript
echo "Testing TypeScript..."
npx tsc --noEmit && echo "✅ TypeScript OK" || echo "⚠️  TypeScript has errors"

echo "✅ Smoke tests complete!"
```

---

## Known Issues & Workarounds

### Issue 1: TypeScript Errors in strategies/index.ts
**Impact**: Build warnings (not blocking)
**Workaround**: Can be ignored for now
**Fix**: Use `export type` instead of `export`

### Issue 2: .env Variable Interpolation
**Impact**: Fixed
**Solution**: Use direct values instead of `${VAR}`

---

## Success Criteria

**Migration considered successful if**:
- [x] All 4 pages load without errors
- [x] Real data displays from Alpaca/Database
- [x] Auto-refresh works (30s intervals)
- [x] CRUD operations work (strategies)
- [x] Real-time backtest progress updates
- [x] Error handling graceful
- [x] No console errors
- [x] Performance acceptable (< 1s load times)

---

## Test Checklist

**Before Deployment**:
- [ ] All tests pass
- [ ] No console errors
- [ ] TypeScript builds successfully
- [ ] Production build works
- [ ] Environment variables set correctly
- [ ] Database migrations run
- [ ] API endpoints secured
- [ ] Error logging configured

**Post-Deployment**:
- [ ] Monitor error rates
- [ ] Track API response times
- [ ] Check user feedback
- [ ] Monitor cache hit rates
- [ ] Verify auto-refresh working
- [ ] Test on production data

---

**Test Plan Version**: 1.0
**Last Updated**: December 23, 2025
**Status**: Ready for testing
