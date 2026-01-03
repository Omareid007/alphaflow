# Debounced Form Components

## Overview

The `Input` and `Textarea` components now support optional debouncing to reduce unnecessary re-renders and API calls while typing.

## Features

- ✅ **Backward Compatible**: Works exactly the same without debouncing props
- ✅ **Type Safe**: Full TypeScript support with proper prop types
- ✅ **Flexible**: Use `debounceMs` alone or with `onDebouncedChange` callback
- ✅ **Consistent**: Same API for both Input and Textarea components

## Usage Examples

### 1. Basic Debounced Input

```tsx
import { Input } from "@/components/ui/input";
import { useState } from "react";

function SearchInput() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <Input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      debounceMs={300}
      onDebouncedChange={(debouncedValue) => {
        // This is called 300ms after user stops typing
        console.log("Search for:", debouncedValue);
        performSearch(debouncedValue);
      }}
      placeholder="Search..."
    />
  );
}
```

### 2. Debounced Textarea for Auto-Save

```tsx
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

function NotesEditor() {
  const [content, setContent] = useState("");

  return (
    <Textarea
      value={content}
      onChange={(e) => setContent(e.target.value)}
      debounceMs={1000}
      onDebouncedChange={(debouncedContent) => {
        // Auto-save 1 second after user stops typing
        saveToServer(debouncedContent);
      }}
      placeholder="Start typing your notes..."
      className="min-h-[200px]"
    />
  );
}
```

### 3. Backward Compatible (No Debouncing)

```tsx
import { Input } from "@/components/ui/input";
import { useState } from "react";

function RegularInput() {
  const [value, setValue] = useState("");

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Regular input, no debouncing"
    />
  );
}
```

### 4. Trading Symbol Search with Debouncing

```tsx
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

function SymbolSearch() {
  const [symbol, setSymbol] = useState("");
  const [debouncedSymbol, setDebouncedSymbol] = useState("");

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", debouncedSymbol],
    queryFn: () => fetchQuote(debouncedSymbol),
    enabled: debouncedSymbol.length >= 1,
  });

  return (
    <div className="space-y-2">
      <Input
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        debounceMs={300}
        onDebouncedChange={setDebouncedSymbol}
        placeholder="Enter symbol (e.g., AAPL)"
      />
      {isLoading && <span>Loading...</span>}
      {quote && (
        <div>
          <p>{quote.symbol}: ${quote.price}</p>
        </div>
      )}
    </div>
  );
}
```

### 5. Form Validation with Debouncing

```tsx
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/form-error";
import { useState } from "react";

function EmailInput() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setError("Please enter a valid email address");
    } else {
      setError(undefined);
    }
  };

  return (
    <div className="space-y-2">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        debounceMs={500}
        onDebouncedChange={validateEmail}
        placeholder="Enter your email"
        aria-describedby={error ? "email-error" : undefined}
        aria-invalid={!!error}
      />
      {error && <FieldError id="email-error" message={error} />}
    </div>
  );
}
```

### 6. Multi-Field Form with Debouncing

```tsx
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

function ProfileForm() {
  const [formData, setFormData] = useState({
    username: "",
    bio: "",
  });

  const handleDebouncedChange = (field: string, value: string) => {
    console.log(`${field} debounced:`, value);
    // Could trigger validation, API calls, etc.
  };

  return (
    <form className="space-y-4">
      <div>
        <label htmlFor="username">Username</label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) =>
            setFormData({ ...formData, username: e.target.value })
          }
          debounceMs={300}
          onDebouncedChange={(val) => handleDebouncedChange("username", val)}
          placeholder="Choose a username"
        />
      </div>

      <div>
        <label htmlFor="bio">Bio</label>
        <Textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          debounceMs={500}
          onDebouncedChange={(val) => handleDebouncedChange("bio", val)}
          placeholder="Tell us about yourself"
        />
      </div>
    </form>
  );
}
```

## Props

