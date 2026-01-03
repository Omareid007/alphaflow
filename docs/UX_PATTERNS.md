# UX Patterns Guide

Comprehensive documentation of UX patterns implemented in the AlphaFlow Trading Platform following the OpenSpec UX Overhaul (Section 11.x).

## Table of Contents

- [Loading States](#loading-states)
- [Error Boundaries](#error-boundaries)
- [Optimistic Updates](#optimistic-updates)
- [Page Transitions](#page-transitions)
- [Stagger Animations](#stagger-animations)
- [Form Patterns](#form-patterns)
- [Toast Notifications](#toast-notifications)
- [Best Practices](#best-practices)

---

## Loading States

### Overview

The platform uses **31 route-level loading states** (`loading.tsx` files) to provide immediate feedback during data fetching and navigation. All loading states use skeleton components for consistent visual hierarchy.

### Implementation Pattern

```tsx
// app/[route]/loading.tsx
import {
  MetricCardSkeleton,
  StrategyCardSkeleton,
  ChartSkeleton,
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Metrics row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Performance chart */}
      <ChartSkeleton />

      {/* Active strategies section */}
      <div className="space-y-4">
        <StrategyCardSkeleton />
        <StrategyCardSkeleton />
        <StrategyCardSkeleton />
      </div>
    </div>
  );
}
```

### Available Skeleton Components

Located in `/components/loading/skeleton-templates.tsx`:

| Component | Use Case | Visual Structure |
|-----------|----------|------------------|
| `MetricCardSkeleton` | Dashboard KPI cards | Title + Value + Subtitle |
| `StrategyCardSkeleton` | Strategy list items | Header + Status + 3 Metrics |
| `TableSkeleton` | Data tables | Header + N rows |
| `ChartSkeleton` | Performance charts | Title + Chart area + Legend |
| `FormSkeleton` | Forms and wizards | Title + N fields + Submit |
| `ListItemSkeleton` | Simple lists | Avatar + Text + Action |
| `HeaderSkeleton` | Page headers | Title + Description |
| `TabsSkeleton` | Tabbed interfaces | Tab headers + Content area |

### Skeleton Design Principles

1. **Match Layout**: Skeletons should mirror the actual content layout exactly
2. **Pulse Animation**: Use `animate-pulse` class for subtle movement
3. **Hierarchy**: Preserve visual hierarchy (headers larger, subtitles smaller)
4. **Grid Alignment**: Match grid breakpoints (md:grid-cols-2, lg:grid-cols-4)

### Loading States by Route Type

```
Dashboard Pages (home, portfolio)
├── Metrics row (4 cards)
├── Chart skeleton
└── List skeletons (strategies, positions)

List Pages (strategies, backtests)
├── Header skeleton
├── Tabs skeleton (if applicable)
└── Multiple list item skeletons

Detail Pages (strategies/[id], backtests/[id])
├── Header skeleton
├── Metrics row
├── Chart skeleton
└── Table skeleton

Admin Pages (admin/*)
├── Header skeleton
├── Table skeleton
└── Optional metrics
```

### When to Use Loading States

- **Route-level data fetching**: Always use `loading.tsx` for Next.js route segments
- **Suspense boundaries**: Use skeleton components inside `<Suspense fallback={...}>`
- **Initial page load**: Show loading state until critical data is available
- **Optimistic UI**: Combine with optimistic updates for instant feedback

### Performance Considerations

- Loading states are **not** code-split (always included in page bundle)
- Skeletons are pure CSS/HTML (no JavaScript overhead)
- Total skeleton code: ~200 lines, ~5KB uncompressed

---

## Error Boundaries

### Overview

The platform uses **31 route-level error boundaries** (`error.tsx` files) to gracefully handle errors and provide recovery options. All errors are logged to the console for debugging.

### Error Boundary Templates

Located in `/components/error/error-boundary-templates.tsx`:

#### 1. Generic Error (Default)

Use for general page errors where the cause is unclear.

```tsx
import { GenericError } from "@/components/error/error-boundary-templates";

export default function Error({ error, reset }: ErrorPageProps) {
  return (
    <GenericError
      error={error}
      reset={reset}
      title="Something went wrong"
      description="An unexpected error occurred. Please try again."
      showHomeButton={true}
    />
  );
}
```

**Visual Structure**:
```
┌────────────────────────┐
│    ⚠️ AlertTriangle    │
│                        │
│  Something went wrong  │
│  Description text...   │
│  Error ID: abc123      │
│                        │
│  [Try Again] [Go Home] │
└────────────────────────┘
```

#### 2. Data Load Error

Use for pages that primarily fetch and display data (portfolio, strategies, backtests).

```tsx
import { DataLoadError } from "@/components/error/error-boundary-templates";

export default function Error({ error, reset }: ErrorPageProps) {
  return (
    <DataLoadError
      error={error}
      reset={reset}
      title="Failed to load data"
      description="We couldn't load the requested data."
      showHomeButton={true}
    />
  );
}
```

**Smart Error Detection**:
- Network errors: Shows WiFi icon + connection message
- Server errors (500): Shows Database icon + server message
- Generic errors: Shows AlertTriangle icon

#### 3. Form Error

Use for pages with forms (login, signup, strategy creation).

```tsx
import { FormError } from "@/components/error/error-boundary-templates";

export default function Error({ error, reset }: ErrorPageProps) {
  return (
    <FormError
      error={error}
      reset={reset}
      title="Form submission failed"
      description="Please check your input and try again."
      showHomeButton={false} // Forms typically don't need home button
    />
  );
}
```

**Features**:
- Shows error message in monospace font
- Yellow warning icon (less severe than red)
- No home button by default (user stays on form)

#### 4. Admin Error

Use for admin pages where technical details are helpful.

```tsx
import { AdminError } from "@/components/error/error-boundary-templates";

export default function Error({ error, reset }: ErrorPageProps) {
  return (
    <AdminError
      error={error}
      reset={reset}
      title="Admin page error"
      description="An error occurred while loading this admin page."
      showHomeButton={true}
    />
  );
}
```

**Features**:
- Expandable "Technical Details" section
- Shows error message, error ID, and stack trace
- Wider max-width (max-w-2xl) for technical content

### Error Logging Pattern

```tsx
"use client";

import { useEffect } from "react";
import { DataLoadError } from "@/components/error/error-boundary-templates";

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Always log errors for debugging
    console.error("Page error:", error);
  }, [error]);

  return (
    <DataLoadError
      error={error}
      reset={reset}
      title="Dashboard error"
      description="Failed to load your dashboard."
      showHomeButton={false}
    />
  );
}
```

### Error Boundary Props

```typescript
interface ErrorTemplateProps {
  error: Error & { digest?: string };  // Next.js error object
  reset: () => void;                   // Retry function
  title?: string;                      // Error title
  description?: string;                // Error description
  showHomeButton?: boolean;            // Show "Go Home" button
}
```

### Error Recovery Actions

1. **Try Again**: Calls `reset()` to re-render the page
2. **Go Home**: Navigates to `/home` or `/admin`
3. **Automatic logging**: All errors logged to console

### When to Use Each Template

| Page Type | Template | Reason |
|-----------|----------|--------|
| Dashboard, Portfolio | `DataLoadError` | Primarily data fetching |
| Login, Signup | `FormError` | Form submission errors |
| Strategy Create/Edit | `FormError` | Complex multi-step forms |
| Admin Pages | `AdminError` | Technical users, need details |
| Unknown/Generic | `GenericError` | Fallback for any error |

---

## Optimistic Updates

### Overview

The platform uses **15 mutation hooks** with optimistic updates to provide instant feedback for user actions. All optimistic updates include rollback logic on errors.

### Architecture

```
User Action
    ↓
onMutate (Optimistic Update)
    ├── Cancel pending queries
    ├── Snapshot current state
    └── Update cache immediately
    ↓
API Request
    ↓
Success → onSuccess (Invalidate queries)
Error → onError (Rollback to snapshot)
```

### Implementation Pattern

Located in `/lib/api/hooks/useStrategies.ts`:

```typescript
export function useUpdateStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Strategy> & { id: string }) =>
      api.put<Strategy>(`/api/strategies/${id}`, data),

    onMutate: async ({ id, ...updates }) => {
      // 1. Cancel outgoing queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ["strategies"] });
      await queryClient.cancelQueries({ queryKey: ["strategies", id] });

      // 2. Snapshot previous state for rollback
      const previousStrategies = queryClient.getQueryData<Strategy[]>([
        "strategies",
      ]);
      const previousStrategy = queryClient.getQueryData<Strategy>([
        "strategies",
        id,
      ]);

      // 3. Optimistically update cache
      queryClient.setQueryData<Strategy[]>(
        ["strategies"],
        (old) =>
          old?.map((s) =>
            s.id === id
              ? { ...s, ...updates, updatedAt: new Date().toISOString() }
              : s
          ) ?? []
      );

      queryClient.setQueryData<Strategy>(["strategies", id], (old) =>
        old ? { ...old, ...updates, updatedAt: new Date().toISOString() } : old
      );

      // 4. Return context for rollback
      return { previousStrategies, previousStrategy };
    },

    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousStrategies) {
        queryClient.setQueryData(["strategies"], context.previousStrategies);
      }
      if (context?.previousStrategy) {
        queryClient.setQueryData(["strategies", id], context.previousStrategy);
      }
      toast.error("Failed to update strategy");
      console.error("Failed to update strategy:", err);
    },

    onSuccess: (_, { id }) => {
      // Invalidate queries to refetch latest data
      queryClient.invalidateQueries({ queryKey: ["strategies"], exact: false });
      queryClient.invalidateQueries({
        queryKey: ["strategies", id],
        exact: true,
      });
      toast.success("Strategy updated successfully");
    },
  });
}
```

### Optimistic Update Hooks

| Hook | Operation | Optimistic Behavior |
|------|-----------|---------------------|
| `useCreateStrategy` | POST | Add temp strategy with `temp-${Date.now()}` ID |
| `useUpdateStrategy` | PUT | Update strategy in list + single query |
| `useDeleteStrategy` | DELETE | Remove from list + remove query |
| `useDeployStrategy` | POST | Update status to `paper` or `live` |
| `usePauseStrategy` | POST | Update status to `paused` |
| `useResumeStrategy` | POST | Update status to previous mode |
| `useStopStrategy` | POST | Update status to `stopped` |

### Key Principles

1. **Cancel Queries**: Prevent race conditions with pending queries
2. **Snapshot State**: Always save previous state for rollback
3. **Update Multiple Caches**: Update both list and detail queries
4. **Temporal Markers**: Set `updatedAt` timestamps on optimistic updates
5. **Rollback on Error**: Restore previous state if mutation fails
6. **Invalidate on Success**: Refetch to ensure data consistency

### Temporary IDs for Create Operations

```typescript
onMutate: async (newStrategy) => {
  // Generate temporary ID for optimistic create
  const tempId = `temp-${Date.now()}`;

  queryClient.setQueryData<Strategy[]>(["strategies"], (old) => [
    ...(old ?? []),
    {
      ...newStrategy,
      id: tempId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "draft" as const,
    } as Strategy,
  ]);

  return { previousStrategies };
},

onSuccess: (createdStrategy) => {
  // Server returns real ID, invalidate to replace temp ID
  queryClient.invalidateQueries({ queryKey: ["strategies"] });
  toast.success("Strategy created successfully");
},
```

### Selective Query Invalidation

```typescript
// ✅ GOOD: Only invalidate related queries
queryClient.invalidateQueries({ queryKey: ["strategies"], exact: false });
queryClient.invalidateQueries({ queryKey: ["strategies", id], exact: true });

// ❌ BAD: Over-invalidation causes unnecessary refetches
queryClient.invalidateQueries(); // Invalidates ALL queries
```

---

## Page Transitions

### Overview

Page transitions provide smooth visual continuity between route changes. Currently implemented via dynamic imports for performance.

### Dynamic Import Pattern

Located in `/lib/animations/dynamic-animations.tsx`:

```tsx
export const PageTransition = dynamic(
  () =>
    import("./page-transitions").then((mod) => ({
      default: mod.PageTransition,
    })),
  {
    ssr: false,           // Client-side only
    loading: () => <></>, // No loading state needed
  }
);
```

### Animation Variants

Located in `/lib/animations/presets.ts`:

```typescript
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 20 },      // Start: Invisible, 20px down
  visible: { opacity: 1, y: 0 },      // End: Visible, normal position
  exit: { opacity: 0, y: -20 },       // Exit: Invisible, 20px up
};
```

### Usage Example

```tsx
import { PageTransition } from "@/lib/animations/dynamic-animations";

export default function Page() {
  return (
    <PageTransition>
      <div>
        <h1>Dashboard</h1>
        {/* Page content */}
      </div>
    </PageTransition>
  );
}
```

### Performance Impact

- **Bundle size**: PageTransition adds ~2KB (dynamic import)
- **Initial load**: No impact (loaded after page interactive)
- **Animation duration**: 0.3s (transition preset: "gentle")

### Accessibility

- Respects `prefers-reduced-motion` (see [Reduced Motion Support](#reduced-motion-support))
- Transitions are purely visual (no functional impact)
- Screen readers ignore animations

---

## Stagger Animations

### Overview

Stagger animations create a cascading effect for list items, improving perceived performance and visual interest.

### Stagger Container Pattern

```tsx
import { motion } from "framer-motion";
import { staggerContainerVariants, staggerItemVariants } from "@/lib/animations/presets";

export function StrategyList({ strategies }: { strategies: Strategy[] }) {
  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {strategies.map((strategy) => (
        <motion.div
          key={strategy.id}
          variants={staggerItemVariants}
        >
          <StrategyCard strategy={strategy} />
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### Stagger Timing Configuration

```typescript
// Container: Orchestrates stagger timing
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,  // 50ms delay between items
      delayChildren: 0.05,    // 50ms initial delay
    },
  },
};

// Item: Individual animation
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },  // Start: Invisible, 20px down
  visible: { opacity: 1, y: 0 },  // End: Visible, normal position
};
```

### Custom Stagger Configuration

```typescript
import { createStagger } from "@/lib/animations/presets";

// Slower stagger for large lists
const slowStagger = createStagger(0.1, 0.1); // 100ms delay

// Faster stagger for small lists
const fastStagger = createStagger(0.02, 0); // 20ms delay, no initial delay
```

### Dynamic Import for Performance

```tsx
import { StaggerList, StaggerItem } from "@/lib/animations/dynamic-animations";

export function StrategyList({ strategies }: { strategies: Strategy[] }) {
  return (
    <StaggerList>
      {strategies.map((strategy) => (
        <StaggerItem key={strategy.id}>
          <StrategyCard strategy={strategy} />
        </StaggerItem>
      ))}
    </StaggerList>
  );
}
```

### When to Use Stagger Animations

- **Short lists** (< 20 items): Always use stagger
- **Long lists** (> 20 items): Consider virtualization instead
- **Initial render**: Great for page load
- **Filtered/Sorted lists**: Avoid (creates visual confusion)

---

## Form Patterns

### Debouncing

Use debouncing for expensive operations like search or validation.

```tsx
import { useState, useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";

export function SearchInput() {
  const [query, setQuery] = useState("");

  const debouncedSearch = useDebouncedCallback(
    (value: string) => {
      // Perform expensive search operation
      console.log("Searching for:", value);
    },
    500 // 500ms delay
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  return (
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search strategies..."
    />
  );
}
```

### Validation States

Use Zod schemas for validation (located in `/shared/schema/`):

```tsx
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const strategySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  type: z.enum(["momentum", "mean-reversion", "breakout"]),
});

export function StrategyForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(strategySchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("name")} />
      {errors.name && <span>{errors.name.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Strategy"}
      </button>
    </form>
  );
}
```

### Loading States

```tsx
export function SubmitButton({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="relative"
    >
      {isSubmitting && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      )}
      <span className={isSubmitting ? "invisible" : ""}>
        Create Strategy
      </span>
    </button>
  );
}
```

---

## Toast Notifications

### Overview

The platform uses Sonner for toast notifications (see `components/ui/toaster.tsx`). All mutation hooks include automatic toast notifications.

### Usage Pattern

```tsx
import { toast } from "sonner";

// Success toast
toast.success("Strategy created successfully");

// Error toast
toast.error("Failed to create strategy");

// Info toast
toast.info("Backtest queued");

// Loading toast (with promise)
toast.promise(
  createStrategyMutation.mutateAsync(data),
  {
    loading: "Creating strategy...",
    success: "Strategy created successfully",
    error: "Failed to create strategy",
  }
);
```

### Toast Timing

- **Success**: 3 seconds (auto-dismiss)
- **Error**: 5 seconds (auto-dismiss)
- **Info**: 3 seconds (auto-dismiss)
- **Loading**: Indefinite (until promise resolves)

### Toast Placement

- Desktop: Bottom-right
- Mobile: Top-center (better reachability)

### Accessibility

- Toasts are announced by screen readers
- Dismissible via keyboard (Escape key)
- Color-coded for quick identification (green, red, blue)

---

## Best Practices

### Loading States

1. ✅ **Match layout exactly**: Skeletons should mirror actual content
2. ✅ **Use route-level loading.tsx**: Leverage Next.js automatic code splitting
3. ✅ **Avoid inline spinners**: Use skeleton components instead
4. ❌ **Don't mix patterns**: Choose either skeletons or spinners, not both

### Error Boundaries

1. ✅ **Log errors**: Always log errors for debugging
2. ✅ **Use appropriate template**: Match template to page type
3. ✅ **Provide recovery options**: Always offer "Try Again" button
4. ❌ **Don't expose stack traces**: Only in AdminError template

### Optimistic Updates

1. ✅ **Cancel queries**: Prevent race conditions
2. ✅ **Snapshot state**: Always save previous state for rollback
3. ✅ **Update all caches**: Update list + detail queries
4. ❌ **Don't over-invalidate**: Only invalidate related queries

### Animations

1. ✅ **Respect reduced motion**: Always use `useReducedMotion` hook
2. ✅ **Dynamic import heavy animations**: Use `/lib/animations/dynamic-animations.tsx`
3. ✅ **Use presets**: Leverage `/lib/animations/presets.ts` for consistency
4. ❌ **Don't animate on every interaction**: Reserve for meaningful transitions

### Forms

1. ✅ **Debounce expensive operations**: Search, validation
2. ✅ **Use Zod schemas**: Leverage existing schemas in `/shared/schema/`
3. ✅ **Show loading states**: Disable submit button during submission
4. ❌ **Don't validate on every keystroke**: Use debouncing

### Toasts

1. ✅ **Use appropriate type**: success, error, info, loading
2. ✅ **Keep messages concise**: 5-10 words max
3. ✅ **Include action**: "View details", "Undo", etc.
4. ❌ **Don't stack toasts**: Limit to 3 visible at once

---

## Related Documentation

- **Animation System**: See `docs/ANIMATION_GUIDE.md`
- **Performance Optimizations**: See `docs/PERFORMANCE_GUIDE.md`
- **React Query Configuration**: See `components/providers/query-provider.tsx`
- **Skeleton Templates**: See `components/loading/skeleton-templates.tsx`
- **Error Templates**: See `components/error/error-boundary-templates.tsx`

---

**Last Updated**: 2026-01-03
**Version**: 1.0.0
**Applies To**: OpenSpec UX Overhaul (Section 11.x)
