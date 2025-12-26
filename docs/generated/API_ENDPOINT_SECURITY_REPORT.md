# API Endpoint Security & Quality Report

Generated: 2025-12-24T05:28:58.224Z

## Summary

- **Total Endpoints**: 341
- **Protected Endpoints**: 200 (58.7%)
- **Public Endpoints**: 141 (41.3%)
- **Critical Issues**: 97
- **Medium Priority Issues**: 75

## Endpoints by Category

### AI

| Method | Path | Auth | Validation | Error Handling | Issues |
|--------|------|------|------------|----------------|--------|
| POST | `/api/ai/analyze` | ❌ | ✅ | ❌ | Incomplete error handling |
| GET | `/api/ai/status` | ❌ | ❌ | ✅ | - |
| GET | `/api/ai/cache/stats` | ❌ | ❌ | ✅ | - |
| POST | `/api/ai/cache/clear` | ❌ | ❌ | ✅ | Missing input validation |
| POST | `/api/ai/cache/clear/:role` | ❌ | ❌ | ✅ | Missing input validation |
| POST | `/api/ai/cache/reset-stats` | ❌ | ❌ | ✅ | Missing input validation |
| GET | `/api/ai/sentiment` | ✅ | ❌ | ✅ | - |

### Admin

| Method | Path | Auth | Validation | Error Handling | Issues |
|--------|------|------|------------|----------------|--------|
| GET | `/api/admin/api-usage` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/api-cache` | ✅ | ❌ | ✅ | - |
| POST | `/api/admin/api-cache/purge` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/admin/provider-status` | ✅ | ❌ | ✅ | - |
| POST | `/api/admin/provider/:provider/force-refresh` | ✅ | ❌ | ✅ | Missing input validation |
| PATCH | `/api/admin/provider/:provider/toggle` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/admin/valyu-budget` | ✅ | ❌ | ✅ | - |
| PUT | `/api/admin/valyu-budget` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/admin/connectors-health` | ✅ | ❌ | ❌ | Incomplete error handling |
| GET | `/api/admin/api-keys-status` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/data-fusion-status` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/ai-config` | ✅ | ❌ | ✅ | - |
| PUT | `/api/admin/ai-config` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/admin/model-router/configs` | ✅ | ✅ | ✅ | - |
| PUT | `/api/admin/model-router/configs/:role` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/model-router/calls` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/model-router/stats` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/work-items` | ✅ | ❌ | ✅ | - |
| POST | `/api/admin/work-items/retry` | ✅ | ✅ | ✅ | - |
| POST | `/api/admin/work-items/dead-letter` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/orchestrator-health` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/modules` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/modules/accessible` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/modules/:id` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/overview` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/rbac/me` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/rbac/roles` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/rbac/check/:capability` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/settings` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/settings/:namespace/:key` | ✅ | ✅ | ✅ | - |
| PUT | `/api/admin/settings/:namespace/:key` | ✅ | ❌ | ✅ | Missing input validation |
| DELETE | `/api/admin/settings/:namespace/:key` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/orchestrator/status` | ✅ | ❌ | ✅ | - |
| POST | `/api/admin/orchestrator/pause` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/admin/orchestrator/resume` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/admin/orchestrator/run-now` | ✅ | ❌ | ✅ | Missing input validation |
| PUT | `/api/admin/orchestrator/config` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/admin/orchestrator/reset-stats` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/admin/jobs/status` | ✅ | ❌ | ✅ | - |
| POST | `/api/admin/jobs/sync-positions` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/admin/search` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/trace/:traceId` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/universe/stats` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/universe/assets` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/universe/assets/:symbol` | ✅ | ✅ | ✅ | - |
| POST | `/api/admin/universe/refresh` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/admin/universe/exclude/:symbol` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/admin/universe/tradable` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/liquidity/stats` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/liquidity/metrics/:symbol` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/liquidity/tier/:tier` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/liquidity/top` | ✅ | ❌ | ✅ | - |
| POST | `/api/admin/liquidity/compute` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/admin/fundamentals/stats` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/fundamentals/:symbol` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/fundamentals/top/scores` | ✅ | ❌ | ✅ | - |
| POST | `/api/admin/fundamentals/fetch` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/admin/candidates/stats` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/candidates` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/candidates/:symbol` | ✅ | ✅ | ✅ | - |
| POST | `/api/admin/candidates/generate` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/admin/candidates/:symbol/approve` | ✅ | ✅ | ✅ | - |
| POST | `/api/admin/candidates/:symbol/reject` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/admin/candidates/:symbol/watchlist` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/admin/candidates/approved/list` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/enforcement/stats` | ✅ | ❌ | ✅ | - |
| POST | `/api/admin/enforcement/check` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/admin/enforcement/reset-stats` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/admin/allocation/stats` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/allocation/policies` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/allocation/policies/active` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/allocation/policies/:id` | ✅ | ✅ | ✅ | - |
| POST | `/api/admin/allocation/policies` | ✅ | ✅ | ✅ | - |
| PATCH | `/api/admin/allocation/policies/:id` | ✅ | ✅ | ✅ | - |
| POST | `/api/admin/allocation/policies/:id/activate` | ✅ | ✅ | ✅ | - |
| POST | `/api/admin/allocation/policies/:id/deactivate` | ✅ | ✅ | ✅ | - |
| POST | `/api/admin/allocation/analyze` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/allocation/runs` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/allocation/runs/:id` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/rebalancer/stats` | ✅ | ✅ | ✅ | - |
| POST | `/api/admin/rebalancer/dry-run` | ✅ | ✅ | ✅ | - |
| POST | `/api/admin/rebalancer/execute` | ✅ | ✅ | ✅ | - |
| POST | `/api/admin/rebalancer/profit-taking/analyze` | ✅ | ✅ | ✅ | - |
| GET | `/api/admin/audit-logs` | ✅ | ❌ | ✅ | - |
| GET | `/api/admin/audit-logs/stats` | ✅ | ❌ | ✅ | - |

