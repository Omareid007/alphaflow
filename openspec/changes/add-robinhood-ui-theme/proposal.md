# Change: Phase 3 Robinhood-Style UI Redesign

## Why

The current UI uses a generic blue primary color and standard card-based layout. To differentiate AlphaFlow as a premium trading platform and improve user engagement, we need a modern, Robinhood-inspired design language with:
- Distinctive neon green branding for gains
- Dark-first theme optimized for traders
- Glassmorphism effects and micro-animations
- Chart-centric layouts that prioritize data visualization

## What Changes

### Theme System Overhaul
- **BREAKING**: Primary accent changes from blue (#0084FF) to neon green (#00C805)
- Dark mode becomes the default theme
- New CSS variables for Robinhood color palette
- Extended animation presets for micro-interactions

### Component Visual Updates
- Cards: Glassmorphism with backdrop-blur, subtle borders
- Buttons: Rounded pills, haptic-style press feedback
- Charts: Full-bleed hero layouts, gradient overlays
- Navigation: Floating bottom nav on mobile, streamlined sidebar

### User Preferences Persistence
- New `user_preferences` database table
- Theme preference (dark/light/system)
- Accent color preference
- Animation preference (full/reduced/none)

### New Animations
- Order confirmation confetti
- Value change pulse animations (green up, red down)
- Chart hover sparkline effects
- Smooth page transitions

## Impact

- **Affected specs**: ui-theming (new capability)
- **Affected code**:
  - `app/globals.css` - Color variables
  - `tailwind.config.ts` - Extended theme
  - `components/ui/*.tsx` - Visual updates
  - `components/layout/*.tsx` - Navigation changes
  - `shared/schema/` - New user_preferences table
  - `lib/animations/` - New animation presets
- **Migration**: Automatic - existing users get dark theme by default
- **Risk**: Visual regression in edge cases; mitigate with component tests
