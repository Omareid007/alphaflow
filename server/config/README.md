# Trading Configuration Guide

This directory contains centralized configuration for all trading-related parameters. The configuration system allows you to customize trading behavior through environment variables without modifying code.

## Configuration File

**`trading-config.ts`** - Centralized trading configuration with environment variable overrides

## Quick Start

### 1. Import the Configuration

```typescript
import { tradingConfig, getAlpacaBaseUrl } from './config/trading-config';

// Access specific values
const maxRetries = tradingConfig.orderRetry.maxRetriesPerOrder;
const stopLoss = tradingConfig.riskManagement.defaultHardStopLossPercent;
const baseUrl = getAlpacaBaseUrl();
```

### 2. Set Environment Variables

Create a `.env` file in your project root:

```bash
# Alpaca Configuration
ALPACA_TRADING_MODE=paper
ALPACA_PAPER_URL=https://paper-api.alpaca.markets
ALPACA_LIVE_URL=https://api.alpaca.markets

# Risk Management
DEFAULT_MAX_POSITION_SIZE_PERCENT=10
DEFAULT_MAX_EXPOSURE_PERCENT=80
DEFAULT_HARD_STOP_LOSS_PERCENT=2
DEFAULT_TAKE_PROFIT_PERCENT=4

# Order Retry
MAX_RETRIES_PER_ORDER=3
RETRY_BACKOFF_BASE_MS=2000
CIRCUIT_BREAKER_THRESHOLD=10

# Universe Configuration
MAX_STOCK_SYMBOLS_PER_CYCLE=500
MAX_CRYPTO_SYMBOLS_PER_CYCLE=100
MIN_CONFIDENCE_FOR_UNIVERSE=0.50
```

### 3. Validate Configuration on Startup

```typescript
import { validateTradingConfig, getConfigSummary } from './config/trading-config';

// Validate configuration
try {
  validateTradingConfig();
  console.log('Trading configuration is valid');
  console.log('Config Summary:', getConfigSummary());
} catch (error) {
  console.error('Invalid configuration:', error.message);
  process.exit(1);
}
```

## Configuration Sections

### 1. Alpaca Broker Configuration

Controls which Alpaca environment to use (paper or live trading).

**Environment Variables:**
- `ALPACA_TRADING_MODE` - Trading mode: `paper` or `live` (default: `paper`)
- `ALPACA_PAPER_URL` - Paper trading API URL
- `ALPACA_LIVE_URL` - Live trading API URL (use with caution!)
- `ALPACA_DATA_URL` - Market data API URL
- `ALPACA_STREAM_URL` - WebSocket streaming URL

**Usage:**
```typescript
import { tradingConfig, getAlpacaBaseUrl } from './config/trading-config';

const apiUrl = getAlpacaBaseUrl(); // Returns paper or live URL based on mode
const isLive = tradingConfig.alpaca.tradingMode === 'live';
```

### 2. Order Retry Configuration

Controls retry behavior for failed orders using exponential backoff and circuit breaker pattern.

**Environment Variables:**
- `MAX_RETRIES_PER_ORDER` - Max retry attempts (default: `3`)
- `RETRY_BACKOFF_BASE_MS` - Base delay for exponential backoff (default: `2000` ms)
- `CIRCUIT_BREAKER_THRESHOLD` - Failures before circuit opens (default: `10`)
- `CIRCUIT_BREAKER_WINDOW_MS` - Time window to count failures (default: `60000` ms)
- `CIRCUIT_BREAKER_RESET_MS` - Cooldown before auto-reset (default: `300000` ms)

**Retry Logic:**
- Retry delay = `RETRY_BACKOFF_BASE_MS * 2^(attemptNumber - 1)`
- Example with base 2000ms: 2s, 4s, 8s

**Circuit Breaker:**
- Opens when `CIRCUIT_BREAKER_THRESHOLD` failures occur within `CIRCUIT_BREAKER_WINDOW_MS`
- Auto-resets after `CIRCUIT_BREAKER_RESET_MS` cooldown

