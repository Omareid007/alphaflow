# Trading Session Manager

A comprehensive service for managing different market sessions and trading hours across multiple exchanges.

## Features

### Multi-Exchange Support

- **US Equities (NYSE/NASDAQ)**: Regular hours (9:30 AM - 4:00 PM ET) + Extended hours (4:00 AM - 8:00 PM ET)
- **Cryptocurrency**: 24/7 trading
- **European DAX**: 9:00 AM - 5:30 PM CET
- **Asian Nikkei**: 9:00 AM - 3:00 PM JST

### Core Functionality

1. **Session Detection**: Automatically detects current market session (pre-market, regular, after-hours, closed)
2. **Holiday Management**: Includes 2024-2025 US market holidays
3. **Volatility Multipliers**: Session-aware volatility adjustments for risk management
4. **Timezone Handling**: Proper timezone support for global markets
5. **Next Open/Close**: Calculate next market open and close times

## API Usage

### TypeScript/Node.js

```typescript
import { tradingSessionManager } from "./services/trading-session-manager";

// Check if market is open
const isOpen = tradingSessionManager.isMarketOpen("US_EQUITIES");
console.log(`US Equities market is ${isOpen ? "open" : "closed"}`);

// Get current session info
const sessionInfo = tradingSessionManager.getCurrentSession("US_EQUITIES");
console.log(`Current session: ${sessionInfo.session}`); // pre_market | regular | after_hours | closed
console.log(`Is extended hours: ${sessionInfo.isExtendedHours}`);
console.log(`Volatility multiplier: ${sessionInfo.volatilityMultiplier}x`);

// Get next market open
const nextOpen = tradingSessionManager.getNextMarketOpen("US_EQUITIES");
console.log(`Next open: ${nextOpen?.toLocaleString()}`);

// Check if today is a holiday
const isHoliday = tradingSessionManager.isHoliday("US_EQUITIES", new Date());
console.log(`Today is a holiday: ${isHoliday}`);

// Get volatility multiplier for current session
const sessionType = sessionInfo.session;
const volatility = tradingSessionManager.getSessionVolatilityMultiplier("US_EQUITIES", sessionType);
console.log(`Volatility multiplier: ${volatility}x`);

// Get all market sessions at once
const allSessions = tradingSessionManager.getAllSessionInfo();
console.log("All markets:", allSessions);

// Auto-detect exchange from symbol
const exchange = tradingSessionManager.detectExchange("AAPL"); // US_EQUITIES
const cryptoExchange = tradingSessionManager.detectExchange("BTC/USD"); // CRYPTO
```

### REST API Endpoints

#### Get All Sessions
```bash
GET /api/trading-sessions/all

Response:
{
  "sessions": {
    "US_EQUITIES": {
      "session": "regular",
      "isOpen": true,
      "isExtendedHours": false,
      "nextOpen": null,
      "nextClose": "2025-01-15T21:00:00.000Z",
      "volatilityMultiplier": 1.0,
      "timezone": "America/New_York"
    },
    "CRYPTO": {
      "session": "regular",
      "isOpen": true,
      "isExtendedHours": false,
      "nextOpen": null,
      "nextClose": null,
      "volatilityMultiplier": 1.5,
      "timezone": "UTC"
    },
    ...
  },
  "timestamp": "2025-01-15T15:30:00.000Z"
}
```

#### Get Specific Exchange Session
```bash
GET /api/trading-sessions/us_equities

Response:
{
  "exchange": "US_EQUITIES",
  "session": {
    "session": "regular",
    "isOpen": true,
    "isExtendedHours": false,
    "nextOpen": null,
    "nextClose": "2025-01-15T21:00:00.000Z",
    "volatilityMultiplier": 1.0,
    "timezone": "America/New_York"
  },
  "config": {
    "name": "US Equities",
    "exchange": "NYSE/NASDAQ",
    "timezone": "America/New_York",
    "regularHours": {
      "start": "09:30",
      "end": "16:00"
    },
    "extendedHours": {
      "preMarket": { "start": "04:00", "end": "09:30" },
      "afterHours": { "start": "16:00", "end": "20:00" }
    },
    "holidays": ["2024-01-01", "2024-01-15", ...]
  },
  "timestamp": "2025-01-15T15:30:00.000Z"
}
```

#### Check If Market Is Open
```bash
GET /api/trading-sessions/us_equities/is-open

Response:
{
  "exchange": "US_EQUITIES",
  "isOpen": true,
  "timestamp": "2025-01-15T15:30:00.000Z"
}
```

#### Get Next Market Open
```bash
GET /api/trading-sessions/us_equities/next-open

Response:
{
  "exchange": "US_EQUITIES",
  "nextOpen": "2025-01-16T09:00:00.000Z",
  "timestamp": "2025-01-15T21:30:00.000Z"
}
```

#### Get Volatility Multiplier
```bash
GET /api/trading-sessions/us_equities/volatility

Response:
{
  "exchange": "US_EQUITIES",
  "session": "after_hours",
  "volatilityMultiplier": 1.8,
  "timestamp": "2025-01-15T22:00:00.000Z"
}
```

## Session Types

### Pre-Market (`pre_market`)
- **Hours**: 4:00 AM - 9:30 AM ET
- **Volatility**: 2.0x (highest)
- **Liquidity**: Low
- **Order Type**: Limit orders only

### Regular (`regular`)
- **Hours**: 9:30 AM - 4:00 PM ET
- **Volatility**: 1.0x (baseline)
- **Liquidity**: High
- **Order Type**: Market or limit orders

