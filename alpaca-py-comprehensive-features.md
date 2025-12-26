# Alpaca-py Comprehensive Feature List

## Overview

**Alpaca-py** is the official Python SDK for interacting with Alpaca's financial APIs. It provides a comprehensive interface for trading, market data, and brokerage services through REST, WebSocket, and SSE endpoints.

- **GitHub Repository**: https://github.com/alpacahq/alpaca-py
- **Documentation**: https://alpaca.markets/sdks/python/getting_started.html
- **PyPI Package**: alpaca-py (requires Python 3.8+)
- **License**: Apache 2.0
- **Latest Version**: 0.43.2 (as of November 2025)

---

## 1. CORE API PRODUCTS

### 1.1 Trading API
Execute stock, cryptocurrency, and options trades with fast execution speeds.

### 1.2 Market Data API
Access historical and live data for 5,000+ stocks, 20+ cryptocurrencies, and options with over 5 years of historical data.

### 1.3 Broker API
Build complete investment applications, from robo-advisors to full brokerages.

---

## 2. ARCHITECTURE & DESIGN

### 2.1 Object-Oriented Design
- Uses Pydantic for runtime validation
- Request objects required for API calls (e.g., `MarketOrderRequest`, `CryptoBarsRequest`)
- Each method has a corresponding request model
- JSON parsing directly into request models

### 2.2 Specialized Clients

**Trading Clients:**
- `TradingClient` - Main trading interface for paper and live trading

**Historical Data Clients:**
- `StockHistoricalDataClient` - Historical stock data (requires API keys)
- `CryptoHistoricalDataClient` - Historical crypto data (no keys required)
- `OptionHistoricalDataClient` - Historical options data (requires API keys)
- `NewsClient` - Historical news data (no keys required)
- `ScreenerClient` - Stock screening functionality

**Real-time Streaming Clients:**
- `StockDataStream` - Real-time stock data via WebSocket
- `CryptoDataStream` - Real-time crypto data via WebSocket
- `OptionDataStream` - Real-time options data via WebSocket
- `NewsDataStream` - Real-time news data via WebSocket
- `TradingStream` - Real-time order updates and account activity

---

## 3. ASSET CLASS SUPPORT

### 3.1 Equities
- Full stock and ETF trading
- 5,000+ symbols available
- Commission-free equity trading
- US equity markets (American style options)

### 3.2 Cryptocurrencies
- 20+ unique crypto assets across 56 trading pairs
- Trading pairs based on BTC, USD, USDT, and USDC
- 24/7 trading availability
- Tiered crypto trading fees
- Wallet support for Bitcoin, Ethereum, and ERC20 tokens

### 3.3 Options
- Exchange-listed US equity and ETF options (American style)
- Single-leg and multi-leg options strategies
- Index options coming soon
- Dedicated options documentation and examples

### 3.4 News Data
- Real-time and historical financial news (dating back to 2015)
- Partnership with Benzinga
- Available for both stock and crypto symbols

---

## 4. TRADING FEATURES

### 4.1 Order Types

**Basic Order Types:**
- **Market Orders** - Execute at current best available price
- **Limit Orders** - Execute at specified price or better
- **Stop Orders** - Trigger market order when stop price reached
- **Stop-Limit Orders** - Trigger limit order when stop price reached
- **Trailing Stop Orders** - Dynamic stop price that follows favorable price movement
  - Support for `trail_percent` or `trail_price`
  - Currently single orders only (not in bracket/OCO legs)

### 4.2 Advanced Order Classes

**Order Classes:**
- **Simple Orders** - Standard single orders
- **Bracket Orders (OTOCO)** - Entry order with take-profit and stop-loss exits
- **OCO Orders (One-Cancels-Other)** - Two orders where execution of one cancels the other
- **OTO Orders (One-Triggers-Other)** - Entry order that triggers another order upon fill

**Supported by Asset Class:**
- Equity trading: simple, oco, oto, bracket
- Options trading: (support varies)
- Crypto trading: (support varies)

### 4.3 Time-In-Force Options

**Equity Trading:**
- `DAY` - Valid for current trading day only
- `GTC` - Good-Till-Canceled (auto-cancel after 90 days)
- `OPG` - Market/Limit on Open (opening auction only)
- `CLS` - Market/Limit on Close (closing auction only)
- `IOC` - Immediate-Or-Cancel (partial fills allowed)
- `FOK` - Fill-Or-Kill (complete fill or cancel)

