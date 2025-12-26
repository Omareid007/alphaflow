# Standard Error Response Format

## Overview

This document describes the standardized error response format used across all API endpoints in the AI Active Trader platform.

## Standard Error Format

All API errors follow this consistent structure:

```typescript
{
  error: string;        // Error type/category (e.g., "bad_request", "not_found")
  message: string;      // Human-readable error message
  statusCode: number;   // HTTP status code
  details?: any;        // Optional additional error context
  timestamp?: string;   // ISO 8601 timestamp (optional)
  path?: string;        // Request path (optional)
}
```

## Error Helper Functions

The system provides helper functions in `/server/lib/standard-errors.ts`:

### 400 Bad Request

```typescript
import { badRequest } from "./lib/standard-errors";

// Usage
if (!symbol) {
  return badRequest(res, "Symbol parameter is required");
}

// With details
return badRequest(res, "Invalid parameters", {
  missing: ["symbol", "quantity"]
});
```

**Response:**
```json
{
  "error": "Bad Request",
  "message": "Symbol parameter is required",
  "statusCode": 400,
  "timestamp": "2025-12-23T15:30:00.000Z"
}
```

### 401 Unauthorized

```typescript
import { unauthorized } from "./lib/standard-errors";

// Usage
if (!validPassword) {
  return unauthorized(res, "Invalid username or password");
}

// Default message
return unauthorized(res); // "Authentication required"
```

**Response:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid username or password",
  "statusCode": 401,
  "timestamp": "2025-12-23T15:30:00.000Z"
}
```

### 403 Forbidden

```typescript
import { forbidden } from "./lib/standard-errors";

// Usage
if (!user.isAdmin) {
  return forbidden(res, "Admin access required");
}

// Default message
return forbidden(res); // "Access denied"
```

**Response:**
```json
{
  "error": "Forbidden",
  "message": "Admin access required",
  "statusCode": 403,
  "timestamp": "2025-12-23T15:30:00.000Z"
}
```

### 404 Not Found

```typescript
import { notFound } from "./lib/standard-errors";

// Usage
if (!strategy) {
  return notFound(res, "Strategy not found");
}

// With details
return notFound(res, "Resource not found", {
  resourceType: "strategy",
  requestedId: strategyId
});
```

**Response:**
```json
{
  "error": "Not Found",
  "message": "Strategy not found",
  "statusCode": 404,
  "timestamp": "2025-12-23T15:30:00.000Z"
}
```

### 409 Conflict

```typescript
import { conflict } from "./lib/standard-errors";

// Usage
if (existingUser) {
  return conflict(res, "Username already exists");
}
```

**Response:**
```json
{
  "error": "Conflict",
  "message": "Username already exists",
  "statusCode": 409,
  "timestamp": "2025-12-23T15:30:00.000Z"
}
```

### 422 Validation Error

```typescript
import { validationError } from "./lib/standard-errors";

// Usage with Zod
const parsed = schema.safeParse(req.body);
if (!parsed.success) {
  return validationError(res, "Validation failed", parsed.error);
}

// Custom validation
return validationError(res, "Invalid configuration", {
  fields: {
    stopLoss: "Must be between 0 and 100",
    takeProfit: "Must be greater than stop loss"
  }
});
```

**Response:**
```json
{
  "error": "Validation Error",
  "message": "Validation failed",
  "statusCode": 422,
  "details": {
    "fields": {
      "stopLoss": "Must be between 0 and 100"
    }
  },
  "timestamp": "2025-12-23T15:30:00.000Z"
}
```

### 429 Too Many Requests

```typescript
import { tooManyRequests } from "./lib/standard-errors";

// Usage
if (rateLimitExceeded) {
  return tooManyRequests(res, "Rate limit exceeded. Try again in 60 seconds", {
    retryAfter: 60,
    limit: 100,
    current: 101
  });
}
```

**Response:**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 60 seconds",
  "statusCode": 429,
  "details": {
    "retryAfter": 60,
    "limit": 100,
    "current": 101
  },
  "timestamp": "2025-12-23T15:30:00.000Z"
}
```

### 500 Internal Server Error

```typescript
import { serverError } from "./lib/standard-errors";

// Usage
catch (error) {
  log.error("API", `Operation failed: ${error}`);
  return serverError(res, "Failed to process request");
}

// With error details (dev mode)
return serverError(res, error.message, {
  stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
});
```

**Response:**
```json
{
  "error": "Internal Server Error",
  "message": "Failed to process request",
  "statusCode": 500,
  "timestamp": "2025-12-23T15:30:00.000Z"
}
```

### 503 Service Unavailable

```typescript
import { serviceUnavailable } from "./lib/standard-errors";

// Usage
if (!databaseConnected) {
  return serviceUnavailable(res, "Database temporarily unavailable");
}
```

**Response:**
```json
{
  "error": "Service Unavailable",
  "message": "Database temporarily unavailable",
  "statusCode": 503,
  "timestamp": "2025-12-23T15:30:00.000Z"
}
```

