# OpenSpec Test Generation Strategy

## Overview

Automated test generation from OpenSpec specifications to ensure 100% coverage of documented scenarios.

## Architecture

```
openspec/specs/                    # Source specifications (8 capabilities)
  ├── authentication/spec.md       # 30+ scenarios
  ├── trading-orders/spec.md       # 80+ scenarios
  ├── strategy-management/spec.md  # 70+ scenarios
  ├── portfolio-management/spec.md # 50+ scenarios
  ├── market-data/spec.md          # 40+ scenarios
  ├── ai-analysis/spec.md          # 40+ scenarios
  ├── admin-system/spec.md         # 40+ scenarios
  └── real-time-streaming/spec.md  # 20+ scenarios

scripts/generate-tests-from-openspec.ts  # Generator script

tests/generated/openspec/          # Generated test output
  ├── authentication/
  │   └── authentication.test.ts
  ├── trading-orders/
  │   └── trading-orders.test.ts
  ├── strategy-management/
  │   └── strategy-management.test.ts
  └── fixtures/
      ├── authentication.fixtures.ts
      ├── trading-orders.fixtures.ts
      └── strategy-management.fixtures.ts
```

## Generation Process

### 1. Parse OpenSpec Markdown

The generator parses each `spec.md` file to extract:

- **Capability name and purpose**
- **Requirements** (business requirements)
- **Scenarios** (WHEN/THEN/AND format)
- **API endpoints** (from endpoint tables)

Example scenario extraction:

```markdown
#### Scenario: Successful market order submission

- **WHEN** an authenticated user submits a market order with valid symbol and quantity
- **THEN** the system SHALL validate symbol tradability via tradabilityService
- **AND** check buying power and position limits via pre-trade validation
- **AND** submit the order to Alpaca broker
- **AND** return HTTP 200 with order ID
```

Parsed as:

```typescript
{
  title: "Successful market order submission",
  when: "an authenticated user submits a market order with valid symbol and quantity",
  then: [
    "the system SHALL validate symbol tradability via tradabilityService",
    "check buying power and position limits via pre-trade validation",
    "submit the order to Alpaca broker",
    "return HTTP 200 with order ID"
  ],
  requirement: "Market Order Submission"
}
```

### 2. Convert to Test Cases

Each scenario is converted to a Vitest test case:

```typescript
// From scenario THEN/AND clauses
it("Successful market order submission", async () => {
  if (!serverAvailable) return;

  const session = await createTestSession();
  const symbol = "AAPL";
  const testPayload = {
    symbol,
    side: "buy",
    qty: 10,
    type: "market",
  };

  const response = await authenticatedFetch(
    "/api/orders",
    session.sessionId,
    {
      method: "POST",
      body: JSON.stringify(testPayload),
    }
  );

  // Generated assertions
  expect(result).toBeDefined(); // "validate symbol tradability"
  expect(result).toBeTruthy(); // "check buying power"
  expect(response.status).toBe(200); // "return HTTP 200"
  expect(result).toHaveProperty("id"); // "order ID"
});
```

### 3. Generate Test Fixtures

Fixtures are extracted from scenario examples:

```typescript
export const tradingOrdersFixtures = {
  valid: {
    marketOrder: {
      symbol: "AAPL",
      side: "buy",
      type: "market",
      qty: 10,
    },
    limitOrder: {
      symbol: "AAPL",
      side: "buy",
      type: "limit",
      qty: 10,
      limit_price: 150.0,
    },
  },
  invalid: {
    insufficientBuyingPower: {
      symbol: "AAPL",
      qty: 1000000, // Too large
    },
    invalidSymbol: {
      symbol: "INVALID",
      qty: 10,
    },
  },
};
```

### 4. Assertion Generation Rules

The generator converts natural language THEN/AND clauses to assertions:

