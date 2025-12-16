# Competitor Feature Map - Reality Check

This document maps features from competitor platforms to our current implementation.

## Feature Status Legend
- **YES**: Fully implemented with file paths
- **PARTIAL**: Partially implemented, needs enhancement
- **NO**: Not implemented yet

---

## 1. Capitalise.ai Patterns

| Feature | Status | Our Implementation | File Paths |
|---------|--------|-------------------|------------|
| Natural language strategy creation | PARTIAL | Strategy Wizard UI exists | `client/screens/StrategyWizard/*` |
| Rule-based triggers (price, indicator) | PARTIAL | Trigger conditions screen exists | `client/screens/StrategyWizard/TriggerConditionsScreen.tsx` |
| Backtesting | YES | Backtest engine + UI | `server/services/backtesting/*`, `client/screens/BacktestScreen.tsx` |
| Paper trading execution | YES | Alpaca paper trading | `server/trading/alpaca-adapter.ts` |
| Strategy versioning | YES | `strategy_versions` table | `shared/schema.ts`, `server/routes/strategies.ts` |
| Kill switch | YES | Orchestrator pause/resume | `server/trading/orchestrator.ts`, AdminHub Orchestrator module |
| Max orders/day limit | PARTIAL | Work queue exists, needs guard | `server/lib/work-queue.ts` |
| Multi-asset support | YES | Universe management | `server/services/symbolMaster.ts`, AdminHub Universe module |

## 2. AI-Trader (HKUDS) Patterns

| Feature | Status | Our Implementation | File Paths |
|---------|--------|-------------------|------------|
| Multi-LLM debate/voting | YES | Debate Arena with 5 roles + judge | `server/ai/debateArena.ts` |
| Temporal data filtering | NO | Needs `asOf` timestamp enforcement | - |
| Future info leakage prevention | NO | Needs publishedAt validation | - |
| Replay/backtest with historical data | PARTIAL | Backtest engine exists, needs temporal replay | `server/services/backtesting/*` |
| Decision logging | YES | Decisions table + LLM calls logged | `shared/schema.ts` |
| Confidence scoring | YES | Role outputs include confidence | `server/ai/debateArena.ts` |

## 3. Lean/QuantConnect Patterns

| Feature | Status | Our Implementation | File Paths |
|---------|--------|-------------------|------------|
| Algorithm framework | YES | Trading algorithms + orchestrator | `server/trading/algorithms/*` |
| Portfolio construction | YES | Allocation policies | `server/services/allocation-service.ts` |
| Risk management | YES | Risk manager role + enforcement | `server/ai/debateArena.ts`, `server/services/enforcement-gate.ts` |
| Data normalization | YES | Data fusion service | `server/services/data-fusion-service.ts` |
| Event-driven architecture | YES | Work queue + NATS (planned) | `server/lib/work-queue.ts` |
| Brokerage abstraction | YES | Alpaca connector pattern | `server/connectors/alpaca.ts` |

## 4. Alpaca MCP Server Patterns

| Feature | Status | Our Implementation | File Paths |
|---------|--------|-------------------|------------|
| Tool registry | YES | MCP-style tool router | `server/ai/toolRouter.ts` |
| Schema validation (Zod) | YES | All tools have Zod schemas | `server/ai/toolRouter.ts` |
| Audit logging | YES | `tool_invocations` table | `shared/schema.ts`, `server/storage.ts` |
| Category-based organization | YES | broker, market_data categories | `server/ai/toolRouter.ts` |
| SSRF protection | NO | Needs URL allowlist | - |
| Secrets redaction | PARTIAL | Env vars masked, needs log redaction | - |

## 5. Jina AI Patterns

| Feature | Status | Our Implementation | File Paths |
|---------|--------|-------------------|------------|
| Web content reading | NO | Not implemented | - |
| Search integration | NO | Not implemented | - |
| Document parsing | NO | Not implemented | - |

## 6. AI4Trade Patterns

| Feature | Status | Our Implementation | File Paths |
|---------|--------|-------------------|------------|
| Sentiment analysis | YES | HuggingFace FinBERT + social sentiment | `server/connectors/huggingface.ts`, `server/connectors/social-sentiment.ts` |
| News integration | YES | NewsAPI, GDELT connectors | `server/connectors/newsapi.ts`, `server/connectors/gdelt.ts` |
| Market data fusion | YES | Data fusion service | `server/services/data-fusion-service.ts` |
| Technical indicators | YES | Technical indicators library | `server/lib/technical-indicators.ts` |

## 7. Admin Control Plane (WordPress-style)

| Feature | Status | Our Implementation | File Paths |
|---------|--------|-------------------|------------|
| Centralized admin hub | YES | WordPress-style AdminHub | `client/screens/AdminHubScreen.tsx` |
| Module registry | YES | Server-side module registry | `server/admin/registry.ts` |
| 13 functional modules | YES | Overview, Budgets, Router, Orchestrator, Orders, Positions, Universe, Fundamentals, Candidates, Enforcement, Allocation, Rebalancer, Observability | `client/screens/AdminHubScreen.tsx` |
| RBAC | YES | Role-based access control | `server/admin/rbac.ts` |
| Admin auth guard | PARTIAL | Auth exists, needs ADMIN_TOKEN | `server/routes.ts` |

---

## Summary: What Needs Implementation

### P2.1 - Admin Consolidation
- [x] AdminHub exists with 13 modules
- [ ] Add Debate Arena module
- [ ] Add Competition module  
- [ ] Add Strategy Studio module (link to wizard)
- [ ] Add Tools module (tool registry + telemetry)
- [ ] Add ADMIN_TOKEN route guard

### P2.2 - Strategy Rules & Wizard
- [x] Strategy Wizard UI exists (20 screens)
- [x] Strategy versions table exists
- [ ] StrategySpec JSON schema with triggers
- [ ] Strategy compiler to scheduled jobs
- [ ] Safety guards (max orders, notional, cooldown)

### P2.3 - Temporal Replay
- [ ] Add `asOf` timestamp to run context
- [ ] Enforce temporal constraints in data access
- [ ] Future Info Filter for news
- [ ] Replay Runner service

### P2.4 - Tool Hardening
- [x] Tool Router with registry exists
- [ ] SSRF protection + URL allowlist
- [ ] Secrets redaction in logs
- [ ] Tool telemetry in Admin

### P2.5 - LLM Optimization
- [x] LLM Gateway with role-based routing exists
- [x] Cost tracking exists
- [ ] ModelPolicy per task type
- [ ] Caching for deterministic prompts
- [ ] Admin panic switch

---

*Last Updated: December 16, 2025*