## Complete Helper Function List

| Function | Status Code | Error Type | Default Message |
|----------|-------------|------------|-----------------|
| `badRequest()` | 400 | Bad Request | "Invalid request parameters" |
| `unauthorized()` | 401 | Unauthorized | "Authentication required" |
| `forbidden()` | 403 | Forbidden | "Access denied" |
| `notFound()` | 404 | Not Found | "Resource not found" |
| `conflict()` | 409 | Conflict | "Resource conflict" |
| `validationError()` | 422 | Validation Error | "Validation failed" |
| `tooManyRequests()` | 429 | Too Many Requests | "Rate limit exceeded" |
| `serverError()` | 500 | Internal Server Error | "An internal server error occurred" |
| `serviceUnavailable()` | 503 | Service Unavailable | "Service temporarily unavailable" |

## Additional Utilities

### fromZodError

Helper to convert Zod validation errors to standard format:

```typescript
import { fromZodError } from "./lib/standard-errors";

const parsed = schema.safeParse(req.body);
if (!parsed.success) {
  return fromZodError(res, parsed.error);
}
```

### asyncHandler

Wrapper for async route handlers with automatic error handling:

```typescript
import { asyncHandler } from "./lib/standard-errors";

router.get("/data", asyncHandler(async (req, res) => {
  const data = await fetchData();
  res.json(data);
  // Errors are automatically caught and converted to standard format
}));
```

### AppError

Custom error class for business logic errors:

```typescript
import { AppError } from "./lib/standard-errors";

// Throw in business logic
if (insufficientFunds) {
  throw new AppError(400, "Insufficient funds for trade", {
    required: 1000,
    available: 500
  });
}

// Automatically caught by asyncHandler
```

## Migration Guide

### Before (Inconsistent)

```typescript
// Old way - inconsistent error formats
router.get("/strategy/:id", async (req, res) => {
  try {
    const strategy = await getStrategy(req.params.id);
    if (!strategy) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(strategy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### After (Standardized)

```typescript
// New way - standardized error format
import { notFound, serverError } from "./lib/standard-errors";

router.get("/strategy/:id", async (req, res) => {
  try {
    const strategy = await getStrategy(req.params.id);
    if (!strategy) {
      return notFound(res, "Strategy not found");
    }
    res.json(strategy);
  } catch (error) {
    log.error("API", `Failed to get strategy: ${error}`);
    return serverError(res, "Failed to retrieve strategy");
  }
});
```

## Updated Endpoints

The following endpoints have been migrated to use standardized errors:

### Arena Routes (`/api/arena/*`)
- `POST /api/arena/run` - Run AI arena
- `GET /api/arena/runs` - List arena runs
- `GET /api/arena/runs/:id` - Get arena run details

### Strategy Routes (`/api/strategies/*`)
- `GET /api/strategies/versions` - List strategy versions
- `POST /api/strategies/versions` - Create strategy version
- `GET /api/strategies/versions/:id` - Get strategy version
- `PATCH /api/strategies/versions/:id` - Update strategy version
- `POST /api/strategies/versions/:id/activate` - Activate strategy

### Tools Routes (`/api/tools/*`)
- `GET /api/tools` - List available tools
- `GET /api/tools/schemas` - Get tool schemas
- `POST /api/tools/invoke` - Invoke a tool
- `GET /api/tools/invocations` - Get tool invocations

### Macro Routes (`/api/macro/*`)
- `GET /api/macro/indicators` - Get macro indicators
- `GET /api/macro/indicators/:id` - Get specific indicator
- `GET /api/macro/category/:category` - Get indicators by category

### Auth Routes (`/api/auth/*`)
- `POST /api/auth/signup` - User signup
- `POST /api/auth/login` - User login

## Best Practices

1. **Always use standard error helpers** instead of manual `res.status().json()`
2. **Include helpful details** in the optional `details` parameter
3. **Log errors** before sending error responses
4. **Use appropriate status codes** for the error type
5. **Provide actionable messages** that help clients fix the issue
6. **Never expose sensitive data** in error responses (stack traces, internal IDs, etc.)
7. **Use consistent error types** across related endpoints

## Client-Side Error Handling

Example of handling standardized errors on the client:

```typescript
async function fetchStrategy(id: string) {
  try {
    const response = await fetch(`/api/strategies/versions/${id}`);

    if (!response.ok) {
      const error = await response.json();

      // Standardized error format
      console.error(`Error ${error.statusCode}: ${error.message}`);

      // Handle specific error types
      if (error.statusCode === 404) {
        showNotification("Strategy not found");
      } else if (error.statusCode === 401) {
        redirectToLogin();
      } else {
        showNotification(`Error: ${error.message}`);
      }

      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Network error:", error);
    return null;
  }
}
```

## Additional Resources

- Error helper implementation: `/server/lib/standard-errors.ts`
- Example usage: `/server/routes/arena.ts`, `/server/routes/strategies.ts`
- Related documentation: API Documentation, Error Handling Best Practices
