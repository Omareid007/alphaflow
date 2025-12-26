# Position Reconciliation System

Automated position synchronization between Alpaca broker and local database.

## Overview

The position reconciliation system ensures that your local database positions always match the broker's positions. It runs automatically every 5 minutes and can also be triggered manually via API.

## Features

- **Automated Sync**: Runs every 5 minutes using a cron job
- **Manual Trigger**: Admin API endpoint for on-demand synchronization
- **Real-time Events**: Emits SSE events for position updates
- **Comprehensive Logging**: Detailed logs for all sync operations
- **Error Tracking**: Captures and reports sync errors
- **Statistics**: Tracks success/failure rates and execution times

## Architecture

### Components

1. **Position Reconciliation Job** (`/server/jobs/position-reconciliation.ts`)
   - Manages cron schedule
   - Executes sync operations
   - Tracks statistics and errors
   - Emits events for UI updates

2. **Trading Engine Integration** (`alpacaTradingEngine.syncPositionsFromAlpaca()`)
   - Fetches positions from Alpaca API
   - Compares with local database
   - Creates, updates, or removes positions as needed

3. **Event System** (eventBus)
   - Broadcasts position updates to connected clients
   - Enables real-time UI updates via SSE

4. **API Endpoints** (`/api/admin/jobs/*`)
   - Job status monitoring
   - Manual sync triggering

## Cron Schedule

**Expression**: `*/5 * * * *`
**Frequency**: Every 5 minutes
**Timezone**: America/New_York (NYSE timezone)

### Schedule Details

- Runs at: :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55 of every hour
- First run: 10 seconds after server startup
- Continues running until server shutdown

## API Endpoints

### GET `/api/admin/jobs/status`

Get the current status and statistics of the position reconciliation job.

**Authentication**: Required (session token)

**Response**:
```json
{
  "positionReconciliation": {
    "enabled": true,
    "schedule": "Every 5 minutes",
    "isRunning": false,
    "lastRunTime": "2025-12-23T10:30:00.000Z",
    "lastRunDuration": 1234,
    "nextRunTime": "2025-12-23T10:35:00.000Z",
    "totalRuns": 144,
    "successfulRuns": 142,
    "failedRuns": 2,
    "lastError": null,
    "lastResult": {
      "created": ["AAPL"],
      "updated": ["GOOGL", "MSFT"],
      "removed": [],
      "errors": []
    }
  }
}
```

**Fields**:
- `enabled`: Whether the job is active
- `schedule`: Human-readable schedule description
- `isRunning`: Currently executing a sync
- `lastRunTime`: Last execution timestamp
- `lastRunDuration`: Last execution duration in milliseconds
- `nextRunTime`: Calculated next execution time
- `totalRuns`: Total number of sync attempts
- `successfulRuns`: Number of successful syncs
- `failedRuns`: Number of failed syncs
- `lastError`: Last error message (if any)
- `lastResult`: Detailed results from last sync

### POST `/api/admin/jobs/sync-positions`

Manually trigger a position sync (does not affect cron schedule).

**Authentication**: Required (session token + admin:write capability)

**Response** (Success):
```json
{
  "success": true,
  "message": "Position sync completed successfully",
  "result": {
    "created": ["BTC/USD"],
    "updated": ["AAPL", "GOOGL"],
    "removed": ["TSLA"],
    "errors": [],
    "summary": {
      "totalChanges": 3,
      "createdCount": 1,
      "updatedCount": 2,
      "removedCount": 1,
      "errorCount": 0
    }
  }
}
```

**Response** (Already Running):
```json
{
  "error": "Position sync already in progress",
  "message": "Please wait for the current sync to complete"
}
```

**Status Codes**:
- `200`: Sync completed successfully
- `409`: Sync already in progress
- `500`: Sync failed with error

## Sync Operations

### Position Creation

When a position exists in Alpaca but not in the local database:

```
[Sync] Created position for AAPL
```

**Actions**:
- Creates new position record
- Sets initial entry price, quantity, and unrealized P&L
- Emits `position:updated` event

### Position Update

When a position exists in both but has different values:

```
[Sync] Updated position for GOOGL: qty=10 -> 12, price=$150.25
```

**Actions**:
- Updates quantity if changed
- Updates current price
- Recalculates unrealized P&L
- Does NOT emit event (silent update)

### Position Removal

When a position exists in database but not in Alpaca (closed position):

```
[Sync] Removed stale position for TSLA
```

**Actions**:
- Deletes position record from database
- Emits `position:updated` event

## Event System

### Position Updated Event

**Event Type**: `position:updated`
**Source**: `position-reconciliation-job`

**Payload**:
```typescript
{
  type: "reconciliation",
  created: ["AAPL"],
  updated: ["GOOGL", "MSFT"],
  removed: ["TSLA"],
  timestamp: "2025-12-23T10:30:00.000Z"
}
```

**Usage**:
- Subscribe to SSE endpoint `/api/stream/events`
- Filter for `position:updated` events
- Refresh positions UI when received

