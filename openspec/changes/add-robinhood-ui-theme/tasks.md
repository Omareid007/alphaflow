# Phase 3 Robinhood UI - Implementation Tasks

## 1. Theme System Foundation

- [x] 1.1 Update `app/globals.css` with Robinhood color palette
  - Primary: #00C805 (neon green) - HSL 142 100% 39%
  - Background dark: #0D0D0D (near black) - HSL 0 0% 5%
  - Card dark: #141414 - HSL 0 0% 8%
  - Gain: #00C805, Loss: #FF5252
- [x] 1.2 Extend `tailwind.config.ts` with new colors and animations
  - Added 12 new keyframe animations (pulse-gain, pulse-loss, glow, fade-in-up, etc.)
  - Added robinhood brand colors object
  - Added gradient backgrounds (gradient-gain, gradient-loss, gradient-glass)
  - Added custom box-shadow utilities (glow-sm, glow-md, glow-gain, etc.)
  - Added transition timing functions (out-expo, in-out-expo, bounce)
- [x] 1.3 Add glassmorphism utility classes (backdrop-blur, bg-opacity)
  - .glass, .glass-subtle, .glass-strong classes added
  - Custom --glass-blur, --glass-opacity CSS properties
- [x] 1.4 Create dark mode as default in theme provider
  - Already configured in app/layout.tsx: defaultTheme="dark"
- [x] 1.5 Add CSS custom properties for animation timings
  - --duration-instant: 50ms
  - --duration-fast: 150ms
  - --duration-normal: 250ms
  - --duration-slow: 400ms
  - --ease-out-expo, --ease-in-out-expo, --spring-bounce

## 2. Database Schema

- [x] 2.1 Create `user_preferences` table in `shared/schema/`
  - Created `/shared/schema/user-preferences.ts` with Drizzle ORM definitions
  - theme: 'dark' | 'light' | 'system'
  - accentColor: string (hex with regex validation)
  - animationLevel: 'full' | 'reduced' | 'none'
  - chartStyle: 'area' | 'candle' | 'line'
  - extras: JSONB for future extensibility
  - Zod schemas: insertUserPreferencesSchema, updateUserPreferencesSchema
- [x] 2.2 Add migration script
  - Created `/migrations/0001_add_user_preferences.sql`
  - Run with: `psql $DATABASE_URL -f migrations/0001_add_user_preferences.sql`
- [x] 2.3 Create API endpoints for preferences (GET/PUT/PATCH/DELETE)
  - Created `/server/routes/user-preferences.ts`
  - GET /api/user/preferences - Get or create user preferences
  - PUT /api/user/preferences - Update all preferences
  - PATCH /api/user/preferences - Partial update
  - DELETE /api/user/preferences - Reset to defaults
- [x] 2.4 Add useUserPreferences hook
  - Created `/lib/api/hooks/useUserPreferences.ts`
  - useUserPreferences() - Main query hook
  - useUpdatePreferences() - Mutation with optimistic updates
  - useResetPreferences() - Reset to defaults
  - useThemePreference() - Theme-specific helper with system detection
  - useAnimationPreference() - Animation helper with reduced motion support
  - useAccentColor() - Color helper with validation
  - useChartStyle() - Chart preference helper

## 3. Core Component Updates

- [x] 3.1 Update Button component (`components/ui/button.tsx`)
  - Added pill size variants: `pill`, `pill-sm`, `pill-lg`
  - Added trading variants: `gain`, `loss`, `glass`
  - Added glow shadows on hover
  - Added active scale animation (0.98)
  - Updated transition to use `duration-fast ease-out-expo`
- [x] 3.2 Update Card component (`components/ui/card.tsx`)
  - Added `cardVariants` with cva
  - Added glass variants: `glass`, `glass-subtle`, `glass-strong`
  - Added trading variants: `gain`, `loss`, `elevated`, `ghost`
  - Added hover options: `none`, `lift`, `glow`, `scale`
  - Exported `cardVariants` for external use
