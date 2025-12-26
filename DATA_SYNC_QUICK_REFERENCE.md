# Data Sync Quick Reference

**Last Updated**: 2025-12-25
**Status**: ✅ All Critical Issues Fixed

---

## Quick Issue Summary

### What Was Wrong?
Position data field names were inconsistent across layers:
- Alpaca API: `qty`, `unrealized_pl`, `unrealized_plpc`
- Backend: `quantity`, `unrealizedPnl`, `unrealizedPnlPercent`
- Frontend: `qty`, `unrealizedPl`, `unrealizedPlPct`

### What Was Fixed?
- ✅ Backend now returns **BOTH** field name formats for backward compatibility
- ✅ Frontend hooks enhanced to handle multiple field name variations
- ✅ Detailed documentation added to codebase

---

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `/home/runner/workspace/server/shared/position-mapper.ts` | Added dual field names to EnrichedPosition | ✅ Fixed |
| `/home/runner/workspace/lib/api/hooks/usePortfolio.ts` | Enhanced fallback logic in usePositions() | ✅ Fixed |

---

## Field Name Mapping Reference

### Position Fields

| Alpaca API | Backend (EnrichedPosition) | Frontend (Position) |
|------------|---------------------------|---------------------|
| `qty` (string) | `qty` (number) + `quantity` (alias) | `qty` (number) |
| `avg_entry_price` | `entryPrice` | `entryPrice` |
| `current_price` | `currentPrice` | `currentPrice` |
| `unrealized_pl` | `unrealizedPl` + `unrealizedPnl` (alias) | `unrealizedPl` |
| `unrealized_plpc` | `unrealizedPlPct` + `unrealizedPnlPercent` (alias) | `unrealizedPlPct` |
| `market_value` | `marketValue` | `marketValue` |
| `cost_basis` | `costBasis` | `costBasis` |

### Order Fields

| Alpaca API | Backend (EnrichedOrder) | Frontend (Order) |
|------------|------------------------|------------------|
| `qty` | `quantity` | `qty` |
| `filled_qty` | `filledQuantity` | `filledQty` |
| `limit_price` | `limitPrice` | `limitPrice` |
| `stop_price` | `stopPrice` | `stopPrice` |
| `filled_avg_price` | `filledAvgPrice` | `filledAvgPrice` |

---

## API Endpoints Reference

### Position Endpoints

| Endpoint | Response Format | Usage |
|----------|----------------|-------|
| `GET /api/positions/snapshot` | Simple Position objects | Portfolio summary widget |
| `GET /api/positions` | EnrichedPosition with `_source` | Detailed positions list |
| `GET /api/positions/broker` | EnrichedPosition (alias for `/api/positions`) | Backward compatibility |
| `GET /api/alpaca/positions` | Raw Alpaca format | Direct Alpaca data (testing) |

### Order Endpoints

| Endpoint | Response Format | Usage |
|----------|----------------|-------|
| `GET /api/orders` | Database orders with `_source` | Order history |
| `GET /api/orders/recent` | Live Alpaca orders | Recent trading activity |
| `GET /api/orders/:id` | Single order by ID | Order details |
| `POST /api/orders/sync` | Sync trigger response | Manual order sync |

---

## Data Flow Diagram (Simplified)

```
Alpaca API
    │
    │ { qty: "10", unrealized_pl: "50.00", unrealized_plpc: "0.0333" }
    ▼
Position Mapper
    │
    │ Maps to BOTH field names:
    │ { qty: 10, quantity: 10, unrealizedPl: 50, unrealizedPnl: 50, ... }
    ▼
Frontend Hook
    │
    │ Handles fallbacks:
    │ qty = p.qty ?? p.quantity
    │ unrealizedPl = p.unrealizedPl ?? p.unrealizedPnl
    ▼
UI Component
    │
    │ { qty: 10, unrealizedPl: 50, unrealizedPlPct: 3.33 }
    ▼
Display: "10 shares, +$50.00 (+3.33%)"
```

---

## Testing Commands

### 1. Test Position Endpoint
```bash
curl -X GET http://localhost:5000/api/positions \
  -H "Cookie: session=YOUR_SESSION_ID" | jq '.positions[0]'

# Should show BOTH qty and quantity fields
```

### 2. Test Snapshot Endpoint
```bash
curl -X GET http://localhost:5000/api/positions/snapshot \
  -H "Cookie: session=YOUR_SESSION_ID" | jq '.positions[0]'
```

### 3. Test Alpaca Account
```bash
curl -X GET http://localhost:5000/api/alpaca/account \
  -H "Cookie: session=YOUR_SESSION_ID" | jq '.'
```

