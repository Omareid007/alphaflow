# Deploy AlphaFlow

## Pre-deploy

1. npm run build passes
2. npm run typecheck passes
3. No uncommitted files

## Deploy (Replit auto-deploys on push)

```bash
git add -A
git commit -m "deploy: description"
git push origin main
```

## Rollback

```bash
git revert HEAD
git push origin main
```
