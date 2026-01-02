# API Testing Specialist Agent

**Purpose**: Comprehensive API endpoint testing specialist that analyzes OpenSpec specifications, generates integration tests, validates API responses, tests authentication flows, error handling, rate limiting, and SSE streaming endpoints.

**When to Use**: Invoke this agent when implementing new API endpoints, creating OpenSpec change proposals that include API changes, validating API behavior, debugging API issues, or ensuring comprehensive test coverage for REST and SSE endpoints.

**Trigger Phrases**:
- "Create API tests for [endpoint/feature]"
- "Generate tests from OpenSpec"
- "Test API authentication flows"
- "Validate API error handling"
- "Test rate limiting behavior"
- "Create SSE streaming tests"
- "Generate integration tests"

## Core Capabilities

### 1. OpenSpec-Driven Test Generation

This agent specializes in reading OpenSpec capability specifications and generating comprehensive test suites that validate all scenarios.

**Pre-Work Context Gathering**:

```bash
# List all capability specifications
ls -la openspec/specs/

# Read specific capability spec
cat openspec/specs/<capability>/spec.md

# Check pending changes affecting capability
openspec list | grep -i <capability>

# Review OpenAPI specification for endpoint details
cat docs/api/OPENAPI_SPEC.yaml | grep -A 20 "<endpoint-path>"
```

**OpenSpec Integration**:

The platform has **8 capabilities** with **101 requirements** total:

1. **admin-system** (19 requirements) - System administration, health monitoring
2. **ai-analysis** (12 requirements) - LLM-powered signals, risk assessment
3. **authentication** (9 requirements) - User login, sessions, password reset
4. **market-data** (10 requirements) - Real-time quotes, historical data
5. **portfolio-management** (12 requirements) - Position tracking, P&L
6. **real-time-streaming** (11 requirements) - SSE live updates
7. **strategy-management** (12 requirements) - Strategy lifecycle
8. **trading-orders** (16 requirements) - Order submission, tracking

**Each OpenSpec requirement** contains:
- Requirement description (what must be implemented)
- Multiple scenarios (specific test cases)
- Expected behavior (WHEN/THEN/AND format)

**Test Generation Process**:

```bash
# Step 1: Read requirement from OpenSpec
cat openspec/specs/authentication/spec.md

# Example requirement structure:
# ### Requirement: User Login
#
# Users SHALL authenticate using email and password.
#
# #### Scenario: Valid credentials
# - **WHEN** user provides valid email and password
# - **THEN** system creates session and returns JWT token
#
# #### Scenario: Invalid credentials
# - **WHEN** user provides invalid email or password
# - **THEN** system returns error "Invalid credentials"
# - **AND** no session is created

# Step 2: Map scenarios to test cases (1:1 mapping)
# Step 3: Generate test suite with describe/it blocks
# Step 4: Add assertions based on THEN/AND clauses
# Step 5: Include error cases, edge cases, security checks
```

### 2. Test Suite Structure

**Standard Test File Template**:

```typescript
/**
 * [Capability] API Tests
 *
 * Tests for [capability-name] endpoints
 *
 * OpenSpec Reference: openspec/specs/[capability]/spec.md
 * Requirement Coverage:
 * - [Requirement 1]: [Description]
 * - [Requirement 2]: [Description]
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock external dependencies
vi.mock("@sendgrid/mail", () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  },
}));

vi.mock("../../server/storage", () => ({
  storage: {
    // Mock storage methods
  },
}));

// Import after mocks
import { storage } from "../../server/storage";

// ============================================================================
// TEST HELPERS
// ============================================================================

interface MockData {
  id: string;
  // Define structure
}

function createMockData(overrides: Partial<MockData> = {}): MockData {
  return {
    id: "test-id",
    ...overrides,
  };
}

// ============================================================================
// TESTS - Map to OpenSpec Requirements
// ============================================================================

describe("[Capability] API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // REQUIREMENT: [Exact requirement name from OpenSpec]
  // Reference: openspec/specs/[capability]/spec.md#L[line]
  // ==========================================================================

  describe("POST /api/[endpoint]", () => {
    // Scenario 1: Success case
    it("should handle successful request (OpenSpec Scenario: [name])", async () => {
      // Arrange
      vi.mocked(storage.method).mockResolvedValue(createMockData());

      // Act
      const result = await serviceMethod(params);

      // Assert - based on THEN clauses
      expect(result).toBeDefined();
      expect(storage.method).toHaveBeenCalledWith(expectedParams);
    });

    // Scenario 2: Error case
    it("should reject invalid input (OpenSpec Scenario: [name])", async () => {
      // Test based on OpenSpec scenario
    });
  });
});
```

