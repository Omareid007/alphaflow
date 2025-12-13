# Lessons Learned

> **Canonical document for patterns, anti-patterns, and retrospectives from project development.**
>
> Start here: [INDEX.md](INDEX.md) | Related: [AGENT_EXECUTION_GUIDE.md](AGENT_EXECUTION_GUIDE.md) (governance rules)

---

## Canonical References

| Topic | Go To |
|-------|-------|
| AI agent governance | [AGENT_EXECUTION_GUIDE.md](AGENT_EXECUTION_GUIDE.md) |
| Product overview | [APP_OVERVIEW.md](APP_OVERVIEW.md) |
| C4 architecture diagrams | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Test strategy | [TESTING.md](TESTING.md) |

---

## 1. Purpose & Relationship to AGENT_EXECUTION_GUIDE

This document is a **living record of insights** gathered during the development and maintenance of AI Active Trader.

### Reading Order

1. **MUST READ FIRST:** `docs/AGENT_EXECUTION_GUIDE.md` - The primary governance document
2. **MAY READ AFTER:** `docs/LESSONS_LEARNED.md` - For relevant patterns and anti-patterns

### What This Document Provides

- **Patterns to repeat:** Approaches that worked well
- **Anti-patterns to avoid:** Common pitfalls and mistakes
- **Domain-specific insights:** Trading, P&L, orchestrator, API integration lessons
- **Testing reminders:** What types of tests to add for specific change types
- **Prompt interpretation tips:** How to handle ambiguous or complex requests

### What This Document Does NOT Replace

- Tests (which prove correctness)
- Architecture docs (which explain system design)
- APP_OVERVIEW.md (which describes features and flows)
- AGENT_EXECUTION_GUIDE.md (which defines mandatory process)

---

## 2. How to Use This Document

### When Starting a New Task

1. Read `docs/AGENT_EXECUTION_GUIDE.md` (mandatory)
2. Scan `docs/LESSONS_LEARNED.md` for sections relevant to your task type:
   - Bugfix? Check Section 4.3 (Implementation) and 4.6 (Domain-Specific)
   - Metrics work? Check Section 4.6 and consult `FINANCIAL_METRICS.md`
   - Infrastructure? Check Section 4.5
   - UI/UX? Check Section 4.3 and relevant domain lessons
3. Apply any applicable insights before and during implementation
4. After completing the task, consider adding new lessons (see Section 3)

### When Reviewing Work

- Check lessons for known pitfalls related to the area you're reviewing
- Verify that past mistakes are not being repeated

---

## 3. Continuous Calibration & Continuous Development Process

### When to Add New Lessons

After completing a **significant task**, the agent SHOULD reflect and potentially add lessons:

**Significant tasks include:**
- Bugfixes (especially in critical paths: P&L, orders, orchestrator)
- New features
- Major refactors
- Infrastructure changes
- Any multi-step or complex implementation

**Not required for:**
- Trivial changes (typo fixes, comment updates)
- Pure documentation updates (unless they revealed process issues)

### Reflection Questions

After each significant task, briefly consider:

1. **What worked well?**
   - Efficient approaches
   - Useful docs or patterns
   - Testing strategies that caught issues

2. **What went wrong or was painful?**
   - Misunderstandings from the prompt
   - Missing context or docs
   - Tests that should have existed
   - Wasted time/tokens

3. **What would we do differently next time?**
   - Different approach
   - Consult different docs first
   - Add specific tests earlier

### Lesson Entry Template

When adding a new lesson, use this template:

```markdown
### [Short descriptive title]

- **Date:** YYYY-MM-DD
- **Task:** Brief description of what was done
- **Area:** (metrics | orchestrator | UI | infra | API | testing | ai_models | connectors | agent_orchestration | etc.)
- **What worked:** Key patterns or approaches that succeeded
- **Issues/Pitfalls:** Problems encountered
- **Recommendations:** Actionable advice for future similar tasks
```

**Valid Area values:**
- `metrics` - P&L, financial calculations
- `orchestrator` - Trading orchestrator runtime
- `ui` - Frontend, user interface
- `infra` - Infrastructure, deployment, DevOps
- `api` - API endpoints, REST services
- `testing` - Test coverage, QA
- `ai_models` - AI providers, prompts, decision engine
- `connectors` - External API integrations
- `agent_orchestration` - Development-time agent roles/modes

### Where to Add Lessons

Add new lessons to the appropriate subsection in **Section 4 (Categorised Lessons)**. If a lesson spans multiple categories, add it to the most relevant one and cross-reference.

---

## 4. Categorised Lessons

