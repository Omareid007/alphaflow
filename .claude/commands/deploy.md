# Deploy AlphaFlow

## Pre-deploy Checklist

1. npm run build passes
2. npm run typecheck passes
3. All OpenSpec changes archived
4. No uncommitted files

## Deploy Steps

For Replit: Push to main triggers auto-deploy

```bash
git add -A
git commit -m "deploy: <description>"
git push origin main
```

## Verify Deployment

1. Check app loads in browser
2. Verify Alpaca connection
3. Test a paper trade

## Rollback

```bash
git revert HEAD
git push origin main
```
