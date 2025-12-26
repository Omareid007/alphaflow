# API Client Configuration Fix - Summary

## Changes Made

### 1. Next.js API Client (`/lib/api/client.ts`)

**Improvements:**
- ✅ Smart BASE_URL detection with fallbacks
- ✅ SSR-safe URL handling (checks for `window`)
- ✅ Comprehensive request/response logging
- ✅ Enhanced error handling with detailed error messages
- ✅ Path normalization (ensures paths start with `/`)
- ✅ Null/undefined parameter filtering
- ✅ Try-catch blocks around all API methods
- ✅ Detailed error extraction from JSON/text responses

**Key Features:**
```typescript
// Automatic configuration
const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === 'undefined') return ''; // SSR
  return window.location.origin; // Client-side
};

// Comprehensive logging
console.log('[API Client] GET request:', { path, url, params });
console.log('[API Client] GET response:', { status, ok });
console.error('[API Client] GET error:', { path, error });
```

### 2. React Native API Client (`/client/lib/query-client.ts`)

**Improvements:**
- ✅ Enhanced logging for all requests/responses
- ✅ Better error handling in throwIfResNotOk
- ✅ Detailed retry logic with logging
- ✅ Improved query function with try-catch
- ✅ Network mode configuration

**Key Features:**
```typescript
// Logging throughout
console.log('[API Client - RN] Request:', { method, route, url });
console.log('[API Client - RN] Response:', { status, ok });
console.log('[QueryClient - RN] Retry check:', { failureCount, error });
```

### 3. React Query Provider (`/components/providers/query-provider.tsx`)

**Improvements:**
- ✅ Detailed retry logging
- ✅ Better error categorization
- ✅ Network mode configuration
- ✅ Initialization logging
- ✅ Exponential backoff with logging

**Configuration:**
```typescript
queries: {
  staleTime: 60 * 1000,           // 1 minute
  retry: 2,                        // Up to 2 retries
  retryDelay: exponential,         // 1s, 2s, 4s...
  networkMode: 'online',
}

mutations: {
  retry: 1,                        // Up to 1 retry
  networkMode: 'online',
}
```

### 4. Next.js Configuration (`/next.config.js`)

**Improvements:**
- ✅ Dynamic API target based on environment
- ✅ Logging of rewrite configuration
- ✅ CORS headers for API routes
- ✅ Support for all HTTP methods

**Configuration:**
```javascript
async rewrites() {
  const apiTarget = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  return [
    {
      source: '/api/:path*',
      destination: `${apiTarget}/api/:path*`,
    },
  ];
}
```

### 5. Debugging Tools

#### Connectivity Test Utility (`/lib/api/connectivity-test.ts`)
- ✅ Full test suite for all endpoints
- ✅ Quick connectivity check
- ✅ Configuration logging
- ✅ Performance timing
- ✅ Detailed reporting

#### API Debug Panel (`/components/debug/api-debug-panel.tsx`)
- ✅ Floating debug button
- ✅ Quick connection check
- ✅ Full test suite runner
- ✅ Configuration logger
- ✅ Visual test results

### 6. Documentation

Created comprehensive documentation:
- ✅ `/docs/API_CLIENT_CONFIGURATION.md` - Full guide
- ✅ `/API_CLIENT_QUICK_REFERENCE.md` - Quick reference card

## How to Use

### Basic Setup

1. **No configuration needed!** The system auto-detects the correct URLs.

2. **Optional**: Set environment variable for custom API URL:
   ```bash
   NEXT_PUBLIC_API_URL=http://your-api-server:5000
   ```

### Making API Calls

```typescript
import { api } from '@/lib/api';

// Simple GET
const positions = await api.get('/api/positions');

// GET with params
const trades = await api.get('/api/trades', {
  params: { limit: 10, offset: 0 }
});

// POST with data
const order = await api.post('/api/orders', {
  symbol: 'AAPL',
  qty: 10,
  side: 'buy'
});
```

### Using React Query Hooks

```typescript
import { usePortfolioSnapshot, usePositions } from '@/lib/api';

function Portfolio() {
  const { data, isLoading, error } = usePortfolioSnapshot();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>Portfolio Value: ${data.portfolioValue}</div>;
}
```

### Debugging

#### Add Debug Panel

```typescript
import { ApiDebugPanel } from '@/components/debug/api-debug-panel';

export default function Page() {
  return (
    <>
      <YourContent />
      <ApiDebugPanel />
    </>
  );
}
```

#### Run Tests Programmatically

