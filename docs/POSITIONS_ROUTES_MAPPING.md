# Position Routes Mapping Reference

## Complete Route Extraction Summary

### Source Location
- **Original File**: `/home/runner/workspace/server/routes.ts`
- **New Module**: `/home/runner/workspace/server/routes/positions.ts`

---

## Route Map (11 Total Endpoints)

| # | Method | Path | Original Line | Function | Status Code |
|---|--------|------|---------------|----------|------------|
| 1 | GET | `/api/positions/snapshot` | 1341-1406 | Portfolio metrics snapshot | 200/500 |
| 2 | GET | `/api/positions` | 1410-1443 | List live Alpaca positions | 200/503 |
| 3 | GET | `/api/positions/broker` | 1446-1470 | Backward compat alias | 200/503 |
| 4 | GET | `/api/positions/:id` | 1472-1482 | Get single position | 200/404/500 |
| 5 | POST | `/api/positions` | 1484-1495 | Create position | 201/400/500 |
| 6 | PATCH | `/api/positions/:id` | 1497-1507 | Update position | 200/404/500 |
| 7 | DELETE | `/api/positions/:id` | 1509-1519 | Delete position | 204/404/500 |
| 8 | POST | `/api/positions/reconcile` | 1522-1532 | Reconcile DB vs Alpaca | 200/500 |
| 9 | GET | `/api/positions/reconcile/status` | 1534-1542 | Get reconciliation status | 200/500 |
| 10 | POST | `/api/positions/close/:symbol` | 696-714 | Close position by symbol | 200/400/500 |
| 11 | POST | `/api/positions/close-all` | 838-846 | Close all positions | 200/500 |

---

## Detailed Route Specifications

### Route 1: GET /api/positions/snapshot
```
Endpoint:   GET /api/positions/snapshot
Auth:       Required (authMiddleware)
File Line:  23-84 (new file)
Original:   1341-1406 (routes.ts)
Status:     200 OK, 500 Server Error

Purpose:
  Portfolio snapshot endpoint for Next.js dashboard
  Returns comprehensive portfolio metrics

Key Operations:
  1. Fetch Alpaca account (parallel)
  2. Fetch Alpaca positions (parallel)
  3. Fetch recent trades from DB
  4. Calculate portfolio metrics
  5. Calculate P&L (realized + unrealized)

Response Fields:
  - totalEquity: Current account equity
  - buyingPower: Available buying power
  - cash: Cash balance
  - portfolioValue: Total portfolio value
  - dailyPl: Daily P&L (absolute)
  - dailyPlPct: Daily P&L (percentage)
  - totalPl: Total P&L (realized + unrealized)
  - positions: Array of enriched positions
  - positionCount: Total number of positions
  - longPositions: Count of long positions
  - shortPositions: Count of short positions
  - timestamp: Snapshot timestamp
```

### Route 2: GET /api/positions
```
Endpoint:   GET /api/positions
Auth:       Required (authMiddleware)
File Line:  99-125 (new file)
Original:   1410-1443 (routes.ts)
Status:     200 OK, 503 Service Unavailable

Purpose:
  Returns LIVE Alpaca positions (source of truth)
  Database sync happens asynchronously

Key Features:
  - Filters dust positions (< 0.0001 shares)
  - Async background DB sync
  - Non-blocking response
  - Includes source metadata

Response Fields:
  - positions: Array of enriched positions
  - _source: Data source metadata
    - type: "live"
    - timestamp: ISO timestamp
    - broker: "alpaca"

Error Handling:
  - 503 if Alpaca API unavailable
  - Includes helpful error message
  - Source metadata indicates unavailability
```

### Route 3: GET /api/positions/broker
```
Endpoint:   GET /api/positions/broker
Auth:       Required (authMiddleware)
File Line:  139-156 (new file)
Original:   1446-1470 (routes.ts)
Status:     200 OK, 503 Service Unavailable

Purpose:
  Backward compatibility alias for GET /api/positions
  Uses Alpaca as source of truth

Note:
  Duplicate of main positions endpoint
  Kept for API stability with existing clients
```

### Route 4: GET /api/positions/:id
```
Endpoint:   GET /api/positions/:id
Auth:       Required (authMiddleware)
Params:     id (position ID from database)
File Line:  169-174 (new file)
Original:   1472-1482 (routes.ts)
Status:     200 OK, 404 Not Found, 500 Server Error

Purpose:
  Get a specific position by ID from database

Response:
  Single position object from database

Note:
  Must come after specific routes like /snapshot and /broker
```

### Route 5: POST /api/positions
```
Endpoint:   POST /api/positions
Auth:       Required (authMiddleware)
File Line:  186-194 (new file)
Original:   1484-1495 (routes.ts)
Status:     201 Created, 400 Bad Request, 500 Server Error

Purpose:
  Create a new position in the database

Request Body:
  - Must pass insertPositionSchema validation
  - Typical fields: symbol, side, quantity, entryPrice, etc.

Validation:
  - Uses insertPositionSchema from shared schema
  - Returns 400 with validation error if invalid

Response:
  201 Created with full position object
```

### Route 6: PATCH /api/positions/:id
```
Endpoint:   PATCH /api/positions/:id
Auth:       Required (authMiddleware)
Params:     id (position ID)
File Line:  204-213 (new file)
Original:   1497-1507 (routes.ts)
Status:     200 OK, 404 Not Found, 500 Server Error

Purpose:
  Update an existing position

Request Body:
  Partial position object with fields to update

Response:
  200 OK with updated position object
  404 if position not found
```

