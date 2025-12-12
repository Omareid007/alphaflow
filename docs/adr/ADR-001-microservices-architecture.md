# ADR-001: Microservices Architecture Transformation

**Status:** Accepted  
**Date:** 2025-12-12  
**Decision Makers:** AI Active Trader Team

## Context

The AI Active Trader platform has grown from a prototype to a full-featured paper trading system. The current monolithic architecture, while functional, presents several challenges:

1. **Tight Coupling:** Changes to one component (e.g., AI decision engine) require full system deployment
2. **Scaling Limitations:** Cannot independently scale compute-intensive components (AI analysis vs. order execution)
3. **Fault Isolation:** Failure in one subsystem (e.g., market data connector) can cascade to entire application
4. **Development Velocity:** Single codebase limits parallel development and increases merge conflicts
5. **Technology Lock-in:** Difficult to adopt new AI models or market data providers without full refactor

## Decision

Transform the monolithic application into an **event-driven microservices architecture** with the following principles:

### 1. Service Topology (7 Core Services)

| Service | Domain | Responsibilities |
|---------|--------|-----------------|
| **Trading Engine** | Order Execution | Order lifecycle, position management, risk enforcement, Alpaca integration |
| **AI Decision Service** | Intelligence | LLM routing, prompt engineering, data fusion, feature store, model selection |
| **Market Data Service** | Data Ingestion | External connectors (Alpaca, Finnhub, CoinGecko), caching, event publishing |
| **Orchestrator Service** | Coordination | Trading cycle scheduling, saga coordination, operational state |
| **Analytics Service** | Reporting | P&L calculations, equity curves, performance metrics, historical analysis |
| **API Gateway** | Interface | Unified REST/GraphQL, authentication, rate limiting, BFF pattern |
| **Event Bus** | Infrastructure | Message routing, schema registry, event replay, dead letter queues |

### 2. Communication Patterns

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          EVENT BUS (Kafka/NATS)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ market.  │  │ trade.   │  │ ai.      │  │ position.│  │ system.  │ │
│  │ events   │  │ events   │  │ decisions│  │ updates  │  │ events   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
        │              │              │              │              │
        ▼              ▼              ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ Market  │   │ Trading │   │   AI    │   │Analytics│   │Orchestr │
   │  Data   │   │ Engine  │   │Decision │   │ Service │   │  ator   │
   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

### 3. Data Strategy

- **Database per Service:** Each service owns its schema within shared PostgreSQL cluster
- **Event Sourcing:** All state changes published as immutable events
- **CDC (Change Data Capture):** Debezium for cross-service data synchronization
- **Caching:** Redis for hot data (quotes, positions) with 30-second TTL

### 4. Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Runtime** | Node.js 22 (Alpine) | Existing expertise, async I/O performance |
| **Event Bus** | NATS JetStream or Kafka | Low latency, durability, replay capability |
| **Container** | Docker + Kubernetes | Industry standard, horizontal scaling |
| **Database** | PostgreSQL (per-service schemas) | ACID compliance, existing data |
| **Cache** | Redis Cluster | Sub-millisecond latency for market data |
| **Schema Registry** | Confluent/NATS Schema Registry | Contract enforcement, versioning |
| **Observability** | OpenTelemetry + Honeycomb | Distributed tracing, cost-effective |

## Consequences

### Positive

1. **Independent Deployability:** Each service can be deployed, scaled, and updated independently
2. **Fault Isolation:** Market data outage doesn't crash trading engine
3. **Technology Flexibility:** Can migrate AI service to Python/GPU if needed
4. **Team Autonomy:** Different teams can own different services
5. **Horizontal Scaling:** Scale AI service during market hours, reduce overnight
6. **Easier Testing:** Service-level unit tests, contract tests between services

### Negative

1. **Operational Complexity:** More services = more deployment pipelines
2. **Distributed Debugging:** Tracing issues across services requires tooling
3. **Network Latency:** Inter-service calls add latency (mitigated by async events)
4. **Data Consistency:** Eventual consistency requires careful design
5. **Initial Migration Cost:** Significant effort to extract from monolith

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Service boundaries wrong | Start with Strangler Fig pattern, dual-run validation |
| Event ordering issues | Use partition keys (symbol, strategyId) for ordering |
| Cascading failures | Circuit breakers, bulkheads, graceful degradation |
| Schema evolution breaks | Schema registry with backward compatibility rules |

## Alternatives Considered

### 1. Modular Monolith
**Rejected:** Doesn't address scaling or fault isolation needs

### 2. Serverless Functions
**Rejected:** Cold start latency incompatible with trading latency requirements

### 3. Full Service Mesh (Istio)
**Deferred:** Add after MVP proves architecture; premature complexity

## Implementation Plan

See [MICROSERVICES_ROADMAP.md](./MICROSERVICES_ROADMAP.md) for phased migration timeline.

## References

- [Event-Driven Architecture Patterns](https://microservices.io/patterns/data/event-driven-architecture.html)
- [Chronicle Software: Trading Microservices](https://chronicle.software/how-microservices-can-improve-performance-now-and-future-proof-your-trading-system-for-cloud-migration/)
- [QuantConnect Architecture](https://www.quantconnect.com/docs/v2)
