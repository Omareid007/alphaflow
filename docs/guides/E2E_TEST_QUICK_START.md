# E2E Integration Testing Quick Start

## Overview

This guide provides quick instructions for running end-to-end integration tests across all layers of the trading platform.

## What Gets Tested

### 6 Critical Flows
1. **Authentication Flow** - Signup, login, session management, logout
2. **Strategy Management Flow** - Create, read, update, delete strategies
3. **Backtest Flow** - Submit, poll status, fetch results
4. **Trading Flow** - Positions, orders, account, reconciliation
5. **AI/Autonomous Flow** - Decisions, agent status, candidates
6. **Data Integration Flow** - Connectors, market data, data fusion

### 35+ Integration Tests
- Data flows through all layers
- Error handling at each layer
- Data transformations
- Authentication enforcement
- Database transactions
- Race condition detection

## Prerequisites

```bash
# 1. Server must be running
npm run dev

# 2. Database must be initialized
npm run db:push

# 3. Environment variables configured
# - ALPACA_API_KEY
# - ALPACA_API_SECRET
# - DATABASE_URL
```

## Running Tests

### Full Test Suite
```bash
npx tsx scripts/test-e2e-integration.ts
```

### Custom API URL
```bash
API_BASE_URL=https://your-domain.com npx tsx scripts/test-e2e-integration.ts
```

### Production Environment
```bash
API_BASE_URL=https://production.example.com npx tsx scripts/test-e2e-integration.ts
```

## Expected Results

### Successful Run
```
[INFO] ================================================================================
[INFO] END-TO-END INTEGRATION TEST SUITE
[INFO] Target: http://localhost:5000
[INFO] ================================================================================

[INFO] Starting Authentication Flow...
[PASS] Authentication Flow: User Signup (234ms)
[PASS] Authentication Flow: Duplicate Signup Prevention (45ms)
[PASS] Authentication Flow: User Login (123ms)
[PASS] Authentication Flow: Session Validation (56ms)
[PASS] Authentication Flow: Session Persistence (89ms)
[PASS] Authentication Flow: User Logout (67ms)
[PASS] Authentication Flow: Invalid Credentials Handling (78ms)

[INFO] Starting Strategy Management Flow...
[PASS] Strategy Management Flow: Create Strategy (145ms)
[PASS] Strategy Management Flow: Read Strategy (34ms)
[PASS] Strategy Management Flow: Update Strategy (56ms)
[PASS] Strategy Management Flow: List Strategies (45ms)
[PASS] Strategy Management Flow: Delete Strategy (67ms)
[PASS] Strategy Management Flow: Data Integrity Check (23ms)

... (more flows)

SUMMARY
-------
Total Flows: 6
Total Tests: 35
Passed: 35
Failed: 0
Duration: 12456ms
Overall Result: ✓ PASSED
```

### Failed Tests
```
[FAIL] Trading Flow: Fetch Positions from Alpaca (5000ms)
  Error: 500: Alpaca API key not configured

FAILED TESTS DETAIL
-------------------
Trading Flow > Fetch Positions from Alpaca
  Error: 500: Alpaca API key not configured
```

## Test Output Files

After running tests, check:

```
E2E_INTEGRATION_TEST_REPORT.md  - Comprehensive analysis
E2E_TEST_QUICK_START.md         - This file
scripts/test-e2e-integration.ts - Test implementation
```

## Common Issues

### Issue: "ECONNREFUSED"
**Cause**: Server not running
**Solution**: Start server with `npm run dev`

### Issue: "Session expired"
**Cause**: Old session cookies in cache
**Solution**: Clear browser/app cache and re-run

### Issue: "Alpaca API error"
**Cause**: Invalid API credentials
**Solution**: Verify ALPACA_API_KEY and ALPACA_API_SECRET in .env

### Issue: "Database error"
**Cause**: Database not initialized or migrations not run
**Solution**: Run `npm run db:push`

