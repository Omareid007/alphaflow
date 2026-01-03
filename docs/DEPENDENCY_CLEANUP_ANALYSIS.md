# Dependency Cleanup Analysis - Stage 4

Generated: 2026-01-03

## Executive Summary

- **Total Dependencies:** 71 regular + 33 dev = 104 total
- **Knip Flagged:** 7 unused dependencies + 3 unused devDependencies = 10 total
- **Actually Unused:** 1 package (pino-http)
- **Falsely Flagged:** 9 packages (used in code that Knip considers dead)
- **Unlisted Dependencies:** 5 packages used but not declared

## 1. Knip Analysis Results

### Unused Files (82 files)

Knip identified 82 files as unused, including:

- 28 UI components (charts, forms, animations)
- 27 server files (observability, adapters, providers, middleware)
- 15 lib/shared files
- 12 other files

**Impact:** These "unused" files contain imports to the flagged dependencies.

### Dependency Categories

#### Category A: TRULY UNUSED (Safe to Remove)

**Count:** 1 package

| Package     | Location     | Reason                            | Impact |
| ----------- | ------------ | --------------------------------- | ------ |
| `pino-http` | dependencies | Not imported anywhere in codebase | ~500KB |

**Action:** ✅ SAFE TO REMOVE

---

#### Category B: USED IN DEAD CODE (Conditional Removal)

**Count:** 9 packages

These packages ARE imported, but only in files that Knip flagged as unused (dead code).

##### B1: Observability Stack (4 packages)

| Package                                     | Used In                        | Status    |
| ------------------------------------------- | ------------------------------ | --------- |
| `@opentelemetry/auto-instrumentations-node` | `server/observability/otel.ts` | Dead code |
| `@opentelemetry/exporter-trace-otlp-http`   | `server/observability/otel.ts` | Dead code |
| `@opentelemetry/sdk-node`                   | `server/observability/otel.ts` | Dead code |
| `@opentelemetry/api`                        | `server/observability/otel.ts` | Dead code |

**Analysis:**

- `server/observability/otel.ts` is NOT imported in `server/index.ts` or any entry point
- OpenTelemetry instrumentation is configured but never initialized
- No APM/tracing is actually active in production

**Decision Required:**

- ❓ Remove observability/otel.ts + all 4 OpenTelemetry packages (~5MB)?
- ❓ Or fix by importing/initializing in server entry point?

---

##### B2: AI Integration Stack (2 packages)

| Package             | Used In                                     | Status    |
| ------------------- | ------------------------------------------- | --------- |
| `@anthropic-ai/sdk` | `server/replit_integrations/chat/routes.ts` | Dead code |
| `openai`            | `server/ai/openrouter-provider.ts`          | Dead code |

**Analysis:**

- `@anthropic-ai/sdk`: Used in `server/replit_integrations/` (Replit-specific chat)
- `openai`: Used in `server/ai/openrouter-provider.ts` (not in llmGateway)
- Neither file is imported in active code paths

**Decision Required:**

- ❓ Remove Replit integrations + @anthropic-ai/sdk (~2MB)?
- ❓ Remove openrouter-provider.ts + openai package (~3MB)?
- ❓ Or activate these providers in the LLM gateway?

---

##### B3: UI Components (3 packages)

| Package                       | Used In                       | Status           |
| ----------------------------- | ----------------------------- | ---------------- |
| `react-resizable-panels`      | `components/ui/resizable.tsx` | Unused component |
| `@testing-library/user-event` | `tests/utils/render.tsx`      | Unused test util |
| `@types/bcryptjs`             | Scripts only (not main app)   | Dev dependency   |

**Analysis:**

- `react-resizable-panels`: Used in `components/ui/resizable.tsx` which is never imported
- `@testing-library/user-event`: Used in test utils but exported and never consumed
- `@types/bcryptjs`: Type definitions for bcryptjs used in test scripts

**Decision Required:**

- ✅ Remove `react-resizable-panels` (~500KB) - component truly unused
- ⚠️ KEEP `@testing-library/user-event` - needed for future tests
- ⚠️ KEEP `@types/bcryptjs` - needed for test scripts

---

##### B4: Logging (1 package)

| Package       | Used In                  | Status        |
| ------------- | ------------------------ | ------------- |
| `pino-pretty` | `server/utils/logger.ts` | ACTIVELY USED |

**Analysis:**

- Used in `server/utils/logger.ts` line 18: `target: "pino-pretty"`
- Provides pretty formatting for development logs
- Knip flagged as unused because it's dynamically loaded by Pino

**Decision Required:**

- ✅ KEEP - actively used in logger configuration

---

#### Category C: UNLISTED DEPENDENCIES (Should Add to package.json)

**Count:** 5 packages

These are used directly but not declared - bad practice!

| Package               | Used In                                | Currently Installed Via                |
| --------------------- | -------------------------------------- | -------------------------------------- |
| `axios`               | `scripts/*.ts` (4 files)               | Transitive (via other deps)            |
| `glob`                | `scripts/migrate-console-to-logger.ts` | Transitive                             |
| `node-fetch`          | `scripts/test-api-client.ts`           | Transitive (via @google/generative-ai) |
| `jsdom`               | `vitest.config.ts`                     | Missing - needed for tests!            |
| `@vitest/coverage-v8` | `vitest.config.ts`                     | Missing - needed for coverage!         |

