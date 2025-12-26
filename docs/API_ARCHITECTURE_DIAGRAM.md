# API Client Architecture Diagram

## Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser / Client                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  React Component                                            │  │
│  │  ────────────────                                           │  │
│  │  const { data } = usePortfolioSnapshot()                   │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  React Query Hook (/lib/api/hooks/usePortfolio.ts)         │  │
│  │  ──────────────────────────────────────────────────────────  │  │
│  │  useQuery({                                                 │  │
│  │    queryKey: ['portfolio', 'snapshot'],                     │  │
│  │    queryFn: () => api.get('/api/positions/snapshot')        │  │
│  │  })                                                          │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  API Client (/lib/api/client.ts)                           │  │
│  │  ────────────────────────────────────────────────────────── │  │
│  │  console.log('[API Client] GET request:', {...})           │  │
│  │                                                              │  │
│  │  fetch(url, {                                               │  │
│  │    method: 'GET',                                           │  │
│  │    credentials: 'include',                                  │  │
│  │    headers: { 'Content-Type': 'application/json' }          │  │
│  │  })                                                          │  │
│  │                                                              │  │
│  │  console.log('[API Client] GET response:', {...})          │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Browser Fetch API                                          │  │
│  │  GET http://localhost:3000/api/positions/snapshot           │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │                                         │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            │ HTTP Request
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Next.js Server (Port 3000)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Next.js Rewrites (next.config.js)                         │  │
│  │  ──────────────────────────────────────────────────────────  │  │
│  │  /api/:path* → http://localhost:5000/api/:path*            │  │
│  │                                                              │  │
│  │  console.log('[Next.js] API rewrites configured')          │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │                                         │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            │ Proxied Request
                            │ GET http://localhost:5000/api/positions/snapshot
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Express Server (Port 5000)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  CORS Middleware (server/index.ts)                         │  │
│  │  ──────────────────────────────────────────────────────────  │  │
│  │  - Check origin                                             │  │
│  │  - Set CORS headers                                         │  │
│  │  - Allow credentials                                        │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Route Handler (server/routes.ts)                          │  │
│  │  ──────────────────────────────────────────────────────────  │  │
│  │  GET /api/positions/snapshot                               │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Business Logic                                             │  │
│  │  - Fetch from Alpaca API                                    │  │
│  │  - Process data                                             │  │
│  │  - Format response                                          │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Response                                                   │  │
│  │  {                                                           │  │
│  │    totalEquity: 100000,                                     │  │
│  │    portfolioValue: 100000,                                  │  │
│  │    positions: [...]                                         │  │
│  │  }                                                           │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │                                         │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            │ HTTP Response (200 OK)
                            │ JSON Data
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser / Client                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  API Client (/lib/api/client.ts)                           │  │
│  │  ──────────────────────────────────────────────────────────  │  │
│  │  console.log('[API Client] GET response:', {               │  │
│  │    status: 200,                                             │  │
│  │    ok: true                                                 │  │
│  │  })                                                          │  │
│  │                                                              │  │
│  │  return response.json()                                     │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  React Query                                                │  │
│  │  - Cache data                                               │  │
│  │  - Update component                                         │  │
│  │  - Trigger re-render                                        │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  React Component                                            │  │
│  │  - Render with data                                         │  │
│  │  - Display to user                                          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Request Fails (Network Error)                    │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  API Client (/lib/api/client.ts)                                   │
│  ─────────────────────────────────────────────────────────────────  │
│  catch (error) {                                                    │
│    console.error('[API Client] GET error:', { path, error })       │
│    throw error  // Pass to React Query                             │
│  }                                                                  │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Query Provider (/components/providers/query-provider.tsx)         │
│  ─────────────────────────────────────────────────────────────────  │
│  retry: (failureCount, error) => {                                 │
│    console.log('[QueryProvider] Query retry check')                │
│                                                                     │
│    // Don't retry auth errors                                      │
│    if (error includes '401' or '403') return false                 │
│                                                                     │
│    // Retry up to 2 times                                          │
│    return failureCount < 2                                         │
│  }                                                                  │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Retry Delay Calculation                                            │
│  ─────────────────────────────────────────────────────────────────  │
│  Attempt 1: Wait 1000ms  (2^0 * 1000)                              │
│  Attempt 2: Wait 2000ms  (2^1 * 1000)                              │
│  Attempt 3: Wait 4000ms  (2^2 * 1000)                              │
│  Max delay: 30000ms                                                 │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
                    Retry Request
                    or Show Error
