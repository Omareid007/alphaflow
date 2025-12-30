# Research Flow

> **Path:** `/app/research/page.tsx`
> **Route:** `/research`

## Overview

The Research page provides watchlist management and real-time market data for stock and cryptocurrency research. Users can create multiple watchlists, add symbols, track price changes, and identify trading-eligible securities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Research Page                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Watchlist Tabs                          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───┐            │  │
│  │  │ Watchlist│ │ Watchlist│ │ Watchlist│ │ + │            │  │
│  │  │    #1    │ │    #2    │ │    #3    │ │   │            │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┘            │  │
│  │       │            │            │                          │  │
│  │       └────────────┴────────────┴──────► useWatchlists     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Summary Stats                         │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │    │
│  │  │ Top Gainer  │ │  Top Loser  │ │  Eligible   │        │    │
│  │  │ NVDA +4.2%  │ │ META -1.8%  │ │    12/16    │        │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────────────────────────────┐│
│  │   Search Bar    │ │            Add Symbol Button             ││
│  │  [🔍 Search...] │ │  [+ Add Symbol] → AddSymbolDialog        ││
│  └─────────────────┘ └─────────────────────────────────────────┘│
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Watchlist Table                            ││
│  │  ┌────────┬──────────┬────────┬─────────┬────────┬───────┐ ││
│  │  │ Symbol │   Name   │ Price  │ Change  │  Tags  │Eligible│ ││
│  │  ├────────┼──────────┼────────┼─────────┼────────┼───────┤ ││
│  │  │ AAPL   │ Apple    │ $192.53│ +1.23%  │ Tech   │   ✓   │ ││
│  │  │ MSFT   │ Microsoft│ $417.88│ +0.89%  │ Tech   │   ✓   │ ││
│  │  │ GOOGL  │ Alphabet │ $176.42│ -0.45%  │ Tech   │   ✓   │ ││
│  │  │ BTC/USD│ Bitcoin  │$67,234 │ +2.34%  │ Crypto │   ✗   │ ││
│  │  └────────┴──────────┴────────┴─────────┴────────┴───────┘ ││
│  │                          │                                   ││
│  │                  useMarketQuotes                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `Tabs` | Multi-watchlist navigation | `components/ui/tabs` |
| `SearchBar` | Filter symbols in watchlist | `components/research/SearchBar` |
| `AddSymbolDialog` | Modal to add new symbols | `components/research/AddSymbolDialog` |
| `WatchlistTable` | Data table with market quotes | `components/research/WatchlistTable` |
| `SummaryStatsCards` | Top gainer, loser, eligible | `components/research/SummaryStats` |

## API Endpoints

### GET `/api/watchlists`

Returns all user watchlists with items.

**Response:**
```typescript
interface Watchlist {
  id: string;
  name: string;
  userId: string;
  items: WatchlistItem[];
  createdAt: string;
  updatedAt: string;
}

interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  tags: string[];
  eligible: boolean;    // Trading eligibility
}
```

### GET `/api/market/quotes?symbols=...`

Returns real-time market quotes for specified symbols.

**Default Symbols:**
```typescript
const DEFAULT_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA',
  'TSLA', 'META', 'JPM', 'V', 'JNJ',
  'WMT', 'PG', 'SPY', 'QQQ',
  'BTC/USD', 'ETH/USD'
];
```

**Response:**
```typescript
interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
}
```

**Refetch Interval:** 30 seconds (staleTime: 15 seconds)

### POST `/api/watchlists/{watchlistId}/symbols`

Add a symbol to a watchlist.

**Request:**
```typescript
{
  symbol: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  item: WatchlistItem;
}
```

### DELETE `/api/watchlists/{watchlistId}/symbols/{symbol}`

Remove a symbol from a watchlist.

**Response:**
```typescript
{
  success: boolean;
}
```

## Data Flow

```
1. Page Load
   │
   ├─► useWatchlists() ─► GET /api/watchlists
   │                       │
   │                       └─► storage.getWatchlists()
   │                           └─► Returns user's watchlists
   │
   └─► useMarketQuotes({ symbols }) ─► GET /api/market/quotes?symbols=...
                                        │
                                        └─► alpaca.getSnapshots(symbols)
                                            └─► Returns real-time quotes

2. Add Symbol
   │
   └─► useAddToWatchlist.mutate() ─► POST /api/watchlists/{id}/symbols
                                      │
                                      ├─► Invalidate ['watchlists'] cache
                                      └─► Invalidate ['watchlists', id] cache

3. Remove Symbol
   │
   └─► useRemoveFromWatchlist.mutate() ─► DELETE /api/watchlists/{id}/symbols/{sym}
                                           │
                                           ├─► Invalidate ['watchlists'] cache
                                           └─► Invalidate ['watchlists', id] cache
```

