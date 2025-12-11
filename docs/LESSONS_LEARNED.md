# Lessons Learned

> **Purpose**  
> This document captures practical lessons from previous tasks to make future work smarter, safer, and more efficient.  
> It is an **optional, supplementary guideline** that complements `docs/AGENT_EXECUTION_GUIDE.md`.

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

---

*Document Version: 1.1*  
*Last Updated: December 2024*
