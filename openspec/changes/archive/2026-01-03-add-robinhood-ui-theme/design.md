# Phase 3 Robinhood UI - Technical Design

## Context

AlphaFlow is transitioning from a utilitarian trading interface to a premium, Robinhood-inspired experience. This requires careful balancing of:
- Visual appeal vs. information density
- Animation polish vs. performance
- Dark-first design vs. accessibility
- Mobile-first vs. power-user desktop features

## Goals

1. **Visual Differentiation**: Stand out from generic trading dashboards
2. **Engagement**: Micro-interactions that make trading feel rewarding
3. **Performance**: 60fps animations, <100ms interaction feedback
4. **Accessibility**: WCAG 2.1 AA compliance, reduced motion support
5. **Maintainability**: CSS variables for easy theme customization

## Non-Goals

- Complete redesign of information architecture
- New features (this is purely visual)
- Breaking existing API contracts
- Removing any current functionality

## Decisions

### D1: Color System Architecture

**Decision**: Use HSL-based CSS custom properties with semantic naming

**Rationale**:
- HSL allows easy lightness/saturation adjustments for states
- Semantic names (--gain, --loss) decouple from specific colors
- CSS variables enable runtime theme switching

**Implementation**:
```css
:root {
  --robinhood-green: 142 100% 39%;  /* #00C805 */
  --robinhood-red: 4 100% 66%;      /* #FF5252 */
  --robinhood-bg: 0 0% 5%;          /* #0D0D0D */
  --robinhood-card: 0 0% 10%;       /* #1A1A1A */
  --robinhood-border: 0 0% 15%;     /* #262626 */
}

.dark {
  --primary: var(--robinhood-green);
  --gain: var(--robinhood-green);
  --loss: var(--robinhood-red);
  --background: var(--robinhood-bg);
  --card: var(--robinhood-card);
}
```

### D2: Glassmorphism Implementation

**Decision**: Use Tailwind utilities with fallback for unsupported browsers

**Rationale**:
- backdrop-filter has 95%+ browser support
- CSS-only solution, no JS overhead
- Graceful degradation to solid backgrounds

**Implementation**:
```css
.glass {
  @apply bg-card/80 backdrop-blur-xl border border-white/10;
}

@supports not (backdrop-filter: blur(1px)) {
  .glass {
    @apply bg-card border-border;
  }
}
```

### D3: Animation Strategy

**Decision**: Framer Motion for complex animations, CSS for simple transitions

**Rationale**:
- Framer Motion already in use, has great gesture support
- CSS transitions for hover/focus states (better performance)
- Reduced motion via media query + hook

**Animation Tiers**:
| Tier | Use Case | Technology | Duration |
|------|----------|------------|----------|
| Micro | Hover, focus | CSS transition | 150ms |
| Small | Button press, toggle | Framer spring | 200ms |
| Medium | Card expand, modal | Framer variants | 300ms |
| Large | Page transition, confetti | Framer + canvas | 500ms+ |

### D4: User Preferences Storage

**Decision**: PostgreSQL table with JSON column for extensibility

**Rationale**:
- Relational for core fields (fast queries)
- JSON extras column for future preferences
- Server-side storage enables cross-device sync

**Schema**:
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(10) DEFAULT 'dark',
  accent_color VARCHAR(7) DEFAULT '#00C805',
  animation_level VARCHAR(10) DEFAULT 'full',
  extras JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### D5: Mobile Navigation Pattern

**Decision**: Floating bottom bar with 5 key actions + gesture drawer

**Rationale**:
- Thumb-friendly zone at bottom of screen
- Consistent with modern mobile trading apps
- Swipe-up for full navigation drawer

**Layout**:
```
[Home] [Portfolio] [+Trade] [Research] [Profile]
         ^-- FAB-style prominent action
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Visual regression | High | Component snapshot tests |
| Animation jank | Medium | Performance budget, requestAnimationFrame |
| Accessibility issues | High | Color contrast audit, reduced motion |
| Theme preference sync lag | Low | Optimistic UI updates |
| Browser compatibility | Low | Progressive enhancement |

## Migration Plan

1. **Phase 3a**: Theme foundation (colors, variables) - No visual change
2. **Phase 3b**: Component updates with feature flag
3. **Phase 3c**: Enable new theme for beta users
4. **Phase 3d**: Full rollout with preference UI
5. **Rollback**: Feature flag to revert to classic theme

## Open Questions

1. Should we support custom accent colors beyond presets?
2. How to handle chart colors in light mode (green on white)?
3. Do we need a "classic" theme option for existing users?

## References

- [Robinhood Brand Guidelines](https://robinhood.com/us/en/about/brand/)
- [Glassmorphism CSS Generator](https://hype4.academy/tools/glassmorphism-generator)
- [Framer Motion Docs](https://www.framer.com/motion/)
- [WCAG Color Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
