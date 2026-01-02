# Market Data Capability

## Purpose

Multi-source market data aggregation system providing real-time quotes, historical OHLCV data, market news, cryptocurrency prices, and user watchlists. Integrates with Alpaca (equities), Finnhub (stocks), CoinGecko (crypto), and NewsAPI for comprehensive market coverage.

## Requirements

### Requirement: Real-time Quote Retrieval

The system SHALL provide real-time market quotes for equities with price, volume, and bid/ask data.

#### Scenario: Single symbol quote retrieval

- **WHEN** a user requests a quote for a valid stock symbol
- **THEN** the system SHALL return current price, daily high/low, volume, and open price
- **AND** include change amount and change percentage from previous close
- **AND** return HTTP 200 with quote data

#### Scenario: Multiple symbols quote retrieval

- **WHEN** a user requests quotes for multiple symbols (comma-separated)
- **THEN** the system SHALL fetch snapshots from Alpaca for all symbols
- **AND** calculate change percentage from previous daily bar
- **AND** return HTTP 200 with map of symbol to quote data

#### Scenario: Invalid symbol

- **WHEN** a user requests a quote for a non-existent symbol
- **THEN** the system SHALL return null price and change values
- **AND** include the symbol in the response
- **AND** return HTTP 200 (partial success)

#### Scenario: Missing symbols parameter

- **WHEN** a user requests market quotes without symbols parameter
- **THEN** the system SHALL reject the request with HTTP 400 Bad Request
- **AND** return error message "symbols parameter required"

### Requirement: Historical OHLCV Data Queries

The system SHALL provide historical price data with customizable date ranges and timeframes.

#### Scenario: Daily candles retrieval

- **WHEN** a user requests candles for a symbol with resolution "D"
- **THEN** the system SHALL fetch daily OHLCV data from Finnhub
- **AND** include open, high, low, close, volume, and timestamp for each period
- **AND** return HTTP 200 with candles array

#### Scenario: Intraday candles with date range

- **WHEN** a user requests candles with from/to timestamps and resolution (1, 5, 15, 30, 60 minutes)
- **THEN** the system SHALL fetch intraday OHLCV data for the specified period
- **AND** limit results to the requested timeframe
- **AND** return HTTP 200 with candles array

#### Scenario: Cryptocurrency chart data

- **WHEN** a user requests crypto chart data for a coin ID
- **THEN** the system SHALL fetch price history from CoinGecko
- **AND** support days parameter (1, 7, 30, 90, 365)
- **AND** return HTTP 200 with timestamps and prices array

### Requirement: Market News Feed Retrieval

The system SHALL aggregate financial news from multiple sources with category filtering.

#### Scenario: Top headlines by category

- **WHEN** a user requests news headlines with category filter
- **THEN** the system SHALL fetch top headlines from NewsAPI
- **AND** support categories: business, technology, general
- **AND** include country filter (default: "us")
- **AND** return HTTP 200 with articles array (max pageSize: 20)

#### Scenario: Market-specific news

- **WHEN** a user requests market news endpoint
- **THEN** the system SHALL fetch business and financial market news
- **AND** return articles sorted by relevance and recency
- **AND** return HTTP 200 with articles array

#### Scenario: Cryptocurrency news

- **WHEN** a user requests crypto news endpoint
- **THEN** the system SHALL search for cryptocurrency-related articles
- **AND** filter by crypto keywords and topics
- **AND** return HTTP 200 with articles array

### Requirement: News Filtering by Symbol

The system SHALL provide symbol-specific news filtering for targeted research.

#### Scenario: Stock-specific news retrieval

- **WHEN** a user requests news for a specific stock symbol
- **THEN** the system SHALL fetch news articles mentioning that symbol
- **AND** limit results to pageSize parameter (default: 10)
- **AND** return HTTP 200 with filtered articles

#### Scenario: News search by query

- **WHEN** a user provides a search query string
- **THEN** the system SHALL search news articles matching the query
- **AND** support sortBy parameter: relevancy, popularity, publishedAt
- **AND** return HTTP 200 with matching articles

#### Scenario: Missing search query

