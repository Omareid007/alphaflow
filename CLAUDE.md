<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# AlphaFlow - Claude Code Project Memory and Rules

**Version**: 2.0
**Last Updated**: January 2026
**Status**: Post-Rescue - Stability Priority

---

## 🚨 CRITICAL RULES - FOLLOW WITHOUT EXCEPTION

### Rule 1: SPEC BEFORE CODE (OpenSpec Required)

**NEVER write feature code without an approved OpenSpec proposal.**

- Use `/openspec:proposal` for any new feature
- Wait for human approval of the spec
- Only then implement with `/openspec:apply`
- Archive when complete with `/openspec:archive`
- Bug fixes with clear scope are exempt

### Rule 2: SINGLE RESPONSIBILITY

One task at a time. Complete fully before starting another.

- Mark TODO as in_progress when starting
- Mark TODO as completed when done
- Never batch multiple tasks before marking complete
- If blocked, create new TODO for blocker

### Rule 3: MINIMAL CHANGES

Make the smallest change that solves the problem.

- Ask if you need to touch more than 5 files
- Don't refactor unrelated code
- Don't add "nice to have" features
- Keep scope tightly focused on the request

### Rule 4: NO FILE POLLUTION

Never create temporary or polluting files.

**FORBIDDEN file patterns:**

- `*_COMPLETE.md`
- `*_IMPLEMENTATION.md`
- `*_INTEGRATION.md`
- `*.bak`
- `*.old`
- `*.backup`
- `*_new.*`
- `*_temp.*`

**Required**: Delete these immediately if created by accident.

### Rule 5: REMOVE BEFORE REPLACE

Delete old code before adding new. Never leave dead code.

- Comment out code only for debugging (remove before commit)
- Remove unused imports immediately
- Delete deprecated functions completely
- No "TODO: remove this later" comments

### Rule 6: VERIFY BEFORE COMPLETE

Must run verification before saying "done".

**Required checks:**

```bash
npm run build          # Must pass
npm run typecheck      # Must pass
```

**Additional checks when applicable:**

```bash
npm run lint           # For code changes
npm run test           # For feature changes
```

Report pass/fail status explicitly.

---

## 🔄 OPENSPEC WORKFLOW

### When OpenSpec is Required

- Any new feature
- Any change touching more than 3 files
- Any new API endpoint
- Any database schema change
- Any significant refactoring

### OpenSpec Commands

| Command                     | Purpose                   |
| --------------------------- | ------------------------- |
| `/openspec:proposal <desc>` | Create change proposal    |
| `/openspec:apply <name>`    | Implement approved change |
| `/openspec:archive <name>`  | Complete and archive      |
| `openspec list`             | View active changes       |
| `openspec show <name>`      | View change details       |

### Spec Format

- Requirements use SHALL or MUST
- Every requirement has scenarios
- Scenarios use GIVEN/WHEN/THEN format

### Directory Structure

openspec/
├── project.md - Project context (read first)
├── specs/ - Current truth (approved)
└── changes/ - Proposals (pending approval)

### Before Feature Work

1. Read openspec/project.md
2. Check openspec/specs/ for existing specs
3. Create proposal: /openspec:proposal <description>
4. Wait for approval
5. Implement: /openspec:apply <name>
6. Complete: /openspec:archive <name>

---

## 📋 PROJECT OVERVIEW

AlphaFlow is an AI-powered algorithmic trading platform for automated strategy development and execution.

### Core Features

- **Multi-LLM Gateway**: OpenAI, Claude, Groq, Gemini with intelligent fallback
- **Broker Integration**: Alpaca Markets (paper & live trading)
- **Real-time Data**: Market data streaming, portfolio tracking
- **Strategy Management**: Create, backtest, deploy trading strategies
- **Admin Dashboard**: System monitoring, kill switch, user management

### Current State

**Post-Rescue** (January 2026)

- Cleaned up AI clutter files (121 removed)
- Removed 23 unused dependencies
- Optimized git repository (369M → 326M)
- Governance rules installed
- Priority: Stability and maintainability

---

## 🛠️ TECH STACK