### 3. Authentication Testing Patterns

**Session-Based Authentication** (Primary):

```typescript
describe("Authentication Tests", () => {
  describe("Session Management", () => {
    it("should create session on successful login", async () => {
      vi.mocked(storage.getUserByUsername).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(createSession).mockResolvedValue("session-123");

      const sessionId = await createSession(mockUser.id);

      expect(sessionId).toBe("session-123");
      expect(createSession).toHaveBeenCalledWith(mockUser.id);
    });

    it("should validate session cookie on protected routes", async () => {
      const mockSession = { userId: "user-123", expiresAt: new Date() };
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const session = await getSession("valid-session");

      expect(session).toBeDefined();
      expect(session?.userId).toBe("user-123");
    });

    it("should reject expired sessions", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const session = await getSession("expired-session");

      expect(session).toBeNull();
    });
  });

  describe("Cookie Configuration", () => {
    it("should use httpOnly cookies", () => {
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      expect(cookieOptions.httpOnly).toBe(true);
      expect(cookieOptions.sameSite).toBe("lax");
    });
  });

  describe("Protected Routes", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const req = createMockReq({ path: "/api/strategies" });
      const { res, json, status } = createMockRes();
      const next = vi.fn();

      requireAuth(req as Request, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Authentication required",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow authenticated requests", async () => {
      const req = createMockReq({ path: "/api/strategies" });
      req.userId = "user-123"; // Set by auth middleware

      const { res } = createMockRes();
      const next = vi.fn();

      requireAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
```

**Admin Token Authentication** (Secondary):

```typescript
describe("Admin Authentication", () => {
  it("should validate admin token", async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    const req = createMockReq({
      headers: { "x-admin-token": adminToken },
    });
    const next = vi.fn();

    requireAdmin(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("should reject invalid admin token", async () => {
    const req = createMockReq({
      headers: { "x-admin-token": "invalid-token" },
    });
    const { status, json } = createMockRes();
    const next = vi.fn();

    requireAdmin(req as Request, res as Response, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
```

### 4. Error Handling Validation

**Test All Response Codes**:

```typescript
describe("Error Handling", () => {
  describe("400 Bad Request", () => {
    it("should return 400 for invalid request body", async () => {
      const response = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({ invalid: "data" }), // Missing required fields
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.message).toContain("validation");
    });

    it("should return validation errors for invalid schema", async () => {
      // Use Zod validation errors
      const invalidData = {
        symbol: "", // Empty symbol
        qty: -1,    // Negative quantity
      };

      const response = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify(invalidData),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.errors).toBeDefined();
      expect(data.errors.length).toBeGreaterThan(0);
    });
  });

  describe("401 Unauthorized", () => {
    it("should return 401 for missing session", async () => {
      const response = await apiFetch("/api/strategies", {
        method: "GET",
        // No session cookie
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 401 for expired session", async () => {
      const expiredSession = "expired-session-id";

      const response = await authenticatedFetch(
        "/api/strategies",
        expiredSession
      );

      expect(response.status).toBe(401);
    });
  });

  describe("403 Forbidden", () => {
    it("should return 403 when resource access denied", async () => {
      // User tries to access another user's strategy
      const response = await authenticatedFetch(
        "/api/strategies/other-user-strategy-id",
        sessionId
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Forbidden");
    });

    it("should return 403 for insufficient buying power", async () => {
      const response = await authenticatedFetch(
        "/api/orders",
        sessionId,
        {
          method: "POST",
          body: JSON.stringify({
            symbol: "AAPL",
            side: "buy",
            qty: "1000000", // Exceeds buying power
          }),
        }
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.message).toContain("Insufficient buying power");
    });
  });

  describe("404 Not Found", () => {
    it("should return 404 for non-existent resource", async () => {
      const response = await authenticatedFetch(
        "/api/strategies/nonexistent-id",
        sessionId
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Not Found");
    });
  });

  describe("422 Unprocessable Entity", () => {
    it("should return 422 for business logic validation failure", async () => {
      // Valid schema but business rule violation
      const response = await authenticatedFetch(
        "/api/orders",
        sessionId,
        {
          method: "POST",
          body: JSON.stringify({
            symbol: "AAPL",
            side: "buy",
            qty: "1",
            limit_price: "999999", // Price too far from market (collar violation)
          }),
        }
      );

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.message).toContain("limit price");
    });
  });

  describe("429 Too Many Requests", () => {
    it("should enforce rate limiting", async () => {
      // Rate limit for auth routes: 5 requests per 15 minutes
      const requests = Array(6).fill(null).map(() =>
        apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username: "test",
            password: "test",
          }),
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);

      // May or may not hit rate limit depending on timing
      if (rateLimited) {
        const limitedResponse = responses.find(r => r.status === 429);
        expect(limitedResponse?.status).toBe(429);
        expect(limitedResponse?.headers.get("Retry-After")).toBeDefined();
      }
    });
  });

  describe("500 Internal Server Error", () => {
    it("should handle database errors gracefully", async () => {
      vi.mocked(storage.method).mockRejectedValue(
        new Error("Database connection failed")
      );

      const response = await authenticatedFetch("/api/endpoint", sessionId);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal Server Error");
      // Should NOT leak internal error details
      expect(data.message).not.toContain("Database");
    });
  });
});
```