### After-Hours (`after_hours`)
- **Hours**: 4:00 PM - 8:00 PM ET
- **Volatility**: 1.8x (high)
- **Liquidity**: Reduced
- **Order Type**: Limit orders only

### Closed (`closed`)
- **Hours**: Outside trading hours, weekends, holidays
- **Volatility**: 0.0x
- **Trading**: Not allowed

## Volatility Multipliers

Used for risk adjustment and position sizing:

| Session Type | US Equities | Crypto |
|-------------|-------------|--------|
| Pre-Market  | 2.0x        | -      |
| Regular     | 1.0x        | 1.5x   |
| After-Hours | 1.8x        | -      |
| Closed      | 0.0x        | -      |

## US Market Holidays (2024-2025)

### 2024
- January 1: New Year's Day
- January 15: Martin Luther King Jr. Day
- February 19: Presidents' Day
- March 29: Good Friday
- May 27: Memorial Day
- June 19: Juneteenth
- July 4: Independence Day
- September 2: Labor Day
- November 28: Thanksgiving
- December 25: Christmas

### 2025
- January 1: New Year's Day
- January 20: Martin Luther King Jr. Day
- February 17: Presidents' Day
- April 18: Good Friday
- May 26: Memorial Day
- June 19: Juneteenth
- July 4: Independence Day
- September 1: Labor Day
- November 27: Thanksgiving
- December 25: Christmas

## Integration with Orchestrator

The Trading Session Manager is integrated with the orchestrator's `preTradeGuard` function:

```typescript
// In orchestrator.ts
const exchange = isCrypto ? "CRYPTO" : "US_EQUITIES";
const sessionInfo = tradingSessionManager.getCurrentSession(exchange);

// Check if market is on holiday
if (tradingSessionManager.isHoliday(exchange, new Date())) {
  result.canTrade = false;
  result.reason = `Market is closed for holiday (next open: ${sessionInfo.nextOpen?.toISOString()})`;
  return result;
}

// Apply volatility adjustment for extended hours pricing
const basePrice = snapshot.latestTrade.p;
const volatilityMultiplier = sessionInfo.volatilityMultiplier;
```

## Performance

- **Caching**: Session info is cached for 1 minute to reduce computation
- **Lazy Loading**: Sessions are calculated on-demand
- **Cache Control**: `clearCache()` method available for testing

## Testing

Run the comprehensive test suite:

```bash
npm test server/services/__tests__/trading-session-manager.test.ts
```

Tests cover:
- Market open/closed detection
- Session type identification
- Holiday detection
- Volatility multipliers
- Next open/close calculations
- Crypto 24/7 behavior
- Weekend/holiday handling
- Caching behavior

## Future Enhancements

1. **More Exchanges**: Add support for more international exchanges
2. **Early Close Detection**: Handle early close days (e.g., day before holidays)
3. **Market Breaks**: Handle lunch breaks for Asian markets
4. **Circuit Breaker Awareness**: Integrate with market halt detection
5. **Dynamic Holiday Calendar**: Fetch holidays from external API
6. **Timezone Library**: Use luxon or date-fns-tz for better timezone handling

## Example Use Cases

### 1. Session-Aware Order Placement
```typescript
const exchange = tradingSessionManager.detectExchange(symbol);
const session = tradingSessionManager.getCurrentSession(exchange);

if (!session.isOpen) {
  console.log(`Market closed. Next open: ${session.nextOpen}`);
  return;
}

if (session.isExtendedHours) {
  // Use limit orders during extended hours
  orderParams.type = "limit";
  orderParams.extended_hours = true;
  orderParams.limit_price = currentPrice;
}
```

### 2. Volatility-Adjusted Position Sizing
```typescript
const basePositionSize = 1000;
const volatilityMultiplier = tradingSessionManager.getSessionVolatilityMultiplier(
  exchange,
  sessionInfo.session
);

// Reduce position size during high volatility sessions
const adjustedPositionSize = basePositionSize / volatilityMultiplier;
```

### 3. Trading Schedule Display
```typescript
const allSessions = tradingSessionManager.getAllSessionInfo();

for (const [exchange, info] of Object.entries(allSessions)) {
  console.log(`${exchange}: ${info.session} (${info.isOpen ? "Open" : "Closed"})`);
  if (!info.isOpen && info.nextOpen) {
    console.log(`  Next open: ${info.nextOpen.toLocaleString()}`);
  }
}
```

## Architecture

```
tradingSessionManager (singleton)
├── Session Configs (MARKET_SESSIONS)
│   ├── US_EQUITIES
│   ├── CRYPTO
│   ├── EUROPEAN_DAX
│   └── ASIAN_NIKKEI
├── Holiday Calendars
│   └── US_MARKET_HOLIDAYS_2024_2025
├── Cache (1-minute TTL)
│   └── Map<exchange, SessionInfo>
└── Methods
    ├── isMarketOpen()
    ├── getCurrentSession()
    ├── getNextMarketOpen()
    ├── getNextMarketClose()
    ├── isHoliday()
    ├── getSessionVolatilityMultiplier()
    ├── detectExchange()
    └── getAllSessionInfo()
```

## Notes

- All times are handled in the exchange's local timezone
- Crypto markets (CRYPTO) are always open (24/7)
- Extended hours trading requires limit orders (Alpaca requirement)
- Weekend days are automatically treated as closed for stock markets
- Session info is cached for performance - use `clearCache()` if needed
