# Gap Fix Specification: Type Safety

## Overview

| Attribute | Value |
|-----------|-------|
| Gap ID | G-001 |
| Priority | P1 |
| Effort | 2-3 weeks |
| Current State | 289 `:any` annotations |
| Target State | < 20 `:any` annotations |

## Problem Statement

The codebase has 289 explicit `:any` type annotations across 37+ files, reducing TypeScript's effectiveness at catching bugs and making refactoring risky.

## Goals

1. Reduce `:any` annotations from 289 to < 20
2. Enable `noImplicitAny` in tsconfig.json
3. Achieve 100% type coverage for API responses
4. Create reusable type definitions

## Type Definitions to Create

### 1. Trading Types (`shared/types/trading.ts`)

```typescript
// Order types
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus =
  | 'new'
  | 'pending_new'
  | 'accepted'
  | 'pending_cancel'
  | 'filled'
  | 'partially_filled'
  | 'cancelled'
  | 'rejected'
  | 'expired';
export type TimeInForce = 'day' | 'gtc' | 'opg' | 'ioc' | 'fok';

export interface Order {
  id: string;
  client_order_id: string;
  symbol: string;
  qty: number;
  notional?: number;
  side: OrderSide;
  type: OrderType;
  time_in_force: TimeInForce;
  status: OrderStatus;
  limit_price?: number;
  stop_price?: number;
  filled_qty?: number;
  filled_avg_price?: number;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  filled_at?: string;
  expired_at?: string;
  canceled_at?: string;
  failed_at?: string;
  asset_class: 'us_equity' | 'crypto';
}

export interface Position {
  symbol: string;
  qty: number;
  avg_entry_price: number;
  market_value: number;
  cost_basis: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  unrealized_intraday_pl: number;
  unrealized_intraday_plpc: number;
  current_price: number;
  lastday_price: number;
  change_today: number;
  side: 'long' | 'short';
  asset_class: 'us_equity' | 'crypto';
}

export interface Account {
  id: string;
  account_number: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ONBOARDING';
  currency: string;
  buying_power: number;
  cash: number;
  portfolio_value: number;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  equity: number;
  last_equity: number;
  multiplier: number;
  initial_margin: number;
  maintenance_margin: number;
  daytrade_count: number;
}

export interface TradeSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  quantity: number;
  reasoning: string;
  timestamp: Date;
  source: 'ai' | 'technical' | 'manual';
  factors?: {
    technical: number;
    sentiment: number;
    fundamental: number;
    momentum: number;
  };
}

export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  error?: string;
  filledQty?: number;
  avgPrice?: number;
  timestamp: Date;
}
```

### 2. API Types (`shared/types/api.ts`)

```typescript
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalPages: number;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  details?: ValidationError[];
}

// Request helpers
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestConfig {
  method: RequestMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}
```

### 3. Strategy Types (`shared/types/strategy.ts`)

```typescript
export type StrategyStatus =
  | 'draft'
  | 'backtesting'
  | 'backtested'
  | 'paper'
  | 'live'
  | 'paused'
  | 'stopped';

export type StrategyType =
  | 'momentum'
  | 'mean_reversion'
  | 'trend_following'
  | 'breakout'
  | 'custom';

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  type: StrategyType;
  status: StrategyStatus;
  templateId: string;
  configValues: StrategyConfig;
  performanceSummary?: PerformanceSummary;
  riskSummary?: RiskSummary;
  lastBacktestId?: string;
  deploymentId?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface StrategyConfig {
  symbols: string[];
  entryThreshold: number;
  exitThreshold: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  maxPositions: number;
  [key: string]: string | number | boolean | string[];
}

export interface PerformanceSummary {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
}

export interface RiskSummary {
  volatility: number;
  beta: number;
  var95: number;
  expectedShortfall: number;
}
```

### 4. Event Types (`shared/types/events.ts`)

```typescript
// React event types
export type InputChangeEvent = React.ChangeEvent<HTMLInputElement>;
export type SelectChangeEvent = React.ChangeEvent<HTMLSelectElement>;
export type TextareaChangeEvent = React.ChangeEvent<HTMLTextAreaElement>;
export type FormSubmitEvent = React.FormEvent<HTMLFormElement>;
export type ButtonClickEvent = React.MouseEvent<HTMLButtonElement>;
export type KeyboardEvent = React.KeyboardEvent<HTMLElement>;

// Generic handlers
export type ChangeHandler<T = string> = (value: T) => void;
export type SubmitHandler<T> = (data: T) => void | Promise<void>;
export type ClickHandler = () => void;
```