### Alpaca Integration

| Method | Path | Auth | Validation | Error Handling | Issues |
|--------|------|------|------------|----------------|--------|
| GET | `/api/alpaca/account` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/assets` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/allocations` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/alpaca/rebalance/preview` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/alpaca/rebalance/execute` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/rebalance/suggestions` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/assets/search` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/bars` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/snapshots` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/health` | ✅ | ❌ | ✅ | - |
| GET | `/api/alpaca/clock` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/market-status` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/can-trade-extended/:symbol` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/portfolio-history` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/top-stocks` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/top-crypto` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/top-etfs` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/alpaca/validate-order` | ❌ | ❌ | ✅ | Missing input validation; CRITICAL: Sensitive endpoint without authentication |

### Authentication

| Method | Path | Auth | Validation | Error Handling | Issues |
|--------|------|------|------------|----------------|--------|
| POST | `/api/auth/signup` | ❌ | ✅ | ✅ | - |
| POST | `/api/auth/login` | ❌ | ✅ | ✅ | - |
| POST | `/api/auth/logout` | ❌ | ❌ | ✅ | Missing input validation |
| GET | `/api/auth/me` | ❌ | ✅ | ✅ | - |

### Autonomous Trading

| Method | Path | Auth | Validation | Error Handling | Issues |
|--------|------|------|------------|----------------|--------|
| GET | `/api/agent/status` | ✅ | ✅ | ✅ | - |
| POST | `/api/agent/toggle` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/autonomous/state` | ✅ | ❌ | ✅ | - |
| POST | `/api/autonomous/start` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/autonomous/stop` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/autonomous/kill-switch` | ✅ | ❌ | ✅ | Missing input validation |
| PUT | `/api/autonomous/risk-limits` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/autonomous/mode` | ✅ | ✅ | ✅ | - |
| GET | `/api/agent/market-analysis` | ✅ | ❌ | ✅ | - |
| POST | `/api/agent/market-analysis/refresh` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/agent/dynamic-limits` | ✅ | ❌ | ✅ | - |
| POST | `/api/agent/set-limits` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/agent/health` | ✅ | ❌ | ✅ | - |
| POST | `/api/agent/auto-start` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/autonomous/execution-history` | ✅ | ✅ | ✅ | - |
| POST | `/api/autonomous/close-position` | ✅ | ✅ | ✅ | - |
| POST | `/api/autonomous/execute-trades` | ✅ | ✅ | ❌ | Incomplete error handling |
| GET | `/api/autonomous/open-orders` | ✅ | ❌ | ✅ | - |
| POST | `/api/autonomous/cancel-stale-orders` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/autonomous/cancel-all-orders` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/autonomous/reconcile-positions` | ✅ | ❌ | ✅ | - |
| POST | `/api/autonomous/sync-positions` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/autonomous/close-all-positions` | ✅ | ❌ | ✅ | Missing input validation |

### Backtesting

| Method | Path | Auth | Validation | Error Handling | Issues |
|--------|------|------|------------|----------------|--------|
| POST | `/api/backtests/run` | ✅ | ✅ | ❌ | Incomplete error handling |
| GET | `/api/backtests/` | ✅ | ✅ | ✅ | - |
| GET | `/api/backtests/:id` | ✅ | ✅ | ✅ | - |
| GET | `/api/backtests/:id/equity-curve` | ✅ | ❌ | ✅ | - |

### Health

| Method | Path | Auth | Validation | Error Handling | Issues |
|--------|------|------|------------|----------------|--------|
| GET | `/api/uae/status` | ❌ | ✅ | ✅ | - |
| GET | `/api/connectors/status` | ❌ | ❌ | ❌ | Incomplete error handling |
| GET | `/api/fusion/status` | ❌ | ✅ | ✅ | - |
| GET | `/api/health/db` | ✅ | ❌ | ✅ | - |
| GET | `/api/alpaca-trading/status` | ❌ | ✅ | ✅ | - |
| GET | `/api/orchestration/status` | ❌ | ❌ | ✅ | - |
| GET | `/api/jina/health` | ✅ | ❌ | ❌ | Incomplete error handling |
| GET | `/api/macro/status` | ✅ | ❌ | ✅ | - |
| GET | `/api/enrichment/status` | ✅ | ✅ | ✅ | - |
| GET | `/api/enrichment/status/:jobName` | ✅ | ✅ | ✅ | - |

### Market Data

| Method | Path | Auth | Validation | Error Handling | Issues |
|--------|------|------|------------|----------------|--------|
| GET | `/api/crypto/markets` | ❌ | ❌ | ✅ | - |
| GET | `/api/crypto/prices` | ❌ | ❌ | ✅ | - |
| GET | `/api/crypto/chart/:coinId` | ❌ | ❌ | ✅ | - |
| GET | `/api/crypto/trending` | ❌ | ❌ | ✅ | - |
| GET | `/api/crypto/global` | ❌ | ✅ | ✅ | - |
| GET | `/api/crypto/search` | ❌ | ✅ | ✅ | - |
| GET | `/api/stock/quote/:symbol` | ❌ | ❌ | ✅ | - |
| GET | `/api/stock/quotes` | ❌ | ❌ | ✅ | - |
| GET | `/api/stock/candles/:symbol` | ❌ | ❌ | ✅ | - |
| GET | `/api/stock/profile/:symbol` | ❌ | ✅ | ✅ | - |
| GET | `/api/stock/search` | ❌ | ✅ | ✅ | - |
| GET | `/api/stock/news` | ❌ | ❌ | ✅ | - |
| GET | `/api/news/stock/:symbol` | ❌ | ❌ | ✅ | - |

### Notifications

