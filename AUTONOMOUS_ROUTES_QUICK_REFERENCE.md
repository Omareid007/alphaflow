# Autonomous Routes Quick Reference

## Complete Endpoint List (24 Total)

### Autonomous State Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/autonomous/state` | Current orchestration state, positions, signals |
| GET | `/api/autonomous/status` | Trading status with runtime statistics |

### Autonomous Control
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/autonomous/start` | Start autonomous trading mode |
| POST | `/api/autonomous/stop` | Stop autonomous trading mode |
| POST | `/api/autonomous/mode` | Change mode (autonomous/semi-auto/manual) |

### Risk Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/autonomous/kill-switch` | Activate/deactivate emergency halt |
| PUT | `/api/autonomous/risk-limits` | Update position size, exposure, loss limits |

### Execution & History
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/autonomous/execution-history` | Trade execution history |

### Position Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/autonomous/close-position` | Close single position by symbol |
| POST | `/api/autonomous/close-all-positions` | Close all open positions |
| GET | `/api/autonomous/reconcile-positions` | Verify position sync with broker |
| POST | `/api/autonomous/sync-positions` | Sync positions from Alpaca |

### Trade Execution
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/autonomous/execute-trades` | Execute trades for decision IDs |

### Order Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/autonomous/open-orders` | List all open orders |
| POST | `/api/autonomous/cancel-stale-orders` | Cancel old orders (>maxAgeMinutes) |
| POST | `/api/autonomous/cancel-all-orders` | Cancel all pending orders |

### Orchestration Control
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/orchestration/status` | Coordinator status and config |
| POST | `/api/orchestration/start` | Start coordinator |
| POST | `/api/orchestration/stop` | Stop coordinator |
| PUT | `/api/orchestration/config` | Update coordinator config |

### Orchestration Monitoring
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/orchestration/logs` | Filtered logs with stats |
| GET | `/api/orchestration/logs/errors` | Error logs only |
| GET | `/api/orchestration/events` | Event history with stats |
| POST | `/api/orchestration/reset-stats` | Reset statistics |

## File Location
`/home/runner/workspace/server/routes/autonomous.ts`

## Export Function
```typescript
export function registerAutonomousRoutes(app: Express, authMiddleware: any)
```

## Key Features

### Automatic Risk Management
- Kill switch for emergency halts
- Position size limits (% of portfolio)
- Total exposure caps
- Maximum position count limits
- Daily loss thresholds

### Position Reconciliation
- Local vs. broker position sync
- Automatic detection of mismatches
- Force sync capability

### Intelligent Trade Execution
- Decision-based trading from AI engine
- Dynamic quantity calculation (1-10% of portfolio)
- Account buying power awareness
- Per-decision error tracking

### Order Lifecycle
- Open order tracking
- Stale order cleanup
- Batch cancellation support
- Order state monitoring

### Orchestration Visibility
- Real-time status monitoring
- Comprehensive logging (debug/info/warn/error/critical)
- Event history tracking
- Performance metrics

## Integration Example

```typescript
// In server/routes.ts
import { registerAutonomousRoutes } from "./routes/autonomous";

export function setupRoutes(app: Express) {
  const authMiddleware = (req: any, res: any, next: any) => {
    // auth logic
    next();
  };

  // Register autonomous trading routes
  registerAutonomousRoutes(app, authMiddleware);

  // ... other route registrations
}
```

## Authentication
All endpoints require `authMiddleware` protection. User context available via `req.userId`.

## Response Format
Standard JSON responses with error handling:
- Success: `{ success: true, data: {...} }`
- Error: `{ error: "Error message" }` (HTTP 400/500)

## Dependencies
- `orchestrator` - Autonomous trading orchestration
- `alpacaTradingEngine` - Alpaca broker integration
- `coordinator` - Orchestration coordination
- `eventBus` - Event management
- `logger` - Logging system
- `storage` - Data persistence
