# AI Active Trader - Vault Policy
# Grants access to secrets needed by the microservices

# KV secrets engine v2 - read access to ai-trader secrets
path "secret/data/ai-trader/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/ai-trader/*" {
  capabilities = ["read", "list"]
}

# Database credentials - read access
path "secret/data/ai-trader/database" {
  capabilities = ["read"]
}

# API credentials - per-service access
path "secret/data/ai-trader/alpaca" {
  capabilities = ["read"]
}

path "secret/data/ai-trader/llm" {
  capabilities = ["read"]
}

path "secret/data/ai-trader/market-data" {
  capabilities = ["read"]
}

path "secret/data/ai-trader/session" {
  capabilities = ["read"]
}

# Token renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}
