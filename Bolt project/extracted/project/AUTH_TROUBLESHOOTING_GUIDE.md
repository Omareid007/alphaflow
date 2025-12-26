# Authentication Troubleshooting Guide

## Quick Verification

### 1. Check Server Logs on Startup

When the server starts, you should see:
```
[Routes] Starting route registration...
[Routes] Environment: DEVELOPMENT
[Routes] Authentication: BYPASSED (dev mode)
```

If you see `PRODUCTION` or `ENABLED`, check your NODE_ENV setting.

### 2. Check Request Logs

When making API requests in development, you should see:
```
[Auth] Development mode - bypassing authentication for: GET /api/strategies
```

### 3. Test Endpoints

Run the test script:
```bash
npx tsx scripts/test-auth-endpoints.ts
```

Or manually test with curl:
```bash
# Test strategies endpoint
curl http://localhost:3000/api/strategies

# Test positions endpoint
curl http://localhost:3000/api/positions/snapshot

# Test AI events endpoint
curl http://localhost:3000/api/ai/events?limit=5
```

## Common Issues and Solutions

### Issue 1: Still getting "Not authenticated" errors

**Possible Causes:**
1. NODE_ENV is set to "production"
2. Server hasn't been restarted after code changes
3. Caching issues in browser

**Solutions:**
```bash
# Verify NODE_ENV
echo $NODE_ENV

# If set to production, unset it
unset NODE_ENV

# Restart the server
npm run dev
```

### Issue 2: "User not found" errors on admin endpoints

**Cause:** The requireCapability middleware is trying to load "dev-user" from database

**Solution:** This should be fixed by the code changes. Verify you see:
```
[Auth] Development mode - bypassing capability check for: [...capabilities...]
```

### Issue 3: Frontend still showing loading spinner

**Possible Causes:**
1. Frontend is caching old responses
2. API URL mismatch
3. CORS issues

**Solutions:**
```bash
# Clear browser cache and hard reload (Ctrl+Shift+R)

# Check browser console for actual error messages

# Verify API is responding
curl -v http://localhost:3000/api/strategies
```

### Issue 4: Routes not found (404 errors)

**Possible Causes:**
1. Router mounting order
2. Typo in URL
3. Route not registered

**Solutions:**
1. Check the server logs to see if routes are being registered
2. Verify the exact URL path in browser network tab
3. Check routes.ts for the endpoint definition

## Production Deployment Checklist

Before deploying to production:

1. **Set NODE_ENV=production**
   ```bash
   export NODE_ENV=production
   ```

2. **Verify authentication is enabled**
   - Server logs should show: `[Routes] Environment: PRODUCTION`
   - Server logs should show: `[Routes] Authentication: ENABLED`

3. **Test authentication**
   - Verify unauthenticated requests return 401
   - Test login flow works
   - Verify session cookies are set

4. **Security checks**
   - Ensure ADMIN_TOKEN is set and secure
   - Verify cookies have secure flag
   - Check CORS settings are restrictive

## Environment Variables

### Development (Default)
```bash
# NODE_ENV not set OR
NODE_ENV=development

# Authentication bypassed
# All API endpoints accessible without session
```

### Production
```bash
NODE_ENV=production
ADMIN_TOKEN=your-secure-token-here

# Authentication required
# Session or admin token needed for all protected routes
```

## Code Changes Made

### 1. authMiddleware (routes.ts:116-138)
- Added development mode bypass
- Logs all bypassed requests
- Sets req.userId = "dev-user"

### 2. adminTokenMiddleware (routes.ts:140-165)
- Added development mode bypass
- Logs all bypassed requests
- Sets req.userId = "dev-user"

### 3. requireCapability (routes.ts:167-195)
- Special handling for "dev-user"
- Creates mock RBAC context with superadmin capabilities
- Bypasses database lookup in development

### 4. Startup logging (routes.ts:206-208)
- Logs environment mode
- Logs authentication status
- Helps with debugging

## Files Modified

1. `/home/runner/workspace/Bolt project/extracted/project/server/routes.ts`
   - Enhanced authMiddleware
   - Enhanced adminTokenMiddleware
   - Enhanced requireCapability
   - Added startup logging

## Testing

### Automated Tests
```bash
# Run the test script
npx tsx scripts/test-auth-endpoints.ts
```

### Manual Tests
```bash
# Start the server
npm run dev

# In another terminal, test endpoints
curl http://localhost:3000/api/strategies
curl http://localhost:3000/api/positions/snapshot
curl http://localhost:3000/api/ai/events?limit=5
curl http://localhost:3000/api/admin/modules
```

### Frontend Tests
1. Open browser to http://localhost:3000
2. Open DevTools Network tab
3. Verify API calls succeed (200 status)
4. Verify data loads on frontend
5. Check console for errors

## Support

If you're still experiencing issues:

1. Check server logs for error messages
2. Check browser console for frontend errors
3. Verify server is running on expected port
4. Check network tab for actual response status/data
5. Try the test script to isolate backend vs frontend issues
