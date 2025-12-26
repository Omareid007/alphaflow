# Security Quick Fixes - Priority Action Items

## URGENT - Fix Today (Critical Vulnerabilities)

### 1. XSS Vulnerability - Fix Input Sanitization
**File:** `/home/runner/workspace/server/routes.ts`

```bash
npm install isomorphic-dompurify
```

**Add sanitization helper:**
```typescript
import DOMPurify from 'isomorphic-dompurify';

const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};
```

**Update signup endpoint (line 276):**
```typescript
app.post("/api/auth/signup", async (req, res) => {
  try {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, "Invalid input", parsed.error);
    }

    const { username, password } = parsed.data;

    // ✅ ADD SANITIZATION
    const sanitizedUsername = sanitizeInput(username);

    if (sanitizedUsername.length < 3) {
      return badRequest(res, "Username must be at least 3 characters");
    }

    if (password.length < 6) {
      return badRequest(res, "Password must be at least 6 characters");
    }

    const existingUser = await storage.getUserByUsername(sanitizedUsername);
    if (existingUser) {
      return badRequest(res, "Username already taken");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({
      username: sanitizedUsername,
      password: hashedPassword
    });

    // ... rest of code
  }
});
```

### 2. CORS Credentials Header - Fix Cross-Origin Auth
**File:** `/home/runner/workspace/server/index.ts` (line 32-66)

**Find and replace:**
```typescript
function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    // Allow requests with no origin (native apps) or matching origins
    if (!origin || origins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin || "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true"); // ✅ ALWAYS SET THIS
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}
```

### 3. Admin Endpoint Authorization - Fix Access Control
**File:** `/home/runner/workspace/server/routes.ts` (line 4072)

**Change from:**
```typescript
app.get("/api/admin/api-usage", authMiddleware, async (req, res) => {
```

**Change to:**
```typescript
app.get("/api/admin/api-usage", authMiddleware, requireCapability("admin:read"), async (req, res) => {
```

**Apply to ALL admin endpoints:**
```bash
# Search for all admin routes missing requireCapability
grep -n "app\.\(get\|post\|put\|delete\)(.*\/api\/admin\/" server/routes.ts | grep -v "requireCapability"
```

---

## HIGH PRIORITY - Fix This Week

### 4. Add Rate Limiting to Authentication
**Install dependency:**
```bash
npm install express-rate-limit
```

**Add to routes.ts (after imports):**
```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 signups per hour per IP
  message: 'Too many signup attempts, please try again later',
});
```

**Update endpoints:**
```typescript
app.post("/api/auth/login", authLimiter, async (req, res) => {
  // ... existing code
});

app.post("/api/auth/signup", signupLimiter, async (req, res) => {
  // ... existing code
});
```

### 5. Add Security Headers with Helmet
**Install:**
```bash
npm install helmet
```

**Add to server/index.ts (after imports):**
```typescript
import helmet from 'helmet';

// Add BEFORE setupCors
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  frameguard: {
    action: 'deny',
  },
  noSniff: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
}));
```

### 6. Implement CSRF Protection
**Install:**
```bash
npm install csurf cookie-parser
```

**Add to server/index.ts:**
```typescript
import csrf from 'csurf';

// After cookie-parser
const csrfProtection = csrf({ cookie: true });

// Add CSRF token endpoint (BEFORE other routes)
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Protect all state-changing routes
app.use('/api', (req, res, next) => {
  // Skip CSRF for GET requests
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Skip CSRF for auth endpoints (use different protection)
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }

  // Apply CSRF protection
  csrfProtection(req, res, next);
});
```

---

## MEDIUM PRIORITY - Fix This Month

### 7. Session ID Regeneration (Prevent Session Fixation)
**File:** `/home/runner/workspace/server/routes.ts`

**Update login endpoint (line 314):**
```typescript
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return badRequest(res, "Username and password required");
    }

    const user = await storage.getUserByUsername(username);
    if (!user) {
      return unauthorized(res, "Invalid username or password");
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return unauthorized(res, "Invalid username or password");
    }

    // ✅ DELETE OLD SESSION IF EXISTS
    const oldSessionId = req.cookies?.session;
    if (oldSessionId) {
      sessions.delete(oldSessionId);
    }

    // ✅ GENERATE NEW SESSION ID
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    sessions.set(sessionId, { userId: user.id, expiresAt });

    res.cookie("session", sessionId, getCookieOptions());
    res.json({ id: user.id, username: user.username, isAdmin: user.isAdmin });
  } catch (error) {
    console.error("Login error:", error);
    return serverError(res, "Failed to login");
  }
});
```