**Options Trading:**
- `DAY` - Only DAY orders supported for options

**Crypto Trading:**
- `GTC` - Good-Till-Canceled
- `IOC` - Immediate-Or-Cancel

### 4.4 Fractional Trading

**Fractional Shares:**
- Support for fractional quantities (up to 9 decimal points)
- Available for market, limit, stop, and stop-limit orders
- Time-in-force: DAY supported
- Over 5,000 fractionable securities
- Check `fractionable: true` flag in asset response

**Notional Orders:**
- Trade by dollar amount instead of share quantity
- Use `notional` parameter (mutually exclusive with `qty`)
- Support up to 9 decimal points
- Inherently fractional orders

### 4.5 Extended Hours Trading

**Extended Hours Support:**
- Pre-market: 4:00 AM - 9:30 AM ET
- After-hours: 4:00 PM - 8:00 PM ET
- Monday to Friday

**Requirements:**
- Set `extended_hours=True` parameter
- Only limit orders on whole shares accepted
- All regular symbols supported
- Short selling treated the same

### 4.6 Order Management Methods

**TradingClient Order Methods:**
- `submit_order(order_data)` - Create new order
- `get_orders(filter)` - Retrieve all orders with optional filtering
- `get_order_by_id(order_id)` - Get specific order by UUID
- `replace_order_by_id(order_id, params)` - Modify existing order
- `cancel_orders()` - Cancel all active orders
- `cancel_order_by_id(order_id)` - Cancel specific order

### 4.7 Multi-Leg Options Trading

**Level 3 Options Support:**
- Both single-leg and multi-leg strategies
- Available in paper and live trading
- Up to 4 legs per multi-leg order

**Supported Strategies:**
- Straddles
- Strangles
- Iron Butterflies
- Iron Condors
- Spreads (call spreads, put spreads)

**Implementation:**
- Set `order_class="mleg"`
- Define each leg in `legs` array with symbol, side, and ratio quantity
- Each leg must be covered within same MLeg order

**Limitations:**
- Equity legs not supported in MLeg orders
- All short legs must be covered in same order
- Uncovered short positions must be submitted as single-leg orders

### 4.8 Crypto-Specific Features

**Order Types:**
- Market, Limit, and Stop-Limit orders supported
- Time-in-force: GTC and IOC only

**Restrictions:**
- Cannot be bought on margin
- Cannot be sold short
- Maximum order size: $200k notional per order
- Evaluated against `non_marginable_buying_power`

**Advantages:**
- 24/7 trading availability
- Fractional trading supported
- All assets fractionable (varying decimal points)

---

## 5. POSITION & ACCOUNT MANAGEMENT

### 5.1 Position Management

**TradingClient Position Methods:**
- `get_all_positions()` - Get all open positions
- `get_open_position(symbol_or_asset_id)` - Get position for specific asset
- `close_position(symbol_or_asset_id)` - Close specific position
- `close_all_positions(cancel_orders)` - Liquidate all positions
  - Optional: Set `cancel_orders=True` to also cancel open orders

**Position Information:**
- Cost basis
- Shares traded
- Market value (updated live)
- Current P&L
- Unrealized gains/losses

### 5.2 Account Management

**TradingClient Account Methods:**
- `get_account()` - Retrieve account information

**Account Information Includes:**
- Current balance vs. last market close
- Portfolio balance change
- Buying power (`account.buying_power`)
- Trading restrictions (`account.trading_blocked`)
- Margin status
- Account equity
- Cash available

---

## 6. MARKET DATA FEATURES

### 6.1 Historical Data Types

**Available Data Formats:**
- **Bars/Candles** - OHLCV (Open, High, Low, Close, Volume) data
- **Trade Data** - Individual trade prices and volumes
- **Quote Data** - Bid/ask information (Level 1 quotes)
- **Orderbook Data** - Crypto only

**Timeframes for Bars:**
- Various timeframes supported (1min, 5min, 15min, 1hour, 1day, etc.)
- Over 5 years of historical data available

### 6.2 Historical Data Methods

**Stock Historical Data:**
- `get_stock_bars(request_params)` - Bar data over time period
- `get_stock_trades(request_params)` - Trade history
- `get_stock_quotes(request_params)` - Quote history
- `get_stock_latest_bar(request_params)` - Latest minute bar
- `get_stock_latest_trade(request_params)` - Latest trade
- `get_stock_snapshot(request_params)` - Comprehensive snapshot
  - Includes: latest trade, latest quote, minute bar, daily bar, previous daily bar

