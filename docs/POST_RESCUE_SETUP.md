# AlphaFlow Post-Rescue Setup Guide

Generated: January 2026

## What Was Accomplished

### Size Reduction

- Before: 2.4 GB
- After: 1.8 GB
- Saved: 600 MB (25%)

### Files Cleaned

- AI clutter removed: 121 files
- Root markdown files: 21 reduced to 3
- Dead code removed: OpenTelemetry stack, unused components

### Systems Installed

- CLAUDE.md governance rules (6 critical rules)
- OpenSpec spec-driven development (12 specs)
- Claude Code configuration (.claude/ directory)

## Project Structure

```
alphaflow/
├── CLAUDE.md              # AI governance rules
├── README.md              # Project documentation
├── replit.md              # Replit configuration
├── .claude/               # Claude Code config
│   ├── settings.json      # Permissions
│   ├── commands/          # Custom commands
│   └── hooks/             # Pre-commit hooks
├── openspec/              # Spec-driven development
│   ├── project.md         # Project context
│   ├── specs/             # Approved specifications
│   └── changes/           # Pending proposals
├── app/                   # Next.js frontend
├── components/            # React components
├── server/                # Express backend
├── docs/                  # Documentation
└── mcp-servers/           # Custom MCP server
```

## Governance Rules (CLAUDE.md)

### The 6 Critical Rules

1. SPEC BEFORE CODE - OpenSpec proposal required for features
2. SINGLE RESPONSIBILITY - One task at a time
3. MINIMAL CHANGES - Smallest change that works
4. NO FILE POLLUTION - No \*\_COMPLETE.md files
5. REMOVE BEFORE REPLACE - Delete old before adding new
6. VERIFY BEFORE COMPLETE - Build must pass before done

### Forbidden Patterns

- Never create: _\_COMPLETE.md, _\_IMPLEMENTATION.md, _.bak, _.old
- Never modify: components/ui/ (Shadcn managed)
- Never skip: OpenSpec for new features
- Never force: git push --force

## OpenSpec Workflow

### For New Features

```
Step 1: /openspec:proposal <description>
Step 2: Review and approve the spec
Step 3: /openspec:apply <change-name>
Step 4: /openspec:archive <change-name>
```

### Commands Reference

| Command              | Purpose             |
| -------------------- | ------------------- |
| openspec list        | View active changes |
| openspec show <name> | View change details |
| /openspec:proposal   | Create new proposal |
| /openspec:apply      | Implement change    |
| /openspec:archive    | Complete change     |

## Daily Workflow

### Starting Work

```bash
openspec list              # Check active changes
git status                 # Check git state
npm run build              # Verify build works
```

### During Development

- Follow the 6 rules in CLAUDE.md
- One task at a time
- Test after each change
- Commit frequently

### Ending Work

```bash
npm run build              # Verify build
npm run typecheck          # Check types
git add -A && git commit   # Commit changes
git push origin main       # Push to remote
```

## Maintenance

### Weekly Tasks

```bash
rm -rf .next               # Clear build cache
npm run build              # Fresh build
du -sh .                   # Check size (<2GB)
```

### Monthly Tasks

```bash
npx knip                   # Check unused code
npm outdated               # Check dependencies
```

## Troubleshooting

### Build Fails

```bash
rm -rf .next node_modules
npm install
npm run build
```

### TypeCheck Out of Memory

This is expected for large projects. The build process handles types correctly.

### Dev Server Won't Start

```bash
pkill -f node              # Kill stuck processes
npm run dev                # Restart
```

## Key Files Reference

| File                  | Purpose                |
| --------------------- | ---------------------- |
| CLAUDE.md             | AI assistant rules     |
| openspec/project.md   | Project context for AI |
| .claude/settings.json | Permissions config     |
| package.json          | Dependencies           |
| shared/schema.ts      | Database schema        |

## Support

- Build issues: Check npm run build output
- OpenSpec issues: Run openspec list
- Git issues: Check git status

---

End of Post-Rescue Setup Guide