| Category          | Technologies                                    |
| ----------------- | ----------------------------------------------- |
| **Frontend**      | Next.js 14.2, React 18, TypeScript, TailwindCSS |
| **UI Components** | Shadcn UI (managed in `components/ui/`)         |
| **Backend**       | Express.js, Node.js, TypeScript                 |
| **Database**      | PostgreSQL, Drizzle ORM                         |
| **Trading**       | Alpaca Markets API                              |
| **AI/LLM**        | OpenAI, Anthropic Claude, Groq, Google Gemini   |
| **State**         | React Query (TanStack Query)                    |
| **Styling**       | Tailwind CSS, Framer Motion                     |
| **Testing**       | Vitest, Testing Library                         |
| **Validation**    | Zod                                             |

---

## 📁 PROJECT STRUCTURE

```
/
├── app/                    # Next.js 13+ App Router pages
├── components/             # React components
│   └── ui/                # Shadcn UI components (DO NOT modify directly)
├── server/                # Express backend
│   ├── routes/           # API endpoints
│   ├── trading/          # Trading logic
│   ├── ai/               # AI/LLM integration
│   └── connectors/       # Broker connectors (Alpaca)
├── lib/                   # Client utilities
│   └── api/hooks/        # React Query hooks
├── hooks/                 # Custom React hooks
├── shared/                # Shared types and schemas
│   └── schema/           # Zod schemas
├── docs/                  # Documentation
│   ├── CHANGELOG.md      # Full phase history
│   ├── product/          # Product specs
│   └── api/              # OpenAPI specs
├── mcp-servers/           # Custom MCP servers
├── openspec/              # OpenSpec specifications
├── tests/                 # Test files
└── .claude/               # Claude Code configuration
    ├── rules/            # Path-scoped rules
    └── settings.local.json  # Hooks configuration
```

**Important Notes:**

- `components/ui/` is managed by Shadcn CLI - never edit directly
- Use `npx shadcn@latest add [component]` to add UI components
- Path-scoped rules in `.claude/rules/` auto-load for relevant files

---

## ⚙️ COMMANDS

### Development

```bash
npm run dev              # Start dev server (Next.js + Express)
npm run dev:client       # Start only Next.js
npm run dev:server       # Start only Express backend
```

### Build & Production

```bash
npm run build            # Build Next.js + Express
npm run build:server     # Build Express only
npm run start            # Start production server
```

### Code Quality

```bash
npm run typecheck        # TypeScript type checking (tsc --noEmit)
npm run lint             # ESLint
npm run test             # Run all tests
npm run test:watch       # Watch mode
```

### Database

```bash
npm run db:push          # Push schema to database
npm run db:studio        # Open Drizzle Studio (DB GUI)
```

### Utilities

```bash
npm run clean:code       # Knip unused code detection
npm run clean:deps       # Depcheck unused dependencies
npm run generate-tests   # Generate tests from OpenSpec scenarios
npm audit                # Security audit
```

### OpenSpec (Spec-Driven Development)

```bash
npx openspec validate    # Validate specifications
npx openspec status      # Show implementation progress
```

---

## 🔄 WORKFLOW

### Before Starting a Task

1. **State your understanding**
   - Summarize what you'll do
   - List files you'll modify
   - Estimate scope (small/medium/large)

2. **Get confirmation**
   - Wait for user approval if task is medium/large
   - Ask clarifying questions if requirements unclear

3. **Create TODO list**
   - Use `TodoWrite` for tasks with 3+ steps
   - One item per distinct action

### During Implementation

1. **Make small, incremental changes**
   - One file at a time when possible
   - Test frequently (especially for backend changes)
   - Commit after completing logical units

2. **Follow coding standards** (see Code Standards section)

3. **Update TODOs in real-time**
   - Mark `in_progress` when starting
   - Mark `completed` immediately when done
   - Don't batch completions

### After Completion

1. **Run verification**

   ```bash
   npm run build
   npm run typecheck
   ```

2. **Test the feature**
   - Manually test changed functionality
   - Run relevant test suite if exists

3. **Report results**
   - Build status (pass/fail)
   - TypeCheck status (pass/fail)
   - Feature test results
   - Show evidence (screenshots, logs, test output)

4. **Commit changes**
   - Use conventional commits format
   - Include descriptive message

---

## 🚫 NEVER DO

### Dangerous Commands

- `rm -rf` (especially `rm -rf /` or `rm -rf .`)
- `git push --force` (unless explicitly requested)
- `DROP DATABASE` or `TRUNCATE TABLE`
- `npm install -g` (global installs)
- `chmod 777` (insecure permissions)

### Unauthorized Changes

