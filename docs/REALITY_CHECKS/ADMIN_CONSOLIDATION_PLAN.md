# Admin Consolidation Plan

This document outlines how all admin functionality is unified under the existing AdminHubScreen.

## Current State

### Primary Admin Entry Point
- **File**: `client/screens/AdminHubScreen.tsx` (2980 lines)
- **Navigation**: `client/navigation/AdminStackNavigator.tsx`
- **Server Registry**: `server/admin/registry.ts`

### Existing Admin Modules (13 total)

| Module ID | Section | Description | Status |
|-----------|---------|-------------|--------|
| overview | Overview | Dashboard with connector health, fusion score, API keys | WORKING |
| budgets | Providers & Budgets | API rate limits, cache, provider toggles | WORKING |
| router | LLM Router | Model routing config, call stats, fallback chains | WORKING |
| orchestrator | Orchestrator | Pause/resume, cycle management, kill switch | WORKING |
| orders | Orders | Order lifecycle, fills, sync | WORKING |
| positions | Positions | Live broker positions, P&L | WORKING |
| universe | Universe | Asset universe management, exclusions | WORKING |
| fundamentals | Fundamentals | Fundamental data scores | WORKING |
| candidates | Candidates | Trading candidate approval workflow | WORKING |
| enforcement | Enforcement | Symbol blocking, trade gates | WORKING |
| allocation | Allocation | Allocation policies, analysis | WORKING |
| rebalancer | Rebalancer | Portfolio rebalancing, dry runs | WORKING |
| observability | Observability | Traces, work queue, alerts | WORKING |

### Standalone Admin Screens (to be consolidated)

| Screen | File | Action |
|--------|------|--------|
| ApiBudgetScreen | `client/screens/ApiBudgetScreen.tsx` | MERGE into budgets module |
| ModelRouterScreen | `client/screens/ModelRouterScreen.tsx` | MERGE into router module |
| AdminScreen | `client/screens/AdminScreen.tsx` | DEPRECATED - redirect to AdminHub |

---

## Consolidation Plan

### Phase 1: Add Missing Section 3 Modules

Add 4 new sections to AdminHubScreen:

```typescript
type AdminSection = 
  | "overview" 
  | "budgets" 
  | "router" 
  | "orchestrator"
  | "orders"
  | "positions"
  | "universe" 
  | "fundamentals" 
  | "candidates" 
  | "enforcement" 
  | "allocation" 
  | "rebalancer" 
  | "observability"
  // NEW SECTIONS
  | "debate"      // AI Debate Arena
  | "competition" // Competition Mode
  | "strategies"  // Strategy Studio
  | "tools";      // Tool Router Registry
```

New sidebar items:
```typescript
{ id: "debate", label: "AI Arena", icon: "users", description: "Multi-role AI debates" },
{ id: "competition", label: "Competition", icon: "award", description: "Trader competitions" },
{ id: "strategies", label: "Strategies", icon: "layers", description: "Strategy versions" },
{ id: "tools", label: "Tools", icon: "tool", description: "Tool registry & audit" },
```

### Phase 2: Module Implementations

#### DebateModule
- Start new debate sessions
- View debate history with role outputs
- See consensus decisions and order intents
- Link to executed orders

#### CompetitionModule  
- Create/manage trader profiles
- Start competition runs
- View leaderboard and scores
- Compare trader performance

#### StrategiesModule
- List strategy versions
- Activate/archive strategies
- Link to Strategy Wizard for editing
- View backtest results

#### ToolsModule
- List registered tools by category
- View tool invocation history
- See per-tool costs and failures
- Test tool execution

### Phase 3: Authentication

Add ADMIN_TOKEN guard:
```typescript
// server/routes.ts
const adminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (token === process.env.ADMIN_TOKEN) {
    return next();
  }
  // Fall back to session auth if available
  if (req.isAuthenticated?.() && req.user?.role === 'admin') {
    return next();
  }
  return res.status(401).json({ error: 'Admin access required' });
};
```

### Phase 4: Deprecate Standalone Screens

1. ApiBudgetScreen - Mark deprecated, add redirect notice
2. ModelRouterScreen - Mark deprecated, add redirect notice  
3. AdminScreen - Redirect to AdminHub

---

## Route Structure

### Current Routes
- `/admin` - AdminHub (main entry)

### API Endpoints Used by AdminHub

All endpoints are authenticated:

```
GET  /api/admin/connectors-health
GET  /api/admin/data-fusion-status
GET  /api/admin/ai-config
PUT  /api/admin/ai-config
GET  /api/admin/api-keys-status
GET  /api/admin/provider-status
POST /api/admin/api-cache/purge
PATCH /api/admin/provider/:provider/toggle
POST /api/admin/provider/:provider/force-refresh
GET  /api/admin/model-router/configs
PUT  /api/admin/model-router/configs/:role
GET  /api/admin/model-router/stats
GET  /api/admin/model-router/calls
GET  /api/admin/orchestrator/status
POST /api/admin/orchestrator/pause
POST /api/admin/orchestrator/resume
POST /api/admin/orchestrator/run-now
POST /api/admin/orchestrator/reset-stats
GET  /api/orders
POST /api/orders/sync
GET  /api/positions
GET  /api/universe/*
GET  /api/fundamentals/*
GET  /api/candidates/*
GET  /api/enforcement/*
GET  /api/allocation/*
GET  /api/rebalancer/*
GET  /api/admin/work-items
GET  /api/admin/traces/*
GET  /api/admin/alerts

# NEW ENDPOINTS (Section 3)
GET  /api/debate/sessions
POST /api/debate/sessions
GET  /api/debate/sessions/:id
GET  /api/tools
POST /api/tools/invoke
GET  /api/tools/invocations
GET  /api/competition/traders
POST /api/competition/traders
GET  /api/competition/runs
POST /api/competition/runs
GET  /api/strategies/versions
POST /api/strategies/versions
```

---

## Implementation Checklist

- [ ] Add 4 new AdminSection types
- [ ] Add 4 new sidebar items
- [ ] Implement DebateModule component
- [ ] Implement CompetitionModule component
- [ ] Implement StrategiesModule component
- [ ] Implement ToolsModule component
- [ ] Register modules in server/admin/registry.ts
- [ ] Add ADMIN_TOKEN authentication
- [ ] Test all modules end-to-end
- [ ] Update ADMIN_DASHBOARD.md

---

*Last Updated: December 16, 2025*
