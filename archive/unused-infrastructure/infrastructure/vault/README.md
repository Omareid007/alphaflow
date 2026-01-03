# HashiCorp Vault Integration

This directory contains configuration and setup scripts for integrating AI Active Trader with HashiCorp Vault for secrets management.

## Overview

AI Active Trader uses Vault for secure secrets management in production environments. The integration supports:

- **Kubernetes Authentication**: Services authenticate using their ServiceAccount tokens
- **Vault Agent Injector**: Secrets are injected as files into pods via sidecar
- **Dynamic Secret Retrieval**: The `VaultSecretProvider` class fetches secrets directly from Vault API
- **Automatic Token Renewal**: Tokens are automatically renewed before expiration

## Prerequisites

- HashiCorp Vault 1.12+ installed in Kubernetes
- Vault Agent Injector deployed in the cluster
- Kubernetes auth method enabled in Vault

## Quick Start

### 1. Install Vault (if not already installed)

```bash
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  --set "injector.enabled=true" \
  --set "server.ha.enabled=true" \
  --set "server.ha.replicas=3"
```

### 2. Configure Kubernetes Authentication

```bash
# Port-forward to Vault
kubectl port-forward svc/vault -n vault 8200:8200 &

# Set Vault address
export VAULT_ADDR=http://localhost:8200

# Login to Vault (use your root token or admin credentials)
vault login

# Run the Kubernetes auth setup script
./kubernetes-auth.sh
```

### 3. Create Secrets

```bash
# Set your secrets as environment variables
export DATABASE_URL="postgresql://user:pass@host:5432/db"
export ALPACA_API_KEY="your-alpaca-key"
# ... etc

# Run the secrets setup script
./setup-secrets.sh
```

## Files

| File | Description |
|------|-------------|
| `policy.hcl` | Vault policy granting read access to ai-trader secrets |
| `kubernetes-auth.sh` | Script to configure Kubernetes auth method and role |
| `setup-secrets.sh` | Script to populate secrets in Vault |

## Secret Paths

Secrets are organized under the `secret/ai-trader/` path:

| Path | Contents |
|------|----------|
| `secret/ai-trader/database` | DATABASE_URL, DB_HOST, DB_PORT, etc. |
| `secret/ai-trader/alpaca` | ALPACA_API_KEY, ALPACA_SECRET_KEY |
| `secret/ai-trader/llm` | OPENAI_API_KEY, GROQ_API_KEY, etc. |
| `secret/ai-trader/market-data` | FINNHUB_API_KEY, POLYGON_API_KEY, NEWS_API_KEY |
| `secret/ai-trader/session` | SESSION_SECRET, JWT_SECRET |

## How It Works

### Vault Agent Injector (Recommended)

The Vault Agent Injector runs as a sidecar container and:

1. Authenticates with Vault using the pod's ServiceAccount
2. Fetches secrets from Vault
3. Writes secrets to `/vault/secrets/` as files
4. Automatically renews tokens and updates secrets

Pods are annotated to enable injection:

```yaml
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/role: "ai-trader"
  vault.hashicorp.com/agent-inject-secret-database: "secret/data/ai-trader/database"
  vault.hashicorp.com/agent-inject-template-database: |
    {{- with secret "secret/data/ai-trader/database" -}}
    export DATABASE_URL="{{ .Data.data.url }}"
    {{- end }}
```

### Direct API Access (Alternative)

The `VaultSecretProvider` class can also fetch secrets directly:

```typescript
import { VaultSecretProvider, SecretManager } from './common/secrets';

const provider = new VaultSecretProvider({
  vaultUrl: process.env.VAULT_ADDR,
  kubernetesRole: 'ai-trader',
});

const secretManager = new SecretManager(provider);
const dbUrl = await secretManager.getRequired('database/url');
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VAULT_ADDR` | Vault server URL | - |
| `VAULT_TOKEN` | Static token (dev only) | - |
| `VAULT_ROLE` | Kubernetes auth role | `ai-trader` |
| `VAULT_SECRETS_PATH` | Path to injected secrets | `/vault/secrets` |
| `VAULT_NAMESPACE` | Vault namespace (enterprise) | - |

## Troubleshooting

### Vault Agent not injecting secrets

1. Check if the Vault Agent Injector is running:
   ```bash
   kubectl get pods -n vault -l app.kubernetes.io/name=vault-agent-injector
   ```

2. Check pod annotations:
   ```bash
   kubectl get pod <pod-name> -n ai-trader -o jsonpath='{.metadata.annotations}'
   ```

3. Check Vault Agent logs:
   ```bash
   kubectl logs <pod-name> -n ai-trader -c vault-agent
   ```

### Authentication failures

1. Verify the ServiceAccount exists:
   ```bash
   kubectl get sa ai-trader-service -n ai-trader
   ```

2. Check the Vault role configuration:
   ```bash
   vault read auth/kubernetes/role/ai-trader
   ```

3. Verify the Kubernetes auth config:
   ```bash
   vault read auth/kubernetes/config
   ```

### Secrets not found

1. Verify secrets exist:
   ```bash
   vault kv list secret/ai-trader
   vault kv get secret/ai-trader/database
   ```

2. Check policy permissions:
   ```bash
   vault policy read ai-trader
   ```

## Security Best Practices

1. **Rotate secrets regularly** - Use Vault's lease mechanism or scheduled rotation
2. **Use short TTLs** - Configure tokens with 1-hour TTL, renewed automatically
3. **Limit policy scope** - Only grant access to required secret paths
4. **Audit logging** - Enable Vault audit logs for compliance
5. **Seal on emergency** - Know how to seal Vault in case of breach