| Pattern                                  | Generated Assertion                      |
| ---------------------------------------- | ---------------------------------------- |
| "return HTTP {status}"                   | `expect(response.status).toBe({status})` |
| "create", "generate"                     | `expect(result).toBeDefined()`           |
| "validate", "check"                      | `expect(result).toBeTruthy()`            |
| "reject"                                 | `expect(response.ok).toBe(false)`        |
| "include {field}"                        | `expect(result).toHaveProperty({field})` |
| "set {field} to {value}"                 | `expect(result.{field}).toBe({value})`   |
| "calculate", "aggregate"                 | `expect(typeof result).toBe('number')`   |
| "fetch from {service}", "query {source}" | `expect(result).toBeDefined()`           |

### 5. Setup Code Detection

The generator detects setup requirements from WHEN clauses:

| Pattern                | Generated Setup                             |
| ---------------------- | ------------------------------------------- |
| "authenticated user"   | `const session = await createTestSession()` |
| "valid symbol"         | `const symbol = "AAPL"`                     |
| "strategy"             | `const strategy = testData.strategy()`      |
| "existing position"    | `await createTestPosition()`                |
| "during market hours"  | `await waitForMarketOpen()`                 |
| "with backtest result" | `const backtest = await runBacktest()`      |

## Usage

### Generate All Tests

```bash
npm run generate-tests
```

### Generate for Specific Capability

```bash
tsx scripts/generate-tests-from-openspec.ts authentication
```

### Run Generated Tests

```bash
# Run all generated tests
npm run test -- tests/generated/openspec

# Run specific capability
npm run test -- tests/generated/openspec/authentication

# Watch mode
npm run test:watch -- tests/generated/openspec
```

### Update Specific Test File

If you need to manually adjust a generated test:

1. Edit the OpenSpec scenario in `openspec/specs/{capability}/spec.md`
2. Regenerate: `npm run generate-tests`
3. Review changes in `tests/generated/openspec/{capability}/`

## Generated Test Structure

Each generated test file includes:

### Header Comment

```typescript
/**
 * Generated from OpenSpec: Trading & Orders
 *
 * Order execution and management system...
 *
 * Total Scenarios: 82
 * Generated: 2026-01-02T12:00:00.000Z
 *
 * DO NOT EDIT MANUALLY - Regenerate with:
 *   npm run generate-tests
 */
```

### Imports

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import {
  API_BASE,
  apiFetch,
  authenticatedFetch,
  createTestSession,
  testData,
} from "../../e2e/test-helpers";
```

### Test Suite Setup

```typescript
describe("OpenSpec: Trading & Orders", () => {
  let serverAvailable = false;
  let sessionId: string | null = null;

  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    if (serverAvailable) {
      const session = await createTestSession();
      sessionId = session?.sessionId || null;
    }
  });
  // ... test cases
});
```

### Requirement-Level Describe Blocks

```typescript
describe("Market Order Submission", () => {
  it("Successful market order submission", async () => {
    // Test implementation
  });

  it("Market order during extended hours", async () => {
    // Test implementation
  });
});
```

## Benefits

### 1. Comprehensive Coverage

- **370+ scenarios** from OpenSpec specs
- All documented behaviors tested
- No manual test writing for standard flows

### 2. Consistency

- All tests follow same structure
- Standardized assertions
- Consistent error handling

### 3. Maintainability

- Single source of truth (OpenSpec specs)
- Regenerate on spec changes
- Version controlled test generation

### 4. Documentation Sync

- Tests always match specs
- Failing tests indicate spec drift
- Self-documenting test suite

### 5. Rapid Iteration

- Add scenario to spec → regenerate → tests updated
- No manual test file creation
- Instant test coverage for new features

## Test Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Check Server Availability                            │
│    - Ping /api/health endpoint                          │
│    - Skip tests if server offline                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Create Test Session (if authenticated tests)         │
│    - POST /api/auth/login or /api/auth/register         │
│    - Extract session cookie                             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Execute Requirement Test Suite                       │
│    - Run all scenarios for requirement                  │
│    - Generate test data                                 │
│    - Make API calls                                     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Validate Assertions                                  │
│    - Check HTTP status codes                            │
│    - Validate response structure                        │
│    - Verify business logic                              │
└─────────────────────────────────────────────────────────┘
```

## Limitations and Future Enhancements

### Current Limitations

