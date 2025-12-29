# Claude Code Project Configuration

## Project Overview

Trading platform with autonomous strategy management, backtesting, and broker integrations (Alpaca). Futures trading (IBKR) is planned - see `docs/FUTURES_ROADMAP.md`.

## Codebase Metrics (as of Dec 29, 2024)

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Total Workspace | 2.0 GB | 1.9 GB | 100 MB |
| Source Code | 535 MB | 530 MB | 5 MB |
| TypeScript/React Files | 501 | 485 | 16 files |
| Lines of Code | ~154,138 | ~152,000 | ~2,000 |
| Dependencies | 104 | 81 | 23 packages |
| Static Assets | 3.88 MB | 400 KB | 86% reduction |
| Security Vulns | 8 | 7 | 1 fixed |

## Cleanup Status

### Completed (Dec 29, 2024)
- [x] Alpaca account mismatch resolved (dotenv override)
- [x] MCP servers configured (7 servers: postgres, sequential-thinking, memory, filesystem, git, fetch, time)
- [x] Analysis agents created (4 agents)
- [x] Analysis commands created (4 commands)
- [x] Safety hooks configured
- [x] `.next/` removed from Git tracking (471 files, ~26K lines)
- [x] Old maintenance scripts removed (9 files, 2774 lines)
- [x] Dependency audit completed
- [x] **Next.js upgraded 13.5.1 → 14.2.35** (critical security fix)
- [x] **attached_assets cleaned** (5.1MB → 984KB, 80% reduction)
- [x] Custom skills created (3 skills: trading-analysis, alpaca-integration, project-structure)

### Phase 3 Cleanup Completed (Dec 29, 2024)
- [x] **Removed 23 unused packages** (104 → 81 dependencies)
- [x] **Removed 16 unused UI components** (accordion, carousel, drawer, form, etc.)
- [x] **Optimized icons** (2.9 MB → 400 KB, 86% reduction via Sharp)
- [x] **Removed unused @types** (@types/decimal.js, @types/p-limit, @types/p-retry, @types/cors)
- [x] **Removed dev screenshots** from attached_assets
- [x] **Installed code quality tools** (knip, sharp)
- [x] **Created image optimization script** (scripts/optimize-images.ts)
- [x] **Added new npm scripts** (clean:code, clean:deps, optimize:images)

### Phase 4 Enhancements (Dec 29, 2024)
- [x] **Added 4 finance MCP servers** (financial-datasets, alpaca-trading, alphavantage, polygon)
- [x] **Removed Docker MCP** (not functional in Replit)
- [x] **Created error boundaries** (`components/error-boundaries/`)
  - `RootErrorBoundary.tsx` - App-wide error catching
  - `ComponentErrorBoundary.tsx` - Granular component isolation
- [x] **Created validation middleware** (`server/middleware/validate.ts`)
- [x] **Removed futures stubs** (51 unimplemented methods)
- [x] **Created futures roadmap** (`docs/FUTURES_ROADMAP.md`)

### Phase 5: Product Discovery System (Dec 29, 2024)
- [x] **Created Product Analyst skill** with 6 subagents and 8 commands
- [x] **Created 8 product analysis commands** (discover-app, analyze-flows, audit-components, etc.)
- [x] **Created 6 product analysis agents** (app-discoverer, ui-analyst, flow-mapper, etc.)
- [x] **Fixed Alpaca MCP configuration** (changed to official alpaca-mcp package)
- [x] **Created comprehensive analysis documentation:**
  - 4 flow documents (backtesting, trading-execution, portfolio-management, admin-operations)
  - 3 gap analysis documents (type-safety, test-coverage, accessibility)
  - Component usage matrix (60+ components inventoried)
- [x] **Created feature specifications:**
  - `specs/features/email-notifications.md` - SendGrid integration
  - `specs/features/futures-trading.md` - IBKR integration plan
  - `specs/features/mobile-responsive.md` - Responsive design
- [x] **Created gap fix specifications:**
  - `specs/gaps/type-safety-fix.md` - 289 `:any` → <20
  - `specs/gaps/test-infrastructure.md` - <5% → 60% coverage
