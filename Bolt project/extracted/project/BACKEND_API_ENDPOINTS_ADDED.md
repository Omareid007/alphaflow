# Backend API Endpoints Added

This document summarizes all the new backend API endpoints added to `/home/runner/workspace/Bolt project/extracted/project/server/routes.ts`.

## Summary of Changes

### 1. Storage Layer Enhancement
**File**: `/home/runner/workspace/Bolt project/extracted/project/server/storage.ts`

Added new method:
- `deleteStrategy(id: string): Promise<boolean>` - Deletes a strategy from the database

### 2. New Strategy Management Endpoints

#### POST /api/strategies/:id/deploy
Deploy a strategy to paper or live trading mode.

**Request Body**:
```json
{
  "mode": "paper" | "live"
}
```

**Response**:
```json
{
  "success": true,
  "strategy": { /* updated strategy object */ },
  "mode": "paper" | "live",
  "message": "Strategy deployed to {mode} mode successfully"
}
```

**Error Cases**:
- 400: Invalid mode (must be 'paper' or 'live')
- 404: Strategy not found
- 400: Alpaca not connected (when deploying to live mode with active strategy)
- 500: Failed to update strategy deployment

**Implementation Details**:
- Updates strategy parameters with `deploymentMode` and `deployedAt` timestamp
- Validates Alpaca connection for live mode deployment when strategy is active
- Uses `storage.updateStrategy()` to persist changes

---

#### POST /api/strategies/:id/pause
Pause a running strategy.

**Response**:
```json
{
  "success": true,
  "strategy": { /* updated strategy object */ },
  "message": "Strategy paused successfully"
}
```

**Error Cases**:
- 404: Strategy not found
- 400: Strategy is already paused
- 400: Failed to pause strategy (from trading engine)
- 500: Server error

**Implementation Details**:
- Calls `alpacaTradingEngine.stopStrategy()` to stop execution
- Updates strategy parameters with `paused: true` and `pausedAt` timestamp
- Preserves other strategy configuration

---

#### POST /api/strategies/:id/resume
Resume a paused strategy.

**Response**:
```json
{
  "success": true,
  "strategy": { /* updated strategy object */ },
  "message": "Strategy resumed successfully"
}
```

**Error Cases**:
- 404: Strategy not found
- 400: Strategy is already running
- 400: Failed to resume strategy (from trading engine)
- 500: Server error

**Implementation Details**:
- Calls `alpacaTradingEngine.startStrategy()` to restart execution
- Removes `paused` and `pausedAt` flags from parameters
- Adds `resumedAt` timestamp to track resume events

---

#### DELETE /api/strategies/:id
Delete a strategy.

**Response**:
```json
{
  "success": true,
  "message": "Strategy deleted successfully"
}
```

**Error Cases**:
- 404: Strategy not found
- 500: Failed to delete strategy

**Implementation Details**:
- Stops the strategy if it's currently running
- Calls `storage.deleteStrategy()` to remove from database
- Warns in logs if strategy can't be stopped but continues with deletion

---

### 3. AI Decisions Endpoint Alias

#### GET /api/decisions
Alias endpoint for `/api/ai-decisions` to maintain frontend compatibility.

**Query Parameters**:
- `limit` (optional): Number of decisions to return (default: 20)

**Response**:
```json
[
  {
    "id": "string",
    "symbol": "string",
    "action": "buy" | "sell" | "hold",
    "confidence": "string",
    "reasoning": "string",
    "strategyId": "string | null",
    "status": "string",
    "createdAt": "Date",
    // ... other decision fields
  }
]
```

**Implementation Details**:
- Identical implementation to `/api/ai-decisions`
- Provides backward compatibility for frontend hooks
- Uses `storage.getAiDecisions(limit)`

---

### 4. AI Events Endpoint

#### GET /api/ai/events
Return AI system events including decisions and orchestrator activity.

**Query Parameters**:
- `limit` (optional): Number of events to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response**:
```json
{
  "events": [
    {
      "id": "string",
      "type": "ai_decision" | "orchestrator_event",
      "timestamp": "Date",
      "symbol": "string",
      "action": "string",
      "confidence": "number",  // for ai_decision type
      "reasoning": "string",   // for ai_decision type
      "metadata": {
        "strategyId": "string | null",
        "traceId": "string | null",
        "status": "string",
        "executedTradeId": "string | null"
      }
    }
  ],
  "total": "number",
  "hasMore": "boolean"
}
```

**Implementation Details**:
- Combines AI decisions from `storage.getAiDecisions()`
- Includes orchestrator execution history from `orchestrator.getState()`
- Sorts all events by timestamp (most recent first)
- Maps decisions to event format with type discrimination
- Returns top `limit` events after combining and sorting

---

## Testing the Endpoints

### Deploy Strategy
```bash
curl -X POST http://localhost:5000/api/strategies/{id}/deploy \
  -H "Content-Type: application/json" \
  -d '{"mode": "paper"}'
```

### Pause Strategy
```bash
curl -X POST http://localhost:5000/api/strategies/{id}/pause
```

### Resume Strategy
```bash
curl -X POST http://localhost:5000/api/strategies/{id}/resume
```

### Delete Strategy
```bash
curl -X DELETE http://localhost:5000/api/strategies/{id}
```

### Get AI Decisions (Alias)
```bash
curl http://localhost:5000/api/decisions?limit=20
```

### Get AI Events
```bash
curl http://localhost:5000/api/ai/events?limit=50&offset=0
```

---

## Error Handling

All endpoints follow consistent error handling patterns:

1. **400 Bad Request**: Invalid input or business logic violation
2. **404 Not Found**: Resource doesn't exist
3. **500 Internal Server Error**: Unexpected server errors

All errors return JSON:
```json
{
  "error": "Error message description"
}
```

Some endpoints include additional context:
```json
{
  "error": "Main error message",
  "reason": "Additional details",
  "tradabilityCheck": { /* context object */ }
}
```

---

## Dependencies

The implementation uses:
- `storage` - Database operations via Drizzle ORM
- `alpacaTradingEngine` - Trading strategy execution
- `orchestrator` - Autonomous trading orchestration
- Express.js middleware for routing and error handling

All endpoints use async/await for database and external service calls.
