# Claude Code Project Configuration

## Project Overview

Trading platform with autonomous strategy management, backtesting, and broker integrations (Alpaca, IBKR).

## Codebase Metrics (as of Dec 2024)

| Metric | Value |
|--------|-------|
| Total Workspace | 2.0 GB |
| Source Code | 535 MB |
| TypeScript/React Files | 501 files |
| Lines of Code | ~151,826 |
| Dependencies | 104 packages |

## Cleanup Status

### Completed (Dec 2024)
- [x] Alpaca account mismatch resolved (dotenv override)
- [x] MCP servers configured (postgres, sequential-thinking, memory, filesystem)
- [x] Analysis agents created (4 agents)
- [x] Analysis commands created (4 commands)
- [x] Safety hooks configured
- [x] `.next/` removed from Git tracking (471 files, ~26K lines)
- [x] Old maintenance scripts removed (9 files, 2774 lines)
- [x] Dependency audit completed

### Remaining Items (Future)
| Item | Priority | Notes |
|------|----------|-------|
| `attached_assets/` cleanup | Medium | 5.1MB screenshots - archive first |
| Backtest script consolidation | Low | 19 similar scripts (~550KB) |
| Next.js upgrade | High | Security vulnerabilities |

## Dependency Audit Results (Dec 29, 2024)

### Potentially Unused Dependencies
| Package | Type | Action |
|---------|------|--------|
| `@radix-ui/react-progress` | prod | Verify usage before removing |
| `autoprefixer` | prod | May be used by PostCSS config |
| `postcss` | prod | May be used by Tailwind |
| `tsconfig-paths` | prod | Check build config |
| `@babel/core` | dev | Check test/build config |
| `@types/cors` | dev | May be needed for types |

### Security Vulnerabilities (8 total)
| Severity | Count | Source |
|----------|-------|--------|
| Critical | 1 | Next.js Authorization Bypass |
| High | 1 | Next.js DoS |
| Moderate | 6 | postcss, zod, Next.js |

**Recommended Action:** Upgrade Next.js from 13.5.1 to latest (breaking changes expected)

### Outdated Packages (Major Updates Available)
| Package | Current | Latest | Breaking Changes |
|---------|---------|--------|------------------|
| next | 13.5.1 | 16.1.1 | Yes - App Router changes |
| react | 18.3.1 | 19.2.3 | Yes - Concurrent features |
| express | 4.22.1 | 5.2.1 | Yes - Middleware changes |
| zod | 3.25.76 | 4.2.1 | Yes - Schema API changes |
| tailwindcss | 3.4.19 | 4.1.18 | Yes - Config format |

## Non-Destructive Operation Rules

1. **Always create backup branch** before destructive operations
2. **Use `git rm --cached`** to untrack files without deleting locally
3. **Archive before delete** for assets and documentation
4. **Run tests** after each cleanup phase
5. **Commit frequently** with clear messages

## Available Analysis Tools

### Commands
- `/analyze-codebase` - Full codebase analysis
- `/find-dead-code` - Detect unused code
- `/find-duplicates` - Find code duplication
- `/cleanup-dependencies` - Dependency audit

### Agents (via ~/.claude/agents/)
- `codebase-analyzer` - Structure and pattern analysis
- `dependency-auditor` - Package auditing
- `refactoring-strategist` - Safe refactoring planning
- `asset-optimizer` - Static asset optimization

## Environment Configuration

### Critical: Alpaca Credentials
The `.env` file takes precedence over Replit Secrets via `dotenv.config({ override: true })`.

Verify with: `GET /api/admin/alpaca-account`

### MCP Servers
Configured in `.mcp.json`:
- `postgres` - Database access
- `sequential-thinking` - Complex analysis
- `memory` - Cross-session findings
- `filesystem` - Workspace access

## Quick Commands

```bash
# Run full analysis
npx depcheck --json > /tmp/depcheck.json

# Find large files
find . -type f -size +1M -not -path "./.next/*" -not -path "./node_modules/*" | xargs ls -lh

# Check bundle sizes
npx bundle-phobia-cli [package-name]

# Security audit
npm audit
```

## Contact

For issues with Claude Code configuration, check:
- `~/.claude/settings.local.json` - Hooks configuration
- `~/.claude/agents/` - Custom agents
- `~/.claude/commands/` - Custom commands
- `.mcp.json` - MCP server configuration
