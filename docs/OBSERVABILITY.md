# Observability Guide

This document describes the logging, monitoring, and observability infrastructure for AI Active Trader.

## Overview

The application uses a centralized logging system designed for production readiness with the following features:

- Structured JSON logging with consistent format
- Correlation IDs for request and cycle tracing
- Log level filtering and categorization
- Secret redaction for security
- In-memory buffer for recent log access
- Specialized log methods for different domains

## Log Levels

| Level | Numeric | Usage |
|-------|---------|-------|
| `debug` | 0 | Detailed debugging information (development only) |
| `info` | 1 | General operational information |
| `warn` | 2 | Warnings that don't prevent operation |
| `error` | 3 | Errors that need attention |
| `critical` | 4 | Critical failures requiring immediate action |

Default level in production: `info`

## Log Categories

| Category | Symbol | Usage |
|----------|--------|-------|
| `TRADE` | Trade execution, position changes |
| `STRATEGY` | Strategy evaluation and signals |
| `MARKET` | Market data fetch/updates |
| `AI` | AI decision making and analysis |
| `CONNECTOR` | External API interactions |
| `SYSTEM` | Server lifecycle, general operations |

## Log Format

All logs are structured JSON for easy parsing:

```json
{
  "timestamp": "2024-12-11T15:30:00.000Z",
  "level": "info",
  "category": "TRADE",
  "requestId": "abc123",
  "message": "Opened position: AAPL $5000.00",
  "data": {
    "symbol": "AAPL",
    "value": 5000
  }
}
```

## Usage

### Import the Logger

```typescript
import { log } from "@/utils/logger";
```

### Basic Logging

```typescript
// Simple message
log.info("Server", "Application started");

// With structured data
log.info("MarketData", "Fetched stock quotes", { 
  symbols: ["AAPL", "MSFT"],
  count: 2 
});

// Error with context
log.error("Orchestrator", "Order failed", { 
  error: String(error),
  symbol: "BTC/USD",
  orderId: "abc123"
});
```

### Category-Specific Methods

```typescript
// Trade operations
log.trade("Opened position: AAPL $5000.00", { symbol: "AAPL", value: 5000 });

// AI decisions
log.ai("Analysis complete for AAPL", { confidence: 0.85, action: "buy" });

// Market data
log.market("Fetched crypto prices", { symbols: ["BTC", "ETH"], source: "coingecko" });

// External connectors
log.connector("Alpaca API call", { endpoint: "/positions", duration: 150 });
```

## Correlation IDs

### Request Tracking

Every HTTP request is automatically assigned a correlation ID via middleware:

```typescript
import { requestLogger, getRequestId } from "@/utils/logger";

// In Express setup
app.use(requestLogger);

// Access current request ID anywhere
const requestId = getRequestId();
```

### Cycle Tracking

The autonomous orchestrator uses cycle IDs to correlate all operations within a market analysis cycle:

```typescript
// Automatically set per cycle
log.info("Orchestrator", "Cycle complete", { cycleId });
```

## Secret Redaction

The logger automatically redacts known secret patterns from all log output:

- API keys containing `sk_`, `api_`, `secret_`
- Password fields
- Bearer tokens
- Environment variables matching known secret names

Example:
```typescript
log.info("Config", "API configured", { apiKey: "sk_test_12345" });
// Output: { "apiKey": "[REDACTED]" }
```

## In-Memory Buffer

Recent logs are kept in an in-memory buffer for debugging:

```typescript
import { getRecentLogs, getLogs, clearLogs } from "@/utils/logger";

// Get last 100 logs
const recentLogs = getRecentLogs(100);

// Get all buffered logs (up to 2000)
const allLogs = getLogs();

// Clear the buffer
clearLogs();
```

## API Endpoints

### GET /api/logs

Retrieve recent logs from the in-memory buffer:

```bash
curl http://localhost:5000/api/logs?limit=50&level=error
```

Query parameters:
- `limit`: Maximum number of logs to return (default: 100)
- `level`: Minimum log level to include (debug|info|warn|error|critical)

## Production Considerations

### Log Rotation

The in-memory buffer is capped at 2000 entries with automatic eviction of oldest entries. For production, consider:

- Streaming logs to external service (Datadog, Loggly, CloudWatch)
- File-based rotation with `winston-daily-rotate-file`
- Log aggregation via container runtime

### Performance

- Logs below configured level are discarded immediately
- JSON serialization is deferred until output
- Circular reference protection in data serialization

### Extending the Logger

To add external log shipping:

```typescript
// In server/utils/logger.ts
import { logger } from "./logger";

// Add custom transport
const originalLog = logger.log.bind(logger);
logger.log = (level, module, message, data) => {
  originalLog(level, module, message, data);
  // Send to external service
  externalService.send({ level, module, message, data });
};
```

## Integration with Orchestrator

The autonomous orchestrator logs the complete lifecycle:

| Event | Level | Category |
|-------|-------|----------|
| Cycle start | info | SYSTEM |
| Market data fetch | debug | MARKET |
| AI analysis | info | AI |
| Signal generated | info | STRATEGY |
| Trade execution | info | TRADE |
| Position opened/closed | info | TRADE |
| Stop-loss/take-profit triggered | warn | TRADE |
| Errors | error | SYSTEM |
| Cycle complete | info | SYSTEM |

## Troubleshooting

### Common Issues

**Logs not appearing:**
- Check `LOG_LEVEL` environment variable
- Verify logger import path
- Ensure middleware is applied before routes

**Missing correlation IDs:**
- Ensure `requestLogger` middleware is applied
- Check AsyncLocalStorage compatibility

**Memory usage concerns:**
- Reduce buffer size in `MAX_BUFFER_SIZE`
- Increase log level to reduce volume
- Implement external log shipping

## Future Enhancements

Planned observability improvements:

1. **Metrics Collection**: Prometheus/StatsD integration for trading metrics
2. **Distributed Tracing**: OpenTelemetry integration for request tracing
3. **Alerting**: Automated alerts for critical conditions (daily loss limit, API failures)
4. **Dashboard**: Grafana dashboard for real-time monitoring
5. **Log Persistence**: PostgreSQL or external service for log history

---

## Related Governance Docs

| Document | Relevance |
|----------|-----------|
| `AGENT_EXECUTION_GUIDE.md` | Sections 14-16 define logging expectations for AI, connectors, and orchestrator |
| `AI_MODELS_AND_PROVIDERS.md` | Deep-dive on AI logging patterns |
| `CONNECTORS_AND_INTEGRATIONS.md` | Deep-dive on connector logging |
| `ORCHESTRATOR_AND_AGENT_RUNTIME.md` | Cycle ID correlation and orchestrator logging |
| `LESSONS_LEARNED.md` | Practical lessons on logging and observability |