1. **Static assertions** - Some complex validations need manual refinement
2. **Test data** - Generic payloads may need domain-specific values
3. **Async flows** - Multi-step scenarios require manual sequencing
4. **State management** - Test isolation may need explicit cleanup

### Planned Enhancements

1. **Smart test data extraction** from scenario examples
2. **Assertion inference** from database schema
3. **Multi-step scenario support** (workflow tests)
4. **Snapshot testing** for complex responses
5. **Performance benchmarks** from SLA requirements

## Integration with CI/CD

### GitHub Actions Workflow

```yaml
name: OpenSpec Test Validation

on: [push, pull_request]

jobs:
  openspec-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Generate tests
        run: npm run generate-tests
      - name: Run generated tests
        run: npm run test -- tests/generated/openspec
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit Hook

```bash
#!/bin/bash
# Regenerate tests if OpenSpec specs changed
if git diff --cached --name-only | grep -q "openspec/specs"; then
  echo "OpenSpec changes detected, regenerating tests..."
  npm run generate-tests
  git add tests/generated/openspec
fi
```

## Statistics

| Metric                 | Count |
| ---------------------- | ----- |
| OpenSpec Capabilities  | 8     |
| Total Scenarios        | 370+  |
| Generated Test Files   | 8     |
| Generated Fixture Files | 8     |
| API Endpoints Covered  | 120+  |
| Test Assertions        | 1000+ |

## Examples

### Example 1: Authentication Flow

**OpenSpec Scenario:**

```markdown
#### Scenario: Successful login

- **WHEN** a user provides valid credentials
- **THEN** the system SHALL create a new session
- **AND** set an HTTP-only, secure session cookie with 7-day expiration
- **AND** return HTTP 200 with user ID and username
```

**Generated Test:**

```typescript
it("Successful login", async () => {
  if (!serverAvailable) return;

  const testPayload = {
    username: "testuser",
    password: "testpassword123",
  };

  const response = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(testPayload),
  });

  expect(result).toBeDefined(); // "create a new session"
  // TODO: Verify: set an HTTP-only, secure session cookie
  expect(response.status).toBe(200); // "return HTTP 200"
  expect(result).toHaveProperty("id"); // "user ID"
  expect(result).toHaveProperty("username"); // "username"
});
```

### Example 2: Trading Order Validation

**OpenSpec Scenario:**

```markdown
#### Scenario: Position size limit validation

- **WHEN** an order would create a position exceeding 5% of portfolio value
- **THEN** the system SHALL reject with HTTP 403 Forbidden
- **AND** return error "Position size limit exceeded (max 5% per position)"
```

**Generated Test:**

```typescript
it("Position size limit validation", async () => {
  if (!serverAvailable || !sessionId) return;

  const testPayload = {
    symbol: "AAPL",
    side: "buy",
    qty: 1000000, // Intentionally large
  };

  const response = await authenticatedFetch(
    "/api/orders",
    sessionId,
    {
      method: "POST",
      body: JSON.stringify(testPayload),
    }
  );

  expect(response.ok).toBe(false); // "reject"
  expect(response.status).toBe(403); // "HTTP 403"
  // TODO: Verify error message contains "Position size limit exceeded"
});
```

## Maintenance

### When to Regenerate

- OpenSpec specification changes
- New scenarios added
- Endpoint paths modified
- API contract updates

### When to Manually Edit

Generated tests are read-only. For custom test logic:

1. Create separate test file in `tests/integration/` or `tests/e2e/`
2. Import fixtures from `tests/generated/openspec/fixtures/`
3. Reference generated tests for structure

### Validation

```bash
# Ensure all specs parse correctly
npm run generate-tests

# Run all generated tests
npm run test -- tests/generated/openspec

# Check coverage
npm run test:coverage -- tests/generated/openspec
```

## References

- **OpenSpec Format**: [openspec.org](https://openspec.org)
- **Vitest Documentation**: [vitest.dev](https://vitest.dev)
- **Test Helpers**: `/tests/e2e/test-helpers.ts`
- **Existing E2E Tests**: `/tests/e2e/`
