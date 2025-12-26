# API Client Configuration Guide

## Overview

The AlphaFlow trading platform uses different API client configurations for Next.js (web) and React Native (mobile) applications. This guide explains how the API connectivity works and how to debug issues.

## Architecture

### Next.js Web Client (`/lib/api/client.ts`)

The Next.js client uses a modern fetch-based API with the following features:

- **Base URL Detection**: Automatically uses `window.location.origin` for same-origin requests
- **Next.js Rewrites**: `/api/*` requests are automatically proxied to the Express backend (port 5000)
- **SSR Support**: Works both server-side and client-side
- **Comprehensive Logging**: All requests and responses are logged for debugging
- **Error Handling**: Detailed error messages with status codes

### React Native Client (`/client/lib/query-client.ts`)

The React Native client is designed for mobile apps:

- **Environment-based URLs**: Uses `EXPO_PUBLIC_DOMAIN` for native apps
- **Browser Fallback**: Falls back to `window.location.origin` when running in web view
- **Credential Support**: Includes credentials for authentication

## Configuration

### Environment Variables

#### Next.js (Optional)

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000  # Optional, defaults to same-origin
```

#### React Native (Required for Native Apps)

```bash
EXPO_PUBLIC_DOMAIN=your-replit-domain.repl.co
```

### Next.js Configuration

The `next.config.js` file handles API proxying:

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

### Backend Server Configuration

The Express server (port 5000) handles CORS properly:

- Accepts requests from Replit domains
- Allows credentials
- Handles OPTIONS preflight requests

## Request Flow

### Development (Local)

```
Browser -> Next.js (port 3000) -> Rewrite /api/* -> Express (port 5000)
```

### Production (Replit)

```
Browser -> Next.js (port 3000) -> Rewrite /api/* -> Express (port 5000)
```

Both running on the same host, different ports.

## API Client Usage

### Basic Usage

```typescript
import { api } from '@/lib/api';

// GET request
const data = await api.get<ResponseType>('/api/endpoint');

// POST request
const result = await api.post<ResponseType>('/api/endpoint', { data });

// PUT request
const updated = await api.put<ResponseType>('/api/endpoint', { data });

// DELETE request
await api.delete('/api/endpoint');

// PATCH request
const patched = await api.patch<ResponseType>('/api/endpoint', { data });
```

### Using React Query Hooks

```typescript
import { usePortfolioSnapshot } from '@/lib/api';

function MyComponent() {
  const { data, isLoading, error } = usePortfolioSnapshot();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>Portfolio Value: {data.portfolioValue}</div>;
}
```

## React Query Configuration

### Retry Logic

#### Queries
- Retries up to 2 times for server errors (5xx)
- Does NOT retry for authentication errors (401, 403)
- Exponential backoff: 1s, 2s, 4s... up to 30s

#### Mutations
- Retries once for server errors (5xx)
- Does NOT retry for client errors (4xx)

### Caching
- **Stale Time**: 60 seconds (Next.js), Infinity (React Native)
- **GC Time**: 5 minutes
- **Refetch on Window Focus**: Disabled
- **Refetch on Mount**: Always (Next.js), false (React Native)

## Debugging

### Logging

All API calls are automatically logged to the browser console:

```
[API Client] Configuration: { baseUrl: "http://localhost:3000", origin: "http://localhost:3000", env: "development" }
[API Client] GET request: { path: "/api/positions", url: "http://localhost:3000/api/positions", params: undefined }
[API Client] GET response: { path: "/api/positions", status: 200, statusText: "OK", ok: true }
```

### Connectivity Testing

Use the built-in connectivity test utilities:

```typescript
import { runConnectivityTest, quickConnectivityCheck, logApiConfiguration } from '@/lib/api';

// Quick check
const isConnected = await quickConnectivityCheck();

// Full test suite
const report = await runConnectivityTest();
console.log('Pass rate:', report.summary.passRate);

// Log current configuration
logApiConfiguration();
```

### API Debug Panel

Add the debug panel to any page:

```typescript
import { ApiDebugPanel } from '@/components/debug/api-debug-panel';

export default function Page() {
  return (
    <>
      {/* Your page content */}
      <ApiDebugPanel />
    </>
  );
}
```

This adds a floating button in the bottom-right corner with:
- Quick connection check
- Full test suite
- Configuration logging

### Common Issues

#### 1. CORS Errors

**Symptom**: `Access-Control-Allow-Origin` errors in console

**Solution**:
- Ensure Express CORS middleware is configured
- Check that `credentials: 'include'` is set in fetch calls
- Verify Replit domain is in allowed origins

#### 2. 404 Errors

**Symptom**: All API calls return 404

**Solution**:
- Check Next.js rewrites in `next.config.js`
- Verify Express server is running on port 5000
- Check that API routes start with `/api/`

#### 3. Network Errors

**Symptom**: `Failed to fetch` or `Network request failed`

**Solution**:
- Verify backend server is running
- Check port configuration (3000 for Next.js, 5000 for Express)
- Test connectivity with debug panel

#### 4. Authentication Errors

**Symptom**: Persistent 401/403 errors

**Solution**:
- Ensure cookies are enabled
- Check `credentials: 'include'` is set
- Verify session middleware is configured

## Testing Checklist

Before deploying, verify:

- [ ] Backend server starts successfully on port 5000
- [ ] Next.js dev server starts on port 3000
- [ ] `/api/health` endpoint returns 200
- [ ] `/api/positions` endpoint returns data
- [ ] Browser console shows API client logs
- [ ] No CORS errors in console
- [ ] Authentication works (if implemented)
- [ ] Retry logic works for failed requests

## Development Workflow

1. **Start Backend**:
   ```bash
   npm run dev:server
   ```

2. **Start Frontend**:
   ```bash
   npm run dev:client
   ```

3. **Open Browser**:
   - Navigate to `http://localhost:3000`
   - Open DevTools console
   - Check for API client initialization logs

4. **Test API**:
   - Add `<ApiDebugPanel />` to a page
   - Click "Run Full Test Suite"
   - Review results in console

## Production Deployment

In production (Replit):

1. Both servers run concurrently via `npm start`
2. Next.js serves on port 3000
3. Express serves on port 5000
4. Replit proxy handles external access
5. All API calls use same-origin (no CORS needed)

## Reference

### API Endpoints

Common endpoints:
- `GET /api/health` - Health check
- `GET /api/alpaca/account` - Account information
- `GET /api/positions` - Current positions
- `GET /api/positions/snapshot` - Portfolio snapshot
- `GET /api/strategies` - Trading strategies
- `GET /api/watchlists` - Watchlists
- `GET /api/orders` - Orders history
- `POST /api/orders` - Create order
- `GET /api/ai/decisions` - AI decisions

### Type Definitions

```typescript
interface ApiError {
  status: number;
  statusText: string;
  message?: string;
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}
```

## Contributing

When adding new API endpoints:

1. Add the endpoint to the Express router
2. Create a hook in `/lib/api/hooks/`
3. Export from `/lib/api/hooks/index.ts`
4. Add TypeScript types
5. Test with debug panel
6. Update this documentation
