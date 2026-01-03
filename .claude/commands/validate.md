# Validate Command - Full Project Health Check

## Run All Checks

```bash
# 1. Build check
npm run build

# 2. Type check
npm run typecheck

# 3. Lint check
npm run lint

# 4. Size check
du -sh .
du -sh node_modules .git .next 2>/dev/null

# 5. Forbidden files check
find . -name "*_COMPLETE.md" -o -name "*_IMPLEMENTATION.md" | grep -v node_modules

# 6. Git status
git status

# 7. OpenSpec status
openspec list
```

## Expected Results

- Build: PASS
- TypeCheck: PASS (or known memory warning)
- Lint: PASS (warnings OK)
- Size: Under 2GB
- Forbidden files: None
- Git: Clean or documented changes
- OpenSpec: No stale changes