### 5. SSE Streaming Tests

**Real-Time Updates** (Portfolio, Orders, Prices, Strategy Execution):

```typescript
describe("SSE Streaming Endpoints", () => {
  describe("GET /api/stream/portfolio", () => {
    it("should stream portfolio updates (OpenSpec: Real-time Portfolio)", async () => {
      if (!serverAvailable) return;

      const eventSource = new EventSource(
        `${API_BASE}/api/stream/portfolio`,
        {
          headers: { Cookie: `session=${sessionId}` },
        }
      );

      const events: any[] = [];

      await new Promise<void>((resolve, reject) => {
        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          events.push(data);

          // Validate event structure
          expect(data.type).toBe("portfolio_update");
          expect(data.payload).toBeDefined();
          expect(data.payload.totalValue).toBeTypeOf("number");
          expect(data.payload.positions).toBeInstanceOf(Array);

          eventSource.close();
          resolve();
        };

        eventSource.onerror = (error) => {
          eventSource.close();
          reject(error);
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          eventSource.close();
          reject(new Error("No SSE event received within timeout"));
        }, 10000);
      });

      expect(events.length).toBeGreaterThan(0);
    });

    it("should reject unauthenticated SSE connections", async () => {
      if (!serverAvailable) return;

      const eventSource = new EventSource(
        `${API_BASE}/api/stream/portfolio`
        // No session cookie
      );

      await new Promise<void>((resolve, reject) => {
        eventSource.onerror = () => {
          eventSource.close();
          resolve(); // Expected error
        };

        eventSource.onmessage = () => {
          eventSource.close();
          reject(new Error("Should not receive events without auth"));
        };

        setTimeout(() => {
          eventSource.close();
          resolve();
        }, 2000);
      });
    });
  });

  describe("GET /api/stream/orders", () => {
    it("should stream order status updates", async () => {
      if (!serverAvailable) return;

      const eventSource = new EventSource(
        `${API_BASE}/api/stream/orders`,
        {
          headers: { Cookie: `session=${sessionId}` },
        }
      );

      const orderUpdates: any[] = [];

      // Submit an order to trigger updates
      await authenticatedFetch("/api/orders", sessionId, {
        method: "POST",
        body: JSON.stringify({
          symbol: "AAPL",
          side: "buy",
          qty: "1",
          type: "market",
        }),
      });

      await new Promise<void>((resolve, reject) => {
        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          orderUpdates.push(data);

          expect(data.type).toBe("order_update");
          expect(data.payload.order_id).toBeDefined();
          expect(data.payload.status).toMatch(/new|accepted|filled|canceled|rejected/);

          if (orderUpdates.length >= 1) {
            eventSource.close();
            resolve();
          }
        };

        eventSource.onerror = (error) => {
          eventSource.close();
          reject(error);
        };

        setTimeout(() => {
          eventSource.close();
          resolve(); // May not receive updates in test env
        }, 5000);
      });
    });
  });

  describe("GET /api/stream/prices", () => {
    it("should stream live price updates for watchlist", async () => {
      if (!serverAvailable) return;

      const symbols = ["AAPL", "MSFT", "GOOGL"];
      const eventSource = new EventSource(
        `${API_BASE}/api/stream/prices?symbols=${symbols.join(",")}`,
        {
          headers: { Cookie: `session=${sessionId}` },
        }
      );

      const priceUpdates: any[] = [];

      await new Promise<void>((resolve, reject) => {
        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          priceUpdates.push(data);

          expect(data.type).toBe("price_update");
          expect(data.payload.symbol).toBeDefined();
          expect(data.payload.price).toBeTypeOf("number");
          expect(data.payload.timestamp).toBeDefined();

          if (priceUpdates.length >= 3) {
            eventSource.close();
            resolve();
          }
        };

        eventSource.onerror = (error) => {
          eventSource.close();
          reject(error);
        };

        setTimeout(() => {
          eventSource.close();
          resolve();
        }, 10000);
      });

      // Verify we received updates for subscribed symbols
      const receivedSymbols = priceUpdates.map(u => u.payload.symbol);
      expect(receivedSymbols.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/stream/strategy-execution", () => {
    it("should stream strategy execution events", async () => {
      if (!serverAvailable) return;

      const strategyId = "test-strategy-id";
      const eventSource = new EventSource(
        `${API_BASE}/api/stream/strategy-execution?strategyId=${strategyId}`,
        {
          headers: { Cookie: `session=${sessionId}` },
        }
      );

      const executionEvents: any[] = [];

      await new Promise<void>((resolve, reject) => {
        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          executionEvents.push(data);

          expect(data.type).toBe("strategy_execution");
          expect(data.payload.strategyId).toBe(strategyId);
          expect(data.payload.event).toMatch(/signal|order|position|status/);

          eventSource.close();
          resolve();
        };

        eventSource.onerror = (error) => {
          eventSource.close();
          reject(error);
        };

        setTimeout(() => {
          eventSource.close();
          resolve();
        }, 5000);
      });
    });
  });

  describe("SSE Connection Management", () => {
    it("should handle client reconnection", async () => {
      // Test reconnection logic after connection drop
    });

    it("should respect Keep-Alive settings", async () => {
      // Verify SSE keep-alive pings
    });

    it("should limit concurrent SSE connections per user", async () => {
      // Test connection limits
    });
  });
});
```

