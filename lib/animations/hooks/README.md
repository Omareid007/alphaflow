# Animation Hooks

React hooks for animation utilities in AlphaFlow Trading Platform.

## useReducedMotion

Detects if the user prefers reduced motion (accessibility setting).

```tsx
import { useReducedMotion } from "@/lib/animations";

function MyComponent() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div>Content without animations</div>;
  }

  return <motion.div animate={{ opacity: 1 }}>Animated content</motion.div>;
}
```

## useScrollProgress

Tracks scroll progress on the page or within a specific element.

### Basic Usage - Page Scroll

```tsx
import { useScrollProgress } from "@/lib/animations";

function ScrollIndicator() {
  const { progress, isScrolling, scrollY } = useScrollProgress();

  return (
    <div className="fixed top-0 left-0 w-full h-1 bg-gray-200">
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${progress * 100}%` }}
      />
      {isScrolling && <span>Scrolling... ({scrollY}px)</span>}
    </div>
  );
}
```

### Scoped Element Scroll

```tsx
import { useScrollProgress } from "@/lib/animations";
import { useRef } from "react";

function ScrollableContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { progress } = useScrollProgress({ element: containerRef });

  return (
    <div>
      <div className="text-sm">
        Scroll progress: {(progress * 100).toFixed(0)}%
      </div>
      <div ref={containerRef} className="h-96 overflow-y-auto border rounded">
        {/* Long content */}
      </div>
    </div>
  );
}
```

### With Scroll End Callback

```tsx
import { useScrollProgress } from "@/lib/animations";

function LazyLoader() {
  const { progress, isScrolling } = useScrollProgress({
    onScrollEnd: () => {
      console.log("User stopped scrolling");
      // Load more content, save scroll position, etc.
    },
    debounceMs: 200, // Wait 200ms after scroll stops
  });

  return (
    <div>
      {isScrolling && <div>Loading...</div>}
      <div>Progress: {(progress * 100).toFixed(0)}%</div>
    </div>
  );
}
```

### Performance Tuning

```tsx
import { useScrollProgress } from "@/lib/animations";

function OptimizedScroll() {
  const { progress } = useScrollProgress({
    throttleMs: 32, // ~30fps (default is 16ms for ~60fps)
    debounceMs: 300, // Longer delay for scroll end detection
  });

  return <div>Scroll: {(progress * 100).toFixed(0)}%</div>;
}
```

### Parallax Effect Example

```tsx
import { useScrollProgress } from "@/lib/animations";

function ParallaxBackground() {
  const { scrollY } = useScrollProgress();

  return (
    <div
      className="fixed inset-0 -z-10"
      style={{
        transform: `translateY(${scrollY * 0.5}px)`,
        backgroundImage: "url(/hero-bg.jpg)",
      }}
    />
  );
}
```

### Progress-based Animations

```tsx
import { useScrollProgress } from "@/lib/animations";
import { motion } from "framer-motion";

function ProgressiveReveal() {
  const { progress } = useScrollProgress();

  return (
    <motion.div
      style={{
        opacity: Math.min(progress * 2, 1),
        scale: 0.8 + progress * 0.2,
      }}
    >
      Content fades in and scales as you scroll
    </motion.div>
  );
}
```

## API Reference

### useScrollProgress(options?)

**Parameters:**

- `options.element?: RefObject<HTMLElement>` - Optional element ref for scoped scroll tracking. If not provided, tracks window scroll.
- `options.throttleMs?: number` - Throttle delay in milliseconds. Default: `16` (~60fps)
- `options.onScrollEnd?: () => void` - Callback when scrolling stops (debounced)
- `options.debounceMs?: number` - Debounce delay for scroll end detection. Default: `150ms`

**Returns:**

```typescript
interface ScrollProgress {
  progress: number; // 0 to 1
  isScrolling: boolean;
  scrollY: number; // Current scroll position in pixels
}
```

## Performance Notes

- Uses `requestAnimationFrame` for smooth updates synchronized with browser repaints
- Scroll events are throttled to prevent excessive re-renders
- Scroll end detection is debounced to avoid premature callbacks
- All event listeners use `{ passive: true }` for better scroll performance
- Properly cleans up all event listeners and timers on unmount

## Accessibility

Both hooks automatically respect user preferences:

- `useReducedMotion` checks the `prefers-reduced-motion` media query
- `useScrollProgress` continues to work with reduced motion, but consumers should check `useReducedMotion()` before applying animations

```tsx
function AccessibleScrollAnimation() {
  const prefersReducedMotion = useReducedMotion();
  const { progress } = useScrollProgress();

  if (prefersReducedMotion) {
    // Skip scroll-based animations
    return <div>Static content</div>;
  }

  return <div style={{ opacity: progress }}>Animated content</div>;
}
```