**Crypto Historical Data:**
- Similar methods available for crypto assets
- No API keys required for historical crypto data

**Options Historical Data:**
- Historical options data available
- Requires API keys

### 6.3 Real-Time Streaming

**WebSocket Streaming:**
- Subscribe to real-time data via WebSocket
- Follows RFC6455 WebSocket protocol
- Supports both JSON and MessagePack codecs

**Streaming Clients:**
- `StockDataStream` - Real-time stock quotes, trades, bars
- `CryptoDataStream` - Real-time crypto updates
- `OptionDataStream` - Real-time options data
- `NewsDataStream` - Real-time news feed
- `TradingStream` - Order updates, fills, cancellations

**Subscription Types:**
- Bars (1-minute bars)
- Trades (individual trades)
- Quotes (bid/ask updates)
- Account updates
- Order updates

### 6.4 Data Feeds

**Feed Options:**
- **IEX Feed** - Free plan
- **SIP Feed** - Paid subscription ($9/month for unlimited)
  - Increased rate limit: 1000 API calls/min vs 200 calls/min

### 6.5 Snapshots & Latest Data

**Snapshot Features:**
- Comprehensive point-in-time view of asset
- Includes multiple data types in single request
- Latest trade, quote, minute bar, daily bar, previous daily bar
- Efficient for getting current state

### 6.6 News Data

**NewsClient Features:**
- Historical news dating back to 2015
- Real-time news via WebSocket
- Partnership with Benzinga

**News Data Fields:**
- Author
- Created/Updated timestamps
- Headline
- Summary
- Content
- Images
- URL
- Associated symbols
- Source

**Query Capabilities:**
- Filter by symbol
- Filter by date range
- Search by content
- Filter by source

---

## 7. ASSET & MARKET INFORMATION

### 7.1 Asset Endpoints

**TradingClient Asset Methods:**
- `get_all_assets(filter)` - Master list of all assets
- Filter by `AssetClass` (US_EQUITY, CRYPTO, etc.)

**Asset Properties:**
- `tradable` - Whether asset can be traded
- `marginable` - Can be traded on margin
- `shortable` - Can be shorted
- `easy_to_borrow` - Easy to borrow for shorting
- `fractionable` - Fractional shares available
- `maintenance_margin_requirement` - Margin requirement percentage
- `exchange` - Trading venue
- `status` - Active, inactive, etc.

**Asset Classes:**
- US Equity
- Crypto
- Options

**Note:** API-level filtering may require client-side filtering for some boolean properties.

### 7.2 Market Calendar & Clock

**Calendar API:**
- `get_calendar(filters)` - Market days from 1970 to 2029
- Filter by start/end date
- Includes open and close times
- Accounts for early closures and holidays

**Clock API:**
- `get_clock()` - Current market status
- Returns:
  - Current timestamp (Eastern Time)
  - Market open status (boolean)
  - Next market open time
  - Next market close time

**Use Cases:**
- Check if market is currently open
- Schedule trading around market hours
- Handle market holidays
- Plan around early closures

### 7.3 Watchlist Management

**Watchlist Methods:**
- `create_watchlist(name, symbols)` - Create new watchlist
- `get_watchlists()` - Get all watchlists
- `get_watchlist_by_id(watchlist_id)` - Get specific watchlist
- `update_watchlist_by_id(watchlist_id, name, symbols)` - Update watchlist
- `add_asset_to_watchlist_by_id(watchlist_id, symbol)` - Add symbol
- `remove_asset_from_watchlist_by_id(watchlist_id, symbol)` - Remove symbol
- `delete_watchlist_by_id(watchlist_id)` - Delete watchlist

**Features:**
- Track multiple symbols
- Portfolio monitoring
- Quick access to favorite assets

### 7.4 Screener API

**ScreenerClient:**
- `get_most_actives()` - Returns most active stocks

**Limitations:**
- Basic screener functionality (most actives, gainers/losers)
- Does NOT support fundamental data screening
- No earnings growth, P/E ratio, debt-to-equity ratio, etc.
- Technical/price-based screening only
- Users may need third-party tools for comprehensive screening

### 7.5 Corporate Actions API

**Supported Corporate Actions:**
- Dividends
- Stock splits (forward and reverse)
- Mergers
- Spinoffs
- Other corporate events

