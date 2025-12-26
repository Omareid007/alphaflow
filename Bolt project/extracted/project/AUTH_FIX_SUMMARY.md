# Authentication Fix Summary

## Problem
The API endpoints were returning "Not authenticated" errors in development mode, blocking the frontend from loading data.

## Root Cause
Three authentication-related issues:

1. **authMiddleware blocking all requests**: While there was a development bypass in place, it wasn't properly logging or handling all edge cases.

2. **requireCapability middleware failing**: The `requireCapability` middleware was trying to load a user with ID "dev-user" from the database, which doesn't exist. This caused 401 errors for admin endpoints.

3. **adminTokenMiddleware blocking requests**: Similar to authMiddleware, it needed a development bypass.

## Solutions Applied

### 1. Enhanced authMiddleware (line 116-138)
- Added logging to show when development bypass is active
- Ensures `req.userId = "dev-user"` is set for all unauthenticated requests in development

### 2. Updated adminTokenMiddleware (line 140-165)
- Added development mode bypass
- Logs when authentication is bypassed
- Sets `req.userId = "dev-user"` for development

### 3. Fixed requireCapability (line 167-195)
- Added special handling for "dev-user" in development mode
- Creates a mock RBAC context with superadmin capabilities
- Bypasses database lookup for dev user
- Logs capability checks being bypassed

## Testing

The following endpoints should now work without authentication in development:

1. `GET /api/strategies` - Lists all strategies
2. `GET /api/positions/snapshot` - Returns portfolio snapshot
3. `GET /api/ai/events` - Returns AI decision events

## Development Mode Detection

Development mode is active when:
- `process.env.NODE_ENV !== "production"`
- OR `NODE_ENV` is not set (default behavior)

## Security Note

These changes ONLY affect development mode. In production (when `NODE_ENV=production`):
- All authentication checks remain active
- Session cookies are required
- Admin tokens are enforced
- RBAC capabilities are checked
