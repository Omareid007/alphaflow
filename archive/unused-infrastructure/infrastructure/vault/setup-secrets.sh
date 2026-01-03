#!/bin/bash
# AI Active Trader - Vault Secrets Setup
# Run this script to initialize secrets in Vault

set -e

VAULT_ADDR=${VAULT_ADDR:-"http://vault.vault.svc.cluster.local:8200"}

echo "Setting up AI Active Trader secrets in Vault..."

# Enable KV secrets engine v2 if not already enabled
vault secrets enable -path=secret kv-v2 2>/dev/null || echo "KV secrets engine already enabled"

# Database secrets
echo "Creating database secrets..."
vault kv put secret/ai-trader/database \
  url="${DATABASE_URL:-postgresql://localhost:5432/ai_trader}" \
  host="${DB_HOST:-localhost}" \
  port="${DB_PORT:-5432}" \
  name="${DB_NAME:-ai_trader}" \
  user="${DB_USER:-postgres}" \
  password="${DB_PASSWORD:-}"

# Alpaca brokerage secrets
echo "Creating Alpaca secrets..."
vault kv put secret/ai-trader/alpaca \
  api_key="${ALPACA_API_KEY:-}" \
  secret_key="${ALPACA_SECRET_KEY:-}" \
  base_url="${ALPACA_BASE_URL:-https://paper-api.alpaca.markets}"

# LLM provider secrets
echo "Creating LLM secrets..."
vault kv put secret/ai-trader/llm \
  openai_api_key="${OPENAI_API_KEY:-}" \
  groq_api_key="${GROQ_API_KEY:-}" \
  together_api_key="${TOGETHER_API_KEY:-}" \
  anthropic_api_key="${ANTHROPIC_API_KEY:-}"

# Market data provider secrets
echo "Creating market data secrets..."
vault kv put secret/ai-trader/market-data \
  finnhub_api_key="${FINNHUB_API_KEY:-}" \
  polygon_api_key="${POLYGON_API_KEY:-}" \
  news_api_key="${NEWS_API_KEY:-}"

# Session/auth secrets
echo "Creating session secrets..."
vault kv put secret/ai-trader/session \
  session_secret="${SESSION_SECRET:-$(openssl rand -hex 32)}" \
  jwt_secret="${JWT_SECRET:-$(openssl rand -hex 32)}"

echo ""
echo "Vault secrets setup complete!"
echo ""
echo "Secrets created at:"
echo "  - secret/ai-trader/database"
echo "  - secret/ai-trader/alpaca"
echo "  - secret/ai-trader/llm"
echo "  - secret/ai-trader/market-data"
echo "  - secret/ai-trader/session"
