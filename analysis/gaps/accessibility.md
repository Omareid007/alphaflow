# Accessibility Gap Analysis

Comprehensive accessibility audit of the AlphaFlow Trading Platform against WCAG 2.1 AA standards.

## Executive Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| WCAG 2.1 AA Compliance | ~70% | 100% | Needs Work |
| ARIA attributes coverage | 85% | 100% | Good |
| Keyboard navigation | 90% | 100% | Good |
| Color contrast | 80% | 100% | Needs Work |
| Screen reader support | 75% | 100% | Needs Work |

## Issues by Severity

### Critical Issues (Must Fix)

#### 1. Missing ARIA Labels on Icon-Only Buttons

**Issue:** 12+ icon-only buttons lack accessible names.

**Locations:**
- Sidebar navigation icons
- Action buttons in tables
- Chart toolbar buttons
- Modal close buttons

**Example:**
```tsx
// BAD
<Button variant="ghost" size="icon">
  <TrashIcon />
</Button>

// GOOD
<Button variant="ghost" size="icon" aria-label="Delete item">
  <TrashIcon />
</Button>
```

**Fix Effort:** Low (2-3 hours)

#### 2. Charts Without Text Alternatives

**Issue:** Recharts visualizations have no text alternatives for screen readers.

**Locations:**
- `/portfolio` - Asset allocation pie chart
- `/portfolio` - Position P&L bar chart
- `/backtests` - Equity curve line chart
- `/strategies/[id]` - Performance charts

**Fix:**
```tsx
// Add aria-label and description
<div role="img" aria-label="Asset allocation chart showing 40% stocks, 30% ETFs, 30% cash">
  <PieChart>...</PieChart>
</div>

// Or provide data table alternative
<details>
  <summary>View chart data as table</summary>
  <table>...</table>
</details>
```

**Fix Effort:** Medium (1 day)

### Major Issues (Should Fix)

#### 3. Insufficient Color Contrast

**Issue:** Some text/background combinations don't meet 4.5:1 ratio.

| Location | Element | Ratio | Required |
|----------|---------|-------|----------|
| Disabled buttons | Text | 3.2:1 | 4.5:1 |
| Chart legends | Small text | 3.8:1 | 4.5:1 |
| Muted text | Helper text | 4.0:1 | 4.5:1 |
| Badge (warning) | Text on amber | 3.5:1 | 4.5:1 |

**Fix:** Update CSS variables in Tailwind config.

**Fix Effort:** Low (2-3 hours)

#### 4. Missing Form Labels

**Issue:** Some form inputs lack proper labels.

**Locations:**
- Search inputs (use placeholder only)
- Filter dropdowns
- Inline edit fields

**Example:**
```tsx
// BAD
<Input placeholder="Search symbols..." />

// GOOD
<div>
  <Label htmlFor="symbol-search" className="sr-only">Search symbols</Label>
  <Input id="symbol-search" placeholder="Search symbols..." />
</div>
```

**Fix Effort:** Low (2-3 hours)

#### 5. Focus Management in Modals

**Issue:** Focus not properly trapped in modal dialogs.

**Locations:**
- Order entry modal
- Confirmation dialogs
- Strategy wizard steps

**Fix:** Shadcn Dialog component should handle this, but needs verification.

**Fix Effort:** Medium (4-6 hours)

### Minor Issues (Nice to Have)

#### 6. Missing Skip Links

**Issue:** No skip-to-content link for keyboard users.

**Fix:**
```tsx
// Add to layout.tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

**Fix Effort:** Low (30 minutes)

#### 7. Missing Landmark Roles

**Issue:** Not all page sections have proper landmark roles.

**Current:**
- `<nav>` - Sidebar (good)
- Missing `<main>` - Content area
- Missing `<aside>` - Secondary content

**Fix Effort:** Low (1 hour)

#### 8. Table Accessibility

**Issue:** Data tables missing proper headers and captions.

**Locations:**
- Positions table
- Trades table
- Strategy list
- Admin tables

**Fix:**
```tsx
<table>
  <caption className="sr-only">Current positions with P&L</caption>
  <thead>
    <tr>
      <th scope="col">Symbol</th>
      <th scope="col">Quantity</th>
      <th scope="col">P&L</th>
    </tr>
  </thead>
  <tbody>...</tbody>
