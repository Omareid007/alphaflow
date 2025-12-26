"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Database, RefreshCw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUniverseStats, useUniverseSymbols, useUniverseSearch, useSyncUniverse } from "@/lib/api/hooks";

export default function UniversePage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [assetClassFilter, setAssetClassFilter] = useState<string | undefined>(undefined);

  const { data: stats, isLoading: statsLoading } = useUniverseStats();
  const { data: symbols = [], isLoading: symbolsLoading, refetch } = useUniverseSymbols({
    assetClass: assetClassFilter,
    tradableOnly: true,
    limit: 100
  });
  const { data: searchResults = [] } = useUniverseSearch(searchQuery);
  const syncUniverse = useSyncUniverse();

  const handleSync = async () => {
    try {
      toast({ title: "Syncing universe from Alpaca..." });
      await syncUniverse.mutateAsync();
      await refetch();
      toast({ title: "Universe synced successfully" });
    } catch (error) {
      toast({ title: "Failed to sync universe", variant: "destructive" });
    }
  };

  const displaySymbols = searchQuery.length > 0 ? searchResults : symbols;
  const isLoading = statsLoading || symbolsLoading;

  if (isLoading && !stats) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Universe</h1>
          <p className="mt-1 text-muted-foreground">Manage trading universes and symbol eligibility</p>
        </div>
        <Button onClick={handleSync} disabled={syncUniverse.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${syncUniverse.isPending ? 'animate-spin' : ''}`} />
          Sync Universe
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Symbols</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalSymbols?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Symbols</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.activeSymbols?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">US Equities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.equityCount?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Crypto Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.cryptoCount?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search symbols..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={assetClassFilter === undefined ? "default" : "outline"}
            size="sm"
            onClick={() => setAssetClassFilter(undefined)}
          >
            All
          </Button>
          <Button
            variant={assetClassFilter === "us_equity" ? "default" : "outline"}
            size="sm"
            onClick={() => setAssetClassFilter("us_equity")}
          >
            Equities
          </Button>
          <Button
            variant={assetClassFilter === "crypto" ? "default" : "outline"}
            size="sm"
            onClick={() => setAssetClassFilter("crypto")}
          >
            Crypto
          </Button>
        </div>
      </div>

      {/* Symbol List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Symbol List ({displaySymbols.length} shown)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {displaySymbols.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? 'No symbols match your search.' : 'No symbols found. Click "Sync Universe" to fetch from Alpaca.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {displaySymbols.slice(0, 50).map(asset => (
                <div key={asset.symbol} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{asset.symbol}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{asset.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={asset.tradable ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                      {asset.tradable ? 'Tradable' : 'Non-tradable'}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {asset.assetClass === 'us_equity' ? 'Equity' : asset.assetClass === 'crypto' ? 'Crypto' : asset.assetClass}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          {displaySymbols.length > 50 && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Showing first 50 of {displaySymbols.length} symbols. Use search to find specific symbols.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
