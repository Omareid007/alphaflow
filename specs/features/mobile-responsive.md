# Feature Specification: Mobile Responsive Design

## Overview

| Attribute | Value |
|-----------|-------|
| Feature ID | F-003 |
| Priority | P2 |
| Estimated Effort | Medium (2-3 weeks) |
| Status | PARTIALLY IMPLEMENTED |

## Problem Statement

While the platform has basic responsive styles, the mobile experience is suboptimal. Complex tables, charts, and forms don't adapt well to small screens, making it difficult to monitor positions or execute trades on mobile devices.

## User Stories

### US-1: Mobile Portfolio Monitoring
**As a** trader on mobile
**I want to** view my portfolio and positions clearly
**So that** I can monitor my investments on the go

### US-2: Mobile Order Execution
**As a** trader on mobile
**I want to** place simple orders quickly
**So that** I can react to market movements when away from desktop

### US-3: Mobile Alerts
**As a** trader on mobile
**I want to** receive and act on alerts
**So that** I can respond to important events immediately

## Current State Analysis

### Working Well
- Basic navigation responsive
- Cards stack on mobile
- Text readable at small sizes

### Needs Improvement
| Component | Issue |
|-----------|-------|
| Data tables | Horizontal scroll difficult |
| Charts | Too small, hard to read |
| Strategy wizard | Multi-step forms cramped |
| Admin panels | Not usable on mobile |
| Sidebar | Takes too much space |

## Acceptance Criteria

```gherkin
Feature: Mobile Responsive Design

  Scenario: View portfolio on phone
    Given I am using a phone (375px width)
    When I navigate to /portfolio
    Then I should see a card-based position list
    And each card should show symbol, qty, P&L
    And I can tap to expand for more details

  Scenario: Place order on tablet
    Given I am using a tablet (768px width)
    When I tap "Trade" on a position
    Then a bottom sheet should appear
    And I can quickly place a market order

  Scenario: Navigation on mobile
    Given I am on mobile
    When I tap the menu icon
    Then a slide-out drawer should appear
    And I can navigate to any section
```

## Technical Design

### Breakpoints

```scss
// Tailwind default breakpoints
$breakpoints: (
  'sm': 640px,   // Small tablets
  'md': 768px,   // Tablets
  'lg': 1024px,  // Small laptops
  'xl': 1280px,  // Desktops
  '2xl': 1536px  // Large screens
);
```

### Component Adaptations

#### 1. Responsive Tables

```tsx
// components/ui/responsive-table.tsx

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  mobileCard: (item: T) => React.ReactNode;
}

export function ResponsiveTable<T>({ data, columns, mobileCard }: ResponsiveTableProps<T>) {
  return (
    <>
      {/* Desktop: Full table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            {columns.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}
          </TableHeader>
          <TableBody>
            {data.map(item => (
              <TableRow key={item.id}>
                {columns.map(col => <TableCell key={col.key}>{col.render(item)}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: Card list */}
      <div className="md:hidden space-y-3">
        {data.map(item => (
          <Card key={item.id} className="p-4">
            {mobileCard(item)}
          </Card>
        ))}
      </div>
    </>
  );
}
```

#### 2. Mobile Navigation

```tsx
// components/layout/mobile-nav.tsx

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <nav className="flex flex-col space-y-4 mt-8">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
```

#### 3. Responsive Charts

```tsx
// components/charts/responsive-chart.tsx

export function ResponsiveChart({ data, type }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      setDimensions({
        width,
        height: width < 640 ? 200 : 300, // Shorter on mobile
      });
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <ResponsiveContainer width="100%" height={dimensions.height}>
        <LineChart data={data}>
          {/* Simplified axis labels on mobile */}
          <XAxis
            dataKey="date"
            tick={{ fontSize: dimensions.width < 640 ? 10 : 12 }}
            tickFormatter={val => dimensions.width < 640 ? formatShort(val) : val}
          />
          {/* ... */}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Page-Specific Adaptations

#### Portfolio Page
- Card-based position list on mobile
- Swipe actions for quick trade/close
- Collapsible account summary
- Pull-to-refresh

#### Strategy Wizard
- Full-screen steps on mobile
- Bottom navigation bar
- Larger touch targets
- Simplified charts

#### Admin Pages
- Warning banner: "Best viewed on desktop"
- Essential functions only on mobile
- Link to desktop version

## Implementation Plan

### Week 1: Foundation
- [ ] Add mobile navigation drawer
- [ ] Create ResponsiveTable component
- [ ] Update global styles
- [ ] Add mobile-specific utility classes

### Week 2: Core Pages
- [ ] Portfolio page mobile redesign
- [ ] Home dashboard mobile layout
- [ ] Strategy list mobile cards
- [ ] Settings page mobile form

### Week 3: Polish
- [ ] Strategy wizard mobile flow
- [ ] Backtest results mobile view
- [ ] Touch interactions (swipe, pull-refresh)
- [ ] Performance optimization

## Testing Strategy

### Device Testing Matrix

| Device | Resolution | Priority |
|--------|------------|----------|
| iPhone 14 | 390x844 | P0 |
| iPhone SE | 375x667 | P0 |
| Pixel 7 | 412x915 | P1 |
| iPad | 768x1024 | P1 |
| iPad Pro | 1024x1366 | P2 |

### Playwright Mobile Tests

```typescript
// tests/e2e/mobile.spec.ts

test.describe('Mobile Responsive', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('portfolio shows card view', async ({ page }) => {
    await page.goto('/portfolio');
    await expect(page.locator('[data-testid="position-card"]')).toBeVisible();
    await expect(page.locator('table')).not.toBeVisible();
  });

  test('navigation drawer works', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="mobile-menu"]');
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
  });
});
```

## Success Metrics

| Metric | Target |
|--------|--------|
| Mobile Lighthouse score | > 90 |
| Touch target size | > 44px |
| Mobile bounce rate | < 40% |
| Mobile session duration | > 2 min avg |

## Definition of Done

- [ ] All pages usable on 375px width
- [ ] Touch targets meet 44px minimum
- [ ] Charts readable on mobile
- [ ] Navigation drawer implemented
- [ ] Mobile-specific tests passing
- [ ] Lighthouse mobile score > 90
- [ ] No horizontal scroll on any page
- [ ] Pull-to-refresh on data pages