| Method | Path | Auth | Validation | Error Handling | Issues |
|--------|------|------|------------|----------------|--------|
| GET | `/api/webhooks` | ✅ | ✅ | ✅ | - |
| GET | `/api/webhooks/:id` | ✅ | ✅ | ✅ | - |
| POST | `/api/webhooks` | ✅ | ✅ | ✅ | - |
| PUT | `/api/webhooks/:id` | ✅ | ✅ | ✅ | - |
| DELETE | `/api/webhooks/:id` | ✅ | ✅ | ✅ | - |
| POST | `/api/webhooks/test` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/webhooks/stats/overview` | ✅ | ❌ | ❌ | Incomplete error handling |
| GET | `/api/webhooks/history/deliveries` | ✅ | ❌ | ❌ | Incomplete error handling |
| GET | `/api/notifications/channels` | ✅ | ✅ | ✅ | - |
| GET | `/api/notifications/channels/:id` | ✅ | ✅ | ✅ | - |
| POST | `/api/notifications/channels` | ✅ | ✅ | ✅ | - |
| PUT | `/api/notifications/channels/:id` | ✅ | ✅ | ✅ | - |
| DELETE | `/api/notifications/channels/:id` | ✅ | ✅ | ✅ | - |
| GET | `/api/notifications/templates` | ✅ | ✅ | ✅ | - |
| POST | `/api/notifications/templates` | ✅ | ✅ | ✅ | - |
| PUT | `/api/notifications/templates/:id` | ✅ | ✅ | ✅ | - |
| DELETE | `/api/notifications/templates/:id` | ✅ | ✅ | ✅ | - |
| POST | `/api/notifications/send` | ✅ | ✅ | ✅ | - |
| POST | `/api/notifications/channels/:id/test` | ✅ | ✅ | ✅ | - |
| GET | `/api/notifications/history` | ✅ | ❌ | ✅ | - |
| GET | `/api/notifications/stats` | ✅ | ❌ | ✅ | - |

### Other

| Method | Path | Auth | Validation | Error Handling | Issues |
|--------|------|------|------------|----------------|--------|
| GET | `/api/events` | ❌ | ✅ | ✅ | - |
| POST | `/api/strategy-config` | ❌ | ✅ | ✅ | - |
| POST | `/api/strategy-validate` | ❌ | ✅ | ✅ | - |
| GET | `/api/ai-decisions` | ✅ | ❌ | ✅ | - |
| GET | `/api/ai-decisions/history` | ❌ | ❌ | ✅ | - |
| POST | `/api/ai-decisions` | ❌ | ✅ | ✅ | - |
| GET | `/api/ai-decisions/enriched` | ❌ | ❌ | ❌ | Incomplete error handling |
| GET | `/api/activity/timeline` | ❌ | ❌ | ✅ | - |
| GET | `/api/fills` | ❌ | ❌ | ✅ | - |
| GET | `/api/fills/order/:orderId` | ❌ | ❌ | ✅ | - |
| GET | `/api/analytics/summary` | ❌ | ❌ | ✅ | - |
| GET | `/api/uae/stocks` | ❌ | ❌ | ✅ | - |
| GET | `/api/uae/summary` | ❌ | ❌ | ✅ | - |
| GET | `/api/uae/info` | ❌ | ❌ | ✅ | - |
| GET | `/api/fusion/intelligence` | ❌ | ❌ | ✅ | - |
| GET | `/api/fusion/market-data` | ❌ | ❌ | ✅ | - |
| GET | `/api/risk/settings` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/risk/settings` | ❌ | ❌ | ✅ | Missing input validation; CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/risk/kill-switch` | ❌ | ❌ | ✅ | Missing input validation; CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/risk/close-all` | ❌ | ❌ | ✅ | Missing input validation; CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/risk/emergency-liquidate` | ❌ | ❌ | ✅ | Missing input validation; CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/trading-sessions/all` | ❌ | ❌ | ✅ | - |
| GET | `/api/trading-sessions/:exchange` | ❌ | ❌ | ✅ | - |
| GET | `/api/trading-sessions/:exchange/is-open` | ❌ | ❌ | ✅ | - |
| GET | `/api/trading-sessions/:exchange/next-open` | ❌ | ❌ | ✅ | - |
| GET | `/api/trading-sessions/:exchange/volatility` | ❌ | ❌ | ✅ | - |
| GET | `/api/feeds` | ✅ | ❌ | ❌ | Incomplete error handling |
| GET | `/api/cmc/listings` | ❌ | ❌ | ✅ | - |
| GET | `/api/cmc/quotes` | ❌ | ❌ | ✅ | - |
| GET | `/api/cmc/global` | ❌ | ✅ | ✅ | - |
| GET | `/api/cmc/search` | ❌ | ✅ | ✅ | - |
| GET | `/api/news/headlines` | ❌ | ✅ | ✅ | - |
| GET | `/api/news/search` | ❌ | ✅ | ✅ | - |
| GET | `/api/news/market` | ❌ | ❌ | ✅ | - |
| GET | `/api/news/crypto` | ❌ | ❌ | ✅ | - |
| POST | `/api/alpaca-trading/execute` | ❌ | ✅ | ✅ | - |
| POST | `/api/alpaca-trading/close/:symbol` | ❌ | ✅ | ✅ | - |
| POST | `/api/alpaca-trading/analyze` | ❌ | ✅ | ✅ | - |
| POST | `/api/alpaca-trading/analyze-execute` | ❌ | ✅ | ✅ | - |
| POST | `/api/alpaca-trading/stop-all` | ❌ | ❌ | ✅ | Missing input validation |
| POST | `/api/orchestration/start` | ❌ | ❌ | ✅ | Missing input validation |
| POST | `/api/orchestration/stop` | ❌ | ❌ | ✅ | Missing input validation |
| PUT | `/api/orchestration/config` | ❌ | ❌ | ✅ | Missing input validation |
| GET | `/api/orchestration/logs` | ❌ | ❌ | ✅ | - |
| GET | `/api/orchestration/logs/errors` | ❌ | ❌ | ✅ | - |
| GET | `/api/orchestration/events` | ❌ | ❌ | ✅ | - |
| POST | `/api/orchestration/reset-stats` | ❌ | ❌ | ✅ | Missing input validation |
| GET | `/api/performance/metrics` | ❌ | ❌ | ✅ | - |
| GET | `/api/universe/stats` | ✅ | ❌ | ✅ | - |
| GET | `/api/universe/symbols` | ✅ | ❌ | ✅ | - |
| GET | `/api/universe/search` | ✅ | ✅ | ✅ | - |
| GET | `/api/universe/check/:symbol` | ✅ | ❌ | ✅ | - |
| POST | `/api/universe/sync` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/universe/sync-now` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/candidates` | ❌ | ❌ | ✅ | - |
| GET | `/api/watchlist` | ❌ | ❌ | ✅ | - |
| POST | `/api/debate/sessions` | ✅ | ✅ | ✅ | - |
| GET | `/api/debate/sessions` | ✅ | ✅ | ✅ | - |
| GET | `/api/debate/sessions/:id` | ✅ | ✅ | ✅ | - |
| GET | `/api/competition/traders` | ✅ | ✅ | ✅ | - |
| POST | `/api/competition/traders` | ✅ | ✅ | ✅ | - |
| GET | `/api/competition/traders/:id` | ✅ | ✅ | ✅ | - |
| PATCH | `/api/competition/traders/:id` | ✅ | ✅ | ✅ | - |
| GET | `/api/competition/runs` | ✅ | ✅ | ✅ | - |
| POST | `/api/competition/runs` | ✅ | ✅ | ✅ | - |
| GET | `/api/competition/runs/:id` | ✅ | ✅ | ✅ | - |
| PATCH | `/api/competition/runs/:id` | ✅ | ✅ | ✅ | - |
| POST | `/api/competition/runs/:id/scores` | ✅ | ✅ | ✅ | - |
| POST | `/api/arena/run` | ✅ | ✅ | ✅ | - |
| GET | `/api/arena/runs` | ✅ | ❌ | ✅ | - |
| GET | `/api/arena/runs/:id` | ✅ | ✅ | ✅ | - |
| GET | `/api/arena/leaderboard` | ✅ | ❌ | ✅ | - |
| GET | `/api/arena/profiles` | ✅ | ❌ | ✅ | - |
| POST | `/api/arena/profiles` | ✅ | ✅ | ✅ | - |
| GET | `/api/arena/profiles/:id` | ✅ | ✅ | ✅ | - |
| PATCH | `/api/arena/profiles/:id` | ✅ | ❌ | ✅ | Missing input validation |
| DELETE | `/api/arena/profiles/:id` | ✅ | ✅ | ✅ | - |
| GET | `/api/arena/stats` | ✅ | ❌ | ✅ | - |
| GET | `/api/tools/` | ✅ | ❌ | ✅ | - |
| GET | `/api/tools/schemas` | ✅ | ✅ | ✅ | - |
| POST | `/api/tools/invoke` | ✅ | ✅ | ✅ | - |
| GET | `/api/tools/invocations` | ✅ | ❌ | ✅ | - |
| POST | `/api/jina/embeddings` | ✅ | ✅ | ✅ | - |
| GET | `/api/jina/read` | ✅ | ✅ | ✅ | - |
| GET | `/api/jina/search` | ✅ | ✅ | ✅ | - |
| POST | `/api/jina/rerank` | ✅ | ✅ | ✅ | - |
| POST | `/api/jina/semantic-search` | ✅ | ✅ | ✅ | - |
| GET | `/api/macro/indicators` | ✅ | ✅ | ✅ | - |
| GET | `/api/macro/indicators/:id` | ✅ | ✅ | ✅ | - |
| GET | `/api/macro/category/:category` | ✅ | ✅ | ✅ | - |
| GET | `/api/macro/summary` | ✅ | ❌ | ✅ | - |
| POST | `/api/macro/refresh` | ✅ | ❌ | ✅ | Missing input validation |
| POST | `/api/macro/refresh/all` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/macro/regime` | ✅ | ❌ | ✅ | - |
| GET | `/api/macro/series` | ✅ | ❌ | ✅ | - |
| POST | `/api/enrichment/run/:jobName` | ✅ | ❌ | ✅ | Missing input validation |
| GET | `/api/enrichment/stats` | ✅ | ❌ | ✅ | - |
| GET | `/api/portfolio-snapshot/snapshot` | ✅ | ❌ | ❌ | Incomplete error handling |

### Strategies

| Method | Path | Auth | Validation | Error Handling | Issues |
|--------|------|------|------------|----------------|--------|
| GET | `/api/strategies` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/strategies/:id` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| PATCH | `/api/strategies/:id` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies/:id/toggle` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies/:id/start` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies/:id/stop` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/strategies/moving-average/schema` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies/moving-average/backtest` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies/moving-average/ai-validate` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/strategies/mean-reversion/schema` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies/mean-reversion/backtest` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies/mean-reversion/signal` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/strategies/momentum/schema` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies/momentum/backtest` | ❌ | ❌ | ✅ | Missing input validation; CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies/momentum/signal` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/strategies/all-schemas` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies/backtest` | ❌ | ✅ | ❌ | Incomplete error handling; CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies/:id/start` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/strategies/:id/stop` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/strategies/:id/status` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/strategies/versions` | ✅ | ✅ | ✅ | - |
| POST | `/api/strategies/versions` | ✅ | ✅ | ✅ | - |
| GET | `/api/strategies/versions/:id` | ✅ | ✅ | ✅ | - |
| PATCH | `/api/strategies/versions/:id` | ✅ | ✅ | ✅ | - |
| POST | `/api/strategies/versions/:id/activate` | ✅ | ✅ | ❌ | Incomplete error handling |
| POST | `/api/strategies/versions/:id/archive` | ✅ | ✅ | ✅ | - |
| GET | `/api/strategies/versions/:strategyId/latest` | ✅ | ✅ | ✅ | - |
| GET | `/api/strategies/:id/performance` | ✅ | ✅ | ❌ | Incomplete error handling |

