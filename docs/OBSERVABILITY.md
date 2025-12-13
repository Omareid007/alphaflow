# Observability Guide

> **Canonical document for logging, monitoring, tracing, and observability infrastructure.**
>
> Start here: [INDEX.md](INDEX.md) | Related: [ARCHITECTURE.md](ARCHITECTURE.md) (system design), [TESTING.md](TESTING.md) (test strategy)

---

## Canonical References

| Topic | Go To |
|-------|-------|
| C4 architecture diagrams | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Trading agent runtime | [ORCHESTRATOR_AND_AGENT_RUNTIME.md](ORCHESTRATOR_AND_AGENT_RUNTIME.md) |
| Test strategy | [TESTING.md](TESTING.md) |
| External API connectors | [CONNECTORS_AND_INTEGRATIONS.md](CONNECTORS_AND_INTEGRATIONS.md) |

---

## Table of Contents

1. [Overview](#overview)
2. [Log Levels](#log-levels)
3. [Log Categories](#log-categories)
4. [Log Format](#log-format)
5. [Usage](#usage)
6. [Correlation IDs](#correlation-ids)
7. [Secret Redaction](#secret-redaction)
8. [In-Memory Buffer](#in-memory-buffer)
9. [API Endpoints](#api-endpoints)
10. [Current State (December 2025)](#10-current-state-december-2025)
11. [Enhancements Compared to Previous Version](#11-enhancements-compared-to-previous-version)
12. [Old vs New - Summary of Changes](#12-old-vs-new---summary-of-changes)

---

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

## 10. Current State (December 2025)

### 10.1 OpenTelemetry Integration

The platform now includes full OpenTelemetry integration for distributed tracing:

**Implementation Location:** `services/shared/common/telemetry.ts`

```typescript
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'
  }),
  instrumentations: [getNodeAutoInstrumentations()]
});
```

### 10.2 Tracing Capabilities

| Feature | Status | Description |
|---------|--------|-------------|
| **OTLP HTTP Exporter** | Implemented | Exports traces to OpenTelemetry collector |
| **Auto-Instrumentation** | Implemented | HTTP, Express, pg, and other libraries |
| **Context Propagation** | Implemented | Trace IDs flow across service boundaries |
| **Custom Spans** | Available | Manual span creation for business logic |
| **Test Coverage** | Planned | Tests for span creation, attributes, context propagation |

### 10.3 Span Creation Pattern

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('ai-decision-service');

async function analyzeMarket(symbol: string) {
  return tracer.startActiveSpan('analyzeMarket', async (span) => {
    try {
      span.setAttribute('symbol', symbol);
      span.setAttribute('service.name', 'ai-decision');
      
      const result = await performAnalysis(symbol);
      
      span.setAttribute('confidence', result.confidence);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### 10.4 Service-Level Instrumentation

Each microservice is instrumented:

| Service | Instrumentation | Trace Attributes |
|---------|-----------------|------------------|
| **API Gateway** | HTTP, routing | request.path, user.id, rate_limit.remaining |
| **Market Data** | HTTP, caching | symbol, provider, cache.hit |
| **Trading Engine** | Database, orders | order.id, position.id, execution.time |
| **AI Decision** | LLM calls | model, confidence, decision.action |
| **Analytics** | Calculations | metric.type, time_range |
| **Orchestrator** | Sagas, cycles | cycle.id, saga.step |

### 10.5 Metrics (Planned)

Prometheus metrics are planned for v2.1:

- `trading_orders_total` - Counter of orders by status
- `trading_pnl_daily` - Gauge of daily P&L
- `ai_decision_latency_seconds` - Histogram of AI response times
- `market_data_requests_total` - Counter of market data fetches by provider

---

## 11. Enhancements Compared to Previous Version

### 11.1 From Logging to Full Observability

| Aspect | Before (Dec 2024) | After (Dec 2025) |
|--------|-------------------|------------------|
| **Logging** | Structured JSON logs | Structured JSON + correlation IDs |
| **Tracing** | Cycle ID correlation only | Full distributed tracing (OpenTelemetry) |
| **Metrics** | None | Planned (Prometheus integration) |
| **Alerting** | None | Planned (threshold-based alerts) |

### 11.2 Distributed Tracing Benefits

1. **Cross-Service Visibility**
   - Trace requests from API Gateway through all services
   - Identify bottlenecks in service chains

2. **Root Cause Analysis**
   - Pinpoint failures to specific service/operation
   - Correlate errors with upstream events

3. **Performance Optimization**
   - Measure latency at each service hop
   - Identify slow database queries or LLM calls

### 11.3 Context Propagation

Trace context flows automatically via:
- HTTP headers (W3C Trace Context)
- NATS message headers
- Database connection context

---

## 12. Old vs New - Summary of Changes

| Component | Old Approach | New Approach |
|-----------|--------------|--------------|
| **Logging** | Custom logger with categories | Custom logger + OpenTelemetry spans |
| **Correlation** | Cycle ID only | Trace ID + Span ID + Cycle ID |
| **Tracing Backend** | None | OTLP collector (Jaeger, Tempo, etc.) |
| **Instrumentation** | Manual | Auto + Manual hybrid |
| **Cross-Service Tracing** | N/A | Full trace propagation |
| **Test Coverage** | None | Tests planned for telemetry |

---

## Related Governance Docs

| Document | Relevance |
|----------|-----------|
| `AGENT_EXECUTION_GUIDE.md` | Sections 14-16 define logging expectations for AI, connectors, and orchestrator |
| `AI_MODELS_AND_PROVIDERS.md` | Deep-dive on AI logging patterns |
| `CONNECTORS_AND_INTEGRATIONS.md` | Deep-dive on connector logging |
| `ORCHESTRATOR_AND_AGENT_RUNTIME.md` | Cycle ID correlation and orchestrator logging |
| `LESSONS_LEARNED.md` | Practical lessons on logging and observability |
| `TESTING.md` | OpenTelemetry test patterns |

---

*Last Updated: December 2025*
*Version: 2.0.0 (Microservices Migration)*