- Never modify `package.json` without permission
- Never modify database schema without permission
- Never modify `.env` or environment variables without permission
- Never modify `components/ui/` Shadcn files directly

### File Pollution

- Never create files matching forbidden patterns (see Rule 4)
- Never leave commented-out code blocks (except temporarily for debugging)
- Never create duplicate files (file_new.ts, file_copy.ts, etc.)

### Scope Creep

- Don't refactor unrelated code
- Don't add features not explicitly requested
- Don't "improve" code outside the task scope
- Don't fix unrelated issues unless asked

---

## 🆘 WHEN STUCK

If you encounter a blocker:

1. **STOP immediately**
   - Don't continue with broken approach
   - Don't try random fixes

2. **Explain the block clearly**
   - What you were trying to do
   - What went wrong
   - Show exact error message (full output)

3. **Suggest 2-3 approaches**
   - Present viable alternatives
   - Explain pros/cons of each
   - Recommend one (with rationale)

4. **Wait for direction**
   - Don't proceed until user chooses approach
   - Ask clarifying questions if needed

---

## ✅ COMPLETION CHECKLIST (Stop Hook)

Before marking ANY task complete, verify ALL with evidence:

### Build Verification

- [ ] `npm run build` passes - show output
- [ ] `npm run typecheck` passes - show output
- [ ] `npm run lint` passes - show warnings if any

### Implementation Verification

- [ ] Code is ACTUALLY IMPLEMENTED (not just planned)
- [ ] Tests written if applicable
- [ ] No TypeScript errors
- [ ] No console errors

### Documentation Verification

- [ ] Existing docs UPDATED (not new files created)
- [ ] CLAUDE.md NOT modified without approval
- [ ] No \*\_COMPLETE.md files created

### Quality Verification

- [ ] Changes match original request
- [ ] No scope creep (extra features not requested)
- [ ] Old code removed if replaced

### Evidence Required

Provide concrete proof for each:
BUILD: [paste last 5 lines of build output]
TYPES: [paste typecheck result]
TEST: [describe manual test performed]
FILES: [list files changed]

**If ANY checkbox fails or lacks evidence: DO NOT mark complete - continue working**

---

## 📝 CODE STANDARDS

### Naming Conventions

| Type                 | Convention                  | Example                       |
| -------------------- | --------------------------- | ----------------------------- |
| **Components**       | PascalCase                  | `StrategyCard.tsx`            |
| **Hooks**            | camelCase with `use` prefix | `useStrategies.ts`            |
| **Utilities**        | camelCase                   | `formatCurrency.ts`           |
| **Constants**        | SCREAMING_SNAKE_CASE        | `MAX_RETRIES`                 |
| **Types/Interfaces** | PascalCase                  | `Strategy`, `UserPreferences` |
| **API Routes**       | kebab-case                  | `/api/user-preferences`       |

