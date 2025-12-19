# Futures Trading - Quick Start Guide

## 30-Second Overview

This system now has a standardized interface for futures trading. Since Alpaca doesn't support futures, you need to implement a connector for a futures-capable broker.

## Files You Need to Know

| File | Purpose | Lines |
|------|---------|-------|
| `futures-broker-interface.ts` | Main interface + placeholders | 740 |
| `futures-trading-example.ts` | 12 working examples | 446 |
| `FUTURES_BROKER_README.md` | Full documentation | 432 |
| `futures-strategy.ts` | Instrument configs (updated) | 1028 |

## Quick Implementation (Interactive Brokers)

### 1. Install IB Gateway
Download: https://www.interactivebrokers.com/en/trading/tws.php

### 2. Install Package
```bash
npm install @stoqey/ib
```

### 3. Add to .env
```bash
IB_HOST=127.0.0.1
IB_PORT=7497  # Paper trading
IB_CLIENT_ID=0
IB_ACCOUNT_ID=DU123456
```

### 4. Implement in futures-broker-interface.ts
```typescript
import { IB } from '@stoqey/ib';

export class InteractiveBrokersFutures implements FuturesBroker {
  private ib: IB;

  async connect(): Promise<void> {
    this.ib = new IB({
      host: process.env.IB_HOST,
      port: parseInt(process.env.IB_PORT || "7497"),
      clientId: 0
    });
    await this.ib.connect();
    this.connected = true;
  }

  // Implement other methods...
}
```

### 5. Use It
```typescript
import { createFuturesBroker } from "./server/connectors/futures-broker-interface";

const broker = createFuturesBroker("interactive_brokers", {
  host: "127.0.0.1",
  port: 7497,
  paperTrading: true
});

await broker.connect();

// Trade!
const order = await broker.createOrder({
  symbol: "MES",
  side: "buy",
  quantity: 1,
  type: "market",
  timeInForce: "day"
});
```

## Supported Instruments

- **MES** - Micro E-mini S&P 500 ($1.25/tick)
- **MNQ** - Micro E-mini Nasdaq-100 ($0.50/tick)
- **MYM** - Micro E-mini Dow ($0.50/tick)
- **ES** - E-mini S&P 500 ($12.50/tick)
- **GC** - Gold Futures ($10/tick)
- **MGC** - Micro Gold ($1/tick)
- **SI** - Silver Futures ($25/tick)
- **FDAX** - DAX Futures (EUR 12.50/tick)

All configs include tick sizes, margins, trading hours, volatility profiles, and recommended strategies.

## Quick Examples

### Get Quote
```typescript
const quote = await broker.getQuote("MES");
console.log(`MES: ${quote.last}`);
```

### Place Bracket Order
```typescript
await broker.createBracketOrder({
  symbol: "MES",
  side: "buy",
  quantity: 1,
  type: "market",
  timeInForce: "gtc",
  takeProfitPrice: 5250,
  stopLossPrice: 5150
});
```

### Check Position
```typescript
const position = await broker.getPosition("MES");
console.log(`P&L: $${position.unrealizedPnl}`);
```

### Close Position
```typescript
await broker.closePosition("MES");
```

## Key Interface Methods

```typescript
interface FuturesBroker {
  // Connection
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean

  // Account
  getAccount(): Promise<FuturesAccount>
  getPositions(): Promise<FuturesPosition[]>

  // Trading
  createOrder(params): Promise<FuturesOrder>
  createBracketOrder(params): Promise<FuturesOrder>
  cancelOrder(id): Promise<void>
  closePosition(symbol): Promise<FuturesOrder>

  // Data
  getQuote(symbol): Promise<FuturesQuote>
  getBars(symbol, timeframe, start, end): Promise<FuturesBar[]>

  // Streaming
  subscribeQuotes(symbols, callback): void
  unsubscribeQuotes(symbols): void
}
```

## Risk Management

### Position Sizing
```typescript
import { calculateFuturesPositionSize } from "./strategies/futures-strategy";

const { contracts } = calculateFuturesPositionSize(
  "MES",
  100000,  // Account equity
  1000     // Risk per trade
);
```

### Margin Check
```typescript
const account = await broker.getAccount();
const mesConfig = getFuturesConfig("MES");
const marginRequired = mesConfig.marginRequirement.initial;

if (account.availableFunds < marginRequired) {
  throw new Error("Insufficient margin");
}
```

### Bracket Orders (Automatic Stop/Target)
```typescript
const config = getFuturesConfig("MES");
const currentPrice = 5200;
const stopDistance = config.volatilityProfile.averageATR14 *
                     config.strategyParams.atrStopMultiplier;

await broker.createBracketOrder({
  symbol: "MES",
  side: "buy",
  quantity: 1,
  type: "market",
  timeInForce: "gtc",
  stopLossPrice: currentPrice - stopDistance,
  takeProfitPrice: currentPrice + (stopDistance * 1.5)
});
```

## Broker Options

| Broker | Status | Best For | Requirements |
|--------|--------|----------|--------------|
| **Interactive Brokers** | Placeholder | All traders | IB Gateway, @stoqey/ib |
| **Tradovate** | Placeholder | Futures specialists | API credentials |
| **NinjaTrader** | Placeholder | Advanced traders | NinjaTrader 8, ATI |

## Testing Checklist

- [ ] Set up paper trading account
- [ ] Implement broker connector
- [ ] Test connection
- [ ] Test market data retrieval
- [ ] Test order placement (small size)
- [ ] Test bracket orders
- [ ] Test position closing
- [ ] Monitor for 24 hours
- [ ] Gradually increase position size

## Safety First

1. **Always start with paper trading**
2. **Use micro contracts** (MES, MNQ, MGC)
3. **Always use stops** (bracket orders)
4. **Never risk more than 1-2%** per trade
5. **Check margin before every trade**
6. **Monitor leverage** (stay under 3x)
7. **Have a kill switch** mechanism

## Common Gotchas

1. **Contract months**: Futures expire. Use front month or specify.
2. **Tick sizes**: MES moves in 0.25 points ($1.25), not dollars
3. **Margin**: Futures use margin, not cash. Check available funds.
4. **Trading hours**: Many futures trade 23 hours/day
5. **Rollover**: Contracts must be rolled before expiration
6. **Volatility**: Futures can gap significantly overnight

## Get Help

- Full docs: `FUTURES_BROKER_README.md`
- Examples: `futures-trading-example.ts`
- Instrument configs: `futures-strategy.ts`
- Summary: `../../FUTURES_INTEGRATION_SUMMARY.md`

## Next Steps

1. Choose broker (recommend Interactive Brokers)
2. Set up paper account
3. Implement connector following examples
4. Test with 1 micro contract
5. Run for 1 week paper trading
6. Review results before going live

---

**Remember**: Futures trading involves substantial risk. Start small, use stops, and never risk more than you can afford to lose.