- **WHEN** a user attempts news search without query parameter
- **THEN** the system SHALL reject the request with HTTP 400 Bad Request
- **AND** return error message "Search query required"

### Requirement: Watchlist CRUD Operations

Users SHALL be able to create, read, update, and delete watchlists with symbol tracking.

#### Scenario: Create new watchlist

- **WHEN** an authenticated user creates a watchlist with name and optional description
- **THEN** the system SHALL create watchlist record owned by the user
- **AND** support isDefault flag to mark as default watchlist
- **AND** unset any existing default if new one is marked default
- **AND** return HTTP 201 with watchlist data and empty symbols array

#### Scenario: List user watchlists

- **WHEN** an authenticated user requests their watchlists
- **THEN** the system SHALL fetch all watchlists for the user
- **AND** include symbols for each watchlist
- **AND** order by sortOrder and createdAt
- **AND** return HTTP 200 with watchlists array

#### Scenario: Update watchlist details

- **WHEN** an authenticated user updates a watchlist they own
- **THEN** the system SHALL validate ownership before update
- **AND** allow updating name, description, isDefault, and sortOrder
- **AND** update updatedAt timestamp
- **AND** return HTTP 200 with updated watchlist

#### Scenario: Delete watchlist

- **WHEN** an authenticated user deletes a watchlist they own
- **THEN** the system SHALL validate ownership
- **AND** cascade delete all associated symbols
- **AND** return HTTP 200 with success confirmation

#### Scenario: Watchlist not found

- **WHEN** a user attempts to access a non-existent or unauthorized watchlist
- **THEN** the system SHALL return HTTP 404 Not Found
- **AND** return error message "Watchlist not found"

### Requirement: Watchlist Symbol Management

Users SHALL be able to add, update, and remove symbols from watchlists with metadata.

#### Scenario: Add symbol to watchlist

- **WHEN** an authenticated user adds a symbol to their watchlist
- **THEN** the system SHALL uppercase the symbol
- **AND** check for duplicate symbols in the watchlist
- **AND** support optional notes and tags metadata
- **AND** return HTTP 201 with symbol data

#### Scenario: Duplicate symbol detection

- **WHEN** a user attempts to add a symbol already in the watchlist
- **THEN** the system SHALL reject the request with HTTP 409 Conflict
- **AND** return error message "Symbol already in watchlist"

#### Scenario: Update symbol metadata

- **WHEN** an authenticated user updates a symbol in their watchlist
- **THEN** the system SHALL allow updating notes, tags, and sortOrder
- **AND** validate watchlist ownership
- **AND** return HTTP 200 with updated symbol data

#### Scenario: Remove symbol from watchlist

- **WHEN** an authenticated user removes a symbol from their watchlist
- **THEN** the system SHALL validate watchlist ownership
- **AND** delete the symbol record
- **AND** return HTTP 200 with success confirmation

### Requirement: Stock Quote Endpoints

The system SHALL provide comprehensive stock market data access for equities.

#### Scenario: Company profile retrieval

- **WHEN** a user requests a company profile for a stock symbol
- **THEN** the system SHALL fetch company information from Finnhub
- **AND** include name, exchange, market cap, and sector data
- **AND** return HTTP 200 with profile data

#### Scenario: Stock symbol search

- **WHEN** a user searches for stocks by query string
- **THEN** the system SHALL search symbols from Finnhub
- **AND** return matching symbols with exchange information
- **AND** require non-empty query parameter
- **AND** return HTTP 200 with search results

#### Scenario: Missing search query for stocks

- **WHEN** a user attempts stock search without query parameter
- **THEN** the system SHALL reject with HTTP 400 Bad Request
- **AND** return error message "Search query required"

### Requirement: Crypto Quote Endpoints

The system SHALL provide cryptocurrency market data from CoinGecko.

#### Scenario: Crypto markets listing

- **WHEN** a user requests cryptocurrency markets list
- **THEN** the system SHALL fetch from CoinGecko with pagination
- **AND** support per_page (default: 20), page (default: 1), and order parameters
- **AND** order options: market_cap_desc, volume_desc, price_desc
- **AND** return HTTP 200 with markets array