### 4.1 Prompting & Task Definition Lessons

*Lessons about interpreting user requests and scoping work.*

**Initial lesson (December 2024):**
- When a prompt is ambiguous, prefer the safest interpretation
- If multiple issues exist, prioritize by: safety > correctness > UX > performance > cleanup
- Large prompts with multiple requirements should be decomposed into sub-tasks with explicit completion markers

---

### 4.2 Architecture & Design Lessons

*Lessons about system design, patterns, and structural decisions.*

**Initial lesson (December 2024):**
- Always check `docs/ARCHITECTURE.md` before modifying core flows (orchestrator, connectors, AI engine)
- The adapter pattern is used for external services (market data, brokers) - follow this when adding new integrations
- Paper trading is enforced at architecture level - do not introduce paths that could bypass this

---

### 4.3 Implementation & Code Quality Lessons

*Lessons about coding patterns, quality, and avoiding bugs.*

**Initial lesson (December 2024):**
- Use the centralized logger (`server/utils/logger.ts`) instead of raw `console.log`
- Numeric precision is critical for financial calculations - use the utilities in `server/utils/numeric.ts`
- Always handle API errors gracefully with proper retry logic (see existing connector patterns)

---

### 4.4 Testing & QA Lessons

*Lessons about test strategy, coverage, and quality assurance.*

**Initial lesson (December 2024):**
- P&L calculations require explicit unit tests with known inputs/outputs
- Bugfixes MUST include regression tests that would fail before the fix
- Run `npx vitest run` to execute unit tests before considering work complete
- Use the `run_test` tool for e2e testing of UI/UX changes and multi-step flows

---

### 4.5 DevOps / Infra Lessons

*Lessons about deployment, scripts, and infrastructure.*

**Initial lesson (December 2024):**
- The app runs on Replit with specific port requirements (Express: 5000, Expo: 8081)
- Database migrations should use Drizzle ORM with `npm run db:push`
- Never change primary key ID column types - this causes destructive migrations

---

### 4.6 Domain-Specific Lessons (Trading / P&L)

*Lessons specific to the trading domain and financial calculations.*

**Initial lesson (December 2024):**
- ALWAYS consult `docs/FINANCIAL_METRICS.md` before touching any P&L or metric calculation
- Metric definitions must match exactly between:
  - Backend calculation
  - API response
  - Frontend display
  - Documentation
- The orchestrator has multiple safety mechanisms (kill switch, daily limits) - never bypass these
- Alpaca paper trading API has rate limits - respect them with proper throttling
- Crypto symbols need normalization (e.g., "BTC" vs "BTC/USD" vs "BTCUSD")

---

### 4.7 AI Models & Prompting Lessons

*Lessons about AI providers, prompt engineering, and decision engine.*

**Initial lesson (December 2024):**
- Always clarify metric definitions and expected outputs before changing AI prompts that produce metrics
- Use structured JSON output format for all AI responses - makes parsing reliable
- Never include API keys or account credentials in prompts
- Include "paper trading" context in all trading-related prompts
- Validate AI responses before trusting them for any financial decision
- Cache recent AI analyses to reduce costs and avoid redundant calls
- Test AI parsing logic with edge cases (malformed JSON, missing fields, invalid values)

**Reference:** See `docs/AI_MODELS_AND_PROVIDERS.md` for deep-dive on AI integration.

---

### 4.8 Connector & External API Lessons

*Lessons about external service integrations and API handling.*

**Initial lesson (December 2024):**
- Always implement and test degraded mode for connector failures - orchestrator must continue
- Rate limits vary significantly by provider - track state and implement appropriate backoff
- NewsAPI has aggressive daily limits (100/day on free tier) - use long cache periods
- Never log API keys or secrets, even when debugging - use the centralized logger with redaction
- Transform external errors to internal types - don't leak external API details to callers
- Follow the adapter pattern for new connectors - see existing connectors for template

**Reference:** See `docs/CONNECTORS_AND_INTEGRATIONS.md` for deep-dive on connectors.

---

### 4.9 Orchestrator & Agent Runtime Lessons

*Lessons about the trading orchestrator and autonomous agent behavior.*

**Initial lesson (December 2024):**
- Any change to orchestrator logic should include at least one new regression test and clear logging
- Always use cycle IDs for log correlation - makes debugging much easier
- Test kill switch behavior explicitly - it's a critical safety mechanism
- Risk limits should be enforced at multiple levels (orchestrator, broker, database)
- Handle all failure paths gracefully - the orchestrator should never crash on external errors
- Paper trading mode is enforced at API URL level - never change the Alpaca base URL without explicit approval

