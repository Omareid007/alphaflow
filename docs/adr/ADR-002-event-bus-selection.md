# ADR-002: Event Bus Technology Selection

**Status:** Accepted  
**Date:** 2025-12-12  
**Decision Makers:** AI Active Trader Team

## Context

The microservices architecture requires an event bus for asynchronous communication between services. Key requirements:

1. **Low Latency:** Trading decisions need sub-100ms event propagation
2. **Durability:** Events must survive service restarts (audit trail)
3. **Ordering:** Market events must be processed in order per symbol
4. **Replay:** Support event replay for testing and debugging
5. **Scalability:** Handle 10,000+ events/second during peak trading hours
6. **Operational Simplicity:** Minimize infrastructure overhead

## Decision

Adopt **NATS JetStream** as the primary event bus with the following configuration:

### Why NATS JetStream

| Requirement | NATS JetStream | Apache Kafka |
|-------------|---------------|--------------|
| Latency | ~1ms (excellent) | ~5-10ms (good) |
| Durability | ✅ File-based persistence | ✅ Log-based |
| Ordering | ✅ Per-subject ordering | ✅ Per-partition |
| Replay | ✅ Consumer replay | ✅ Offset-based |
| Scalability | ✅ Horizontal clusters | ✅ Partition scaling |
| Ops Complexity | Low (single binary) | High (ZooKeeper/KRaft) |
| Memory Footprint | ~50MB | ~1GB+ |
| Cloud Cost | Lower | Higher |

### Event Schema Standards

```typescript
interface BaseEvent {
  eventId: string;           // UUID v7 (time-ordered)
  eventType: string;         // Namespace.Action (e.g., "market.quote.received")
  timestamp: string;         // ISO 8601 with timezone
  version: string;           // Semantic version (e.g., "1.0.0")
  source: string;            // Publishing service name
  correlationId?: string;    // For request tracing
  causationId?: string;      // Event that caused this event
}

interface MarketQuoteEvent extends BaseEvent {
  eventType: "market.quote.received";
  payload: {
    symbol: string;
    price: number;
    bid: number;
    ask: number;
    volume: number;
    exchange: string;
  };
}
```

### Topic Structure

```
ai-trader.                           # Namespace prefix
├── market.                          # Market data domain
│   ├── quote.received               # Real-time quotes
│   ├── bar.1m                       # 1-minute bars
│   ├── bar.1d                       # Daily bars
│   └── news.published               # News events
├── trade.                           # Trading domain
│   ├── order.submitted              # Order submitted to broker
│   ├── order.filled                 # Order fully filled
│   ├── order.rejected               # Order rejected
│   └── position.updated             # Position changed
├── ai.                              # AI domain
│   ├── decision.generated           # AI made decision
│   ├── decision.executed            # Decision acted upon
│   └── calibration.completed        # Model calibration done
├── analytics.                       # Analytics domain
│   ├── pnl.calculated               # P&L update
│   └── metrics.snapshot             # Performance snapshot
└── system.                          # Infrastructure
    ├── heartbeat                    # Service health
    └── error.occurred               # Error events
```

### Consumer Groups

| Consumer Group | Subscriptions | Purpose |
|----------------|---------------|---------|
| `trading-engine` | `market.quote.*`, `ai.decision.*` | Execute trades |
| `ai-service` | `market.*`, `trade.position.*` | Generate decisions |
| `analytics` | `trade.*`, `market.bar.*` | Calculate metrics |
| `orchestrator` | `*.heartbeat`, `*.error.*` | Coordinate services |
| `dead-letter` | `*.dlq` | Failed message handling |

## Consequences

### Positive

1. **Simplicity:** Single NATS binary vs. Kafka + ZooKeeper
2. **Performance:** Sub-millisecond latency for trading events
3. **Cost:** ~70% lower infrastructure cost than Kafka
4. **DevEx:** Built-in CLI tools for debugging (`nats-cli`)
5. **Flexibility:** Supports request-reply pattern for sync calls when needed

### Negative

1. **Ecosystem:** Fewer connectors than Kafka (no Debezium direct support)
2. **Community:** Smaller community than Kafka
3. **Enterprise Support:** Less mature enterprise offering

### Migration Path

If requirements exceed NATS capabilities, migration to Kafka is straightforward:
- Event schemas remain unchanged (JSON/Protobuf)
- Topic structure maps 1:1 to Kafka topics
- Consumer groups concept identical

## Configuration

```yaml
# nats-server.conf
server_name: ai-trader-nats
port: 4222
http_port: 8222

jetstream {
  store_dir: /data/jetstream
  max_memory_store: 1GB
  max_file_store: 100GB
}

cluster {
  name: ai-trader-cluster
  routes: [
    nats://nats-1:6222,
    nats://nats-2:6222,
    nats://nats-3:6222
  ]
}

# Stream configurations
# Created via NATS CLI or Terraform
```

## Alternatives Considered

### Apache Kafka
**Deferred:** Overkill for current scale; reconsider if >100K events/sec needed

### RabbitMQ
**Rejected:** Not designed for event streaming; better for task queues

### AWS EventBridge
**Rejected:** Vendor lock-in; higher latency (~100ms+)

### Redis Streams
**Rejected:** Less mature durability guarantees; clustering complexity

## References

- [NATS JetStream Documentation](https://docs.nats.io/nats-concepts/jetstream)
- [NATS vs Kafka Comparison](https://nats.io/blog/nats-vs-kafka/)
- [CloudEvents Specification](https://cloudevents.io/)
