# Error Handling Pattern for Frontend Pages

## Quick Implementation Guide

### Step 1: Update Your API Hook Calls

**Before:**
```typescript
const { data: items, isLoading } = useItems();
```

**After:**
```typescript
const {
  data: items,
  isLoading,
  error,
  refetch
} = useItems();
```

### Step 2: Add Loading State Check

**Before:**
```typescript
if (isLoading) {
  return <div className="..."><div className="spinner" /></div>;
}
```

**After:**
```typescript
if (isLoading && !items) {
  return (
    <div className="space-y-6">
      <div>
        <h1>Your Page Title</h1>
        <p>Your page description</p>
      </div>
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    </div>
  );
}
```

### Step 3: Add Error State Check

**Add this after the loading check:**
```typescript
if (error) {
  return (
    <div className="space-y-6">
      <div>
        <h1>Your Page Title</h1>
        <p>Your page description</p>
      </div>
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Unable to load data</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "An error occurred. Please try again."}
          </p>
          <Button onClick={() => refetch()} variant="outline" className="mt-6">
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 4: Required Imports

Add these imports at the top of your file:
```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
```

### Step 5: Handle Multiple API Calls (Graceful Degradation)

For pages with multiple API calls:

```typescript
export default function MyPage() {
  const {
    data: primaryData,
    isLoading: primaryLoading,
    error: primaryError,
    refetch: refetchPrimary
  } = usePrimaryData();

  const {
    data: secondaryData = [],
    isLoading: secondaryLoading,
    error: secondaryError,
    refetch: refetchSecondary
  } = useSecondaryData();

  const isLoading = primaryLoading || secondaryLoading;
  const hasError = primaryError || secondaryError;

  // Show loading only if nothing loaded yet
  if (isLoading && !primaryData && secondaryData.length === 0) {
    return <LoadingState />;
  }

  // Show error only if critical data failed
  if (primaryError && !primaryData) {
    return <ErrorState error={primaryError} onRetry={refetchPrimary} />;
  }

  return (
    <div className="space-y-6">
      <h1>My Page</h1>

      {/* Warning banner for partial failures */}
      {secondaryError && (
        <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <p className="text-sm text-warning">
              Some data could not be loaded.
            </p>
          </div>
        </div>
      )}

      {/* Primary content (always available) */}
      <div>
        {primaryData && <PrimaryContent data={primaryData} />}
      </div>

      {/* Secondary content (with error handling) */}
      <Card>
        <CardContent>
          {secondaryError ? (
            <div className="py-8 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
              <p className="mt-2 text-sm text-muted-foreground">
                Unable to load this section
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => refetchSecondary()}
              >
                Retry
              </Button>
            </div>
          ) : (
            <SecondaryContent data={secondaryData} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

## Error Types and Messages

### Authentication Errors (401/403)
```typescript
const isAuthError =
  error?.message?.toLowerCase().includes("401") ||
  error?.message?.toLowerCase().includes("unauthorized") ||
  error?.message?.toLowerCase().includes("forbidden");

const message = isAuthError
  ? "Please log in to view this content. Check your authentication settings."
  : "An error occurred. Please try again.";
```

### Network Errors
```typescript
const isNetworkError =
  error?.message?.toLowerCase().includes("network") ||
  error?.message?.toLowerCase().includes("fetch");

const message = isNetworkError
  ? "Unable to connect to the server. Please check your connection."
  : "An error occurred. Please try again.";
```

## Component Patterns

### Inline Error (for card sections)
```typescript
<div className="py-8 text-center">
  <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
  <p className="mt-2 text-sm text-muted-foreground">
    Unable to load this section
  </p>
  <Button
    variant="outline"
    size="sm"
    className="mt-4"
    onClick={() => refetch()}
  >
    Retry
  </Button>
</div>
```

### Warning Banner (for partial failures)
```typescript
<div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
  <div className="flex items-center gap-2">
    <AlertTriangle className="h-4 w-4 text-warning" />
    <p className="text-sm text-warning">
      {errorMessage}
    </p>
  </div>
</div>
```

### Full Page Error
```typescript
<Card className="border-destructive/50">
  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
      <AlertTriangle className="h-8 w-8 text-destructive" />
    </div>
    <h3 className="mt-4 text-lg font-semibold">Error Title</h3>
    <p className="mt-2 max-w-md text-sm text-muted-foreground">
      {errorMessage}
    </p>
    <Button onClick={onRetry} variant="outline" className="mt-6">
      Try Again
    </Button>
  </CardContent>
</Card>
```

## Best Practices

1. **Always show page structure**: Keep headers and navigation visible even in error states
2. **Provide retry buttons**: Let users try to reload failed data
3. **Be specific**: Show which section failed and why
4. **Graceful degradation**: Show what works, warn about what doesn't
5. **Loading messages**: Add descriptive text to loading spinners
6. **Check for existing data**: Don't show loading if you have cached data
7. **Multiple APIs**: Handle each API failure independently when possible