**Usage:**
```typescript
import { tradingConfig } from './config/trading-config';

const maxRetries = tradingConfig.orderRetry.maxRetriesPerOrder;
const backoffMs = tradingConfig.orderRetry.retryBackoffBaseMs;
const delay = backoffMs * Math.pow(2, attemptNumber - 1);
```

### 3. Order Execution Configuration

Controls order polling, timeouts, and staleness detection.

**Environment Variables:**
- `ORDER_FILL_POLL_INTERVAL_MS` - Poll interval for order status (default: `500` ms)
- `ORDER_FILL_TIMEOUT_MS` - Max wait time for order fill (default: `30000` ms)
- `STALE_ORDER_TIMEOUT_MS` - Max age for unfilled orders (default: `300000` ms / 5 min)

**Usage:**
```typescript
import { tradingConfig } from './config/trading-config';

const pollInterval = tradingConfig.orderExecution.orderFillPollIntervalMs;
const timeout = tradingConfig.orderExecution.orderFillTimeoutMs;

// Poll order status
while (Date.now() - start < timeout) {
  const order = await getOrder(orderId);
  if (order.status === 'filled') break;
  await sleep(pollInterval);
}
```

### 4. Risk Management Configuration

Controls position sizing, stop loss, and take profit defaults.

**Environment Variables:**
- `DEFAULT_HARD_STOP_LOSS_PERCENT` - Stop loss threshold (default: `3`%)
- `DEFAULT_TAKE_PROFIT_PERCENT` - Take profit target (default: `6`%)
- `DEFAULT_MAX_POSITION_SIZE_PERCENT` - Max position size (default: `15`%)
- `DEFAULT_MAX_EXPOSURE_PERCENT` - Max total exposure (default: `200`%)

**Risk Profiles:**

**Conservative:**
```bash
DEFAULT_MAX_POSITION_SIZE_PERCENT=5
DEFAULT_MAX_EXPOSURE_PERCENT=50
DEFAULT_HARD_STOP_LOSS_PERCENT=2
DEFAULT_TAKE_PROFIT_PERCENT=4
```

**Moderate (Default):**
```bash
DEFAULT_MAX_POSITION_SIZE_PERCENT=10
DEFAULT_MAX_EXPOSURE_PERCENT=80
DEFAULT_HARD_STOP_LOSS_PERCENT=3
DEFAULT_TAKE_PROFIT_PERCENT=6
```

**Aggressive:**
```bash
DEFAULT_MAX_POSITION_SIZE_PERCENT=15
DEFAULT_MAX_EXPOSURE_PERCENT=200
DEFAULT_HARD_STOP_LOSS_PERCENT=3
DEFAULT_TAKE_PROFIT_PERCENT=6
```

**Usage:**
```typescript
import { tradingConfig } from './config/trading-config';

const stopLossPercent = tradingConfig.riskManagement.defaultHardStopLossPercent;
const takeProfitPercent = tradingConfig.riskManagement.defaultTakeProfitPercent;
const maxPositionSize = tradingConfig.riskManagement.defaultMaxPositionSizePercent;

const stopLossPrice = entryPrice * (1 - stopLossPercent / 100);
const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
const maxPositionValue = portfolioValue * (maxPositionSize / 100);
```

### 5. Universe Configuration

Controls symbol selection and analysis scope.

**Environment Variables:**
- `MAX_STOCK_SYMBOLS_PER_CYCLE` - Max stocks to analyze (default: `500`)
- `MAX_CRYPTO_SYMBOLS_PER_CYCLE` - Max crypto to analyze (default: `100`)
- `MIN_CONFIDENCE_FOR_UNIVERSE` - Min AI confidence (default: `0.50` / 50%)
- `ALPACA_SNAPSHOT_CHUNK_SIZE` - Batch size for market data (default: `50`)

**Universe Profiles:**

