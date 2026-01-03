# Testing Strategy

## Overview

The AlphaFlow trading platform uses a comprehensive testing strategy with both manual and auto-generated tests:

- **43 test files** with ~21,600 lines of test code
- **370+ scenarios** documented in OpenSpec
- **Automatic test generation** from OpenSpec specifications
- **E2E, Integration, and Unit** test coverage

## Test Categories

### 1. Manual Tests (Existing)

Located in `/tests/`:

```
tests/
├── e2e/                    # End-to-end workflow tests
│   ├── auth-flow.test.ts
│   ├── trading-flow.test.ts
│   ├── strategy-flow.test.ts
│   └── portfolio-flow.test.ts
├── integration/            # Integration tests
│   ├── api-endpoints.test.ts
│   ├── ai-pipeline.test.ts
│   └── trading-engine-fixes.test.ts
├── unit/                   # Unit tests
│   └── components/
└── server/                 # Server-side tests
    ├── trading/
    ├── routes/
    └── autonomous/
```

### 2. Auto-Generated Tests (New)

Located in `/tests/generated/openspec/`:

```
tests/generated/openspec/
├── authentication/
├── trading-orders/
├── strategy-management/
├── portfolio-management/
├── market-data/
├── ai-analysis/
├── admin-system/
└── real-time-streaming/
```

**Generated from**: OpenSpec scenario specifications
**Generator**: `scripts/generate-tests-from-openspec.ts`

## OpenSpec Test Generation

### Quick Start

```bash
# Generate all tests from OpenSpec specs
npm run generate-tests

# Run all tests (manual + generated)
npm run test

# Run only generated tests
npm run test -- tests/generated/openspec

# Run specific capability
npm run test -- tests/generated/openspec/authentication
```

### How It Works

1. **Parses OpenSpec specs** (`openspec/specs/*/spec.md`)
2. **Extracts 370+ scenarios** in WHEN/THEN/AND format
3. **Generates Vitest test cases** with assertions
4. **Creates test fixtures** from scenario data
5. **Outputs organized test files** by capability

### Example Transformation

**OpenSpec Scenario:**

```markdown
#### Scenario: Successful market order submission

- **WHEN** an authenticated user submits a market order with valid symbol
- **THEN** the system SHALL validate buying power
- **AND** submit order to Alpaca
- **AND** return HTTP 200 with order ID
```

**Generated Test:**

```typescript
it("Successful market order submission", async () => {
  const session = await createTestSession();
  const testPayload = { symbol: "AAPL", qty: 10, side: "buy" };

  const response = await authenticatedFetch(
    "/api/orders",
    session.sessionId,
    {
      method: "POST",
      body: JSON.stringify(testPayload),
    }
  );

  expect(result).toBeTruthy(); // "validate buying power"
  expect(result).toBeDefined(); // "submit order"
  expect(response.status).toBe(200); // "return HTTP 200"
  expect(result).toHaveProperty("id"); // "order ID"
});
```

## Test Execution

### Run All Tests

```bash
npm run test              # Run once
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
```

### Run Specific Test Suites

```bash
# E2E tests
npm run test -- tests/e2e

# Integration tests
npm run test -- tests/integration

# Unit tests
npm run test -- tests/unit

# Server tests
npm run test -- tests/server

# Generated tests
npm run test -- tests/generated/openspec
```

### Run Individual Test File

```bash
npm run test -- tests/e2e/auth-flow.test.ts
npm run test -- tests/generated/openspec/authentication/authentication.test.ts
```

## Test Infrastructure

### Test Helpers

Located in `/tests/e2e/test-helpers.ts`:

```typescript
// Session management
createTestSession(): Promise<SessionCookie>

// API requests
apiFetch(path, options): Promise<Response>
authenticatedFetch(path, sessionId, options): Promise<Response>

// Test data generators
testData.strategy()
testData.order(symbol)
testData.watchlistSymbol()
testData.backtest(strategyId)

// Utilities
generateTestId(prefix): string
waitFor(condition, timeout): Promise<boolean>
isServerAvailable(): Promise<boolean>
```

### Test Setup

`/tests/setup.ts` configures:

- Global test environment
- Database connections
- Mock services
- Test timeouts (30s)

### Vitest Configuration

`/vitest.config.ts`:

```typescript
{
  environment: 'jsdom',
  testTimeout: 30000,
  coverage: {
    include: ['app/**', 'components/**', 'server/**', 'shared/**'],
    exclude: ['**/*.test.*', '**/node_modules/**']
  }
}
```

## Coverage Targets

| Category       | Current | Target |
| -------------- | ------- | ------ |
| Statements     | ~60%    | 80%    |
| Branches       | ~50%    | 75%    |
| Functions      | ~55%    | 80%    |
| Lines          | ~60%    | 80%    |
| OpenSpec Specs | 100%    | 100%   |

