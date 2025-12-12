# API Gateway Service Specification

> **Domain:** External Interface  
> **Owner:** Platform Team  
> **Status:** Design

---

## Service Overview

The API Gateway is the single entry point for all client requests. It handles authentication, routing, rate limiting, and request transformation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │  Auth Handler   │  │  Rate Limiter   │  │  Request Router │            │
│  │                 │  │                 │  │                 │            │
│  │ • JWT validate  │  │ • Per-user      │  │ • Path routing  │            │
│  │ • Session mgmt  │  │ • Per-endpoint  │  │ • Load balance  │            │
│  │ • API keys      │  │ • Burst control │  │ • Circuit break │            │
│  │ • OAuth         │  │ • Quota tracking│  │ • Retry logic   │            │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘            │
│           │                    │                    │                      │
│           └────────────────────┴────────────────────┘                      │
│                                │                                            │
│           ┌────────────────────┼────────────────────┐                      │
│           │                    │                    │                      │
│           ▼                    ▼                    ▼                      │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                │
│  │  Trading    │      │     AI      │      │   Market    │                │
│  │  Engine     │      │  Decision   │      │    Data     │                │
│  └─────────────┘      └─────────────┘      └─────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Specification

### Authentication

```yaml
# User Login
POST /api/v1/auth/login
Request:
  email: string
  password: string
Response:
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: {
    id: string
    email: string
    name: string
  }

# Refresh Token
POST /api/v1/auth/refresh
Request:
  refreshToken: string
Response:
  accessToken: string
  expiresIn: number

# Logout
POST /api/v1/auth/logout
Request:
  refreshToken: string
Response:
  success: boolean

# API Key Generation
POST /api/v1/auth/api-keys
Request:
  name: string
  permissions: string[]      # ["read", "trade", "admin"]
  expiresAt?: string
Response:
  apiKey: string             # Only shown once
  keyId: string
  permissions: string[]
  createdAt: string
```

### Unified API Routes

The gateway proxies requests to backend services:

```yaml
# Trading Engine Routes
/api/v1/orders/*         → trading-engine:3001/api/v1/orders/*
/api/v1/positions/*      → trading-engine:3001/api/v1/positions/*
/api/v1/account          → trading-engine:3001/api/v1/account

# AI Decision Routes
/api/v1/decisions/*      → ai-decision:3002/api/v1/decisions/*
/api/v1/calibration/*    → ai-decision:3002/api/v1/calibration/*

# Market Data Routes
/api/v1/quotes/*         → market-data:3003/api/v1/quotes/*
/api/v1/bars/*           → market-data:3003/api/v1/bars/*
/api/v1/news/*           → market-data:3003/api/v1/news/*
/api/v1/market/*         → market-data:3003/api/v1/market/*

# Analytics Routes
/api/v1/analytics/*      → analytics:3004/api/v1/analytics/*

# Orchestrator Routes
/api/v1/agent/*          → orchestrator:3005/api/v1/agent/*
/api/v1/strategies/*     → orchestrator:3005/api/v1/strategies/*
/api/v1/cycles/*         → orchestrator:3005/api/v1/cycles/*
```

### Aggregated Endpoints

The gateway provides aggregated endpoints that combine data from multiple services:

```yaml
# Dashboard Summary (aggregates from multiple services)
GET /api/v1/dashboard
Response:
  account:                   # From trading-engine
    equity: number
    cash: number
    buyingPower: number
  positions:                 # From trading-engine
    count: number
    totalValue: number
    topPositions: Position[]
  analytics:                 # From analytics
    dayPnl: number
    dayPnlPercent: number
    winRate: number
  agent:                     # From orchestrator
    status: string
    lastCycle: string
  market:                    # From market-data
    isOpen: boolean
    session: string

# Recent Activity (aggregates trades + decisions)
GET /api/v1/activity?limit=20
Response:
  activities: [
    {
      type: "trade" | "decision" | "alert"
      timestamp: string
      details: object
    }
  ]
```

### WebSocket Gateway

```yaml
# Connect to WebSocket
WSS /api/v1/ws
Query:
  token: string              # JWT token

# Subscribe to channels
{
  "action": "subscribe",
  "channels": ["quotes.AAPL", "orders", "positions", "agent"]
}

# Unsubscribe
{
  "action": "unsubscribe",
  "channels": ["quotes.AAPL"]
}

# Channel Messages
quotes.{symbol}:
  { symbol, price, bid, ask, volume, timestamp }

orders:
  { orderId, status, symbol, side, quantity, price }

positions:
  { symbol, quantity, pnl, pnlPercent }

agent:
  { status, currentCycle, lastDecision }
```

---

## Rate Limiting

### Default Limits