**Reference:** See `docs/ORCHESTRATOR_AND_AGENT_RUNTIME.md` for deep-dive on orchestrator.

### Order Execution Utility Consolidation (December 2025)

- **Date:** 2025-12-12
- **Task:** Consolidated duplicate order execution functions into shared module
- **Area:** orchestrator | infra
- **What worked:** 
  - Created single source of truth in `server/trading/order-execution-flow.ts`
  - Unified function naming: `waitForAlpacaOrderFill`, `cancelExpiredOrders`
  - Exported `OrderFillResult` interface for type sharing
- **Issues/Pitfalls:**
  - Had duplicate implementations in orchestrator.ts and order-execution-flow.ts
  - Different function names caused confusion (`waitForOrderFill` vs `waitForAlpacaOrderFill`)
- **Recommendations:**
  - Always search for existing utilities before implementing new ones
  - Keep order-execution utilities in `server/trading/order-execution-flow.ts`
  - Use consistent naming with verb + target pattern (e.g., `waitForAlpacaOrderFill`)

---

### 4.10 Development-Time Agent Orchestration Lessons

*Lessons about using the multi-role agent effectively.*

**Initial lesson (December 2024):**
- Pick the right mode/role set for each task to avoid mixing concerns and wasting tokens
- For AI/connector/orchestrator work, always consult Sections 14-17 of AGENT_EXECUTION_GUIDE.md
- Documentation-only tasks should use Technical Writer + Architect roles - avoid touching code
- When in doubt about task scope, analyze before implementing - prevents wasted effort
- Complex tasks benefit from explicit task lists - makes progress visible and avoids missed steps
- Cross-reference related docs in changes - helps future agents understand connections

**Reference:** See `docs/AGENT_EXECUTION_GUIDE.md` Section 17 for role usage rules.

### Documentation Consolidation Refactor (December 2025)

- **Date:** 2025-12-13
- **Task:** Consolidated 18+ documentation files with standardized headers and cross-references
- **Area:** documentation | agent_orchestration
- **What worked:**
  - Created INDEX.md as single front door with role-based reading paths
  - Established canonical document pattern: one topic, one home
  - Added API_REFERENCE.md for centralized REST endpoint list
  - Standardized header format across all docs with canonical reference tables
  - Cross-linked service docs to their canonical sources
- **Issues/Pitfalls:**
  - Documentation had grown organically without consistent navigation
  - Duplicate information scattered across multiple documents
  - No clear entry point for different reader roles (developers, AI agents, QA, DevOps)
- **Recommendations:**
  - Always start docs with canonical references table
  - Use INDEX.md as the discovery starting point
  - Link to canonical sources instead of duplicating content
  - Apply status labels (Implemented/Partial/Planned) to features
  - Break large documentation tasks into phases: index creation, consolidation, cross-referencing, quality pass

---

## 5. Improvement Backlog

*Ideas for future improvements derived from lessons learned.*

| Priority | Improvement | Source |
|----------|-------------|--------|
| Medium | Add more comprehensive integration tests for orchestrator error handling | Initial setup |
| Medium | Standardize metric naming conventions between backend and UI | Initial setup |
| Low | Create automated checks for metric consistency across layers | Initial setup |
| Low | Add circuit breaker pattern to external API calls | Initial setup |

---

## 6. Change Log

| Date | Change | Author/Source |
|------|--------|---------------|
| 2024-12-11 | Initial document creation with foundational structure | Governance update task |
| 2024-12-11 | Added sections 4.7-4.10 (AI, Connectors, Orchestrator, Agent Orchestration) | Extended governance task |
| 2024-12-11 | Extended Area values template with new categories | Extended governance task |
| 2025-12-12 | Added lesson on order execution utility consolidation | Code cleanup task |
| 2025-12-13 | Added lesson on documentation consolidation refactor | Documentation cleanup task |

---

## 7. Current State (December 2025)

### 7.1 Microservices Migration Lessons

The transition from monolith to microservices introduced several key lessons:

#### Strangler Fig Pattern Success

- **Date:** 2025-12
- **Task:** Implement feature flags for gradual traffic migration
- **Area:** infra | architecture
- **What worked:**
  - Traffic splitting with 0-100% rollout control
  - User whitelist for beta testing before full rollout
  - Metrics tracking for routing decisions
  - Automatic rollback on error rate thresholds
- **Issues/Pitfalls:**
  - Initial complexity in dual-write synchronization
  - Cache invalidation across both systems
- **Recommendations:**
  - Always implement feature flags before extracting services
  - Start with read-only traffic before writes
  - Monitor error rates obsessively during rollout

