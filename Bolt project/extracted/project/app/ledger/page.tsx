"use client";

import { useState, useMemo } from "react";
import { useTrades, useStrategies } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LedgerPage() {
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { data: strategies = [], isLoading: strategiesLoading } = useStrategies();

  const [searchSymbol, setSearchSymbol] = useState("");
  const [filterSide, setFilterSide] = useState<string>("all");
  const [filterStrategy, setFilterStrategy] = useState<string>("all");
  const [filterTime, setFilterTime] = useState<string>("all");

  const loading = tradesLoading || strategiesLoading;

  // Map trades to ledger entry format
  const entries = trades.map(trade => ({
    id: trade.id,
    symbol: trade.symbol,
    side: trade.side,
    qty: trade.qty,
    price: trade.price,
    fee: trade.fee || 0,
    strategyId: trade.strategyId,
    strategyName: trade.strategyName,
    time: trade.executedAt,
    realizedPnl: undefined as number | undefined,
    unrealizedPnl: undefined as number | undefined
  }));

  const filteredEntries = useMemo(() => {
    let result = [...entries];

    if (searchSymbol) {
      result = result.filter(e =>
        e.symbol.toLowerCase().includes(searchSymbol.toLowerCase())
      );
    }

    if (filterSide !== "all") {
      result = result.filter(e => e.side === filterSide);
    }

    if (filterStrategy !== "all") {
      result = result.filter(e => e.strategyId === filterStrategy);
    }

    if (filterTime !== "all") {
      const now = new Date();
      const cutoff = new Date();
      if (filterTime === "today") {
        cutoff.setHours(0, 0, 0, 0);
      } else if (filterTime === "week") {
        cutoff.setDate(now.getDate() - 7);
      } else if (filterTime === "month") {
        cutoff.setMonth(now.getMonth() - 1);
      }
      result = result.filter(e => new Date(e.time) >= cutoff);
    }

    return result;
  }, [entries, searchSymbol, filterSide, filterStrategy, filterTime]);

  const totalPnl = filteredEntries.reduce((sum, e) => {
    return sum + (e.realizedPnl || 0);
  }, 0);

  const totalFees = filteredEntries.reduce((sum, e) => sum + e.fee, 0);

  const clearFilters = () => {
    setSearchSymbol("");
    setFilterSide("all");
    setFilterStrategy("all");
    setFilterTime("all");
  };

  const hasFilters = searchSymbol || filterSide !== "all" || filterStrategy !== "all" || filterTime !== "all";

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Ledger</h1>
        <p className="mt-1 text-muted-foreground">
          Order history and P&L breakdown
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="mt-1 text-2xl font-semibold">{filteredEntries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Realized P&L</p>
            <p className={cn("mt-1 text-2xl font-semibold", totalPnl >= 0 ? "text-success" : "text-destructive")}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Fees</p>
            <p className="mt-1 text-2xl font-semibold">${totalFees.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Net P&L</p>
            <p className={cn("mt-1 text-2xl font-semibold", totalPnl - totalFees >= 0 ? "text-success" : "text-destructive")}>
              {totalPnl - totalFees >= 0 ? "+" : ""}${(totalPnl - totalFees).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg">Orders</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search symbol..."
                  value={searchSymbol}
                  onChange={e => setSearchSymbol(e.target.value)}
                  className="w-40 pl-9"
                />
              </div>

              <Select value={filterTime} onValueChange={setFilterTime}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSide} onValueChange={setFilterSide}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Side" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sides</SelectItem>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStrategy} onValueChange={setFilterStrategy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Strategies</SelectItem>
                  {strategies.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredEntries.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead>Strategy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map(entry => {
                  const renderPnl = () => {
                    if (typeof entry.realizedPnl === 'number') {
                      const pnl = entry.realizedPnl;
                      return (
                        <span className={pnl >= 0 ? "text-success" : "text-destructive"}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </span>
                      );
                    }
                    if (typeof entry.unrealizedPnl === 'number') {
                      const pnl = entry.unrealizedPnl;
                      return (
                        <span className={cn("text-sm", pnl >= 0 ? "text-success/70" : "text-destructive/70")}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </span>
                      );
                    }
                    return "-";
                  };

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(entry.time).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">{entry.symbol}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={entry.side === "buy" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}
                        >
                          {entry.side === "buy" ? (
                            <TrendingUp className="mr-1 h-3 w-3" />
                          ) : (
                            <TrendingDown className="mr-1 h-3 w-3" />
                          )}
                          {entry.side.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{entry.qty}</TableCell>
                      <TableCell className="text-right">${entry.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${(entry.qty * entry.price).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">${entry.fee.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{renderPnl()}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.strategyName}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
