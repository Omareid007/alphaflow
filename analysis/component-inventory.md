# Component Inventory

## Summary

| Category | Count |
|----------|-------|
| UI Primitives | 33 |
| Trading Components | 14 |
| Admin Components | 6 |
| Layout Components | 3 |
| Provider Components | 2 |
| Debug Components | 1 |
| **Total** | **60** |

---

## UI Primitives (`components/ui/`)

### Form Controls
| Component | Props | Events | Accessibility |
|-----------|-------|--------|---------------|
| Button | variant, size, disabled | onClick | focus-visible:ring |
| Input | type, placeholder | onChange, onBlur | focus-visible:ring |
| Textarea | rows | onChange | focus-visible:ring |
| Checkbox | checked | onCheckedChange | focus-visible:ring |
| Switch | checked | onCheckedChange | data-state |
| Slider | value, min, max | onValueChange | keyboard-nav |
| Select | value | onValueChange | keyboard-nav |
| Label | htmlFor | - | semantic HTML |

### Containers
| Component | Props | Notes |
|-----------|-------|-------|
| Card | compound | Header, Title, Content, Footer |
| Dialog | open | Modal with overlay |
| Alert | variant | default, destructive |
| Tabs | value | TabsList, Trigger, Content |
| Popover | - | Floating content |
| Sheet | side | Slide-out panel |

### Display
| Component | Props | Notes |
|-----------|-------|-------|
| Badge | variant | 4 variants |
| Progress | value | Animated bar |
| Skeleton | - | animate-pulse |
| Avatar | - | Image + fallback |
| Chart | config | Recharts wrapper |
| Table | - | Header, Body, Row, Cell |

### Feedback
| Component | Purpose |
|-----------|---------|
| Toast/Toaster | Notifications |
| LoadingState | Loading indicator |
| ErrorState | Error display |
| Tooltip | Hover info |

---

## Trading Components (`components/wizard/`)

### Strategy Wizard
| Component | Purpose | Props |
|-----------|---------|-------|
| StrategyWizard | Multi-step wizard | existingStrategy, existingBacktest |
| TemplateSelector | Template picker | templates, onSelect |
| PresetSelector | Preset config | presets, selected |
| ConfigStep | Form step | stepData, values |
| WizardField | Field renderer | field, value, onChange |
| WizardNavigation | Step buttons | currentStep, total |

### Backtest
| Component | Purpose | Props |
|-----------|---------|-------|
| BacktestPrompt | Run backtest | strategyName |
| BacktestProgress | Progress UI | progress |
| BacktestResults | Results display | backtest |
| PerformanceCharts | Charts | chartSeries, metrics |
| MetricsGrid | Metrics display | metrics |
| MetricTile | Single metric | label, value, format |
| AIInterpretation | AI analysis | interpretation |
| BacktestActions | Action buttons | onRunAgain, onDeploy |

---

## Admin Components (`components/admin/`)

| Component | Purpose |
|-----------|---------|
| ProviderForm | Provider config |
| BasicInfoTab | Name, type, URL |
| AuthTab | Auth method |
| LimitsTab | Rate limits |
| ReliabilityTab | Retry config |
| MonitoringTab | Webhooks |

---

## Layout Components

| Component | Purpose |
|-----------|---------|
| AppShell | Auth wrapper |
| Sidebar | Main navigation |
| AdminSidebar | Admin navigation |

---

## Usage Analysis

### Heavily Used (50+ times)
- Button, Card, Input

### Moderately Used (20+ times)
- Select, Dialog, Tabs, Badge

### Potentially Unused
- Avatar (0 app usage)
- Breadcrumb (0 app usage)
- AlertDialog (minimal)

---

## Accessibility Status

| Feature | Coverage |
|---------|----------|
| Focus indicators | 100% |
| Keyboard navigation | 90% |
| ARIA attributes | 85% |
| Screen reader | 80% |

### Gaps
- Icon-only buttons need aria-label
- Chart legends need better contrast
