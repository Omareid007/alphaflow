# AI Active Trader - Documentation Index

> **Front door for all project documentation.** Start here to find what you need.

---

## Quick Start by Role

| Your Role | Start Here | Then Read |
|-----------|------------|-----------|
| **New Developer** | [APP_OVERVIEW.md](APP_OVERVIEW.md) | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **AI/Replit Agent** | [AGENT_EXECUTION_GUIDE.md](AGENT_EXECUTION_GUIDE.md) | [LESSONS_LEARNED.md](LESSONS_LEARNED.md) |
| **Backend Engineer** | [ARCHITECTURE.md](ARCHITECTURE.md) | [CONNECTORS_AND_INTEGRATIONS.md](CONNECTORS_AND_INTEGRATIONS.md) |
| **AI/LLM Work** | [AI_MODELS_AND_PROVIDERS.md](AI_MODELS_AND_PROVIDERS.md) | [ORCHESTRATOR_AND_AGENT_RUNTIME.md](ORCHESTRATOR_AND_AGENT_RUNTIME.md) |
| **DevOps/SRE** | [OBSERVABILITY.md](OBSERVABILITY.md) | [MICROSERVICES_ROADMAP.md](MICROSERVICES_ROADMAP.md) |
| **QA Engineer** | [TESTING.md](TESTING.md) | [FINANCIAL_METRICS.md](FINANCIAL_METRICS.md) |
| **Product/Domain** | [APP_OVERVIEW.md](APP_OVERVIEW.md) | [FINANCIAL_METRICS.md](FINANCIAL_METRICS.md) |

---

## Document Map

### Core Documentation

| Document | Purpose | Status |
|----------|---------|--------|
| [APP_OVERVIEW.md](APP_OVERVIEW.md) | Product overview, features, user journeys | Current |
| [ARCHITECTURE.md](ARCHITECTURE.md) | C4 architecture views, system design | Current |
| [AGENT_EXECUTION_GUIDE.md](AGENT_EXECUTION_GUIDE.md) | AI agent governance and workflow rules | Current |
| [FINANCIAL_METRICS.md](FINANCIAL_METRICS.md) | P&L formulas, metric definitions | Current |
| [TESTING.md](TESTING.md) | Test strategy, commands, test backlog | Current |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Logging, tracing, monitoring | Current |
| [LESSONS_LEARNED.md](LESSONS_LEARNED.md) | Patterns, anti-patterns, retrospectives | Current |

### AI & Trading Runtime

| Document | Purpose | Status |
|----------|---------|--------|
| [AI_MODELS_AND_PROVIDERS.md](AI_MODELS_AND_PROVIDERS.md) | LLM providers, model selection, routing | Current |
| [ORCHESTRATOR_AND_AGENT_RUNTIME.md](ORCHESTRATOR_AND_AGENT_RUNTIME.md) | Trading agent cycles, runtime behavior | Current |
| [CONNECTORS_AND_INTEGRATIONS.md](CONNECTORS_AND_INTEGRATIONS.md) | External APIs (Alpaca, Finnhub, etc.) | Current |

### Microservices Migration

| Document | Purpose | Status |
|----------|---------|--------|
| [MICROSERVICES_ROADMAP.md](MICROSERVICES_ROADMAP.md) | Migration phases, progress tracking | Current |
| [EVENT_SCHEMA_REGISTRY.md](EVENT_SCHEMA_REGISTRY.md) | NATS JetStream event schemas | Current |
| [TRADING_SAGA_SEQUENCES.md](TRADING_SAGA_SEQUENCES.md) | Distributed transaction patterns | Current |
| [DATA_MIGRATION_STRATEGY.md](DATA_MIGRATION_STRATEGY.md) | Database migration approach | Current |

### Service Documentation

| Document | Purpose |
|----------|---------|
| [services/AI_DECISION.md](services/AI_DECISION.md) | AI Decision Service |
| [services/ANALYTICS.md](services/ANALYTICS.md) | Analytics Service |
| [services/API_GATEWAY.md](services/API_GATEWAY.md) | API Gateway |
| [services/MARKET_DATA.md](services/MARKET_DATA.md) | Market Data Service |
| [services/ORCHESTRATOR.md](services/ORCHESTRATOR.md) | Orchestrator Service |
| [services/TRADING_ENGINE.md](services/TRADING_ENGINE.md) | Trading Engine Service |

### Provider Capabilities