#### Scenario: Multiple crypto prices

- **WHEN** a user requests prices for multiple coins by IDs
- **THEN** the system SHALL fetch simple prices from CoinGecko
- **AND** default to "bitcoin,ethereum,solana" if no IDs provided
- **AND** return HTTP 200 with coin ID to price mapping

#### Scenario: Trending cryptocurrencies

- **WHEN** a user requests trending coins
- **THEN** the system SHALL fetch trending data from CoinGecko
- **AND** return top trending coins with rank and metadata
- **AND** return HTTP 200 with trending array

#### Scenario: Global crypto market stats

- **WHEN** a user requests global cryptocurrency market data
- **THEN** the system SHALL fetch market cap, volume, and dominance stats
- **AND** include active cryptocurrencies count
- **AND** return HTTP 200 with global market data

#### Scenario: Crypto search by query

- **WHEN** a user searches for cryptocurrencies by query
- **THEN** the system SHALL search CoinGecko coins by name/symbol
- **AND** require non-empty query parameter
- **AND** return HTTP 200 with matching coins

### Requirement: Market Hours Verification

The system SHALL provide market status and trading hours information.

#### Scenario: Market hours check (via Alpaca)

- **WHEN** the system checks if markets are currently open
- **THEN** it SHALL query Alpaca clock endpoint
- **AND** return current time, next open, next close timestamps
- **AND** indicate if market is currently open (boolean)

#### Scenario: Market calendar retrieval

- **WHEN** the system queries market calendar for a date range
- **THEN** it SHALL return trading days and market holidays
- **AND** include open and close times for each trading day

### Requirement: Data Caching and Freshness

The system SHALL cache external API responses to optimize quota usage and reduce latency.

#### Scenario: Cache hit for recent data

- **WHEN** a request is made for data cached within expiration window
- **THEN** the system SHALL return cached data without external API call
- **AND** increment cache hit counter
- **AND** update lastAccessedAt timestamp

#### Scenario: Stale-while-revalidate behavior

- **WHEN** cached data is stale but within revalidation window
- **THEN** the system SHALL return stale data immediately
- **AND** trigger background refresh of the cache
- **AND** update cache with fresh data asynchronously

#### Scenario: Cache miss

- **WHEN** requested data is not in cache or fully expired
- **THEN** the system SHALL fetch from external API
- **AND** store response in cache with expiration timestamp
- **AND** increment cache miss counter
- **AND** track provider usage for quota management

## Security

### Authentication Requirements

All market data endpoints MUST require authentication via session cookie, except for:

- Public documentation endpoints
- Health check endpoints

Watchlist endpoints MUST enforce user ownership validation before any CRUD operation.

### Rate Limiting

External API providers have rate limits that MUST be enforced:

- **Alpaca**: 200 requests per minute (enforced by rate limiter)
- **Finnhub**: Provider-specific limits (varies by tier)
- **CoinGecko**: 10-50 calls/minute (varies by tier)
- **NewsAPI**: 100 requests per day (free tier)

### Data Validation

All symbol inputs MUST be:

- Uppercase normalized
- Validated against allowed character set (A-Z, 0-9, -, /, .)
- Maximum length: 20 characters

Query parameters MUST be sanitized to prevent injection attacks.

### Session Validation

Watchlist endpoints MUST:

- Verify session cookie validity
- Extract userId from session
- Validate user owns the watchlist before any operation
- Return HTTP 401 Unauthorized for missing/invalid sessions

## API Endpoints

