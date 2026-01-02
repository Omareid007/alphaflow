# Animation Guide - Framer Motion Components

Quick reference for using animated UI components in the AlphaFlow Trading Platform.

## Quick Start

All animated components automatically respect user's `prefers-reduced-motion` setting. No additional configuration needed!

## Components

### 1. Animated Button

Buttons have subtle press and hover effects.

```tsx
import { Button } from "@/components/ui/button";

// Standard button with animations
<Button variant="default">Trade Now</Button>

// Using asChild (animations disabled for compatibility)
<Button asChild>
  <Link href="/dashboard">Dashboard</Link>
</Button>
```

**Animation Details:**
- Hover: 2% scale increase
- Press: 5% scale decrease
- Duration: ~100ms (snappy)

---

### 2. Animated Card

Cards lift slightly on hover for interactive feel.

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Interactive card (default)
<Card>
  <CardHeader>
    <CardTitle>Portfolio Value</CardTitle>
  </CardHeader>
  <CardContent>$125,000</CardContent>
</Card>

// Disable animation for non-interactive cards
<Card disableAnimation>
  <CardContent>Static information</CardContent>
</Card>
```

**Animation Details:**
- Hover: Lifts 4px, 2% scale increase
- Press: 2% scale decrease
- Duration: ~200ms (smooth)

---

### 3. Animated Dialog/Modal

Dialogs scale and fade in smoothly.

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Settings</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Settings</DialogTitle>
    </DialogHeader>
    {/* Dialog content */}
  </DialogContent>
</Dialog>
```

**Animation Details:**
- Enter: Scale from 90% to 100%, fade in
- Exit: Scale to 90%, fade out
- Overlay: Fade in/out
- Duration: ~300ms (gentle)

---

### 4. Page Transition

Wrap page content for smooth transitions.

```tsx
import { PageTransition } from "@/components/ui/page-transition";

export default function DashboardPage() {
  return (
    <PageTransition>
      <div className="container mx-auto p-6">
        <h1>Dashboard</h1>
        {/* Page content */}
      </div>
    </PageTransition>
  );
}
```

**Animation Details:**
- Enter: Slide up 20px, fade in
- Exit: Slide down 20px, fade out
- Duration: ~400ms (gentle)

**Best Practices:**
- Wrap top-level page content
- One PageTransition per route
- Don't nest PageTransitions

---

### 5. Animated Counter

Smooth number transitions for values.

```tsx
import { AnimatedCounter } from "@/components/ui/animated-counter";

// Simple counter
<AnimatedCounter value={portfolioValue} decimals={2} />

// Custom formatting
<AnimatedCounter
  value={shares}
  format={(n) => `${n.toLocaleString()} shares`}
/>

// Currency example
<AnimatedCounter
  value={profit}
  decimals={2}
  format={(n) => {
    const sign = n >= 0 ? '+' : '';
    return `${sign}$${n.toLocaleString()}`;
  }}
  className={profit >= 0 ? "text-green-600" : "text-red-600"}
/>
```

**Props:**
- `value`: number - The value to display
- `decimals?`: number - Decimal places (default: 0)
- `format?`: (n: number) => string - Custom formatter
- `className?`: string - CSS classes

**Animation Details:**
- Spring physics (natural motion)
- Stiffness: 100, Damping: 30
- Rounds to specified decimals

**Use Cases:**
- Portfolio values
- Profit/loss amounts
- Share quantities
- Percentage changes

---

### 6. Stagger Container

Animate lists with sequential entrance.

```tsx
import { StaggerContainer, StaggerItem } from "@/components/ui/stagger-container";
import { Card } from "@/components/ui/card";

<StaggerContainer>
  {strategies.map((strategy) => (
    <StaggerItem key={strategy.id}>
      <Card>
        <CardHeader>
          <CardTitle>{strategy.name}</CardTitle>
        </CardHeader>
        <CardContent>{strategy.description}</CardContent>
      </Card>
    </StaggerItem>
  ))}
</StaggerContainer>

// Custom timing
<StaggerContainer
  staggerChildren={0.1}  // 100ms between items
  delayChildren={0.2}    // 200ms initial delay
>
  {items.map((item) => (
    <StaggerItem key={item.id}>
      <div>{item.content}</div>
    </StaggerItem>
  ))}
</StaggerContainer>
```

**StaggerContainer Props:**
- `staggerChildren?`: number - Delay between items (seconds, default: 0.05)
- `delayChildren?`: number - Initial delay (seconds, default: 0.05)
- `className?`: string - CSS classes

**StaggerItem Props:**
- `className?`: string - CSS classes

**Animation Details:**
- Items slide up 20px and fade in
- Default: 50ms between each item
- Customizable timing

**Use Cases:**
- Strategy cards grid
- Order history lists
- Portfolio positions
- Search results
- Navigation menus

**Best Practices:**
- Keep stagger timing short (50-100ms)
- Don't use for very long lists (>20 items)
- Consider pagination for long lists

---

## Animation Presets Reference

Available in `/lib/animations/presets.ts`:

### Variants

