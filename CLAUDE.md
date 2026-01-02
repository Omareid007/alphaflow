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

# Claude Code Project Configuration

## Project Overview

Trading platform with autonomous strategy management, backtesting, and broker integrations (Alpaca). Futures trading (IBKR) is planned - see `docs/FUTURES_ROADMAP.md`.

## Quick Status

| Metric              | Value                   |
| ------------------- | ----------------------- |
| Lines of Code       | ~152,000                |
| TypeScript Files    | 485                     |
| Dependencies        | 81                      |
| MCP Servers         | 26                      |
| Tests               | 43 files, ~21,600 lines |
| OpenSpec Scenarios  | 370+ (auto-generated)   |
| Security Vulns      | 4 (moderate, dev-only)  |

**Tools inventory**: Query `mcp__memory__search_nodes("inventory")` for current skills/agents/commands.

**Full changelog**: See `/docs/CHANGELOG.md` for phases 1-22 history.

## Path-Scoped Rules

Rules in `.claude/rules/` load only when editing matching files:

| Rule File         | Scope                       | Purpose                  |
| ----------------- | --------------------------- | ------------------------ |
| `mcp-servers.md`  | `.mcp.json`, `server/**`    | 26 MCP servers reference |
| `trading.md`      | `server/trading/**`         | Trading rules, Alpaca    |
| `security.md`     | `server/**`, `shared/**`    | CVEs, OWASP compliance   |
| `logging.md`      | `server/**/*.ts`            | Pino structured logging  |
| `typescript.md`   | `**/*.ts`, `**/*.tsx`       | Type safety patterns     |
| `testing.md`      | `tests/**`                  | Test conventions         |
| `openapi-docs.md` | `docs/api/**`, `server/routes/**` | OpenAPI 3.0.3 maintenance |

## Environment Configuration

### Alpaca Credentials

The `.env` file takes precedence over Replit Secrets via `dotenv.config({ override: true })`.

Verify with: `GET /api/admin/alpaca-account`

## Quick Commands

```bash
# Build and test
npm run build
npm run lint
npx tsc --noEmit
npx vitest run

# Generate tests from OpenSpec (370+ scenarios)
npm run generate-tests

# Security audit
npm audit

# Code quality
npm run clean:code      # knip unused code detection
npm run clean:deps      # depcheck unused dependencies

# Check CLAUDE.md size (must stay under 35KB)
wc -c < CLAUDE.md
```

## Configuration Locations

| File                             | Purpose                            |
| -------------------------------- | ---------------------------------- |
| `.claude/rules/`                 | Path-scoped instructions (6 files) |
| `.claude/settings.local.json`    | Hooks (5 configured)               |
| `.mcp.json`                      | MCP servers (26 total)             |
| `.env`                           | Environment variables              |
| `mcp-servers/trading-utilities/` | Custom MCP server (8 tools)        |

## Non-Destructive Operation Rules

1. **Always create backup branch** before destructive operations
2. **Use `git rm --cached`** to untrack files without deleting
3. **Archive before delete** for assets and documentation
4. **Run tests** after each cleanup phase
5. **Commit frequently** with clear messages

## Documentation Structure

| Directory           | Contents                     |
| ------------------- | ---------------------------- |
| `docs/CHANGELOG.md` | Full phase history (1-22)    |
| `docs/product/`     | Roadmap, BRDs, user journeys |
| `docs/api/`         | OpenAPI specification        |
| `analysis/`         | Gap analysis, flow docs      |
| `specs/`            | Feature specifications       |

## Memory MCP Usage

Query project context without loading into session:

```
mcp__memory__search_nodes("project")     # Project status
mcp__memory__search_nodes("inventory")   # Skills/agents/commands
mcp__memory__search_nodes("changelog")   # Phase history
mcp__memory__read_graph()                # Full knowledge graph
```

## Size Management

This file must stay under **35KB** to prevent performance issues.

- Historical content → `/docs/CHANGELOG.md`
- Dynamic inventory → Memory MCP entities
- Scoped instructions → `.claude/rules/*.md`

Pre-commit hook blocks commits if CLAUDE.md exceeds 35KB.
