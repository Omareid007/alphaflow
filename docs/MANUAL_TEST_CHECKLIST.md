# AlphaFlow Manual Test Checklist

Use this checklist to manually verify each feature works after the stabilization audit.

## Pre-Testing Setup

### Environment Configuration
- [ ] Copy .env.example to .env (create .env.example first if missing)
- [ ] Set required Alpaca keys: `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`
- [ ] Set trading mode: `ALPACA_TRADING_MODE=paper` (for safety)
- [ ] Configure AI provider keys (at least one): `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
- [ ] Set admin token: `ADMIN_TOKEN=your-secure-token`

### Development Server
- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts without crashes
- [ ] Frontend accessible at `http://localhost:3000`
- [ ] Backend accessible at `http://localhost:5000`

## Authentication Flow

### User Registration
- [ ] Registration form loads at `/register`
- [ ] Can create new user account
- [ ] Email validation works (if email field present)
- [ ] Password validation enforces minimum requirements
- [ ] Success redirects to dashboard/login

### User Login
- [ ] Login form loads at `/login`
- [ ] Can login with valid credentials
- [ ] Invalid credentials show error message
- [ ] Successful login redirects to dashboard
- [ ] User session persists on page refresh

### Session Management
- [ ] Protected routes redirect to login when not authenticated
- [ ] User can logout successfully
- [ ] Logout clears session
- [ ] Session expires appropriately (if configured)

## Dashboard & Portfolio

### Main Dashboard
- [ ] Dashboard loads at `/` or `/home` without errors
- [ ] Portfolio value displays (mock data OK if no positions)
- [ ] Loading states show during data fetch
- [ ] Error boundaries catch any component crashes
- [ ] Navigation works to other sections

### Portfolio View
- [ ] Portfolio page loads at `/portfolio`
- [ ] Current positions list (empty list OK initially)
- [ ] Cash balance displays
- [ ] Buying power shows
- [ ] Portfolio charts render (empty/mock data acceptable)
- [ ] Real-time updates work (if streaming enabled)

## Trading Functionality

### Stock Research/Lookup
- [ ] Can search for stock symbols
- [ ] Stock detail pages load with basic info
- [ ] Price data displays (real or mock)
- [ ] Charts render for stock symbols
- [ ] Watchlist functionality works

### Order Placement
- [ ] Order form accessible from stock detail or trading page
- [ ] Can select order type (market, limit)
- [ ] Can set quantity
- [ ] Can choose buy/sell
- [ ] Form validation works (required fields, positive numbers)
- [ ] Order preview shows before submission

### Order Execution (Paper Trading)
- [ ] Order submits successfully
- [ ] Order appears in pending orders list
- [ ] Order status updates (filled/rejected)
- [ ] Position updates after fill
- [ ] Cash balance adjusts correctly
- [ ] Trade appears in history/ledger

### Order Management
- [ ] Can view order history at `/ledger`
- [ ] Can cancel pending orders
- [ ] Order status displays correctly
- [ ] Profit/loss calculations show

## Alpaca Integration

### Account Connection
- [ ] Alpaca account connects successfully (check logs)
- [ ] Account balance syncs from Alpaca
- [ ] Buying power displays correctly
- [ ] Account status shows (paper/live)
- [ ] Connection errors handled gracefully

### Market Data
- [ ] Stock prices load from Alpaca/Finnhub
- [ ] Price updates in reasonable time
- [ ] Market hours status displays
- [ ] Data disconnections handled gracefully

### Trade Synchronization
- [ ] Orders placed through AlphaFlow appear in Alpaca
- [ ] Alpaca order fills update in AlphaFlow
- [ ] Position sync between systems
- [ ] Account value calculations match

## AI Features

### AI Analysis
- [ ] AI analysis page loads at `/ai`
- [ ] Can request analysis for stocks/portfolio
- [ ] AI provider responds (OpenAI/Claude/Groq)
- [ ] Analysis results display properly
- [ ] Multiple providers available/fallback works
- [ ] Rate limiting functions properly

### AI-Generated Insights
- [ ] Market sentiment analysis generates
- [ ] Strategy recommendations appear
- [ ] Risk assessments calculate
- [ ] AI explanations are readable
- [ ] Refresh/regenerate functionality works

