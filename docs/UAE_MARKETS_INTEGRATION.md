# UAE Markets Integration Guide

## Overview

The UAE Markets connector provides real-time and historical market data for the Abu Dhabi Securities Exchange (ADX) and Dubai Financial Market (DFM). The connector supports both live data via Dubai Pulse Open API and demo/fallback data.

## Features

- **Live DFM Index Data** via Dubai Pulse Open API (free tier)
- **Demo Data Fallback** for ADX and when API is not configured
- **Intelligent Caching** with fresh/stale duration management
- **Automatic Status Detection** - Shows "LIVE" or "BETA/DEMO" based on data source
- **Graceful Degradation** - Falls back to demo data on API failures

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Dubai Pulse Open API Key (free tier)
# Get your API key: https://datahub.dubaipulse.gov.ae/
UAE_MARKETS_API_KEY=your_api_key_here

# Optional: Force demo mode even if API key is configured
UAE_MARKETS_USE_DEMO=false
```

### Getting an API Key

1. Visit [Dubai Pulse Data Hub](https://datahub.dubaipulse.gov.ae/)
2. Create an account or sign in
3. Navigate to the DFM Indices API
4. Request API access (free tier available)
5. Copy your API key to the `.env` file

## API Endpoints

### Get Market Summary

```typescript
GET /api/market/uae/summary?exchange=DFM

Response:
{
  "summaries": [
    {
      "exchange": "DFM",
      "indexName": "DFM General Index",
      "indexValue": 4285.67,
      "change": -12.35,
      "changePercent": -0.29,
      "tradingValue": 890000000,
      "tradingVolume": 195000000,
      "advancers": 22,
      "decliners": 28,
      "unchanged": 12,
      "lastUpdated": "2025-12-23T15:30:00.000Z"
    }
  ]
}
```

### Get Top Stocks

```typescript
GET /api/market/uae/stocks?exchange=DFM

Response:
{
  "stocks": [
    {
      "symbol": "EMAAR",
      "name": "Emaar Properties",
      "exchange": "DFM",
      "sector": "Real Estate",
      "currentPrice": 9.15,
      "change": 0.25,
      "changePercent": 2.81,
      "volume": 22000000,
      "marketCap": 80000000000,
      "currency": "AED",
      "lastUpdated": "2025-12-23T15:30:00.000Z"
    }
    // ... more stocks
  ]
}
```

### Get Market Info

```typescript
GET /api/market/uae/info

Response:
{
  "exchanges": {
    "ADX": {
      "name": "ADX",
      "fullName": "Abu Dhabi Securities Exchange",
      "website": "https://www.adx.ae",
      "currency": "AED",
      "timezone": "GST (UTC+4)",
      "tradingHours": "10:00 AM - 2:00 PM (Sun-Thu)",
      "established": 2000
    },
    "DFM": { /* ... */ }
  },
  "apiProviders": [
    {
      "name": "Dubai Pulse Open API",
      "type": "free",
      "coverage": ["DFM"],
      "features": ["DFM Indices", "Market Summary", "OAuth Authentication"],
      "url": "https://www.dubaipulse.gov.ae/data/dfm-general/dfm_indices-open-api"
    }
    // ... more providers
  ]
}
```

### Get Connection Status

```typescript
GET /api/market/uae/status

Response:
{
  "connected": true,
  "dataSource": "live",  // or "demo"
  "cacheSize": 5,
  "isMockData": false,
  "isDemoData": false,
  "apiCallCount": 42,
  "lastApiCall": "2025-12-23T15:30:00.000Z",
  "apiConfigured": true
}
```

## Usage Examples

### Basic Usage (TypeScript/JavaScript)

```typescript
import { uaeMarkets } from "./server/connectors/uae-markets";

// Get DFM market summary
const dfmSummary = await uaeMarkets.getMarketSummary("DFM");
console.log(`DFM Index: ${dfmSummary[0].indexValue}`);
console.log(`Change: ${dfmSummary[0].changePercent}%`);

// Get all market summaries (ADX + DFM)
const allSummaries = await uaeMarkets.getMarketSummary();