- [x] **Created enhancement proposals:**
  - `proposals/console-log-removal.md` - 7,758 console statements → structured logging
  - `proposals/type-safety-upgrade.md` - Type safety improvement
  - `proposals/test-coverage-plan.md` - Testing roadmap
- [x] **Created product documentation:**
  - `docs/MCP-API-KEYS.md` - API key guide for all MCP servers
  - `docs/product/FEATURE_MATRIX.md` - 54 complete, 15 partial, 10 planned features
  - `docs/product/USER_JOURNEYS.md` - Visual user flow documentation
  - `docs/api/OPENAPI_SPEC.yaml` - Full OpenAPI 3.0 specification

### Phase 6: Structured Logging (Dec 29, 2024)
- [x] **Installed Pino logging stack** (pino, pino-http, pino-pretty)
- [x] **Upgraded `server/utils/logger.ts`** to use Pino internally
- [x] **Migrated console.log statements** in server code to structured logger
- [x] **Added ESLint no-console rule** for server code enforcement
- [x] **Created module-specific child loggers** (trading, autonomous, ai, api, connector)
- [x] **Implemented automatic credential redaction** (API keys, passwords, tokens)

### Remaining Items (Future)
| Item | Priority | Notes |
|------|----------|-------|
| Backtest script consolidation | Low | 14 scripts (~8K lines) remaining |
| Type safety upgrade | P1 | 289 `:any` annotations |
| Test coverage | P0 | <5% → 60% target |
| Email notifications | P1 | Code stub exists |
| Remaining vulnerabilities | Medium | glob in eslint-config-next |

## Security Status

### Fixed (Dec 29, 2024)
| CVE | Severity | Description |
|-----|----------|-------------|
| CVE-2025-29927 | Critical | Next.js Middleware Authorization Bypass |
| CVE-2025-55184 | High | Next.js DoS via infinite loop |
| CVE-2025-55183 | Medium | Next.js Source Code Exposure |

### Remaining (Non-Critical)
- glob vulnerability in eslint-config-next (would require Next.js 15 to fix)
- esbuild-kit in drizzle-kit (moderate)

## MCP Servers

Configured in `.mcp.json`:

### Core Servers (No API Key Required)
| Server | Purpose |
|--------|---------|
| `postgres` | Database queries |
| `sequential-thinking` | Complex problem-solving |
| `memory` | Persistent knowledge graph |
| `filesystem` | Secure file operations |
| `git` | Git repository operations |
| `fetch` | Web content fetching |
| `time` | Time/timezone utilities |
| `ts-morph` | TypeScript AST refactoring |
| `playwright` | Browser automation, E2E testing |
| `puppeteer` | Headless Chrome automation |
| `sqlite` | Local persistent storage |

