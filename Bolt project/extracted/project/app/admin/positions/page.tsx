"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Layers, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePositions } from "@/lib/api/hooks";

export default function PositionsPage() {
  const { data: positions = [], isLoading, error } = usePositions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Positions</h1>
        <p className="mt-1 text-muted-foreground">Active positions across all strategies</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Current Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-destructive">
              Failed to load positions. Please try again.
            </div>
          ) : positions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No active positions
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Entry Price</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead>Unrealized P&L</TableHead>
                  <TableHead>P&L %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map(pos => (
                  <TableRow key={pos.id}>
                    <TableCell className="font-medium">{pos.symbol}</TableCell>
                    <TableCell>
                      {pos.side === 'long' ? `+${pos.qty}` : `-${pos.qty}`}
                    </TableCell>
                    <TableCell>${Number(pos.entryPrice).toFixed(2)}</TableCell>
                    <TableCell>${Number(pos.currentPrice).toFixed(2)}</TableCell>
                    <TableCell className={cn(pos.unrealizedPl >= 0 ? 'text-success' : 'text-destructive')}>
                      {pos.unrealizedPl >= 0 ? '+' : ''}${Number(pos.unrealizedPl).toFixed(2)}
                    </TableCell>
                    <TableCell className={cn(pos.unrealizedPlPct >= 0 ? 'text-success' : 'text-destructive')}>
                      {pos.unrealizedPlPct >= 0 ? '+' : ''}{Number(pos.unrealizedPlPct).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