**Decision Required:**

- ✅ ADD `jsdom` and `@vitest/coverage-v8` to devDependencies (required)
- ⚠️ CONSIDER adding `axios`, `glob`, `node-fetch` to devDependencies (best practice)

---

## 2. Recommended Actions

### IMMEDIATE - Safe Removals (1 package, ~500KB)

```bash
npm uninstall pino-http
```

### HIGH PRIORITY - Dead Code Cleanup (7 packages, ~15MB potential)

**Option A: Aggressive Cleanup (Recommended)**

```bash
# Remove observability (if not planning APM soon)
npm uninstall @opentelemetry/auto-instrumentations-node
npm uninstall @opentelemetry/exporter-trace-otlp-http
npm uninstall @opentelemetry/sdk-node
rm server/observability/otel.ts

# Remove Replit integrations (Replit-specific code)
npm uninstall @anthropic-ai/sdk
rm -rf server/replit_integrations/

# Remove unused UI component
npm uninstall react-resizable-panels
rm components/ui/resizable.tsx

# Remove unused OpenRouter provider (if not using OpenRouter)
# Check first: is OpenRouter needed?
grep -r "openrouter" server/ai/ --include="*.ts" | grep -v "openrouter-provider.ts"
# If nothing found:
npm uninstall openai
rm server/ai/openrouter-provider.ts
```

**Option B: Conservative (Fix Dead Code)**

```bash
# Import and initialize OpenTelemetry in server/index.ts
# Activate Replit integrations in routes
# Import resizable component somewhere
# Activate OpenRouter in LLM gateway
```

### MEDIUM PRIORITY - Add Missing Dependencies

```bash
npm install --save-dev jsdom @vitest/coverage-v8
npm install --save-dev axios glob node-fetch  # Optional but recommended
```

---

## 3. Impact Analysis

### Space Savings (if all removed)

| Action                              | Size Saved |
| ----------------------------------- | ---------- |
| Remove pino-http                    | ~500KB     |
| Remove OpenTelemetry stack (4 pkgs) | ~5MB       |
| Remove @anthropic-ai/sdk            | ~2MB       |
| Remove openai                       | ~3MB       |
| Remove react-resizable-panels       | ~500KB     |
| **TOTAL**                           | **~11MB**  |

### Risk Assessment

| Risk Level     | Count | Packages                                       |
| -------------- | ----- | ---------------------------------------------- |
| ✅ Zero Risk   | 1     | pino-http                                      |
| ⚠️ Low Risk    | 6     | OpenTelemetry, react-resizable-panels          |
| 🔴 Medium Risk | 3     | @anthropic-ai/sdk, openai, Replit integrations |

**Medium Risk Explanation:**

- If Replit integrations or OpenRouter are planned features, removing them requires re-implementation
- Check with product team before removing

---

## 4. False Positives (KEEP These)

| Package                       | Reason to Keep                                |
| ----------------------------- | --------------------------------------------- |
| `pino-pretty`                 | Actively used in logger.ts (dynamic import)   |
| `@testing-library/user-event` | Needed for future UI tests                    |
| `@types/bcryptjs`             | Type definitions for bcryptjs in test scripts |
| `@opentelemetry/api`          | Peer dependency of other packages             |

---

## 5. Validation Commands

### Before Removal

```bash
# Check current dependency count
npm ls --depth=0 | wc -l

# Check current node_modules size
du -sh node_modules/
```

### After Removal

```bash
# Verify removal
npm ls pino-http  # Should error

# Check new size
du -sh node_modules/

# Rebuild and test
npm run build
npm test
```

---

## 6. Knip Configuration Improvements

Create `.knip.json` to reduce false positives:

```json
{
  "ignore": ["**/*.test.ts", "scripts/**/*.ts", "tests/**/*.ts"],
  "ignoreDependencies": [
    "pino-pretty",
    "@testing-library/user-event",
    "@types/bcryptjs",
    "jsdom",
    "@vitest/coverage-v8"
  ]
}
```

---

## 7. Next Steps

1. **Decision Required:** Choose Option A (aggressive) or Option B (conservative)
2. **Approval Needed:** Confirm removal of @anthropic-ai/sdk, openai, OpenTelemetry
3. **Execute:** Run removal commands
4. **Validate:** Build + test to ensure no breakage
5. **Commit:** Git commit with detailed changelog

---

## Summary Table

| Category                  | Packages | Recommendation         |
| ------------------------- | -------- | ---------------------- |
| Truly Unused              | 1        | ✅ REMOVE NOW          |
| Dead Code (Observability) | 4        | ⚠️ REMOVE or FIX       |
| Dead Code (AI)            | 2        | ⚠️ REMOVE or FIX       |
| Dead Code (UI)            | 1        | ✅ REMOVE              |
| False Positives           | 3        | ✅ KEEP                |
| Unlisted                  | 5        | ✅ ADD TO PACKAGE.JSON |

**Total Removable:** 8 packages (~11MB)
**Total to Add:** 5 packages (2 required, 3 optional)
**Net Change:** -3 dependencies, -11MB