| Document | Purpose |
|----------|---------|
| [providers/ALPACA_CAPABILITIES.md](providers/ALPACA_CAPABILITIES.md) | Alpaca API coverage |
| [providers/FINNHUB_CAPABILITIES.md](providers/FINNHUB_CAPABILITIES.md) | Finnhub API coverage |
| [providers/COINGECKO_CAPABILITIES.md](providers/COINGECKO_CAPABILITIES.md) | CoinGecko API coverage |
| [providers/OPENAI_CAPABILITIES.md](providers/OPENAI_CAPABILITIES.md) | OpenAI API usage |
| [providers/CAPABILITY_SUMMARY.md](providers/CAPABILITY_SUMMARY.md) | Cross-provider summary |

### Architecture Decision Records (ADRs)

| Document | Decision |
|----------|----------|
| [adr/ADR-001-microservices-architecture.md](adr/ADR-001-microservices-architecture.md) | Microservices adoption |
| [adr/ADR-002-event-bus-selection.md](adr/ADR-002-event-bus-selection.md) | NATS JetStream selection |
| [adr/ADR-003-container-standards.md](adr/ADR-003-container-standards.md) | Container/K8s standards |

### Trading & Order Management

| Document | Purpose | Status |
|----------|---------|--------|
| [ORDER_LIFECYCLE.md](ORDER_LIFECYCLE.md) | Broker Order → Fill lifecycle, status mapping | Current |
| [SOURCE_OF_TRUTH_CONTRACT.md](SOURCE_OF_TRUTH_CONTRACT.md) | Alpaca as single source of truth | Current |
| [WORK_QUEUE_ARCHITECTURE.md](WORK_QUEUE_ARCHITECTURE.md) | Durable work queue, retry, dead-letter | Current |

### Reference & Guides

| Document | Purpose |
|----------|---------|
| [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) | Admin Hub UI documentation |
| [ADMIN_ACCESS.md](ADMIN_ACCESS.md) | Admin Hub access guide |
| [API_REFERENCE.md](API_REFERENCE.md) | Central REST API endpoint list |
| [SLA_SLO_TARGETS.md](SLA_SLO_TARGETS.md) | Service level targets |
| [COMPETITIVE_BENCHMARKING.md](COMPETITIVE_BENCHMARKING.md) | Industry comparison |
| [N8N_INTEGRATION_GUIDE.md](N8N_INTEGRATION_GUIDE.md) | n8n workflow automation |
| [DOC_ASSISTANT.md](DOC_ASSISTANT.md) | Documentation writing guide |

---

## One Topic, One Home

Each topic has exactly one canonical document. If you need information, go to the right place:

| Topic | Canonical Document |
|-------|-------------------|
| Product overview, features | [APP_OVERVIEW.md](APP_OVERVIEW.md) |
| C4 architecture, system design | [ARCHITECTURE.md](ARCHITECTURE.md) |
| AI agent workflow, governance | [AGENT_EXECUTION_GUIDE.md](AGENT_EXECUTION_GUIDE.md) |
| LLM providers, model routing | [AI_MODELS_AND_PROVIDERS.md](AI_MODELS_AND_PROVIDERS.md) |
| External API connectors | [CONNECTORS_AND_INTEGRATIONS.md](CONNECTORS_AND_INTEGRATIONS.md) |
| P&L formulas, metrics | [FINANCIAL_METRICS.md](FINANCIAL_METRICS.md) |
| Test strategy, test backlog | [TESTING.md](TESTING.md) |
| Logging, tracing, monitoring | [OBSERVABILITY.md](OBSERVABILITY.md) |
| Trading agent runtime | [ORCHESTRATOR_AND_AGENT_RUNTIME.md](ORCHESTRATOR_AND_AGENT_RUNTIME.md) |
| Migration progress | [MICROSERVICES_ROADMAP.md](MICROSERVICES_ROADMAP.md) |
| Lessons, retrospectives | [LESSONS_LEARNED.md](LESSONS_LEARNED.md) |
| REST API endpoints | [API_REFERENCE.md](API_REFERENCE.md) |
| Admin Hub UI | [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) |
| Admin Hub access | [ADMIN_ACCESS.md](ADMIN_ACCESS.md) |
| Order lifecycle, fills | [ORDER_LIFECYCLE.md](ORDER_LIFECYCLE.md) |
| Work queue, retry, dead-letter | [WORK_QUEUE_ARCHITECTURE.md](WORK_QUEUE_ARCHITECTURE.md) |

---

## Status Legend

Documents use these status labels:

- **Implemented** - Feature/component is live in production
- **Partial** - Some parts implemented, others planned
- **Planned** - Designed but not yet built
- **Deprecated** - Being phased out

---

## Document Maintenance

When updating docs:

1. **One home per topic** - Don't duplicate information across documents
2. **Link, don't copy** - Reference the canonical document instead of copying content
3. **Add status labels** - Mark features as Implemented/Partial/Planned
4. **Update LESSONS_LEARNED** - Capture insights from significant work

---

*Last updated: December 2025*