### 8. Constant-Time Admin Token Comparison
**File:** `/home/runner/workspace/server/routes.ts`

**Install:**
```bash
npm install crypto-js
```

**Update adminTokenMiddleware (line 137):**
```typescript
import * as crypto from 'crypto';

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
}

function adminTokenMiddleware(req: Request, res: Response, next: NextFunction) {
  const adminToken = process.env.ADMIN_TOKEN;
  const headerToken = req.headers["x-admin-token"] as string;

  if (adminToken && headerToken && constantTimeCompare(adminToken, headerToken)) {
    req.userId = "admin-token-user";
    return next();
  }

  const sessionId = req.cookies?.session;
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (session && session.expiresAt >= new Date()) {
      req.userId = session.userId;
      return next();
    }
  }

  return res.status(401).json({ error: "Admin authentication required" });
}
```

### 9. Add User Isolation to Database Schema
**Create migration:**
```sql
-- Add userId to user-scoped tables
ALTER TABLE strategies ADD COLUMN user_id VARCHAR REFERENCES users(id);
ALTER TABLE trades ADD COLUMN user_id VARCHAR REFERENCES users(id);
ALTER TABLE positions ADD COLUMN user_id VARCHAR REFERENCES users(id);
ALTER TABLE ai_decisions ADD COLUMN user_id VARCHAR REFERENCES users(id);

-- Create indexes for performance
CREATE INDEX idx_strategies_user_id ON strategies(user_id);
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_ai_decisions_user_id ON ai_decisions(user_id);

-- Backfill existing data with a default user or system user
-- UPDATE strategies SET user_id = 'system' WHERE user_id IS NULL;
```

**Update schema file:**
```typescript
// shared/schema.ts
export const strategies = pgTable("strategies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(), // ✅ ADD THIS
  name: text("name").notNull(),
  type: text("type").notNull(),
  // ... rest of fields
});
```

**Update storage queries:**
```typescript
// server/storage.ts
async getStrategies(userId: string): Promise<Strategy[]> {
  return db.select()
    .from(strategies)
    .where(eq(strategies.userId, userId)) // ✅ ADD USER FILTER
    .orderBy(desc(strategies.createdAt));
}
```

---

## Testing After Fixes

### Run Security Tests
```bash
bun test scripts/security-audit.test.ts
```

### Manual Verification Checklist
- [ ] Try XSS payload in username: `<script>alert('xss')</script>`
- [ ] Verify CORS credentials header present
- [ ] Test admin endpoint with non-admin user (should 403)
- [ ] Try 6 login attempts rapidly (should rate limit)
- [ ] Check response headers for security headers
- [ ] Test session fixation attack
- [ ] Verify user isolation (user A can't see user B's data)

### Expected Results After Fixes
- ✅ All 27 security tests should pass
- ✅ XSS payloads rejected or sanitized
- ✅ Rate limiting prevents brute force
- ✅ Security headers present in all responses
- ✅ Admin endpoints properly protected
- ✅ CORS works for authenticated requests

---

## Environment Variables Needed

Add to `.env`:
```bash
# Session
SESSION_SECRET=your-super-secret-session-key-change-this

# Redis (for persistent sessions - Phase 2)
REDIS_URL=redis://localhost:6379

# Admin
ADMIN_TOKEN=your-admin-token-for-api-access
```

---

## Deployment Checklist

Before deploying to production:
- [ ] All URGENT fixes implemented
- [ ] Security tests passing
- [ ] Environment variables configured
- [ ] HTTPS enforced
- [ ] Database migration run (user isolation)
- [ ] Rate limiting configured
- [ ] Security headers verified
- [ ] CORS properly configured
- [ ] Session storage migrated to Redis
- [ ] Audit logging enabled
- [ ] Penetration test completed

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Express Rate Limit](https://www.npmjs.com/package/express-rate-limit)
- [DOMPurify](https://www.npmjs.com/package/isomorphic-dompurify)

---

**Last Updated:** 2025-12-24
**Status:** Ready for implementation