| Method | Path                                | Auth Required | Description                           |
| ------ | ----------------------------------- | ------------- | ------------------------------------- |
| GET    | /api/market/quotes                  | Yes           | Real-time quotes for multiple symbols |
| GET    | /api/stock/quote/:symbol            | Yes           | Single stock quote                    |
| GET    | /api/stock/quotes                   | Yes           | Multiple stock quotes                 |
| GET    | /api/stock/candles/:symbol          | Yes           | Historical OHLCV data                 |
| GET    | /api/stock/profile/:symbol          | Yes           | Company profile                       |
| GET    | /api/stock/search                   | Yes           | Search stock symbols                  |
| GET    | /api/stock/news                     | Yes           | Stock market news                     |
| GET    | /api/crypto/markets                 | Yes           | Cryptocurrency markets                |
| GET    | /api/crypto/prices                  | Yes           | Crypto prices for multiple coins      |
| GET    | /api/crypto/chart/:coinId           | Yes           | Crypto price chart history            |
| GET    | /api/crypto/trending                | Yes           | Trending cryptocurrencies             |
| GET    | /api/crypto/global                  | Yes           | Global crypto market stats            |
| GET    | /api/crypto/search                  | Yes           | Search cryptocurrencies               |
| GET    | /api/news/headlines                 | Yes           | Top news headlines                    |
| GET    | /api/news/search                    | Yes           | Search news articles                  |
| GET    | /api/news/market                    | Yes           | Market-related news                   |
| GET    | /api/news/crypto                    | Yes           | Cryptocurrency news                   |
| GET    | /api/news/stock/:symbol             | Yes           | Symbol-specific news                  |
| GET    | /api/watchlists                     | Yes           | List all user watchlists              |
| POST   | /api/watchlists                     | Yes           | Create new watchlist                  |
| GET    | /api/watchlists/:id                 | Yes           | Get specific watchlist                |
| PUT    | /api/watchlists/:id                 | Yes           | Update watchlist                      |
| DELETE | /api/watchlists/:id                 | Yes           | Delete watchlist                      |
| POST   | /api/watchlists/:id/symbols         | Yes           | Add symbol to watchlist               |
| PUT    | /api/watchlists/:id/symbols/:symbol | Yes           | Update symbol in watchlist            |
| DELETE | /api/watchlists/:id/symbols/:symbol | Yes           | Remove symbol from watchlist          |

## Database Schema

### watchlists table

- `id` (varchar, primary key) - Unique watchlist identifier
- `user_id` (varchar, foreign key → users.id, cascade delete) - Watchlist owner
- `name` (text, not null) - Watchlist name
- `description` (text, nullable) - Optional description
- `is_default` (boolean, default false) - Default watchlist flag
- `sort_order` (integer, default 0) - Display order
- `created_at` (timestamp, not null) - Creation timestamp
- `updated_at` (timestamp, not null) - Last update timestamp

### watchlist_symbols table

- `id` (varchar, primary key) - Unique symbol entry identifier
- `watchlist_id` (varchar, foreign key → watchlists.id, cascade delete) - Parent watchlist
- `symbol` (text, not null) - Stock/crypto ticker symbol
- `notes` (text, nullable) - User notes about symbol
- `tags` (text, nullable) - Comma-separated tags
- `sort_order` (integer, default 0) - Display order
- `added_at` (timestamp, not null) - When symbol was added

### macro_indicators table (cache)

- `id` (varchar, primary key) - Unique indicator ID
- `indicator_id` (text, unique, not null) - External indicator identifier
- `name` (text, not null) - Indicator name
- `category` (text, not null, indexed) - Economic category
- `latest_value` (numeric) - Current value
- `previous_value` (numeric) - Previous period value
- `change_percent` (numeric) - Percentage change
- `frequency` (text) - Update frequency
- `last_updated_at` (timestamp, not null) - Cache timestamp
- `source` (text, default "FRED") - Data source
- `raw_json` (jsonb) - Full API response

### external_api_cache_entries table

- `id` (varchar, primary key) - Cache entry ID
- `provider` (text, not null) - API provider name
- `cache_key` (text, not null) - Unique cache key
- `response_json` (text, not null) - Cached response
- `expires_at` (timestamp, not null) - Hard expiration
- `stale_until_at` (timestamp, not null) - Stale-while-revalidate threshold
- `created_at` (timestamp, not null) - Entry creation time
- `updated_at` (timestamp, not null) - Last refresh time
- `hit_count` (integer, default 0) - Cache hit counter
- `last_accessed_at` (timestamp, not null) - Last access time

### external_api_usage_counters table

