# Debouncing Quick Reference Card

## Quick Import

```typescript
import { useDebouncedCallback } from "@/lib/utils/useDebounce";
import { Loader2 } from "lucide-react";
```

## Standard Delays

| Input Type | Delay | Use Case |
|------------|-------|----------|
| Text input | 300ms | Search, name fields |
| Number input (slider) | 500ms | Settings, parameters |
| Validation | 300-500ms | Form validation |
| Toggle/Switch | 0ms | Immediate feedback |

## Pattern 1: Text Input (300ms)

```typescript
const [isValidating, setIsValidating] = useState(false);
const [localValue, setLocalValue] = useState(initialValue);

const debouncedUpdate = useDebouncedCallback((value: string) => {
  setIsValidating(false);
  onChange(value);
}, 300);

return (
  <div className="relative">
    <input
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        setIsValidating(true);
        debouncedUpdate(e.target.value);
      }}
    />
    {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
  </div>
);
```

## Pattern 2: Slider (500ms)

```typescript
const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

const debouncedChange = useDebouncedCallback(
  (key: string, value: number) => {
    onChange(key, value);
    setPendingChanges((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  },
  500
);

return (
  <>
    {pendingChanges.size > 0 && (
      <div className="flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving...
      </div>
    )}
    <Slider
      onValueChange={(v) => {
        setPendingChanges((prev) => new Set(prev).add(key));
        debouncedChange(key, v);
      }}
    />
  </>
);
```

## Pattern 3: No Debouncing (Switches)

```typescript
// Switches/toggles should NOT be debounced
return (
  <Switch
    checked={value}
    onCheckedChange={(v) => onChange(v)} // Immediate
  />
);
```

## Visual Indicators

### Validating (Text)
```tsx
{isValidating && (
  <div className="absolute right-3 top-1/2 -translate-y-1/2">
    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  </div>
)}
```

### Saving (Sliders)
```tsx
{pendingChanges.size > 0 && (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    className="flex items-center gap-1.5 text-xs text-muted-foreground"
  >
    <Loader2 className="h-3 w-3 animate-spin" />
    Saving...
  </motion.div>
)}
```

## Common Mistakes to Avoid

❌ **DON'T:**
- Debounce switches/toggles
- Use delays > 1000ms
- Forget to show loading indicators
- Debounce form submit buttons

✅ **DO:**
- Show instant UI feedback
- Use appropriate delays
- Add loading/validating indicators
- Test with rapid user input
- Clean up on unmount (hooks do this)

## Testing

```typescript
import { vi } from "vitest";

// Setup fake timers
beforeEach(() => {
  vi.useFakeTimers();
});

// Test debouncing
fireEvent.change(input, { target: { value: "test" } });
vi.advanceTimersByTime(300);
expect(onChange).toHaveBeenCalledWith("test");

// Cleanup
afterEach(() => {
  vi.restoreAllMocks();
});
```

## Full Documentation

See `/docs/DEBOUNCING_GUIDE.md` for complete implementation guide.

---

**Quick Start:** Copy the appropriate pattern above and adjust delays/logic as needed.
