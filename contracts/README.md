# API Contracts

This directory contains OpenAPI 3.1 specifications for AI Active Trader microservices.

## Available Contracts

| File | Service | Description |
|------|---------|-------------|
| `trading-engine.yaml` | Trading Engine | Order execution, positions, risk management |
| `ai-decision.yaml` | AI Decision | LLM-powered trading decisions and analysis |
| `market-data.yaml` | Market Data | Real-time quotes, historical bars, news |

## Usage

### Viewing Documentation

Generate interactive documentation using Swagger UI or Redoc:

```bash
# Using npx
npx @redocly/cli preview-docs contracts/trading-engine.yaml

# Or with Docker
docker run -p 8080:8080 -v $(pwd)/contracts:/contracts \
  swaggerapi/swagger-ui -e URLS="[{url:'/contracts/trading-engine.yaml',name:'Trading Engine'}]"
```

### Code Generation

Generate client SDKs or server stubs:

```bash
# TypeScript client
npx openapi-typescript-codegen \
  --input contracts/trading-engine.yaml \
  --output generated/trading-engine-client \
  --client axios

# Go server stub
docker run --rm -v $(pwd):/local openapitools/openapi-generator-cli generate \
  -i /local/contracts/trading-engine.yaml \
  -g go-server \
  -o /local/generated/trading-engine-server
```

### Contract Testing

Validate API implementations against contracts:

```bash
# Using Prism mock server
npx @stoplight/prism-cli mock contracts/market-data.yaml

# Using Dredd for contract testing
npx dredd contracts/trading-engine.yaml http://localhost:3001
```

## Service Endpoints

### Trading Engine (Port 3001)

- `POST /api/v1/orders` - Submit orders
- `GET /api/v1/positions` - List positions
- `GET /api/v1/risk/limits` - Risk configuration
- `GET /api/v1/portfolio/account` - Account info

### AI Decision (Port 3002)

- `POST /api/v1/decisions` - Generate AI decisions
- `POST /api/v1/analysis/sentiment` - Sentiment analysis
- `GET /api/v1/models` - Available LLM models
- `GET /api/v1/prompts` - Prompt templates

### Market Data (Port 3003)

- `GET /api/v1/quotes/{symbol}` - Real-time quotes
- `GET /api/v1/bars/{symbol}` - Historical bars
- `GET /api/v1/news` - Market news
- `GET /api/v1/search` - Symbol search

## Versioning

All APIs use URL versioning (`/api/v1/`). Breaking changes will introduce new versions.

## Authentication

All endpoints require Bearer token authentication (JWT) unless otherwise specified. Health check endpoints (`/health/*`) are public.