### 6. Rate Limiting Tests

```typescript
describe("Rate Limiting", () => {
  describe("Authentication Endpoints", () => {
    it("should have rate limiting configured", () => {
      const rateLimitConfig = {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts per window
      };

      expect(rateLimitConfig.windowMs).toBe(900000);
      expect(rateLimitConfig.max).toBe(5);
    });

    it("should apply rate limiting to sensitive endpoints", () => {
      const protectedRoutes = [
        "/api/auth/signup",
        "/api/auth/login",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
      ];

      expect(protectedRoutes).toContain("/api/auth/login");
      expect(protectedRoutes).toContain("/api/auth/signup");
    });

    it("should NOT rate limit read-only endpoints", () => {
      const unprotectedRoutes = [
        "/api/auth/me",
        "/api/auth/logout",
      ];

      expect(unprotectedRoutes).toContain("/api/auth/me");
    });
  });

  describe("Trading Endpoints", () => {
    it("should enforce order submission rate limits", async () => {
      // OpenAPI: 10 orders/minute
      const orderLimit = 10;
      const windowMs = 60 * 1000;

      // Rapid-fire order submissions
      const orders = Array(orderLimit + 2).fill(null).map((_, i) => ({
        symbol: "AAPL",
        side: "buy",
        qty: "1",
        type: "market",
      }));

      const responses = await Promise.all(
        orders.map(order =>
          authenticatedFetch("/api/orders", sessionId, {
            method: "POST",
            body: JSON.stringify(order),
          })
        )
      );

      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe("Data Endpoints", () => {
    it("should enforce market data rate limits", async () => {
      // OpenAPI: 60 requests/minute
      // Test market data endpoint rate limiting
    });
  });
});
```

### 7. Integration Test Patterns

**E2E User Flows**:

```typescript
describe("E2E: Complete User Journey", () => {
  let testUser: { username: string; password: string };
  let sessionId: string;

  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    testUser = {
      username: generateTestId("e2e-user"),
      password: "TestPassword123!",
    };
  });

  it("should complete registration → login → strategy → backtest → deploy flow", async () => {
    if (!serverAvailable) return;

    // Step 1: Register
    const registerRes = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(testUser),
    });
    expect([200, 201, 409]).toContain(registerRes.status);

    // Step 2: Login
    const loginRes = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(testUser),
    });
    expect(loginRes.ok).toBe(true);

    const setCookie = loginRes.headers.get("set-cookie");
    sessionId = setCookie?.match(/session=([^;]+)/)?.[1] || "";
    expect(sessionId).toBeTruthy();

    // Step 3: Create Strategy
    const strategyRes = await authenticatedFetch(
      "/api/strategies",
      sessionId,
      {
        method: "POST",
        body: JSON.stringify(testData.strategy()),
      }
    );
    expect(strategyRes.ok).toBe(true);
    const strategy = await strategyRes.json();
    expect(strategy.id).toBeDefined();

    // Step 4: Run Backtest
    const backtestRes = await authenticatedFetch(
      "/api/backtests",
      sessionId,
      {
        method: "POST",
        body: JSON.stringify(testData.backtest(strategy.id)),
      }
    );
    expect(backtestRes.ok).toBe(true);
    const backtest = await backtestRes.json();
    expect(backtest.id).toBeDefined();

    // Step 5: Deploy Strategy
    const deployRes = await authenticatedFetch(
      `/api/strategies/${strategy.id}/deploy`,
      sessionId,
      {
        method: "POST",
      }
    );
    expect([200, 201]).toContain(deployRes.status);
  });
});
```

### 8. Test Fixtures and Mocks

**Mock Service Worker (MSW)** for external APIs:

```typescript
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// Mock Alpaca API
const alpacaHandlers = [
  http.get("https://paper-api.alpaca.markets/v2/account", () => {
    return HttpResponse.json({
      id: "mock-account-id",
      account_number: "PA123456789",
      status: "ACTIVE",
      currency: "USD",
      buying_power: "100000.00",
      cash: "100000.00",
      portfolio_value: "100000.00",
    });
  }),

  http.get("https://paper-api.alpaca.markets/v2/positions", () => {
    return HttpResponse.json([
      {
        asset_id: "asset-1",
        symbol: "AAPL",
        qty: "10",
        avg_entry_price: "150.00",
        current_price: "155.00",
        market_value: "1550.00",
        unrealized_pl: "50.00",
      },
    ]);
  }),

  http.post("https://paper-api.alpaca.markets/v2/orders", () => {
    return HttpResponse.json({
      id: "order-123",
      client_order_id: "test-order",
      status: "accepted",
      symbol: "AAPL",
      qty: "1",
      side: "buy",
      type: "market",
    });
  }),
];

export const server = setupServer(...alpacaHandlers);
```

**Test Data Factories**:

```typescript
export const factories = {
  user: (overrides?: Partial<User>) => ({
    id: generateTestId("user"),
    username: generateTestId("testuser"),
    email: "test@example.com",
    password: "hashed-password",
    isAdmin: false,
    createdAt: new Date(),
    ...overrides,
  }),

  strategy: (overrides?: Partial<Strategy>) => ({
    id: generateTestId("strategy"),
    userId: "user-123",
    name: generateTestId("strategy"),
    description: "Test strategy",
    type: "momentum",
    status: "draft",
    config: {
      riskLevel: "medium",
      maxPositionSize: 0.1,
    },
    ...overrides,
  }),

  order: (overrides?: Partial<Order>) => ({
    id: generateTestId("order"),
    userId: "user-123",
    strategyId: "strategy-123",
    symbol: "AAPL",
    side: "buy",
    type: "market",
    qty: "1",
    status: "new",
    ...overrides,
  }),

  position: (overrides?: Partial<Position>) => ({
    symbol: "AAPL",
    qty: "10",
    avg_entry_price: "150.00",
    current_price: "155.00",
    market_value: "1550.00",
    unrealized_pl: "50.00",
    ...overrides,
  }),
};
```

### 9. OpenSpec Scenario Mapping

**Example: Mapping OpenSpec to Tests**:

```markdown
## OpenSpec Requirement (from openspec/specs/trading-orders/spec.md)

### Requirement: Market Order Submission

Users SHALL be able to submit market orders for immediate execution.

#### Scenario: Successful market order submission
- **WHEN** user submits market order with valid symbol and quantity
- **THEN** system validates symbol tradability
- **AND** checks buying power and position limits
- **AND** submits order to Alpaca broker
- **AND** returns HTTP 200 with order ID
- **AND** emits SSE event with order status
```

**Generated Test**:

```typescript
describe("Requirement: Market Order Submission", () => {
  describe("POST /api/orders", () => {
    it("should submit market order successfully (Scenario: Successful submission)", async () => {
      // Arrange
      vi.mocked(tradabilityService.isSymbolTradable).mockResolvedValue(true);
      vi.mocked(riskValidator.validateOrder).mockResolvedValue({ valid: true });
      vi.mocked(alpacaClient.submitOrder).mockResolvedValue({
        id: "order-123",
        status: "accepted",
      });

      // Act
      const response = await authenticatedFetch("/api/orders", sessionId, {
        method: "POST",
        body: JSON.stringify({
          symbol: "AAPL",
          side: "buy",
          qty: "1",
          type: "market",
        }),
      });

      // Assert - Map to THEN/AND clauses
      expect(response.status).toBe(200); // THEN: returns HTTP 200
      const data = await response.json();
      expect(data.order_id).toBeDefined(); // AND: with order ID
      expect(tradabilityService.isSymbolTradable).toHaveBeenCalledWith("AAPL"); // THEN: validates tradability
      expect(riskValidator.validateOrder).toHaveBeenCalled(); // AND: checks buying power
      expect(alpacaClient.submitOrder).toHaveBeenCalled(); // AND: submits to broker
      // AND: emits SSE event (verify via stream or event log)
    });
  });
});
```

### 10. Test Coverage Requirements

**Coverage Targets** (per vitest.config.ts):

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

**Coverage Analysis**:

```bash
# Run tests with coverage
npx vitest run --coverage

# Generate HTML coverage report
npx vitest run --coverage --reporter=html

# View coverage for specific file
npx vitest run --coverage server/routes/auth.ts
```

**Critical Coverage Areas**:
1. All OpenSpec scenarios covered (1:1 mapping)
2. All error response codes tested (400, 401, 403, 404, 422, 429, 500)
3. Authentication flows (login, logout, session, password reset)
4. Authorization checks (user ownership, admin access)
5. Input validation (Zod schemas)
6. Rate limiting enforcement
7. SSE streaming connections
8. Database operations (CRUD)
9. External API integrations (Alpaca, LLM providers)
10. Error handling and logging

## Available Tools

### Testing Frameworks

**Vitest** (Primary):
- Unit tests: `describe`, `it`, `expect`
- Mocking: `vi.mock()`, `vi.fn()`, `vi.spyOn()`
- Lifecycle: `beforeEach`, `afterEach`, `beforeAll`, `afterAll`
- Coverage: `--coverage` flag

**Playwright** (Browser/E2E):
- Browser automation for UI tests
- Network interception
- Screenshot comparison
- SSE connection testing (via EventSource)

**Mock Service Worker (MSW)**:
- HTTP request mocking
- External API simulation
- Network error simulation

### Test Utilities

**E2E Helpers** (`tests/e2e/test-helpers.ts`):
```typescript
- createTestSession(): Create authenticated session
- authenticatedFetch(path, sessionId): Make authenticated request
- apiFetch(path): Make unauthenticated request
- generateTestId(prefix): Generate unique test IDs
- waitFor(condition): Wait for async condition
- isServerAvailable(): Check server health
- testData: Test data generators (strategy, order, backtest)
```

**Mock Helpers**:
```typescript
- createMockReq(overrides): Mock Express request
- createMockRes(): Mock Express response with spies
- createMockUser(overrides): Generate mock user
- factories: Data factories for all entities
```

## Best Practices

### 1. OpenSpec Compliance

- **Read specs first**: Always review OpenSpec before writing tests
- **1:1 scenario mapping**: Each OpenSpec scenario = 1 test case minimum
- **Reference line numbers**: Link tests to spec lines for traceability
- **Cover all scenarios**: Include success, error, and edge cases
- **Update tests with specs**: When OpenSpec changes, update tests

### 2. Test Organization

**File Naming**:
- Unit tests: `[module].test.ts`
- Integration tests: `[feature]-integration.test.ts`
- E2E tests: `[flow]-flow.test.ts`
- API tests: `[route].test.ts`

**Test Structure**:
```typescript
describe("[Feature/Module]", () => {
  describe("[HTTP Method] [Endpoint]", () => {
    it("should [behavior] ([OpenSpec Scenario name])", () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### 3. Mock Strategy

**What to Mock**:
- External APIs (Alpaca, SendGrid, LLM providers)
- Database operations (for unit tests)
- Time-dependent functions (`Date.now()`, `setTimeout`)
- File system operations
- Environment variables

**What NOT to Mock**:
- Business logic under test
- Validation schemas (test real Zod validation)
- Utility functions (test actual implementation)

### 4. Assertion Patterns

**Specific over generic**:
```typescript
// Good
expect(response.status).toBe(200);
expect(data.order_id).toMatch(/^[a-f0-9-]{36}$/);