- `id` (varchar, primary key) - Counter ID
- `provider` (text, not null) - API provider name
- `window_type` (text, not null) - Time window (hourly, daily, monthly)
- `window_start` (timestamp, not null) - Window start time
- `window_end` (timestamp, not null) - Window end time
- `request_count` (integer, default 0) - Total requests
- `token_count` (integer) - Token usage (for LLM providers)
- `error_count` (integer, default 0) - Failed requests
- `rate_limit_hits` (integer, default 0) - Rate limit violations
- `cache_hits` (integer, default 0) - Cache hits
- `cache_misses` (integer, default 0) - Cache misses
- `avg_latency_ms` (numeric) - Average response time
- `created_at` (timestamp, not null) - Counter creation
- `updated_at` (timestamp, not null) - Last update

## Error Handling

All market data endpoints MUST use standardized error responses:

**400 Bad Request**: Invalid parameters or validation errors

- Missing required query parameters (symbols, query)
- Invalid date range or resolution
- Malformed input data

**401 Unauthorized**: Authentication required or session invalid

- Missing session cookie
- Expired session
- Invalid session token

**404 Not Found**: Resource does not exist

- Watchlist ID not found
- User does not own the watchlist
- Symbol not found in watchlist

**409 Conflict**: Resource already exists

- Duplicate symbol in watchlist
- Duplicate watchlist name for user

**500 Internal Server Error**: External API failure or database error

- Alpaca/Finnhub/CoinGecko API failure
- Database connection error
- Rate limiter exhaustion

Error response format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable description",
  "statusCode": 400,
  "details": [{ "field": "symbols", "message": "symbols parameter required" }]
}
```

## Data Providers

### Alpaca Markets

- **Purpose**: Real-time equity quotes, market snapshots, historical bars
- **Authentication**: API key + secret key
- **Rate Limit**: 200 requests/minute
- **Base URL**: https://paper-api.alpaca.markets (paper trading) or https://api.alpaca.markets (live)
- **Data URL**: https://data.alpaca.markets

### Finnhub

- **Purpose**: Stock quotes, company profiles, candles, market news
- **Authentication**: API key
- **Rate Limit**: Varies by tier (60/min free tier)
- **Base URL**: https://finnhub.io/api/v1

### CoinGecko

- **Purpose**: Cryptocurrency prices, markets, trending coins, global stats
- **Authentication**: API key (optional for free tier)
- **Rate Limit**: 10-50 calls/minute depending on tier
- **Base URL**: https://api.coingecko.com/api/v3

### NewsAPI

- **Purpose**: Financial news, headlines, article search
- **Authentication**: API key
- **Rate Limit**: 100 requests/day (free tier), 1000/day (developer tier)
- **Base URL**: https://newsapi.org/v2

## Dependencies

- `drizzle-orm` - Database ORM
- `zod` - Input validation
- `express-rate-limit` - Rate limiting
- Connectors:
  - `server/connectors/alpaca.ts` - Alpaca API client
  - `server/connectors/finnhub.ts` - Finnhub API client
  - `server/connectors/coingecko.ts` - CoinGecko API client
  - `server/connectors/newsapi.ts` - NewsAPI client

## Files

**Routes**:

- `server/routes/market-data.ts` - Main market data router
- `server/routes/market-quotes.ts` - Real-time quote endpoints
- `server/routes/stock.ts` - Stock-specific endpoints
- `server/routes/crypto.ts` - Cryptocurrency endpoints
- `server/routes/news.ts` - News aggregation endpoints
- `server/routes/watchlists.ts` - Watchlist CRUD endpoints

**Schema**:

- `shared/schema/market-data.ts` - Cache and usage tracking tables
- `shared/schema/watchlist.ts` - Watchlist and symbol tables

**Connectors**:

- `server/connectors/alpaca.ts` - Alpaca integration
- `server/connectors/finnhub.ts` - Finnhub integration
- `server/connectors/coingecko.ts` - CoinGecko integration
- `server/connectors/newsapi.ts` - NewsAPI integration

**Middleware**:

- `server/middleware/requireAuth.ts` - Authentication middleware
- `server/lib/rateLimiter.ts` - Rate limiting
- `server/lib/circuitBreaker.ts` - Circuit breaker for external APIs
