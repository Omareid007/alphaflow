# Claude Code Project Configuration

## Project Overview

Trading platform with autonomous strategy management, backtesting, and broker integrations (Alpaca, IBKR).

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

### Remaining Items (Future)
| Item | Priority | Notes |
|------|----------|-------|
| Backtest script consolidation | Low | 19 scripts (~9K lines) → ~4.5K lines possible |
| Remaining vulnerabilities | Medium | glob in eslint-config-next (8 remaining) |

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
| Server | Purpose |
|--------|---------|
| `postgres` | Database queries |
| `sequential-thinking` | Complex problem-solving |
| `memory` | Persistent knowledge graph |
| `filesystem` | Secure file operations |
| `git` | Git repository operations |
| `fetch` | Web content fetching |
| `time` | Time/timezone utilities |

## Custom Skills

Located in `~/.claude/skills/`:
| Skill | Purpose |
|-------|---------|
| `trading-analysis` | Strategy and backtest guidance |
| `alpaca-integration` | Alpaca API patterns |
| `project-structure` | Codebase navigation |

## Backtest Script Analysis

### Consolidation Opportunity
19 scripts (~9,000 lines) with ~50% duplication identified:
- **Extractable modules**: technical-indicators.ts, alpaca-api.ts, backtest-engine.ts, genetic-algorithm.ts
- **Potential savings**: ~4,500 lines of code
- **Strategy**: Create shared modules + base classes

### Script Groups
1. **Backtest Scripts** (4): omar-backtest*.ts
2. **Optimizer Scripts** (11): omar-*optimizer*.ts
3. **Specialized** (4): momentum, pattern, risk, sector-rotation

## Environment Configuration

### Critical: Alpaca Credentials
The `.env` file takes precedence over Replit Secrets via `dotenv.config({ override: true })`.

Verify with: `GET /api/admin/alpaca-account`

## Available Analysis Tools

### Commands (use with `/`)
- `/analyze-codebase` - Full codebase analysis
- `/find-dead-code` - Detect unused code
- `/find-duplicates` - Find code duplication
- `/cleanup-dependencies` - Dependency audit

### Agents (via ~/.claude/agents/)
- `codebase-analyzer` - Structure and pattern analysis
- `dependency-auditor` - Package auditing
- `refactoring-strategist` - Safe refactoring planning
- `asset-optimizer` - Static asset optimization

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

## Configuration Locations

| File | Purpose |
|------|---------|
| `~/.claude/settings.local.json` | Hooks configuration |
| `~/.claude/agents/` | Custom agents |
| `~/.claude/commands/` | Custom commands |
| `~/.claude/skills/` | Custom skills |
| `.mcp.json` | MCP server configuration |
| `.env` | Environment variables (source of truth) |
