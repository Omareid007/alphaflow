# Futures Broker Integration Guide

## Overview

This directory contains a standardized interface for integrating futures trading brokers with the trading system. Since Alpaca doesn't support futures trading, this interface provides a foundation for connecting to futures-capable brokers.

## Architecture

```
server/
├── connectors/
│   ├── futures-broker-interface.ts  # Main interface & placeholder implementations
│   └── FUTURES_BROKER_README.md     # This file
└── strategies/
    └── futures-strategy.ts           # Futures instrument configurations
```

## Supported Brokers (Placeholders)

The following broker connectors are defined but not yet implemented:

### 1. Interactive Brokers (IBKR)
- **Status**: Placeholder
- **Requirements**:
  - IB Gateway or TWS installed
  - `@stoqey/ib` Node.js package
  - IB API credentials
- **Documentation**: https://www.interactivebrokers.com/en/trading/tws-api.php

### 2. Tradovate
- **Status**: Placeholder
- **Requirements**:
  - Tradovate API access
  - API credentials (OAuth)
- **Documentation**: https://api.tradovate.com/

### 3. NinjaTrader
- **Status**: Placeholder
- **Requirements**:
  - NinjaTrader 8 installed
  - ATI (Automated Trading Interface) enabled
- **Documentation**: https://ninjatrader.com/support/helpGuides/nt8/automated_trading_interface.htm

## Interface Overview

### Core Types

```typescript
// Account information
interface FuturesAccount {
  cashBalance: number;
  netLiquidation: number;
  initialMargin: number;
  maintenanceMargin: number;
  availableFunds: number;
  // ... more fields
}

// Position tracking
interface FuturesPosition {
  symbol: string;
  contractMonth: string;
  side: "long" | "short";
  quantity: number;
  avgEntryPrice: number;
  unrealizedPnl: number;
  // ... more fields
}

// Order management
interface FuturesOrderParams {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  type: "market" | "limit" | "stop" | "stop_limit";
  // ... more fields
}

// Market data
interface FuturesQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  // ... more fields
}
```

### Main Interface

```typescript
interface FuturesBroker {
  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Account & Positions
  getAccount(): Promise<FuturesAccount>;
  getPositions(): Promise<FuturesPosition[]>;
  getPosition(symbol: string): Promise<FuturesPosition | null>;

  // Order Management
  createOrder(params: FuturesOrderParams): Promise<FuturesOrder>;
  createBracketOrder(params: ...): Promise<FuturesOrder>;
  cancelOrder(orderId: string): Promise<void>;
  closePosition(symbol: string): Promise<FuturesOrder>;

  // Market Data
  getQuote(symbol: string): Promise<FuturesQuote>;
  getBars(symbol, timeframe, start, end): Promise<FuturesBar[]>;

  // Streaming
  subscribeQuotes(symbols: string[], callback: QuoteCallback): void;
  unsubscribeQuotes(symbols: string[]): void;
}
```

## Usage Example

### 1. Basic Setup

```typescript
import { createFuturesBroker } from "./connectors/futures-broker-interface";
import { setFuturesBroker } from "./strategies/futures-strategy";

// Create broker instance
const broker = createFuturesBroker("interactive_brokers", {
  apiKey: process.env.IB_API_KEY,
  apiSecret: process.env.IB_API_SECRET,
  accountId: process.env.IB_ACCOUNT_ID,
  paperTrading: true
});

// Connect
await broker.connect();

// Register with futures strategy
setFuturesBroker(broker);
```

### 2. Trading Operations

```typescript
import { getFuturesBroker, getFuturesConfig } from "./strategies/futures-strategy";

const broker = getFuturesBroker();
if (!broker?.isConnected()) {
  throw new Error("Futures broker not connected");
}

// Get account info
const account = await broker.getAccount();
console.log(`Available funds: $${account.availableFunds}`);

// Get instrument configuration
const mesConfig = getFuturesConfig("MES"); // Micro E-mini S&P 500

// Create a market order
const order = await broker.createOrder({
  symbol: "MES",
  contractMonth: "202503", // March 2025
  side: "buy",
  quantity: 1,
  type: "market",
  timeInForce: "day"
});

// Create a bracket order with stop loss and take profit
const bracketOrder = await broker.createBracketOrder({
  symbol: "MES",
  side: "buy",
  quantity: 1,
  type: "market",
  timeInForce: "gtc",
  takeProfitPrice: 5250,
  stopLossPrice: 5150
});

// Check positions
const positions = await broker.getPositions();
console.log(`Open positions: ${positions.length}`);

// Close a position
await broker.closePosition("MES");
```

### 3. Market Data

```typescript
// Get current quote
const quote = await broker.getQuote("MES");
console.log(`MES: ${quote.last} (bid: ${quote.bid}, ask: ${quote.ask})`);

// Get historical bars
const bars = await broker.getBars(
  "MES",
  "5m",
  new Date("2024-01-01"),
  new Date("2024-01-02")
);

// Subscribe to real-time quotes
broker.subscribeQuotes(["MES", "MNQ"], (quote) => {
  console.log(`${quote.symbol}: ${quote.last}`);
});
```

### 4. Position Sizing with Futures Config

```typescript
import { calculateFuturesPositionSize, getFuturesConfig } from "./strategies/futures-strategy";

const accountEquity = 100000; // $100k account
const riskAmount = 1000; // Risk $1k per trade

// Calculate position size for MES
const { contracts, notionalValue } = calculateFuturesPositionSize(
  "MES",
  accountEquity,
  riskAmount
);

console.log(`Trade size: ${contracts} contracts, notional: $${notionalValue}`);
```