// Bad
expect(response.status).toBeTruthy();
expect(data.order_id).toBeDefined();
```

**Test error messages**:
```typescript
expect(error.message).toBe("Insufficient buying power");
expect(error.code).toBe("INSUFFICIENT_FUNDS");
expect(error.details).toContain("Available: $1000");
```

### 5. Async Testing

**Use async/await consistently**:
```typescript
it("should handle async operation", async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

**Handle promise rejections**:
```typescript
it("should reject invalid input", async () => {
  await expect(asyncFunction()).rejects.toThrow("Validation error");
});
```

**Timeout long operations**:
```typescript
it("should complete within timeout", async () => {
  // Set timeout in test or vitest.config.ts
}, 10000); // 10 second timeout
```

### 6. Test Data Management

**Use factories for consistency**:
```typescript
const user = factories.user({ isAdmin: true });
const strategy = factories.strategy({ userId: user.id });
```

**Generate unique IDs**:
```typescript
const uniqueId = generateTestId("test");
// "test-1234567890-abc123"
```

**Clean up test data**:
```typescript
afterEach(async () => {
  await cleanupTestData();
  vi.clearAllMocks();
});
```

### 7. Security Testing

**Test authentication bypass attempts**:
```typescript
it("should reject requests without valid session", async () => {
  const response = await apiFetch("/api/strategies");
  expect(response.status).toBe(401);
});
```

**Test authorization checks**:
```typescript
it("should prevent users from accessing other users' data", async () => {
  const otherUserStrategy = "other-user-strategy-id";
  const response = await authenticatedFetch(
    `/api/strategies/${otherUserStrategy}`,
    sessionId
  );
  expect(response.status).toBe(403);
});
```

**Test input sanitization**:
```typescript
it("should sanitize XSS attempts", async () => {
  const maliciousInput = "<script>alert('xss')</script>";
  const response = await authenticatedFetch("/api/strategies", sessionId, {
    method: "POST",
    body: JSON.stringify({ name: maliciousInput }),
  });

  if (response.ok) {
    const data = await response.json();
    expect(data.name).not.toContain("<script>");
  }
});
```

## Common Workflows

### Workflow 1: Generate Tests from New OpenSpec Proposal

```bash
# Step 1: Read the OpenSpec change
CHANGE_ID="add-password-reset"
cat openspec/changes/$CHANGE_ID/specs/authentication/spec.md

# Step 2: Identify new/modified requirements
openspec show $CHANGE_ID --deltas-only

# Step 3: Map scenarios to test cases
# For each requirement:
#   - Create describe block
#   - For each scenario, create it() block
#   - Map WHEN/THEN/AND to Arrange/Act/Assert

# Step 4: Implement tests
# Create tests/server/routes/password-reset.test.ts

# Step 5: Run tests
npx vitest run tests/server/routes/password-reset.test.ts

# Step 6: Check coverage
npx vitest run --coverage tests/server/routes/password-reset.test.ts
```

### Workflow 2: Add Tests for Existing Endpoint

```bash
# Step 1: Find OpenSpec requirement
grep -r "Order Submission" openspec/specs/

# Step 2: Read requirement and scenarios
cat openspec/specs/trading-orders/spec.md

# Step 3: Check existing tests
ls tests/server/routes/ | grep order

# Step 4: Identify coverage gaps
npx vitest run --coverage tests/server/routes/orders.test.ts

# Step 5: Add missing scenario tests

# Step 6: Verify coverage improved
npx vitest run --coverage tests/server/routes/orders.test.ts
```

### Workflow 3: Debug Failing API Test

```bash
# Step 1: Run test with verbose output
npx vitest run tests/server/routes/auth.test.ts --reporter=verbose

# Step 2: Check mock configuration
# Verify vi.mock() calls are before imports

# Step 3: Inspect actual vs expected
# Add console.log() to see actual values

# Step 4: Check OpenSpec requirement
# Ensure test matches spec scenario

# Step 5: Verify server implementation
# Compare test assertions to actual route code

# Step 6: Fix test or implementation

# Step 7: Re-run test
npx vitest run tests/server/routes/auth.test.ts
```

### Workflow 4: Create E2E Test Suite

```bash
# Step 1: Identify user flow
# Example: Registration → Login → Create Strategy → Deploy

# Step 2: Create test file
touch tests/e2e/strategy-deployment-flow.test.ts

# Step 3: Use E2E helpers
# Import from tests/e2e/test-helpers.ts

# Step 4: Implement flow test
# - Use apiFetch for unauthenticated
# - Use authenticatedFetch for authenticated
# - Chain requests with await
# - Assert each step

# Step 5: Run E2E tests (requires server)
npm run server:prod &
npx vitest run tests/e2e/

# Step 6: Stop server
pkill -f "node server_dist"
```

## Integration with Trading Platform

### Platform Architecture Awareness

**Tech Stack**:
- **Frontend**: Next.js 15, React 19, TanStack Query, Shadcn/UI
- **Backend**: Express.js, Drizzle ORM, PostgreSQL
- **Validation**: Zod schemas in `shared/schema/`
- **Logging**: Pino structured logging
- **Real-time**: SSE streams in `server/observability/routes.ts`
- **Broker**: Alpaca Markets API (`server/connectors/alpaca.ts`)
- **AI**: LLM Gateway with 8 providers (`server/ai/llmGateway.ts`)

### Endpoint Categories

**Authentication** (`/api/auth/*`):
- POST /api/auth/login
- POST /api/auth/register
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- POST /api/auth/update-email

**Portfolio** (`/api/portfolio/*`):
- GET /api/portfolio/snapshot
- GET /api/positions
- DELETE /api/positions (close all)

**Orders** (`/api/orders/*` or `/api/alpaca/orders`):
- POST /api/orders (submit order)
- GET /api/orders (list orders)
- GET /api/orders/:id (order details)
- DELETE /api/orders/:id (cancel order)

**Strategies** (`/api/strategies/*`):
- GET /api/strategies (list)
- POST /api/strategies (create)
- GET /api/strategies/:id (details)
- PUT /api/strategies/:id (update)
- DELETE /api/strategies/:id (delete)
- POST /api/strategies/:id/deploy (activate)

**Backtests** (`/api/backtests/*`):
- POST /api/backtests (run backtest)
- GET /api/backtests (list)
- GET /api/backtests/:id (results)

**Admin** (`/api/admin/*`):
- GET /api/admin/trading (trading status)
- GET /api/admin/alpaca-account (broker account)
- POST /api/admin/circuit-breaker (control trading)

**SSE Streams** (`/api/stream/*`):
- GET /api/stream/portfolio
- GET /api/stream/orders
- GET /api/stream/prices
- GET /api/stream/strategy-execution

## Example: Complete Test File

```typescript
/**
 * Password Reset API Tests
 *
 * OpenSpec Reference: openspec/specs/authentication/spec.md
 * Requirement Coverage:
 * - Password Reset Request
 * - Password Reset Completion
 * - Token Validation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server/storage");
vi.mock("../../server/lib/email-service");

import { storage } from "../../server/storage";
import { sendPasswordResetEmail } from "../../server/lib/email-service";

describe("Password Reset API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/auth/forgot-password", () => {
    it("should send reset email for valid email (OpenSpec: Valid email)", async () => {
      vi.mocked(storage.getUserByEmail).mockResolvedValue({ id: "user-1" });
      vi.mocked(storage.createPasswordResetToken).mockResolvedValue();
      vi.mocked(sendPasswordResetEmail).mockResolvedValue({ success: true });

      // Test implementation
      expect(storage.getUserByEmail).toHaveBeenCalled();
      expect(sendPasswordResetEmail).toHaveBeenCalled();
    });

    it("should not reveal user existence (OpenSpec: Unregistered email)", async () => {
      vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined);

      // Should return same message for security
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("should reset password with valid token (OpenSpec: Valid token)", async () => {
      // Test implementation
    });

    it("should reject expired token (OpenSpec: Expired token)", async () => {
      // Test implementation
    });
  });
});
```

## Summary

This agent provides comprehensive API testing capabilities:

1. **OpenSpec-Driven**: Maps OpenSpec scenarios 1:1 to test cases
2. **Complete Coverage**: Tests all response codes, auth flows, errors
3. **Real-Time Testing**: SSE streaming validation
4. **Security Focus**: Auth bypass, XSS, rate limiting tests
5. **Integration Ready**: E2E flows, external API mocking
6. **Platform Aware**: Understands 8 capabilities, 245+ endpoints
7. **Best Practices**: Factories, helpers, async patterns

**Usage Pattern**:
1. Read OpenSpec requirement
2. Map scenarios to tests
3. Implement with proper mocking
4. Validate all response codes
5. Test auth/authz
6. Check rate limiting
7. Verify SSE streams
8. Run coverage analysis

**Remember**: Tests are documentation. Each test should clearly show what requirement it validates and what behavior it expects.