- [x] 3.3 Update Badge component (`components/ui/badge.tsx`)
  - Added trading variants: `gain`, `loss`, `gain-subtle`, `loss-subtle`
  - Added market status: `market-open`, `market-closed`, `market-extended`
  - Added glass variant
  - Added size variants: `default`, `sm`, `lg`
  - Added animate options: `none`, `pulse`, `glow` with compound variants
- [x] 3.4 Update Input component (`components/ui/input.tsx`)
  - Added `inputVariants` with cva
  - Added variants: `default`, `glow`, `glass`, `gain`, `loss`
  - Added size variants: `default`, `sm`, `lg`
  - Created `FloatingInput` component with animated floating label
  - Focus states include glow shadows

## 4. Chart Enhancements

- [x] 4.1 Create hero chart layout (full-width, gradient background)
  - Created `components/charts/hero-chart.tsx`
  - Recharts AreaChart with gradient fill based on trend (gain/loss)
  - Optional reference line, axis, tooltip support
  - Framer Motion fade-in animation
  - Glassmorphism tooltip styling
- [x] 4.2 Add sparkline mini-charts for metric cards
  - Created `components/charts/sparkline.tsx`
  - Auto-detects trend from first/last values
  - Color options: gain, loss, primary, muted
  - `SparklineWithValue` composite component with label/change display
- [x] 4.3 Implement animated value transitions
  - Created `components/charts/animated-value.tsx`
  - `AnimatedValue` - Spring-animated counting with flash effect
  - `AnimatedChange` - Percentage badge with arrow animation
  - `AnimatedPortfolioValue` - Complete portfolio display component
  - Respects reduced motion preferences
- [x] 4.4 Add chart gradient overlays (green/red based on trend)
  - Integrated into HeroChart via defs/linearGradient
  - Three-stop gradient (30% → 10% → 0% opacity)
  - Background overlay gradient (from-gain/5 or from-loss/5)
- [x] 4.5 Create touch-friendly chart interactions
  - Created `components/charts/touch-chart-tooltip.tsx`
  - `TouchChartTooltip` - Floating tooltip with boundary detection
  - `useTouchChart` hook for unified touch/mouse handling
  - Calculates change/percent from reference value
  - Created `components/charts/index.ts` for module exports

## 5. Navigation Updates

- [x] 5.1 Streamline sidebar (icon-only mode option)
  - Updated `components/layout/sidebar.tsx` with collapsible mode
  - LocalStorage persistence for collapsed state
  - Tooltip hints when collapsed
  - Framer Motion transitions
  - Glassmorphism styling with backdrop-blur
  - Exported navItems for reuse
- [x] 5.2 Add floating bottom nav for mobile
  - Created `components/layout/mobile-bottom-nav.tsx`
  - 5-item nav: Home, Strategies, Create (primary), Portfolio, AI Pulse
  - Glassmorphism floating bar with safe-area padding
  - Primary "Create" button with glow effect
  - Active state indicators
  - Updated AppShell with bottom padding for mobile
- [ ] 5.3 Implement gesture-based navigation (swipe)
  - Deferred: Touch chart interactions cover primary use case
- [x] 5.4 Add breadcrumb improvements
  - Updated `components/ui/breadcrumb.tsx`
  - `AnimatedBreadcrumb` - Auto-truncating with ellipsis
  - `CompactBreadcrumb` - Mobile-friendly back navigation
  - Framer Motion stagger animations
  - Home icon link, hover states

## 6. Animation System

- [x] 6.1 Create confetti animation for order fills
  - Created `lib/animations/confetti.tsx`
  - Particle system with multiple shapes (circle, square, triangle)
  - `useConfetti()` hook for triggering on demand
  - Respects reduced motion preferences
- [x] 6.2 Add value pulse animations (CountUp with color flash)
  - Implemented in Task 4.3 (`animated-value.tsx`)
  - `AnimatedValue` with spring physics
  - Flash effect on change (gain/loss colors)