### 4. Check Alpaca Credentials
```bash
# From project root:
grep "ALPACA_" .env

# Should show:
# ALPACA_API_KEY=PKK3U5MHIFNRWUEOXV7L2KGZRK
# ALPACA_SECRET_KEY=HunZi1hNZQUhzcdWmUkLuEGa3ibQFAPsheQ55T7SZC8T
# ALPACA_TRADING_MODE=paper
```

---

## Common Issues & Solutions

### Issue: Position quantities showing as 0 or undefined

**Cause**: Frontend expecting `qty` but API returning only `quantity`

**Solution**: ✅ FIXED - Backend now returns both field names

**Verify Fix**:
```typescript
// In browser console:
fetch('/api/positions')
  .then(r => r.json())
  .then(data => console.log(data.positions[0]));

// Check output has BOTH:
// qty: 10
// quantity: 10
```

---

### Issue: P&L showing as $0.00 or NaN

**Cause**: Frontend expecting `unrealizedPl` but API returning only `unrealizedPnl`

**Solution**: ✅ FIXED - Backend now returns both field names

**Verify Fix**:
```typescript
// Check P&L fields:
fetch('/api/positions')
  .then(r => r.json())
  .then(data => {
    const pos = data.positions[0];
    console.log({
      unrealizedPl: pos.unrealizedPl,
      unrealizedPnl: pos.unrealizedPnl,
      // Both should have same value
    });
  });
```

---

### Issue: Percentage showing wrong value (0.0333 instead of 3.33%)

**Cause**: Alpaca returns `unrealized_plpc` as decimal (0.0333), needs * 100

**Solution**: ✅ FIXED - Position mapper now converts to percentage

**Verify Fix**:
```typescript
// Check percentage conversion:
fetch('/api/positions')
  .then(r => r.json())
  .then(data => {
    const pos = data.positions[0];
    console.log({
      unrealizedPlPct: pos.unrealizedPlPct,      // Should be 3.33
      unrealizedPnlPercent: pos.unrealizedPnlPercent, // Should be 3.33
      // NOT 0.0333!
    });
  });
```

---

### Issue: "Alpaca API credentials not configured" error

**Cause**: Missing or incorrect .env configuration

**Solution**: Verify .env has correct credentials (already verified ✅)

**Check**:
```bash
# Ensure these are set:
ALPACA_API_KEY=PKK3U5MHIFNRWUEOXV7L2KGZRK
ALPACA_SECRET_KEY=HunZi1hNZQUhzcdWmUkLuEGa3ibQFAPsheQ55T7SZC8T
ALPACA_TRADING_MODE=paper

# Restart server after changing .env:
npm run dev
```

---

## Best Practices Going Forward

### When Working with Position Data

1. **Always use primary field names** in new code:
   - `qty` (not `quantity`)
   - `unrealizedPl` (not `unrealizedPnl`)
   - `unrealizedPlPct` (not `unrealizedPnlPercent`)

2. **Backend remains backward compatible**:
   - Old code using `quantity` will still work
   - Deprecated fields will be available until future migration

3. **Frontend hooks are defensive**:
   - Multiple fallbacks for field names
   - Safe parsing with default values
   - Type assertions for safety

### When Adding New Fields

1. Use camelCase (not snake_case)
2. Document field in TypeScript interface
3. Add fallback in frontend hooks if optional
4. Consider backward compatibility

---

## Credentials Reference

### Alpaca Paper Trading (Current)

```
API Key: PKK3U5MHIFNRWUEOXV7L2KGZRK
Secret Key: HunZi1hNZQUhzcdWmUkLuEGa3ibQFAPsheQ55T7SZC8T
Mode: paper
Base URL: https://paper-api.alpaca.markets/v2
Data URL: https://data.alpaca.markets
```

### Environment Variables

```bash
# Trading Configuration
ALPACA_API_KEY=PKK3U5MHIFNRWUEOXV7L2KGZRK
ALPACA_SECRET_KEY=HunZi1hNZQUhzcdWmUkLuEGa3ibQFAPsheQ55T7SZC8T
ALPACA_TRADING_MODE=paper
ALPACA_PAPER_URL=https://paper-api.alpaca.markets/v2

# Optional Overrides (not needed for paper trading)
# ALPACA_LIVE_URL=https://api.alpaca.markets
# ALPACA_DATA_URL=https://data.alpaca.markets
# ALPACA_STREAM_URL=wss://stream.data.alpaca.markets
```

---

## Contact & Support

For questions or issues:
1. Check the main report: `DATA_SYNC_ANALYSIS_AND_FIXES.md`
2. Review code comments in modified files
3. Check Alpaca API docs: https://alpaca.markets/docs/

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-25 | 1.0 | Initial sync fix - dual field names implemented |

---

**End of Quick Reference**