// Get top stocks for DFM
const dfmStocks = await uaeMarkets.getTopStocks("DFM");

// Get connection status
const status = uaeMarkets.getConnectionStatus();
if (status.dataSource === "live") {
  console.log("Using live data from Dubai Pulse API");
} else {
  console.log("Using demo data (configure UAE_MARKETS_API_KEY for live data)");
}

// Clear cache (force fresh data on next request)
uaeMarkets.clearCache();
```

### React Component Example

```tsx
import { useEffect, useState } from 'react';

function UAEMarketSummary() {
  const [summary, setSummary] = useState(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // Get DFM summary
      const response = await fetch('/api/market/uae/summary?exchange=DFM');
      const data = await response.json();
      setSummary(data.summaries[0]);

      // Check if using live data
      const statusResponse = await fetch('/api/market/uae/status');
      const status = await statusResponse.json();
      setIsLive(status.dataSource === 'live');
    }

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (!summary) return <div>Loading...</div>;

  return (
    <div>
      <div className="status-badge">
        {isLive ? 'LIVE' : 'DEMO'}
      </div>
      <h2>{summary.indexName}</h2>
      <div className="index-value">{summary.indexValue.toFixed(2)}</div>
      <div className={summary.change >= 0 ? 'positive' : 'negative'}>
        {summary.change >= 0 ? '+' : ''}{summary.changePercent.toFixed(2)}%
      </div>
      <div className="stats">
        <span>Volume: {(summary.tradingVolume / 1e6).toFixed(1)}M</span>
        <span>Value: {(summary.tradingValue / 1e9).toFixed(2)}B AED</span>
      </div>
    </div>
  );
}
```

## Data Sources

### Live Data (Dubai Pulse API)

When `UAE_MARKETS_API_KEY` is configured:

- **Provider**: Dubai Pulse Open API (Government of Dubai)
- **Coverage**: DFM market indices and summary data
- **Update Frequency**: Real-time during market hours
- **Rate Limits**: Per free tier agreement
- **Cost**: Free tier available

### Demo Data

When API key is not configured or as fallback:

- **Coverage**: Both ADX and DFM
- **Data**: Representative sample data based on actual market structure
- **Update Frequency**: Static/simulated
- **Use Cases**: Development, testing, demonstrations

## Technical Details

### Caching Strategy

```typescript
// Fresh cache duration: 60 seconds
// Stale cache duration: 30 minutes

// Cache automatically refreshes when:
// 1. Data is older than 60 seconds (fresh duration)
// 2. Data is requested after stale duration
```

### Data Flow

```
┌─────────────────┐
│   API Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      Yes      ┌──────────────┐
│  Cache Fresh?   │ ─────────────▶│ Return Cache │
└────────┬────────┘                └──────────────┘
         │ No
         ▼
┌─────────────────┐      Yes      ┌──────────────┐
│ API Key Set?    │ ─────────────▶│  Fetch Live  │
└────────┬────────┘                │  Dubai Pulse │
         │ No                      └──────┬───────┘
         │                                │
         ▼                                ▼
