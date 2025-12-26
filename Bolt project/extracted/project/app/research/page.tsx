"use client";

import { useState } from "react";
import { useWatchlists, useAddToWatchlist, useRemoveFromWatchlist } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { SearchBar } from "./SearchBar";
import { AddSymbolDialog } from "./AddSymbolDialog";
import { WatchlistTable } from "./WatchlistTable";
import { SummaryStatsCards } from "./SummaryStatsCards";

const availableSymbols = [
  { symbol: "AAPL", name: "Apple Inc", price: 178.52 },
  { symbol: "MSFT", name: "Microsoft Corp", price: 378.91 },
  { symbol: "GOOGL", name: "Alphabet Inc", price: 141.80 },
  { symbol: "AMZN", name: "Amazon.com Inc", price: 178.25 },
  { symbol: "NVDA", name: "NVIDIA Corp", price: 495.22 },
  { symbol: "TSLA", name: "Tesla Inc", price: 248.48 },
  { symbol: "META", name: "Meta Platforms", price: 505.95 },
  { symbol: "JPM", name: "JPMorgan Chase", price: 183.27 },
  { symbol: "V", name: "Visa Inc", price: 279.53 },
  { symbol: "JNJ", name: "Johnson & Johnson", price: 156.74 },
  { symbol: "WMT", name: "Walmart Inc", price: 163.42 },
  { symbol: "PG", name: "Procter & Gamble", price: 147.89 }
];

export default function ResearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeWatchlist, setActiveWatchlist] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: watchlists = [], isLoading: loading } = useWatchlists();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  // Set initial active watchlist when data loads
  if (watchlists.length > 0 && !activeWatchlist) {
    setActiveWatchlist(watchlists[0].id);
  }

  const currentWatchlist = watchlists.find(w => w.id === activeWatchlist);

  const filteredItems = currentWatchlist?.items.filter(item =>
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleAddSymbol = async (symbol: string) => {
    if (!activeWatchlist) return;
    try {
      await addToWatchlist.mutateAsync({ watchlistId: activeWatchlist, symbol });
      toast.success(`${symbol} added to watchlist`);
      setAddDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to add ${symbol} to watchlist`);
    }
  };

  const handleRemoveSymbol = async (symbol: string) => {
    if (!activeWatchlist) return;
    try {
      await removeFromWatchlist.mutateAsync({ watchlistId: activeWatchlist, symbol });
      toast.success(`${symbol} removed from watchlist`);
    } catch (error) {
      toast.error(`Failed to remove ${symbol} from watchlist`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const symbolsInWatchlist = currentWatchlist?.items.map(i => i.symbol) || [];
  const availableToAdd = availableSymbols.filter(s => !symbolsInWatchlist.includes(s.symbol));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Research</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your watchlists and research universe
        </p>
      </div>

      <Tabs value={activeWatchlist || ""} onValueChange={setActiveWatchlist}>
        <div className="flex items-center justify-between">
          <TabsList>
            {watchlists.map(wl => (
              <TabsTrigger key={wl.id} value={wl.id}>
                <Star className="mr-2 h-4 w-4" />
                {wl.name}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex items-center gap-3">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <AddSymbolDialog
              open={addDialogOpen}
              onOpenChange={setAddDialogOpen}
              availableSymbols={availableToAdd}
              onAddSymbol={handleAddSymbol}
            />
          </div>
        </div>

        {watchlists.map(wl => (
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
                      {searchQuery ? "No symbols match your search" : "No symbols in this watchlist"}
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