- [x] 6.3 Implement stagger animations for lists
  - Created `lib/animations/stagger.tsx`
  - `StaggerList` and `StaggerItem` components
  - `AnimateOnScroll` for viewport-triggered animations
  - Preset variants: fadeInUp, scaleIn, slideInUp, etc.
- [x] 6.4 Add page transition variants
  - Created `lib/animations/page-transitions.tsx`
  - `PageTransition` - Mount animation wrapper
  - `RouteTransition` - Route change animations
  - `SectionTransition`, `HeroTransition`, `ModalTransition`
  - 7 variant presets: fade, slideUp/Down/Left/Right, scale, scaleDown
- [x] 6.5 Create loading shimmer effects
  - Created `lib/animations/shimmer.tsx`
  - `Shimmer` - Base shimmer component
  - Specialized: TextShimmer, CardShimmer, MetricCardShimmer
  - TableRowShimmer, AvatarShimmer, ChartShimmer
  - Created `lib/animations/index.ts` for module exports

## 7. Page-Specific Updates

- [x] 7.1 Dashboard: Hero portfolio chart, condensed metrics
  - Added HeroChart with gradient background and mock portfolio history
  - AnimatedPortfolioValue with spring physics counting
  - MetricCards with sparklines and AnimatedChange badges
  - StaggerList animations for strategies and AI activity
  - PageTransition wrapper for mount animation
  - Shimmer loading states (MetricCardShimmer, ChartShimmer)
  - Glass variant Cards for sections
- [x] 7.2 Portfolio: Full-screen chart mode, position cards
  - Added HeroChart with expandable mode (toggle button)
  - AnimatedPortfolioValue in hero section
  - Updated MetricCards with color-coded icons
  - Glass variant Cards throughout
  - StaggerList animations for active strategies
  - PageTransition wrapper
- [x] 7.3 Strategy detail: Performance chart prominence
  - Main page (`page.tsx`): PageTransition, SectionTransition, shimmer loading states
  - StrategyHeader: Robinhood Badge variants (gain, loss, gain-subtle), motion animations, Button variants (gain, loss, glass)
  - PerformanceMetricsGrid: AnimatedValue, AnimatedChange, Sparklines, StaggerList/StaggerItem, color-coded icons
  - PerformanceTab: HeroChart with expandable mode, glass Cards, trend-based coloring
  - AIAnalysisTab: Glass card, icon header, motion animation
  - ConfigTab: Glass card, StaggerList for config fields
- [x] 7.4 Order flow: Confirmation animations
  - Created OrderConfirmation.tsx component with full-screen modal and confetti
  - useOrderConfirmation hook for triggering confirmations
  - OrderToastContent component for enhanced toast notifications
  - Updated Orders page with confetti on fills, row flash animation
  - Updated StrategyExecutionDashboard with confetti, flash animations
  - Badge variants updated to use trading styles (gain, loss, gain-subtle)
- [x] 7.5 Settings: Theme preview selector
  - Completely redesigned AppearanceCard with 4 preference sections:
    - Theme selector with visual preview cards (Dark/Light/System)
    - Accent color picker with 6 presets (Neon Green, Electric Blue, etc.)
    - Animation level selector with animated icons (Full/Reduced/None)
    - Chart style selector with mini previews (Area/Line/Candle)
  - Updated NotificationsCard with icon-based toggle items, enable count badge
  - Updated RiskGuardrailsCard with color-coded risk levels, styled sliders
  - Updated ConnectionsCard with connection status badges, icons
  - All cards use glass variant, motion animations, Robinhood styling
  - Settings page now has PageTransition, SectionTransition with stagger delays
  - Live preview banner shows auto-save status

## 8. Testing & Polish

- [ ] 8.1 Visual regression tests for components
- [ ] 8.2 Dark/light mode toggle testing
- [ ] 8.3 Reduced motion accessibility testing
- [ ] 8.4 Mobile responsive testing
- [ ] 8.5 Performance audit (animation FPS)

## 9. Documentation

- [ ] 9.1 Update component storybook (if exists)
- [x] 9.2 Document new CSS variables
- [x] 9.3 Create theme customization guide