```typescript
import { runConnectivityTest, quickConnectivityCheck } from '@/lib/api';

// Quick check
const isConnected = await quickConnectivityCheck();

// Full test
const report = await runConnectivityTest();
console.log('Pass rate:', report.summary.passRate);
```

## Logging Output

### Startup Logs

```
[API Client] Configuration: {
  baseUrl: "http://localhost:3000",
  origin: "http://localhost:3000",
  env: "development"
}
[Next.js] API rewrites configured for: http://localhost:5000
[QueryProvider] Initialized with configuration: {...}
```

### Request Logs

```
[API Client] GET request: {
  path: "/api/positions",
  url: "http://localhost:3000/api/positions",
  params: undefined
}
[API Client] GET response: {
  path: "/api/positions",
  status: 200,
  statusText: "OK",
  ok: true
}
```

### Error Logs

```
[API Client] Request failed: {
  status: 404,
  statusText: "Not Found",
  url: "http://localhost:3000/api/invalid",
  errorText: "Route not found",
  errorData: {...}
}
```

### Retry Logs

```
[QueryProvider] Query retry check: {
  failureCount: 1,
  error: "500: Internal Server Error"
}
[QueryProvider] Retry decision: true
[QueryProvider] Retry delay: { attemptIndex: 1, delay: 2000 }
```

## Testing Checklist

Before deploying:

- [ ] Start both servers: `npm run dev`
- [ ] Open browser to `http://localhost:3000`
- [ ] Open DevTools Console
- [ ] Verify API Client logs appear
- [ ] Add `<ApiDebugPanel />` to a page
- [ ] Click "Run Full Test Suite"
- [ ] Verify all tests pass
- [ ] Check for CORS errors (should be none)
- [ ] Test creating/updating data via API
- [ ] Verify retry logic on failed requests

## Troubleshooting

### Issue: No Logs in Console

**Solution**: Ensure you're on the client-side. Logs only appear in browser console, not server logs.

### Issue: CORS Errors

**Solution**:
1. Check Express CORS middleware in `/server/index.ts`
2. Verify `credentials: 'include'` in API calls
3. Check Replit domain is in allowed origins

### Issue: 404 on All API Calls

**Solution**:
1. Verify Next.js is running on port 3000
2. Verify Express is running on port 5000
3. Check Next.js rewrites in `next.config.js`
4. Ensure API routes start with `/api/`

### Issue: Connection Refused

**Solution**:
1. Check both servers are running
2. Verify ports (3000, 5000)
3. Run connectivity test: `await quickConnectivityCheck()`

## Benefits

### Developer Experience
- ✅ Automatic URL configuration
- ✅ Comprehensive error messages
- ✅ Visual debugging tools
- ✅ Clear logging throughout
- ✅ Type-safe API calls

### Reliability
- ✅ Smart retry logic
- ✅ Exponential backoff
- ✅ Proper error handling
- ✅ Network status awareness

### Debugging
- ✅ Request/response logging
- ✅ Connectivity testing
- ✅ Configuration inspection
- ✅ Visual debug panel

### Production Ready
- ✅ SSR-safe
- ✅ CORS configured
- ✅ Proper credential handling
- ✅ Environment-aware

## Next Steps

1. **Deploy to Replit**: Everything is configured and ready
2. **Monitor logs**: Check browser console for API activity
3. **Use debug panel**: Add to pages during development
4. **Read docs**: See `/docs/API_CLIENT_CONFIGURATION.md` for details

## Files Modified

```
✓ /lib/api/client.ts                    - Enhanced with logging
✓ /lib/api/index.ts                     - Added exports
✓ /client/lib/query-client.ts           - Enhanced with logging
✓ /components/providers/query-provider.tsx - Enhanced with logging
✓ /next.config.js                       - Added dynamic rewrites
```

## Files Created

```
+ /lib/api/connectivity-test.ts         - Testing utilities
+ /components/debug/api-debug-panel.tsx - Debug UI component
+ /docs/API_CLIENT_CONFIGURATION.md     - Full documentation
+ /API_CLIENT_QUICK_REFERENCE.md        - Quick reference
+ /API_CLIENT_FIX_SUMMARY.md            - This file
```

## Success Metrics

The fix is successful when:
- ✅ All API calls work correctly
- ✅ Logs appear in console showing requests/responses
- ✅ Debug panel shows 100% pass rate
- ✅ No CORS errors in console
- ✅ Retry logic works on failures
- ✅ Both client and server can communicate

## Support

For issues or questions:
1. Check browser console logs
2. Run debug panel tests
3. Review documentation in `/docs/`
4. Check quick reference card
5. Verify both servers are running