## Implementation Checklist

To implement a futures broker connector:

### Interactive Brokers Example

1. **Install Dependencies**
   ```bash
   npm install @stoqey/ib
   ```

2. **Set up IB Gateway**
   - Download and install IB Gateway
   - Configure API access in TWS/Gateway settings
   - Enable socket client connections
   - Set port (default: 7497 for paper, 7496 for live)

3. **Implement Connection**
   ```typescript
   import { IB } from '@stoqey/ib';

   export class InteractiveBrokersFutures implements FuturesBroker {
     private ib: IB;

     async connect(): Promise<void> {
       this.ib = new IB({
         host: '127.0.0.1',
         port: 7497, // paper trading
         clientId: 0
       });

       await this.ib.connect();
       this.connected = true;
     }

     // ... implement other methods
   }
   ```

4. **Map Contract Symbols**
   ```typescript
   private getIBContract(symbol: string, contractMonth?: string) {
     return {
       symbol: symbol,
       secType: 'FUT',
       exchange: 'CME',
       currency: 'USD',
       lastTradeDateOrContractMonth: contractMonth || this.getFrontMonth()
     };
   }
   ```

5. **Implement Order Management**
   ```typescript
   async createOrder(params: FuturesOrderParams): Promise<FuturesOrder> {
     const contract = this.getIBContract(params.symbol, params.contractMonth);
     const order = {
       action: params.side.toUpperCase(),
       totalQuantity: params.quantity,
       orderType: params.type.toUpperCase(),
       // ... map other fields
     };

     const orderId = await this.ib.placeOrder(contract, order);
     return this.mapIBOrderToFuturesOrder(orderId, order);
   }
   ```

6. **Implement Market Data**
   ```typescript
   async getQuote(symbol: string): Promise<FuturesQuote> {
     const contract = this.getIBContract(symbol);
     const snapshot = await this.ib.reqMktData(contract, '', true);

     return {
       symbol,
       bid: snapshot.bid,
       ask: snapshot.ask,
       last: snapshot.last,
       // ... map other fields
     };
   }
   ```

## Futures Instruments

The system supports the following futures contracts (configured in `futures-strategy.ts`):

### US Index Futures
- **MES** - Micro E-mini S&P 500 (CME)
- **MNQ** - Micro E-mini Nasdaq-100 (CME)
- **MYM** - Micro E-mini Dow (CME)
- **ES** - E-mini S&P 500 (CME)
- **M2K** - Micro E-mini Russell 2000 (CME)

### Precious Metals
- **GC** - Gold Futures (CME)
- **MGC** - Micro Gold Futures (CME)
- **SI** - Silver Futures (CME)

### International
- **FDAX** - DAX Futures (EUREX)
- **N225MC** - Nikkei 225 Micro (CME/JPX)

Each instrument includes:
- Tick size and tick value
- Contract size
- Margin requirements
- Volatility profile
- Recommended strategies
- Trading hours
- Correlation data

## Risk Management

Futures trading involves significant risk. The interface includes:

1. **Margin Tracking**: Real-time margin requirements and available funds
2. **Position Sizing**: Volatility-adjusted position sizing based on ATR
3. **Stop Losses**: Built-in support for bracket orders with stops
4. **Leverage Limits**: Account-level leverage monitoring

Example risk management:
```typescript
const account = await broker.getAccount();

// Check available margin
if (account.availableFunds < requiredMargin) {
  throw new Error("Insufficient margin");
}

// Validate leverage
const currentLeverage = account.netLiquidation / account.cashBalance;
if (currentLeverage > MAX_LEVERAGE) {
  throw new Error("Leverage limit exceeded");
}

// Use ATR-based stops
const mesConfig = getFuturesConfig("MES");
const stopDistance = mesConfig.volatilityProfile.averageATR14 *
                     mesConfig.strategyParams.atrStopMultiplier;
```

## Testing

Before live trading:

1. **Paper Trading**: All brokers support paper/simulation accounts
2. **Unit Tests**: Test each interface method with mock data
3. **Integration Tests**: Test full order flow on paper account
4. **Backtesting**: Validate strategies on historical data

## Environment Variables

Add these to your `.env` file:

```bash
# Interactive Brokers
IB_HOST=127.0.0.1
IB_PORT=7497  # 7497 for paper, 7496 for live
IB_CLIENT_ID=0
IB_ACCOUNT_ID=DU123456

# Tradovate
TRADOVATE_API_KEY=your_api_key
TRADOVATE_API_SECRET=your_api_secret
TRADOVATE_ACCOUNT_ID=your_account_id
TRADOVATE_PAPER=true

# NinjaTrader
NINJA_ATI_PORT=36973
NINJA_ACCOUNT_ID=Sim101
```

## Security Notes

1. **Never commit credentials** to version control
2. **Use paper trading** for development and testing
3. **Implement rate limiting** to avoid API throttling
4. **Validate all inputs** before sending orders
5. **Monitor positions** and implement kill switches
6. **Log all trades** for audit and debugging

## Future Enhancements

- [ ] Order book depth (Level 2 data)
- [ ] Options on futures
- [ ] Multi-leg strategies (spreads, straddles)
- [ ] Real-time P&L tracking
- [ ] Advanced order types (iceberg, trailing stops)
- [ ] Position reconciliation
- [ ] Automated rollover handling
- [ ] Historical data caching

## Support

For questions or issues:
1. Check broker API documentation
2. Review futures strategy configuration
3. Test on paper account first
4. Enable debug logging for diagnostics

## License

This interface is part of the trading system and follows the same license terms.
