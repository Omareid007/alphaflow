# Implementation Tasks - UX Overhaul 2024

## Phase 1: Foundation & Dependencies ⚡

### 1.1 Install Dependencies

- [x] Install framer-motion@^11.0.0
- [x] Install vaul@^0.9.0 (drawer component)
- [x] Install cmdk@^1.0.0 (command palette)
- [x] Install react-intersection-observer@^9.0.0
- [x] Install webpack-bundle-analyzer (devDep)
- [x] Update package.json scripts

### 1.2 Create Shared Templates

- [x] Create components/loading/skeleton-templates.tsx
- [x] Create components/error/error-boundary-templates.tsx
- [x] Create lib/animations/presets.ts
- [x] Create lib/animations/page-transitions.tsx

## Phase 2: Loading States (32 Files) 🔄

### 2.1 Core User Pages

- [x] app/home/loading.tsx (Dashboard skeleton)
- [x] app/strategies/loading.tsx (Strategy list skeleton)
- [x] app/strategies/[id]/loading.tsx (Strategy detail skeleton)
- [x] app/strategies/[id]/edit/loading.tsx (Edit form skeleton)
- [x] app/create/loading.tsx (Wizard skeleton)
- [x] app/portfolio/loading.tsx (Portfolio skeleton)
- [x] app/backtests/loading.tsx (Backtest list skeleton)
- [x] app/ledger/loading.tsx (Trade history skeleton)
- [x] app/research/loading.tsx (Watchlist skeleton)
- [x] app/ai/loading.tsx (AI Pulse skeleton)
- [x] app/settings/loading.tsx (Settings form skeleton)

### 2.2 Auth Pages

- [x] app/login/loading.tsx
- [x] app/forgot-password/loading.tsx
- [x] app/reset-password/loading.tsx

### 2.3 Admin Pages (17 files)

- [x] app/admin/loading.tsx (Admin dashboard skeleton)
- [x] app/admin/providers/loading.tsx
- [x] app/admin/orchestrator/loading.tsx
- [x] app/admin/ai-arena/loading.tsx
- [x] app/admin/orders/loading.tsx
- [x] app/admin/positions/loading.tsx
- [x] app/admin/universe/loading.tsx
- [x] app/admin/strategies/loading.tsx
- [x] app/admin/users/loading.tsx
- [x] app/admin/allocation/loading.tsx
- [x] app/admin/candidates/loading.tsx
- [x] app/admin/competition/loading.tsx
- [x] app/admin/enforcement/loading.tsx
- [x] app/admin/fundamentals/loading.tsx
- [x] app/admin/llm-router/loading.tsx
- [x] app/admin/observability/loading.tsx
- [x] app/admin/rebalancer/loading.tsx

## Phase 3: Error Boundaries (31 Files) ❌

### 3.1 Core User Pages

- [x] app/home/error.tsx
- [x] app/strategies/error.tsx
- [x] app/strategies/[id]/error.tsx
- [x] app/strategies/[id]/edit/error.tsx
- [x] app/create/error.tsx
- [x] app/portfolio/error.tsx
- [x] app/backtests/error.tsx
- [x] app/ledger/error.tsx
- [x] app/research/error.tsx
- [x] app/ai/error.tsx
- [x] app/settings/error.tsx

### 3.2 Auth Pages

- [x] app/login/error.tsx
- [x] app/forgot-password/error.tsx
- [x] app/reset-password/error.tsx

### 3.3 Admin Pages (17 files)

- [x] app/admin/error.tsx
- [x] app/admin/providers/error.tsx
- [x] app/admin/orchestrator/error.tsx
- [x] app/admin/ai-arena/error.tsx
- [x] app/admin/orders/error.tsx
- [x] app/admin/positions/error.tsx
- [x] app/admin/universe/error.tsx
- [x] app/admin/strategies/error.tsx
- [x] app/admin/users/error.tsx
- [x] app/admin/allocation/error.tsx
- [x] app/admin/candidates/error.tsx
- [x] app/admin/competition/error.tsx
- [x] app/admin/enforcement/error.tsx
- [x] app/admin/fundamentals/error.tsx
- [x] app/admin/llm-router/error.tsx
- [x] app/admin/observability/error.tsx
- [x] app/admin/rebalancer/error.tsx

