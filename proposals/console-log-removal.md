# Enhancement Proposal: Console Log Removal

## Executive Summary

| Attribute | Value |
|-----------|-------|
| Proposal ID | EP-001 |
| Priority | P1 |
| Risk Level | Low |
| Effort | 3-5 days |

## Problem Statement

The codebase contains 7,758 console statements (console.log, console.error, console.warn) in production code. This causes:

1. **Log pollution** - Noise in production logs
2. **Security risk** - Potential information leakage
3. **Performance overhead** - Synchronous console operations
4. **Inconsistent logging** - No structured format or levels

## Current State

### Console Statement Distribution

| Directory | Count | Impact |
|-----------|-------|--------|
| server/trading/ | 70+ | High |
| server/autonomous/ | 40+ | High |
| server/ai/ | 50+ | Medium |
| server/routes/ | 30+ | Medium |
| server/connectors/ | 25+ | Low |
| server/services/ | 35+ | Medium |

### Top Offenders

| File | Count | Purpose |
|------|-------|---------|
| server/trading/ai-analyzer.ts | 20 | AI decisions |
| server/trading/portfolio-rebalancer.ts | 17 | Rebalancing |
| server/trading/strategy-runner.ts | 13 | Strategy execution |
| server/trading/position-manager.ts | 12 | Position tracking |
| server/autonomous/lifecycle-manager.ts | 8 | Lifecycle |
| server/autonomous/order-queue.ts | 8 | Order queue |

## Proposed Solution

### 1. Create Structured Logger

```typescript
// server/lib/logger.ts
import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'alphaflow' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'development'
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : logFormat,
    }),
  ],
});

// Child loggers for modules
export const tradingLogger = logger.child({ module: 'trading' });
export const aiLogger = logger.child({ module: 'ai' });
export const autonomousLogger = logger.child({ module: 'autonomous' });
export const apiLogger = logger.child({ module: 'api' });
```

### 2. Logger Interface

```typescript
// server/lib/logger.ts (continued)

interface LogContext {
  tradeId?: string;
  strategyId?: string;
  symbol?: string;
  orderId?: string;
  userId?: string;
  [key: string]: unknown;
}

export const log = {
  info: (message: string, context?: LogContext) => {
    logger.info(message, context);
  },
  warn: (message: string, context?: LogContext) => {
    logger.warn(message, context);
  },
  error: (message: string, error?: Error, context?: LogContext) => {
    logger.error(message, { error: error?.message, stack: error?.stack, ...context });
  },
  debug: (message: string, context?: LogContext) => {
    logger.debug(message, context);
  },
  trade: (action: string, context: LogContext) => {
    tradingLogger.info(action, context);
  },
  decision: (decision: string, context: LogContext) => {
    aiLogger.info(decision, context);
  },
};
```

### 3. Migration Examples

#### Before
```typescript
console.log('Placing order:', { symbol, qty, side });
try {
  const order = await alpaca.createOrder(params);
  console.log('Order created:', order.id);
} catch (error) {
  console.error('Order failed:', error);
}
```

#### After
```typescript
import { log } from '../lib/logger';

log.trade('Placing order', { symbol, qty, side });
try {
  const order = await alpaca.createOrder(params);
  log.trade('Order created', { orderId: order.id, symbol, qty });
} catch (error) {
  log.error('Order failed', error as Error, { symbol, qty, side });
}
```

## Implementation Plan

### Day 1: Infrastructure
- [ ] Install winston: `npm install winston`
- [ ] Create `server/lib/logger.ts`
- [ ] Create child loggers for each module
- [ ] Test logging in development

### Day 2-3: High Priority Files
- [ ] server/trading/ai-analyzer.ts
- [ ] server/trading/portfolio-rebalancer.ts
- [ ] server/trading/strategy-runner.ts
- [ ] server/trading/position-manager.ts
- [ ] server/autonomous/orchestrator.ts

### Day 4: Medium Priority Files
- [ ] server/autonomous/*.ts (remaining)
- [ ] server/routes/*.ts
- [ ] server/services/*.ts

### Day 5: Cleanup & Verification
- [ ] server/connectors/*.ts
- [ ] Add ESLint rule
- [ ] Run full test suite
- [ ] Verify no console.log in production paths

## ESLint Configuration

```json
// .eslintrc.json
{
  "rules": {
    "no-console": ["error", {
      "allow": ["warn", "error"]
    }]
  },
  "overrides": [
    {
      "files": ["scripts/**/*.ts", "tests/**/*.ts"],
      "rules": {
        "no-console": "off"
      }
    }
  ]
}
```

## Migration Script

```bash
#!/bin/bash
# scripts/migrate-console-logs.sh

# Find files with console.log
files=$(grep -rl "console.log\|console.error\|console.warn" server/ --include="*.ts")

for file in $files; do
  echo "Processing: $file"

  # Add import if not present
  if ! grep -q "import.*logger" "$file"; then
    sed -i '1i import { log } from "../lib/logger";' "$file"
  fi

  # Replace patterns (manual review still needed)
  # sed -i 's/console.log/log.info/g' "$file"
  # sed -i 's/console.error/log.error/g' "$file"
  # sed -i 's/console.warn/log.warn/g' "$file"
done

echo "Files processed. Manual review required."
```

## Rollback Plan

### Immediate Rollback
If logging causes issues:

1. Set `LOG_LEVEL=silent` in environment
2. Remove ESLint rule temporarily
3. Investigate and fix logger issues

### Full Rollback
If migration is problematic:

1. Revert commits: `git revert [commits]`
2. Remove winston dependency
3. Restore console statements

## Testing Strategy

### Unit Tests
```typescript
import { describe, it, expect, vi } from 'vitest';
import { log } from '../lib/logger';

describe('Logger', () => {
  it('should log info messages', () => {
    const spy = vi.spyOn(console, 'log');
    log.info('Test message', { key: 'value' });
    expect(spy).toHaveBeenCalled();
  });

  it('should include context in log output', () => {
    log.trade('Order placed', { symbol: 'AAPL', qty: 10 });
    // Verify structured output
  });
});
```

### Integration Tests
- Verify logs appear in correct format
- Verify log levels filter correctly
- Verify no console.log in production build

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Console statements | 7,758 | 0 |
| Structured logs | No | Yes |
| Log levels | No | Yes |
| Searchable logs | No | Yes |
| ESLint rule | No | Enabled |

## Log Levels Guide

| Level | When to Use | Examples |
|-------|-------------|----------|
| error | Errors that need attention | Order failed, API error |
| warn | Concerning but not critical | Rate limit approaching |
| info | Normal operations | Order placed, trade executed |
| debug | Development debugging | Request details, state changes |

## Benefits

1. **Structured logging** - JSON format for log aggregation
2. **Log levels** - Filter by importance
3. **Context** - Include relevant IDs and data
4. **Performance** - Async logging, level filtering
5. **Security** - No accidental data exposure
6. **Compliance** - ESLint enforcement

## Definition of Done

- [ ] Winston logger installed and configured
- [ ] All console.log/warn/error replaced
- [ ] ESLint rule enabled and passing
- [ ] Unit tests for logger
- [ ] No console statements in production code
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Verified in production logs