### Route 7: DELETE /api/positions/:id
```
Endpoint:   DELETE /api/positions/:id
Auth:       Required (authMiddleware)
Params:     id (position ID)
File Line:  221-231 (new file)
Original:   1509-1519 (routes.ts)
Status:     204 No Content, 404 Not Found, 500 Server Error

Purpose:
  Delete a position from database

Response:
  204 No Content on success
  404 if position not found
```

### Route 8: POST /api/positions/reconcile
```
Endpoint:   POST /api/positions/reconcile
Auth:       Required (authMiddleware)
Query Params: force=true (optional)
File Line:  238-250 (new file)
Original:   1522-1532 (routes.ts)
Status:     200 OK, 500 Server Error

Purpose:
  Reconcile positions between database and Alpaca

Parameters:
  - force: Set to "true" to force reconciliation

Uses:
  - positionReconciler service
  - Compares DB vs Alpaca
  - Syncs discrepancies

Response:
  Reconciliation result object
```

### Route 9: GET /api/positions/reconcile/status
```
Endpoint:   GET /api/positions/reconcile/status
Auth:       Required (authMiddleware)
File Line:  254-267 (new file)
Original:   1534-1542 (routes.ts)
Status:     200 OK, 500 Server Error

Purpose:
  Get the status of position reconciliation

Uses:
  - positionReconciler service

Response:
  Reconciliation status object
```

### Route 10: POST /api/positions/close/:symbol
```
Endpoint:   POST /api/positions/close/:symbol
Auth:       Required (authMiddleware)
Params:     symbol (stock symbol to close)
File Line:  269-296 (new file)
Original:   696-714 (routes.ts)
Status:     200 OK, 400 Bad Request, 500 Server Error

Purpose:
  Close a specific position by symbol

Alternative:
  POST /api/autonomous/close-position (original location)

Validation:
  - Symbol required in URL path
  - Validates symbol is provided

Execution:
  - Uses alpacaTradingEngine.closeAlpacaPosition()
  - Returns success/failure status

Response Format:
  {
    "success": true,
    "message": "Position SYMBOL closed successfully",
    "result": {...}
  }
```

### Route 11: POST /api/positions/close-all
```
Endpoint:   POST /api/positions/close-all
Auth:       Required (authMiddleware)
File Line:  300-311 (new file)
Original:   838-846 (routes.ts)
Status:     200 OK, 500 Server Error

Purpose:
  Close all open positions simultaneously

Alternative:
  POST /api/autonomous/close-all-positions (original location)

Execution:
  - Uses alpacaTradingEngine.closeAllPositions()
  - Closes all open positions in one call

Response:
  {
    "success": true,
    ...result
  }

Use Case:
  Risk management, end-of-day liquidation, emergency scenarios
```

---

## Route Interaction Diagram

```
/api/positions/
├── /snapshot                 GET  - Portfolio metrics
├── /                         GET  - List all (Alpaca)
├── /broker                   GET  - Alias for list
├── /:id
│   ├── GET                   - Get single position
│   ├── PATCH                 - Update position
│   └── DELETE                - Delete position
├── /reconcile
│   ├── POST                  - Run reconciliation
│   └── /status GET           - Get status
├── /close/:symbol
│   └── POST                  - Close by symbol
└── /close-all
    └── POST                  - Close all positions
```

---

## Error Response Format

### Validation Error (400)
```json
{
  "error": "Validation failed",
  "message": "Schema validation error details"
}
```

### Not Found (404)
```json
{
  "error": "Position not found"
}
```

### Service Unavailable (503)
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

### Server Error (500)
```json
{
  "error": "Failed to [operation]",
  "message": "Detailed error message"
}
```

---

## Route Execution Flow

### Flow 1: Get Positions (Live Data)
```
Client Request
    ↓
GET /api/positions
    ↓
authMiddleware (verify auth)
    ↓
alpaca.getPositions() [parallel]
    ↓
Filter dust positions (< 0.0001)
    ↓
storage.syncPositionsFromAlpaca() [async, non-blocking]
    ↓
Map to enriched format
    ↓
Add source metadata
    ↓
Return 200 with positions
```

### Flow 2: Close Position
```
Client Request
    ↓
POST /api/positions/close/:symbol
    ↓
authMiddleware (verify auth)
    ↓
Validate symbol provided
    ↓
alpacaTradingEngine.closeAlpacaPosition(symbol)
    ↓
Return 200 with result
```

### Flow 3: Reconcile Positions
```
Client Request
    ↓
POST /api/positions/reconcile[?force=true]
    ↓
authMiddleware (verify auth)
    ↓
positionReconciler.reconcile(force)
    ↓
Compare DB positions vs Alpaca
    ↓
Sync discrepancies
    ↓
Return reconciliation result
```

---

## Migration Checklist

- [x] Extract all position routes
- [x] Create new router module
- [x] Follow strategies.ts pattern
- [x] Preserve all endpoint behaviors
- [x] Maintain response formats
- [x] Include proper imports
- [x] Add error handling
- [x] Add JSDoc comments
- [x] Verify route order (specific before parameterized)
- [ ] Update main routes.ts to import and mount
- [ ] Test all endpoints with auth
- [ ] Verify response formats match original
- [ ] Update API documentation
- [ ] Deploy and monitor

---

## Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `/server/routes/positions.ts` | Position router module | 310 |
| `/server/routes.ts` | Main router (source) | 73581 |
| `/server/routes/strategies.ts` | Reference pattern | 340 |
| `/POSITIONS_ROUTER_EXTRACTION.md` | Detailed documentation | This file |
| `/POSITIONS_ROUTER_INTEGRATION_GUIDE.md` | Integration instructions | Separate doc |