**Query Capabilities:**
- Search by type, symbol, or CUSIP
- Filter by date range
- Multiple date types: declaration, ex-dividend, record, payable

**Data Fields:**
- Corporate action ID
- Type and sub-type
- Initiating symbol
- Key dates
- Cash amounts
- Old and new rates (for splits)

**Note:** Paper trading does NOT simulate dividends.

---

## 8. PAPER VS LIVE TRADING

### 8.1 Paper Trading (Sandbox)

**Setup:**
- Set `paper=True` when initializing TradingClient
- Use paper trading API keys
- Base URL: `https://paper-api.alpaca.markets`
- Initial balance: $100k (configurable)

**Example:**
```python
trading_client = TradingClient('api-key', 'secret-key', paper=True)
```

**Features:**
- Free sandbox environment
- Same API spec as live trading
- Simulated order filling based on real-time quotes
- Test strategies before live deployment
- Available for all asset classes (stocks, crypto, options)

**Differences from Live:**
- Does NOT simulate dividends
- Does NOT send order fill emails
- Order quantity not checked against NBBO quantities
- Can execute orders larger than actual liquidity
- Significantly higher latency vs live trading
- Can reset account balance at any time

### 8.2 Live Trading

**Setup:**
- Set `paper=False` or omit parameter
- Use live trading API keys
- Base URL: `https://api.alpaca.markets`

**Features:**
- Real money trading
- Actual order routing to exchanges
- Real market impact
- Lower latency execution
- Commission-free equity trading
- Tiered crypto trading fees

**Switching Between Environments:**
- Separate API keys for paper and live
- Simply change keys and paper parameter
- Same code works for both environments

---

## 9. RATE LIMITS & BEST PRACTICES

### 9.1 Rate Limits

**Standard Accounts:**
- 200 requests per minute per account
- 10 requests per second burst limit
- Applies to both paper and live accounts

**Unlimited Market Data Plan ($9/month):**
- 1000 API calls per minute
- Increased rate limits for heavy usage

**HTTP Status Codes:**
- 429 - Too Many Requests (rate limited)
- 502 - Bad Gateway (retry)
- 503 - Service Unavailable (retry)
- 504 - Gateway Timeout (retry)

### 9.2 Rate Limit Handling

**SDK Features:**
- Automatic retry with exponential backoff
- Respects `Retry-After` headers
- Jitter added to prevent thundering herd
- Processes rate limit headers
- Detects 429 responses automatically

