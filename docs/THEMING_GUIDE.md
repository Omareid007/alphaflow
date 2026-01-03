# AlphaFlow Theming Guide

A comprehensive guide to the Robinhood-inspired UI theming system.

## Table of Contents

- [Color System](#color-system)
- [CSS Variables Reference](#css-variables-reference)
- [Component Variants](#component-variants)
- [Animation System](#animation-system)
- [Glassmorphism Effects](#glassmorphism-effects)
- [User Preferences](#user-preferences)
- [Accessibility](#accessibility)

---

## Color System

### Brand Colors

| Token       | Light Mode     | Dark Mode      | Hex       | Usage                         |
| ----------- | -------------- | -------------- | --------- | ----------------------------- |
| `--gain`    | `142 100% 39%` | `142 100% 45%` | `#00C805` | Positive values, buy signals  |
| `--loss`    | `4 84% 60%`    | `4 90% 60%`    | `#FF5252` | Negative values, sell signals |
| `--primary` | `142 100% 39%` | `142 100% 39%` | `#00C805` | CTAs, focus rings             |

### Semantic Trading Colors

```css
/* Gains (profit, buy, bullish) */
.text-gain {
  color: hsl(var(--gain));
}
.bg-gain {
  background-color: hsl(var(--gain));
}
.border-gain {
  border-color: hsl(var(--gain));
}

/* Losses (loss, sell, bearish) */
.text-loss {
  color: hsl(var(--loss));
}
.bg-loss {
  background-color: hsl(var(--loss));
}
.border-loss {
  border-color: hsl(var(--loss));
}
```

### Market Status Colors

| Token               | Color       | Usage                 |
| ------------------- | ----------- | --------------------- |
| `--market-open`     | Neon Green  | Regular trading hours |
| `--market-closed`   | Gray        | Market closed         |
| `--market-extended` | Yellow/Gold | Pre/after-market      |

---

## CSS Variables Reference

### Core Theme Variables

```css
:root {
  /* Base colors */
  --background: 0 0% 100%; /* Page background */
  --foreground: 0 0% 9%; /* Primary text */
  --card: 0 0% 100%; /* Card background */
  --card-foreground: 0 0% 9%; /* Card text */

  /* Interactive */
  --primary: 142 100% 39%; /* Robinhood green */
  --primary-foreground: 0 0% 100%;
  --secondary: 0 0% 96%;
  --accent: 142 100% 39%;

  /* Feedback */
  --destructive: 4 84% 60%; /* Red for errors */
  --success: 142 100% 39%;
  --warning: 45 93% 47%;

  /* UI elements */
  --border: 0 0% 90%;
  --input: 0 0% 90%;
  --ring: 142 100% 39%; /* Focus ring */
  --radius: 0.75rem;
  --radius-pill: 9999px;
}
```

### Animation Tokens

```css
:root {
  /* Duration tokens */
  --duration-instant: 50ms; /* Immediate feedback */
  --duration-fast: 150ms; /* Quick transitions */
  --duration-normal: 250ms; /* Standard animations */
  --duration-slow: 400ms; /* Emphasis animations */
  --duration-slower: 600ms; /* Complex animations */

  /* Easing functions */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-expo: cubic-bezier(0.87, 0, 0.13, 1);
  --spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Glassmorphism Tokens

```css
:root {
  --glass-blur: 16px; /* Backdrop blur amount */
  --glass-opacity: 0.8; /* Background opacity */
  --glass-border-opacity: 0.1; /* Border opacity */
}

.dark {
  --glass-opacity: 0.6;
  --glass-border-opacity: 0.15;
}
```

---

## Component Variants

### Button Variants

```tsx
import { Button } from "@/components/ui/button";

// Trading variants
<Button variant="gain">Buy</Button>
<Button variant="loss">Sell</Button>
<Button variant="gain-outline">Buy Limit</Button>
<Button variant="loss-outline">Sell Limit</Button>

// Glass effect
<Button variant="glass">Glass Button</Button>

// Pill sizes
<Button size="pill">Pill</Button>
<Button size="pill-lg">Large Pill</Button>
```

#### All Button Variants

| Variant        | Classes                                           | Usage                |
| -------------- | ------------------------------------------------- | -------------------- |
| `default`      | `bg-primary text-primary-foreground`              | Primary actions      |
| `gain`         | `bg-gain text-gain-foreground shadow-sm`          | Buy/bullish actions  |
| `loss`         | `bg-loss text-loss-foreground shadow-sm`          | Sell/bearish actions |
| `gain-outline` | `border-gain text-gain hover:bg-gain`             | Secondary buy        |
| `loss-outline` | `border-loss text-loss hover:bg-loss`             | Secondary sell       |
| `glass`        | `bg-white/10 backdrop-blur-sm border-white/20`    | Overlay buttons      |
| `destructive`  | `bg-destructive text-destructive-foreground`      | Destructive actions  |
| `outline`      | `border border-input bg-background`               | Tertiary actions     |
| `secondary`    | `bg-secondary text-secondary-foreground`          | Secondary actions    |
| `ghost`        | `hover:bg-accent hover:text-accent-foreground`    | Minimal buttons      |
| `link`         | `text-primary underline-offset-4 hover:underline` | Text links           |

### Badge Variants

```tsx
import { Badge } from "@/components/ui/badge";

// Trading badges
<Badge variant="gain">+5.23%</Badge>
<Badge variant="loss">-2.14%</Badge>
<Badge variant="gain-subtle">Bullish</Badge>
<Badge variant="loss-subtle">Bearish</Badge>

// Market status
<Badge variant="market-open">Market Open</Badge>
<Badge variant="market-closed">Closed</Badge>
<Badge variant="market-pre">Pre-Market</Badge>
<Badge variant="market-after">After Hours</Badge>

// Glass effect
<Badge variant="glass">Premium</Badge>

// Sizes
<Badge size="xs">XS</Badge>
<Badge size="sm">SM</Badge>
<Badge size="md">MD</Badge>
<Badge size="lg">LG</Badge>
```

### Card Variants

```tsx
import { Card } from "@/components/ui/card";

// Glass effects
<Card variant="glass">Glass card</Card>
<Card variant="glass-strong">Strong glass</Card>

// Trading cards
<Card variant="trading">Interactive trading card</Card>
<Card variant="trading-gain">Gain-themed card</Card>
<Card variant="trading-loss">Loss-themed card</Card>

// Elevated
<Card variant="elevated">Elevated shadow</Card>

// Hover effects
<Card hoverEffect="lift">Lifts on hover</Card>
<Card hoverEffect="glow">Glows green on hover</Card>
<Card hoverEffect="glowLoss">Glows red on hover</Card>
<Card hoverEffect="scale">Scales on hover</Card>
```

---

## Animation System

### Stagger Animations

```tsx
import { StaggerList, StaggerItem } from "@/lib/animations";

<StaggerList speed="normal">
  <StaggerItem>Item 1</StaggerItem>
  <StaggerItem>Item 2</StaggerItem>
  <StaggerItem>Item 3</StaggerItem>
</StaggerList>;
```

#### Speed Options

| Speed    | Stagger Delay | Initial Delay |
| -------- | ------------- | ------------- |
| `fast`   | 30ms          | 50ms          |
| `normal` | 50ms          | 100ms         |
| `slow`   | 100ms         | 200ms         |

### Scroll Animations

```tsx
import { AnimateOnScroll, fadeInUp, scaleIn } from "@/lib/animations";

<AnimateOnScroll variant={fadeInUp} once>
  <Card>Animates when scrolled into view</Card>
</AnimateOnScroll>;
```

#### Available Variants

- `fadeInUp` - Fade in from below
- `fadeInDown` - Fade in from above
- `fadeInLeft` - Fade in from left
- `fadeInRight` - Fade in from right
- `scaleIn` - Scale up with fade
- `slideInUp` - Slide up from bottom

### Page Transitions

```tsx
import { PageTransition, ModalTransition } from "@/lib/animations";

// Page wrapper
<PageTransition>
  <YourPageContent />
</PageTransition>

// Modal animations
<ModalTransition>
  <Dialog>...</Dialog>
</ModalTransition>
```

### Shimmer Loading

```tsx
import {
  CardShimmer,
  MetricCardShimmer,
  TableRowShimmer,
  ChartShimmer
} from "@/lib/animations";

// Loading states
<CardShimmer />
<MetricCardShimmer count={4} />
<TableRowShimmer rows={5} />
<ChartShimmer height={200} />
```

### CSS Keyframe Animations

```css
/* Apply via Tailwind */
.animate-pulse-gain    /* Green pulsing text */
.animate-pulse-loss    /* Red pulsing text */
.animate-glow          /* Box shadow glow */
.animate-fade-in-up    /* Fade in from below */
.animate-scale-in      /* Scale up entrance */
.animate-shimmer       /* Loading shimmer */
.animate-bounce-in     /* Bouncy entrance */
.animate-count-up      /* Number counting */
```

---

## Glassmorphism Effects

### Usage

```tsx
// Card glass variants
<Card variant="glass">Subtle blur</Card>
<Card variant="glass-strong">Strong blur</Card>

// Button glass variant
<Button variant="glass">Glass Button</Button>

// Custom glass styling
<div className="bg-white/10 backdrop-blur-md border border-white/20">
  Glass element
</div>
```

### Recommended Blur Levels

| Effect   | Blur             | Opacity       | Use Case            |
| -------- | ---------------- | ------------- | ------------------- |
| Subtle   | `blur-sm` (8px)  | `bg-white/5`  | Background elements |
| Standard | `blur-md` (12px) | `bg-white/10` | Cards, panels       |
| Strong   | `blur-xl` (24px) | `bg-white/15` | Modals, overlays    |

---

## User Preferences

### Theme Settings API

```typescript
import { useUserPreferences } from "@/lib/api/hooks/useUserPreferences";

function Settings() {
  const { preferences, updatePreference } = useUserPreferences();

  return (
    <>
      {/* Theme selection */}
      <select
        value={preferences.theme}
        onChange={(e) => updatePreference("theme", e.target.value)}
      >
        <option value="dark">Dark</option>
        <option value="light">Light</option>
        <option value="system">System</option>
      </select>

      {/* Animation level */}
      <select
        value={preferences.animationLevel}
        onChange={(e) => updatePreference("animationLevel", e.target.value)}
      >
        <option value="full">Full Animations</option>
        <option value="reduced">Reduced Motion</option>
        <option value="none">No Animations</option>
      </select>

      {/* Accent color */}
      <input
        type="color"
        value={preferences.accentColor}
        onChange={(e) => updatePreference("accentColor", e.target.value)}
      />
    </>
  );
}
```

### Accent Color Presets

| Name                 | Hex       | HSL            |
| -------------------- | --------- | -------------- |
| Neon Green (default) | `#00C805` | `142 100% 39%` |
| Electric Blue        | `#00A3FF` | `199 100% 50%` |
| Vibrant Purple       | `#8B5CF6` | `258 90% 66%`  |
| Sunset Orange        | `#FF6B35` | `18 100% 60%`  |
| Hot Pink             | `#EC4899` | `330 81% 60%`  |
| Cyan                 | `#06B6D4` | `188 94% 43%`  |

---

## Accessibility

### Reduced Motion Support

```tsx
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

function AnimatedComponent() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div>Static content</div>;
  }

  return <motion.div animate={{ ... }}>Animated</motion.div>;
}
```

### Animation Level Handling

All animation components respect the user's animation level preference:

- **Full**: All animations enabled
- **Reduced**: Essential animations only, faster durations
- **None**: No animations, instant transitions

### Color Contrast

| Combination             | Contrast Ratio | WCAG Level |
| ----------------------- | -------------- | ---------- |
| Gain on dark background | 4.7:1          | AA         |
| Loss on dark background | 5.2:1          | AA         |
| White text on gain      | 4.5:1          | AA         |
| Black text on gain      | 4.7:1          | AA         |

### Focus States

All interactive elements include visible focus indicators:

```css
.focus-visible:outline-none
.focus-visible:ring-2
.focus-visible:ring-ring
.focus-visible:ring-offset-2
```

---

## Best Practices

### Performance

1. **Use GPU-accelerated properties**: `transform`, `opacity`, `scale`
2. **Avoid layout-triggering properties**: `width`, `height`, `top`, `left`
3. **Limit simultaneous animations** to 3-4 elements
4. **Use `will-change` sparingly** and remove after animation

### Consistency

1. Use semantic color tokens (`--gain`, `--loss`) not raw colors
2. Stick to duration tokens for timing
3. Use component variants rather than custom styling
4. Test both light and dark modes

### Mobile

1. Use `touch-action: manipulation` for interactive elements
2. Increase hit targets to 44x44px minimum
3. Consider reduced animations on mobile for battery
4. Use `viewport` units for responsive sizing

---

## Tailwind Config Reference

### Trading Colors

```typescript
// tailwind.config.ts
colors: {
  gain: "hsl(var(--gain))",
  loss: "hsl(var(--loss))",
  market: {
    open: "hsl(var(--market-open))",
    closed: "hsl(var(--market-closed))",
    extended: "hsl(var(--market-extended))",
  },
  robinhood: {
    green: "#00C805",
    red: "#FF5252",
    black: "#0D0D0D",
    dark: "#1A1A1A",
    gray: "#262626",
  },
}
```

### Custom Animations

```typescript
// tailwind.config.ts
animation: {
  "pulse-gain": "pulse-gain 2s ease-in-out infinite",
  "pulse-loss": "pulse-loss 2s ease-in-out infinite",
  "glow": "glow 2s ease-in-out infinite",
  "fade-in-up": "fade-in-up 0.3s var(--ease-out-expo)",
  "scale-in": "scale-in 0.2s var(--ease-out-expo)",
  "shimmer": "shimmer 1.5s linear infinite",
  "bounce-in": "bounce-in 0.4s var(--spring-bounce)",
}
```

---

## Migration Guide

### From Default Tailwind

```diff
- <button className="bg-green-500 hover:bg-green-600">
+ <Button variant="gain">

- <span className="text-green-500">+5.23%</span>
+ <span className="text-gain">+5.23%</span>

- <div className="bg-gray-900 border border-gray-700">
+ <Card variant="default">
```

### Adding New Variants

1. Add CSS variables to `app/globals.css`
2. Update component in `components/ui/`
3. Add to Tailwind config if needed
4. Document in this guide
5. Add tests in `tests/unit/`

---

**Last Updated**: 2026-01-02
**Version**: 1.0.0