### API Key Required (Configure When Available)
| Server | Purpose | Env Variable |
|--------|---------|--------------|
| `github` | Repository operations, issues | `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `slack` | Trade alerts, notifications | `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID` |
| `brave-search` | Privacy-focused web search | `BRAVE_API_KEY` |
| `sentry` | Error tracking & monitoring | OAuth (auto-configured) |
| `exa` | AI-powered web search | `EXA_API_KEY` |

### Finance-Specific MCP Servers (New Dec 29, 2024)
| Server | Purpose | Env Variable |
|--------|---------|--------------|
| `financial-datasets` | Income statements, balance sheets, prices | `FINANCIAL_DATASETS_API_KEY` |
| `alpaca-trading` | Direct MCP trading via Alpaca | `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` |
| `alphavantage` | 100+ financial APIs, fundamentals | `ALPHAVANTAGE_API_KEY` |
| `polygon` | Real-time market data, options | `POLYGON_API_KEY` |

## Custom Skills

Located in `~/.claude/skills/`:
| Skill | Purpose |
|-------|---------|
| `trading-analysis` | Strategy and backtest guidance |
| `alpaca-integration` | Alpaca API patterns |
| `project-structure` | Codebase navigation |
| `backtest-framework` | Shared backtest modules |
| `npm-dependencies` | Dependency management |
| `market-analysis` | Market condition detection, indicators |
| `risk-management` | Position sizing, pre-trade validation |
| `ai-llm-patterns` | LLM Gateway, provider fallbacks |
| `product-analyst` | PM & UI/UX discovery system |

## Product Analyst Skill (New Dec 29, 2024)

Expert PM & UI/UX Discovery System with 6 subagents and 8 commands.

### Product Analysis Commands
| Command | Purpose |
|---------|---------|
| `/discover-app` | Map entire application structure |
| `/analyze-flows` | Document all user journeys |
| `/audit-components` | Audit every UI element |
| `/find-incomplete` | Find all gaps and TODOs |
| `/create-spec [feature]` | Create feature specification |
| `/create-test-plan [feature]` | Create comprehensive test plan |
| `/plan-enhancement [feature]` | Plan safe enhancement with rollback |
| `/generate-product-docs` | Generate product documentation |

### Product Analysis Agents
| Agent | Purpose |
|-------|---------|
| `app-discoverer` | Structure discovery |
| `ui-analyst` | Component analysis |
| `flow-mapper` | User journey mapping |
| `spec-writer` | PRD/specification writing |
| `qa-designer` | Test planning |
| `enhancement-planner` | Safe enhancement planning |

### Analysis Output Directories
- `./analysis/` - Discovery results, gap analysis
- `./specs/` - Feature specifications
- `./proposals/` - Enhancement plans
- `./tests/` - Test plans
- `./docs/` - Product documentation

## Backtest Script Migration (Dec 29, 2024)

### Completed Migrations
| Script | Before | After | Savings |
|--------|--------|-------|---------|
| omar-backtest.ts | 779 | 247 | 68% |
| omar-momentum-optimizer.ts | 805 | 669 | 17% |
| omar-hyperoptimizer.ts | 957 | 682 | 29% |
| omar-backtest-enhanced.ts | 1,565 | 731 | 53% |
| omar-weight-optimizer.ts | 1,335 | 853 | 36% |
| omar-ultra-hyperoptimizer.ts | 1,843 | 865 | 53% |

**Total: 3,237 lines saved (44% average reduction)**

### Shared Modules Created
Located in `scripts/shared/`:
- `types.ts` - AlpacaBar, BacktestConfig, Trade, Genome, ParamRange
- `alpaca-api.ts` - fetchAlpacaBars, fetchHistoricalData, SYMBOL_LISTS
- `technical-indicators.ts` - 16 indicators (RSI, SMA, EMA, ATR, MACD, BB, etc.)
- `backtest-engine.ts` - runBacktest, calculateMetrics, generateSignal
- `genetic-algorithm.ts` - crossover, mutate, tournamentSelect, normalizeWeights

### Remaining Scripts (Lower Priority)
14 scripts (~8,000 lines) can use same migration pattern when needed

## Environment Configuration

### Critical: Alpaca Credentials
The `.env` file takes precedence over Replit Secrets via `dotenv.config({ override: true })`.

Verify with: `GET /api/admin/alpaca-account`

## Structured Logging

### Overview
The platform uses **Pino** for high-performance structured JSON logging with automatic credential redaction.

### Usage
```typescript
import { log } from '../utils/logger';

// Standard logging (backward compatible API)
log.info('Trading', 'Order placed', { symbol: 'AAPL', quantity: 100 });
log.warn('Alpaca', 'Rate limit approaching', { remaining: 5 });
log.error('AI', 'Provider failed', { provider: 'openai', error });

// Module-specific loggers (direct Pino child loggers)
import { tradingLogger, autonomousLogger, aiLogger } from '../utils/logger';