</table>
```

**Fix Effort:** Medium (3-4 hours)

## WCAG 2.1 Checklist

### Perceivable

| Guideline | Status | Notes |
|-----------|--------|-------|
| 1.1.1 Non-text Content | Partial | Charts need alternatives |
| 1.3.1 Info and Relationships | Partial | Tables need headers |
| 1.3.2 Meaningful Sequence | Pass | |
| 1.3.3 Sensory Characteristics | Pass | |
| 1.4.1 Use of Color | Partial | P&L colors need icons |
| 1.4.3 Contrast (Minimum) | Partial | Some elements fail |
| 1.4.4 Resize Text | Pass | Works at 200% |
| 1.4.5 Images of Text | Pass | No images of text |
| 1.4.10 Reflow | Pass | Responsive design |
| 1.4.11 Non-text Contrast | Partial | Some icons low contrast |

### Operable

| Guideline | Status | Notes |
|-----------|--------|-------|
| 2.1.1 Keyboard | Partial | Most works, some gaps |
| 2.1.2 No Keyboard Trap | Pass | |
| 2.1.4 Character Key Shortcuts | Pass | No single-key shortcuts |
| 2.4.1 Bypass Blocks | Fail | No skip link |
| 2.4.2 Page Titled | Pass | Unique titles |
| 2.4.3 Focus Order | Pass | Logical order |
| 2.4.4 Link Purpose | Pass | Clear link text |
| 2.4.6 Headings and Labels | Partial | Some missing |
| 2.4.7 Focus Visible | Pass | Focus rings present |

### Understandable

| Guideline | Status | Notes |
|-----------|--------|-------|
| 3.1.1 Language of Page | Pass | `lang="en"` set |
| 3.2.1 On Focus | Pass | |
| 3.2.2 On Input | Pass | |
| 3.3.1 Error Identification | Partial | Some errors unclear |
| 3.3.2 Labels or Instructions | Partial | Some inputs missing |
| 3.3.3 Error Suggestion | Pass | Helpful error messages |
| 3.3.4 Error Prevention | Partial | Confirmations needed |

### Robust

| Guideline | Status | Notes |
|-----------|--------|-------|
| 4.1.1 Parsing | Pass | Valid HTML |
| 4.1.2 Name, Role, Value | Partial | ARIA needed in places |
| 4.1.3 Status Messages | Partial | Some need aria-live |

## Component-Specific Fixes

### Button Component

```tsx
// components/ui/button.tsx additions

// Add to ButtonProps
interface ButtonProps {
  // ... existing
  ariaLabel?: string;
}

// Usage for icon-only buttons
<Button
  variant="ghost"
  size="icon"
  aria-label={ariaLabel || children}
>
  {children}
</Button>
```

### Chart Components

```tsx
// Create accessible chart wrapper
const AccessibleChart = ({
  title,
  description,
  data,
  children
}) => (
  <div
    role="img"
    aria-label={title}
    aria-describedby="chart-desc"
  >
    <span id="chart-desc" className="sr-only">
      {description}
    </span>
    {children}
    <details className="mt-2">
      <summary className="text-sm">View as table</summary>
      <DataTable data={data} />
    </details>
  </div>
);
```

### Status Indicators

```tsx
// Don't rely on color alone
const StatusBadge = ({ status, value }) => (
  <Badge variant={status}>
    {status === 'positive' && <TrendingUpIcon className="mr-1" aria-hidden />}
    {status === 'negative' && <TrendingDownIcon className="mr-1" aria-hidden />}
    <span className="sr-only">{status} change:</span>
    {value}
  </Badge>
);
```

## Testing Tools

### Automated Testing

```bash
# Run axe-core in tests
npm install -D @axe-core/playwright

# In E2E tests
import { injectAxe, checkA11y } from 'axe-playwright';

test('page should be accessible', async ({ page }) => {
  await page.goto('/');
  await injectAxe(page);
  await checkA11y(page);
});
```

### Manual Testing Checklist

- [ ] Navigate entire app with keyboard only
- [ ] Test with VoiceOver (macOS) or NVDA (Windows)
- [ ] Test with browser zoom at 200%
- [ ] Use browser accessibility inspector
- [ ] Test color contrast with WAVE extension

## Fix Priority

| Priority | Issues | Effort | Timeline |
|----------|--------|--------|----------|
| P0 | Icon buttons, charts | 2 days | Week 1 |
| P1 | Color contrast, forms | 1 day | Week 1 |
| P2 | Skip links, landmarks | 0.5 day | Week 2 |
| P3 | Tables, status messages | 1 day | Week 2 |

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| axe-core violations | ~25 | 0 |
| Lighthouse a11y score | 75 | 95+ |
| Keyboard-only usable | 90% | 100% |
| Screen reader tested | No | Yes |