### Git Commit Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(scope): <description>

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(trading): add order retry mechanism
fix(auth): resolve session expiration bug
docs(api): update OpenAPI spec for backtests
refactor(hooks): consolidate portfolio hooks
test(strategies): add strategy creation tests
chore(deps): remove unused dependencies
```

---

## 👑 KING MODE (PM Autonomous Operation)

When working autonomously for the PM (non-developer):

### Behavior Rules

1. **Complete tasks fully** - Don't stop at 80%, finish 100%
2. **Self-validate** - Run build/typecheck before reporting done
3. **No partial work** - Either complete the task or explain why you can't
4. **Evidence required** - Show proof of completion (output, screenshots)
5. **Clean as you go** - Remove temp files, dead code immediately

### Autonomous Limits

- Maximum 50 turns per session
- Stop on: build failure, test failure, permission denied
- Always commit working code before major changes
- Create backup branch before risky operations

### PM Communication Style

- Lead with results, not process
- Use tables and bullets for status
- Provide copy-paste commands when action needed
- Flag blockers immediately, don't hide problems

### Quality Gates (Autonomous)

Before saying "done" in autonomous mode:

1. npm run build - MUST pass
2. npm run typecheck - MUST pass
3. Manual test - MUST work
4. Git committed - MUST be saved

---

## 🧠 ULTRATHINK PROTOCOL

When user says "ULTRATHINK" before a request:

### Activation

- Suspend brevity rules
- Engage maximum depth analysis
- Consider all dimensions

### Analysis Dimensions

1. Technical: Performance, complexity, edge cases
2. User Experience: Cognitive load, accessibility
3. Security: Vulnerabilities, data protection
4. Scalability: Future growth, maintenance burden
5. Business: ROI, time to implement, risk

### Output Format

1. Deep reasoning chain with all considerations
2. Edge case analysis
3. Multiple solution options with tradeoffs
4. Recommended approach with justification
5. Implementation plan

### When NOT Triggered

- Normal requests get concise responses
- Only activate on explicit "ULTRATHINK" command

---

## 📚 DOCUMENTATION REFERENCES

### Core Documentation

- **Full Changelog**: `docs/CHANGELOG.md` (Phases 1-22)
- **OpenAPI Spec**: `docs/api/OPENAPI_SPEC.yaml` (350+ endpoints)
- **OpenSpec Guide**: `openspec/AGENTS.md` (spec-driven development)

### Feature Documentation

- **UX Patterns**: `docs/UX_PATTERNS.md` (loading states, error boundaries)
- **Animation Guide**: `docs/ANIMATION_GUIDE.md` (Framer Motion patterns)
- **Performance**: `docs/PERFORMANCE_GUIDE.md` (optimization strategies)

### Analysis & Planning

- **Gap Analysis**: `analysis/gaps/` (type safety, testing, accessibility)
- **Flow Docs**: `analysis/flows/` (user journeys, data flows)
- **Feature Specs**: `specs/features/` (detailed specifications)

### Path-Scoped Rules

Located in `.claude/rules/`, auto-load for matching file paths:

| Rule              | Applies To                        | Purpose                           |
| ----------------- | --------------------------------- | --------------------------------- |
| `mcp-servers.md`  | `.mcp.json`, `server/**`          | 26 MCP servers reference          |
| `trading.md`      | `server/trading/**`               | Trading rules, Alpaca integration |
| `security.md`     | `server/**`, `shared/**`          | Security, CVEs, OWASP             |
| `logging.md`      | `server/**/*.ts`                  | Pino structured logging           |
| `typescript.md`   | `**/*.ts`, `**/*.tsx`             | Type safety patterns              |
| `testing.md`      | `tests/**`                        | Test conventions                  |
| `openapi-docs.md` | `docs/api/**`, `server/routes/**` | OpenAPI maintenance               |

---

## 🔧 CONFIGURATION FILES

| File                          | Purpose                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `.claude/settings.local.json` | Claude Code hooks (5 configured)                             |
| `.mcp.json`                   | MCP servers configuration (26 total)                         |
| `.env`                        | Environment variables (takes precedence over Replit Secrets) |
| `vitest.config.ts`            | Test configuration                                           |
| `next.config.js`              | Next.js configuration                                        |
| `drizzle.config.ts`           | Database ORM configuration                                   |
| `tsconfig.json`               | TypeScript configuration                                     |

---

## 📊 PROJECT METRICS

| Metric                   | Value                   |
| ------------------------ | ----------------------- |
| Total Size               | ~2.1 GB                 |
| Git Repository           | 326 MB                  |
| Lines of Code            | ~152,000                |
| TypeScript Files         | 485                     |
| Dependencies             | 81                      |
| MCP Servers              | 26                      |
| Tests                    | 43 files, ~21,600 lines |
| OpenSpec Scenarios       | 370+ (auto-generated)   |
| Security Vulnerabilities | 4 (moderate, dev-only)  |

**Quick Size Check:**

```bash
du -sh .                    # Total project size
du -sh .git                 # Git repository size
wc -c < CLAUDE.md          # This file (must be < 35KB)
```

---

## 🧠 MEMORY MCP USAGE

Query project context without loading into session:

```bash
# Project status and overview
mcp__memory__search_nodes("project")

# Skills, agents, commands inventory
mcp__memory__search_nodes("inventory")

# Phase history and changelog
mcp__memory__search_nodes("changelog")

# Full knowledge graph
mcp__memory__read_graph()
```

This is useful for retrieving dynamic information without bloating this file.

---

## 🎯 REMEMBER

1. **Spec before code** - Always plan first
2. **One task at a time** - Complete fully before moving on
3. **Minimal changes** - Smallest change that solves the problem
4. **No file pollution** - No temp files, no dead code
5. **Remove before replace** - Delete old code first
6. **Verify before complete** - Build + typecheck must pass

**When in doubt, ask.** Better to clarify than to waste time on wrong approach.

---

**End of CLAUDE.md** - Follow these rules for project success.