tradingLogger.info({ symbol: 'AAPL', price: 150.25 }, 'Position opened');
autonomousLogger.debug({ cycleId: 'cyc-abc123' }, 'Cycle started');
```

### Features
| Feature | Description |
|---------|-------------|
| JSON output | Production logs are structured JSON for log aggregation |
| Pretty printing | Development logs are colorized and human-readable |
| Auto-redaction | API keys, passwords, tokens automatically censored |
| Correlation IDs | Request/cycle IDs for distributed tracing |
| Module loggers | Child loggers for trading, autonomous, ai, api, connector |

### Automatic Redaction
These fields are automatically redacted to `[REDACTED]`:
- `alpacaApiKey`, `alpacaSecretKey`, `apiKey`, `secretKey`
- `password`, `token`, `accessToken`, `refreshToken`
- `authorization`, `cookie`, `session`, `jwt`
- Nested patterns: `*.apiKey`, `*.password`, `body.token`

### ESLint Enforcement
The `no-console` rule is enabled for `server/**/*.ts` files. Use the structured logger instead:
```typescript
// ❌ Bad - will trigger ESLint warning
console.log('Order placed:', orderId);

// ✅ Good - use structured logger
log.info('Trading', 'Order placed', { orderId });
```

## Available Analysis Tools

### Commands (use with `/`)
| Command | Purpose |
|---------|---------|
| `/analyze-codebase` | Full codebase analysis |
| `/find-dead-code` | Detect unused code |
| `/find-duplicates` | Find code duplication |
| `/cleanup-dependencies` | Dependency audit |
| `/security-scan` | Security vulnerability scanning |
| `/optimize-performance` | Performance analysis and SLO checks |
| `/generate-tests` | Auto-generate tests from code |

### Agents (via ~/.claude/agents/)
| Agent | Purpose |
|-------|---------|
| `codebase-analyzer` | Structure and pattern analysis |
| `dependency-auditor` | Package auditing |
| `refactoring-strategist` | Safe refactoring planning |
| `asset-optimizer` | Static asset optimization |
| `security-auditor` | OWASP checks, auth testing, SSRF |
| `performance-profiler` | Latency, SLOs, memory analysis |
| `test-generator` | Generate unit/integration tests |

## Non-Destructive Operation Rules

1. **Always create backup branch** before destructive operations
2. **Use `git rm --cached`** to untrack files without deleting locally
3. **Archive before delete** for assets and documentation
4. **Run tests** after each cleanup phase
5. **Commit frequently** with clear messages

## Quick Commands

```bash
# Build and test
npm run build
npm run lint
npx tsc --noEmit

# Security audit
npm audit

# Code quality (new)
npm run clean:code      # Run knip for unused code detection
npm run clean:deps      # Run depcheck for unused dependencies
npm run optimize:images # Optimize PNG icons with Sharp

# Dependency check
npx depcheck --json > /tmp/depcheck.json

# Find large files
find . -type f -size +1M -not -path "./.next/*" -not -path "./node_modules/*" | xargs ls -lh

# Check bundle sizes
npx bundle-phobia-cli [package-name]
```

## Documentation Structure

### Analysis Documents
| Directory | Contents |
|-----------|----------|
| `analysis/flows/` | User flow documentation (backtesting, trading, portfolio, admin) |
| `analysis/gaps/` | Gap analysis (type-safety, test-coverage, accessibility) |
| `analysis/components/` | Component usage matrix |

### Specifications
| Directory | Contents |
|-----------|----------|
| `specs/features/` | Feature specs (email-notifications, futures-trading, mobile-responsive) |
| `specs/gaps/` | Gap fix specs (type-safety-fix, test-infrastructure) |

### Proposals
| Directory | Contents |
|-----------|----------|
| `proposals/` | Enhancement proposals (console-log-removal, type-safety-upgrade, test-coverage-plan) |

### Product Documentation
| Directory | Contents |
|-----------|----------|
| `docs/product/` | Feature matrix, user journeys |
| `docs/api/` | OpenAPI specification |
| `docs/` | MCP API keys guide, futures roadmap |

## Configuration Locations

| File | Purpose |
|------|---------|
| `~/.claude/settings.local.json` | Hooks configuration |
| `~/.claude/agents/` | Custom agents (13 total) |
| `~/.claude/commands/` | Custom commands (15 total) |
| `~/.claude/skills/` | Custom skills (9 total) |
| `.mcp.json` | MCP server configuration |
| `.env` | Environment variables (source of truth) |
