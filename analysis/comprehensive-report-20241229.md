# Comprehensive Codebase Analysis Report

**Project:** alphaflow-trading-platform
**Date:** December 29, 2024
**Analysis Method:** Parallel subagent analysis with codebase-analyzer, dependency-auditor, asset-optimizer, refactoring-strategist

---

## 1. Codebase Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Total Source Lines | 154,138 | Excluding cache, node_modules |
| TypeScript Files | 7,134 | .ts and .tsx |
| Source Size | 712 MB | Excluding node_modules |
| node_modules Size | 899 MB | |
| Database Size | 2.2 GB+ | llm_calls: 1.27GB, ai_decisions: 940MB |

### Top Directories by Size

| Directory | Size |
|-----------|------|
| node_modules/ | 899 MB |
| docs/ | 4.0 MB |
| server/ | 3.2 MB |
| assets/ | 2.9 MB |
| server_dist/ | 1.7 MB |
| scripts/ | 1.4 MB |

### Largest Source Files

| File | Lines | Purpose |
|------|-------|---------|
| scripts/e2e-comprehensive-test.ts | 2,138 | End-to-end testing |
| scripts/comprehensive-integration-test.ts | 1,891 | Integration testing |
| scripts/omar-ultra-hyperoptimizer.ts | 1,843 | Genetic optimizer |
| server/utils/money.ts | 1,692 | Financial calculations |
| scripts/omar-backtest-enhanced.ts | 1,564 | Backtesting engine |
| server/ai/technical-analysis-fallback.ts | 1,562 | Technical analysis |
| server/connectors/alpaca.ts | 1,502 | Alpaca broker connector |

---

## 2. Dead Code Analysis

### Potentially Unused Components (18 files)

| Component | Location | Status |
|-----------|----------|--------|
| accordion.tsx | components/ui/ | No imports found |
| avatar.tsx | components/ui/ | No imports found |
| breadcrumb.tsx | components/ui/ | No imports found |
| context-menu.tsx | components/ui/ | No imports found |
| dropdown-menu.tsx | components/ui/ | No imports found |
| error-state.tsx | components/ui/ | No imports found |
| hover-card.tsx | components/ui/ | No imports found |
| input-otp.tsx | components/ui/ | No imports found |
| menubar.tsx | components/ui/ | No imports found |
| navigation-menu.tsx | components/ui/ | No imports found |
| popover.tsx | components/ui/ | No imports found |
| radio-group.tsx | components/ui/ | No imports found |
| resizable.tsx | components/ui/ | No imports found |
| scroll-area.tsx | components/ui/ | No imports found |
| skeleton.tsx | components/ui/ | No imports found |
| toggle-group.tsx | components/ui/ | No imports found |
| api-debug-panel.tsx | components/debug/ | No imports found |
| global-error.tsx | app/ | Framework auto-import |

---

## 3. Duplicate Code Analysis

### Summary Statistics

| Metric | Value |
|--------|-------|
| Total Clones Found | 89 |
| Duplicate Lines | 3,114 |
| Duplication Percentage | 3.42% |
| Duplicate Tokens | 34,680 (4.49%) |

### Key Duplicate Patterns

