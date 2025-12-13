# Kubernetes Deployment Manifests

This directory contains all Kubernetes manifests for deploying AI Active Trader to a Kubernetes cluster.

## Directory Structure

```
k8s/
├── namespace.yaml          # Namespace, ResourceQuota, NetworkPolicies
├── ingress.yaml            # External and internal ingress rules
├── common/
│   ├── service-account.yaml  # RBAC configuration
│   └── secrets.yaml          # Secret templates (substitute with envsubst)
├── nats/
│   ├── deployment.yaml     # NATS JetStream StatefulSet (3 replicas)
│   └── service.yaml        # Headless + LoadBalancer services
├── postgres/
│   ├── deployment.yaml     # PostgreSQL StatefulSet
│   ├── service.yaml        # ClusterIP service
│   └── secrets.yaml        # DB credentials + init scripts
└── services/
    ├── api-gateway.yaml    # External API gateway (port 5000)
    ├── trading-engine.yaml # Order execution (port 3001)
    ├── ai-decision.yaml    # LLM routing (port 3002)
    ├── market-data.yaml    # Market data ingestion (port 3003)
    ├── analytics.yaml      # P&L calculations (port 3004)
    └── orchestrator.yaml   # Trading cycle coordination (port 3005)
```

## Prerequisites

- Kubernetes 1.28+
- kubectl configured with cluster access
- Container registry access (GitHub Container Registry)
- Secrets configured in cluster or via Vault

## Deployment

### 1. Set Environment Variables

```bash
export IMAGE_TAG=$(git rev-parse --short HEAD)
export ENVIRONMENT=staging  # or production
export GITHUB_REPOSITORY=your-org/ai-active-trader

# Secrets (use Vault in production)
export DATABASE_URL="postgresql://..."
export ALPACA_API_KEY="..."
export ALPACA_SECRET_KEY="..."
export OPENAI_API_KEY="..."
# ... etc
```

### 2. Apply Manifests

```bash
# Create namespace and network policies
kubectl apply -f infrastructure/k8s/namespace.yaml

# Deploy infrastructure
kubectl apply -f infrastructure/k8s/common/
kubectl apply -f infrastructure/k8s/nats/
kubectl apply -f infrastructure/k8s/postgres/

# Deploy services (with variable substitution)
for service in api-gateway trading-engine ai-decision market-data analytics orchestrator; do
  envsubst < infrastructure/k8s/services/${service}.yaml | kubectl apply -f -
done

# Apply ingress
kubectl apply -f infrastructure/k8s/ingress.yaml
```

### 3. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n ai-trader

# Check services
kubectl get svc -n ai-trader

# Check ingress
kubectl get ingress -n ai-trader

# Health check endpoints
for svc in api-gateway trading-engine ai-decision market-data analytics orchestrator; do
  kubectl exec -n ai-trader deploy/${svc} -- curl -s localhost:$(kubectl get svc ${svc} -n ai-trader -o jsonpath='{.spec.ports[0].port}')/health
done
```

## Service Ports

| Service | HTTP Port | Metrics Port |
|---------|-----------|--------------|
| api-gateway | 5000 | 9000 |
| trading-engine | 3001 | 9001 |
| ai-decision | 3002 | 9002 |
| market-data | 3003 | 9003 |
| analytics | 3004 | 9004 |
| orchestrator | 3005 | 9005 |

## Scaling

Each service has a HorizontalPodAutoscaler configured:

| Service | Min Replicas | Max Replicas | Scale Target |
|---------|--------------|--------------|--------------|
| api-gateway | 2 | 10 | 70% CPU |
| trading-engine | 2 | 5 | 60% CPU |
| ai-decision | 2 | 8 | 70% CPU |
| market-data | 2 | 6 | 70% CPU |
| analytics | 2 | 4 | 70% CPU |
| orchestrator | 1 | 1 | N/A (singleton) |

## Secrets Management

In production, secrets should be managed via HashiCorp Vault with the Vault Agent Injector.

The `secrets.yaml` files use environment variable substitution (`${VAR}`) for templating.
Replace with Vault annotations for production:

```yaml
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/role: "ai-trader"
  vault.hashicorp.com/agent-inject-secret-db: "secret/data/ai-trader/database"
```

## Monitoring

All services expose Prometheus metrics on their metrics port with annotations:

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "900X"
```

OpenTelemetry traces are sent to `otel-collector.ai-trader.svc.cluster.local:4318`.

## Rollback

```bash
# Rollback a specific deployment
kubectl rollout undo deployment/api-gateway -n ai-trader

# Rollback all deployments
for svc in api-gateway trading-engine ai-decision market-data analytics orchestrator; do
  kubectl rollout undo deployment/${svc} -n ai-trader
done
```
