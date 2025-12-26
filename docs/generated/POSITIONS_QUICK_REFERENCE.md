# Position Routes Quick Reference Card

## File Location
```
/home/runner/workspace/server/routes/positions.ts
```

## Integration (2 Steps)

### 1. Add Import
```typescript
// In /server/routes.ts (line ~82)
import positionsRouter from "./routes/positions";
```

### 2. Mount Router
```typescript
// In app setup (after authMiddleware definition)
app.use("/api/positions", authMiddleware, positionsRouter);
```

---

## API Endpoints Summary

### Portfolio & Snapshot
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/positions/snapshot` | GET | Full portfolio metrics |
| `/api/positions` | GET | Live positions from Alpaca |
| `/api/positions/broker` | GET | Backward compatibility alias |

### Position Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/positions/:id` | GET | Single position details |
| `/api/positions` | POST | Create position (DB) |
| `/api/positions/:id` | PATCH | Update position |
| `/api/positions/:id` | DELETE | Delete position |

### Reconciliation
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/positions/reconcile` | POST | Sync DB vs Alpaca |
| `/api/positions/reconcile/status` | GET | Reconciliation status |

### Position Operations
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/positions/close/:symbol` | POST | Close one position |
| `/api/positions/close-all` | POST | Close all positions |

---

## HTTP Status Codes

| Code | Meaning | Routes |
|------|---------|--------|
| 200 | OK | Most GET, POST |
| 201 | Created | POST /positions |
| 204 | No Content | DELETE |
| 400 | Bad Request | Validation errors |
| 404 | Not Found | Missing resource |
| 500 | Server Error | Exception |
| 503 | Unavailable | Alpaca API down |

---

## Example Requests

### Get Portfolio Snapshot
```bash
curl -H "Authorization: Bearer TOKEN" \
  https://api.example.com/api/positions/snapshot
```

### Get Live Positions
```bash
curl -H "Authorization: Bearer TOKEN" \
  https://api.example.com/api/positions
```

### Create Position
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "side": "long",
    "quantity": "100",
    "entryPrice": "150.50"
  }' \
  https://api.example.com/api/positions
```

### Close Position
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  https://api.example.com/api/positions/close/AAPL
```

### Close All Positions
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  https://api.example.com/api/positions/close-all
```

### Reconcile Positions
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  https://api.example.com/api/positions/reconcile?force=true
```

---

## Key Features

- **11 Position Endpoints** - Comprehensive position management
- **Live Data** - Real-time Alpaca positions
- **Auto-Sync** - Background DB synchronization
- **Reconciliation** - DB vs Alpaca verification
- **Dust Filtering** - Removes floating-point residuals
- **Error Handling** - Graceful API failures
- **Source Metadata** - Data freshness indicators

---

## Important Notes

1. **Route Order**: Specific routes must come before `/positions/:id`
2. **Auth Required**: All routes need authMiddleware
3. **Source of Truth**: Live positions from Alpaca API
4. **DB Cache**: Database used for audit trail
5. **Background Sync**: Position sync doesn't block response
6. **Dust Threshold**: Positions < 0.0001 shares filtered out

---

## File Structure

```
server/routes/positions.ts (310 lines)
├── Imports (8 statements)
├── Router initialization
├── GET /snapshot (62 lines)
├── GET / positions (27 lines)
├── GET /broker (18 lines)
├── GET /:id (6 lines)
├── POST / (9 lines)
├── PATCH /:id (10 lines)
├── DELETE /:id (11 lines)
├── POST /reconcile (13 lines)
├── GET /reconcile/status (11 lines)
├── POST /close/:symbol (28 lines)
├── POST /close-all (9 lines)
└── Export default router
```

---

## Response Examples

### Snapshot Response
```json
{
  "totalEquity": 100000.00,
  "buyingPower": 45000.00,
  "cash": 25000.00,
  "portfolioValue": 100000.00,
  "dailyPl": 1250.00,
  "dailyPlPct": 1.26,
  "positions": [
    {
      "id": "asset_123",
      "symbol": "AAPL",
      "side": "long",
      "qty": 100,
      "entryPrice": 150.25,
      "currentPrice": 152.50,
      "unrealizedPl": 225.00
    }
  ],
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

### Positions Response
```json
{
  "positions": [
    {
      "id": "asset_123",
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

### Close Response
```json
{
  "success": true,
  "message": "Position AAPL closed successfully",
  "result": {
    "orderId": "order_123",
    "status": "filled"
  }
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
  "message": "Could not connect to Alpaca. Please try again shortly."
}
```

---

## Dependencies

| Module | Purpose | File |
|--------|---------|------|
| express | Router framework | Core |
| storage | DB operations | ../storage |
| alpaca | Broker API | ../connectors/alpaca |
| alpacaTradingEngine | Order execution | ../trading/alpaca-trading-engine |
| position-mapper | Data enrichment | @shared/position-mapper |

---

## Testing Checklist

- [ ] GET /snapshot returns portfolio metrics
- [ ] GET / positions returns live positions
- [ ] POST / creates position with validation
- [ ] PATCH / :id updates position
- [ ] DELETE / :id removes position
- [ ] POST /close/:symbol closes position
- [ ] POST /close-all closes all positions
- [ ] POST /reconcile syncs DB vs Alpaca
- [ ] GET /reconcile/status returns status
- [ ] 503 returned when Alpaca API down
- [ ] Auth required on all endpoints
- [ ] Dust positions filtered (< 0.0001)
- [ ] Background sync doesn't block response
- [ ] Source metadata included in responses

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 404 Position not found | Wrong ID | Verify position ID from GET / |
| 503 Alpaca unavailable | API down | Check Alpaca status page |
| 400 Bad request | Invalid input | Validate request body |
| Slow response | Large position set | Use limits/pagination |
| Missing source metadata | Old Alpaca position | Fetch fresh positions |

---

## Documentation Files

1. **POSITIONS_ROUTER_EXTRACTION.md** - Detailed specs
2. **POSITIONS_ROUTER_INTEGRATION_GUIDE.md** - Integration help
3. **POSITIONS_ROUTES_MAPPING.md** - Complete reference
4. **POSITIONS_EXTRACTION_VERIFICATION.txt** - QA report
5. **POSITIONS_QUICK_REFERENCE.md** - This file

---

## Quick Navigation

- **Main Router File**: `/home/runner/workspace/server/routes.ts`
- **New Module**: `/home/runner/workspace/server/routes/positions.ts`
- **Alpaca Connector**: `/home/runner/workspace/server/connectors/alpaca.ts`
- **Storage**: `/home/runner/workspace/server/storage.ts`
- **Trading Engine**: `/home/runner/workspace/server/trading/alpaca-trading-engine.ts`

---

Last Updated: 2024-01-15
Status: Production Ready
Version: 1.0
