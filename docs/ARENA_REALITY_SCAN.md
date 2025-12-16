# Arena Reality Scan

## What Exists

### Debate Arena (`server/ai/debateArena.ts`)
- **5 Analyst Roles**: bull, bear, risk_manager, technical_analyst, fundamental_analyst
- **Judge Role**: Synthesizes all analyst opinions into final decision
- **Role Prompts**: Defined per role with specific focus areas
- **Market Context Gathering**: Uses Tool Router to fetch quotes, bars, account, positions
- **Structured Output**: JSON schema validation for role outputs
- **Persistence**: Stores debate_sessions, debate_messages, debate_consensus in DB
- **Work Queue Integration**: Can trigger order execution via workQueue.enqueue()

### API Routes (`server/routes/debate.ts`)
- `POST /api/debate/sessions` - Start a debate
- `GET /api/debate/sessions` - List sessions
- `GET /api/debate/sessions/:id` - Get debate details

### Competition Mode (`server/routes/competition.ts`)
- Trader Profiles CRUD
- Competition Runs management
- Competition Scores tracking

### Database Tables (shared/schema.ts)
| Table | Status | Purpose |
|-------|--------|---------|
| debate_sessions | EXISTS | Tracks debate runs with status, symbols, timing |
| debate_messages | EXISTS | Per-role outputs with stance, confidence, signals |
| debate_consensus | EXISTS | Final decision with order intent, risk checks |
| trader_profiles | EXISTS | AI trader configurations for competition |
| competition_runs | EXISTS | Paper/backtest competitions |
| competition_scores | EXISTS | Performance rankings per competition |

### AdminHub Modules
| Module | Status | Location |
|--------|--------|----------|
| DebateModule | EXISTS | client/screens/AdminHubScreen.tsx |
| CompetitionModule | EXISTS | client/screens/AdminHubScreen.tsx |
| StrategiesModule | EXISTS | client/screens/AdminHubScreen.tsx |
| ToolsModule | EXISTS | client/screens/AdminHubScreen.tsx |

---

## What's Missing

### 1. Cost-Aware Routing & Agent Profiles
| Missing | Priority | Description |
|---------|----------|-------------|
| ai_agent_profiles table | HIGH | Provider, model, role, mode (cheap_first/escalation_only), budget |
| Escalation Policy | HIGH | Cheap-first, escalate on disagreement/uncertainty/high-risk |
| Per-agent cost tracking | HIGH | Token usage, $ cost, latency per agent call |
| Model tiers | MEDIUM | cheap vs powerful classification in LLM router |

### 2. Outcome Links (Decision → Execution → Fill)
| Missing | Priority | Description |
|---------|----------|-------------|
| ai_outcome_links table | HIGH | decisionId → orderIntentId → brokerOrderId → fillIds |
| decisionId in order metadata | HIGH | Pass consensusId through order pipeline |
| Outcome tracking | MEDIUM | Win/loss/pending status on decisions |

### 3. Arena Coordinator Enhancements
| Missing | Priority | Description |
|---------|----------|-------------|
| ArenaCoordinator class | HIGH | Orchestrates parallel agent runs with timeouts |
| Disagreement detection | HIGH | Calculate agreement rate across agents |
| Escalation trigger | HIGH | Auto-escalate to powerful model on disagreement |
| JSON repair fallback | MEDIUM | Use cheap model to fix invalid agent outputs |

### 4. Leaderboard & Telemetry
| Missing | Priority | Description |
|---------|----------|-------------|
| Leaderboard computation | MEDIUM | Aggregate win-rate, PnL, cost-per-alpha over time windows |
| Agent performance metrics | MEDIUM | Hit-rate, avg confidence, cost efficiency |
| API endpoints for leaderboard | MEDIUM | /api/admin/arena/leaderboard |

### 5. Enhanced AdminHub Arena UI
| Missing | Priority | Description |
|---------|----------|-------------|
| Arena Overview | HIGH | Recent runs, cost today, pass/fail rates |
| Run Details view | HIGH | Agent cards, reasoning, tool calls, cost breakdown |
| Leaderboard view | MEDIUM | Rankings with time window filters |
| Profiles CRUD UI | MEDIUM | Create/edit agent profiles |

---

## File Paths Reference

### Existing Implementation
- `server/ai/debateArena.ts` - Core debate logic
- `server/routes/debate.ts` - Debate API routes
- `server/routes/competition.ts` - Competition API routes
- `server/ai/llmGateway.ts` - LLM routing with provider fallback
- `shared/schema.ts` - Database schema definitions
- `client/screens/AdminHubScreen.tsx` - Admin UI

### To Create/Modify
- `server/ai/arenaCoordinator.ts` - NEW: Cost-aware arena orchestration
- `shared/schema.ts` - ADD: ai_agent_profiles, ai_outcome_links tables
- `server/routes.ts` - ADD: /api/admin/arena/* endpoints
- `client/screens/AdminHubScreen.tsx` - ENHANCE: Arena module views

---

## Next Steps
1. Add ai_agent_profiles table with provider/model/mode fields
2. Add ai_outcome_links table for decision → order linkage
3. Create ArenaCoordinator with escalation policy
4. Enhance AdminHub Arena module with detailed views
5. Add leaderboard computation and API

*Generated: December 16, 2025*