**Conservative:**
```bash
MAX_STOCK_SYMBOLS_PER_CYCLE=120
MAX_CRYPTO_SYMBOLS_PER_CYCLE=20
MIN_CONFIDENCE_FOR_UNIVERSE=0.70
```

**Moderate:**
```bash
MAX_STOCK_SYMBOLS_PER_CYCLE=300
MAX_CRYPTO_SYMBOLS_PER_CYCLE=50
MIN_CONFIDENCE_FOR_UNIVERSE=0.60
```

**Aggressive (Default):**
```bash
MAX_STOCK_SYMBOLS_PER_CYCLE=500
MAX_CRYPTO_SYMBOLS_PER_CYCLE=100
MIN_CONFIDENCE_FOR_UNIVERSE=0.50
```

**Usage:**
```typescript
import { tradingConfig } from './config/trading-config';

const maxStocks = tradingConfig.universe.maxStockSymbolsPerCycle;
const maxCrypto = tradingConfig.universe.maxCryptoSymbolsPerCycle;
const minConfidence = tradingConfig.universe.minConfidenceForUniverse;

// Filter candidates by confidence
const qualifiedCandidates = candidates.filter(
  c => c.confidence >= minConfidence
);
```

### 6. Queue Configuration

Controls work queue polling and heartbeat monitoring.

**Environment Variables:**
- `QUEUE_POLL_INTERVAL_MS` - Queue poll interval (default: `2000` ms)
- `QUEUE_POLL_TIMEOUT_MS` - Work item timeout (default: `60000` ms)
- `HEARTBEAT_INTERVAL_MS` - Heartbeat interval (default: `30000` ms)

**Usage:**
```typescript
import { tradingConfig } from './config/trading-config';

const pollInterval = tradingConfig.queue.queuePollIntervalMs;
const timeout = tradingConfig.queue.queuePollTimeoutMs;

// Poll queue
setInterval(async () => {
  const workItems = await workQueue.poll();
  await processWorkItems(workItems, timeout);
}, pollInterval);
```

## Helper Functions

### `getAlpacaBaseUrl()`

Returns the active Alpaca API URL based on trading mode.

```typescript
import { getAlpacaBaseUrl } from './config/trading-config';

const baseUrl = getAlpacaBaseUrl();
// Returns: 'https://paper-api.alpaca.markets' (if mode is 'paper')
// Returns: 'https://api.alpaca.markets' (if mode is 'live')
```

### `getConfigSummary()`

Returns a human-readable summary of the current configuration.

```typescript
import { getConfigSummary } from './config/trading-config';

const summary = getConfigSummary();
console.log('Trading Configuration:', summary);

// Output:
// {
//   tradingMode: 'paper',
//   alpacaUrl: 'https://paper-api.alpaca.markets',
//   riskProfile: {
//     maxPositionSize: '15%',
//     maxExposure: '200%',
//     stopLoss: '3%',
//     takeProfit: '6%'
//   },
//   universe: {
//     maxStocks: 500,
//     maxCrypto: 100,
//     minConfidence: 0.5
//   },
//   orderRetry: {
//     maxRetries: 3,
//     backoffBaseMs: 2000,
//     circuitBreakerThreshold: 10
//   }
// }
```

### `validateTradingConfig()`

Validates the configuration on startup. Throws error if invalid.

```typescript
import { validateTradingConfig } from './config/trading-config';

try {
  validateTradingConfig();
  console.log('Configuration is valid');
} catch (error) {
  console.error('Invalid configuration:', error.message);
  process.exit(1);
}
```

## Migration Guide

### Migrating Hardcoded Values

**Before:**
```typescript
// hardcoded-service.ts
const MAX_RETRIES = 3;
const STOP_LOSS_PERCENT = 3;
const MAX_POSITION_SIZE = 15;
```

**After:**
```typescript
// hardcoded-service.ts
import { tradingConfig } from './config/trading-config';

const maxRetries = tradingConfig.orderRetry.maxRetriesPerOrder;
const stopLossPercent = tradingConfig.riskManagement.defaultHardStopLossPercent;
const maxPositionSize = tradingConfig.riskManagement.defaultMaxPositionSizePercent;
```

