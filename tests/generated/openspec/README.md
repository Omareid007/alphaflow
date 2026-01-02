# Generated OpenSpec Tests

**DO NOT EDIT FILES IN THIS DIRECTORY MANUALLY**

This directory contains automatically generated test cases from OpenSpec specifications.

## Overview

- **Source**: `openspec/specs/*/spec.md`
- **Generator**: `scripts/generate-tests-from-openspec.ts`
- **Total Scenarios**: 370+
- **Capabilities Covered**: 8

## Structure

```
tests/generated/openspec/
├── authentication/
│   └── authentication.test.ts       # 30+ authentication scenarios
├── trading-orders/
│   └── trading-orders.test.ts       # 80+ order execution scenarios
├── strategy-management/
│   └── strategy-management.test.ts  # 70+ strategy lifecycle scenarios
├── portfolio-management/
│   └── portfolio-management.test.ts # 50+ portfolio scenarios
├── market-data/
│   └── market-data.test.ts          # 40+ market data scenarios
├── ai-analysis/
│   └── ai-analysis.test.ts          # 40+ AI analysis scenarios
├── admin-system/
│   └── admin-system.test.ts         # 40+ admin scenarios
├── real-time-streaming/
│   └── real-time-streaming.test.ts  # 20+ SSE streaming scenarios
└── fixtures/
    ├── authentication.fixtures.ts
    ├── trading-orders.fixtures.ts
    └── ...
```

## Regeneration

Run this command whenever OpenSpec specs are updated:

```bash
npm run generate-tests
```

Or run manually:

```bash
tsx scripts/generate-tests-from-openspec.ts
```

## Running Tests

```bash
# Run all generated tests
npm run test -- tests/generated/openspec

# Run specific capability
npm run test -- tests/generated/openspec/authentication

# Watch mode
npm run test:watch -- tests/generated/openspec

# With coverage
npm run test:coverage -- tests/generated/openspec
```

## Workflow

1. **Update OpenSpec** - Edit scenario in `openspec/specs/{capability}/spec.md`
2. **Regenerate** - Run `npm run generate-tests`
3. **Review** - Check generated test in this directory
4. **Run** - Execute tests with `npm run test`
5. **Commit** - Commit both spec changes and regenerated tests

## Custom Test Logic

For tests requiring custom logic beyond OpenSpec scenarios:

1. **Do not edit generated files** - they will be overwritten
2. **Create custom test** in `tests/integration/` or `tests/e2e/`
3. **Import fixtures** from `tests/generated/openspec/fixtures/`

Example:

```typescript
// tests/integration/custom-order-flow.test.ts
import { tradingOrdersFixtures } from "../generated/openspec/fixtures/trading-orders.fixtures";

describe("Custom Order Flow", () => {
  it("should handle complex multi-leg order", async () => {
    const baseOrder = tradingOrdersFixtures.valid.marketOrder;
    // Custom test logic...
  });
});
```

## Documentation

See `/docs/OPENSPEC_TEST_GENERATION.md` for:

- Complete generation strategy
- Assertion mapping rules
- Setup code detection
- Fixture generation
- CI/CD integration
- Examples and patterns

## Statistics

| Metric                | Count |
| --------------------- | ----- |
| OpenSpec Capabilities | 8     |
| Total Scenarios       | 370+  |
| Test Files            | 8     |
| Fixture Files         | 8     |
| API Endpoints Covered | 120+  |
| Assertions            | 1000+ |

## Last Generated

Generated tests are timestamped in file headers. Check individual test files for generation timestamp.