### Issue: "Backtest timeout"
**Cause**: Backtest taking too long
**Solution**: Reduce date range or increase timeout in test

## Interpreting Results

### Flow Status
- **✓ PASSED**: All tests in flow passed
- **✗ FAILED**: One or more tests failed

### Test Results
Each test shows:
- Name
- Duration (ms)
- Status (PASS/FAIL)
- Error message (if failed)
- Details (additional context)

### Issues
Listed issues indicate:
- Integration gaps
- Missing error handling
- Race conditions
- Data inconsistencies

### Recommendations
Actionable items to improve:
- Immediate (Week 1)
- Short term (Month 1)
- Long term (Quarter 1)

## Manual Verification

After automated tests, manually verify:

1. **Frontend Integration**
   ```bash
   # Open app in Expo Go
   npm start
   ```

2. **Database State**
   ```bash
   # Check test user created
   psql $DATABASE_URL -c "SELECT * FROM users WHERE username LIKE 'testuser_%';"
   ```

3. **API Logs**
   ```bash
   # Check for errors during test run
   grep ERROR logs/server.log
   ```

## Cleaning Up Test Data

```bash
# Remove test users
psql $DATABASE_URL -c "DELETE FROM users WHERE username LIKE 'testuser_%';"

# Remove test strategies
psql $DATABASE_URL -c "DELETE FROM strategies WHERE name LIKE 'Test Strategy %';"

# Remove test backtests
psql $DATABASE_URL -c "DELETE FROM backtest_runs WHERE created_at > NOW() - INTERVAL '1 hour';"
```

## CI/CD Integration

### GitHub Actions
```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run db:push
      - run: npm run dev &
      - run: sleep 10
      - run: npx tsx scripts/test-e2e-integration.ts
```

### Docker
```dockerfile
# Run tests in container
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
CMD ["npx", "tsx", "scripts/test-e2e-integration.ts"]
```

## Advanced Usage

### Test Specific Flow
Modify the main function to run specific flows:
```typescript
const flows = [
  testAuthenticationFlow,
  // testStrategyManagementFlow,
  // testBacktestFlow,
  // testTradingFlow,
  // testAIAutonomousFlow,
  // testDataIntegrationFlow,
];
```

### Custom Assertions
Add custom tests:
```typescript
tests.push(
  await runTest(flowName, "Custom Test", async () => {
    const response = await apiRequest("GET", "/api/custom");
    return {
      passed: response.status === 200,
      details: response.data,
    };
  })
);
```

### Debugging Failed Tests
Enable verbose logging:
```typescript
console.log('[DEBUG] Request:', {
  method,
  url,
  data,
  headers,
});
```

## Performance Benchmarks

Expected durations:
- **Authentication Flow**: ~700ms
- **Strategy Management**: ~500ms
- **Backtest Flow**: ~5-30s (depends on backtest duration)
- **Trading Flow**: ~1-2s
- **AI/Autonomous Flow**: ~800ms
- **Data Integration**: ~1-2s

**Total Suite**: ~10-40s

If tests exceed these times significantly, investigate:
- Network latency
- Database performance
- External API throttling
- Server resource constraints

## Next Steps

After running E2E tests:

1. **Review Report**
   - Read `E2E_INTEGRATION_TEST_REPORT.md`
   - Understand identified issues
   - Prioritize recommendations

2. **Address Critical Issues**
   - Session persistence
   - Transaction atomicity
   - Race conditions
   - Error recovery

3. **Implement Monitoring**
   - Add instrumentation
   - Set up alerting
   - Track metrics

4. **Continuous Testing**
   - Run before deployments
   - Add to CI/CD pipeline
   - Monitor production with synthetic tests

## Support

For issues or questions:
- Check logs: `logs/server.log`
- Review API responses
- Verify environment configuration
- Consult documentation: `docs/`

---

**Last Updated**: 2024-12-24
**Version**: 1.0.0
**Maintainer**: Platform Team
