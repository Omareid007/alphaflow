# Position Router Integration Guide

## Quick Start

### Step 1: Import the Router
Add this to `/home/runner/workspace/server/routes.ts` near the other route imports (around line 82):

```typescript
import positionsRouter from "./routes/positions";
```

### Step 2: Mount the Router
Add this in the main route setup (in the Express app configuration):

```typescript
app.use("/api/positions", authMiddleware, positionsRouter);
```

**Important**: Place this AFTER the `authMiddleware` is defined but BEFORE any conflicting routes.

---

## Route Structure

The positions router provides 11 endpoints organized as follows:

```
GET  /api/positions/snapshot              - Portfolio snapshot with metrics
GET  /api/positions                        - List live positions from Alpaca
GET  /api/positions/broker                 - Alias for positions (backward compat)
GET  /api/positions/:id                    - Get specific position by ID
POST /api/positions                        - Create new position (DB only)
PATCH /api/positions/:id                   - Update position
DELETE /api/positions/:id                  - Delete position
POST /api/positions/reconcile              - Reconcile DB vs Alpaca
GET  /api/positions/reconcile/status       - Get reconciliation status
POST /api/positions/close/:symbol          - Close position by symbol
POST /api/positions/close-all              - Close all positions
```

---

## Route Precedence (Important!)

Routes must be mounted in this order to avoid conflicts:

1. **Specific routes** (e.g., `/snapshot`, `/broker`, `/reconcile`)
2. **POST /positions** for creation
3. **PATCH /positions/:id** for updates
4. **DELETE /positions/:id** for deletion
5. **GET /positions/:id** for single position (must be last GET)

**Why**: Express matches routes top-to-bottom. Parameterized routes like `/:id` will match `/snapshot` if placed first.

---

## Authentication

All routes require `authMiddleware` which:
- Validates user authentication
- Sets `req.userId` for database operations
- Prevents unauthorized access

Routes already protected by middleware setup:
```typescript
app.use("/api/positions", authMiddleware, positionsRouter);
```

---

## Data Sources

### Live Data (Source of Truth)
- **Endpoint**: `GET /api/positions`
- **Source**: Alpaca API
- **Freshness**: Real-time
- **Fallback**: Error response (no stale fallback per design)

### Database Data (Cache/Audit Trail)
- **Endpoints**: CRUD operations, reconciliation
- **Source**: Local database
- **Purpose**: Historical records, reconciliation, offline fallback
- **Sync**: Asynchronous background process from Alpaca

### Hybrid Data
- **Snapshot**: Combines Alpaca positions + DB trades for P&L
- **Reconciliation**: Compares DB vs Alpaca and syncs differences

---

## Key Features

### 1. Dust Position Filtering
- Filters positions < 0.0001 shares
- Prevents floating-point residuals from displaying
- Applied to `/api/positions` and `/api/positions/broker`

### 2. Background Sync
- When positions are fetched from Alpaca, they're synced to DB asynchronously
- Does not block API response
- Maintains audit trail and enables reconciliation

### 3. Source Metadata
All Alpaca-sourced responses include:
```typescript
_source: {
  type: "live",
  timestamp: "2024-01-15T...",
  broker: "alpaca"
}
```

Enables UI to display data freshness and source information.

### 4. Error Handling
- Graceful Alpaca API failures
- Standard error format across all endpoints
- Logging with "PositionsAPI" category for debugging

---

## Testing

### Test Live Positions
```bash
curl -H "Authorization: Bearer {token}" http://localhost:3000/api/positions
```

### Test Position Snapshot
```bash
curl -H "Authorization: Bearer {token}" http://localhost:3000/api/positions/snapshot
```

### Test Close Position
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/positions/close/AAPL
```

### Test Reconciliation
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/positions/reconcile

# Force reconciliation
curl -X POST \
  -H "Authorization: Bearer {token}" \
  "http://localhost:3000/api/positions/reconcile?force=true"
```

---

## Dependencies

### Required Modules
- `express` - HTTP framework
- `alpaca` connector - Broker integration
- `alpacaTradingEngine` - Order execution
- `storage` - Database operations
- `position-mapper` - Data enrichment

### Optional Modules (loaded on demand)
- `position-reconciler` - Reconciliation service

---

## Database Schema

Uses these shared schema types:
- `Position` - Position data model
- `insertPositionSchema` - Validation schema for new positions
- `Trade` - Trade history (for P&L calculation)

---

## Migration Notes

### Removing from Main Routes File
If extracting from `/home/runner/workspace/server/routes.ts`:

1. Find all position routes (around lines 696, 838, 1340-1542, 3121-3135)
2. Remove them from `routes.ts`
3. Add router import and mount
4. Test all endpoints remain functional

### Backward Compatibility
- `/api/positions/broker` maintained for existing clients
- All endpoint behaviors preserved
- Response formats unchanged

---

## Performance Considerations

### Optimization Tips
1. **Caching**: Snapshot endpoint calls Alpaca in parallel for speed
2. **Async Sync**: DB sync doesn't block position fetch
3. **Dust Filtering**: Done at API level, not database
4. **Query Limits**: getTrades limited to 100 for performance

### Load Testing
Consider these high-traffic scenarios:
- Multiple concurrent snapshot requests
- Rapid position reconciliation calls
- Close-all operations with many positions

---

## Troubleshooting

### Issue: 503 Position Data Unavailable
**Cause**: Alpaca API connection failed
**Solution**: Check Alpaca API status and credentials in environment

### Issue: 404 Position Not Found
**Cause**: Position ID doesn't exist in database
**Solution**: Use `/api/positions` first to verify live positions

### Issue: Reconciliation Hanging
**Cause**: Large position set or slow Alpaca response
**Solution**: Increase timeout, consider pagination

### Issue: Route Not Found (404)
**Cause**: Router not mounted or wrong path
**Solution**: Verify mount point and middleware order in main routes.ts

---

## API Response Examples

### Success Response (List Positions)
```json
{
  "positions": [
    {
      "id": "asset_abc123",
      "symbol": "AAPL",
      "side": "long",
      "qty": 100,
      "entryPrice": 150.25,
      "currentPrice": 152.50,
      "marketValue": 15250.00,
      "unrealizedPl": 225.00,
      "unrealizedPlPct": 1.49
    }
  ],
  "_source": {
    "type": "live",
    "timestamp": "2024-01-15T10:30:45.123Z",
    "broker": "alpaca"
  }
}
```

### Snapshot Response
```json
{
  "totalEquity": 100000.00,
  "buyingPower": 45000.00,
  "cash": 25000.00,
  "portfolioValue": 100000.00,
  "dailyPl": 1250.00,
  "dailyPlPct": 1.26,
  "totalPl": 2500.00,
  "positions": [...],
  "positionCount": 5,
  "longPositions": 4,
  "shortPositions": 1,
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

### Error Response
```json
{
  "error": "Live position data unavailable from Alpaca",
  "_source": {
    "type": "unavailable",
    "timestamp": "2024-01-15T10:30:45.123Z"
  },
  "message": "Could not connect to Alpaca Paper Trading. Please try again shortly."
}
```

---

## Related Files

- **Router File**: `/home/runner/workspace/server/routes/positions.ts`
- **Documentation**: `/home/runner/workspace/POSITIONS_ROUTER_EXTRACTION.md`
- **Main Routes**: `/home/runner/workspace/server/routes.ts`
- **Storage**: `/home/runner/workspace/server/storage.ts`
- **Alpaca Connector**: `/home/runner/workspace/server/connectors/alpaca.ts`
- **Trading Engine**: `/home/runner/workspace/server/trading/alpaca-trading-engine.ts`