```typescript
fadeVariants        // Simple fade in/out
slideUpVariants     // Slide from bottom
slideDownVariants   // Slide from top
slideLeftVariants   // Slide from right
scaleVariants       // Scale up/down
pageVariants        // Page transitions
cardHoverVariants   // Card hover effect
buttonPressVariants // Button press effect
staggerContainerVariants // Container for lists
staggerItemVariants      // Individual list items
```

### Transitions

```typescript
transitions.fast    // Quick (buttons, hovers)
transitions.smooth  // Standard (modals, dropdowns)
transitions.gentle  // Slow (page transitions)
transitions.bouncy  // Elastic effect
transitions.ease    // Simple easing
```

## Custom Animations

### Creating Custom Motion Components

```tsx
"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";
import { transitions } from "@/lib/animations/presets";

export function CustomComponent({ children }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={transitions.smooth}
    >
      {children}
    </motion.div>
  );
}
```

### Using Animation Presets

```tsx
import { motion } from "framer-motion";
import { scaleVariants, transitions } from "@/lib/animations/presets";

<motion.div
  variants={scaleVariants}
  initial="hidden"
  animate="visible"
  exit="exit"
  transition={transitions.smooth}
>
  Content
</motion.div>
```

## Performance Tips

### DO ✅

- Use `transform` and `opacity` (GPU-accelerated)
- Keep animations under 400ms
- Use spring physics for natural motion
- Limit animations in long lists
- Test on mobile devices

### DON'T ❌

- Animate width/height (causes layout thrashing)
- Use overly long durations (>500ms)
- Animate many items simultaneously (>20)
- Forget to test reduced motion
- Nest too many motion components

## Accessibility

### Reduced Motion Support

All components automatically respect `prefers-reduced-motion`:

```typescript
const prefersReducedMotion = useReducedMotion();

if (prefersReducedMotion) {
  // Render without animation
  return <div>{children}</div>;
}

// Render with animation
return <motion.div>{children}</motion.div>;
```

### Testing Reduced Motion

**Chrome DevTools:**
1. Open DevTools (F12)
2. Cmd/Ctrl + Shift + P → "Show Rendering"
3. Check "Emulate CSS prefers-reduced-motion"

**macOS System Setting:**
System Preferences → Accessibility → Display → Reduce Motion

**Windows System Setting:**
Settings → Ease of Access → Display → Show animations in Windows

## Common Patterns

### Portfolio Value with Color Change

```tsx
import { AnimatedCounter } from "@/components/ui/animated-counter";

function PortfolioValue({ value, previousValue }) {
  const isPositive = value >= previousValue;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Portfolio:</span>
      <AnimatedCounter
        value={value}
        decimals={2}
        format={(n) => `$${n.toLocaleString()}`}
        className={`text-2xl font-bold ${
          isPositive ? "text-green-600" : "text-red-600"
        }`}
      />
    </div>
  );
}
```

### Grid of Animated Cards

```tsx
import { StaggerContainer, StaggerItem } from "@/components/ui/stagger-container";
import { Card } from "@/components/ui/card";

<StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {strategies.map((strategy) => (
    <StaggerItem key={strategy.id}>
      <Card>
        <CardHeader>
          <CardTitle>{strategy.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <AnimatedCounter
            value={strategy.performance}
            decimals={2}
            format={(n) => `${n}%`}
          />
        </CardContent>
      </Card>
    </StaggerItem>
  ))}
</StaggerContainer>
```

### Loading States

```tsx
import { motion } from "framer-motion";
import { fadeVariants, transitions } from "@/lib/animations/presets";

function LoadingSpinner() {
  return (
    <motion.div
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={transitions.smooth}
      className="flex justify-center p-8"
    >
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </motion.div>
  );
}
```

## Troubleshooting

### Animations Not Working

1. **Check "use client" directive:**
   ```tsx
   "use client"; // Must be first line
   ```

2. **Verify framer-motion is installed:**
   ```bash
   npm list framer-motion
   ```

3. **Check for JavaScript errors in console**

4. **Verify reduced motion setting isn't enabled**

### Performance Issues

1. **Limit animated items:**
   ```tsx
   // Bad: Animate 100 cards at once
   {items.map(item => <motion.div>...</motion.div>)}

   // Good: Use pagination or virtualization
   {items.slice(0, 20).map(item => <motion.div>...</motion.div>)}
   ```

2. **Use will-change sparingly:**
   ```css
   /* Only on actively animating elements */
   .animating {
     will-change: transform, opacity;
   }
   ```

3. **Monitor frame rate:**
   ```tsx
   // Add to development only
   import { LazyMotion, domAnimation } from "framer-motion";

   <LazyMotion features={domAnimation} strict>
     <YourComponent />
   </LazyMotion>
   ```

## Resources

- [Framer Motion Documentation](https://www.framer.com/motion/)
- [Animation Presets Source](/lib/animations/presets.ts)
- [useReducedMotion Hook](/lib/animations/hooks/useReducedMotion.ts)
- [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)

---

**Last Updated**: 2026-01-02
**Version**: 1.0.0