| Endpoint Pattern | Limit | Window | Burst |
|-----------------|-------|--------|-------|
| `/api/v1/auth/*` | 10 | 1 min | 15 |
| `/api/v1/orders` (POST) | 60 | 1 min | 10 |
| `/api/v1/orders` (GET) | 300 | 1 min | 50 |
| `/api/v1/quotes/*` | 600 | 1 min | 100 |
| `/api/v1/decisions/*` | 30 | 1 min | 5 |
| `/api/v1/analytics/*` | 100 | 1 min | 20 |
| Default | 1000 | 1 min | 100 |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1702392000
Retry-After: 30            # Only on 429 response
```

### Rate Limit Response

```json
HTTP 429 Too Many Requests
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again in 30 seconds.",
  "retryAfter": 30
}
```

---

## Authentication

### JWT Token Structure

```typescript
interface JWTPayload {
  sub: string;               // User ID
  email: string;
  name: string;
  permissions: string[];     // ["read", "trade", "admin"]
  iat: number;               // Issued at
  exp: number;               // Expiration
  jti: string;               // Token ID (for revocation)
}
```

### API Key Authentication

```
Authorization: Bearer <api_key>
X-API-Key: <api_key>         # Alternative header
```

### Permission Levels

| Permission | Allowed Actions |
|------------|-----------------|
| `read` | GET requests, WebSocket subscriptions |
| `trade` | POST/DELETE orders, strategy management |
| `admin` | User management, API key management |

---

## Circuit Breaker

### Configuration

```typescript
interface CircuitBreakerConfig {
  failureThreshold: 5;       // Failures before opening
  successThreshold: 3;       // Successes to close
  timeout: 30000;            // Open state duration (ms)
  monitorInterval: 10000;    // Health check interval
}
```

### States

| State | Behavior |
|-------|----------|
| **Closed** | Normal operation, requests pass through |
| **Open** | Requests fail immediately, return cached/fallback |
| **Half-Open** | Limited requests pass to test recovery |

### Fallback Strategies

```typescript
const fallbacks: Record<string, FallbackStrategy> = {
  'trading-engine': {
    type: 'error',
    message: 'Trading service temporarily unavailable'
  },
  'market-data': {
    type: 'cache',
    maxAge: 60000            // Use cached data up to 1 minute old
  },
  'analytics': {
    type: 'cache',
    maxAge: 300000           // 5 minutes
  }
};
```

---

## Request Transformation

### Request Enrichment

```typescript
// Add common headers to upstream requests
const enrichedHeaders = {
  'X-Request-ID': generateRequestId(),
  'X-User-ID': jwt.sub,
  'X-Forwarded-For': clientIp,
  'X-Gateway-Time': Date.now().toString()
};
```

### Response Transformation

```typescript
// Standardize error responses
interface ErrorResponse {
  error: string;             // Error code
  message: string;           // Human-readable message
  details?: object;          // Additional context
  requestId: string;         // For support/debugging
}
```

---

## Configuration

```yaml
gateway:
  server:
    port: 5000               # External port
    host: "0.0.0.0"
  
  auth:
    jwtSecret: ${JWT_SECRET}
    jwtExpiration: "1h"
    refreshExpiration: "7d"
    apiKeyPrefix: "aat_"     # AI Active Trader
  
  services:
    trading-engine:
      url: http://trading-engine:3001
      timeout: 30000
      retries: 3
    ai-decision:
      url: http://ai-decision:3002
      timeout: 60000         # AI calls take longer
      retries: 2
    market-data:
      url: http://market-data:3003
      timeout: 10000
      retries: 3
    analytics:
      url: http://analytics:3004
      timeout: 15000
      retries: 2
    orchestrator:
      url: http://orchestrator:3005
      timeout: 30000
      retries: 2
  
  rateLimit:
    windowMs: 60000
    max: 1000
    redis: ${REDIS_URL}
  
  circuitBreaker:
    failureThreshold: 5
    successThreshold: 3
    timeout: 30000
  
  cors:
    origins:
      - "https://app.aitrader.com"
      - "http://localhost:8081"
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    credentials: true
  
  websocket:
    heartbeatInterval: 30000
    maxConnections: 10000
```

---

## Health & Metrics

### Health Endpoint

```json
GET /health
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "services": {
    "trading-engine": "healthy",
    "ai-decision": "healthy",
    "market-data": "healthy",
    "analytics": "healthy",
    "orchestrator": "healthy"
  },
  "circuitBreakers": {
    "trading-engine": "closed",
    "ai-decision": "closed",
    "market-data": "closed"
  }
}
```

### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `gateway_requests_total` | Counter | Total requests by endpoint |
| `gateway_request_duration_ms` | Histogram | Request latency |
| `gateway_errors_total` | Counter | Errors by type |
| `gateway_rate_limit_hits` | Counter | Rate limit triggers |
| `gateway_circuit_breaker_state` | Gauge | Circuit state per service |
| `gateway_websocket_connections` | Gauge | Active WebSocket clients |
| `gateway_auth_failures` | Counter | Authentication failures |

---

## Security

### Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

### Input Validation

- All inputs validated with Zod schemas
- SQL injection protection via parameterized queries
- XSS protection via output encoding
- CSRF protection via SameSite cookies

### Audit Logging

```typescript
interface AuditLog {
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  ip: string;
  userAgent: string;
  success: boolean;
  details?: object;
}
```