## Writing Tests

### Manual Test (Custom Logic)

```typescript
// tests/integration/custom-feature.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import {
  createTestSession,
  authenticatedFetch,
} from "../e2e/test-helpers";

describe("Custom Feature", () => {
  let session: SessionCookie;

  beforeAll(async () => {
    session = await createTestSession();
  });

  it("should handle complex scenario", async () => {
    const response = await authenticatedFetch(
      "/api/endpoint",
      session.sessionId
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.result).toBeDefined();
  });
});
```

### Using Generated Fixtures

```typescript
// Import generated fixtures
import { tradingOrdersFixtures } from "../generated/openspec/fixtures/trading-orders.fixtures";

it("should validate order", async () => {
  const order = tradingOrdersFixtures.valid.marketOrder;
  // Use fixture in test...
});
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm ci
      - name: Generate OpenSpec tests
        run: npm run generate-tests
      - name: Run all tests
        run: npm run test
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit Hook

`.husky/pre-commit` includes:

```bash
# Regenerate tests if OpenSpec specs changed
if git diff --cached --name-only | grep -q "openspec/specs"; then
  npm run generate-tests
  git add tests/generated/openspec
fi
```

## Test Maintenance

### When OpenSpec Changes

1. Edit scenario in `openspec/specs/{capability}/spec.md`
2. Run `npm run generate-tests`
3. Review generated test changes
4. Run `npm run test` to verify
5. Commit both spec and test changes

### When API Changes

1. Update OpenSpec endpoint table
2. Regenerate tests
3. Update manual tests if needed
4. Verify all tests pass

### When Test Helpers Change

1. Update `/tests/e2e/test-helpers.ts`
2. Run all tests to verify compatibility
3. Update documentation if needed

## Debugging Tests

### Server Not Available

Tests automatically skip if server is offline:

```bash
# Start server first
npm run dev:server

# Then run tests
npm run test
```

### Authentication Failures

Check test session creation:

```typescript
beforeAll(async () => {
  const session = await createTestSession();
  if (!session) {
    console.log("Failed to create test session");
  }
});
```

### Verbose Output

```bash
# Run with detailed logs
npm run test -- --reporter=verbose

# Run single test for debugging
npm run test -- tests/e2e/auth-flow.test.ts -t "should login"
```

## Best Practices

### 1. Test Independence

- Each test should be self-contained
- Use `beforeAll` for shared setup
- Clean up resources in `afterAll`
- Don't rely on test execution order

### 2. Meaningful Assertions

```typescript
// ❌ Bad
expect(result).toBeTruthy();

// ✅ Good
expect(result.status).toBe("success");
expect(result.data).toHaveLength(5);
expect(result.timestamp).toBeDefined();
```

### 3. Error Testing

```typescript
it("should handle errors gracefully", async () => {
  const response = await apiFetch("/api/invalid");

  expect(response.ok).toBe(false);
  expect(response.status).toBe(404);

  const error = await response.json();
  expect(error.message).toBeDefined();
});
```

### 4. Async/Await

```typescript
// ❌ Bad - missing await
it("test", async () => {
  const result = apiFetch("/api/endpoint"); // Forgot await!
  expect(result).toBeDefined();
});

// ✅ Good
it("test", async () => {
  const response = await apiFetch("/api/endpoint");
  const result = await response.json();
  expect(result).toBeDefined();
});
```

## Resources

- **OpenSpec Test Generation**: `/docs/OPENSPEC_TEST_GENERATION.md`
- **Test Helpers**: `/tests/e2e/test-helpers.ts`
- **Vitest Documentation**: https://vitest.dev
- **OpenSpec Format**: https://openspec.org
- **Coverage Reports**: `/coverage/` (after running `npm run test:coverage`)

## Statistics

| Metric                  | Value      |
| ----------------------- | ---------- |
| Manual Test Files       | 43         |
| Manual Test Lines       | ~21,600    |
| OpenSpec Scenarios      | 370+       |
| Generated Test Files    | 8          |
| Total Test Assertions   | ~1,000+    |
| API Endpoints Tested    | 120+       |
| Test Execution Time     | ~2-5 min   |
| Coverage Target         | 80%        |
| OpenSpec Coverage       | 100%       |
| Test Success Rate (CI)  | Target 95% |

## Quick Reference

```bash
# Generate tests from OpenSpec
npm run generate-tests

# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Run specific suite
npm run test -- tests/e2e
npm run test -- tests/generated/openspec/authentication

# Debug single test
npm run test -- tests/e2e/auth-flow.test.ts -t "should login"

# Check server availability
curl http://localhost:5000/api/health
```
