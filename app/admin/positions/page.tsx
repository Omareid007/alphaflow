"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Layers, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePositions } from "@/lib/api/hooks";
import { AnimatedPnL } from "@/components/ui/AnimatedPnL";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { useRealtimePositions } from "@/hooks/useRealtimePositions";
import { StalenessWarning } from "@/components/ui/StalenessWarning";

export default function PositionsPage() {
  const { data: positions = [], isLoading, error } = usePositions();

  // NEW: Real-time position updates (Task 3.4)
  const { positionUpdateTimes, lastUpdateTime } = useRealtimePositions({
    enabled: true,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Positions</h1>
          <p className="mt-1 text-muted-foreground">
            Active positions across all strategies
          </p>
        </div>
      </div>

      {/* Staleness Warning Banner (Task 3.4) */}
      <StalenessWarning
        lastUpdate={lastUpdateTime}
        threshold={60000}
        onRefresh={() => window.location.reload()}
      />

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
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-destructive">
                Failed to load positions.{" "}
                {error instanceof Error ? error.message : "Please try again."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                <Loader2 className="mr-2 h-4 w-4" />
                Retry
              </Button>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Entry Price</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead>Unrealized P&L</TableHead>
                  <TableHead>P&L %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((pos) => {
                  const posLastUpdate = positionUpdateTimes.get(pos.symbol);
                  return (
                    <TableRow key={pos.id}>
                      <TableCell className="font-medium">
                        {pos.symbol}
                      </TableCell>
                      <TableCell>
                        <LiveBadge
                          lastUpdate={posLastUpdate}
                          showLabel={false}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        {pos.side === "long"
                          ? `+${pos.qty}`
                          : `-${Math.abs(pos.qty)}`}
                      </TableCell>
                      <TableCell>
                        ${Number(pos.entryPrice || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        ${Number(pos.currentPrice || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <AnimatedPnL
                          value={pos.unrealizedPl || 0}
                          showSign
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        <AnimatedPnL
                          value={pos.unrealizedPlPct || 0}
                          showSign
                          size="sm"
                          formatter={(v) => `${v.toFixed(2)}%`}
                        />
                      </TableCell>
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