### Input Props

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  debounceMs?: number; // Optional debounce delay in milliseconds
  onDebouncedChange?: (value: string) => void; // Callback with debounced value
  variant?: "default" | "glow" | "glass" | "gain" | "loss";
  inputSize?: "default" | "sm" | "lg";
}
```

### Textarea Props

```typescript
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  debounceMs?: number; // Optional debounce delay in milliseconds
  onDebouncedChange?: (value: string) => void; // Callback with debounced value
}
```

## How It Works

1. **No Debouncing**: When `debounceMs` and `onDebouncedChange` are not provided, the component behaves exactly as before (fully backward compatible).

2. **With Debouncing**: When either prop is provided:
   - Component maintains internal state for immediate UI updates
   - `onChange` fires immediately on every keystroke
   - `onDebouncedChange` fires only after user stops typing for `debounceMs` milliseconds
   - Uses `useDebounce` hook from `@/lib/utils/useDebounce`

## Best Practices

### Recommended Debounce Times

- **Search inputs**: 300ms - Good balance between responsiveness and reducing API calls
- **Form validation**: 500ms - Gives user time to finish typing before showing errors
- **Auto-save**: 1000-2000ms - Reduces server load while ensuring changes are saved
- **Real-time preview**: 200-300ms - Fast enough to feel responsive

### When to Use Debouncing

✅ **Use debouncing for:**
- Search inputs that trigger API calls
- Form fields with real-time validation
- Auto-save functionality
- Live preview/formatting
- Any input that triggers expensive operations

❌ **Don't use debouncing for:**
- Password fields (security/UX concern)
- Critical inputs that need immediate feedback
- Simple local state updates with no side effects
- Single-use inputs (e.g., one-time codes)

### Accessibility Considerations

When using debouncing with validation:

```tsx
<Input
  debounceMs={500}
  onDebouncedChange={validate}
  aria-describedby={error ? "field-error" : undefined}
  aria-invalid={!!error}
/>
{error && <FieldError id="field-error" message={error} />}
```

This ensures screen readers can announce errors after validation completes.

## Performance Benefits

### Without Debouncing

```
User types "hello"
h -> onChange -> API call (1)
he -> onChange -> API call (2)
hel -> onChange -> API call (3)
hell -> onChange -> API call (4)
hello -> onChange -> API call (5)
Total: 5 API calls
```

### With Debouncing (300ms)

```
User types "hello" (fast)
h -> onChange (immediate UI update)
he -> onChange (immediate UI update)
hel -> onChange (immediate UI update)
hell -> onChange (immediate UI update)
hello -> onChange (immediate UI update)
...wait 300ms...
hello -> onDebouncedChange -> API call (1)
Total: 1 API call
```

## Related Documentation

- **Debounce Utilities**: `/home/runner/workspace/lib/utils/debounce.ts`
- **React Hooks**: `/home/runner/workspace/lib/utils/useDebounce.ts`
- **Form Error Component**: `/home/runner/workspace/components/ui/form-error.tsx`

## TypeScript Support

Both components are fully typed with TypeScript:

```typescript
// Type inference works correctly
<Input debounceMs={300} /> // debounceMs: number | undefined

// Callback is type-safe
<Input
  onDebouncedChange={(value) => {
    // value is inferred as string
    console.log(value.toUpperCase());
  }}
/>

// All standard input/textarea props are supported
<Input
  type="email"
  required
  minLength={3}
  debounceMs={300}
/>
```

## Migration Guide

### Before (without debouncing)

```tsx
function SearchInput() {
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (debouncedSearch) {
      performSearch(debouncedSearch);
    }
  }, [debouncedSearch]);

  return (
    <Input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  );
}
```

### After (with built-in debouncing)

```tsx
function SearchInput() {
  const [search, setSearch] = useState("");

  return (
    <Input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      debounceMs={300}
      onDebouncedChange={performSearch}
    />
  );
}
```

## Testing

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Input } from "@/components/ui/input";

test("debounces input changes", async () => {
  const onDebouncedChange = jest.fn();

  render(
    <Input
      debounceMs={300}
      onDebouncedChange={onDebouncedChange}
      data-testid="debounced-input"
    />
  );

  const input = screen.getByTestId("debounced-input");

  fireEvent.change(input, { target: { value: "test" } });

  // Callback should not be called immediately
  expect(onDebouncedChange).not.toHaveBeenCalled();

  // Wait for debounce delay
  await waitFor(
    () => {
      expect(onDebouncedChange).toHaveBeenCalledWith("test");
    },
    { timeout: 400 }
  );
});
```