## Implementation Plan

### Week 1: High Priority Routes

| Day | Files | Count |
|-----|-------|-------|
| 1 | Create type definition files | 4 files |
| 2 | server/routes/alpaca.ts | 7 |
| 2 | server/routes/orders.ts | 8 |
| 3 | server/routes/strategies.ts | 6 |
| 3 | server/routes/positions.ts | 4 |
| 4 | server/routes/backtests.ts | 5 |
| 4 | server/routes/portfolio.ts | 5 |
| 5 | server/routes/auth.ts | 3 |
| 5 | server/routes/admin/*.ts | 7 |

**Week 1 Target: 45 annotations fixed**

### Week 2: Trading Core

| Day | Files | Count |
|-----|-------|-------|
| 1 | server/trading/alpaca-trading-engine.ts | 6 |
| 1 | server/trading/ai-analyzer.ts | 5 |
| 2 | server/trading/position-manager.ts | 4 |
| 2 | server/trading/order-retry-handler.ts | 2 |
| 3 | server/autonomous/orchestrator.ts | 4 |
| 3 | server/autonomous/position-manager.ts | 4 |
| 4 | server/trading/portfolio-rebalancer.ts | 3 |
| 4 | server/trading/broker-connection.ts | 3 |
| 5 | server/connectors/*.ts | 12 |

**Week 2 Target: 43 annotations fixed**

### Week 3: Utilities & Frontend

| Day | Files | Count |
|-----|-------|-------|
| 1 | server/lib/standard-errors.ts | 17 |
| 1 | server/middleware/audit-logger.ts | 11 |
| 2 | server/utils/*.ts | 8 |
| 2 | server/lib/notification-service.ts | 6 |
| 3 | app/**/*.tsx (pages) | 24 |
| 4 | components/**/*.tsx | 15 |
| 5 | lib/api/hooks/*.ts | 8 |

**Week 3 Target: 89 annotations fixed**

## Migration Checklist

### For Each File:

1. [ ] Identify all `:any` usages
2. [ ] Determine appropriate type
3. [ ] Import from shared types
4. [ ] Replace `:any` with specific type
5. [ ] Add type guards if needed
6. [ ] Run `tsc --noEmit` to verify
7. [ ] Run tests
8. [ ] Commit changes

### Type Guard Examples

```typescript
// Type guard for API responses
function isOrder(obj: unknown): obj is Order {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'symbol' in obj &&
    'side' in obj
  );
}

// Type guard for arrays
function isOrderArray(arr: unknown): arr is Order[] {
  return Array.isArray(arr) && arr.every(isOrder);
}

// Usage
const response = await fetch('/api/orders');
const data = await response.json();
if (isOrderArray(data)) {
  // data is typed as Order[]
  return data;
}
throw new Error('Invalid response format');
```

## ESLint Configuration

Add to `.eslintrc.json`:

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-return": "error"
  }
}
```

## TSConfig Changes

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## Verification Commands

```bash
# Count remaining :any
grep -rn ": any" --include="*.ts" --include="*.tsx" server/ app/ lib/ components/ | wc -l

# Find by file
grep -rn ": any" --include="*.ts" server/ | cut -d: -f1 | sort | uniq -c | sort -rn

# Type check
npx tsc --noEmit

# Run tests
npm run test
```

## Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| `:any` count | 289 | < 20 |
| Type coverage | ~60% | > 95% |
| noImplicitAny | Disabled | Enabled |
| Build errors | 0 | 0 |
| Test pass rate | 100% | 100% |

## Exceptions (Acceptable `:any`)

Some cases where `:any` is acceptable:

1. **Third-party library types** - When library doesn't export types
2. **Generic error handlers** - Catching unknown errors
3. **Dynamic form data** - Complex nested forms
4. **JSON parsing** - When validating with type guards

Document each exception with a comment:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Reason: Third-party library X doesn't export this type
const result: any = externalLib.method();
```

## Definition of Done

- [ ] All type definition files created
- [ ] `:any` count < 20
- [ ] ESLint rule enabled
- [ ] noImplicitAny enabled in tsconfig
- [ ] All tests passing
- [ ] No build errors
- [ ] PR reviewed and approved
- [ ] Deployed to staging
- [ ] No runtime type errors in production
