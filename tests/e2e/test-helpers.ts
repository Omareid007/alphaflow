/**
 * E2E Test Helpers
 *
 * Provides utilities for API-based E2E testing including:
 * - Session management
 * - Authenticated requests
 * - Test data generators
 */

export const API_BASE = process.env.API_BASE || "http://localhost:5000";

interface SessionCookie {
  sessionId: string;
  userId: string;
}

/**
 * Create a test user session
 */
export async function createTestSession(): Promise<SessionCookie | null> {
  try {
    // Try to login with test credentials
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "testuser",
        password: "testpassword123",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const setCookie = response.headers.get("set-cookie");
      const sessionMatch = setCookie?.match(/session=([^;]+)/);
      return {
        sessionId: sessionMatch?.[1] || "",
        userId: data.user?.id || "",
      };
    }

    // If login fails, try to register
    const registerResponse = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "testuser",
        password: "testpassword123",
      }),
    });

    if (registerResponse.ok) {
      const data = await registerResponse.json();
      const setCookie = registerResponse.headers.get("set-cookie");
      const sessionMatch = setCookie?.match(/session=([^;]+)/);
      return {
        sessionId: sessionMatch?.[1] || "",
        userId: data.user?.id || "",
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Make authenticated API request
 */
export async function authenticatedFetch(
  path: string,
  sessionId: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: `session=${sessionId}`,
      ...options.headers,
    },
  });
}

/**
 * Make unauthenticated API request
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/**
 * Generate unique test identifiers
 */
export function generateTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Test data generators
 */
export const testData = {
  strategy: () => ({
    name: generateTestId("test-strategy"),
    description: "E2E test strategy",
    type: "momentum",
    status: "draft",
    config: {
      riskLevel: "medium",
      maxPositionSize: 0.1,
      stopLossPercent: 5,
      takeProfitPercent: 10,
    },
    parameters: {
      lookbackPeriod: 20,
      signalThreshold: 0.6,
    },
  }),

  order: (symbol: string = "AAPL") => ({
    symbol,
    side: "buy" as const,
    type: "market" as const,
    qty: "1",
    timeInForce: "day",
  }),

  watchlistSymbol: () => ({
    symbol: ["AAPL", "MSFT", "GOOGL", "AMZN", "META"][
      Math.floor(Math.random() * 5)
    ],
  }),

  backtest: (strategyId: string) => ({
    strategyId,
    startDate: "2024-01-01",
    endDate: "2024-06-30",
    initialCapital: 100000,
    symbols: ["AAPL", "MSFT", "GOOGL"],
  }),
};

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return false;
}

/**
 * Check if server is available
 */
export async function isServerAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Skip test if server is not available
 */
export async function skipIfServerUnavailable(): Promise<void> {
  const available = await isServerAvailable();
  if (!available) {
    console.log("Server not available, skipping E2E tests");
    throw new Error("Server not available");
  }
}
