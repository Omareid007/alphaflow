# AlphaFlow Quick Reference Card

## Essential Commands

```bash
npm run dev          # Start development
npm run build        # Build project
npm run typecheck    # Check TypeScript
npm run lint         # Check code style
openspec list        # View active specs
```

## OpenSpec Commands

```bash
/openspec:proposal <desc>    # New feature proposal
/openspec:apply <name>       # Implement approved spec
/openspec:archive <name>     # Complete and archive
```

## Git Workflow

```bash
git add -A
git commit -m "type(scope): description"
git push origin main
```

Commit types: feat, fix, docs, style, refactor, test, chore

## The 6 Rules

1. SPEC BEFORE CODE - OpenSpec required
2. SINGLE RESPONSIBILITY - One task only
3. MINIMAL CHANGES - Smallest fix
4. NO FILE POLLUTION - No clutter files
5. REMOVE BEFORE REPLACE - Delete old first
6. VERIFY BEFORE COMPLETE - Prove it works

## Forbidden

- \*\_COMPLETE.md files
- \*\_IMPLEMENTATION.md files
- Modifying components/ui/
- git push --force
- Skipping OpenSpec for features

## Project Size Limits

- Total: Keep under 2 GB
- CLAUDE.md: Keep under 35 KB
- Single files: Keep under 500 lines

## When Stuck

1. STOP - Don't guess
2. EXPLAIN - What's blocking
3. SHOW - Exact error
4. SUGGEST - 2-3 options
5. WAIT - For direction

## Health Check

```bash
du -sh .                    # Size check
git status                  # Git state
openspec list               # Active changes
npm run build               # Build works
```
