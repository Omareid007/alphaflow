# Accessibility Quick Reference

**Quick guide for developers working on AlphaFlow**

---

## Before You Code

### Required Reading
1. Review [ACCESSIBILITY.md](./ACCESSIBILITY.md) for full guidelines
2. Check [Component-Specific Guidelines](./ACCESSIBILITY.md#component-specific-guidelines)
3. Test with keyboard navigation before submitting PR

---

## Common Patterns

### Icon-Only Buttons ✅

```tsx
// ✅ GOOD: Icon button with label
<Button variant="ghost" size="icon" aria-label="Close dialog">
  <X />
</Button>

// ❌ BAD: Icon button without label
<Button variant="ghost" size="icon">
  <X />
</Button>
```

### Buttons with Text ✅

```tsx
// ✅ GOOD: Text is the label (no aria-label needed)
<Button>
  <Plus /> Create Strategy
</Button>

// ❌ BAD: Redundant aria-label
<Button aria-label="Create Strategy">
  <Plus /> Create Strategy
</Button>
```

### Decorative Icons ✅

```tsx
// ✅ GOOD: Icon hidden from screen readers
<div>
  <TrendingUp aria-hidden="true" />
  <span>Portfolio growing</span>
</div>

// ❌ BAD: Icon will be announced twice
<div>
  <TrendingUp />
  <span>Portfolio growing</span>
</div>
```

### Charts ✅

```tsx
// ✅ GOOD: Descriptive label
<AnimatedChartWrapper
  chartName="Portfolio Performance"
  ariaLabel="Line chart showing 30-day portfolio performance, increasing from $100k to $125k"
>
  <LineChart data={data} />
</AnimatedChartWrapper>

// ⚠️ OK: Auto-generated label
<AnimatedChartWrapper chartName="Portfolio Performance">
  <LineChart data={data} />
</AnimatedChartWrapper>
// Announces: "Portfolio Performance chart"

// ❌ BAD: No label at all
<AnimatedChartWrapper>
  <LineChart data={data} />
</AnimatedChartWrapper>
```

### Status Updates ✅

```tsx
// ✅ GOOD: Live updates announced
<AnimatedStatusBadge
  status={strategy.status}
  showLabel
  ariaLive={true}
/>

// ⚠️ OK: Static status (not announced)
<AnimatedStatusBadge status={strategy.status} showLabel />

// ❌ BAD: Icon-only status with no label
<AnimatedStatusBadge status={strategy.status} />
```

### Metric Cards ✅

```tsx
// ✅ GOOD: Auto-generated descriptive label
<AnimatedMetricCard
  label="Portfolio Value"
  value={125000}
  previousValue={120000}
  format="currency"
  showTrend
/>
// Announces: "Portfolio Value: $125,000, up 4.2% from previous value"

// ✅ GOOD: Custom label with context
<AnimatedMetricCard
  label="Win Rate"
  value={68.5}
  format="percentage"
  ariaLabel="Strategy win rate: 68.5%, indicating strong performance above 60% threshold"
/>
```

---

## Focus Styles

### Default Behavior ✅

All interactive elements automatically receive focus styles:
- 2px solid green outline
- 2px offset from element
- 20px green glow for visibility

**No action needed** - focus styles are applied globally via CSS.

### Custom Components ⚠️

If creating custom interactive components:

```tsx
// ✅ GOOD: Focusable with proper role
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === "Enter" && handleClick()}
>
  Custom Button
</div>

// ❌ BAD: Not focusable
<div onClick={handleClick}>
  Custom Button
</div>
```

---

## Color Contrast

### Text on Background

| Type | Minimum Ratio | AlphaFlow Value |
|------|--------------|-----------------|
| Normal text (< 18px) | 4.5:1 | ✅ 4.6:1+ |
| Large text (≥ 18px) | 3:1 | ✅ 16.4:1+ |
| UI components | 3:1 | ✅ 3.1:1+ |

### Using Muted Text

```tsx
// ✅ GOOD: Use Tailwind utility (automatically meets contrast)
<span className="text-muted-foreground">Secondary info</span>

// ⚠️ WARNING: Custom colors may fail contrast
<span style={{ color: "hsl(0 0% 50%)" }}>May not meet WCAG AA</span>
```

### Semantic Colors

```tsx
// ✅ GOOD: Semantic colors meet contrast
<span className="text-gain">+2.3%</span>
<span className="text-loss">-1.5%</span>

// ❌ BAD: Don't rely on color alone
<span className="text-gain">Up</span> // Use icon or text too
```

---

## Keyboard Navigation

### Tab Order ✅

Ensure logical tab order:
1. Use semantic HTML (`<button>`, `<a>`, `<input>`)
2. Avoid `tabIndex > 0` (breaks natural order)
3. Use `tabIndex={-1}` to remove from tab order

```tsx
// ✅ GOOD: Natural tab order
<>
  <input type="text" />
  <button>Submit</button>
  <a href="/help">Help</a>
</>

// ❌ BAD: Manual tab order
<>
  <div tabIndex={1}>First</div>
  <div tabIndex={3}>Third</div>
  <div tabIndex={2}>Second</div>
</>
```

### Keyboard Handlers ✅

```tsx
// ✅ GOOD: Both click and keyboard support
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Custom Action
</div>

// ❌ BAD: Only mouse support
<div onClick={handleClick}>
  Custom Action
</div>
```

---

## Forms

### Labels ✅

```tsx
// ✅ GOOD: Label associated with input
<div>
  <label htmlFor="email">Email Address</label>
  <input id="email" type="email" />
</div>

// ✅ GOOD: Alternative with wrapping
<label>
  Email Address
  <input type="email" />
</label>

// ❌ BAD: No label association
<div>
  <span>Email Address</span>
  <input type="email" />
</div>
```

### Error Messages ✅

```tsx
// ✅ GOOD: Error announced to screen readers
<div>
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    aria-invalid={hasError}
    aria-describedby={hasError ? "email-error" : undefined}
  />
  {hasError && (
    <span id="email-error" role="alert">
      Please enter a valid email address
    </span>
  )}
</div>

// ❌ BAD: Error not announced
<div>
  <input type="email" />
  {hasError && <span>Invalid email</span>}
</div>
```

---

## Modals & Dialogs

### Using Radix UI Dialog ✅

```tsx
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// ✅ GOOD: Radix handles focus management
<Dialog open={isOpen} onOpenChange={setOpen}>
  <DialogContent>
    <DialogTitle>Confirm Action</DialogTitle>
    <p>Are you sure?</p>
    <div>
      <Button onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </div>
  </DialogContent>
</Dialog>
```

**Radix automatically handles:**
- Focus trapping
- Esc key to close
- Focus return after close
- ARIA attributes

---

## Testing Checklist

### Before Submitting PR

- [ ] Tab through all interactive elements
- [ ] Focus visible on all elements
- [ ] Esc closes modals/dropdowns
- [ ] Enter/Space activates buttons
- [ ] Screen reader announces labels correctly (test with VoiceOver/NVDA)
- [ ] Color contrast meets WCAG AA (use browser DevTools)
- [ ] Works at 200% zoom

### Tools

```bash
# ESLint (includes accessibility rules)
npm run lint

# Manual testing with Chrome DevTools
# 1. Open DevTools
# 2. Lighthouse tab
# 3. Run Accessibility audit
```

---

## Common Mistakes

### ❌ DON'T

1. **Use `div` for buttons**
   ```tsx
   <div onClick={handleClick}>Click me</div>
   ```

2. **Skip ARIA labels on icon-only buttons**
   ```tsx
   <Button size="icon"><X /></Button>
   ```

3. **Rely on color alone**
   ```tsx
   <span className="text-red-500">Error</span>
   ```

4. **Use `tabIndex > 0`**
   ```tsx
   <button tabIndex={5}>Submit</button>
   ```

5. **Create keyboard traps**
   ```tsx
   <div onKeyDown={(e) => e.preventDefault()}>
     <!-- Content -->
   </div>
   ```

### ✅ DO

1. **Use semantic HTML**
   ```tsx
   <button onClick={handleClick}>Click me</button>
   ```

2. **Add ARIA labels**
   ```tsx
   <Button size="icon" aria-label="Close"><X /></Button>
   ```

3. **Combine color with text/icons**
   ```tsx
   <span className="text-red-500">
     <AlertCircle /> Error: Invalid input
   </span>
   ```

4. **Use natural tab order**
   ```tsx
   <button>Submit</button>
   ```

5. **Allow keyboard escape**
   ```tsx
   <Dialog onOpenChange={setOpen}>
     <!-- Modal can be closed with Esc -->
   </Dialog>
   ```

---

## Resources

### Internal
- [Full Accessibility Documentation](./ACCESSIBILITY.md)
- [Implementation Summary](./ACCESSIBILITY_IMPLEMENTATION_SUMMARY.md)
- [Theming Guide](./THEMING.md)

### External
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Radix UI Documentation](https://www.radix-ui.com/)

### Tools
- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension
- [WAVE](https://wave.webaim.org/extension/) - Visual accessibility feedback
- [Contrast Checker](https://webaim.org/resources/contrastchecker/) - WCAG contrast

---

## Need Help?

1. Check [ACCESSIBILITY.md](./ACCESSIBILITY.md) for detailed guidelines
2. Review component examples in [Component-Specific Guidelines](./ACCESSIBILITY.md#component-specific-guidelines)
3. Ask in #accessibility Slack channel
4. Email: accessibility@alphaflow.app

---

**Last Updated**: 2026-01-03
**Version**: 1.0
