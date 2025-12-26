# Before vs After: Error Handling Comparison

## The Problem

### Before (Infinite Loading)
```typescript
export default function HomePage() {
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolioSnapshot();
  const { data: strategies = [], isLoading: strategiesLoading } = useStrategies();
  const { data: events = [], isLoading: eventsLoading } = useAiEvents({ limit: 10 });

  const loading = portfolioLoading || strategiesLoading || eventsLoading;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ... rest of component
}
```

**What happens when API fails:**
- ❌ `isLoading` stays `true` forever
- ❌ Error is never checked
- ❌ User sees spinning loader indefinitely
- ❌ No way to retry or recover
- ❌ No error message shown

### After (Proper Error Handling)
```typescript
export default function HomePage() {
  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio
  } = usePortfolioSnapshot();

  const {
    data: strategies = [],
    isLoading: strategiesLoading,
    error: strategiesError,
    refetch: refetchStrategies
  } = useStrategies();

  const {
    data: events = [],
    isLoading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents
  } = useAiEvents({ limit: 10 });

  const loading = portfolioLoading || strategiesLoading || eventsLoading;
  const hasError = portfolioError || strategiesError || eventsError;

  // Show loading only if nothing has loaded yet
  if (loading && !portfolio && strategies.length === 0 && events.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Handle critical errors (all data failed to load)
  if (hasError && !portfolio && strategies.length === 0 && events.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Overview of your trading performance
          </p>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-8">
          <div className="flex flex-col items-center text-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h3 className="mt-4 text-lg font-semibold">Unable to load dashboard</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {portfolioError instanceof Error ? portfolioError.message : "Could not connect to the server."}
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => {
                  refetchPortfolio();
                  refetchStrategies();
                  refetchEvents();
                }}
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Warning banner for partial failures */}
      {portfolioError && (
        <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <p className="text-sm text-warning">
              Unable to load portfolio data. Some information may be unavailable.
            </p>
          </div>
        </div>
      )}

      {/* ... rest of component with graceful degradation */}
    </div>
  );
}
```

**What happens when API fails:**
- ✅ Error is detected immediately
- ✅ User sees clear error message
- ✅ Retry button allows recovery
- ✅ Shows what data is available
- ✅ Warns about missing data
- ✅ Page remains functional

## Visual Comparison

### Scenario 1: All APIs Fail (Authentication Error)

**Before:**
```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│              ⟳                      │
│         Loading...                  │
│    (spins forever)                  │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────┐
│  Dashboard                          │
│  Overview of your trading           │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║    ⚠                          ║ │
│  ║  Unable to load dashboard     ║ │
│  ║                               ║ │
│  ║  API Error: 401 Unauthorized  ║ │
│  ║  Please check authentication  ║ │
│  ║                               ║ │
│  ║    [Try Again]                ║ │
│  ╚═══════════════════════════════╝ │
└─────────────────────────────────────┘
```

### Scenario 2: Partial Failure (Portfolio OK, Strategies Fail)

**Before:**
```
┌─────────────────────────────────────┐
│                                     │
│              ⟳                      │
│         Loading...                  │
│    (spins forever)                  │
│                                     │
└─────────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────┐
│  Dashboard                          │
│  Overview of your trading           │
│                                     │
│  ⚠ Unable to load portfolio data    │
│                                     │
│  ┌───────┬───────┬───────┬───────┐ │
│  │ $50K  │ +$500 │ 5     │ $20K  │ │
│  │ Equity│ P&L   │ Strat │ Power │ │
│  └───────┴───────┴───────┴───────┘ │
│                                     │
│  ┌─────────────────┐  ┌──────────┐ │
│  │ Strategies      │  │ AI       │ │
│  │                 │  │ Activity │ │
│  │   ⚠ Unable to   │  │          │ │
│  │   load          │  │ • Event1 │ │
│  │   [Retry]       │  │ • Event2 │ │
│  └─────────────────┘  └──────────┘ │
└─────────────────────────────────────┘
```

## Key Improvements

### 1. Error Detection
**Before:** Never checked for errors
**After:** Tracks errors for each API call

### 2. Loading State
**Before:** Generic spinner, no context
**After:** Descriptive message, shows progress

### 3. Error Recovery
**Before:** No retry mechanism
**After:** Retry buttons for each failed section

### 4. User Feedback
**Before:** Silent failure, infinite loading
**After:** Clear error messages with context

### 5. Graceful Degradation
**Before:** All-or-nothing approach
**After:** Shows available data, warns about failures

### 6. Authentication Errors
**Before:** No special handling
**After:** Detects auth errors, shows troubleshooting steps

## Code Quality Improvements

### QueryClientProvider Configuration

**Before:**
```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
```

**After:**
```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          if (
            errorMessage.includes("401") ||
            errorMessage.includes("403") ||
            errorMessage.includes("unauthorized")
          ) {
            return false;
          }
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnReconnect: true,
      gcTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on client errors (4xx)
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          if (
            errorMessage.includes("400") ||
            errorMessage.includes("401") ||
            errorMessage.includes("403") ||
            errorMessage.includes("404")
          ) {
            return false;
          }
        }
        // Retry once for 5xx errors
        return failureCount < 1;
      },
    },
  },
})
```

**Benefits:**
- ✅ Smart retry logic (don't retry auth failures)
- ✅ Exponential backoff prevents server hammering
- ✅ Automatic reconnection handling
- ✅ Proper mutation retry strategy

## Testing Scenarios

### Test 1: Backend Down
**Before:** Infinite spinner
**After:** Error message with retry button

### Test 2: Auth Failed
**Before:** Infinite spinner
**After:** Auth error with troubleshooting steps

### Test 3: Intermittent Network
**Before:** Spinner appears/disappears randomly
**After:** Automatic retry with exponential backoff

### Test 4: Single API Fails
**Before:** Entire page stuck loading
**After:** Shows available data, warns about failure

### Test 5: Retry After Error
**Before:** No retry capability
**After:** Retry button successfully refetches data