#### Dual-Write Repository Pattern

- **Date:** 2025-12
- **Task:** Synchronize data between monolith and microservice databases
- **Area:** infra | api
- **What worked:**
  - Abstract repository interface for transparent switching
  - Primary/secondary write with consistency checks
  - Automatic fallback on secondary failure
- **Issues/Pitfalls:**
  - Eventual consistency caused UI confusion
  - Transaction boundaries don't span databases
- **Recommendations:**
  - Accept eventual consistency or use saga pattern
  - Log all dual-write discrepancies for analysis
  - Test failure modes explicitly (11 tests added)

#### Event-Driven Communication (NATS JetStream)

- **Date:** 2025-12
- **Task:** Implement asynchronous service communication
- **Area:** infra | orchestrator
- **What worked:**
  - Durable subscriptions prevent message loss
  - Consumer groups enable horizontal scaling
  - Dead letter queues capture failed messages
- **Issues/Pitfalls:**
  - Message ordering not guaranteed across partitions
  - Duplicate delivery requires idempotent handlers
- **Recommendations:**
  - Include idempotency keys in all events
  - Implement at-least-once with deduplication
  - Test replay scenarios (9 tests added)

#### OpenTelemetry Integration

- **Date:** 2025-12
- **Task:** Add distributed tracing across services
- **Area:** infra | observability
- **What worked:**
  - Auto-instrumentation reduced manual work
  - Context propagation "just works" for HTTP
  - Trace ID correlation simplified debugging
- **Issues/Pitfalls:**
  - NATS required manual context injection
  - High cardinality attributes bloat storage
- **Recommendations:**
  - Limit custom span attributes to essential data
  - Propagate context explicitly for non-HTTP protocols
  - Test span creation and propagation (16 tests added)

### 7.2 Algorithm Framework Lessons

#### Backtesting Engine

- **Date:** 2025-12
- **Task:** Build event-driven backtesting with realistic fills
- **Area:** testing | metrics
- **What worked:**
  - Factory pattern for isolated algorithm instances
  - Prorated partial exit handling
  - Realistic slippage/commission models
- **Recommendations:**
  - Always use `runWithFactory` for backtests
  - Verify P&L with manual calculations on sample trades

#### Transaction Cost Analysis (TCA)

- **Date:** 2025-12
- **Task:** Implement execution quality scoring
- **Area:** metrics | analytics
- **What worked:**
  - Implementation shortfall breakdown
  - A-F grading scale for quick assessment
  - Broker comparison reporting
- **Recommendations:**
  - Capture arrival price at decision time
  - Log all fill events for post-trade analysis

---

## 8. Enhancements Compared to Previous Version

### 8.1 Lesson Coverage Expansion

| Category | Before (Dec 2024) | After (Dec 2025) |
|----------|-------------------|------------------|
| **Prompting** | 1 lesson | 1 lesson |
| **Architecture** | 1 lesson | 1 lesson + microservices patterns |
| **Implementation** | 1 lesson | 2 lessons (order execution) |
| **Testing** | 1 lesson | 1 lesson + 111 automated tests |
| **DevOps/Infra** | 1 lesson | 5 lessons (feature flags, dual-write, NATS, OpenTelemetry, Kubernetes) |
| **Domain-Specific** | 1 lesson | 3 lessons (TCA, backtesting, regime detection) |
| **AI Models** | 1 lesson | 1 lesson |
| **Connectors** | 1 lesson | 1 lesson |
| **Orchestrator** | 2 lessons | 2 lessons |
| **Agent Orchestration** | 1 lesson | 1 lesson |

### 8.2 New Categories

1. **Microservices Migration** - Strangler fig, dual-write, event-driven
2. **Algorithm Framework** - Backtesting, TCA, strategy versioning
3. **Observability** - OpenTelemetry, distributed tracing

---

## 9. Old vs New - Summary of Changes

| Aspect | Old Approach | New Approach |
|--------|--------------|--------------|
| **Lesson Scope** | Monolith-focused | Monolith + Microservices |
| **Infrastructure Lessons** | Basic (ports, DB) | Advanced (event bus, tracing, feature flags) |
| **Testing Lessons** | Manual verification | Automated test patterns |
| **Architecture Patterns** | Adapter pattern | Adapter + Strangler Fig + Event-Driven |
| **Failure Handling** | Error logging | Circuit breakers, retries, dead letters |
| **Monitoring** | Cycle ID correlation | Full distributed tracing |

---

*Document Version: 2.0*  
*Last Updated: December 2025*
*Version: 2.0.0 (Microservices Migration)*