### Trading

| Method | Path | Auth | Validation | Error Handling | Issues |
|--------|------|------|------------|----------------|--------|
| GET | `/api/orders/unreal` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/orders/cleanup` | ❌ | ❌ | ✅ | Missing input validation; CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/orders/reconcile` | ❌ | ❌ | ✅ | Missing input validation; CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/orders/execution-engine/status` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/trades` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/trades/enriched` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/trades/symbols` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/trades/:id` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/trades/:id/enriched` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/trades` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/positions/snapshot` | ❌ | ❌ | ❌ | Incomplete error handling; CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/positions` | ✅ | ❌ | ✅ | - |
| GET | `/api/positions/broker` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/positions/:id` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/positions` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| PATCH | `/api/positions/:id` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| DELETE | `/api/positions/:id` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/positions/reconcile` | ❌ | ❌ | ✅ | Missing input validation; CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/positions/reconcile/status` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/trades/backfill-prices` | ❌ | ❌ | ✅ | Missing input validation; CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/orders` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/orders/sync` | ❌ | ❌ | ✅ | Missing input validation; CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/orders/recent` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/orders/:id` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/positions` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/alpaca/orders` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| POST | `/api/alpaca/orders` | ❌ | ✅ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| DELETE | `/api/alpaca/orders/:orderId` | ❌ | ❌ | ✅ | CRITICAL: Sensitive endpoint without authentication |
| GET | `/api/backtests/:id/trades` | ✅ | ❌ | ✅ | - |