| Pattern | Files Affected | Lines |
|---------|---------------|-------|
| Route handlers in routes.ts | server/routes.ts → server/routes/*.ts | 62 |
| Crypto utilities | crypto-utils.ts ↔ watchlist-cache.ts | 21 |
| API response handling | coinmarketcap.ts (internal) | 18 |
| LLM response parsing | cloudflareClient.ts ↔ geminiClient.ts | 16 |
| Currency conversion | frankfurter.ts (internal) | 15 |

### Backtest Script Duplication (Major)

| Pattern | Files | Estimated Duplicate Lines |
|---------|-------|---------------------------|
| fetchAlpacaBars | 17 files | ~600 |
| Technical indicators | 20 files | ~1,000 |
| Position interface | 15 files | ~300 |
| Backtest engine | 15 files | ~2,000 |
| **Total** | | **~4,000** |

---

## 4. Dependency Analysis

### Unused Dependencies

| Package | Type | Reason |
|---------|------|--------|
| @types/decimal.js | @types | Invalid - decimal.js has built-in types |
| @types/p-limit | @types | p-limit has built-in types |
| @types/p-retry | @types | p-retry has built-in types |
| @types/cors | @types | cors not used in codebase |
| axios-cookiejar-support | dependency | Only in test scripts |
| tough-cookie | dependency | Peer dep of above |

### Unused UI Packages (via unused components)

| Package | Component | Size Impact |
|---------|-----------|-------------|
| @radix-ui/react-accordion | accordion.tsx | ~20KB |
| @radix-ui/react-aspect-ratio | aspect-ratio.tsx | ~15KB |
| embla-carousel-react | carousel.tsx | ~88KB |
| @radix-ui/react-collapsible | collapsible.tsx | ~20KB |
| @radix-ui/react-context-menu | context-menu.tsx | ~25KB |
| vaul | drawer.tsx | ~30KB |
| @radix-ui/react-hover-card | hover-card.tsx | ~20KB |
| input-otp | input-otp.tsx | ~15KB |
| cmdk | command.tsx | ~25KB |
| @radix-ui/react-menubar | menubar.tsx | ~25KB |
| @radix-ui/react-navigation-menu | navigation-menu.tsx | ~25KB |
| @radix-ui/react-radio-group | radio-group.tsx | ~20KB |
| @radix-ui/react-toggle | toggle.tsx | ~15KB |
| @radix-ui/react-toggle-group | toggle-group.tsx | ~15KB |
| react-day-picker | calendar.tsx | ~1.5MB |
| react-hook-form | form.tsx | ~1.9MB |
| date-fns | peer of react-day-picker | ~36MB |

### Security Vulnerabilities

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| axios (via axios-cookiejar-support) | HIGH | DoS + SSRF | Remove or upgrade |
| glob (via eslint-config-next) | HIGH | Command injection | Next.js 15+ |
| esbuild | MODERATE | Dev server vuln | Upgrade to 0.27.2 |
| @esbuild-kit (via drizzle-kit) | MODERATE | Various | Upgrade drizzle-kit |

---

## 5. Asset Analysis

### Asset Inventory

| Type | Count | Total Size |
|------|-------|------------|
| PNG Images | 9 | 3.6 MB |
| JPEG Images | 1 | 182 KB |
| Custom Fonts | 0 | 0 |

### Duplicate Assets (CRITICAL)

**5 identical files with same MD5: `8630973edc249697524f4eb43c4c7a06`**

| File | Size |
|------|------|
| assets/images/splash-icon.png | 724 KB |
| assets/images/icon.png | 724 KB |
| assets/images/favicon.png | 724 KB |
| assets/images/android-icon-foreground.png | 724 KB |
| attached_assets/generated_images/ai_trading_app_icon.png | 724 KB |

**Wasted Space:** 2.9 MB (4 redundant copies)

### Unused Assets

| File | Size | Reason |
|------|------|--------|
| ai_trading_app_icon.png | 724 KB | Source file, not referenced |
| Screenshot_20251213_*.jpg | 182 KB | Development screenshot |
| targeted_element_*.png | 75 KB | Development screenshot |

---

## 6. Refactoring Opportunities

### Priority 1: Backtest Script Migration

| Metric | Current | After | Savings |
|--------|---------|-------|---------|
| Total Scripts | 19 | 19 | 0 |
| Total Lines | 16,500 | 4,500 | 12,000 (73%) |
| Shared Modules | Used by 1 | Used by 19 | - |

**Pattern:** Migrate to use existing `scripts/shared/` modules:
- types.ts
- technical-indicators.ts
- alpaca-api.ts
- backtest-engine.ts
- genetic-algorithm.ts

### Priority 2: Position Interface Consolidation

- 15+ duplicate `interface Position` definitions
- Create `shared/types/trading.ts` with base types
- Use extension for specific variants

### Priority 3: Route Handler Extraction

- 62 lines duplicated between routes.ts and route modules
- Extract to shared middleware/utilities

---

## 7. Summary & Recommendations

### Immediate Actions (Stage 1-2)

| Action | Savings | Risk |
|--------|---------|------|
| Remove unused @types | ~500KB | None |
| Remove dev screenshots | 258 KB | None |
| Remove unused UI components + packages | ~40 MB | Low |
| Fix security vulnerabilities | N/A | Medium |

### Medium-Term Actions (Stage 3-5)

| Action | Savings | Risk |
|--------|---------|------|
| Consolidate duplicate icons | 2.9 MB | Medium |
| Migrate backtest scripts | 12,000 lines | Medium |
| Fix duplicate code clones | 3,000 lines | Low |

### Long-Term Actions (Stage 6+)

| Action | Notes |
|--------|-------|
| Next.js 14 → 16 | Requires React 19 |
| Tailwind 3 → 4 | Major API changes |
| ESLint 8 → 9 | Config migration |
| Database cleanup | llm_calls table 1.27GB |

---

## 8. Total Potential Impact

| Category | Current | Optimized | Savings |
|----------|---------|-----------|---------|
| Source Lines | 154,138 | ~142,000 | 12,138 (8%) |
| Dependencies | 104 | ~85 | 19 packages |
| node_modules | 899 MB | ~850 MB | ~50 MB |
| Static Assets | 3.88 MB | ~870 KB | 3.0 MB (77%) |
| Duplicate Code | 3.42% | <1% | 2.5% reduction |

---

*Report generated by Claude Code Phase 2 Analysis*
*Action plan available at: analysis/action-plan-20241229.md*