## Add Symbol Dialog

The AddSymbolDialog displays 16 default symbols with current prices:

```typescript
const DEFAULT_SYMBOLS_DISPLAY = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon', sector: 'Consumer' },
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla', sector: 'Automotive' },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Technology' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Finance' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Finance' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { symbol: 'WMT', name: 'Walmart', sector: 'Retail' },
  { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer' },
  { symbol: 'SPY', name: 'S&P 500 ETF', sector: 'ETF' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF', sector: 'ETF' },
  { symbol: 'BTC/USD', name: 'Bitcoin', sector: 'Crypto' },
  { symbol: 'ETH/USD', name: 'Ethereum', sector: 'Crypto' },
];
```

## User Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| Switch Watchlist | Click tab | Display different watchlist |
| Search Symbols | Type in search | Filter table by symbol/name |
| Add Symbol | Click "+ Add Symbol" | Open dialog with symbol list |
| Select Symbol | Click symbol in dialog | Add to active watchlist |
| Remove Symbol | Click "X" on row | Remove from watchlist |
| View Details | Click row | (Future: navigate to symbol detail) |

## State Management

```typescript
// lib/api/hooks/useWatchlists.ts
const { data: watchlists, isLoading } = useQuery({
  queryKey: ['watchlists'],
  queryFn: fetchWatchlists,
});

// lib/api/hooks/useMarketQuotes.ts
const { data: quotes } = useQuery({
  queryKey: ['market-quotes', symbols],
  queryFn: () => fetchMarketQuotes({ symbols }),
  refetchInterval: 30_000,
  staleTime: 15_000,
});

// lib/api/hooks/useAddToWatchlist.ts
const addMutation = useMutation({
  mutationFn: ({ watchlistId, symbol }) =>
    addToWatchlist(watchlistId, symbol),
  onSuccess: () => {
    queryClient.invalidateQueries(['watchlists']);
  },
});

// lib/api/hooks/useRemoveFromWatchlist.ts
const removeMutation = useMutation({
  mutationFn: ({ watchlistId, symbol }) =>
    removeFromWatchlist(watchlistId, symbol),
  onSuccess: () => {
    queryClient.invalidateQueries(['watchlists']);
  },
});
```

## Summary Statistics Calculation

```typescript
// Calculate from watchlist items
const stats = useMemo(() => {
  const items = activeWatchlist.items;

  // Top Gainer
  const topGainer = items.reduce((max, item) =>
    item.changePercent > max.changePercent ? item : max
  );

  // Top Loser
  const topLoser = items.reduce((min, item) =>
    item.changePercent < min.changePercent ? item : min
  );

  // Eligible Count
  const eligibleCount = items.filter(i => i.eligible).length;

  return { topGainer, topLoser, eligibleCount, totalCount: items.length };
}, [activeWatchlist]);
```

## Eligibility Criteria

Securities are marked as "eligible" based on:

1. **US Equities:** Stocks tradeable via Alpaca
2. **Fractionable:** Supports fractional shares
3. **Shortable:** Available for short selling (optional)
4. **Active:** Not halted or delisted

Crypto assets (BTC/USD, ETH/USD) are marked ineligible for the equity trading engine but can be tracked for research.

## Known Limitations

1. **Default Symbols Hardcoded:** The 16 symbols in AddSymbolDialog are hardcoded in the UI
2. **No Watchlist Creation UI:** Users cannot create new watchlists from this page
3. **Limited Symbol Search:** Can only search within current watchlist, not all available symbols

## Improvement Opportunities

- Add universal symbol search (search all available symbols)
- Add watchlist creation/deletion UI
- Add custom symbol entry (type any ticker)
- Add sector/industry filtering
- Add technical indicators overlay
- Add price alerts per symbol

## Related Files

- `app/research/page.tsx` - Main research page
- `lib/api/hooks/useWatchlists.ts` - Watchlists data hook
- `lib/api/hooks/useMarketQuotes.ts` - Market quotes hook
- `lib/api/hooks/useAddToWatchlist.ts` - Add symbol mutation
- `lib/api/hooks/useRemoveFromWatchlist.ts` - Remove symbol mutation
- `server/routes/watchlists.ts` - Watchlist API routes (if exists)
- `server/routes/market.ts` - Market quotes API routes
- `server/connectors/alpaca.ts` - Alpaca data integration