## Critical Issues

1. GET /api/orders/unreal: CRITICAL: Sensitive endpoint without authentication
2. POST /api/orders/cleanup: CRITICAL: Sensitive endpoint without authentication
3. POST /api/orders/reconcile: CRITICAL: Sensitive endpoint without authentication
4. GET /api/orders/execution-engine/status: CRITICAL: Sensitive endpoint without authentication
5. GET /api/strategies: CRITICAL: Sensitive endpoint without authentication
6. GET /api/strategies/:id: CRITICAL: Sensitive endpoint without authentication
7. POST /api/strategies: CRITICAL: Sensitive endpoint without authentication
8. PATCH /api/strategies/:id: CRITICAL: Sensitive endpoint without authentication
9. POST /api/strategies/:id/toggle: CRITICAL: Sensitive endpoint without authentication
10. POST /api/strategies/:id/start: CRITICAL: Sensitive endpoint without authentication
11. POST /api/strategies/:id/stop: CRITICAL: Sensitive endpoint without authentication
12. GET /api/strategies/moving-average/schema: CRITICAL: Sensitive endpoint without authentication
13. POST /api/strategies/moving-average/backtest: CRITICAL: Sensitive endpoint without authentication
14. POST /api/strategies/moving-average/ai-validate: CRITICAL: Sensitive endpoint without authentication
15. GET /api/strategies/mean-reversion/schema: CRITICAL: Sensitive endpoint without authentication
16. POST /api/strategies/mean-reversion/backtest: CRITICAL: Sensitive endpoint without authentication
17. POST /api/strategies/mean-reversion/signal: CRITICAL: Sensitive endpoint without authentication
18. GET /api/strategies/momentum/schema: CRITICAL: Sensitive endpoint without authentication
19. POST /api/strategies/momentum/backtest: CRITICAL: Sensitive endpoint without authentication
20. POST /api/strategies/momentum/signal: CRITICAL: Sensitive endpoint without authentication
21. GET /api/strategies/all-schemas: CRITICAL: Sensitive endpoint without authentication
22. POST /api/strategies/backtest: CRITICAL: Sensitive endpoint without authentication
23. GET /api/trades: CRITICAL: Sensitive endpoint without authentication
24. GET /api/trades/enriched: CRITICAL: Sensitive endpoint without authentication
25. GET /api/trades/symbols: CRITICAL: Sensitive endpoint without authentication
26. GET /api/trades/:id: CRITICAL: Sensitive endpoint without authentication
27. GET /api/trades/:id/enriched: CRITICAL: Sensitive endpoint without authentication
28. POST /api/trades: CRITICAL: Sensitive endpoint without authentication
29. GET /api/positions/snapshot: CRITICAL: Sensitive endpoint without authentication
30. GET /api/positions/broker: CRITICAL: Sensitive endpoint without authentication
31. GET /api/positions/:id: CRITICAL: Sensitive endpoint without authentication
32. POST /api/positions: CRITICAL: Sensitive endpoint without authentication
33. PATCH /api/positions/:id: CRITICAL: Sensitive endpoint without authentication
34. DELETE /api/positions/:id: CRITICAL: Sensitive endpoint without authentication
35. POST /api/positions/reconcile: CRITICAL: Sensitive endpoint without authentication
36. GET /api/positions/reconcile/status: CRITICAL: Sensitive endpoint without authentication
37. POST /api/trades/backfill-prices: CRITICAL: Sensitive endpoint without authentication
38. GET /api/orders: CRITICAL: Sensitive endpoint without authentication
39. POST /api/orders/sync: CRITICAL: Sensitive endpoint without authentication
40. GET /api/orders/recent: CRITICAL: Sensitive endpoint without authentication
41. GET /api/orders/:id: CRITICAL: Sensitive endpoint without authentication
42. GET /api/risk/settings: CRITICAL: Sensitive endpoint without authentication
43. POST /api/risk/settings: CRITICAL: Sensitive endpoint without authentication
44. POST /api/risk/kill-switch: CRITICAL: Sensitive endpoint without authentication
45. POST /api/risk/close-all: CRITICAL: Sensitive endpoint without authentication
46. POST /api/risk/emergency-liquidate: CRITICAL: Sensitive endpoint without authentication
47. GET /api/alpaca/account: CRITICAL: Sensitive endpoint without authentication
48. GET /api/alpaca/positions: CRITICAL: Sensitive endpoint without authentication
49. GET /api/alpaca/orders: CRITICAL: Sensitive endpoint without authentication
50. POST /api/alpaca/orders: CRITICAL: Sensitive endpoint without authentication
51. DELETE /api/alpaca/orders/:orderId: CRITICAL: Sensitive endpoint without authentication
52. GET /api/alpaca/assets: CRITICAL: Sensitive endpoint without authentication
53. GET /api/alpaca/allocations: CRITICAL: Sensitive endpoint without authentication
54. POST /api/alpaca/rebalance/preview: CRITICAL: Sensitive endpoint without authentication
55. POST /api/alpaca/rebalance/execute: CRITICAL: Sensitive endpoint without authentication
56. GET /api/alpaca/rebalance/suggestions: CRITICAL: Sensitive endpoint without authentication
57. GET /api/alpaca/assets/search: CRITICAL: Sensitive endpoint without authentication
58. GET /api/alpaca/bars: CRITICAL: Sensitive endpoint without authentication
59. GET /api/alpaca/snapshots: CRITICAL: Sensitive endpoint without authentication
60. GET /api/alpaca/clock: CRITICAL: Sensitive endpoint without authentication
61. GET /api/alpaca/market-status: CRITICAL: Sensitive endpoint without authentication
62. GET /api/alpaca/can-trade-extended/:symbol: CRITICAL: Sensitive endpoint without authentication
63. GET /api/alpaca/portfolio-history: CRITICAL: Sensitive endpoint without authentication
64. GET /api/alpaca/top-stocks: CRITICAL: Sensitive endpoint without authentication
65. GET /api/alpaca/top-crypto: CRITICAL: Sensitive endpoint without authentication
66. GET /api/alpaca/top-etfs: CRITICAL: Sensitive endpoint without authentication
67. POST /api/alpaca/validate-order: CRITICAL: Sensitive endpoint without authentication
68. POST /api/strategies/:id/start: CRITICAL: Sensitive endpoint without authentication
69. POST /api/strategies/:id/stop: CRITICAL: Sensitive endpoint without authentication
70. GET /api/strategies/:id/status: CRITICAL: Sensitive endpoint without authentication
71. GET /api/orders/unreal: Trading endpoint is public!
72. POST /api/orders/cleanup: Trading endpoint is public!
73. POST /api/orders/reconcile: Trading endpoint is public!
74. GET /api/orders/execution-engine/status: Trading endpoint is public!
75. GET /api/trades: Trading endpoint is public!
76. GET /api/trades/enriched: Trading endpoint is public!
77. GET /api/trades/symbols: Trading endpoint is public!
78. GET /api/trades/:id: Trading endpoint is public!
79. GET /api/trades/:id/enriched: Trading endpoint is public!
80. POST /api/trades: Trading endpoint is public!
81. GET /api/positions/snapshot: Trading endpoint is public!
82. GET /api/positions/broker: Trading endpoint is public!
83. GET /api/positions/:id: Trading endpoint is public!
84. POST /api/positions: Trading endpoint is public!
85. PATCH /api/positions/:id: Trading endpoint is public!
86. DELETE /api/positions/:id: Trading endpoint is public!
87. POST /api/positions/reconcile: Trading endpoint is public!
88. GET /api/positions/reconcile/status: Trading endpoint is public!
89. POST /api/trades/backfill-prices: Trading endpoint is public!
90. GET /api/orders: Trading endpoint is public!
91. POST /api/orders/sync: Trading endpoint is public!
92. GET /api/orders/recent: Trading endpoint is public!
93. GET /api/orders/:id: Trading endpoint is public!
94. GET /api/alpaca/positions: Trading endpoint is public!
95. GET /api/alpaca/orders: Trading endpoint is public!
96. POST /api/alpaca/orders: Trading endpoint is public!
97. DELETE /api/alpaca/orders/:orderId: Trading endpoint is public!