## Phase 4: Optimistic Updates (15 Mutations) ⚡

### 4.1 Strategy Mutations

- [x] lib/api/hooks/useStrategies.ts - useCreateStrategy
- [x] lib/api/hooks/useStrategies.ts - useUpdateStrategy
- [x] lib/api/hooks/useStrategies.ts - useDeleteStrategy
- [x] lib/api/hooks/useStrategies.ts - usePauseStrategy
- [x] lib/api/hooks/useStrategies.ts - useResumeStrategy
- [x] lib/api/hooks/useStrategies.ts - useStopStrategy
- [x] lib/api/hooks/useStrategies.ts - useDeployStrategy

### 4.2 Backtest Mutations

- [x] lib/api/hooks/useBacktests.ts - useCreateBacktest
- [x] lib/api/hooks/useBacktests.ts - useDeleteBacktest

### 4.3 Settings Mutations

- [x] lib/api/hooks/useSettings.ts - useUpdateSettings

### 4.4 Watchlist Mutations

- [x] lib/api/hooks/useWatchlists.ts - useAddToWatchlist
- [x] lib/api/hooks/useWatchlists.ts - useRemoveFromWatchlist

### 4.5 Admin Mutations

- [x] lib/api/hooks/useAdmin.ts - useUpdateProvider
- [x] lib/api/hooks/useAdmin.ts - useDeleteProvider
- [x] lib/api/hooks/useAdmin.ts - useCreateProvider

## Phase 5: Modern UI Components 🎨

### 5.1 Animation System

- [x] lib/animations/presets.ts (Framer Motion configs)
- [x] lib/animations/page-transitions.tsx
- [x] lib/animations/hooks/useReducedMotion.ts
- [x] lib/animations/hooks/useScrollProgress.ts

### 5.2 Enhanced Core Components

- [ ] components/ui/button.tsx (add Framer Motion animations)
- [ ] components/ui/card.tsx (add hover effects)
- [ ] components/ui/dialog.tsx (add enter/exit animations)
- [ ] components/ui/drawer.tsx (replace with Vaul)
- [ ] components/ui/command.tsx (add CMDK)

### 5.3 New Components

- [x] components/ui/page-transition.tsx
- [x] components/ui/stagger-container.tsx
- [x] components/ui/animated-counter.tsx
- [x] components/ui/loading-dots.tsx
- [x] components/ui/skeleton-avatar.tsx
- [x] components/ui/shimmer.tsx

### 5.4 Trading-Specific Animations

- [x] components/strategy/animated-status-badge.tsx
- [x] components/portfolio/animated-metric-card.tsx
- [x] components/charts/animated-chart-wrapper.tsx

## Phase 6: Forms & Validation 📝

### 6.1 Form Utilities

- [x] lib/utils/debounce.ts
- [x] lib/utils/useDebounce.ts hook
- [x] lib/validation/error-formatter.ts

### 6.2 Enhanced Form Components

- [x] components/ui/input.tsx (add debouncing)
- [x] components/ui/textarea.tsx (add debouncing)
- [ ] components/ui/form-field.tsx (better error display)
- [x] components/ui/form-error.tsx (accessible errors)

### 6.3 Wizard Enhancements

- [x] components/wizard/strategy-wizard.tsx (add loading states)
- [x] components/wizard/wizard-field.tsx (add debouncing)
- [x] components/wizard/wizard-navigation.tsx (add animations)

## Phase 7: Bundle Optimization 📦

### 7.1 Dynamic Imports

