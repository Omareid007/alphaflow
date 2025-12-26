# Trading Configuration - Quick Reference

## Import

```typescript
import { tradingConfig, getAlpacaBaseUrl } from './config/trading-config';
```

## Common Operations

### Get Alpaca URL
```typescript
const baseUrl = getAlpacaBaseUrl(); // Returns paper or live URL
```

### Access Configuration
```typescript
// Order Retry
tradingConfig.orderRetry.maxRetriesPerOrder          // 3
tradingConfig.orderRetry.retryBackoffBaseMs          // 2000
tradingConfig.orderRetry.circuitBreakerThreshold     // 10

// Order Execution
tradingConfig.orderExecution.orderFillPollIntervalMs // 500
tradingConfig.orderExecution.orderFillTimeoutMs      // 30000
tradingConfig.orderExecution.staleOrderTimeoutMs     // 300000

// Risk Management
tradingConfig.riskManagement.defaultHardStopLossPercent       // 3
tradingConfig.riskManagement.defaultTakeProfitPercent         // 6
tradingConfig.riskManagement.defaultMaxPositionSizePercent    // 15
tradingConfig.riskManagement.defaultMaxExposurePercent        // 200

// Universe
tradingConfig.universe.maxStockSymbolsPerCycle       // 500
tradingConfig.universe.maxCryptoSymbolsPerCycle      // 100
tradingConfig.universe.minConfidenceForUniverse      // 0.50
tradingConfig.universe.alpacaSnapshotChunkSize       // 50

// Queue
tradingConfig.queue.queuePollIntervalMs              // 2000
tradingConfig.queue.queuePollTimeoutMs               // 60000
tradingConfig.queue.heartbeatIntervalMs              // 30000
```

## Environment Variables

### Alpaca Broker
```bash
ALPACA_TRADING_MODE=paper           # 'paper' or 'live'
ALPACA_PAPER_URL=...
ALPACA_LIVE_URL=...
```

### Order Retry
```bash
MAX_RETRIES_PER_ORDER=3
RETRY_BACKOFF_BASE_MS=2000
CIRCUIT_BREAKER_THRESHOLD=10
```

### Risk Management
```bash
DEFAULT_HARD_STOP_LOSS_PERCENT=3
DEFAULT_TAKE_PROFIT_PERCENT=6
DEFAULT_MAX_POSITION_SIZE_PERCENT=15
DEFAULT_MAX_EXPOSURE_PERCENT=200
```

### Universe
```bash
MAX_STOCK_SYMBOLS_PER_CYCLE=500
MAX_CRYPTO_SYMBOLS_PER_CYCLE=100
MIN_CONFIDENCE_FOR_UNIVERSE=0.50
```

## Validation

```typescript
import { validateTradingConfig } from './config/trading-config';

validateTradingConfig(); // Throws on error
```

## Summary

```typescript
import { getConfigSummary } from './config/trading-config';

const summary = getConfigSummary();
console.log(summary);
```

## Risk Profiles

### Conservative
```bash
DEFAULT_MAX_POSITION_SIZE_PERCENT=5
DEFAULT_MAX_EXPOSURE_PERCENT=50
MAX_STOCK_SYMBOLS_PER_CYCLE=120
MIN_CONFIDENCE_FOR_UNIVERSE=0.70
```

### Moderate
```bash
DEFAULT_MAX_POSITION_SIZE_PERCENT=10
DEFAULT_MAX_EXPOSURE_PERCENT=80
MAX_STOCK_SYMBOLS_PER_CYCLE=300
MIN_CONFIDENCE_FOR_UNIVERSE=0.60
```

### Aggressive (Default)
```bash
DEFAULT_MAX_POSITION_SIZE_PERCENT=15
DEFAULT_MAX_EXPOSURE_PERCENT=200
MAX_STOCK_SYMBOLS_PER_CYCLE=500
MIN_CONFIDENCE_FOR_UNIVERSE=0.50
```

## Usage Examples

### Exponential Backoff
```typescript
const delay = tradingConfig.orderRetry.retryBackoffBaseMs * Math.pow(2, attempt - 1);
```

### Risk Calculations
```typescript
const { defaultMaxPositionSizePercent, defaultHardStopLossPercent } = tradingConfig.riskManagement;

const maxPositionValue = portfolioValue * (defaultMaxPositionSizePercent / 100);
const stopLossPrice = entryPrice * (1 - defaultHardStopLossPercent / 100);
```

### Universe Filtering
```typescript
const { minConfidenceForUniverse, maxStockSymbolsPerCycle } = tradingConfig.universe;

const qualified = candidates
  .filter(c => c.confidence >= minConfidenceForUniverse)
  .slice(0, maxStockSymbolsPerCycle);
```

### Order Polling
```typescript
const { orderFillPollIntervalMs, orderFillTimeoutMs } = tradingConfig.orderExecution;

while (Date.now() - start < orderFillTimeoutMs) {
  const order = await getOrder(orderId);
  if (order.status === 'filled') break;
  await sleep(orderFillPollIntervalMs);
}
```

## Files Reference

| File | Purpose |
|------|---------|
| `trading-config.ts` | Main configuration file |
| `README.md` | Full documentation |
| `.env.example` | Environment variable template |
| `usage-example.ts` | Complete examples |
| `SUMMARY.md` | Implementation summary |
| `QUICK_REFERENCE.md` | This file |

## Support

- Full Documentation: `server/config/README.md`
- Examples: `server/config/usage-example.ts`
- Summary: `server/config/SUMMARY.md`