## Medium Priority Issues

1. POST /api/auth/logout: Missing input validation
2. POST /api/agent/toggle: Missing input validation
3. POST /api/autonomous/start: Missing input validation
4. POST /api/autonomous/stop: Missing input validation
5. POST /api/autonomous/kill-switch: Missing input validation
6. PUT /api/autonomous/risk-limits: Missing input validation
7. POST /api/agent/market-analysis/refresh: Missing input validation
8. POST /api/agent/set-limits: Missing input validation
9. POST /api/agent/auto-start: Missing input validation
10. POST /api/autonomous/execute-trades: Incomplete error handling
11. POST /api/autonomous/cancel-stale-orders: Missing input validation
12. POST /api/autonomous/cancel-all-orders: Missing input validation
13. POST /api/autonomous/sync-positions: Missing input validation
14. POST /api/autonomous/close-all-positions: Missing input validation
15. POST /api/orders/cleanup: Missing input validation
16. POST /api/orders/reconcile: Missing input validation
17. POST /api/strategies/momentum/backtest: Missing input validation
18. POST /api/strategies/backtest: Incomplete error handling
19. GET /api/positions/snapshot: Incomplete error handling
20. POST /api/positions/reconcile: Missing input validation
21. GET /api/ai-decisions/enriched: Incomplete error handling
22. POST /api/trades/backfill-prices: Missing input validation
23. POST /api/orders/sync: Missing input validation
24. POST /api/ai/analyze: Incomplete error handling
25. POST /api/ai/cache/clear: Missing input validation
26. POST /api/ai/cache/clear/:role: Missing input validation
27. POST /api/ai/cache/reset-stats: Missing input validation
28. GET /api/connectors/status: Incomplete error handling
29. POST /api/risk/settings: Missing input validation
30. POST /api/risk/kill-switch: Missing input validation
31. POST /api/risk/close-all: Missing input validation
32. POST /api/risk/emergency-liquidate: Missing input validation
33. POST /api/alpaca/validate-order: Missing input validation
34. GET /api/feeds: Incomplete error handling
35. POST /api/alpaca-trading/stop-all: Missing input validation
36. POST /api/orchestration/start: Missing input validation
37. POST /api/orchestration/stop: Missing input validation
38. PUT /api/orchestration/config: Missing input validation
39. POST /api/orchestration/reset-stats: Missing input validation
40. POST /api/webhooks/test: Missing input validation
41. GET /api/webhooks/stats/overview: Incomplete error handling
42. GET /api/webhooks/history/deliveries: Incomplete error handling
43. POST /api/admin/api-cache/purge: Missing input validation
44. POST /api/admin/provider/:provider/force-refresh: Missing input validation
45. PATCH /api/admin/provider/:provider/toggle: Missing input validation
46. PUT /api/admin/valyu-budget: Missing input validation
47. GET /api/admin/connectors-health: Incomplete error handling
48. PUT /api/admin/ai-config: Missing input validation
49. PUT /api/admin/settings/:namespace/:key: Missing input validation
50. POST /api/admin/orchestrator/pause: Missing input validation
51. POST /api/admin/orchestrator/resume: Missing input validation
52. POST /api/admin/orchestrator/run-now: Missing input validation
53. PUT /api/admin/orchestrator/config: Missing input validation
54. POST /api/admin/orchestrator/reset-stats: Missing input validation
55. POST /api/admin/jobs/sync-positions: Missing input validation
56. POST /api/admin/universe/refresh: Missing input validation
57. POST /api/admin/universe/exclude/:symbol: Missing input validation
58. POST /api/admin/liquidity/compute: Missing input validation
59. POST /api/admin/fundamentals/fetch: Missing input validation
60. POST /api/admin/candidates/generate: Missing input validation
61. POST /api/admin/candidates/:symbol/reject: Missing input validation
62. POST /api/admin/candidates/:symbol/watchlist: Missing input validation
63. POST /api/admin/enforcement/check: Missing input validation
64. POST /api/admin/enforcement/reset-stats: Missing input validation
65. POST /api/universe/sync: Missing input validation
66. POST /api/universe/sync-now: Missing input validation
67. POST /api/backtests/run: Incomplete error handling
68. POST /api/strategies/versions/:id/activate: Incomplete error handling
69. GET /api/strategies/:id/performance: Incomplete error handling
70. PATCH /api/arena/profiles/:id: Missing input validation
71. GET /api/jina/health: Incomplete error handling
72. POST /api/macro/refresh: Missing input validation
73. POST /api/macro/refresh/all: Missing input validation
74. POST /api/enrichment/run/:jobName: Missing input validation
75. GET /api/portfolio-snapshot/snapshot: Incomplete error handling

