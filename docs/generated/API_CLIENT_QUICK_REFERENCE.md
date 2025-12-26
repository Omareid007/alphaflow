# API Client - Quick Reference

## File Locations

```
/lib/api/client.ts              - Next.js API client
/client/lib/query-client.ts     - React Native API client
/lib/api/hooks/                 - React Query hooks
/components/providers/query-provider.tsx - Query provider
/next.config.js                 - Next.js API rewrites
/server/index.ts               - Express server with CORS
```

## Quick Start

### 1. Import API Client

```typescript
import { api } from '@/lib/api';
```

### 2. Make API Calls

```typescript
// GET
const positions = await api.get('/api/positions');

// POST
const order = await api.post('/api/orders', { symbol: 'AAPL', qty: 10 });

// PUT
const updated = await api.put('/api/strategies/123', { enabled: true });

// DELETE
await api.delete('/api/watchlists/456');
```

### 3. Use React Query Hooks

```typescript
import { usePortfolioSnapshot, usePositions, useStrategies } from '@/lib/api';

const { data, isLoading, error } = usePortfolioSnapshot();
```

## Debugging

### Add Debug Panel to Any Page

```typescript
import { ApiDebugPanel } from '@/components/debug/api-debug-panel';

export default function Page() {
  return (
    <>
      {/* Your content */}
      <ApiDebugPanel />
    </>
  );
}
```

### Console Commands

Open browser console and run:

```javascript
// Quick connectivity check
import { quickConnectivityCheck } from '@/lib/api';
await quickConnectivityCheck();

// Full test suite
import { runConnectivityTest } from '@/lib/api';
const report = await runConnectivityTest();

// Log configuration
import { logApiConfiguration } from '@/lib/api';
logApiConfiguration();
```

## Configuration

### Environment Variables

```bash
# Optional - defaults to same-origin
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Ports

- Next.js: **3000**
- Express: **5000**

### Start Servers

```bash
# Both servers
npm run dev

# Individual servers
npm run dev:client  # Next.js on 3000
npm run dev:server  # Express on 5000
```

## Common Patterns

### Error Handling

```typescript
import { ApiError } from '@/lib/api';

try {
  const data = await api.get('/api/endpoint');
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.status, error.message);
  }
}
```

### Query with Parameters

```typescript
const data = await api.get('/api/trades', {
  params: { limit: 10, offset: 0 }
});
```

### Mutation with React Query

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: (data) => api.post('/api/orders', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  },
});
```

## Logging

All requests are automatically logged:

```
[API Client] Configuration: { baseUrl: "...", origin: "...", env: "..." }
[API Client] GET request: { path: "/api/positions", url: "...", params: {...} }
[API Client] GET response: { path: "/api/positions", status: 200, ok: true }
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Check Express CORS config in `/server/index.ts` |
| 404 errors | Verify Next.js rewrites in `/next.config.js` |
| Connection refused | Ensure Express server is running on port 5000 |
| Auth errors | Check credentials: 'include' in fetch calls |

## Available Hooks

```typescript
// Portfolio
usePortfolioSnapshot()
usePositions()
useAccountInfo()
useTrades(options)
useTradesBySymbol(symbol)

// Strategies
useStrategies()
useStrategy(id)
useCreateStrategy()
useUpdateStrategy()
useDeleteStrategy()

// Orders
useOrders(options)
usePendingOrders()
useCreateOrder()
useCancelOrder()

// Watchlists
useWatchlists()
useWatchlist(id)
useCreateWatchlist()
useUpdateWatchlist()
useDeleteWatchlist()

// AI Decisions
useAiDecisions(options)
useAiDecision(id)

// Backtests
useBacktests(options)
useBacktest(id)
useCreateBacktest()

// Settings
useSettings()
useUpdateSettings()
```

## React Query Config

```typescript
// Queries
staleTime: 60s (Next.js) / Infinity (RN)
retry: 2 times (not for auth errors)
refetchOnWindowFocus: false

// Mutations
retry: 1 time (not for client errors)
```

## API Endpoints Reference

```
GET    /api/health
GET    /api/alpaca/account
GET    /api/positions
GET    /api/positions/snapshot
GET    /api/strategies
POST   /api/strategies
PUT    /api/strategies/:id
DELETE /api/strategies/:id
GET    /api/orders
POST   /api/orders
DELETE /api/orders/:id
GET    /api/watchlists
POST   /api/watchlists
PUT    /api/watchlists/:id
DELETE /api/watchlists/:id
GET    /api/ai/decisions
GET    /api/backtests
POST   /api/backtests
```

## Testing Workflow

1. Start servers: `npm run dev`
2. Open `http://localhost:3000`
3. Add `<ApiDebugPanel />` to page
4. Click "Run Full Test Suite"
5. Check console for detailed logs
6. Fix any failed tests

## Need Help?

See full documentation: `/docs/API_CLIENT_CONFIGURATION.md`
