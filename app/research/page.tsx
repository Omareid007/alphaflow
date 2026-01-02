"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  useWatchlists,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useMarketQuotes,
} from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorCard } from "@/components/ui/error-card";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { SearchBar } from "./SearchBar";
import { AddSymbolDialog } from "./AddSymbolDialog";
import { WatchlistTable } from "./WatchlistTable";
import { SummaryStatsCards } from "./SummaryStatsCards";
import { useAuth } from "@/components/providers/auth-provider";
import { useRealTimeTrading } from "@/lib/hooks/useRealTimeTrading";
import { ConnectionStatus } from "@/components/trading/ConnectionStatus";
import { useQueryClient } from "@tanstack/react-query";

// Symbol metadata (names only, prices fetched from API)
const symbolMetadata: Record<string, string> = {
  AAPL: "Apple Inc",
  MSFT: "Microsoft Corp",
  GOOGL: "Alphabet Inc",
  AMZN: "Amazon.com Inc",
  NVDA: "NVIDIA Corp",
  TSLA: "Tesla Inc",
  META: "Meta Platforms",
  JPM: "JPMorgan Chase",
  V: "Visa Inc",
  JNJ: "Johnson & Johnson",
  WMT: "Walmart Inc",
  PG: "Procter & Gamble",
  SPY: "S&P 500 ETF",
  QQQ: "Nasdaq 100 ETF",
  "BTC/USD": "Bitcoin",
  "ETH/USD": "Ethereum",
};

const defaultSymbols = Object.keys(symbolMetadata);

export default function ResearchPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeWatchlist, setActiveWatchlist] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const {
    data: watchlists = [],
    isLoading: loading,
    error: watchlistsError,
    refetch: refetchWatchlists,
  } = useWatchlists();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  // Fetch real-time quotes for all default symbols
  const {
    data: quotes = [],
    error: quotesError,
    refetch: refetchQuotes,
  } = useMarketQuotes(defaultSymbols);

  // Real-time SSE connection for live price updates
  const { isConnected, status } = useRealTimeTrading({
    enabled: !!user?.id,
    userId: user?.id,
    onPriceUpdate: (data) => {
      // Invalidate market quotes query to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["marketQuotes"] });
    },
  });

  // Combined error state
  const hasError = watchlistsError || quotesError;
  const errorMessage = watchlistsError
    ? "Failed to load watchlists"
    : quotesError
      ? "Failed to load market quotes"
      : null;

  const handleRetry = useCallback(() => {
    if (watchlistsError) refetchWatchlists();
    if (quotesError) refetchQuotes();
  }, [watchlistsError, quotesError, refetchWatchlists, refetchQuotes]);

  // Build availableSymbols with real-time prices
  const availableSymbols = useMemo(() => {
    return defaultSymbols.map((symbol) => {
      const quote = quotes.find((q) => q.symbol === symbol);
      return {
        symbol,
        name: symbolMetadata[symbol] || symbol,
        price: quote?.price || 0,
        change: quote?.change || 0,
        changePercent: quote?.changePercent || 0,
      };
    });
  }, [quotes]);

  // Set initial active watchlist when data loads
  useEffect(() => {
    if (watchlists.length > 0 && !activeWatchlist) {
      setActiveWatchlist(watchlists[0].id);
    }
  }, [watchlists, activeWatchlist]);

  const currentWatchlist = useMemo(
    () => watchlists.find((w) => w.id === activeWatchlist),
    [watchlists, activeWatchlist]
  );

  const filteredItems = useMemo(
    () =>
      currentWatchlist?.items.filter(
        (item) =>
          item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) || [],
    [currentWatchlist?.items, searchQuery]
  );

  const handleAddSymbol = useCallback(
    async (symbol: string) => {
      if (!activeWatchlist) return;
      try {
        await addToWatchlist.mutateAsync({
          watchlistId: activeWatchlist,
          symbol,
        });
        toast.success(`${symbol} added to watchlist`);
        setAddDialogOpen(false);
      } catch (error) {
        toast.error(`Failed to add ${symbol} to watchlist`);
      }
    },
    [activeWatchlist, addToWatchlist]
  );

  const handleRemoveSymbol = useCallback(
    async (symbol: string) => {
      if (!activeWatchlist) return;
      try {
        await removeFromWatchlist.mutateAsync({
          watchlistId: activeWatchlist,
          symbol,
        });
        toast.success(`${symbol} removed from watchlist`);
      } catch (error) {
        toast.error(`Failed to remove ${symbol} from watchlist`);
      }
    },
    [activeWatchlist, removeFromWatchlist]
  );

  // Compute available symbols to add (must be before conditional returns for hooks rules)
  const availableToAdd = useMemo(() => {
    const symbolsInWatchlist =
      currentWatchlist?.items.map((i) => i.symbol) || [];
    return availableSymbols.filter(
      (s) => !symbolsInWatchlist.includes(s.symbol)
    );
  }, [currentWatchlist?.items, availableSymbols]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Research</h1>
            <p className="mt-1 text-muted-foreground">
              Manage your watchlists and research universe
            </p>
          </div>
          {user?.id && (
            <ConnectionStatus
              userId={user.id}
              compact={false}
              showStats={true}
            />
          )}
        </div>

        <ErrorCard
          title="Error Loading Data"
          message={errorMessage ?? "Failed to load data"}
          details={
            watchlistsError instanceof Error
              ? watchlistsError.message
              : quotesError instanceof Error
                ? quotesError.message
                : undefined
          }
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Research</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your watchlists and research universe
          </p>
        </div>
        {user?.id && (
          <ConnectionStatus userId={user.id} compact={false} showStats={true} />
        )}
      </div>

      <Tabs value={activeWatchlist || ""} onValueChange={setActiveWatchlist}>
        <div className="flex items-center justify-between">
          <TabsList>
            {watchlists.map((wl) => (
              <TabsTrigger key={wl.id} value={wl.id}>
                <Star className="mr-2 h-4 w-4" />
                {wl.name}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex items-center gap-3">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <AddSymbolDialog
              open={addDialogOpen}
              onOpenChange={setAddDialogOpen}
              availableSymbols={availableToAdd}
              onAddSymbol={handleAddSymbol}
            />
          </div>
        </div>

        {watchlists.map((wl) => (
          <TabsContent key={wl.id} value={wl.id} className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{wl.name}</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {wl.items.length} symbols
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredItems.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? "No symbols match your search"
                        : "No symbols in this watchlist"}
                    </p>
                  </div>
                ) : (
                  <WatchlistTable
                    items={filteredItems}
                    onRemoveSymbol={handleRemoveSymbol}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <SummaryStatsCards items={currentWatchlist?.items || []} />
    </div>
  );
}
