#!/bin/bash
# AI Active Trader - Vault Kubernetes Authentication Setup
# Run this script to configure Vault for Kubernetes auth

set -e

VAULT_ADDR=${VAULT_ADDR:-"http://vault.vault.svc.cluster.local:8200"}
KUBERNETES_HOST=${KUBERNETES_HOST:-"https://kubernetes.default.svc.cluster.local:443"}
NAMESPACE=${NAMESPACE:-"ai-trader"}
SERVICE_ACCOUNT=${SERVICE_ACCOUNT:-"ai-trader-service"}

echo "Configuring Vault Kubernetes authentication..."

# Enable Kubernetes auth method if not already enabled
vault auth enable kubernetes 2>/dev/null || echo "Kubernetes auth already enabled"

# Configure Kubernetes auth method
vault write auth/kubernetes/config \
  kubernetes_host="$KUBERNETES_HOST" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  token_reviewer_jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token

echo "Creating Vault policy..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create the ai-trader policy using relative path from script location
vault policy write ai-trader "${SCRIPT_DIR}/policy.hcl"

echo "Creating Vault role..."

# Create role for ai-trader services
vault write auth/kubernetes/role/ai-trader \
  bound_service_account_names="$SERVICE_ACCOUNT" \
  bound_service_account_namespaces="$NAMESPACE" \
  policies="ai-trader" \
  ttl="1h" \
  max_ttl="4h"

echo "Vault Kubernetes auth configured successfully!"
echo ""
echo "Services in namespace '$NAMESPACE' with service account '$SERVICE_ACCOUNT' can now authenticate with Vault."
echo ""
echo "To verify, run:"
echo "  vault read auth/kubernetes/role/ai-trader"
