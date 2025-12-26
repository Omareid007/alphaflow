# Position Routes Extraction Summary

## File Created
- **Path**: `/home/runner/workspace/server/routes/positions.ts`
- **Size**: 310 lines
- **Format**: Express Router module (matches `routes/strategies.ts` pattern)

## Routes Extracted (10 Total)

### 1. **GET /api/positions/snapshot** (Line 23-84)
- **Purpose**: Portfolio snapshot endpoint for Next.js dashboard
- **Returns**: Comprehensive portfolio metrics including:
  - Account equity, cash, buying power, portfolio value
  - Daily P&L (absolute and percentage)
  - Position breakdown by side (long/short)
  - Realized and unrealized P&L totals
- **Key Features**:
  - Parallel Alpaca API calls for faster response
  - Includes trade history from database
  - Must be before `/api/positions/:id` route to avoid route conflicts

### 2. **GET /api/positions** (Line 96-125)
- **Purpose**: Returns LIVE Alpaca positions (source of truth)
- **Key Features**:
  - Filters out dust positions (<0.0001 shares)
  - Async background sync to database
  - Database used as cache/audit trail only
  - Returns enriched position data with source metadata
  - Handles Alpaca connectivity errors gracefully

### 3. **GET /api/positions/broker** (Line 132-156)
- **Purpose**: Backward compatibility alias for `/api/positions`
- **Note**: Uses Alpaca source of truth
- **Key Features**:
  - Duplicate of main positions endpoint
  - Kept for API stability

### 4. **GET /api/positions/:id** (Line 163-174)
- **Purpose**: Get a specific position by ID from database
- **Route Order**: Must come after specific routes like `/snapshot` and `/broker`

### 5. **POST /api/positions** (Line 181-194)
- **Purpose**: Create a new position in the database
- **Validation**: Uses `insertPositionSchema` from shared schema
- **Returns**: 201 Created with position data

### 6. **PATCH /api/positions/:id** (Line 201-213)
- **Purpose**: Update an existing position
- **Returns**: Updated position or 404 if not found

### 7. **DELETE /api/positions/:id** (Line 220-231)
- **Purpose**: Delete a position from database
- **Returns**: 204 No Content on success

### 8. **POST /api/positions/reconcile** (Line 238-250)
- **Purpose**: Reconcile positions between database and Alpaca
- **Parameters**: `?force=true` to force reconciliation
- **Returns**: Reconciliation result

### 9. **GET /api/positions/reconcile/status** (Line 257-267)
- **Purpose**: Get the status of position reconciliation
- **Returns**: Current reconciliation status

### 10. **POST /api/positions/close/:symbol** (Line 274-296)
- **Purpose**: Close a specific position by symbol
- **Route**: Alternative to `/api/autonomous/close-position`
- **Key Features**:
  - Symbol required in URL path
  - Uses alpacaTradingEngine for execution
  - Returns success/failure status

### 11. **POST /api/positions/close-all** (Line 303-311)
- **Purpose**: Close all open positions
- **Route**: Alternative to `/api/autonomous/close-all-positions`
- **Returns**: Closure results for all positions

## Implementation Details

### Imports & Dependencies
```typescript
- Router, Request, Response from express
- storage (database operations)
- log (logging utility)
- badRequest, notFound, serverError (error helpers)
- insertPositionSchema (validation)
- alpaca (broker connector)
- alpacaTradingEngine (execution engine)
- Position mapper utilities (enrichment & metadata)
```

### Error Handling
- Uses standard error functions: `badRequest()`, `notFound()`, `serverError()`
- Logging with "PositionsAPI" category
- Source metadata for Alpaca API failures
- Graceful degradation with error messages

### Data Source Pattern
- **Live Data**: Alpaca API (source of truth)
- **Cached Data**: Database (audit trail)
- **Metadata**: `_source` object indicates data freshness

## Integration Notes

### Route Mounting
To use this router in `server/routes.ts`, add:
```typescript
import positionsRouter from "./routes/positions";

// In app setup:
app.use("/api/positions", authMiddleware, positionsRouter);
```

### Route Order Importance
1. `/snapshot` must come before `/:id` (specific before parameterized)
2. `/broker` must come before `/:id`
3. Reconcile routes must come before base `/:id`

### Backward Compatibility
- `/api/positions/broker` maintained for API stability
- Close endpoints provide same functionality as `/autonomous` routes
- All original endpoint behaviors preserved

## Source Files
- **Primary Source**: `/home/runner/workspace/server/routes.ts`
- **Pattern Reference**: `/home/runner/workspace/server/routes/strategies.ts`
- **Line Ranges from routes.ts**:
  - Snapshot: 1340-1406
  - GET /: 1410-1443
  - GET /broker: 1446-1470
  - GET /:id: 1472-1482
  - POST /: 1484-1495
  - PATCH /:id: 1497-1507
  - DELETE /:id: 1509-1519
  - POST /reconcile: 1522-1532
  - GET /reconcile/status: 1534-1542
  - Close position: 696-714
  - Close all: 838-846