## Recommendations

1. Consider adding authentication to more endpoints for better security
2. Address critical security issues immediately
3. Add input validation to POST/PUT/PATCH endpoints
4. URGENT: Trading endpoints should require authentication

## Public Endpoints

| Method | Path | Category |
|--------|------|----------|
| POST | `/api/auth/signup` | Authentication |
| POST | `/api/auth/login` | Authentication |
| POST | `/api/auth/logout` | Authentication |
| GET | `/api/auth/me` | Authentication |
| GET | `/api/events` | Other |
| POST | `/api/strategy-config` | Other |
| POST | `/api/strategy-validate` | Other |
| GET | `/api/ai-decisions/history` | Other |
| POST | `/api/ai-decisions` | Other |
| GET | `/api/ai-decisions/enriched` | Other |
| GET | `/api/activity/timeline` | Other |
| GET | `/api/fills` | Other |
| GET | `/api/fills/order/:orderId` | Other |
| GET | `/api/analytics/summary` | Other |
| GET | `/api/uae/stocks` | Other |
| GET | `/api/uae/summary` | Other |
| GET | `/api/uae/info` | Other |
| GET | `/api/fusion/intelligence` | Other |
| GET | `/api/fusion/market-data` | Other |
| GET | `/api/risk/settings` | Other |
| POST | `/api/risk/settings` | Other |
| POST | `/api/risk/kill-switch` | Other |
| POST | `/api/risk/close-all` | Other |
| POST | `/api/risk/emergency-liquidate` | Other |
| GET | `/api/trading-sessions/all` | Other |
| GET | `/api/trading-sessions/:exchange` | Other |
| GET | `/api/trading-sessions/:exchange/is-open` | Other |
| GET | `/api/trading-sessions/:exchange/next-open` | Other |
| GET | `/api/trading-sessions/:exchange/volatility` | Other |
| GET | `/api/cmc/listings` | Other |
| GET | `/api/cmc/quotes` | Other |
| GET | `/api/cmc/global` | Other |
| GET | `/api/cmc/search` | Other |
| GET | `/api/news/headlines` | Other |
| GET | `/api/news/search` | Other |
| GET | `/api/news/market` | Other |
| GET | `/api/news/crypto` | Other |
| POST | `/api/alpaca-trading/execute` | Other |
| POST | `/api/alpaca-trading/close/:symbol` | Other |
| POST | `/api/alpaca-trading/analyze` | Other |
| POST | `/api/alpaca-trading/analyze-execute` | Other |
| POST | `/api/alpaca-trading/stop-all` | Other |
| POST | `/api/orchestration/start` | Other |
| POST | `/api/orchestration/stop` | Other |
| PUT | `/api/orchestration/config` | Other |
| GET | `/api/orchestration/logs` | Other |
| GET | `/api/orchestration/logs/errors` | Other |
| GET | `/api/orchestration/events` | Other |
| POST | `/api/orchestration/reset-stats` | Other |
| GET | `/api/performance/metrics` | Other |
| GET | `/api/candidates` | Other |
| GET | `/api/watchlist` | Other |
| GET | `/api/orders/unreal` | Trading |
| POST | `/api/orders/cleanup` | Trading |
| POST | `/api/orders/reconcile` | Trading |
| GET | `/api/orders/execution-engine/status` | Trading |
| GET | `/api/trades` | Trading |
| GET | `/api/trades/enriched` | Trading |
| GET | `/api/trades/symbols` | Trading |
| GET | `/api/trades/:id` | Trading |
| GET | `/api/trades/:id/enriched` | Trading |
| POST | `/api/trades` | Trading |
| GET | `/api/positions/snapshot` | Trading |
| GET | `/api/positions/broker` | Trading |
| GET | `/api/positions/:id` | Trading |
| POST | `/api/positions` | Trading |
| PATCH | `/api/positions/:id` | Trading |
| DELETE | `/api/positions/:id` | Trading |
| POST | `/api/positions/reconcile` | Trading |
| GET | `/api/positions/reconcile/status` | Trading |
| POST | `/api/trades/backfill-prices` | Trading |
| GET | `/api/orders` | Trading |
| POST | `/api/orders/sync` | Trading |
| GET | `/api/orders/recent` | Trading |
| GET | `/api/orders/:id` | Trading |
| GET | `/api/alpaca/positions` | Trading |
| GET | `/api/alpaca/orders` | Trading |
| POST | `/api/alpaca/orders` | Trading |
| DELETE | `/api/alpaca/orders/:orderId` | Trading |
| GET | `/api/strategies` | Strategies |
| GET | `/api/strategies/:id` | Strategies |
| POST | `/api/strategies` | Strategies |
| PATCH | `/api/strategies/:id` | Strategies |
| POST | `/api/strategies/:id/toggle` | Strategies |
| POST | `/api/strategies/:id/start` | Strategies |
| POST | `/api/strategies/:id/stop` | Strategies |
| GET | `/api/strategies/moving-average/schema` | Strategies |
| POST | `/api/strategies/moving-average/backtest` | Strategies |
| POST | `/api/strategies/moving-average/ai-validate` | Strategies |
| GET | `/api/strategies/mean-reversion/schema` | Strategies |
| POST | `/api/strategies/mean-reversion/backtest` | Strategies |
| POST | `/api/strategies/mean-reversion/signal` | Strategies |
| GET | `/api/strategies/momentum/schema` | Strategies |
| POST | `/api/strategies/momentum/backtest` | Strategies |
| POST | `/api/strategies/momentum/signal` | Strategies |
| GET | `/api/strategies/all-schemas` | Strategies |
| POST | `/api/strategies/backtest` | Strategies |
| POST | `/api/strategies/:id/start` | Strategies |
| POST | `/api/strategies/:id/stop` | Strategies |
| GET | `/api/strategies/:id/status` | Strategies |
| GET | `/api/crypto/markets` | Market Data |
| GET | `/api/crypto/prices` | Market Data |
| GET | `/api/crypto/chart/:coinId` | Market Data |
| GET | `/api/crypto/trending` | Market Data |
| GET | `/api/crypto/global` | Market Data |
| GET | `/api/crypto/search` | Market Data |
| GET | `/api/stock/quote/:symbol` | Market Data |
| GET | `/api/stock/quotes` | Market Data |
| GET | `/api/stock/candles/:symbol` | Market Data |
| GET | `/api/stock/profile/:symbol` | Market Data |
| GET | `/api/stock/search` | Market Data |
| GET | `/api/stock/news` | Market Data |
| GET | `/api/news/stock/:symbol` | Market Data |
| GET | `/api/uae/status` | Health |
| GET | `/api/connectors/status` | Health |
| GET | `/api/fusion/status` | Health |
| GET | `/api/alpaca-trading/status` | Health |
| GET | `/api/orchestration/status` | Health |
| POST | `/api/ai/analyze` | AI |
| GET | `/api/ai/status` | AI |
| GET | `/api/ai/cache/stats` | AI |
| POST | `/api/ai/cache/clear` | AI |
| POST | `/api/ai/cache/clear/:role` | AI |
| POST | `/api/ai/cache/reset-stats` | AI |
| GET | `/api/alpaca/account` | Alpaca Integration |
| GET | `/api/alpaca/assets` | Alpaca Integration |
| GET | `/api/alpaca/allocations` | Alpaca Integration |
| POST | `/api/alpaca/rebalance/preview` | Alpaca Integration |
| POST | `/api/alpaca/rebalance/execute` | Alpaca Integration |
| GET | `/api/alpaca/rebalance/suggestions` | Alpaca Integration |
| GET | `/api/alpaca/assets/search` | Alpaca Integration |
| GET | `/api/alpaca/bars` | Alpaca Integration |
| GET | `/api/alpaca/snapshots` | Alpaca Integration |
| GET | `/api/alpaca/clock` | Alpaca Integration |
| GET | `/api/alpaca/market-status` | Alpaca Integration |
| GET | `/api/alpaca/can-trade-extended/:symbol` | Alpaca Integration |
| GET | `/api/alpaca/portfolio-history` | Alpaca Integration |
| GET | `/api/alpaca/top-stocks` | Alpaca Integration |
| GET | `/api/alpaca/top-crypto` | Alpaca Integration |
| GET | `/api/alpaca/top-etfs` | Alpaca Integration |
| POST | `/api/alpaca/validate-order` | Alpaca Integration |
