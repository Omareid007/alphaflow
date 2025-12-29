# Component Usage Matrix

Comprehensive inventory of UI components and their usage across the AlphaFlow Trading Platform.

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Total Components | 60+ | Inventoried |
| Shadcn/ui Base | 35 | From library |
| Custom Components | 25+ | App-specific |
| Unused Components | 2 | Can remove |

## Usage by Page

### Core UI Components

| Component | /home | /strategies | /portfolio | /backtests | /admin | Total |
|-----------|-------|-------------|------------|------------|--------|-------|
| Button | 5 | 12 | 3 | 4 | 28 | 52 |
| Card | 6 | 5 | 4 | 2 | 15 | 32 |
| Input | 1 | 8 | 0 | 2 | 12 | 23 |
| Select | 0 | 4 | 1 | 1 | 8 | 14 |
| Table | 1 | 2 | 2 | 1 | 8 | 14 |
| Dialog | 0 | 3 | 1 | 2 | 5 | 11 |
| Badge | 3 | 6 | 2 | 1 | 8 | 20 |
| Tabs | 0 | 1 | 0 | 1 | 4 | 6 |
| Progress | 2 | 1 | 2 | 1 | 2 | 8 |
| Tooltip | 2 | 4 | 3 | 2 | 6 | 17 |

### Chart Components

| Component | /home | /strategies | /portfolio | /backtests | Total |
|-----------|-------|-------------|------------|------------|-------|
| LineChart | 1 | 1 | 0 | 2 | 4 |
| BarChart | 0 | 0 | 1 | 0 | 1 |
| PieChart | 0 | 0 | 1 | 0 | 1 |
| AreaChart | 0 | 1 | 0 | 1 | 2 |

### Form Components

| Component | /create | /settings | /admin | Total |
|-----------|---------|-----------|--------|-------|
| Form | 1 | 1 | 6 | 8 |
| FormField | 15 | 8 | 24 | 47 |
| Checkbox | 2 | 4 | 6 | 12 |
| RadioGroup | 1 | 2 | 3 | 6 |
| Slider | 3 | 1 | 2 | 6 |
| Switch | 0 | 3 | 4 | 7 |
| Textarea | 1 | 0 | 2 | 3 |

## Component Inventory

### Base UI Components (Shadcn)

| Component | File | Usage Count | Status |
|-----------|------|-------------|--------|
| Alert | `components/ui/alert.tsx` | 8 | Active |
| AlertDialog | `components/ui/alert-dialog.tsx` | 5 | Active |
| Badge | `components/ui/badge.tsx` | 20 | Active |
| Button | `components/ui/button.tsx` | 52 | Active |
| Card | `components/ui/card.tsx` | 32 | Active |
| Checkbox | `components/ui/checkbox.tsx` | 12 | Active |
| Collapsible | `components/ui/collapsible.tsx` | 2 | Active |
| Command | `components/ui/command.tsx` | 3 | Active |
| Dialog | `components/ui/dialog.tsx` | 11 | Active |
| DropdownMenu | `components/ui/dropdown-menu.tsx` | 8 | Active |
| Input | `components/ui/input.tsx` | 23 | Active |
| Label | `components/ui/label.tsx` | 25 | Active |
| Pagination | `components/ui/pagination.tsx` | 4 | Active |
| Popover | `components/ui/popover.tsx` | 5 | Active |
| Progress | `components/ui/progress.tsx` | 8 | Active |
| RadioGroup | `components/ui/radio-group.tsx` | 6 | Active |
| ScrollArea | `components/ui/scroll-area.tsx` | 4 | Active |
| Select | `components/ui/select.tsx` | 14 | Active |
| Separator | `components/ui/separator.tsx` | 6 | Active |
| Sheet | `components/ui/sheet.tsx` | 2 | Active |
| Skeleton | `components/ui/skeleton.tsx` | 15 | Active |
| Slider | `components/ui/slider.tsx` | 6 | Active |
| Switch | `components/ui/switch.tsx` | 7 | Active |
| Table | `components/ui/table.tsx` | 14 | Active |
| Tabs | `components/ui/tabs.tsx` | 6 | Active |
| Textarea | `components/ui/textarea.tsx` | 3 | Active |
| Toast (Sonner) | `components/ui/sonner.tsx` | Global | Active |
| Tooltip | `components/ui/tooltip.tsx` | 17 | Active |

