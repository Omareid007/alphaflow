# XSS Protection Quick Reference

## Quick Start

### Import Sanitization
```typescript
import { sanitizeInput } from './lib/sanitization';
```

### Basic Usage
```typescript
// Sanitize a single string
const sanitizedUsername = sanitizeInput(userInput);

// Sanitize an object
import { sanitizeObject } from './lib/sanitization';
const sanitizedBody = sanitizeObject(req.body);

// Sanitize user-specific fields
import { sanitizeUserInput } from './lib/sanitization';
const sanitizedUser = sanitizeUserInput(userData);
```

## When to Sanitize

### ✅ Always Sanitize
- User registration (username, email, display name)
- User profiles (bio, description)
- Strategy names and descriptions
- Backtest names and notes
- Comments and feedback
- Any user-provided text displayed in UI

### ❌ Don't Sanitize
- Passwords (hash them instead)
- Already-sanitized data
- Internal system values
- Numeric values (validate instead)

## Protected Endpoints

### Authentication
```typescript
// routes.ts - Line ~276
app.post("/api/auth/signup", async (req, res) => {
  const sanitizedUsername = sanitizeInput(username);
  // ✅ Protected
});

// routes.ts - Line ~309
app.post("/api/auth/login", async (req, res) => {
  const sanitizedUsername = sanitizeInput(username);
  // ✅ Protected
});
```

### Strategies
```typescript
// routes/strategies.ts - Line ~27
router.post("/versions", async (req, res) => {
  const sanitizedName = sanitizeInput(name);
  const sanitizedDescription = sanitizeInput(description);
  // ✅ Protected
});
```

### Storage Layer
```typescript
// storage.ts - Line ~149
async createUser(insertUser: InsertUser): Promise<User> {
  const sanitizedUser = sanitizeUserInput(insertUser);
  // ✅ Protected with defense-in-depth
}
```

## Test Your Changes

```bash
# Run comprehensive test suite
tsx scripts/test-sanitization.ts

# Expected output:
# ✓ Passed: 23
# ✗ Failed: 0
# Total: 23
# ✓ All tests passed!
```

## Common Attack Examples

### Before (Vulnerable)
```typescript
// ❌ DANGEROUS - No sanitization
const user = await storage.createUser({
  username: '<script>steal_cookies()</script>'
});
// Result: XSS attack executes when username is displayed
```

### After (Protected)
```typescript
// ✅ SAFE - Sanitization applied
const sanitizedUsername = sanitizeInput(username);
const user = await storage.createUser({
  username: sanitizedUsername  // Empty string, attack prevented
});
// Result: No script execution, attack blocked
```

## Adding New Protected Fields

1. Import sanitization function
2. Sanitize before using/storing
3. Add test case
4. Verify with test suite

```typescript
// Example: Adding new endpoint
import { sanitizeInput } from '../lib/sanitization';

app.post("/api/new-endpoint", async (req, res) => {
  const { newField } = req.body;

  // Sanitize before use
  const sanitizedField = sanitizeInput(newField);

  // Use sanitized value
  await storage.create({ field: sanitizedField });
});
```

## Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `/server/lib/sanitization.ts` | Core utility | 154 |
| `/server/lib/sanitization.test.ts` | Test suite | 335 |
| `/scripts/test-sanitization.ts` | Test runner | 262 |
| `/server/routes.ts` | Auth endpoints | 6027 |
| `/server/routes/strategies.ts` | Strategy endpoints | 332 |
| `/server/routes/backtests.ts` | Backtest endpoints | 146 |
| `/server/storage.ts` | Storage layer | 932 |

## Emergency Response

If you discover unsanitized input:

1. Identify the vulnerable endpoint
2. Add sanitization before storage
3. Run test suite to verify
4. Consider sanitizing existing database records
5. Document in incident report

## Support

- **Full Documentation:** `/home/runner/workspace/XSS_PROTECTION_IMPLEMENTATION_REPORT.md`
- **Test Suite:** `/home/runner/workspace/server/lib/sanitization.test.ts`
- **Test Runner:** `tsx scripts/test-sanitization.ts`