- [x] app/create/page.tsx (lazy load StrategyWizard)
- [x] app/backtests/page.tsx (lazy load charts)
- [x] app/admin/\*/page.tsx (lazy load admin components)
- [x] components/charts/\* (lazy load Recharts)

### 7.2 Build Configuration

- [x] next.config.js (add bundle analyzer)
- [x] next.config.js (optimize images)
- [x] package.json (add bundle:analyze script)

### 7.3 Analysis & Optimization

- [ ] Run webpack-bundle-analyzer
- [ ] Identify heavy dependencies
- [ ] Add lazy loading where needed
- [ ] Verify 30%+ reduction

## Phase 8: Smart Caching ⚙️

### 8.1 QueryClient Configuration

- [x] components/providers/query-provider.tsx (update defaults)
- [x] Add selective refetchOnWindowFocus for critical data
- [x] Configure staleTime per query type
- [x] Add query deduplication

### 8.2 Custom Hooks Enhancement

- [x] lib/api/hooks/usePortfolio.ts (add smart invalidation)
- [x] lib/api/hooks/useStrategies.ts (add smart invalidation)
- [x] lib/api/hooks/useBacktests.ts (add smart invalidation)

## Phase 9: Accessibility 🌐

### 9.1 ARIA Attributes

- [x] Add aria-label to icon-only buttons
- [x] Add aria-live regions for dynamic content
- [x] Add role attributes where needed
- [ ] Test with screen reader (NVDA/JAWS)

### 9.2 Keyboard Navigation

- [x] Ensure all interactive elements focusable
- [x] Add focus-visible indicators
- [ ] Test tab order on all pages
- [ ] Add keyboard shortcuts documentation

### 9.3 Color Contrast

- [x] Audit all text/background combinations
- [x] Fix low-contrast elements
- [x] Ensure WCAG 2.1 AA compliance

## Phase 10: Testing & QA ✅

### 10.1 Manual Testing

- [ ] Test all 32 pages for loading states
- [ ] Test all 31 pages for error boundaries
- [ ] Test all 15 mutations for optimistic updates
- [ ] Test page transitions and animations
- [ ] Test on slow 3G connection
- [ ] Test with prefers-reduced-motion

### 10.2 Performance Testing

- [ ] Lighthouse audit (target: 85+ performance)
- [ ] Bundle size verification (target: -30%)
- [ ] Animation FPS measurement (target: 60fps)
- [ ] Time to Interactive (target: <3s)

### 10.3 Accessibility Testing

- [ ] WAVE accessibility audit
- [ ] axe DevTools scan
- [ ] Keyboard-only navigation test
- [ ] Screen reader test (NVDA)

### 10.4 Cross-Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Phase 11: Documentation 📚

### 11.1 Component Documentation

- [x] Update CLAUDE.md with new patterns
- [x] Document animation presets
- [x] Document loading state patterns
- [x] Document error boundary patterns

### 11.2 Developer Guide

- [x] Create docs/UX_PATTERNS.md
- [x] Create docs/ANIMATION_GUIDE.md
- [x] Create docs/PERFORMANCE_GUIDE.md

## Rollout Plan

1. **Internal Testing** (Day 1)
   - Deploy to staging
   - Full manual QA
   - Performance profiling

2. **Beta Release** (Day 2)
   - 10% of users
   - Monitor error rates
   - Collect feedback

3. **Full Release** (Day 3)
   - 100% rollout
   - Monitor metrics
   - Quick fixes as needed

## Success Metrics

- [ ] Zero blank screen reports
- [ ] Loading perceived time < 300ms
- [ ] Error recovery rate > 95%
- [ ] Bundle size reduction > 30%
- [ ] Lighthouse performance score > 85
- [ ] Accessibility score > 90
- [ ] User satisfaction > 8.5/10

---

**Total Tasks**: 180+
**Estimated Effort**: 8-10 days (with parallel execution)
**Priority**: P0 (Critical UX improvements)