### Custom Components

| Component | File | Purpose | Usage |
|-----------|------|---------|-------|
| AppShell | `components/layout/app-shell.tsx` | Main layout | 1 (root) |
| Sidebar | `components/layout/sidebar.tsx` | Navigation | 1 (root) |
| AdminSidebar | `components/layout/admin-sidebar.tsx` | Admin nav | 1 (admin) |
| AuthProvider | `components/providers/auth-provider.tsx` | Auth context | 1 (root) |
| QueryProvider | `components/providers/query-provider.tsx` | React Query | 1 (root) |
| ThemeProvider | `components/theme-provider.tsx` | Dark mode | 1 (root) |
| RootErrorBoundary | `components/error-boundaries/RootErrorBoundary.tsx` | Error handling | 1 (root) |
| ComponentErrorBoundary | `components/error-boundaries/ComponentErrorBoundary.tsx` | Component errors | Multiple |

### Wizard Components

| Component | File | Purpose |
|-----------|------|---------|
| StrategyWizard | `components/wizard/strategy-wizard.tsx` | Main wizard |
| TemplateSelector | `components/wizard/TemplateSelector.tsx` | Template picker |
| PresetSelector | `components/wizard/PresetSelector.tsx` | Risk presets |
| ConfigStep | `components/wizard/ConfigStep.tsx` | Configuration |
| BacktestPrompt | `components/wizard/BacktestPrompt.tsx` | Backtest trigger |
| BacktestProgress | `components/wizard/BacktestProgress.tsx` | Progress display |
| BacktestResults | `components/wizard/backtest-results.tsx` | Results view |
| AIInterpretation | `components/wizard/AIInterpretation.tsx` | AI analysis |
| MetricsGrid | `components/wizard/MetricsGrid.tsx` | Metrics display |
| PerformanceCharts | `components/wizard/PerformanceCharts.tsx` | Charts |
| WizardNavigation | `components/wizard/WizardNavigation.tsx` | Step nav |

### Admin Components

| Component | File | Purpose |
|-----------|------|---------|
| ProviderForm | `components/admin/provider-form.tsx` | Provider config |
| AuthTab | `components/admin/AuthTab.tsx` | Auth settings |
| BasicInfoTab | `components/admin/BasicInfoTab.tsx` | Basic info |
| LimitsTab | `components/admin/LimitsTab.tsx` | Rate limits |
| MonitoringTab | `components/admin/MonitoringTab.tsx` | Monitoring |
| ReliabilityTab | `components/admin/ReliabilityTab.tsx` | Reliability |

## Unused Components (Can Remove)

| Component | File | Reason |
|-----------|------|--------|
| Avatar | `components/ui/avatar.tsx` | No user avatars |
| Breadcrumb | `components/ui/breadcrumb.tsx` | Not implemented |

## Component Dependencies

```
AppShell
├── Sidebar
│   ├── Button
│   ├── Tooltip
│   └── ThemeToggle
├── AuthProvider
│   └── useAuth hook
└── QueryProvider
    └── React Query

StrategyWizard
├── TemplateSelector
│   ├── Card
│   └── RadioGroup
├── ConfigStep
│   ├── Form
│   ├── FormField
│   ├── Input
│   └── Slider
├── BacktestProgress
│   ├── Progress
│   └── Skeleton
└── BacktestResults
    ├── MetricsGrid
    │   └── MetricTile (Card)
    ├── PerformanceCharts
    │   └── Recharts
    └── AIInterpretation
        └── Card
```

## Component Health

| Metric | Value | Status |
|--------|-------|--------|
| Average props | 4.2 | Good |
| Max nesting depth | 4 | Good |
| Components > 500 lines | 1 | Review needed |
| Components with tests | 2 | Needs improvement |
| TypeScript coverage | 95% | Good |

## Recommendations

### 1. Remove Unused Components
```bash
rm components/ui/avatar.tsx
rm components/ui/breadcrumb.tsx
```

### 2. Add Missing Accessibility
- Add `aria-label` to icon-only buttons
- Add `role="img"` to chart containers
- Add `scope` to table headers

### 3. Improve Test Coverage
- Add tests for wizard components
- Add tests for error boundaries
- Add Storybook stories

### 4. Documentation
- Add JSDoc to custom components
- Create component usage examples
- Document prop interfaces