### Example Migration

See these files for migration examples:
- `/home/runner/workspace/server/trading/order-retry-handler.ts` - Order retry constants
- `/home/runner/workspace/server/trading/order-execution-flow.ts` - Execution timeouts
- `/home/runner/workspace/server/autonomous/orchestrator.ts` - Risk limits and universe config

## Best Practices

1. **Always validate configuration on startup:**
   ```typescript
   validateTradingConfig();
   ```

2. **Log configuration summary for debugging:**
   ```typescript
   console.log('Trading Config:', getConfigSummary());
   ```

3. **Use environment-specific .env files:**
   - `.env.development` - Conservative settings for testing
   - `.env.staging` - Moderate settings for staging
   - `.env.production` - Aggressive settings for production

4. **Never commit sensitive values to .env:**
   - Add `.env` to `.gitignore`
   - Use `.env.example` for documentation

5. **Test configuration changes in paper mode first:**
   ```bash
   ALPACA_TRADING_MODE=paper npm start
   ```

## Environment Variable Reference

Complete list of all supported environment variables:

```bash
# Alpaca Broker
ALPACA_TRADING_MODE=paper
ALPACA_PAPER_URL=https://paper-api.alpaca.markets
ALPACA_LIVE_URL=https://api.alpaca.markets
ALPACA_DATA_URL=https://data.alpaca.markets
ALPACA_STREAM_URL=wss://stream.data.alpaca.markets

# Order Retry
MAX_RETRIES_PER_ORDER=3
RETRY_BACKOFF_BASE_MS=2000
CIRCUIT_BREAKER_THRESHOLD=10
CIRCUIT_BREAKER_WINDOW_MS=60000
CIRCUIT_BREAKER_RESET_MS=300000

# Order Execution
ORDER_FILL_POLL_INTERVAL_MS=500
ORDER_FILL_TIMEOUT_MS=30000
STALE_ORDER_TIMEOUT_MS=300000

# Risk Management
DEFAULT_HARD_STOP_LOSS_PERCENT=3
DEFAULT_TAKE_PROFIT_PERCENT=6
DEFAULT_MAX_POSITION_SIZE_PERCENT=15
DEFAULT_MAX_EXPOSURE_PERCENT=200

# Universe Configuration
MAX_STOCK_SYMBOLS_PER_CYCLE=500
MAX_CRYPTO_SYMBOLS_PER_CYCLE=100
MIN_CONFIDENCE_FOR_UNIVERSE=0.50
ALPACA_SNAPSHOT_CHUNK_SIZE=50

# Queue Configuration
QUEUE_POLL_INTERVAL_MS=2000
QUEUE_POLL_TIMEOUT_MS=60000
HEARTBEAT_INTERVAL_MS=30000
```

## Troubleshooting

### Configuration Not Loading

**Problem:** Environment variables not being read.

**Solution:** Ensure you're loading environment variables:
```typescript
import 'dotenv/config'; // At the top of your entry file
```

### Invalid Configuration Error

**Problem:** `validateTradingConfig()` throws error.

**Solution:** Check the error message for specific validation failures:
```typescript
try {
  validateTradingConfig();
} catch (error) {
  console.error('Validation errors:', error.message);
  // Fix the specific configuration values mentioned in the error
}
```

### Configuration Changes Not Taking Effect

**Problem:** Changed environment variables but behavior didn't change.

**Solution:**
1. Restart the application (environment variables are loaded once on startup)
2. Check if you're using the correct environment file
3. Verify the configuration is being imported correctly:
   ```typescript
   import { tradingConfig } from './config/trading-config';
   console.log('Current config:', tradingConfig);
   ```

## Additional Resources

- [Alpaca API Documentation](https://alpaca.markets/docs/)
- [Environment Variables Best Practices](https://12factor.net/config)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)
