# Position Reconciliation - Quick Start

## What It Does

Automatically syncs positions between Alpaca broker and your database every 5 minutes.

## Key Features

- ✅ Runs every 5 minutes automatically
- ✅ Can be triggered manually via API
- ✅ Emits real-time events for UI updates
- ✅ Tracks statistics and errors
- ✅ Zero configuration required

## Files Created

```
server/jobs/position-reconciliation.ts  # Main job implementation
server/index.ts                         # Added job startup
server/routes.ts                        # Added API endpoints
docs/POSITION_RECONCILIATION.md         # Full documentation
```

## API Endpoints

### Check Job Status

```bash
GET /api/admin/jobs/status
```

**Response**:
```json
{
  "positionReconciliation": {
    "isRunning": false,
    "lastRunTime": "2025-12-23T10:30:00Z",
    "nextRunTime": "2025-12-23T10:35:00Z",
    "totalRuns": 144,
    "successfulRuns": 142,
    "failedRuns": 2
  }
}
```

### Manual Sync

```bash
POST /api/admin/jobs/sync-positions
```

**Response**:
```json
{
  "success": true,
  "result": {
    "created": ["AAPL"],
    "updated": ["GOOGL"],
    "removed": [],
    "summary": {
      "totalChanges": 2,
      "createdCount": 1,
      "updatedCount": 1
    }
  }
}
```

## How It Works

1. **Every 5 minutes**, the cron job triggers
2. **Fetches positions** from Alpaca API
3. **Compares** with local database
4. **Reconciles** differences:
   - Creates missing positions
   - Updates changed quantities/prices
   - Removes closed positions
5. **Emits events** for real-time UI updates
6. **Logs results** with detailed statistics

## Startup Behavior

```
[STARTUP] Starting position reconciliation job...
[PositionReconciliation] Cron job started - syncing every 5 minutes
[PositionReconciliation] Starting position sync... (10 seconds after startup)
[PositionReconciliation] Position sync completed (created: 0, updated: 5, removed: 0)
```

## Log Examples

**Successful Sync**:
```
[PositionReconciliation] Position sync completed
  created: 1, updated: 2, removed: 0, errors: 0, duration: 1234ms
[PositionReconciliation] Created 1 new positions: AAPL
[PositionReconciliation] Updated 2 existing positions: GOOGL, MSFT
```

**No Changes**:
```
[PositionReconciliation] Position sync completed
  created: 0, updated: 0, removed: 0, errors: 0, duration: 345ms
```

**With Errors**:
```
[PositionReconciliation] Encountered 1 errors during sync
  errors: [{ symbol: "TSLA", error: "Database write failed" }]
```

## Real-Time Events

Subscribe to SSE events to get live updates:

```javascript
const eventSource = new EventSource('/api/stream/events');

eventSource.addEventListener('position:updated', (event) => {
  const data = JSON.parse(event.data);
  console.log('Position changes:', data);
  // Refresh your positions UI
});
```

**Event Payload**:
```json
{
  "type": "reconciliation",
  "created": ["AAPL"],
  "updated": ["GOOGL", "MSFT"],
  "removed": [],
  "timestamp": "2025-12-23T10:30:00Z"
}
```

## Schedule

- **Frequency**: Every 5 minutes
- **Cron**: `*/5 * * * *`
- **Timezone**: America/New_York (NYSE)
- **Runs at**: :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55

## Testing

### 1. Check if job is running:
```bash
curl http://localhost:5000/api/admin/jobs/status \
  -H "Cookie: session=YOUR_TOKEN"
```

### 2. Trigger manual sync:
```bash
curl -X POST http://localhost:5000/api/admin/jobs/sync-positions \
  -H "Cookie: session=YOUR_TOKEN"
```

### 3. Monitor logs:
```bash
# Watch server logs for [PositionReconciliation] entries
tail -f logs/server.log | grep PositionReconciliation
```

## Common Issues

### Job Not Running
**Check**: `nextRunTime` should not be null
**Fix**: Restart server, verify job started in logs

### High Error Rate
**Check**: `failedRuns` increasing
**Fix**: Verify Alpaca API credentials, check network

### Positions Not Syncing
**Check**: `lastResult` for errors
**Fix**: Check database permissions, Alpaca connection

## Integration Example

```typescript
// In your positions UI component
import { useEffect, useState } from 'react';

function PositionsPage() {
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    // Subscribe to position updates
    const eventSource = new EventSource('/api/stream/events');

    eventSource.addEventListener('position:updated', (event) => {
      // Refresh positions when sync detects changes
      fetchPositions();
    });

    return () => eventSource.close();
  }, []);

  return (
    <div>
      <button onClick={() => manualSync()}>
        Sync Now
      </button>
      {/* positions table */}
    </div>
  );
}

async function manualSync() {
  const response = await fetch('/api/admin/jobs/sync-positions', {
    method: 'POST',
  });
  const result = await response.json();
  console.log('Sync result:', result);
}
```

## Performance

- **Execution time**: 100-1500ms
- **Memory usage**: <10MB
- **Network calls**: 2-3 to Alpaca API
- **CPU usage**: Minimal (I/O bound)

## Security

- Job status endpoint: Requires authentication
- Manual sync endpoint: Requires admin:write capability
- Concurrent sync prevention built-in
- Error messages sanitized before logging

## Dependencies

- `node-cron`: For scheduling (already installed)
- `alpacaTradingEngine`: For broker integration
- `eventBus`: For real-time events
- `storage`: For database operations

## Next Steps

1. ✅ System is already running after server restart
2. Monitor `/api/admin/jobs/status` endpoint
3. Set up alerts for high error rates
4. Integrate position update events into UI
5. Review logs regularly

## Full Documentation

See [docs/POSITION_RECONCILIATION.md](./docs/POSITION_RECONCILIATION.md) for complete details.