### System Error Event

**Event Type**: `system:error`
**Source**: `position-reconciliation-job`

**Payload**:
```typescript
{
  message: "Position reconciliation failed",
  error: "Network timeout",
  timestamp: "2025-12-23T10:30:00.000Z"
}
```

## Logging

### Info Logs

```
[PositionReconciliation] Cron job started - syncing every 5 minutes
[PositionReconciliation] Starting position sync...
[PositionReconciliation] Position sync completed (created: 1, updated: 2, removed: 0, errors: 0, duration: 1234ms)
[PositionReconciliation] Created 1 new positions: AAPL
[PositionReconciliation] Updated 2 existing positions: GOOGL, MSFT
```

### Warning Logs

```
[PositionReconciliation] Job already running, ignoring start request
[PositionReconciliation] Sync already in progress, skipping this run
[PositionReconciliation] Removed 1 stale positions: TSLA
```

### Error Logs

```
[PositionReconciliation] Position sync failed (error: Network timeout, duration: 5000ms)
[PositionReconciliation] Encountered 2 errors during sync
```

## Error Handling

### Network Errors

If Alpaca API is unreachable:
- Sync fails gracefully
- Error is logged and tracked
- Next sync attempt continues normally
- Does not crash the application

### Partial Failures

If some positions fail to sync:
- Continues processing remaining positions
- Tracks errors per symbol
- Returns partial results
- Increments `failedRuns` counter

### Concurrent Sync Prevention

If sync is already running:
- New requests are skipped
- Returns immediately with warning
- Prevents database conflicts

## Statistics Tracking

The job tracks comprehensive statistics:

- **Total Runs**: All sync attempts (success + failure)
- **Successful Runs**: Syncs that completed without errors
- **Failed Runs**: Syncs that threw exceptions
- **Last Run Time**: Timestamp of most recent sync
- **Last Duration**: Execution time in milliseconds
- **Next Run Time**: Calculated from cron schedule
- **Last Error**: Most recent error message
- **Last Result**: Detailed sync results (created/updated/removed)

## Performance

### Typical Execution Time

- **No changes**: 100-300ms
- **With updates**: 500-1500ms
- **Many positions**: 1-3 seconds

### Resource Usage

- **Memory**: <10MB during sync
- **CPU**: Minimal (I/O bound)
- **Network**: 2-3 API calls to Alpaca

## Startup Behavior

On server startup:

1. Job is initialized
2. Cron schedule is started
3. 10-second delay
4. First sync executes automatically
5. Subsequent syncs run every 5 minutes

## Shutdown Behavior

On server shutdown:

1. Cron job stops gracefully
2. In-progress sync completes
3. No data loss

## Integration Points

### Trading Engine

```typescript
import { alpacaTradingEngine } from "./trading/alpaca-trading-engine";

// Sync positions from Alpaca
const result = await alpacaTradingEngine.syncPositionsFromAlpaca();
```

### Event Bus

```typescript
import { eventBus } from "./orchestration";

// Subscribe to position updates
eventBus.subscribe("position:updated", (event) => {
  console.log("Positions changed:", event.data);
});
```

### API Routes

```typescript
import { positionReconciliationJob } from "./jobs/position-reconciliation";

// Get job statistics
const stats = positionReconciliationJob.getStats();

// Trigger manual sync
await positionReconciliationJob.executeSync();
```

## Testing

### Manual Sync Test

```bash
curl -X POST http://localhost:5000/api/admin/jobs/sync-positions \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

### Check Job Status

```bash
curl http://localhost:5000/api/admin/jobs/status \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

### Monitor SSE Events

```bash
curl -N http://localhost:5000/api/stream/events \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

## Troubleshooting

### Job Not Running

**Symptom**: `nextRunTime` is null
**Solution**: Check if job was started in server/index.ts

### Sync Always Fails

**Symptom**: `failedRuns` keeps increasing
**Solution**: Check Alpaca API credentials and network connectivity

### Positions Not Updating

**Symptom**: Database shows stale data
**Solution**: Check sync logs for errors, verify Alpaca positions

### High Error Count

**Symptom**: Many errors in `lastResult.errors`
**Solution**: Review error messages, check database permissions

## Best Practices

1. **Monitor Statistics**: Check `/api/admin/jobs/status` regularly
2. **Review Logs**: Look for warnings and errors in server logs
3. **Manual Sync**: Use after manual trading outside the platform
4. **SSE Events**: Subscribe to real-time updates in UI
5. **Error Alerts**: Set up notifications for failed syncs

## Future Enhancements

Potential improvements:

- Configurable sync interval via admin settings
- Webhook notifications on discrepancies
- Historical sync log persistence
- Sync on-demand when user views positions page
- Conflict resolution strategies (database vs broker)

## Related Documentation

- [Trading Engine](./TRADING_ENGINE.md)
- [Event System](./EVENT_SYSTEM.md)
- [Admin API](./ADMIN_API.md)
- [Alpaca Integration](./ALPACA_INTEGRATION.md)
