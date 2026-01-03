# Theme Customization Quick Reference

Quick reference for customizing the AlphaFlow UI theme.

## Changing the Accent Color

### Via User Preferences API

```typescript
// Update accent color programmatically
const { updatePreference } = useUserPreferences();
updatePreference("accentColor", "#00A3FF"); // Electric Blue
```

### Via CSS Variables

```css
/* Override in your CSS */
:root {
  --primary: 199 100% 50%; /* Electric Blue */
  --accent: 199 100% 50%;
  --ring: 199 100% 50%;
  --gain: 199 100% 50%; /* Optional: change gain color too */
}
```

### Preset Colors

```typescript
const ACCENT_PRESETS = [
  { name: "Neon Green", hex: "#00C805", hsl: "142 100% 39%" },
  { name: "Electric Blue", hex: "#00A3FF", hsl: "199 100% 50%" },
  { name: "Vibrant Purple", hex: "#8B5CF6", hsl: "258 90% 66%" },
  { name: "Sunset Orange", hex: "#FF6B35", hsl: "18 100% 60%" },
  { name: "Hot Pink", hex: "#EC4899", hsl: "330 81% 60%" },
  { name: "Cyan", hex: "#06B6D4", hsl: "188 94% 43%" },
];
```

---

## Adding a New Component Variant

### 1. Update the Component

```tsx
// components/ui/button.tsx
const buttonVariants = cva("base-classes...", {
  variants: {
    variant: {
      // Add your new variant
      custom: "bg-purple-500 text-white hover:bg-purple-600",
    },
  },
});
```

### 2. Update TypeScript Types

```tsx
export interface ButtonProps extends ... {
  variant?: "default" | "gain" | "loss" | "custom" | ...
}
```

### 3. Add Tests

```tsx
// tests/unit/components/button-variants.test.tsx
it("custom variant has purple background", () => {
  expect(buttonVariants.custom).toContain("bg-purple-500");
});
```

---

## Adding a New Animation

### 1. Add Keyframes (tailwind.config.ts)

```typescript
keyframes: {
  "my-animation": {
    "0%": { opacity: "0", transform: "translateY(10px)" },
    "100%": { opacity: "1", transform: "translateY(0)" },
  },
},
animation: {
  "my-animation": "my-animation 0.3s var(--ease-out-expo)",
},
```

### 2. Add CSS Class (globals.css)

```css
@layer utilities {
  .animate-my-animation {
    animation: my-animation 0.3s var(--ease-out-expo);
  }
}
```

### 3. Create Framer Motion Variant

```tsx
// lib/animations/stagger.tsx
export const myAnimation: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};
```

---

## Creating a Custom Theme

### 1. Define Theme Variables

```css
/* app/globals.css */
.theme-ocean {
  --background: 210 50% 8%;
  --foreground: 210 20% 95%;
  --primary: 199 100% 50%;
  --gain: 160 100% 45%;
  --loss: 350 90% 60%;
  /* ... other variables */
}
```

### 2. Apply Theme Class

```tsx
<html className="theme-ocean">
  <body>...</body>
</html>
```

### 3. Add Theme Option

```typescript
// lib/api/hooks/useUserPreferences.ts
type Theme = "dark" | "light" | "system" | "ocean";
```

---

## Common Customizations

### Rounded Corners

```css
:root {
  --radius: 0.5rem; /* Less rounded */
  --radius: 1rem; /* More rounded */
  --radius: 0; /* Sharp corners */
}
```

### Animation Speed

```css
:root {
  /* Faster animations */
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-slow: 250ms;
}
```

### Glass Effect Intensity

```css
:root {
  --glass-blur: 24px; /* More blur */
  --glass-opacity: 0.3; /* Less opaque */
  --glass-border-opacity: 0.2; /* More visible border */
}
```

---

## Trading Color Conventions

### Consistent Meaning

| Color                | Meaning               | Usage                            |
| -------------------- | --------------------- | -------------------------------- |
| Green (`--gain`)     | Positive, profit, buy | Price up, gains, buy buttons     |
| Red (`--loss`)       | Negative, loss, sell  | Price down, losses, sell buttons |
| Yellow (`--warning`) | Caution, pending      | Pending orders, warnings         |
| Gray (`--muted`)     | Inactive, disabled    | Closed market, disabled          |

### Never Swap

- Green should **always** mean profit/up/buy
- Red should **always** mean loss/down/sell
- Users expect this color convention in trading apps

---

## Dark Mode Considerations

### Testing Both Modes

```bash
# Toggle dark mode in browser DevTools:
# 1. Open DevTools (F12)
# 2. Cmd/Ctrl + Shift + P
# 3. Type "Render" → "Emulate CSS prefers-color-scheme"
```

### Color Brightness

- Dark mode colors are typically 5-10% brighter
- Ensure sufficient contrast (4.5:1 minimum)
- Test with color blindness simulators

---

## File Locations

| File                                | Purpose                    |
| ----------------------------------- | -------------------------- |
| `app/globals.css`                   | CSS variables, base styles |
| `tailwind.config.ts`                | Tailwind extensions        |
| `components/ui/*.tsx`               | Component variants         |
| `lib/animations/*.tsx`              | Animation components       |
| `shared/schema/user-preferences.ts` | Preference types           |

---

**See also**: [Full Theming Guide](./THEMING_GUIDE.md)