**Best Practices:**
- Monitor request frequency
- Implement client-side throttling
- Cache data when possible
- Use WebSocket streaming for real-time data (doesn't count against REST limits)
- Batch requests where possible
- Contact support@alpaca.markets to discuss higher limits

### 9.3 Authentication

**API Key Authentication:**
- API keys obtained from web dashboard
- Pass keys in HTTP headers:
  - `APCA-API-KEY-ID` - API key ID
  - `APCA-API-SECRET-KEY` - Secret key
- Separate keys for paper and live trading

**Requirements by Service:**
- Stock data: Requires authentication
- Crypto data: No authentication required (but keys increase rate limits)
- Options data: Requires authentication
- News data: No authentication required
- Trading API: Always requires authentication

---

## 10. WEBSOCKET & STREAMING CAPABILITIES

### 10.1 WebSocket Protocol

**Protocol Details:**
- Follows RFC6455 WebSocket protocol
- Supports JSON and MessagePack codecs
- Persistent connections for real-time updates
- Automatic reconnection handling

**Connection URLs:**
- Paper Trading: `wss://paper-api.alpaca.markets/stream`
- Live Trading: `wss://api.alpaca.markets/stream`
- Market Data: `wss://stream.data.alpaca.markets/v2/...`
- News: `wss://stream.data.alpaca.markets/v1beta1/news`

### 10.2 TradingStream

**Order & Account Updates:**
- Real-time order status changes
- Fill notifications
- Partial fill updates
- Order cancellation confirmations
- Account activity updates

**Use Cases:**
- Monitor order execution
- Track position changes
- React to fills immediately
- Handle order rejections

### 10.3 Market Data Streams

**StockDataStream:**
- Real-time stock quotes (bid/ask)
- Live trades
- 1-minute bars
- Subscribe to multiple symbols

**CryptoDataStream:**
- Real-time crypto quotes
- Live crypto trades
- Crypto bars
- 24/7 availability

**OptionDataStream:**
- Real-time options quotes
- Options trades
- Options bars

**NewsDataStream:**
- Real-time news feed
- Filtered by symbols
- Full news article content
- Associated symbols

### 10.4 Streaming Architecture

**Asynchronous Handlers:**
- Register callback functions for data
- Event-driven architecture
- Non-blocking operations
- Efficient for high-frequency data

**Subscription Management:**
- Subscribe to specific symbols
- Unsubscribe from symbols
- Multiple subscription types per connection
- Channel-based message routing

---

## 11. SPECIAL FEATURES & LIMITATIONS

### 11.1 Options Trading Notes

**Level 3 Trading:**
- Both paper and live supported
- Single and multi-leg strategies
- American style options only
- US equity and ETF options

**Limitations:**
- Index options coming soon (not yet available)
- Equity legs not supported in MLeg orders
- Short legs must be covered in same order
- Rolling short contracts requires workarounds

### 11.2 Crypto Trading Notes

**Advantages:**
- 24/7 trading
- No margin requirements
- Fractional trading
- No authentication for market data

**Limitations:**
- Cannot use leverage
- Cannot short
- $200k max per order
- Tiered fees (not commission-free)
- Limited time-in-force options (GTC, IOC only)

### 11.3 Extended Hours Limitations

**Requirements:**
- Only limit orders
- Only whole shares
- Must set `extended_hours=True`

**Risks:**
- Lower liquidity
- Wider spreads
- Higher volatility
- Fewer market participants

### 11.4 Paper Trading Limitations

**Not Simulated:**
- Dividends
- Order fill emails
- NBBO quantity checks
- Actual liquidity constraints

**Known Issues:**
- Much higher latency than live
- May fill orders that wouldn't fill in live
- Not a perfect simulation

---

## 12. DATA & RESPONSE FORMATS

### 12.1 Pandas Integration

**DataFrame Conversion:**
- Most responses have `.df` property
- Automatic conversion to pandas DataFrame
- Convenient for data analysis
- Time-series analysis ready

**Example:**
```python
bars = stock_client.get_stock_bars(request_params)
df = bars.df  # Convert to pandas DataFrame
```

### 12.2 Model Objects

**Pydantic Models:**
- Type-safe response objects
- Automatic validation
- IDE autocomplete support
- Clear attribute access

**Common Models:**
- `Order` - Order details
- `Position` - Position information
- `Account` - Account data
- `Trade` - Trade data
- `Quote` - Quote data
- `Bar` - OHLCV bar data
- `Snapshot` - Comprehensive snapshot
- `News` - News article

### 12.3 Request Objects

**Request Models:**
- `MarketOrderRequest`
- `LimitOrderRequest`
- `StopOrderRequest`
- `StopLimitOrderRequest`
- `TrailingStopOrderRequest`
- `GetOrdersRequest`
- `ReplaceOrderRequest`
- `GetAssetsRequest`
- `GetCalendarRequest`
- `StockBarsRequest`
- `StockTradesRequest`
- `StockQuotesRequest`
- And many more...

---

## 13. ENUMS & CONSTANTS

### 13.1 Key Enums

**OrderSide:**
- `BUY`
- `SELL`

**OrderType:**
- `MARKET`
- `LIMIT`
- `STOP`
- `STOP_LIMIT`
- `TRAILING_STOP`

**TimeInForce:**
- `DAY`
- `GTC`
- `OPG`
- `CLS`
- `IOC`
- `FOK`

**OrderClass:**
- `SIMPLE` (or empty string)
- `BRACKET`
- `OCO`
- `OTO`

**AssetClass:**
- `US_EQUITY`
- `CRYPTO`
- `OPTIONS` (inferred)

**OrderStatus:**
- `NEW`
- `PARTIALLY_FILLED`
- `FILLED`
- `DONE_FOR_DAY`
- `CANCELED`
- `EXPIRED`
- `REPLACED`
- `PENDING_CANCEL`
- `PENDING_REPLACE`
- `ACCEPTED`
- `PENDING_NEW`
- `ACCEPTED_FOR_BIDDING`
- `STOPPED`
- `REJECTED`
- `SUSPENDED`
- `CALCULATED`

---

## 14. INTEGRATION & COMPATIBILITY

### 14.1 Python Requirements

- Python 3.8 to 3.11 (< 4.0.0, >= 3.8.0)
- Latest version: v0.43.2 (November 2025)
- Installation: `pip install alpaca-py`

### 14.2 Companion Libraries

**Compatible Tools:**
- **Backtrader** - Python backtesting library for trading strategies
- **Vectorbt** - Toolkit for backtesting, algorithmic trading, and research
- **LiuAlgoTrader** - Scalable, multi-process ML-ready framework for algorithmic trading

### 14.3 Related SDKs

**Other Language SDKs:**
- C#/.NET SDK
- JavaScript/Node.js SDK
- Go SDK

**Legacy SDK:**
- `alpaca-trade-api-python` - Previous Python SDK (being replaced by alpaca-py)

---

## 15. SUMMARY OF CAPABILITIES

### 15.1 What Alpaca-py DOES Support

**Trading:**
- Equity, crypto, and options trading
- Market, limit, stop, stop-limit, trailing stop orders
- Bracket, OCO, OTO order classes
- Fractional shares and notional orders
- Extended hours trading
- Multi-leg options strategies
- Paper and live trading
- Position and account management
- Order management (submit, modify, cancel)

**Market Data:**
- Historical bars, trades, quotes (5+ years)
- Real-time streaming via WebSocket
- Snapshots and latest data
- Stock, crypto, and options data
- News data (real-time and historical)
- Market calendar and clock
- Multiple data feeds (IEX, SIP)

**Asset Management:**
- Asset search and filtering
- Watchlist creation and management
- Corporate actions data
- Basic screener (most actives)

**Infrastructure:**
- Paper trading sandbox
- Rate limit handling
- Automatic retries
- Pandas integration
- Type-safe models
- WebSocket streaming
- OAuth support

### 15.2 What Alpaca-py Does NOT Support

**Trading Limitations:**
- Margin trading for crypto (not allowed)
- Short selling crypto (not allowed)
- Multi-leg orders with equity legs
- Some advanced order types for crypto/options
- Trading outside extended hours window

**Data Limitations:**
- Fundamental data screening (no P/E, earnings, etc.)
- Level 2 market data (only Level 1 quotes)
- Index options (coming soon)
- Dividend simulation in paper trading

**Other Limitations:**
- International markets (US only)
- Forex trading
- Futures trading
- Advanced charting (use third-party tools)

---

## 16. QUICK START EXAMPLES

### 16.1 Basic Trading Setup

```python
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce

# Initialize client (paper trading)
trading_client = TradingClient('api-key', 'secret-key', paper=True)

# Check account
account = trading_client.get_account()
print(f"Buying Power: ${account.buying_power}")

# Submit market order
order_data = MarketOrderRequest(
    symbol="AAPL",
    qty=10,
    side=OrderSide.BUY,
    time_in_force=TimeInForce.DAY
)
order = trading_client.submit_order(order_data)

# Get all positions
positions = trading_client.get_all_positions()
for position in positions:
    print(f"{position.symbol}: {position.qty} shares")
```

### 16.2 Historical Data Retrieval

```python
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from datetime import datetime

# Initialize client
stock_client = StockHistoricalDataClient('api-key', 'secret-key')

# Get historical bars
request_params = StockBarsRequest(
    symbol_or_symbols=["AAPL", "TSLA"],
    timeframe=TimeFrame.Day,
    start=datetime(2024, 1, 1),
    end=datetime(2024, 12, 31)
)
bars = stock_client.get_stock_bars(request_params)

# Convert to DataFrame
df = bars.df
print(df.head())
```

### 16.3 Real-Time Streaming

```python
from alpaca.data.live import StockDataStream

# Initialize stream client
stream = StockDataStream('api-key', 'secret-key')

# Define handler for trades
async def trade_handler(data):
    print(f"Trade: {data.symbol} @ ${data.price}")

# Subscribe to trades
stream.subscribe_trades(trade_handler, "AAPL")

# Run stream
stream.run()
```

---

## 17. ADDITIONAL RESOURCES

### Documentation
- Official Docs: https://alpaca.markets/sdks/python/getting_started.html
- API Reference: https://alpaca.markets/sdks/python/api_reference/
- GitHub Repo: https://github.com/alpacahq/alpaca-py
- PyPI Page: https://pypi.org/project/alpaca-py/

### Community
- Alpaca Community Forum: https://forum.alpaca.markets/
- GitHub Issues: https://github.com/alpacahq/alpaca-py/issues
- Support Email: support@alpaca.markets

### Learning Resources
- Alpaca Learn: https://alpaca.markets/learn/
- Example Notebooks: https://github.com/alpacahq/alpaca-py/tree/master/examples
- Sentiment Analysis with News API: https://alpaca.markets/learn/sentiment-analysis-with-news-api-and-transformers
- Options Trading Guide: https://alpaca.markets/learn/how-to-trade-options-with-alpaca

---

## SOURCES

This comprehensive analysis was compiled from the following sources:

### Primary Documentation
- [Alpaca-py Official Documentation](https://alpaca.markets/sdks/python/)
- [Alpaca-py GitHub Repository](https://github.com/alpacahq/alpaca-py)
- [Alpaca-py Getting Started Guide](https://alpaca.markets/sdks/python/getting_started.html)
- [Alpaca API Documentation](https://docs.alpaca.markets/)

### Trading Features
- [Alpaca-py Trading Documentation](https://alpaca.markets/sdks/python/trading.html)
- [Orders API Reference](https://alpaca.markets/sdks/python/api_reference/trading/orders.html)
- [Positions API Reference](https://alpaca.markets/sdks/python/api_reference/trading/positions.html)
- [Placing Orders - Alpaca Docs](https://docs.alpaca.markets/docs/orders-at-alpaca)
- [Working with Orders](https://docs.alpaca.markets/docs/working-with-orders)
- [13 Order Types You Should Know](https://alpaca.markets/learn/13-order-types-you-should-know-about)

### Market Data
- [Market Data API Documentation](https://alpaca.markets/sdks/python/market_data.html)
- [Historical Data Reference](https://alpaca.markets/sdks/python/api_reference/data/stock/historical.html)
- [Real-time Stock Data](https://docs.alpaca.markets/docs/real-time-stock-pricing-data)
- [WebSocket Streaming](https://docs.alpaca.markets/docs/streaming-market-data)
- [Understanding Market Data API](https://alpaca.markets/learn/understanding-alpacas-market-data-api-with-pandas-and-plotly)

### Crypto Trading
- [Crypto Trading Documentation](https://docs.alpaca.markets/docs/crypto-trading)
- [Crypto Orders](https://docs.alpaca.markets/docs/crypto-orders)
- [Getting Started with Crypto API](https://alpaca.markets/learn/getting-started-with-alpaca-crypto-api)

### Options Trading
- [Options Trading with Alpaca](https://alpaca.markets/learn/how-to-trade-options-with-alpaca)
- [Options Level 3 Trading](https://docs.alpaca.markets/docs/options-level-3-trading)
- [Multi-leg Options Trading](https://docs.alpaca.markets/changelog/multi-leg-level-3-options-trading-in-paper)
- [Multi-leg Options Example Notebook](https://github.com/alpacahq/alpaca-py/blob/master/examples/options-trading-mleg.ipynb)

### Paper vs Live Trading
- [Paper Trading Documentation](https://docs.alpaca.markets/docs/paper-trading)
- [Paper Trading vs Live Trading Guide](https://alpaca.markets/learn/paper-trading-vs-live-trading-a-data-backed-guide-on-when-to-start-trading-real-money)

### Rate Limits & Best Practices
- [API Rate Limits](https://alpaca.markets/support/usage-limit-api-calls)
- [Rate Limiting Forum Discussion](https://forum.alpaca.markets/t/rate-limit-clarity/7202)

### Additional Features
- [Clock API](https://alpaca.markets/sdks/python/api_reference/trading/clock.html)
- [Calendar API](https://alpaca.markets/sdks/python/api_reference/trading/calendar.html)
- [Assets API](https://alpaca.markets/sdks/python/api_reference/trading/assets.html)
- [Working with Assets](https://docs.alpaca.markets/docs/working-with-assets)
- [Fractional Trading](https://docs.alpaca.markets/docs/fractional-trading)
- [Extended Hours Trading](https://alpaca.markets/support/extended-hours-trading)
- [Corporate Actions API](https://alpaca.markets/blog/introducing-corporate-actions-api-announcements/)
- [Real-time News](https://docs.alpaca.markets/docs/streaming-real-time-news)
- [Historical News Data](https://docs.alpaca.markets/docs/historical-news-data)
- [Screener API](https://alpaca.markets/sdks/python/api_reference/data/stock/screener.html)

---

**Document Version**: 1.0
**Last Updated**: December 22, 2025
**Alpaca-py Version Covered**: 0.43.2