```

## Component Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        Application Layout                         │
│                      (app/layout.tsx)                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  QueryProvider                                              │ │
│  │  (/components/providers/query-provider.tsx)                 │ │
│  │  ┌───────────────────────────────────────────────────────┐ │ │
│  │  │  QueryClient Configuration                            │ │ │
│  │  │  - Retry logic                                        │ │ │
│  │  │  - Cache settings                                     │ │ │
│  │  │  - Refetch behavior                                   │ │ │
│  │  └───────────────────────────────────────────────────────┘ │ │
│  │                                                              │ │
│  │  ┌───────────────────────────────────────────────────────┐ │ │
│  │  │  Page Component                                       │ │ │
│  │  │  ┌─────────────────────────────────────────────────┐ │ │ │
│  │  │  │  Business Component                             │ │ │ │
│  │  │  │  - usePortfolioSnapshot()                       │ │ │ │
│  │  │  │  - usePositions()                               │ │ │ │
│  │  │  │  - useStrategies()                              │ │ │ │
│  │  │  └─────────────────────────────────────────────────┘ │ │ │
│  │  │  ┌─────────────────────────────────────────────────┐ │ │ │
│  │  │  │  ApiDebugPanel (Development)                    │ │ │ │
│  │  │  │  - Quick connectivity check                     │ │ │ │
│  │  │  │  - Full test suite                              │ │ │ │
│  │  │  │  - Configuration logging                        │ │ │ │
│  │  │  └─────────────────────────────────────────────────┘ │ │ │
│  │  └───────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

## File Structure

```
project/
│
├── app/                                 # Next.js app directory
│   ├── layout.tsx                      # Root layout with QueryProvider
│   └── */page.tsx                      # Individual pages
│
├── lib/
│   └── api/
│       ├── client.ts                   # Main API client
│       ├── index.ts                    # Public exports
│       ├── connectivity-test.ts        # Testing utilities
│       └── hooks/                      # React Query hooks
│           ├── index.ts
│           ├── usePortfolio.ts
│           ├── useStrategies.ts
│           ├── useOrders.ts
│           ├── useWatchlists.ts
│           ├── useAiDecisions.ts
│           └── useBacktests.ts
│
├── components/
│   ├── providers/
│   │   └── query-provider.tsx          # QueryClient provider
│   └── debug/
│       └── api-debug-panel.tsx         # Debug UI component
│
├── client/                              # React Native client
│   └── lib/
│       └── query-client.ts             # RN API client
│
├── server/
│   ├── index.ts                        # Express server setup
│   └── routes.ts                       # API route handlers
│
├── next.config.js                      # Next.js configuration
└── docs/
    └── API_CLIENT_CONFIGURATION.md     # Documentation
```

## Logging Tags

All logs use consistent prefixes for easy filtering:

```
[API Client]         - Next.js API client operations
[API Client - RN]    - React Native API client operations
[QueryProvider]      - React Query provider logs
[QueryClient - RN]   - React Native query client logs
[Next.js]           - Next.js configuration logs
[Connectivity Check] - Connectivity test logs
```

## Environment Detection

```
┌─────────────────────────────────────┐
│  API Base URL Determination         │
└─────────────────────────────────────┘
           │
           ▼
    ┌──────────────┐
    │ Check ENV    │
    │ NEXT_PUBLIC  │
    │ _API_URL     │
    └──────┬───────┘
           │
           │ Not Set
           ▼
    ┌──────────────┐
    │ Check if SSR │
    │ (no window)  │
    └──────┬───────┘
           │
           │ Client-side
           ▼
    ┌──────────────┐
    │ Use window   │
    │ .location    │
    │ .origin      │
    └──────────────┘
```

## Production Deployment (Replit)

```
┌─────────────────────────────────────────────────────────┐
│                    Replit Container                     │
│                                                         │
│  ┌──────────────┐              ┌──────────────┐       │
│  │  Next.js     │              │  Express     │       │
│  │  Port 3000   │─────────────▶│  Port 5000   │       │
│  │              │   Rewrites   │              │       │
│  │  /api/* ─────┼─────────────▶│  /api/*      │       │
│  └──────┬───────┘              └──────┬───────┘       │
│         │                              │               │
│         └──────────────┬───────────────┘               │
│                        │                               │
└────────────────────────┼───────────────────────────────┘
                         │
                         │ Replit Proxy
                         │
                         ▼
              ┌──────────────────┐
              │   Public URL     │
              │ your-app.repl.co │
              └──────────────────┘
```
