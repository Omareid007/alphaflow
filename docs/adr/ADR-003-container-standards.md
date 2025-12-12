# ADR-003: Container Standards and Deployment Patterns

**Status:** Accepted  
**Date:** 2025-12-12  
**Decision Makers:** AI Active Trader Team

## Context

Containerizing microservices requires standardized patterns for:
- Base images and security
- Health endpoints
- Configuration management
- Observability instrumentation
- CI/CD pipelines

## Decision

### 1. Base Image Standards

```dockerfile
# Standard base for all Node.js services
FROM node:22-alpine3.19 AS base

# Security hardening
RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S trader && \
    adduser -u 1001 -S trader -G trader

WORKDIR /app
USER trader

# Health check built-in
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1
```

### 2. Required Health Endpoints

Every service MUST implement these endpoints:

```typescript
// GET /health - Kubernetes liveness probe
{
  "status": "healthy" | "unhealthy",
  "timestamp": "2025-12-12T10:30:00Z",
  "uptime": 3600
}

// GET /ready - Kubernetes readiness probe
{
  "status": "ready" | "not_ready",
  "checks": {
    "database": "connected",
    "eventBus": "connected",
    "cache": "connected"
  }
}

// GET /metrics - Prometheus metrics (OpenTelemetry format)
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/positions",status="200"} 1234

// GET /info - Service metadata
{
  "service": "trading-engine",
  "version": "1.2.3",
  "commit": "abc123",
  "environment": "production"
}
```

### 3. Configuration Management

```yaml
# config/default.yaml (committed to repo)
server:
  port: ${PORT:3000}
  host: "0.0.0.0"

logging:
  level: ${LOG_LEVEL:info}
  format: json

database:
  host: ${DB_HOST:localhost}
  port: ${DB_PORT:5432}
  name: ${DB_NAME:ai_trader}
  pool:
    min: 2
    max: 10

eventBus:
  url: ${NATS_URL:nats://localhost:4222}
  reconnectWait: 5000
  maxReconnects: -1

observability:
  otelEndpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT}
  serviceName: ${OTEL_SERVICE_NAME:unknown}
```

### 4. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | HTTP server port |
| `NODE_ENV` | Yes | development/staging/production |
| `LOG_LEVEL` | No | debug/info/warn/error (default: info) |
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PASSWORD` | Yes | PostgreSQL password (from Vault) |
| `NATS_URL` | Yes | Event bus connection string |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Yes | OpenTelemetry collector |
| `OTEL_SERVICE_NAME` | Yes | Service name for tracing |

### 5. Dockerfile Template

```dockerfile
# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:22-alpine3.19 AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile --prod

# ============================================
# Stage 2: Builder
# ============================================
FROM node:22-alpine3.19 AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ============================================
# Stage 3: Runtime
# ============================================
FROM node:22-alpine3.19 AS runtime

RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S trader && \
    adduser -u 1001 -S trader -G trader

WORKDIR /app
USER trader

COPY --from=deps --chown=trader:trader /app/node_modules ./node_modules
COPY --from=builder --chown=trader:trader /app/dist ./dist
COPY --from=builder --chown=trader:trader /app/config ./config

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### 6. Kubernetes Deployment Template

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trading-engine
  labels:
    app: ai-trader
    component: trading-engine
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: ai-trader
      component: trading-engine
  template:
    metadata:
      labels:
        app: ai-trader
        component: trading-engine
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: trading-engine
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
        - name: trading-engine
          image: ghcr.io/ai-trader/trading-engine:1.2.3
          ports:
            - containerPort: 3000
              name: http
          env:
            - name: NODE_ENV
              value: production
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: trading-engine-secrets
                  key: db-password
          envFrom:
            - configMapRef:
                name: trading-engine-config
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
          volumeMounts:
            - name: config
              mountPath: /app/config
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: trading-engine-config
```

### 7. CI/CD Pipeline (GitHub Actions)

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
    paths:
      - 'services/trading-engine/**'
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ai-trader/trading-engine

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm lint

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: services/trading-engine
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: azure/k8s-set-context@v3
        with:
          kubeconfig: ${{ secrets.KUBE_CONFIG }}
      - run: |
          kubectl set image deployment/trading-engine \
            trading-engine=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
```

## Consequences

### Positive

1. **Consistency:** All services follow same patterns
2. **Security:** Non-root users, minimal images, secret management
3. **Observability:** Built-in health, metrics, tracing
4. **DevEx:** Fast builds with layer caching
5. **Reliability:** Rolling deploys, health checks

### Negative

1. **Overhead:** Template boilerplate for each service
2. **Learning Curve:** Team must understand Kubernetes patterns

## References

- [Docker Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Kubernetes Production Patterns](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/)