┌─────────────────┐                ┌──────────────┐
│ Generate Demo   │                │ Update Cache │
│     Data        │                └──────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Update Cache   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return to User  │
└─────────────────┘
```

### Error Handling

The connector implements graceful degradation:

1. **API Request Fails**: Falls back to demo data
2. **Invalid Response**: Falls back to demo data
3. **Timeout (10s)**: Falls back to demo data
4. **Rate Limit**: Uses cached data or demo data

All errors are logged but don't crash the application.

## API Provider Information

### Dubai Pulse Open API

- **Type**: Free tier available
- **Coverage**: DFM only
- **Features**:
  - DFM General Index
  - Market summary data
  - OAuth authentication
  - Historical data access
- **Documentation**: https://datahub.dubaipulse.gov.ae/

### Alternative Providers (Premium)

For more comprehensive data, consider:

1. **DFM Native API**
   - Coverage: DFM
   - Format: SOAP/XML
   - Features: Real-time prices, market summary
   - URL: https://api.dfm.ae

2. **Twelve Data**
   - Coverage: ADX + DFM
   - Features: REST API, real-time & historical, analyst ratings
   - URL: https://twelvedata.com

3. **ICE Data Services**
   - Coverage: ADX + DFM
   - Features: Native & normalized feed, Level 1 & 2, historical
   - URL: https://developer.ice.com

4. **LSEG (Refinitiv)**
   - Coverage: ADX + DFM
   - Features: Low latency, market depth, full tick history
   - URL: https://www.lseg.com

## Supported Stocks

### ADX (Abu Dhabi Securities Exchange)

- **ADNOCDIST** - ADNOC Distribution (Energy)
- **ETISALAT** - Emirates Telecommunications (Telecom)
- **FAB** - First Abu Dhabi Bank (Financials)
- **ADCB** - Abu Dhabi Commercial Bank (Financials)
- **ALDAR** - Aldar Properties (Real Estate)

### DFM (Dubai Financial Market)

- **EMAAR** - Emaar Properties (Real Estate)
- **DIB** - Dubai Islamic Bank (Financials)
- **EMIRATESNBD** - Emirates NBD (Financials)
- **DU** - Emirates Integrated Telecommunications (Telecom)
- **DEWA** - Dubai Electricity & Water Authority (Utilities)

## Trading Hours

UAE stock exchanges operate:
- **Days**: Sunday to Thursday
- **Hours**: 10:00 AM - 2:00 PM GST (UTC+4)
- **Closed**: Friday and Saturday (weekend)
- **Timezone**: Gulf Standard Time (GST, UTC+4)

## Regulatory Information

- **Regulator**: UAE Securities and Commodities Authority (SCA)
- **Currency**: AED (United Arab Emirates Dirham)
- **Notable**: First exchange globally to operate under Islamic Sharia principles (DFM)

## Migration from Mock to Live Data

### Step 1: Get API Key

1. Sign up at https://datahub.dubaipulse.gov.ae/
2. Request API access for DFM Indices
3. Copy API key

### Step 2: Configure Environment

```bash
# Add to .env
UAE_MARKETS_API_KEY=your_key_here
```

### Step 3: Restart Application

```bash
npm run dev  # or your start command
```

### Step 4: Verify Live Data

```bash
curl http://localhost:5000/api/market/uae/status

# Should return:
# { "dataSource": "live", "apiConfigured": true, ... }
```

## Troubleshooting

### Issue: Still showing demo data

**Solution**:
1. Verify `UAE_MARKETS_API_KEY` is set in `.env`
2. Check `UAE_MARKETS_USE_DEMO` is not set to `true`
3. Restart the application
4. Check logs for API errors

### Issue: API request timeout

**Solution**:
1. Check internet connectivity
2. Verify API key is valid
3. Check Dubai Pulse API status
4. Application will automatically fall back to demo data

### Issue: Rate limit exceeded

**Solution**:
1. Reduce request frequency
2. Leverage built-in caching (60s fresh duration)
3. Consider upgrading to premium API tier

## Monitoring

Check connector health via status endpoint:

```bash
# Check if using live or demo data
curl http://localhost:5000/api/market/uae/status

# Monitor API call count
# Useful for tracking API usage against rate limits
```

## Best Practices

1. **Use caching**: Don't clear cache unnecessarily
2. **Handle both modes**: Design UI to work with live and demo data
3. **Show data source**: Display "LIVE" or "DEMO" badge to users
4. **Error resilience**: Always handle API failures gracefully
5. **Rate limiting**: Respect API rate limits
6. **Monitor usage**: Track API call counts

## Future Enhancements

Potential improvements:

- ADX live data integration (requires premium API)
- Individual stock price data (requires DFM Native API or premium provider)
- WebSocket support for real-time streaming
- Historical data endpoints
- Sector performance analysis
- Market depth/order book data (requires Level 2 feed)

## Support

For issues or questions:
- Check logs in console for error messages
- Review API status at https://datahub.dubaipulse.gov.ae/
- File issues in project repository