## Strategy Management (if implemented)

### Strategy Creation
- [ ] Strategy creation wizard at `/create`
- [ ] Can define strategy parameters
- [ ] Strategy validation works
- [ ] Can save strategy
- [ ] Strategy appears in strategy list

### Strategy Execution
- [ ] Can start/stop strategies
- [ ] Strategy status updates
- [ ] Strategy generates trades
- [ ] Performance tracking works
- [ ] Error handling for strategy failures

### Backtesting
- [ ] Backtest page loads at `/backtests`
- [ ] Can configure backtest parameters
- [ ] Backtest execution runs
- [ ] Results display with charts
- [ ] Performance metrics calculate

## Admin Features (if admin access configured)

### Admin Dashboard
- [ ] Admin dashboard accessible at `/admin` with admin token
- [ ] System overview displays
- [ ] Key metrics show current status
- [ ] Admin navigation works

### User Management
- [ ] User list loads at `/admin/users`
- [ ] Can view user details
- [ ] Can modify user permissions (if implemented)
- [ ] User activity tracking visible

### Trading Administration
- [ ] Order monitoring at `/admin/orders`
- [ ] Position oversight at `/admin/positions`
- [ ] Kill switch accessible and functional
- [ ] Trading halt capabilities work

### System Monitoring
- [ ] System health at `/admin/system`
- [ ] API provider status
- [ ] Database connectivity
- [ ] Error logs accessible
- [ ] Performance metrics display

### Kill Switch
- [ ] Kill switch accessible to admin
- [ ] Activating stops all trading
- [ ] Pending orders cancel automatically
- [ ] New orders blocked during kill switch
- [ ] Can deactivate kill switch
- [ ] Status clearly indicates when active

## Error Handling & UX

### Loading States
- [ ] All pages show loading skeletons/spinners
- [ ] No blank screens during navigation
- [ ] Loading states don't persist indefinitely
- [ ] Progressive data loading works

### Error Boundaries
- [ ] Component crashes don't break entire app
- [ ] Error boundaries show friendly messages
- [ ] Error reporting works (if configured)
- [ ] User can recover from errors

### Form Validation
- [ ] Required field validation
- [ ] Format validation (email, numbers)
- [ ] Real-time validation feedback
- [ ] Clear error messages
- [ ] Success confirmations

### Responsive Design
- [ ] Works on desktop browsers
- [ ] Mobile responsive (if implemented)
- [ ] Navigation accessible on all screen sizes
- [ ] Forms usable on mobile

## Performance & Reliability

### Page Load Performance
- [ ] Initial page load under 3 seconds
- [ ] Subsequent navigation under 1 second
- [ ] Images/charts load efficiently
- [ ] No excessive re-renders

### Data Synchronization
- [ ] Real-time data updates work
- [ ] Data inconsistencies rare
- [ ] Offline behavior graceful (if implemented)
- [ ] Cache invalidation works properly

### System Stability
- [ ] No memory leaks during extended use
- [ ] WebSocket connections stable
- [ ] API rate limits respected
- [ ] Graceful degradation when services unavailable

## Security Testing

### Authentication Security
- [ ] Cannot access protected routes without login
- [ ] Admin routes properly protected
- [ ] Session tokens secure
- [ ] Password handling secure

### Data Security
- [ ] API keys not exposed in frontend
- [ ] User data properly isolated
- [ ] Admin functions restricted to admin users
- [ ] SQL injection protection (basic test)

---

## Testing Notes

**Record Issues Found**:

| Feature | Issue Description | Severity (High/Med/Low) | Status |
|---------|------------------|------------------------|--------|
|         |                  |                        |        |
|         |                  |                        |        |
|         |                  |                        |        |

**Environment Used**:
- Browser:
- OS:
- Node Version:
- Database:
- Alpaca Mode: paper/live

**Test Results Summary**:
- Total Features Tested: ___
- Working: ___
- Broken: ___
- Partially Working: ___

**Next Actions Required**:
1.
2.
3.

---

**Testing Date**: ___________
**Tested By**: ___________
**Review Required**: Yes/No