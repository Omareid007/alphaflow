# Docker Configuration

This directory contains Docker container templates for the AI Active Trader microservices architecture.

## Phase 1 Status: Infrastructure Templates

These Dockerfiles are **templates** prepared during Phase 1 (Platform Foundation). The actual microservice code will be implemented in Phase 2 (Service Extraction).

### Current Contents

| File | Service | Status |
|------|---------|--------|
| `Dockerfile.api-gateway` | API Gateway | Template ready |
| `Dockerfile.trading-engine` | Trading Engine | Template ready |
| `Dockerfile.ai-decision` | AI Decision | Template ready |
| `Dockerfile.market-data` | Market Data | Template ready |
| `Dockerfile.analytics` | Analytics | Template ready |
| `Dockerfile.orchestrator` | Orchestrator | Template ready |
| `docker-compose.yml` | Full stack | Ready for development |

### Build Pattern

Each service Dockerfile follows the same multi-stage build pattern:

1. **base**: Node.js 22 Alpine with common dependencies
2. **builder**: Installs dependencies and compiles TypeScript
3. **production**: Minimal runtime with compiled code only

### Local Development

```bash
# Start all infrastructure (NATS, Postgres, Redis, Jaeger)
docker-compose up -d nats postgres redis jaeger

# Build and start all services (once service code exists)
docker-compose up -d --build
```

### Prerequisites for Service Implementation (Phase 2)

When implementing services, each service directory should have:

1. `services/<service-name>/index.ts` - Service entrypoint
2. `services/<service-name>/tsconfig.json` - TypeScript config
3. Health check endpoint at `GET /health`

### Infrastructure Services

| Service | Port | Purpose |
|---------|------|---------|
| NATS | 4222 | Event bus (JetStream) |
| Postgres | 5432 | Primary database |
| Redis | 6379 | Caching layer |
| Jaeger | 16686 | Distributed tracing UI |

### Environment Variables

Required secrets should be set in `.env` or passed via CI/CD:
- `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` - Brokerage
- `OPENAI_API_KEY`, `GROQ_API_KEY` - LLM providers
- `FINNHUB_API_KEY` - Market data
