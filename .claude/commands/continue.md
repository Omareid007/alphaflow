# Continue Command - Resume Work After Interruption

## Quick Recovery Steps

### 1. Check Current State

```bash
git status
git log --oneline -3
openspec list
```

### 2. Check for Active Work

```bash
# Any uncommitted changes?
git diff --stat

# Any active OpenSpec changes?
cat openspec/changes/*/tasks.md 2>/dev/null | grep -E "^\s*-\s*\[.\]" | head -20
```

### 3. Check Build Status

```bash
npm run build
```

### 4. Resume Options

If build is broken:

```bash
git stash
npm run build
# If passes: git stash pop
# If fails: investigate before continuing
```

If OpenSpec change in progress:

```bash
openspec show <change-name>
# Continue from last incomplete task
```

If clean state:

```bash
# Ready for new work
# Use /openspec:proposal for new features
```

## Session Recovery Checklist

- [ ] Git status checked
- [ ] Build verified
- [ ] OpenSpec changes reviewed
- [ ] Ready to continue
